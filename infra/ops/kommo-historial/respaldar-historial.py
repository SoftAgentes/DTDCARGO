#!/usr/bin/env python3
"""
respaldar-historial.py — SDD-0582 etapa E5, pasos 5.1 (respaldo cifrado) y 5.2 (medir volumen).

Corre en el VPS con Python 3.12 y solo la biblioteca estándar; usa `age`, `zstd` y `tar` del host.

Reglas que cumple:
- El token de Kommo se lee de un archivo 0600 en /dev/shm. Nunca va en argv, nunca se imprime.
- Los datos en claro viven SOLO en tmpfs (staging bajo /dev/shm). En disco quedan `.age`,
  `.sha256` e informes con conteos. Los adjuntos se descargan a memoria y se cifran uno por uno.
- El log y la pantalla llevan ids, conteos, códigos HTTP y nombres de campo. Nunca texto de
  mensajes, nombres, teléfonos, URLs firmadas ni el token.
- Es reanudable: cada entidad y cada conversación quedan marcadas al terminar; una segunda
  corrida sigue donde iba.

Subcomandos:
  probar-token   forma, alcances, vencimiento y subdominio del token; GET /api/v4/account
  extraer        cuenta, usuarios, embudos, campos, contactos, leads, empresas, no clasificados,
                 notas, tareas, eventos de chat, conversaciones, mensajes y adjuntos
  informe        informe.json / informe.md con conteos (sin datos personales)
  empaquetar     tar | zstd | age del staging al destino, sha256, manifiesto; borra el staging
  todo           extraer + informe + empaquetar

Modo incremental (paso 5.3), con `--base <carpeta de un respaldo anterior> --corte <instante UTC>`
en `extraer` o `todo`: baja solo lo que cambió entre el corte anterior (menos `--solape-horas`) y el
`--corte`, que tiene que estar en el pasado. Mensajes posteriores al corte no entran. El corte queda
fijo en el staging: reanudar con otro corte o con otra base es un error. El manifiesto del paquete
dice de qué base parte, para que la carga (5.5) los aplique en orden y quite repetidos por id.

Uso típico (ver README.md de esta carpeta):
  python3 respaldar-historial.py todo --token-file /dev/shm/k0582-e5 \
      --staging /dev/shm/kommo-e5 --destino /srv/backups/kommo \
      --recipients /srv/ops/backup/age-recipients.txt --log /srv/backups/kommo/respaldo.log
"""
from __future__ import annotations

import argparse
import base64
import collections
import datetime as dt
import hashlib
import http.client
import io
import json
import os
import random
import re
import shutil
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

VERSION = "1.3.1"
# 5.5b: copias en claro de los adjuntos, dentro del staging (tmpfs), solo para el cargador del Archivo Kommo.
CARPETA_ADJUNTOS_CARGA = "adjuntos-carga"
SOLAPE_HORAS_POR_DEFECTO = 24
# Listas que en modo incremental se piden con filter[updated_at][from|to]. Las demás (cuenta, usuarios,
# embudos, campos, no clasificados) son chicas y se bajan enteras.
LISTAS_INCREMENTALES = ("contactos", "leads", "empresas", "notas-leads", "notas-contacts", "notas-companies", "tareas")
SUBDOMINIO_POR_DEFECTO = "dtdcargo"
DOMINIO = "kommo.com"
LIMITE_LISTAS = 250
LIMITE_EVENTOS = 100
LIMITE_MENSAJES = 250
TIPOS_EVENTOS_CHAT = ("incoming_chat_message", "outgoing_chat_message")
VENTANA_EVENTOS_DIAS = 30
COLA_EVENTOS_SEGUNDOS = 600  # al reanudar más tarde que esto, se baja una ventana de cola hasta ahora
HOSTS_CON_TOKEN = (".kommo.com", ".amocrm.com", ".amocrm.ru")
DIA = 86400
# Fallos de red que se reintentan. http.client.HTTPException cubre IncompleteRead (respuesta cortada a
# mitad de un adjunto, visto el 2026-10-31) y RemoteDisconnected; no son OSError y tumbaban la corrida.
ERRORES_RED = (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException)

# --------------------------------------------------------------------------- utilidades


class ErrorFatal(Exception):
    """Un error que no se reintenta: alcance, token, archivo faltante."""


def ahora() -> int:
    return int(time.time())


def segundos(ts) -> int | None:
    """Normaliza un timestamp de Kommo a segundos (algunos campos vienen en milisegundos)."""
    try:
        v = int(ts)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None
    return v // 1000 if v > 100_000_000_000 else v


def utc(ts) -> str:
    v = segundos(ts)
    if v is None:
        return "—"
    return dt.datetime.fromtimestamp(v, tz=dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def anio(ts) -> str:
    v = segundos(ts)
    if v is None:
        return "sin fecha"
    return str(dt.datetime.fromtimestamp(v, tz=dt.timezone.utc).year)


def limpiar_pegado(texto: str) -> str:
    """Quita saltos, espacios, secuencias ANSI y marcas de pegado que `read -s` deja pasar."""
    texto = re.sub(r"\x1b\[[0-9;?]*[ -/]*[@-~]", "", texto)
    texto = re.sub(r"\x1b[@-Z\\-_]", "", texto)
    return "".join(texto.split())


def cargar_token(ruta: str) -> str:
    try:
        st = os.stat(ruta)
    except FileNotFoundError as e:
        raise ErrorFatal(f"no existe el archivo del token: {ruta}") from e
    if os.name == "posix" and st.st_mode & 0o077:
        raise ErrorFatal(f"{ruta} tiene permisos {oct(st.st_mode & 0o777)}; tiene que ser 0600")
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        token = limpiar_pegado(f.read())
    if len(token) < 100:
        raise ErrorFatal(f"el token es muy corto ({len(token)} caracteres)")
    return token


def describir_emisor(claims: dict, subdominio: str) -> str:
    """El emisor (`iss`) del token frente a la cuenta. Los tokens de larga duración de Kommo pueden no traer
    `iss` (medido el 2026-11-06): entonces lo dice, en vez de compararlo con un texto vacío. La cuenta se comprueba
    de todos modos con GET /api/v4/account."""
    iss = str(claims.get("iss") or "").strip()
    if not iss:
        return "iss: no viene en el token (la cuenta se comprueba con GET /api/v4/account)"
    coincide = iss.rstrip("/").endswith(f"{subdominio}.{DOMINIO}")
    return f"iss coincide con {subdominio}.{DOMINIO}: {'sí' if coincide else 'no'}"


def claims_jwt(token: str) -> dict | None:
    partes = token.split(".")
    if len(partes) != 3 or not token.startswith("eyJ"):
        return None
    try:
        cuerpo = partes[1] + "=" * (-len(partes[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(cuerpo).decode("utf-8"))
    except Exception:  # noqa: BLE001 — un JWT raro se trata como «no es JWT»
        return None


def sha256_bytes(datos: bytes) -> str:
    return hashlib.sha256(datos).hexdigest()


def sha256_archivo(ruta: str) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def extension_segura(nombre: str | None) -> str:
    """Extensión en minúsculas, solo [a-z0-9], máximo 8 caracteres; `bin` si no hay."""
    if not nombre or "." not in nombre:
        return "bin"
    ext = nombre.rsplit(".", 1)[1].lower()
    ext = re.sub(r"[^a-z0-9]", "", ext)[:8]
    return ext or "bin"


def host_de(url: str) -> str:
    try:
        return urllib.parse.urlsplit(url).hostname or "?"
    except ValueError:
        return "?"


class Log:
    def __init__(self, ruta: str | None):
        if ruta:
            os.makedirs(os.path.dirname(os.path.abspath(ruta)), mode=0o700, exist_ok=True)
        self.archivo = open(ruta, "a", encoding="utf-8") if ruta else None

    def __call__(self, mensaje: str) -> None:
        linea = f"{utc(ahora())} {mensaje}"
        print(linea, flush=True)
        if self.archivo:
            self.archivo.write(linea + "\n")
            self.archivo.flush()

    def cerrar(self) -> None:
        if self.archivo:
            self.archivo.close()
            self.archivo = None


# --------------------------------------------------------------------------- cliente HTTP


class Kommo:
    """GET contra la API v4 con espaciado, reintentos y conteo por código. Nunca loguea el token."""

    def __init__(self, subdominio: str, token: str, log: Log, pausa: float = 0.25, timeout: int = 60,
                 abrir=None):
        self.base = f"https://{subdominio}.{DOMINIO}"
        self._token = token
        self.log = log
        self.pausa = pausa
        self.timeout = timeout
        self.abrir = abrir or urllib.request.urlopen
        self.ultima = 0.0
        self.codigos: collections.Counter[str] = collections.Counter()
        self.peticiones = 0
        self.segundos = 0.0

    def _esperar(self) -> None:
        falta = self.pausa - (time.monotonic() - self.ultima)
        if falta > 0:
            time.sleep(falta)

    def _peticion(self, url: str, con_token: bool) -> tuple[int, bytes, str]:
        cabeceras = {"User-Agent": f"dtd-0582-e5/{VERSION}", "Accept": "application/json"}
        if con_token:
            cabeceras["Authorization"] = f"Bearer {self._token}"
        req = urllib.request.Request(url, headers=cabeceras, method="GET")
        self._esperar()
        inicio = time.monotonic()
        try:
            with self.abrir(req, timeout=self.timeout) as resp:
                cuerpo = resp.read()
                tipo = resp.headers.get("Content-Type", "")
                codigo = resp.status
        except urllib.error.HTTPError as e:
            cuerpo = e.read() if hasattr(e, "read") else b""
            tipo = e.headers.get("Content-Type", "") if e.headers else ""
            codigo = e.code
        finally:
            self.ultima = time.monotonic()
            self.segundos += self.ultima - inicio
        self.peticiones += 1
        self.codigos[str(codigo)] += 1
        return codigo, cuerpo, tipo

    def get(self, ruta: str, params: dict | None = None, intentos: int = 6,
            tolerar_403: bool = False) -> tuple[int, dict | None]:
        """Devuelve (código, json). 204 y 404 dan (código, None). 401 lanza ErrorFatal; 403 también, salvo con
        `tolerar_403` (Kommo responde 403 «Not enough rights» en conversaciones sueltas que el usuario de la
        integración no puede ver: se registran y se sigue, en vez de tumbar una corrida de horas)."""
        url = self.base + ruta
        if params:
            url += ("&" if "?" in ruta else "?") + urllib.parse.urlencode(params, doseq=True)
        espera = 2.0
        for intento in range(1, intentos + 1):
            try:
                codigo, cuerpo, _ = self._peticion(url, con_token=True)
            except ERRORES_RED as e:
                self.codigos["red"] += 1
                if intento == intentos:
                    raise ErrorFatal(f"red agotada en {ruta}: {type(e).__name__}") from e
                self.log(f"  red: {type(e).__name__} en {ruta} (intento {intento}); espero {espera:.0f} s")
                time.sleep(espera)
                espera = min(espera * 2, 60)
                continue
            if codigo in (200, 201):
                try:
                    return codigo, json.loads(cuerpo.decode("utf-8"))
                except ValueError as e:
                    raise ErrorFatal(f"respuesta no JSON en {ruta}") from e
            if codigo in (204, 404):
                return codigo, None
            if codigo == 403 and tolerar_403:
                self.log(f"  HTTP 403 en {ruta}: sin derechos sobre ese recurso (se registra y se sigue)")
                return codigo, None
            if codigo == 401:
                raise ErrorFatal(f"HTTP 401 en {ruta}: el token no vale o venció")
            if codigo == 403:
                raise ErrorFatal(f"HTTP 403 en {ruta}: sin derechos (alcance de la integración o recurso vedado)")
            if codigo == 429 or codigo >= 500:
                if intento == intentos:
                    raise ErrorFatal(f"HTTP {codigo} persistente en {ruta}")
                self.log(f"  HTTP {codigo} en {ruta} (intento {intento}); espero {espera:.0f} s")
                time.sleep(espera)
                espera = min(espera * 2, 60)
                continue
            raise ErrorFatal(f"HTTP {codigo} inesperado en {ruta}")
        raise ErrorFatal(f"sin respuesta en {ruta}")

    def descargar(self, url: str, tope_bytes: int, intentos: int = 3) -> tuple[int, bytes, str]:
        """Descarga un adjunto a memoria. Manda el token solo a hosts de Kommo. Devuelve (código, datos, tipo)."""
        host = host_de(url)
        con_token = host.endswith(HOSTS_CON_TOKEN)
        espera = 2.0
        for intento in range(1, intentos + 1):
            try:
                codigo, cuerpo, tipo = self._peticion(url, con_token=con_token)
            except ERRORES_RED as e:
                self.codigos["red"] += 1
                if intento == intentos:
                    return 0, b"", type(e).__name__
                time.sleep(espera)
                espera *= 2
                continue
            if codigo in (401, 403) and con_token and intento == 1:
                con_token = False  # algunos enlaces firmados rechazan la cabecera
                continue
            if codigo == 429 or codigo >= 500:
                if intento < intentos:
                    time.sleep(espera)
                    espera *= 2
                    continue
            if len(cuerpo) > tope_bytes:
                return codigo, b"", "demasiado-grande"
            return codigo, cuerpo, tipo
        return 0, b"", "sin-respuesta"

    def paginar(self, ruta: str, params: dict | None, clave: str | None, limite: int, tolerar_403: bool = False):
        """Recorre `page=1..` hasta 204, página vacía, sin `_embedded` o página corta (< limite).
        Rinde (página, elementos). Una página incompleta es la última: no se pide la siguiente."""
        pagina = 1
        while True:
            p = dict(params or {})
            p["limit"] = limite
            p["page"] = pagina
            codigo, datos = self.get(ruta, p, tolerar_403=tolerar_403)
            if codigo != 200 or not datos:
                return
            emb = datos.get("_embedded") or {}
            if clave and clave in emb:
                elementos = emb[clave]
            else:
                elementos = next((v for v in emb.values() if isinstance(v, list)), [])
            if not elementos:
                return
            yield pagina, elementos
            if len(elementos) < limite:
                return
            pagina += 1


# --------------------------------------------------------------------------- staging en tmpfs


class Staging:
    def __init__(self, ruta: str):
        self.ruta = ruta
        os.makedirs(ruta, mode=0o700, exist_ok=True)
        os.chmod(ruta, 0o700)

    def ruta_de(self, nombre: str) -> str:
        return os.path.join(self.ruta, nombre)

    def existe(self, nombre: str) -> bool:
        return os.path.exists(self.ruta_de(nombre))

    def anexar_ndjson(self, nombre: str, elementos) -> int:
        n = 0
        with open(self.ruta_de(nombre), "a", encoding="utf-8") as f:
            for e in elementos:
                f.write(json.dumps(e, ensure_ascii=False, separators=(",", ":")) + "\n")
                n += 1
        return n

    def leer_ndjson(self, nombre: str):
        ruta = self.ruta_de(nombre)
        if not os.path.exists(ruta):
            return
        with open(ruta, encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if linea:
                    yield json.loads(linea)

    def escribir_json(self, nombre: str, datos) -> None:
        with open(self.ruta_de(nombre), "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=1)

    def leer_json(self, nombre: str):
        with open(self.ruta_de(nombre), encoding="utf-8") as f:
            return json.load(f)

    def marcar(self, nombre: str, valor: str) -> None:
        with open(self.ruta_de(nombre), "a", encoding="utf-8") as f:
            f.write(str(valor) + "\n")

    def marcados(self, nombre: str) -> set[str]:
        ruta = self.ruta_de(nombre)
        if not os.path.exists(ruta):
            return set()
        with open(ruta, encoding="utf-8") as f:
            return {l.strip() for l in f if l.strip()}

    def borrar(self, nombre: str) -> None:
        try:
            os.remove(self.ruta_de(nombre))
        except FileNotFoundError:
            pass


# --------------------------------------------------------------------------- extracción


def eventos_unicos(eventos):
    """Quita eventos repetidos por `id` (la ventana de cola de una reanudación se solapa con la más
    reciente, y Kommo repite alguno en el borde de una página)."""
    vistos: set = set()
    for ev in eventos:
        k = ev.get("id")
        if k is not None:
            if k in vistos:
                continue
            vistos.add(k)
        yield ev


def ids_de_eventos(eventos) -> dict[int, dict]:
    """De los eventos de chat saca {talk_id: {origen, entidad, entidad_id, primero, ultimo, n}}."""
    talks: dict[int, dict] = {}
    for ev in eventos_unicos(eventos):
        for va in ev.get("value_after") or []:
            m = (va or {}).get("message") or {}
            tid = m.get("talk_id")
            if tid is None:
                continue
            try:
                tid = int(tid)
            except (TypeError, ValueError):
                continue
            t = talks.setdefault(tid, {"origen": m.get("origin"), "entidad": ev.get("entity_type"),
                                       "entidad_id": ev.get("entity_id"), "primero": ev.get("created_at"),
                                       "ultimo": ev.get("created_at"), "n": 0})
            t["n"] += 1
            ca = ev.get("created_at") or 0
            if t["primero"] is None or (ca and ca < t["primero"]):
                t["primero"] = ca
            if t["ultimo"] is None or (ca and ca > t["ultimo"]):
                t["ultimo"] = ca
            if not t["origen"] and m.get("origin"):
                t["origen"] = m.get("origin")
    return talks


def ventanas(desde: int, hasta: int, dias: int = VENTANA_EVENTOS_DIAS):
    """Ventanas [a, b] de `dias` días, de la más reciente a la más antigua."""
    b = hasta
    while b > desde:
        a = max(desde, b - dias * DIA)
        yield a, b
        b = a - 1


def parsear_instante(texto: str) -> int:
    """`2026-11-20T03:00:00Z`, `2026-11-20` (medianoche UTC) o segundos epoch → segundos epoch UTC."""
    t = str(texto or "").strip()
    if re.fullmatch(r"\d{9,11}", t):
        return int(t)
    for formato in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%MZ", "%Y-%m-%d"):
        try:
            return int(dt.datetime.strptime(t, formato).replace(tzinfo=dt.timezone.utc).timestamp())
        except ValueError:
            continue
    raise ErrorFatal(f"instante no reconocido: {t[:40]!r}; usa AAAA-MM-DDTHH:MM:SSZ en UTC")


def leer_base(carpeta: str) -> dict:
    """De la carpeta de un respaldo anterior, lo único que hace falta sin descifrar nada: su stamp, el corte
    si fue incremental, y la huella del paquete. Todo sale de `manifiesto.json`."""
    ruta = os.path.join(carpeta, "manifiesto.json")
    try:
        with open(ruta, encoding="utf-8") as f:
            m = json.load(f)
    except (OSError, ValueError) as e:
        raise ErrorFatal(f"no se pudo leer el manifiesto de la base ({os.path.basename(carpeta)}): {type(e).__name__}")
    stamp = str(m.get("stamp") or "")
    try:
        instante_stamp = int(dt.datetime.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc).timestamp())
    except ValueError:
        raise ErrorFatal(f"la base no tiene un stamp válido: {stamp[:30]!r}")
    paquete = [a for a in m.get("archivos") or [] if str(a.get("archivo", "")).endswith("metadatos.tar.zst.age")]
    corte_previo = (m.get("incremental") or {}).get("corte") or m.get("corte")
    return {"stamp": stamp, "hasta": int(corte_previo) if corte_previo else instante_stamp,
            "sha256_paquete": paquete[0].get("sha256") if paquete else None}


def preparar_incremental(args, st: Staging) -> dict | None:
    """Fija base, desde y corte en el staging (`incremental.json`). Sin `--base` ni `--corte`, es una corrida
    completa como en 5.1. Reanudar con otra base o con otro corte es un error: el resultado dejaría de ser
    el mismo para el mismo pedido."""
    base_dir, corte_txt = getattr(args, "base", None), getattr(args, "corte", None)
    if not base_dir and not corte_txt:
        if st.existe("incremental.json"):
            raise ErrorFatal("este staging es de una corrida incremental: pasa el mismo --base y --corte")
        if st.existe("corte.json"):
            raise ErrorFatal("este staging es de una corrida completa con corte: pasa el mismo --corte")
        return None
    if base_dir and not corte_txt:
        raise ErrorFatal("el modo incremental pide --base y --corte juntos")
    corte = parsear_instante(corte_txt)
    if corte > ahora():
        raise ErrorFatal(f"el corte {utc(corte)} está en el futuro: tiene que ser un instante ya pasado")
    if not base_dir:
        # Completa hasta el corte (5.5): todo lo que hay hasta ese instante, para cargarlo en la misma ventana.
        if st.existe("incremental.json"):
            raise ErrorFatal("este staging es de una corrida incremental: pasa el mismo --base y --corte")
        plan = {"corte": corte, "version": VERSION}
        if st.existe("corte.json") and st.leer_json("corte.json").get("corte") != corte:
            raise ErrorFatal("el staging es de otra corrida con corte (corte distinto): usa otro staging")
        if not st.existe("corte.json"):
            st.escribir_json("corte.json", plan)
        return {"corte": corte, "desde": None, "base_stamp": None}
    if st.existe("corte.json"):
        raise ErrorFatal("este staging es de una corrida completa con corte: no se le aplica una base")
    base = leer_base(base_dir)
    solape = int(getattr(args, "solape_horas", SOLAPE_HORAS_POR_DEFECTO)) * 3600
    desde = base["hasta"] - solape
    if desde >= corte:
        raise ErrorFatal(f"el corte {utc(corte)} no es posterior al inicio {utc(desde)} de esta corrida")
    plan = {"base_stamp": base["stamp"], "base_sha256_paquete": base["sha256_paquete"], "desde": desde,
            "corte": corte, "solape_segundos": solape, "version": VERSION}
    if st.existe("incremental.json"):
        previo = st.leer_json("incremental.json")
        for clave in ("base_stamp", "corte", "desde"):
            if previo.get(clave) != plan[clave]:
                raise ErrorFatal(f"el staging es de otra corrida incremental ({clave} distinto): usa otro staging")
        return previo
    st.escribir_json("incremental.json", plan)
    return plan


class Extractor:
    def __init__(self, api: Kommo, st: Staging, log: Log, args):
        self.api, self.st, self.log, self.args = api, st, log, args
        plan = preparar_incremental(args, st)
        # `inc` solo si hay base (incremental); `corte` también en la completa hasta el corte (5.5).
        self.inc = plan if plan and plan.get("base_stamp") else None
        self.corte = plan["corte"] if plan else None
        if self.inc:
            log(f"incremental: base {self.inc['base_stamp']}, desde {utc(self.inc['desde'])}, corte {utc(self.inc['corte'])}")
        elif self.corte:
            log(f"completa hasta el corte {utc(self.corte)}")

    def en_corte(self, ts) -> bool:
        """Sin corte, todo entra. Con corte, solo lo creado hasta el corte inclusive."""
        if self.corte is None:
            return True
        s = segundos(ts)
        return s is not None and s <= self.corte

    # ---- entidades simples
    def entidad_lista(self, nombre: str, ruta: str, params: dict | None, clave: str):
        marca = f"listo-{nombre}"
        if self.st.existe(marca):
            self.log(f"{nombre}: ya estaba (se salta)")
            return
        if self.inc and nombre in LISTAS_INCREMENTALES:
            params = dict(params or {})
            params["filter[updated_at][from]"] = self.inc["desde"]
            params["filter[updated_at][to]"] = self.inc["corte"]
        archivo = f"{nombre}.ndjson"
        self.st.borrar(archivo)
        total = 0
        for pagina, elementos in self.api.paginar(ruta, params, clave, LIMITE_LISTAS):
            total += self.st.anexar_ndjson(archivo, elementos)
            if pagina % 10 == 0:
                self.log(f"{nombre}: página {pagina}, {total} acumulados")
        self.st.marcar(marca, str(total))
        self.log(f"{nombre}: {total} elementos")

    def entidad_una(self, nombre: str, ruta: str, params: dict | None = None):
        marca = f"listo-{nombre}"
        if self.st.existe(marca):
            self.log(f"{nombre}: ya estaba (se salta)")
            return
        codigo, datos = self.api.get(ruta, params)
        self.st.escribir_json(f"{nombre}.json", {"_http": codigo, "datos": datos})
        self.st.marcar(marca, str(codigo))
        self.log(f"{nombre}: HTTP {codigo}")

    def cuenta(self):
        self.entidad_una("cuenta", "/api/v4/account",
                         {"with": "amojo_id,version,datetime_settings,drive_url,task_types,users_groups"})

    def desde(self) -> int:
        """Inicio de la enumeración de eventos. En modo incremental, el corte de la base menos el solape.
        Si no, `--desde` manda; si no, la creación de la cuenta, salvo que Kommo devuelva una fecha reciente
        (en la cuenta de DTD `created_at` trae la hora de la consulta, medido el 2026-10-30), en cuyo caso se
        parte del 2019-01-01."""
        if self.inc:
            return self.inc["desde"]
        if self.args.desde:
            return int(dt.datetime.strptime(self.args.desde, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc).timestamp())
        try:
            c = (self.st.leer_json("cuenta.json") or {}).get("datos") or {}
            creada = segundos(c.get("created_at"))
            if creada and creada < ahora() - 30 * DIA:
                return creada - DIA
        except (FileNotFoundError, ValueError):
            pass
        return int(dt.datetime(2019, 1, 1, tzinfo=dt.timezone.utc).timestamp())

    # ---- eventos de chat por ventanas
    def ancla_eventos(self, marcas: set[str]) -> int:
        """Fin fijo de las ventanas de eventos. Se decide en la primera corrida y se guarda en el staging:
        si se calculara de nuevo con la hora de la reanudación, ninguna ventana coincidiría con las ya
        marcadas y se bajarían (y duplicarían) las 96 otra vez. Un staging de la versión 1.0 no trae el
        archivo: se toma el fin de la primera ventana marcada, que es la más reciente de esa corrida."""
        ruta = self.st.ruta_de("eventos-hasta.txt")
        if self.corte is not None:
            # El corte es el fin fijo: no hay ventana de cola ni hora de la primera corrida que recordar.
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(str(self.corte))
            return self.corte
        if self.st.existe("eventos-hasta.txt"):
            with open(ruta, encoding="utf-8") as f:
                return int(f.read().strip())
        if marcas:
            with open(self.st.ruta_de("listo-eventos-ventanas"), encoding="utf-8") as f:
                hasta = int(f.readline().strip().split(":")[2])
        else:
            hasta = ahora() + DIA
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(str(hasta))
        return hasta

    def eventos(self):
        desde = self.desde()
        marcas = self.st.marcados("listo-eventos-ventanas")
        hasta = self.ancla_eventos(marcas)
        archivo = "eventos.ndjson"
        total = sum(1 for _ in self.st.leer_ndjson(archivo)) if marcas else 0
        if not marcas:
            self.st.borrar(archivo)
        vacias_seguidas = 0
        vent = list(ventanas(desde, hasta))
        if self.args.max_eventos_ventanas:
            vent = vent[: self.args.max_eventos_ventanas]
        elif self.corte is None and ahora() - (hasta - DIA) >= COLA_EVENTOS_SEGUNDOS:
            # Reanudación horas después: una ventana de cola desde la hora de la primera corrida hasta ahora.
            # Se solapa un poco con la ventana más reciente; los repetidos se quitan al leer (eventos_unicos).
            vent.insert(0, (hasta - DIA, ahora() + DIA))
            self.log(f"eventos: ventana de cola desde {utc(hasta - DIA)} (ancla de la primera corrida)")
        self.log(f"eventos: {len(vent)} ventanas de {VENTANA_EVENTOS_DIAS} días desde {utc(desde)}")
        for a, b in vent:
            n_ventana = 0
            for tipo in TIPOS_EVENTOS_CHAT:
                marca = f"{tipo}:{a}:{b}"
                if marca in marcas:
                    continue
                params = {"filter[type]": tipo, "filter[created_at][from]": a, "filter[created_at][to]": b}
                n_tipo = 0
                for _pagina, elementos in self.api.paginar("/api/v4/events", params, "events", LIMITE_EVENTOS):
                    n_tipo += self.st.anexar_ndjson(archivo, elementos)
                self.st.marcar("listo-eventos-ventanas", marca)
                n_ventana += n_tipo
                total += n_tipo
            self.log(f"eventos: ventana {utc(a)[:10]}..{utc(b)[:10]}: {n_ventana} (acumulado {total})")
            vacias_seguidas = vacias_seguidas + 1 if n_ventana == 0 else 0
            if self.args.corte_ventanas_vacias and vacias_seguidas >= self.args.corte_ventanas_vacias:
                self.log(f"eventos: {vacias_seguidas} ventanas vacías seguidas; corto aquí")
                break
        self.log(f"eventos: {total} en total")

    # ---- conversaciones y mensajes
    def talks(self):
        indice = ids_de_eventos(self.st.leer_ndjson("eventos.ndjson"))
        extra = self.st.marcados("talks-extra")  # huecos que resultaron existir
        ids = sorted(set(indice) | {int(x) for x in extra})
        if self.args.max_talks:
            ids = ids[-self.args.max_talks:]
        self.st.escribir_json("talks-indice.json", {str(k): v for k, v in indice.items()})
        listos = self.st.marcados("listo-talks")
        pendientes = [i for i in ids if str(i) not in listos]
        self.log(f"conversaciones: {len(ids)} en los eventos, {len(pendientes)} pendientes")
        inicio = time.monotonic()
        hechas = 0
        for tid in pendientes:
            codigo, talk = self.api.get(f"/api/v4/talks/{tid}", tolerar_403=True)
            self.st.anexar_ndjson("talks.ndjson", [{"_http": codigo, "_talk_id": tid, "talk": talk}])
            n_msj = 0
            if codigo == 200:
                antes_403 = self.api.codigos["403"]
                for _pagina, mensajes in self.api.paginar(f"/api/v4/talks/{tid}/messages", None, "messages",
                                                          LIMITE_MENSAJES, tolerar_403=True):
                    dentro = [m for m in mensajes if self.en_corte(m.get("created_at"))]
                    for m in dentro:
                        m["_talk_id"] = tid
                    if len(dentro) < len(mensajes):
                        self.st.marcar("mensajes-despues-del-corte", f"{tid}:{len(mensajes) - len(dentro)}")
                    n_msj += self.st.anexar_ndjson("mensajes.ndjson", dentro)
                if self.api.codigos["403"] > antes_403:
                    self.st.marcar("mensajes-sin-acceso", f"{tid}")
            elif codigo == 403:
                self.st.marcar("talks-sin-acceso", f"{tid}")
            self.st.marcar("listo-talks", f"{tid}")
            hechas += 1
            if hechas % 50 == 0 or hechas == len(pendientes):
                ritmo = (time.monotonic() - inicio) / hechas
                faltan = len(pendientes) - hechas
                self.log(f"conversaciones: {hechas}/{len(pendientes)} ({ritmo:.2f} s c/u; faltan ~{faltan * ritmo / 60:.0f} min)")
        self.log("conversaciones: listas")

    def sondear_huecos(self):
        """Prueba ids de conversación que no aparecen en los eventos. Si existen, entran al respaldo."""
        n = self.args.sondear_huecos
        if not n:
            return
        indice = ids_de_eventos(self.st.leer_ndjson("eventos.ndjson"))
        if not indice:
            return
        vistos = set(indice)
        for marca in ("talks-extra", "huecos-no", "talks-sin-acceso"):
            vistos |= {int(x) for x in self.st.marcados(marca)}
        lo, hi = min(indice), max(indice)
        huecos = [i for i in range(lo, hi + 1) if i not in vistos]
        if not huecos and self.st.existe("huecos-sondeo.json"):
            self.log("huecos: ya sondeados en una corrida anterior (se conserva huecos-sondeo.json)")
            return
        muestra = huecos if n < 0 or n >= len(huecos) else random.Random(582).sample(huecos, n)
        self.log(f"huecos: ids {lo}..{hi}, {len(huecos)} sin eventos; sondeo {len(muestra)}")
        existen = sin_acceso = 0
        for tid in sorted(muestra):
            codigo, _ = self.api.get(f"/api/v4/talks/{tid}", tolerar_403=True)
            if codigo == 200:
                existen += 1
                self.st.marcar("talks-extra", str(tid))
            elif codigo == 403:
                sin_acceso += 1  # existe, pero el usuario de la integración no la ve
                self.st.marcar("talks-sin-acceso", str(tid))
            else:
                self.st.marcar("huecos-no", str(tid))
        self.st.escribir_json("huecos-sondeo.json", {"rango": [lo, hi], "huecos": len(huecos), "sondeados": len(muestra),
                                                     "existen": existen, "sin_acceso_403": sin_acceso, "fecha": utc(ahora())})
        self.log(f"huecos: {existen} de {len(muestra)} sondeados existen; {sin_acceso} sin acceso (403)")
        if existen:
            self.talks()

    # ---- adjuntos
    def adjuntos(self):
        if self.args.sin_adjuntos:
            self.log("adjuntos: omitidos por --sin-adjuntos")
            return
        destino = os.path.join(self.args.destino_corrida, "adjuntos")
        os.makedirs(destino, mode=0o700, exist_ok=True)
        if getattr(self.args, "adjuntos_para_carga", False):
            os.makedirs(self.st.ruta_de(CARPETA_ADJUNTOS_CARGA), mode=0o700, exist_ok=True)
        listos = self.st.marcados("listo-adjuntos")
        pendientes = []
        for m in self.st.leer_ndjson("mensajes.ndjson"):
            adj = m.get("attachment") or {}
            # En modo incremental, el adjunto de un mensaje anterior al inicio ya está en la base.
            if self.inc and (segundos(m.get("created_at")) or 0) < self.inc["desde"]:
                continue
            if adj.get("link") and str(m.get("id")) not in listos:
                pendientes.append((m.get("id"), m.get("_talk_id"), adj))
        self.log(f"adjuntos: {len(pendientes)} pendientes ({len(listos)} ya hechos)")
        tope = int(self.args.tope_adjunto_mb * 1024 * 1024)
        inicio = time.monotonic()
        for k, (mid, tid, adj) in enumerate(pendientes, 1):
            codigo, datos, tipo = self.api.descargar(adj["link"], tope)
            fila = {"message_id": mid, "talk_id": tid, "tipo": adj.get("type"), "ext": extension_segura(adj.get("file_name")),
                    "host": host_de(adj["link"]), "http": codigo, "bytes": len(datos), "content_type": tipo[:60],
                    "sha256": sha256_bytes(datos) if datos else None, "archivo": None}
            if codigo == 200 and datos:
                nombre = f"{mid}.{fila['ext']}.age"
                ruta = os.path.join(destino, nombre)
                cifrar_bytes(datos, self.args.recipients, ruta)
                fila["archivo"] = os.path.join("adjuntos", nombre)
                if getattr(self.args, "adjuntos_para_carga", False):
                    # 5.5b: además del .age del respaldo, una copia en claro en el staging (tmpfs, 0600) para el
                    # cargador, solo durante la ventana. empaquetar no la mete en el paquete y la borra con el staging.
                    carga = f"{CARPETA_ADJUNTOS_CARGA}/{mid}.{fila['ext']}"
                    with open(self.st.ruta_de(carga), "wb", opener=lambda p, f: os.open(p, f, 0o600)) as salida:
                        salida.write(datos)
                    fila["archivo_carga"] = carga
            self.st.anexar_ndjson("adjuntos.ndjson", [fila])
            self.st.marcar("listo-adjuntos", str(mid))
            if k % 100 == 0 or k == len(pendientes):
                ritmo = (time.monotonic() - inicio) / k
                self.log(f"adjuntos: {k}/{len(pendientes)} ({ritmo:.2f} s c/u)")
        self.log("adjuntos: listos")

    def correr(self):
        self.cuenta()
        self.entidad_lista("usuarios", "/api/v4/users", {"with": "role,group"}, "users")
        self.entidad_una("embudos", "/api/v4/leads/pipelines")
        for et in ("leads", "contacts", "companies"):
            self.entidad_lista(f"campos-{et}", f"/api/v4/{et}/custom_fields", None, "custom_fields")
        self.entidad_lista("contactos", "/api/v4/contacts", {"with": "leads,customers"}, "contacts")
        self.entidad_lista("leads", "/api/v4/leads", {"with": "contacts,loss_reason,source_id"}, "leads")
        self.entidad_lista("empresas", "/api/v4/companies", {"with": "leads,contacts"}, "companies")
        self.entidad_lista("no-clasificados", "/api/v4/leads/unsorted", None, "unsorted")
        for et in ("leads", "contacts", "companies"):
            self.entidad_lista(f"notas-{et}", f"/api/v4/{et}/notes", None, "notes")
        self.entidad_lista("tareas", "/api/v4/tasks", None, "tasks")
        self.eventos()
        self.talks()
        if not self.inc:  # el sondeo de huecos es del respaldo completo; la base ya lo hizo
            self.sondear_huecos()
        self.adjuntos()
        self.log(f"peticiones: {self.api.peticiones}; por código: {dict(self.api.codigos)}; "
                 f"{self.api.segundos:.0f} s de red")


# --------------------------------------------------------------------------- cifrado y paquete


# --------------------------------------------------------------------------- 5.4 · E.164 y vínculo con el ERP
#
# Trabaja sobre el staging en claro (tmpfs) de una extracción hasta el corte. Lo que sale con teléfonos o
# correos queda en el staging y se cifra con el paquete; el informe lleva solo conteos.

PREFIJOS_VE = ("2", "4")


def solo_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def e164(valor) -> tuple[str | None, str]:
    """(+E.164, motivo). Con `+` o `00`, el código de país viene dado. Sin él, solo se completan los patrones
    venezolanos (0 + 10, 58 + 10, o 10 que empiezan por 2 o 4). Lo demás queda sin E.164: no se inventa un país."""
    crudo = str(valor or "").strip()
    d = solo_digitos(crudo)
    if not d:
        return None, "vacio"
    if crudo.startswith("+") or d.startswith("00"):
        d = d[2:] if d.startswith("00") else d
        return (f"+{d}", "con_codigo") if 8 <= len(d) <= 15 else (None, "largo_invalido")
    if len(d) == 12 and d.startswith("58"):
        return f"+{d}", "venezuela_58"
    if len(d) == 11 and d.startswith("0") and d[1] in PREFIJOS_VE:
        return f"+58{d[1:]}", "venezuela_0"
    if len(d) == 10 and d[0] in PREFIJOS_VE:
        return f"+58{d}", "venezuela_10"
    return None, "sin_codigo_de_pais"


def ultimos10(valor) -> str | None:
    """La misma llave que `phone_last10` del ERP (migraciones 0363 y 0383): últimos 10 dígitos, o nada."""
    d = solo_digitos(valor)
    return d[-10:] if len(d) >= 10 else None


def correo_normal(valor) -> str | None:
    c = str(valor or "").strip().lower()
    return c if "@" in c and " " not in c and len(c) <= 254 else None


def valores_campo(contacto: dict, codigo: str) -> list[str]:
    salida = []
    for campo in contacto.get("custom_fields_values") or []:
        if (campo or {}).get("field_code") == codigo:
            salida.extend(str(v.get("value")) for v in campo.get("values") or [] if v.get("value"))
    return salida


def en_tmpfs(ruta: str) -> bool:
    """Los archivos con datos de personas viven solo en /dev/shm. En Windows (pruebas) no aplica."""
    if os.name != "posix":
        return True
    return os.path.realpath(ruta).startswith("/dev/shm/")


def cargar_foto_erp(ruta: str) -> dict:
    """Foto mínima del ERP: NDJSON con `client_id`, `phone_last10` (lista) y `correos` (lista). Sin nombres."""
    if not en_tmpfs(ruta):
        raise ErrorFatal("la foto del ERP tiene datos de personas: tiene que estar en /dev/shm")
    por_tel: dict[str, set] = collections.defaultdict(set)
    por_correo: dict[str, set] = collections.defaultdict(set)
    del_cliente: dict[str, dict] = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if not linea.strip():
                continue
            fila = json.loads(linea)
            cid = str(fila.get("client_id") or "")
            if not cid:
                continue
            tels = {k for k in (ultimos10(t) for t in fila.get("phone_last10") or []) if k}
            correos = {c for c in (correo_normal(x) for x in fila.get("correos") or []) if c}
            del_cliente[cid] = {"tels": tels, "correos": correos}
            for t in tels:
                por_tel[t].add(cid)
            for c in correos:
                por_correo[c].add(cid)
    return {"por_tel": por_tel, "por_correo": por_correo, "clientes": del_cliente}


class Grupos:
    """Unión de contactos de Kommo que son la misma persona. El id del grupo es el menor id de contacto."""

    def __init__(self):
        self.padre: dict[int, int] = {}

    def raiz(self, x: int) -> int:
        self.padre.setdefault(x, x)
        while self.padre[x] != x:
            self.padre[x] = self.padre[self.padre[x]]
            x = self.padre[x]
        return x

    def unir(self, a: int, b: int) -> None:
        ra, rb = self.raiz(a), self.raiz(b)
        if ra != rb:
            self.padre[max(ra, rb)] = min(ra, rb)


def vincular(contactos, foto: dict) -> tuple[list[dict], dict]:
    """Un renglón por contacto de Kommo: E.164, llave, cliente del ERP y grupo. Más el informe de conteos."""
    filas, grupos = [], Grupos()
    por_llave: dict[str, list[int]] = collections.defaultdict(list)
    por_cliente: dict[str, list[int]] = collections.defaultdict(list)
    motivos_e164 = collections.Counter()
    cuenta = collections.Counter()
    for c in contactos:
        try:
            kid = int(c.get("id"))
        except (TypeError, ValueError):
            continue
        grupos.raiz(kid)
        tels = valores_campo(c, "PHONE")
        normal = [e164(t) for t in tels]
        for _e, motivo in normal:
            motivos_e164[motivo] += 1
        e164s = sorted({e for e, _m in normal if e})
        llaves = sorted({k for k in (ultimos10(t) for t in tels) if k})
        correos = sorted({x for x in (correo_normal(v) for v in valores_campo(c, "EMAIL")) if x})
        for k in llaves:
            por_llave[k].append(kid)

        candidatos_tel = set().union(*(foto["por_tel"].get(k, set()) for k in llaves)) if llaves else set()
        cliente, motivo, otro_tel = None, "sin_vinculo", False
        if len(candidatos_tel) == 1:
            cliente, motivo = next(iter(candidatos_tel)), "telefono"
        elif len(candidatos_tel) > 1:
            motivo = "ambiguo_telefono"
        else:
            candidatos_correo = set().union(*(foto["por_correo"].get(x, set()) for x in correos)) if correos else set()
            if len(candidatos_correo) == 1:
                cliente, motivo = next(iter(candidatos_correo)), "correo"
                otro_tel = bool(llaves) and not (set(llaves) & foto["clientes"].get(cliente, {}).get("tels", set()))
            elif len(candidatos_correo) > 1:
                motivo = "ambiguo_correo"
        if cliente:
            por_cliente[cliente].append(kid)
        cuenta[motivo] += 1
        cuenta["con_telefono"] += bool(tels)
        cuenta["con_e164"] += bool(e164s)
        cuenta["otro_telefono"] += otro_tel
        filas.append({"kommo_contact_id": kid, "e164": e164s, "llaves": llaves, "correos": correos,
                      "client_id": cliente, "motivo": motivo, "otro_telefono": otro_tel})

    for ids in list(por_llave.values()) + list(por_cliente.values()):
        for x in ids[1:]:
            grupos.unir(ids[0], x)
    for fila in filas:
        fila["grupo"] = grupos.raiz(fila["kommo_contact_id"])

    grupos_de_cliente = collections.defaultdict(set)
    for fila in filas:
        if fila["client_id"]:
            grupos_de_cliente[fila["client_id"]].add(fila["grupo"])
    tamanio = collections.Counter(f["grupo"] for f in filas)
    informe = {
        "contactos": len(filas),
        "con_telefono": cuenta["con_telefono"],
        "con_e164": cuenta["con_e164"],
        "telefonos_por_motivo_e164": dict(sorted(motivos_e164.items())),
        "vinculados_por_telefono": cuenta["telefono"],
        "vinculados_por_correo": cuenta["correo"],
        "otro_telefono": cuenta["otro_telefono"],
        "ambiguos": cuenta["ambiguo_telefono"] + cuenta["ambiguo_correo"],
        "sin_vinculo": cuenta["sin_vinculo"],
        "clientes_vinculados": len(grupos_de_cliente),
        # E-1 del ensayo: tiene que dar 0.
        "clientes_en_varios_grupos": sum(1 for g in grupos_de_cliente.values() if len(g) > 1),
        # E-2: un ambiguo nunca queda vinculado.
        "ambiguos_vinculados": sum(1 for f in filas if f["motivo"].startswith("ambiguo") and f["client_id"]),
        "grupos": len(tamanio),
        "grupos_con_varios_contactos": sum(1 for n in tamanio.values() if n > 1),
    }
    return filas, informe


# --------------------------------------------------------------------------- 5.5 · archivo de carga reducido

AUTOR_BOT = "Bot Kommo"


def nombre_de_pila(nombre) -> str | None:
    partes = str(nombre or "").split()
    return partes[0] if partes else None


def preparar_carga(st: Staging) -> dict:
    """Arma `carga.ndjson` en el staging: personas por grupo, conversaciones y mensajes reducidos. Solo lo que
    el Archivo muestra: sin `avatar_url`, sin campos propios de Kommo, asesores por nombre de pila."""
    vinculos = {f["kommo_contact_id"]: f for f in st.leer_ndjson("vinculos.ndjson")}
    if not vinculos:
        raise ErrorFatal("falta vinculos.ndjson: corre `vincular` antes")
    contactos = {int(c["id"]): c for c in st.leer_ndjson("contactos.ndjson") if c.get("id") is not None}
    adjuntos = {}
    for a in st.leer_ndjson("adjuntos.ndjson"):
        if not a.get("archivo"):
            continue
        if a.get("archivo_carga"):
            # 5.5b: el cargador sube este archivo. Sin la ruta en claro, el adjunto queda como pendiente (la ruta del .age).
            adjuntos[str(a.get("message_id"))] = {k: a.get(k) for k in ("archivo", "archivo_carga", "tipo", "ext",
                                                                         "content_type", "bytes", "sha256")}
        else:
            adjuntos[str(a.get("message_id"))] = a.get("archivo")
    cuenta = collections.Counter()
    salida = st.ruta_de("carga.ndjson")
    personas: dict[int, dict] = {}
    for kid, v in vinculos.items():
        g = v["grupo"]
        p = personas.setdefault(g, {"tipo": "persona", "grupo": g, "kommo_contact_ids": [], "nombre": None,
                                    "telefono": None, "correo": None, "client_id": None})
        p["kommo_contact_ids"].append(kid)
        if kid == g:
            p["nombre"] = (contactos.get(kid) or {}).get("name")
        p["telefono"] = p["telefono"] or (v["e164"][0] if v["e164"] else None)
        p["correo"] = p["correo"] or (v["correos"][0] if v["correos"] else None)
        p["client_id"] = p["client_id"] or v["client_id"]
    with open(salida, "w", encoding="utf-8") as f:
        for p in personas.values():
            p["kommo_contact_ids"].sort()
            f.write(json.dumps(p, ensure_ascii=False, separators=(",", ":")) + "\n")
            cuenta["personas"] += 1
        talks_validos = set()
        for t in st.leer_ndjson("talks.ndjson"):
            if t.get("_http") != 200 or not t.get("talk"):
                continue
            talk = t["talk"]
            tid = int(t["_talk_id"])
            contacto = talk.get("contact_id")
            grupo = (vinculos.get(int(contacto)) or {}).get("grupo") if contacto is not None else None
            if grupo is None:
                cuenta["conversaciones_sin_contacto"] += 1
            talks_validos.add(tid)
            f.write(json.dumps({"tipo": "conversacion", "kommo_talk_id": tid, "grupo": grupo,
                                "origen": talk.get("origin"), "creada": segundos(talk.get("created_at")),
                                "actualizada": segundos(talk.get("updated_at"))},
                               ensure_ascii=False, separators=(",", ":")) + "\n")
            cuenta["conversaciones"] += 1
        vistos = set()
        for m in st.leer_ndjson("mensajes.ndjson"):
            mid = str(m.get("id"))
            if m.get("_talk_id") not in talks_validos or mid in vistos:
                continue
            vistos.add(mid)
            autor = m.get("author") or {}
            entrante = m.get("type") == "incoming"
            if entrante:
                quien = "cliente"
            elif autor.get("type") == "bot":
                quien = AUTOR_BOT
                cuenta["mensajes_de_bot"] += 1
            else:
                quien = nombre_de_pila(autor.get("name")) or "Asesor"
            fila = {"tipo": "mensaje", "source_id": f"kommo:{mid}", "kommo_talk_id": m["_talk_id"],
                    "entrante": entrante, "autor": quien, "texto": m.get("text"), "creado": segundos(m.get("created_at")),
                    "adjunto": adjuntos.get(mid)}
            f.write(json.dumps(fila, ensure_ascii=False, separators=(",", ":")) + "\n")
            cuenta["mensajes"] += 1
            cuenta["entrantes" if entrante else "salientes"] += 1
            cuenta["con_adjunto"] += bool(fila["adjunto"])
            if isinstance(fila["adjunto"], dict):
                cuenta["con_adjunto_para_carga"] += 1
                cuenta["bytes_adjuntos_para_carga"] += int(fila["adjunto"].get("bytes") or 0)
                # El adjunto más grande: con él se estima el pico de memoria del cargador (SDD-0590 §10.15).
                cuenta["bytes_adjunto_max"] = max(cuenta["bytes_adjunto_max"], int(fila["adjunto"].get("bytes") or 0))
            cuenta["sin_texto"] += not m.get("text")
    informe = dict(sorted(cuenta.items()))
    st.escribir_json("carga-informe.json", informe)
    return informe


def cifrar_bytes(datos: bytes, recipients: str, salida: str) -> None:
    proc = subprocess.run(["age", "-R", recipients, "-o", salida], input=datos, capture_output=True, check=False)
    if proc.returncode != 0:
        raise ErrorFatal(f"age falló al cifrar {os.path.basename(salida)}: {proc.stderr.decode(errors='ignore')[:200]}")
    os.chmod(salida, 0o600)


def comando_tar(ruta_staging: str) -> list[str]:
    """El tar del paquete de metadatos. Las copias en claro para el cargador (5.5b) no van: los adjuntos ya van
    cifrados uno por uno, y el paquete no tiene que llevar 2 GB en claro adentro."""
    return ["tar", "-C", ruta_staging, f"--exclude=./{CARPETA_ADJUNTOS_CARGA}", "-cf", "-", "."]


def empaquetar(st: Staging, destino_corrida: str, recipients: str, log: Log, conservar: bool,
               efimera: str | None = None) -> dict:
    """tar | zstd | age del staging. Si `efimera` es una clave pública, también se cifra para ella (solo ensayos)."""
    stamp = os.path.basename(destino_corrida).replace("kommo-", "")
    os.makedirs(destino_corrida, mode=0o700, exist_ok=True)
    salida = os.path.join(destino_corrida, f"kommo-{stamp}-metadatos.tar.zst.age")
    cmd_age = ["age", "-R", recipients] + (["-r", efimera] if efimera else []) + ["-o", salida]
    tar = subprocess.Popen(comando_tar(st.ruta), stdout=subprocess.PIPE)
    zst = subprocess.Popen(["zstd", "-T2", "-10", "-q"], stdin=tar.stdout, stdout=subprocess.PIPE)
    tar.stdout.close()
    age = subprocess.Popen(cmd_age, stdin=zst.stdout, stderr=subprocess.PIPE)
    zst.stdout.close()
    _, err = age.communicate()
    zst.wait()
    tar.wait()
    if tar.returncode or zst.returncode or age.returncode:
        raise ErrorFatal(f"empaquetar falló: tar={tar.returncode} zstd={zst.returncode} age={age.returncode} "
                         f"{err.decode(errors='ignore')[:200]}")
    os.chmod(salida, 0o600)
    huella = sha256_archivo(salida)
    with open(salida + ".sha256", "w", encoding="utf-8") as f:
        f.write(f"{huella}  {os.path.basename(salida)}\n")
    log(f"paquete: {os.path.basename(salida)} ({os.path.getsize(salida)} bytes, sha256 {huella[:12]}…)")
    manifiesto = construir_manifiesto(st, destino_corrida, stamp, recipients)
    with open(os.path.join(destino_corrida, "manifiesto.json"), "w", encoding="utf-8") as f:
        json.dump(manifiesto, f, ensure_ascii=False, indent=1)
    if not conservar:
        shutil.rmtree(st.ruta)
        log(f"staging borrado: {st.ruta}")
    return manifiesto


def construir_manifiesto(st: Staging, destino_corrida: str, stamp: str, recipients: str) -> dict:
    """Lista de los `.age` de la corrida con tamaño y huella, destinatarios y, si fue incremental, de qué
    base parte. Va aparte de `empaquetar` para probarlo sin age, tar ni zstd."""
    manifiesto = {"version": VERSION, "stamp": stamp, "fecha": utc(ahora()), "archivos": []}
    for raiz, _dirs, archivos in os.walk(destino_corrida):
        for a in sorted(archivos):
            if a.endswith(".age"):
                ruta = os.path.join(raiz, a)
                manifiesto["archivos"].append({"archivo": os.path.relpath(ruta, destino_corrida).replace(os.sep, "/"),
                                               "bytes": os.path.getsize(ruta), "sha256": sha256_archivo(ruta)})
    manifiesto["adjuntos_cifrados"] = sum(1 for a in manifiesto["archivos"] if a["archivo"].startswith("adjuntos"))
    manifiesto["bytes_cifrados"] = sum(a["bytes"] for a in manifiesto["archivos"])
    manifiesto["destinatarios"] = etiquetas_recipients(recipients)
    bloque = bloque_incremental(st)
    if bloque:
        manifiesto["incremental"] = bloque
    elif st.existe("corte.json"):
        # Completa hasta el corte: el siguiente incremental parte de aquí.
        manifiesto["corte"] = st.leer_json("corte.json").get("corte")
    return manifiesto


def bloque_incremental(st: Staging) -> dict | None:
    """Lo que el manifiesto dice de una corrida incremental: base, desde y corte. Solo fechas, stamps y huellas;
    nada de datos. La carga (5.5) aplica los paquetes en orden de corte y quita repetidos por id."""
    if not st.existe("incremental.json"):
        return None
    plan = st.leer_json("incremental.json")
    return {"base_stamp": plan.get("base_stamp"), "base_sha256_paquete": plan.get("base_sha256_paquete"),
            "desde": plan.get("desde"), "desde_utc": utc(plan.get("desde")), "corte": plan.get("corte"),
            "corte_utc": utc(plan.get("corte")), "solape_segundos": plan.get("solape_segundos")}


def etiquetas_recipients(ruta: str) -> dict:
    etiquetas, claves = [], 0
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if linea.startswith("#"):
                etiquetas.append(linea.lstrip("# ").split("·")[0].strip())
            elif linea.startswith(("age1", "ssh-")):
                claves += 1
    return {"etiquetas": etiquetas, "claves_publicas": claves}


# --------------------------------------------------------------------------- informe (solo conteos)


def percentil(valores: list[int], p: float) -> int:
    if not valores:
        return 0
    v = sorted(valores)
    k = min(len(v) - 1, max(0, int(round((len(v) - 1) * p))))
    return v[k]


def contar_mensajes(mensajes, ahora_ts: int) -> dict:
    por_anio: collections.Counter = collections.Counter()
    por_tipo: collections.Counter = collections.Counter()
    por_message_type: collections.Counter = collections.Counter()
    por_autor: collections.Counter = collections.Counter()
    por_origen: collections.Counter = collections.Counter()
    por_entrega: collections.Counter = collections.Counter()
    adj_por_tipo: collections.Counter = collections.Counter()
    adj_por_ext: collections.Counter = collections.Counter()
    campos: collections.Counter = collections.Counter()
    por_talk: collections.Counter = collections.Counter()
    ultimo_por_talk: dict = {}
    primero_por_talk: dict = {}
    chat_por_talk: dict = {}
    largo_total, largo_max, con_texto, n = 0, 0, 0, 0
    por_anio_dir: dict = collections.defaultdict(collections.Counter)
    for m in mensajes:
        n += 1
        ts = segundos(m.get("created_at"))
        a = anio(ts)
        por_anio[a] += 1
        por_tipo[str(m.get("type"))] += 1
        por_anio_dir[a][str(m.get("type"))] += 1
        por_message_type[str(m.get("message_type"))] += 1
        por_autor[str((m.get("author") or {}).get("type"))] += 1
        por_origen[str(m.get("origin"))] += 1
        por_entrega[str(m.get("delivery_status"))] += 1
        for k in m:
            if not k.startswith("_"):
                campos[k] += 1
        texto = m.get("text")
        if isinstance(texto, str) and texto:
            con_texto += 1
            largo_total += len(texto)
            largo_max = max(largo_max, len(texto))
        adj = m.get("attachment") or {}
        if adj.get("link") or adj.get("file_name"):
            adj_por_tipo[str(adj.get("type"))] += 1
            adj_por_ext[extension_segura(adj.get("file_name"))] += 1
        tid = m.get("_talk_id")
        if tid is not None:
            por_talk[tid] += 1
            if ts:
                ultimo_por_talk[tid] = max(ultimo_por_talk.get(tid, 0), ts)
                primero_por_talk[tid] = min(primero_por_talk.get(tid, ts), ts)
            if m.get("chat_id"):
                chat_por_talk[tid] = m.get("chat_id")
    activos_12m = sum(1 for t, u in ultimo_por_talk.items() if u >= ahora_ts - 365 * DIA)
    activos_24m = sum(1 for t, u in ultimo_por_talk.items() if u >= ahora_ts - 730 * DIA)
    msj_12m = sum(c for t, c in por_talk.items() if ultimo_por_talk.get(t, 0) >= ahora_ts - 365 * DIA)
    por_talk_lista = list(por_talk.values())
    return {
        "total": n,
        "con_texto": con_texto,
        "caracteres_texto_total": largo_total,
        "caracteres_texto_promedio": round(largo_total / con_texto, 1) if con_texto else 0,
        "caracteres_texto_max": largo_max,
        "por_anio": dict(sorted(por_anio.items())),
        "por_anio_y_direccion": {a: dict(c) for a, c in sorted(por_anio_dir.items())},
        "por_type": dict(por_tipo.most_common()),
        "por_message_type": dict(por_message_type.most_common()),
        "por_autor_type": dict(por_autor.most_common()),
        "por_origen": dict(por_origen.most_common()),
        "por_delivery_status": dict(por_entrega.most_common()),
        "campos_presentes": dict(sorted(campos.items())),
        "adjuntos_en_mensajes": sum(adj_por_tipo.values()),
        "adjuntos_por_tipo": dict(adj_por_tipo.most_common()),
        "adjuntos_por_extension": dict(adj_por_ext.most_common()),
        "conversaciones_con_mensajes": len(por_talk),
        "mensajes_por_conversacion": {"p50": percentil(por_talk_lista, 0.5), "p90": percentil(por_talk_lista, 0.9),
                                      "p99": percentil(por_talk_lista, 0.99), "max": max(por_talk_lista, default=0),
                                      "promedio": round(statistics.mean(por_talk_lista), 1) if por_talk_lista else 0},
        "conversaciones_con_actividad_12m": activos_12m,
        "conversaciones_con_actividad_24m": activos_24m,
        "mensajes_en_conversaciones_activas_12m": msj_12m,
        "primer_mensaje": utc(min(primero_por_talk.values(), default=None)),
        "ultimo_mensaje": utc(max(ultimo_por_talk.values(), default=None)),
        "_ultimo_por_talk": ultimo_por_talk,
        "_chat_por_talk": chat_por_talk,
    }


def contar_talks(talks, indice: dict, ultimo_por_talk: dict, ahora_ts: int) -> dict:
    por_http: collections.Counter = collections.Counter()
    por_origen: collections.Counter = collections.Counter()
    por_estado: collections.Counter = collections.Counter()
    por_anio: collections.Counter = collections.Counter()
    por_entidad: collections.Counter = collections.Counter()
    campos: collections.Counter = collections.Counter()
    contactos: set = set()
    contactos_12m: set = set()
    pares: set = set()
    n = 0
    for fila in talks:
        n += 1
        por_http[str(fila.get("_http"))] += 1
        t = fila.get("talk") or {}
        tid = fila.get("_talk_id")
        if not t:
            continue
        por_origen[str(t.get("origin"))] += 1
        por_estado[str(t.get("status"))] += 1
        por_anio[anio(t.get("created_at"))] += 1
        por_entidad[str(t.get("entity_type"))] += 1
        for k in t:
            campos[k] += 1
        cid = t.get("contact_id")
        if cid:
            contactos.add(cid)
            pares.add((cid, t.get("origin")))
            if (ultimo_por_talk.get(tid) or segundos(t.get("updated_at")) or 0) >= ahora_ts - 365 * DIA:
                contactos_12m.add(cid)
    origen_eventos: collections.Counter = collections.Counter(v.get("origen") for v in indice.values())
    return {
        "total_consultadas": n,
        "por_http": dict(por_http),
        "por_origen": dict(por_origen.most_common()),
        "por_origen_segun_eventos": dict(origen_eventos.most_common()),
        "por_status": dict(por_estado.most_common()),
        "por_anio_creacion": dict(sorted(por_anio.items())),
        "por_entity_type": dict(por_entidad.most_common()),
        "campos_presentes": dict(sorted(campos.items())),
        "contactos_unicos": len(contactos),
        "contactos_unicos_con_actividad_12m": len(contactos_12m),
        "pares_contacto_canal": len(pares),
        "en_eventos": len(indice),
    }


def contar_contactos(contactos) -> dict:
    por_anio: collections.Counter = collections.Counter()
    con_tel, con_correo, n = 0, 0, 0
    campos: collections.Counter = collections.Counter()
    for c in contactos:
        n += 1
        por_anio[anio(c.get("created_at"))] += 1
        codigos = {(cf or {}).get("field_code") for cf in (c.get("custom_fields_values") or [])}
        con_tel += "PHONE" in codigos
        con_correo += "EMAIL" in codigos
        for k in c:
            campos[k] += 1
    return {"total": n, "por_anio_creacion": dict(sorted(por_anio.items())), "con_telefono": con_tel,
            "con_correo": con_correo, "campos_presentes": dict(sorted(campos.items()))}


def contar_simple(elementos, con_anio: bool = True, clave_tipo: str | None = None) -> dict:
    por_anio: collections.Counter = collections.Counter()
    por_tipo: collections.Counter = collections.Counter()
    n = 0
    for e in elementos:
        n += 1
        if con_anio:
            por_anio[anio(e.get("created_at"))] += 1
        if clave_tipo:
            por_tipo[str(e.get(clave_tipo))] += 1
    salida = {"total": n}
    if con_anio:
        salida["por_anio"] = dict(sorted(por_anio.items()))
    if clave_tipo:
        salida[f"por_{clave_tipo}"] = dict(por_tipo.most_common())
    return salida


def contar_adjuntos(filas) -> dict:
    por_http: collections.Counter = collections.Counter()
    por_tipo: collections.Counter = collections.Counter()
    por_ext: collections.Counter = collections.Counter()
    por_host: collections.Counter = collections.Counter()
    total_bytes, n, ok, mayor = 0, 0, 0, 0
    tam: list[int] = []
    for f in filas:
        n += 1
        por_http[str(f.get("http"))] += 1
        por_tipo[str(f.get("tipo"))] += 1
        por_ext[str(f.get("ext"))] += 1
        por_host[str(f.get("host"))] += 1
        if f.get("archivo"):
            ok += 1
            b = int(f.get("bytes") or 0)
            total_bytes += b
            mayor = max(mayor, b)
            tam.append(b)
    return {"total": n, "descargados": ok, "fallidos": n - ok, "por_http": dict(por_http), "por_tipo": dict(por_tipo.most_common()),
            "por_extension": dict(por_ext.most_common()), "por_host": dict(por_host.most_common()), "bytes_total": total_bytes,
            "bytes_promedio": round(total_bytes / ok) if ok else 0, "bytes_mayor": mayor,
            "bytes_p50": percentil(tam, 0.5), "bytes_p90": percentil(tam, 0.9)}


def contar_eventos(eventos) -> dict:
    por_tipo: collections.Counter = collections.Counter()
    por_anio: collections.Counter = collections.Counter()
    primero, ultimo, n = None, None, 0
    for ev in eventos_unicos(eventos):
        n += 1
        por_tipo[str(ev.get("type"))] += 1
        ts = ev.get("created_at")
        por_anio[anio(ts)] += 1
        if ts:
            primero = ts if primero is None else min(primero, ts)
            ultimo = ts if ultimo is None else max(ultimo, ts)
    return {"total": n, "por_tipo": dict(por_tipo), "por_anio": dict(sorted(por_anio.items())),
            "mas_antiguo": utc(primero), "mas_reciente": utc(ultimo)}


def estimar_chatwoot(msj: dict, talks: dict, contactos: dict, adj: dict) -> dict:
    """Estimación (I) del tamaño en la base de Chatwoot y del tiempo de carga de 5.5."""
    n_m, n_c, n_k, n_a = msj["total"], talks["total_consultadas"], talks["contactos_unicos"], adj["descargados"]
    bytes_mensajes = n_m * (450 + msj["caracteres_texto_promedio"])
    bytes_conversaciones = n_c * 700
    bytes_contactos = n_k * 1500
    bytes_adjuntos_filas = n_a * 1000
    tablas = bytes_mensajes + bytes_conversaciones + bytes_contactos + bytes_adjuntos_filas
    return {
        "metodo": "filas × tamaño típico de las tablas messages (450 B + texto), conversations (700 B), "
                  "contacts + contact_inboxes (1,5 KB) y attachments + active_storage (1 KB); índices y TOAST ×1,6. "
                  "Es una estimación, no una medición (I)",
        "filas": {"messages": n_m, "conversations": n_c, "contacts": n_k, "attachments": n_a},
        "db_bytes_estimados": int(tablas * 1.6),
        "db_mb_estimados": round(tablas * 1.6 / 1024 / 1024, 1),
        "adjuntos_bytes": adj["bytes_total"],
        "adjuntos_gb": round(adj["bytes_total"] / 1024 / 1024 / 1024, 2),
        "carga_por_api_horas": {"a_5_por_s": round((n_m + n_c + n_k) / 5 / 3600, 1), "a_20_por_s": round((n_m + n_c + n_k) / 20 / 3600, 1),
                                "nota": "peticiones a la API de Chatwoot en el mismo VPS; 5/s es conservador, 20/s con lotes"},
        "carga_por_sql_minutos": {"estimado": round(n_m / 5000 + n_a / 200, 1),
                                  "nota": "si 5.5 carga por SQL/rails runner en lotes de 5.000 mensajes y 200 adjuntos por minuto"},
    }


def filtro_updated_at(st: Staging) -> dict | None:
    """En una corrida incremental: por lista, cuántos elementos llegaron y cuántos cambiaron fuera de la ventana.
    Si `fuera` > 0, Kommo ignoró `filter[updated_at]` en esa lista (SDD-0590 §9.2): bajó entera."""
    if not st.existe("incremental.json"):
        return None
    plan = st.leer_json("incremental.json")
    desde, corte = plan.get("desde"), plan.get("corte")
    listas = {}
    for nombre in LISTAS_INCREMENTALES:
        total = fuera = 0
        for e in st.leer_ndjson(f"{nombre}.ndjson"):
            total += 1
            ts = segundos(e.get("updated_at") or e.get("created_at"))
            if ts is None or ts < desde or ts > corte:
                fuera += 1
        listas[nombre] = {"total": total, "fuera_de_la_ventana": fuera}
    return {"desde": utc(desde), "corte": utc(corte), "filtro_updated_at": listas}


def informe(st: Staging, log: Log, ahora_ts: int | None = None) -> dict:
    ahora_ts = ahora_ts or ahora()
    indice = {int(k): v for k, v in (st.leer_json("talks-indice.json") if st.existe("talks-indice.json") else {}).items()}
    msj = contar_mensajes(st.leer_ndjson("mensajes.ndjson"), ahora_ts)
    ultimo_por_talk = msj.pop("_ultimo_por_talk")
    msj.pop("_chat_por_talk")
    talks = contar_talks(st.leer_ndjson("talks.ndjson"), indice, ultimo_por_talk, ahora_ts)
    talks["sin_acceso_403"] = len(st.marcados("talks-sin-acceso"))
    talks["mensajes_sin_acceso_403"] = len(st.marcados("mensajes-sin-acceso"))
    contactos = contar_contactos(st.leer_ndjson("contactos.ndjson"))
    adj = contar_adjuntos(st.leer_ndjson("adjuntos.ndjson"))
    notas = {}
    for et in ("leads", "contacts", "companies"):
        notas[et] = contar_simple(st.leer_ndjson(f"notas-{et}.ndjson"), clave_tipo="note_type")
    cuenta = (st.leer_json("cuenta.json") if st.existe("cuenta.json") else {}).get("datos") or {}
    huecos = st.leer_json("huecos-sondeo.json") if st.existe("huecos-sondeo.json") else None
    salida = {
        "version": VERSION,
        "fecha": utc(ahora_ts),
        "incremental": filtro_updated_at(st),
        "cuenta": {"subdominio": cuenta.get("subdomain"), "creada": utc(cuenta.get("created_at")),
                   "campos_presentes": sorted(k for k in cuenta if k != "_embedded")},
        "eventos_chat": contar_eventos(st.leer_ndjson("eventos.ndjson")),
        "conversaciones": talks,
        "huecos_sondeo": huecos,
        "mensajes": msj,
        "contactos": contactos,
        "leads": contar_simple(st.leer_ndjson("leads.ndjson")),
        "empresas": contar_simple(st.leer_ndjson("empresas.ndjson")),
        "no_clasificados": contar_simple(st.leer_ndjson("no-clasificados.ndjson")),
        "notas": notas,
        "tareas": contar_simple(st.leer_ndjson("tareas.ndjson")),
        "usuarios": contar_simple(st.leer_ndjson("usuarios.ndjson"), con_anio=False),
        "adjuntos": adj,
    }
    salida["estimacion_chatwoot"] = estimar_chatwoot(msj, talks, contactos, adj)
    st.escribir_json("informe.json", salida)
    with open(st.ruta_de("informe.md"), "w", encoding="utf-8") as f:
        f.write(informe_md(salida))
    log("informe: escrito (informe.json, informe.md)")
    return salida


def _tabla(d: dict, titulo: str, col: str = "Valor") -> str:
    filas = "\n".join(f"| {k} | {v} |" for k, v in d.items())
    return f"| {titulo} | {col} |\n|---|---|\n{filas}\n"


def informe_md(r: dict) -> str:
    m, t, c, a, e = r["mensajes"], r["conversaciones"], r["contactos"], r["adjuntos"], r["estimacion_chatwoot"]
    partes = [f"# Informe de volumen del historial de Kommo — {r['fecha']}\n",
              "Generado por `respaldar-historial.py informe`. Solo conteos, años, valores de enumeración y nombres de campo. "
              "No contiene texto de mensajes, nombres, teléfonos ni enlaces.\n",
              "## Resumen\n",
              _tabla({"Conversaciones (talks) consultadas": t["total_consultadas"],
                      "Conversaciones vistas en los eventos": t["en_eventos"],
                      "Conversaciones sin acceso (HTTP 403)": t["sin_acceso_403"],
                      "Conversaciones con mensajes sin acceso (HTTP 403)": t["mensajes_sin_acceso_403"],
                      "Conversaciones con mensajes": m["conversaciones_con_mensajes"],
                      "Conversaciones con actividad en los últimos 12 meses": m["conversaciones_con_actividad_12m"],
                      "Conversaciones con actividad en los últimos 24 meses": m["conversaciones_con_actividad_24m"],
                      "Mensajes": m["total"],
                      "Mensajes en conversaciones activas (12 meses)": m["mensajes_en_conversaciones_activas_12m"],
                      "Contactos únicos en las conversaciones": t["contactos_unicos"],
                      "Contactos únicos con actividad (12 meses)": t["contactos_unicos_con_actividad_12m"],
                      "Pares contacto–canal (conversaciones si se juntan por contacto)": t["pares_contacto_canal"],
                      "Contactos en Kommo": c["total"],
                      "Adjuntos en mensajes": m["adjuntos_en_mensajes"],
                      "Adjuntos descargados": a["descargados"],
                      "Adjuntos fallidos": a["fallidos"],
                      "Tamaño de adjuntos (bytes)": a["bytes_total"],
                      "Primer mensaje": m["primer_mensaje"],
                      "Último mensaje": m["ultimo_mensaje"]}, "Medida"),
              "\n## Conversaciones\n", _tabla(t["por_anio_creacion"], "Año de creación", "Conversaciones"),
              "\n", _tabla(t["por_origen"], "Canal (origin)", "Conversaciones"),
              "\n", _tabla(t["por_status"], "Estado", "Conversaciones"),
              "\n", _tabla(t["por_http"], "HTTP de talks/{id}", "Conversaciones"),
              "\n## Mensajes\n", _tabla(m["por_anio"], "Año", "Mensajes"),
              "\n", _tabla({a_: json.dumps(v, ensure_ascii=False) for a_, v in m["por_anio_y_direccion"].items()}, "Año", "Por dirección"),
              "\n", _tabla(m["por_type"], "type", "Mensajes"),
              "\n", _tabla(m["por_message_type"], "message_type", "Mensajes"),
              "\n", _tabla(m["por_autor_type"], "author.type", "Mensajes"),
              "\n", _tabla(m["por_origen"], "origin", "Mensajes"),
              "\n", _tabla(m["mensajes_por_conversacion"], "Mensajes por conversación", "Valor"),
              "\n", _tabla({"Con texto": m["con_texto"], "Caracteres en total": m["caracteres_texto_total"],
                            "Caracteres promedio": m["caracteres_texto_promedio"], "Caracteres máximo": m["caracteres_texto_max"]},
                           "Texto", "Valor"),
              "\n## Contactos\n", _tabla(c["por_anio_creacion"], "Año de creación", "Contactos"),
              "\n", _tabla({"Con teléfono": c["con_telefono"], "Con correo": c["con_correo"]}, "Dato", "Contactos"),
              "\n## Adjuntos\n", _tabla(a["por_tipo"], "Tipo", "Adjuntos"),
              "\n", _tabla(a["por_extension"], "Extensión", "Adjuntos"),
              "\n", _tabla(a["por_http"], "HTTP de descarga", "Adjuntos"),
              "\n", _tabla({"Promedio (bytes)": a["bytes_promedio"], "p50 (bytes)": a["bytes_p50"], "p90 (bytes)": a["bytes_p90"],
                            "Mayor (bytes)": a["bytes_mayor"]}, "Tamaño", "Valor"),
              "\n## Otras entidades\n", _tabla({"Leads": r["leads"]["total"], "Empresas": r["empresas"]["total"],
                                                 "No clasificados": r["no_clasificados"]["total"], "Tareas": r["tareas"]["total"],
                                                 "Usuarios": r["usuarios"]["total"],
                                                 "Notas de leads": r["notas"]["leads"]["total"],
                                                 "Notas de contactos": r["notas"]["contacts"]["total"],
                                                 "Notas de empresas": r["notas"]["companies"]["total"]}, "Entidad", "Total"),
              "\n## Eventos de chat (enumeración)\n", _tabla(r["eventos_chat"]["por_tipo"], "Tipo", "Eventos"),
              "\n", _tabla({"Más antiguo": r["eventos_chat"]["mas_antiguo"], "Más reciente": r["eventos_chat"]["mas_reciente"]}, "Fecha", "Valor"),
              ]
    if r.get("huecos_sondeo"):
        partes += ["\n", _tabla(r["huecos_sondeo"], "Sondeo de huecos", "Valor")]
    partes += ["\n## Estimación para Chatwoot (I)\n",
               _tabla({"Filas": json.dumps(e["filas"]), "Base de datos (MB estimados)": e["db_mb_estimados"],
                       "Adjuntos (GB)": e["adjuntos_gb"], "Carga por API a 5/s (h)": e["carga_por_api_horas"]["a_5_por_s"],
                       "Carga por API a 20/s (h)": e["carga_por_api_horas"]["a_20_por_s"],
                       "Carga por SQL (min)": e["carga_por_sql_minutos"]["estimado"]}, "Medida", "Valor"),
               f"\n{e['metodo']}\n",
               "\n## Campos presentes (nombres, no valores)\n",
               f"- Conversación: {', '.join(sorted(t['campos_presentes']))}\n",
               f"- Mensaje: {', '.join(sorted(m['campos_presentes']))}\n",
               f"- Contacto: {', '.join(sorted(c['campos_presentes']))}\n"]
    return "".join(partes)


# --------------------------------------------------------------------------- subcomandos


def cmd_probar_token(args, log: Log) -> int:
    token = cargar_token(args.token_file)
    claims = claims_jwt(token)
    print(f"largo: {len(token)} | JWT: {'sí' if claims else 'no'}")
    if claims:
        exp = claims.get("exp")
        dias = round((exp - ahora()) / DIA, 1) if exp else None
        print(f"alcances: {','.join(claims.get('scopes') or [])} | vence en: {dias} días | "
              f"{describir_emisor(claims, args.subdominio)} | account_id: {claims.get('account_id')}")
    api = Kommo(args.subdominio, token, log, pausa=0.0)
    try:
        codigo, datos = api.get("/api/v4/account")
    except ErrorFatal as e:
        print(f"GET /api/v4/account: {e}")
        return 2
    sub = (datos or {}).get("subdomain")
    print(f"GET /api/v4/account: HTTP {codigo} | subdominio coincide: {'sí' if sub == args.subdominio else 'no'} | "
          f"campos: {', '.join(sorted(k for k in (datos or {}) if k != '_embedded'))}")
    return 0 if codigo == 200 and sub == args.subdominio else 2


def preparar_corrida(args, st: Staging) -> str:
    """Fija el stamp de la corrida en el staging para que las reanudaciones usen la misma carpeta."""
    if st.existe("stamp.txt"):
        stamp = open(st.ruta_de("stamp.txt"), encoding="utf-8").read().strip()
    else:
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        with open(st.ruta_de("stamp.txt"), "w", encoding="utf-8") as f:
            f.write(stamp)
    carpeta = os.path.join(args.destino, f"kommo-{stamp}")
    os.makedirs(carpeta, mode=0o700, exist_ok=True)
    os.chmod(carpeta, 0o700)
    args.destino_corrida = carpeta
    return carpeta


def validar_adjuntos_para_carga(args) -> None:
    """5.5b: las copias en claro solo con un corte fijo, con adjuntos, y con el staging en tmpfs. Antes de pedirle
    nada a Kommo."""
    if not getattr(args, "adjuntos_para_carga", False):
        return
    if getattr(args, "sin_adjuntos", False):
        raise ErrorFatal("--adjuntos-para-carga y --sin-adjuntos se excluyen")
    if not getattr(args, "corte", None):
        raise ErrorFatal("--adjuntos-para-carga pide --corte: la carga es de una extracción hasta un corte fijo")
    if not en_tmpfs(args.staging):
        raise ErrorFatal("--adjuntos-para-carga deja adjuntos en claro: el staging tiene que estar en /dev/shm")


def cmd_extraer(args, log: Log) -> int:
    validar_adjuntos_para_carga(args)
    token = cargar_token(args.token_file)
    if not os.path.exists(args.recipients):
        raise ErrorFatal(f"no existe {args.recipients}")
    st = Staging(args.staging)
    carpeta = preparar_corrida(args, st)
    log(f"extraer: staging {st.ruta}, destino {carpeta}, subdominio {args.subdominio}")
    api = Kommo(args.subdominio, token, log, pausa=args.pausa)
    Extractor(api, st, log, args).correr()
    return 0


def cmd_informe(args, log: Log) -> int:
    st = Staging(args.staging)
    r = informe(st, log)
    if args.destino:
        carpeta = preparar_corrida(args, st)
        for n in ("informe.json", "informe.md"):
            shutil.copyfile(st.ruta_de(n), os.path.join(carpeta, n))
            os.chmod(os.path.join(carpeta, n), 0o600)
        log(f"informe: copiado a {carpeta}")
    print(json.dumps({k: r[k] for k in ("conversaciones", "mensajes", "contactos", "adjuntos") if k in r},
                     ensure_ascii=False)[:1500])
    return 0


def cmd_empaquetar(args, log: Log) -> int:
    st = Staging(args.staging)
    carpeta = preparar_corrida(args, st)
    efimera = None
    clave_efimera = None
    if args.verificar_efimera:
        clave_efimera = os.path.join("/dev/shm", f"kommo-e5-efimera-{os.getpid()}.txt")
        subprocess.run(["age-keygen", "-o", clave_efimera], check=True, capture_output=True)
        os.chmod(clave_efimera, 0o600)
        efimera = subprocess.run(["age-keygen", "-y", clave_efimera], check=True, capture_output=True, text=True).stdout.strip()
        log("empaquetar: ENSAYO con llave efímera (el paquete también se cifra para ella)")
    try:
        manifiesto = empaquetar(st, carpeta, args.recipients, log, conservar=args.conservar_staging or bool(efimera), efimera=efimera)
        if clave_efimera:
            paquete = [a for a in manifiesto["archivos"] if a["archivo"].endswith("metadatos.tar.zst.age")][0]["archivo"]
            dec = subprocess.Popen(["age", "-d", "-i", clave_efimera, os.path.join(carpeta, paquete)], stdout=subprocess.PIPE)
            lst = subprocess.run(["tar", "--zstd", "-tf", "-"], stdin=dec.stdout, capture_output=True, text=True, check=False)
            dec.wait()
            entradas = [l for l in lst.stdout.splitlines() if l.strip()]
            log(f"empaquetar: round-trip con la llave efímera: age={dec.returncode} tar={lst.returncode} entradas={len(entradas)}")
            if dec.returncode or lst.returncode or not entradas:
                raise ErrorFatal("el round-trip de verificación falló")
    finally:
        if clave_efimera and os.path.exists(clave_efimera):
            os.remove(clave_efimera)
    log(f"empaquetar: {len(manifiesto['archivos'])} archivos cifrados, {manifiesto['bytes_cifrados']} bytes; destinatarios "
        f"{manifiesto['destinatarios']['etiquetas']} ({manifiesto['destinatarios']['claves_publicas']} claves)")
    return 0


def cmd_vincular(args, log: Log) -> int:
    st = Staging(args.staging)
    if not st.existe("contactos.ndjson"):
        raise ErrorFatal("el staging no tiene contactos.ndjson: extrae hasta el corte con --conservar-staging")
    foto = cargar_foto_erp(args.clientes)
    if not args.conservar_clientes:
        # La foto trae teléfonos y correos de clientes del ERP: se borra apenas se lee. No va al paquete de Kommo.
        os.remove(args.clientes)
        log("vincular: foto del ERP borrada tras leerla")
    filas, informe = vincular(st.leer_ndjson("contactos.ndjson"), foto)
    st.borrar("vinculos.ndjson")
    st.anexar_ndjson("vinculos.ndjson", filas)
    st.escribir_json("vinculo-informe.json", informe)
    log(f"vincular: {informe['contactos']} contactos, {informe['vinculados_por_telefono']} por teléfono, "
        f"{informe['vinculados_por_correo']} por correo, {informe['ambiguos']} ambiguos, {informe['grupos']} grupos")
    print(json.dumps(informe, ensure_ascii=False))
    return 0


def cmd_preparar_carga(args, log: Log) -> int:
    st = Staging(args.staging)
    informe = preparar_carga(st)
    log(f"preparar-carga: {json.dumps(informe, ensure_ascii=False)}")
    print(json.dumps(informe, ensure_ascii=False))
    return 0


def flujo_adjuntos(st: Staging, salida) -> dict:
    """5.5b: una línea NDJSON por adjunto en claro de los mensajes del archivo de carga, con su contenido en base64,
    para el cargador (`MODO=adjuntos`, por la entrada estándar del contenedor). Antes de escribir cada línea comprueba
    bytes y sha256 contra adjuntos.ndjson. Devuelve conteos."""
    cuenta = collections.Counter()
    for m in st.leer_ndjson("carga.ndjson"):
        adj = m.get("adjunto") if m.get("tipo") == "mensaje" else None
        if not isinstance(adj, dict) or not adj.get("archivo_carga"):
            continue
        ruta = st.ruta_de(adj["archivo_carga"])
        if not os.path.isfile(ruta):
            cuenta["faltan"] += 1
            continue
        with open(ruta, "rb") as f:
            datos = f.read()
        if len(datos) != int(adj.get("bytes") or -1) or sha256_bytes(datos) != adj.get("sha256"):
            cuenta["no_coinciden"] += 1
            continue
        salida.write(json.dumps({"source_id": m["source_id"], "tipo": adj.get("tipo"), "ext": adj.get("ext"),
                                 "content_type": adj.get("content_type"), "bytes": len(datos),
                                 "sha256": adj.get("sha256"), "b64": base64.b64encode(datos).decode("ascii")},
                                separators=(",", ":")) + "\n")
        cuenta["adjuntos"] += 1
        cuenta["bytes"] += len(datos)
    return dict(sorted(cuenta.items()))


def cmd_flujo_adjuntos(args, log: Log) -> int:
    st = Staging(args.staging)
    informe = flujo_adjuntos(st, sys.stdout)
    sys.stdout.flush()
    # La salida estándar es el flujo de datos: el informe va a la de error y al log, nunca entre las líneas.
    texto = f"flujo-adjuntos: {json.dumps(informe, ensure_ascii=False)}"
    print(texto, file=sys.stderr, flush=True)
    if log.archivo:
        log.archivo.write(f"{utc(ahora())} {texto}\n")
        log.archivo.flush()
    return 0 if not informe.get("faltan") and not informe.get("no_coinciden") else 2


def cmd_todo(args, log: Log) -> int:
    cmd_extraer(args, log)
    cmd_informe(args, log)
    return cmd_empaquetar(args, log)


def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    def comunes(sp, token=True, staging=True, destino=True):
        if token:
            sp.add_argument("--token-file", required=True, help="archivo 0600 con el token (p. ej. /dev/shm/k0582-e5)")
            sp.add_argument("--subdominio", default=SUBDOMINIO_POR_DEFECTO)
        if staging:
            sp.add_argument("--staging", required=True, help="carpeta en tmpfs, p. ej. /dev/shm/kommo-e5")
        if destino:
            sp.add_argument("--destino", default="/srv/backups/kommo", help="carpeta base de los respaldos cifrados")
            sp.add_argument("--recipients", default="/srv/ops/backup/age-recipients.txt")
        sp.add_argument("--log", default=None, help="archivo de log (solo conteos e ids)")

    sp = sub.add_parser("probar-token"); comunes(sp, staging=False, destino=False)
    for nombre in ("extraer", "todo"):
        sp = sub.add_parser(nombre); comunes(sp)
        sp.add_argument("--pausa", type=float, default=0.25, help="segundos entre peticiones")
        sp.add_argument("--desde", default=None, help="YYYY-MM-DD; por defecto, la creación de la cuenta")
        sp.add_argument("--max-talks", type=int, default=0, help="ensayo: solo las N conversaciones más recientes")
        sp.add_argument("--max-eventos-ventanas", type=int, default=0, help="ensayo: solo las N ventanas más recientes")
        sp.add_argument("--corte-ventanas-vacias", type=int, default=0, help="parar tras N ventanas vacías seguidas (0 = nunca)")
        sp.add_argument("--sondear-huecos", type=int, default=0, help="probar N ids sin eventos (-1 = todos)")
        sp.add_argument("--sin-adjuntos", action="store_true")
        sp.add_argument("--adjuntos-para-carga", action="store_true",
                        help="5.5b: además del .age, deja cada adjunto en claro en <staging>/adjuntos-carga (tmpfs, 0600) "
                             "para el cargador del Archivo Kommo; pide --corte y el staging en /dev/shm")
        sp.add_argument("--tope-adjunto-mb", type=float, default=200.0)
        sp.add_argument("--conservar-staging", action="store_true")
        sp.add_argument("--verificar-efimera", action="store_true", help="ensayo: round-trip con llave efímera")
        sp.add_argument("--base", default=None, help="incremental: carpeta de un respaldo anterior (con manifiesto.json)")
        sp.add_argument("--corte", default=None, help="incremental: instante de corte UTC, ya pasado (AAAA-MM-DDTHH:MM:SSZ)")
        sp.add_argument("--solape-horas", type=int, default=SOLAPE_HORAS_POR_DEFECTO,
                        help="incremental: horas antes del corte anterior desde donde se vuelve a mirar")
    sp = sub.add_parser("informe"); comunes(sp, token=False)
    sp = sub.add_parser("vincular"); comunes(sp, token=False, destino=False)
    sp.add_argument("--clientes", required=True, help="foto mínima del ERP en /dev/shm: client_id, phone_last10, correos")
    sp.add_argument("--conservar-clientes", action="store_true", help="no borrar la foto del ERP después de leerla")
    sp = sub.add_parser("preparar-carga"); comunes(sp, token=False, destino=False)
    sp = sub.add_parser("flujo-adjuntos"); comunes(sp, token=False, destino=False)
    sp = sub.add_parser("empaquetar"); comunes(sp, token=False)
    sp.add_argument("--conservar-staging", action="store_true")
    sp.add_argument("--verificar-efimera", action="store_true")
    return p


def main(argv=None) -> int:
    args = construir_parser().parse_args(argv)
    os.umask(0o077)  # todo lo que se cree (staging, .age, informes) nace sin permisos para otros
    log = Log(args.log)
    try:
        return {"probar-token": cmd_probar_token, "extraer": cmd_extraer, "informe": cmd_informe,
                "vincular": cmd_vincular, "preparar-carga": cmd_preparar_carga, "flujo-adjuntos": cmd_flujo_adjuntos,
                "empaquetar": cmd_empaquetar, "todo": cmd_todo}[args.cmd](args, log)
    except ErrorFatal as e:
        log(f"ERROR: {e}")
        return 2
    finally:
        log.cerrar()


if __name__ == "__main__":
    sys.exit(main())
