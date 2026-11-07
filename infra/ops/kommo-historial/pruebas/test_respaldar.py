"""Pruebas de respaldar-historial.py con un servidor falso en memoria. Sin red, sin token real.

    python3 -m unittest infra/ops/kommo-historial/pruebas/test_respaldar.py -v

Los datos de prueba llevan marcas (texto, nombre y teléfono inventados) para comprobar que ni el
informe ni el log las dejan pasar.
"""
from __future__ import annotations

import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import types
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
from email.message import Message

AQUI = os.path.dirname(os.path.abspath(__file__))
RUTA = os.path.join(os.path.dirname(AQUI), "respaldar-historial.py")
spec = importlib.util.spec_from_file_location("respaldar", RUTA)
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)

DIA = 86400
AHORA = int(time.time())
TEXTO_SECRETO = "TEXTO-SECRETO-XK93"
NOMBRE_SECRETO = "Nombre Inventado Zq"
TELEFONO_SECRETO = "+584129998877"
TOKEN_FALSO = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9." + "x" * 120 + ".firma"


def respuesta(codigo, cuerpo=None, tipo="application/json"):
    datos = b"" if cuerpo is None else json.dumps(cuerpo).encode("utf-8") if not isinstance(cuerpo, bytes) else cuerpo

    class Resp:
        status = codigo

        def __init__(self):
            self.headers = Message()
            self.headers["Content-Type"] = tipo

        def read(self):
            return datos

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    if codigo >= 400:
        h = Message()
        h["Content-Type"] = tipo
        return urllib.error.HTTPError("http://x", codigo, "err", h, io.BytesIO(datos))
    return Resp()


def mensaje(mid, talk, ts, tipo="incoming", texto=TEXTO_SECRETO, adjunto=None):
    m = {"id": mid, "chat_id": f"chat-{talk}", "type": tipo, "message_type": "text" if not adjunto else "picture",
         "text": texto, "created_at": ts, "delivery_status": "read", "origin": "waba",
         "author": {"id": "a1", "type": "external" if tipo == "incoming" else "internal", "name": NOMBRE_SECRETO},
         "recipient": {"id": "r1", "type": "internal", "name": "Asesor"}}
    if adjunto:
        m["attachment"] = adjunto
    return m


class ServidorFalso:
    """Enruta por path y página. Registra las peticiones y simula un 429 una sola vez."""

    def __init__(self):
        self.peticiones = []
        self.dio_429 = False
        self.prohibir = set()  # rutas que responden 403 «Not enough rights»
        t0 = AHORA - 500 * DIA
        self.cuenta = {"id": 31589859, "subdomain": "dtdcargo", "created_at": t0, "name": NOMBRE_SECRETO}
        self.eventos_in = [self._evento(1, 10, "waba", AHORA - 5 * DIA), self._evento(2, 10, "waba", AHORA - 4 * DIA),
                           self._evento(3, 11, "instagram_business", AHORA - 400 * DIA), self._evento(4, 12, "waba", AHORA - 3 * DIA),
                           self._evento(5, 15, "waba", AHORA - 2 * DIA),
                           self._evento(7, 16, "waba", AHORA - 2 * DIA), self._evento(8, 17, "waba", AHORA - DIA)]
        self.eventos_out = [self._evento(6, 10, "waba", AHORA - 4 * DIA, "outgoing_chat_message")]
        self.talks = {
            10: {"talk_id": 10, "contact_id": 500, "origin": "waba", "status": "closed", "created_at": AHORA - 20 * DIA,
                 "updated_at": AHORA - 4 * DIA, "entity_type": "lead", "entity_id": 7},
            11: {"talk_id": 11, "contact_id": 501, "origin": "instagram_business", "status": "closed",
                 "created_at": AHORA - 400 * DIA, "updated_at": AHORA - 400 * DIA, "entity_type": "lead", "entity_id": 8},
            13: {"talk_id": 13, "contact_id": 500, "origin": "waba", "status": "opened", "created_at": AHORA - DIA,
                 "updated_at": AHORA - DIA, "entity_type": "lead", "entity_id": 7},
            15: {"talk_id": 15, "contact_id": 502, "origin": "waba", "status": "closed", "created_at": AHORA - 2 * DIA,
                 "updated_at": AHORA - 2 * DIA, "entity_type": "lead", "entity_id": 9},
            # 16 existe pero la integración no la ve (403 en el talk); 17 se ve, pero sus mensajes dan 403
            16: {"talk_id": 16, "contact_id": 503, "origin": "waba", "status": "closed", "created_at": AHORA - 2 * DIA,
                 "updated_at": AHORA - 2 * DIA, "entity_type": "lead", "entity_id": 10},
            17: {"talk_id": 17, "contact_id": 504, "origin": "waba", "status": "closed", "created_at": AHORA - DIA,
                 "updated_at": AHORA - DIA, "entity_type": "lead", "entity_id": 11},
        }
        self.mensajes = {
            10: [mensaje("m1", 10, AHORA - 5 * DIA), mensaje("m2", 10, AHORA - 4 * DIA, "outgoing"),
                 mensaje("m3", 10, (AHORA - 4 * DIA) * 1000, adjunto={"type": "picture", "file_name": "foto.JPG",
                                                                      "link": "https://drive-x.kommo.com/f/1?sig=zzz"})],
            11: [mensaje("m4", 11, AHORA - 400 * DIA)],
            13: [mensaje("m5", 13, AHORA - DIA)],
            15: [],
            17: [mensaje("m6", 17, AHORA - DIA)],  # nunca llega: la ruta de mensajes de 17 da 403
        }
        self.contactos = [{"id": 500, "name": NOMBRE_SECRETO, "created_at": AHORA - 30 * DIA,
                           "custom_fields_values": [{"field_code": "PHONE", "values": [{"value": TELEFONO_SECRETO}]}]},
                          {"id": 501, "name": "Otro", "created_at": AHORA - 500 * DIA, "custom_fields_values": None}]

    @staticmethod
    def _evento(eid, talk, origen, ts, tipo="incoming_chat_message"):
        return {"id": f"e{eid}", "type": tipo, "entity_id": 7, "entity_type": "lead", "created_at": ts,
                "value_after": [{"message": {"id": f"msg-{eid}", "talk_id": talk, "origin": origen}}]}

    def __call__(self, req, timeout=None):
        url = req.full_url
        self.peticiones.append(url)
        u = urllib.parse.urlsplit(url)
        q = urllib.parse.parse_qs(u.query)
        pagina = int(q.get("page", ["1"])[0])
        p = u.path
        if u.hostname == "drive-x.kommo.com":
            return respuesta(200, b"JPEGDATA-" + TEXTO_SECRETO.encode(), "image/jpeg")
        if "Authorization" not in req.headers and "Authorization" not in {k.title(): v for k, v in req.header_items()}:
            return respuesta(401, {"title": "Unauthorized"})
        if p in self.prohibir or p in ("/api/v4/talks/16", "/api/v4/talks/16/messages", "/api/v4/talks/17/messages"):
            return respuesta(403, {"title": "Forbidden", "status": 403, "detail": "Not enough rights"})
        if p == "/api/v4/account":
            return respuesta(200, self.cuenta)
        if p == "/api/v4/users":
            return respuesta(200, {"_embedded": {"users": [{"id": 1, "name": "Ana"}]}}) if pagina == 1 else respuesta(204)
        if p == "/api/v4/leads/pipelines":
            return respuesta(200, {"_embedded": {"pipelines": [{"id": 1, "name": "Ventas"}]}})
        if p.endswith("/custom_fields") or p in ("/api/v4/leads", "/api/v4/companies", "/api/v4/leads/unsorted", "/api/v4/tasks",
                                               "/api/v4/contacts/notes", "/api/v4/companies/notes"):
            return respuesta(204)
        if p == "/api/v4/leads/notes":
            return respuesta(200, {"_embedded": {"notes": [{"id": 1, "note_type": "common", "created_at": AHORA - DIA,
                                                              "params": {"text": TEXTO_SECRETO}}]}}) if pagina == 1 else respuesta(204)
        if p == "/api/v4/contacts":
            lote = self.contactos
            if "filter[updated_at][from]" in q:
                a, b = int(q["filter[updated_at][from]"][0]), int(q["filter[updated_at][to]"][0])
                lote = [c for c in lote if a <= c.get("updated_at", c["created_at"]) <= b]
            return respuesta(200, {"_embedded": {"contacts": lote}}) if lote and pagina == 1 else respuesta(204)
        if p == "/api/v4/events":
            tipo = q["filter[type]"][0]
            a, b = int(q["filter[created_at][from]"][0]), int(q["filter[created_at][to]"][0])
            fuente = self.eventos_in if tipo == "incoming_chat_message" else self.eventos_out
            lote = [e for e in fuente if a <= e["created_at"] <= b]
            return respuesta(200, {"_embedded": {"events": lote}}) if lote and pagina == 1 else respuesta(204)
        if p.startswith("/api/v4/talks/"):
            partes = p.split("/")
            tid = int(partes[4])
            if tid == 11 and not self.dio_429:
                self.dio_429 = True
                return respuesta(429, {"title": "Too Many Requests"})
            if len(partes) == 5:
                return respuesta(200, self.talks[tid]) if tid in self.talks else respuesta(404)
            msjs = self.mensajes.get(tid, [])
            return respuesta(200, {"_embedded": {"messages": msjs}}) if msjs and pagina == 1 else respuesta(204)
        return respuesta(404)


class Args:
    def __init__(self, **kw):
        self.desde = None
        self.max_talks = 0
        self.max_eventos_ventanas = 0
        self.corte_ventanas_vacias = 0
        self.sondear_huecos = -1
        self.sin_adjuntos = False
        self.tope_adjunto_mb = 1.0
        self.__dict__.update(kw)


class PruebasUtilidades(unittest.TestCase):
    def test_limpiar_pegado_quita_marcas_y_ansi(self):
        sucio = "\x1b[200~" + TOKEN_FALSO + "\x1b[201~\r\n \x1b[B"
        self.assertEqual(R.limpiar_pegado(sucio), TOKEN_FALSO)

    def test_claims_jwt(self):
        self.assertIsNone(R.claims_jwt("abc"))
        cuerpo = json.dumps({"scopes": ["crm"], "exp": 1}).encode()
        import base64
        tok = "eyJhbGciOiJSUzI1NiJ9." + base64.urlsafe_b64encode(cuerpo).decode().rstrip("=") + ".f"
        self.assertEqual(R.claims_jwt(tok)["scopes"], ["crm"])

    def test_extension_segura(self):
        self.assertEqual(R.extension_segura("foto.JPG"), "jpg")
        self.assertEqual(R.extension_segura("sin-extension"), "bin")
        self.assertEqual(R.extension_segura("raro.p#h$p"), "php")
        self.assertEqual(R.extension_segura(None), "bin")

    def test_segundos_normaliza_milisegundos(self):
        self.assertEqual(R.segundos(1_700_000_000_000), 1_700_000_000)
        self.assertEqual(R.segundos(1_700_000_000), 1_700_000_000)
        self.assertIsNone(R.segundos(None))
        self.assertIsNone(R.segundos("x"))

    def test_ventanas_cubren_el_rango_sin_solapar(self):
        v = list(R.ventanas(0, 100 * DIA, dias=30))
        self.assertEqual(v[0][1], 100 * DIA)
        self.assertEqual(v[-1][0], 0)
        for (a1, b1), (a2, b2) in zip(v, v[1:]):
            self.assertEqual(b2, a1 - 1)
        self.assertEqual(len(v), 4)

    def test_ids_de_eventos(self):
        s = ServidorFalso()
        idx = R.ids_de_eventos(s.eventos_in + s.eventos_out)
        self.assertEqual(sorted(idx), [10, 11, 12, 15, 16, 17])
        self.assertEqual(idx[10]["n"], 3)
        self.assertEqual(idx[10]["origen"], "waba")
        self.assertEqual(idx[10]["primero"], AHORA - 5 * DIA)
        self.assertEqual(idx[10]["ultimo"], AHORA - 4 * DIA)

    def test_cargar_token_rechaza_corto_y_faltante(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, "t")
            with open(ruta, "w") as f:
                f.write("corto")
            os.chmod(ruta, 0o600)
            with self.assertRaises(R.ErrorFatal):
                R.cargar_token(ruta)
            with self.assertRaises(R.ErrorFatal):
                R.cargar_token(os.path.join(d, "no-existe"))

    @unittest.skipUnless(os.name == "posix", "permisos POSIX")
    def test_cargar_token_exige_0600(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = os.path.join(d, "t")
            with open(ruta, "w") as f:
                f.write(TOKEN_FALSO)
            os.chmod(ruta, 0o644)
            with self.assertRaises(R.ErrorFatal):
                R.cargar_token(ruta)
            os.chmod(ruta, 0o600)
            self.assertEqual(R.cargar_token(ruta), TOKEN_FALSO)


class PruebasCliente(unittest.TestCase):
    def setUp(self):
        self.servidor = ServidorFalso()
        self.salida = io.StringIO()
        self.log = R.Log(None)
        R.time.sleep = lambda s: None  # sin esperas reales en las pruebas
        self.api = R.Kommo("dtdcargo", TOKEN_FALSO, self.log, pausa=0.0, abrir=self.servidor)

    def test_paginar_para_en_204_cuando_la_pagina_viene_llena(self):
        paginas = list(self.api.paginar("/api/v4/contacts", {"with": "leads"}, "contacts", 2))
        self.assertEqual(len(paginas), 1)
        self.assertEqual(len(paginas[0][1]), 2)
        self.assertIn("limit=2", self.servidor.peticiones[0])
        self.assertIn("page=2", self.servidor.peticiones[1])
        self.assertEqual(len(self.servidor.peticiones), 2)

    def test_paginar_no_pide_la_siguiente_si_la_pagina_viene_corta(self):
        paginas = list(self.api.paginar("/api/v4/contacts", {"with": "leads"}, "contacts", 250))
        self.assertEqual(len(paginas), 1)
        self.assertEqual(len(paginas[0][1]), 2)
        self.assertEqual(len(self.servidor.peticiones), 1, self.servidor.peticiones)

    def test_desde_ignora_una_creacion_de_cuenta_reciente(self):
        with tempfile.TemporaryDirectory() as d:
            st = R.Staging(d)
            st.escribir_json("cuenta.json", {"_http": 200, "datos": {"created_at": AHORA - 3600}})
            ex = R.Extractor(self.api, st, self.log, Args(desde=None))
            self.assertEqual(R.utc(ex.desde())[:10], "2019-01-01")
            st.escribir_json("cuenta.json", {"_http": 200, "datos": {"created_at": AHORA - 400 * DIA}})
            self.assertEqual(ex.desde(), AHORA - 400 * DIA - DIA)
            ex = R.Extractor(self.api, st, self.log, Args(desde="2024-06-01"))
            self.assertEqual(R.utc(ex.desde())[:10], "2024-06-01")

    def test_reintenta_429_y_cuenta_codigos(self):
        codigo, talk = self.api.get("/api/v4/talks/11")
        self.assertEqual(codigo, 200)
        self.assertEqual(talk["talk_id"], 11)
        self.assertEqual(self.api.codigos["429"], 1)
        self.assertEqual(self.api.codigos["200"], 1)

    def test_404_devuelve_none(self):
        self.assertEqual(self.api.get("/api/v4/talks/999"), (404, None))

    def test_403_solo_se_tolera_donde_se_pide(self):
        self.assertEqual(self.api.get("/api/v4/talks/16", tolerar_403=True), (403, None))
        self.assertEqual(self.api.codigos["403"], 1)
        with self.assertRaises(R.ErrorFatal) as cm:
            self.api.get("/api/v4/talks/16")
        self.assertIn("sin derechos", str(cm.exception))
        paginas = list(self.api.paginar("/api/v4/talks/17/messages", None, "messages", 250, tolerar_403=True))
        self.assertEqual(paginas, [])
        with self.assertRaises(R.ErrorFatal):
            list(self.api.paginar("/api/v4/talks/17/messages", None, "messages", 250))

    def test_sin_token_es_fatal(self):
        api = R.Kommo("dtdcargo", "", self.log, pausa=0.0, abrir=self.servidor)
        api._peticion = lambda url, con_token: (401, b"{}", "application/json")
        with self.assertRaises(R.ErrorFatal):
            api.get("/api/v4/account")

    def test_lectura_incompleta_se_reintenta_y_no_tumba_la_corrida(self):
        import http.client
        intentos = []

        def abrir(req, timeout=None):
            intentos.append(req.full_url)
            if len(intentos) == 1:
                raise http.client.IncompleteRead(b"x" * 10, 5)  # la respuesta se corta a mitad del cuerpo
            return respuesta(200, b"datos-completos", "application/octet-stream")

        api = R.Kommo("dtdcargo", TOKEN_FALSO, self.log, pausa=0.0, abrir=abrir)
        codigo, datos, _tipo = api.descargar("https://drive-x.kommo.com/f/1", 10 ** 6)
        self.assertEqual((codigo, datos), (200, b"datos-completos"))
        self.assertEqual(len(intentos), 2)
        self.assertEqual(api.codigos["red"], 1)

        def siempre_cortado(req, timeout=None):
            raise http.client.RemoteDisconnected("se cerró la conexión")

        api = R.Kommo("dtdcargo", TOKEN_FALSO, self.log, pausa=0.0, abrir=siempre_cortado)
        self.assertEqual(api.descargar("https://drive-x.kommo.com/f/1", 10 ** 6)[0], 0)
        with self.assertRaises(R.ErrorFatal) as cm:
            api.get("/api/v4/talks/10", intentos=2)
        self.assertIn("red agotada", str(cm.exception))

    def test_descargar_manda_token_solo_a_kommo(self):
        vistos = []

        def abrir(req, timeout=None):
            vistos.append((req.full_url, "Authorization" in {k.title() for k, _ in req.header_items()}))
            return respuesta(200, b"datos", "application/octet-stream")

        api = R.Kommo("dtdcargo", TOKEN_FALSO, self.log, pausa=0.0, abrir=abrir)
        api.descargar("https://drive-x.kommo.com/f/1", 10 ** 6)
        api.descargar("https://otro-host.example/f/1", 10 ** 6)
        self.assertEqual([v[1] for v in vistos], [True, False])
        codigo, datos, tipo = api.descargar("https://drive-x.kommo.com/f/1", 2)
        self.assertEqual((datos, tipo), (b"", "demasiado-grande"))


class PruebasExtraccionCompleta(unittest.TestCase):
    """Extrae contra el servidor falso, genera el informe y comprueba conteos y ausencia de datos personales."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="kommo-e5-test-")
        self.staging = os.path.join(self.tmp, "staging")
        self.destino = os.path.join(self.tmp, "backups")
        self.logfile = os.path.join(self.tmp, "log.txt")
        self.servidor = ServidorFalso()
        R.time.sleep = lambda s: None
        self.cifrados = []

        def cifrar_falso(datos, recipients, salida):
            self.cifrados.append((len(datos), salida))
            with open(salida, "wb") as f:
                f.write(b"AGE-FALSO")

        self._cifrar = R.cifrar_bytes
        R.cifrar_bytes = cifrar_falso
        self.recipients = os.path.join(self.tmp, "recipients.txt")
        with open(self.recipients, "w", encoding="utf-8") as f:  # sin encoding, en Windows el «·» sale en cp1252
            f.write("# Sam-prueba · creada hoy\nage1" + "q" * 58 + "\n")

    def tearDown(self):
        R.cifrar_bytes = self._cifrar
        shutil.rmtree(self.tmp, ignore_errors=True)

    def extraer(self, **kw):
        log = R.Log(self.logfile)
        st = R.Staging(self.staging)
        args = Args(destino=self.destino, recipients=self.recipients, staging=self.staging, **kw)
        R.preparar_corrida(args, st)
        api = R.Kommo("dtdcargo", TOKEN_FALSO, log, pausa=0.0, abrir=self.servidor)
        try:
            R.Extractor(api, st, log, args).correr()
        finally:
            log.cerrar()
        return st, args, R.Log(None)

    def test_extraccion_informe_y_sin_datos_personales(self):
        st, args, log = self.extraer()
        talks = list(st.leer_ndjson("talks.ndjson"))
        self.assertEqual(sorted(t["_talk_id"] for t in talks), [10, 11, 12, 13, 15, 16, 17])
        self.assertEqual([t["_http"] for t in talks if t["_talk_id"] == 12], [404])
        self.assertEqual([(t["_http"], t["talk"]) for t in talks if t["_talk_id"] == 16], [(403, None)])
        self.assertEqual([t["_http"] for t in talks if t["_talk_id"] == 17], [200])
        self.assertEqual(st.marcados("talks-sin-acceso"), {"16"})
        self.assertEqual(st.marcados("mensajes-sin-acceso"), {"17"})
        mensajes = list(st.leer_ndjson("mensajes.ndjson"))
        self.assertEqual(len(mensajes), 5)
        self.assertTrue(all("_talk_id" in m for m in mensajes))
        adj = list(st.leer_ndjson("adjuntos.ndjson"))
        self.assertEqual(len(adj), 1)
        self.assertEqual(adj[0]["http"], 200)
        self.assertEqual(adj[0]["ext"], "jpg")
        self.assertTrue(adj[0]["archivo"].endswith("m3.jpg.age"))
        self.assertEqual(len(self.cifrados), 1)
        self.assertTrue(os.path.exists(os.path.join(args.destino_corrida, "adjuntos", "m3.jpg.age")))
        huecos = st.leer_json("huecos-sondeo.json")
        self.assertEqual(huecos["huecos"], 2)
        self.assertEqual(huecos["existen"], 1)

        r = R.informe(st, log, ahora_ts=AHORA)
        self.assertEqual(r["conversaciones"]["total_consultadas"], 7)
        self.assertEqual(r["conversaciones"]["por_http"], {"200": 5, "404": 1, "403": 1})
        self.assertEqual(r["conversaciones"]["sin_acceso_403"], 1)
        self.assertEqual(r["conversaciones"]["mensajes_sin_acceso_403"], 1)
        self.assertEqual(r["huecos_sondeo"]["sin_acceso_403"], 0)
        self.assertEqual(r["conversaciones"]["contactos_unicos"], 4)
        self.assertEqual(r["conversaciones"]["contactos_unicos_con_actividad_12m"], 3)
        self.assertEqual(r["conversaciones"]["pares_contacto_canal"], 4)
        self.assertEqual(r["mensajes"]["total"], 5)
        self.assertEqual(r["mensajes"]["por_type"], {"incoming": 4, "outgoing": 1})
        self.assertEqual(r["mensajes"]["conversaciones_con_actividad_12m"], 2)
        self.assertEqual(r["mensajes"]["mensajes_en_conversaciones_activas_12m"], 4)
        self.assertEqual(r["mensajes"]["adjuntos_en_mensajes"], 1)
        self.assertEqual(r["mensajes"]["por_anio"][str(R.anio(AHORA - 400 * DIA))] >= 1, True)
        self.assertEqual(r["contactos"]["total"], 2)
        self.assertEqual(r["contactos"]["con_telefono"], 1)
        self.assertEqual(r["notas"]["leads"]["total"], 1)
        self.assertEqual(r["adjuntos"]["descargados"], 1)
        self.assertGreater(r["estimacion_chatwoot"]["db_bytes_estimados"], 0)

        for nombre in ("informe.json", "informe.md"):
            with open(st.ruta_de(nombre), encoding="utf-8") as f:
                contenido = f.read()
            for marca in (TEXTO_SECRETO, NOMBRE_SECRETO, TELEFONO_SECRETO, "sig=zzz", TOKEN_FALSO):
                self.assertNotIn(marca, contenido, f"{marca} se filtró en {nombre}")
        with open(self.logfile, encoding="utf-8") as f:
            logtxt = f.read()
        for marca in (TEXTO_SECRETO, NOMBRE_SECRETO, TELEFONO_SECRETO, "sig=zzz", TOKEN_FALSO):
            self.assertNotIn(marca, logtxt, f"{marca} se filtró en el log")
        self.assertIn("HTTP 403 en /api/v4/talks/16: sin derechos sobre ese recurso", logtxt)
        self.assertIn("HTTP 403 en /api/v4/talks/17/messages: sin derechos sobre ese recurso", logtxt)
        self.assertIn("conversaciones: listas", logtxt)

    def test_reanudar_no_repite_lo_hecho(self):
        self.extraer()
        n1 = len(self.servidor.peticiones)
        self.extraer()
        n2 = len(self.servidor.peticiones) - n1
        self.assertLess(n2, 5, f"la segunda corrida hizo {n2} peticiones")
        st = R.Staging(self.staging)
        self.assertEqual(len(list(st.leer_ndjson("mensajes.ndjson"))), 5)
        huecos = st.leer_json("huecos-sondeo.json")  # la reanudación no pisa el sondeo real con 0/0
        self.assertEqual((huecos["huecos"], huecos["sondeados"], huecos["existen"]), (2, 2, 1))

    def test_reanudar_horas_despues_conserva_el_ancla_de_las_ventanas(self):
        st, _a, _l = self.extraer(sin_adjuntos=True, sondear_huecos=0)
        ventanas_1 = st.marcados("listo-eventos-ventanas")
        with open(st.ruta_de("eventos-hasta.txt"), encoding="utf-8") as f:
            ancla = int(f.read())
        self.assertEqual(ancla, max(int(k.split(":")[2]) for k in ventanas_1))
        os.remove(st.ruta_de("eventos-hasta.txt"))  # staging de la versión 1.0: sin ancla guardada
        n1 = len(self.servidor.peticiones)
        ahora_real = R.ahora
        R.ahora = lambda: AHORA + 3 * 3600
        try:
            st, _a, _l = self.extraer(sin_adjuntos=True, sondear_huecos=0)
        finally:
            R.ahora = ahora_real
        eventos_2 = [u for u in self.servidor.peticiones[n1:] if "/api/v4/events" in u]
        self.assertEqual(len(eventos_2), 2, eventos_2)  # solo la ventana de cola, una por tipo
        self.assertTrue(all(f"from%5D={ancla - DIA}" in u for u in eventos_2), eventos_2)
        with open(st.ruta_de("eventos-hasta.txt"), encoding="utf-8") as f:
            self.assertEqual(int(f.read()), ancla)
        self.assertEqual(len(st.marcados("listo-eventos-ventanas")), len(ventanas_1) + 2)
        filas = list(st.leer_ndjson("eventos.ndjson"))
        self.assertEqual(len(filas), 8)
        self.assertEqual(len(R.ids_de_eventos(filas)), 6)

    def test_eventos_unicos_quita_repetidos(self):
        s = ServidorFalso()
        e = s.eventos_in[0]
        idx = R.ids_de_eventos([e, dict(e), s.eventos_out[0]])
        self.assertEqual(idx[10]["n"], 2)
        self.assertEqual(R.contar_eventos([e, dict(e), {"type": "x", "created_at": AHORA}])["total"], 2)

    def test_ensayo_con_max_talks_y_sin_adjuntos(self):
        st, _args, _log = self.extraer(max_talks=2, sin_adjuntos=True, sondear_huecos=0)
        talks = list(st.leer_ndjson("talks.ndjson"))
        self.assertEqual(sorted(t["_talk_id"] for t in talks), [16, 17])
        self.assertFalse(st.existe("adjuntos.ndjson"))

    def test_403_en_una_lista_sigue_siendo_fatal(self):
        self.servidor.prohibir.add("/api/v4/contacts")
        with self.assertRaises(R.ErrorFatal) as cm:
            self.extraer()
        self.assertIn("HTTP 403 en /api/v4/contacts", str(cm.exception))
        self.assertNotIn("venció", str(cm.exception))

    @unittest.skipUnless(all(shutil.which(x) for x in ("age", "age-keygen", "tar", "zstd")), "hacen falta age, tar y zstd")
    def test_empaquetar_cifra_y_borra_el_staging(self):
        R.cifrar_bytes = self._cifrar
        st, args, log = self.extraer(sin_adjuntos=True, sondear_huecos=0)
        R.informe(st, log, ahora_ts=AHORA)
        import subprocess
        clave = os.path.join(self.tmp, "efimera.txt")
        subprocess.run(["age-keygen", "-o", clave], check=True, capture_output=True)
        publica = subprocess.run(["age-keygen", "-y", clave], check=True, capture_output=True, text=True).stdout.strip()
        with open(self.recipients, "w") as f:  # solo claves válidas: age rechaza el archivo entero si una no lo es
            f.write("# Efimera-prueba · creada hoy\n" + publica + "\n")
        manifiesto = R.empaquetar(st, args.destino_corrida, self.recipients, log, conservar=False)
        self.assertFalse(os.path.exists(self.staging))
        paquete = [a for a in manifiesto["archivos"] if a["archivo"].endswith("metadatos.tar.zst.age")]
        self.assertEqual(len(paquete), 1)
        ruta = os.path.join(args.destino_corrida, paquete[0]["archivo"])
        with open(ruta, "rb") as f:
            self.assertNotIn(TEXTO_SECRETO.encode(), f.read())
        dec = subprocess.run(["age", "-d", "-i", clave, ruta], check=True, capture_output=True)
        lista = subprocess.run(["tar", "--zstd", "-tf", "-"], input=dec.stdout, check=True, capture_output=True).stdout.decode()
        self.assertIn("./mensajes.ndjson", lista)
        self.assertIn("./informe.json", lista)
        self.assertEqual(manifiesto["destinatarios"]["claves_publicas"], 1)
        self.assertEqual(manifiesto["destinatarios"]["etiquetas"], ["Efimera-prueba"])


def stamp_de(ts: int) -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime(ts))


def iso_de(ts: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


class PruebasAdjuntosParaCarga(unittest.TestCase):
    """5.5b: la copia en claro de cada adjunto para el cargador, solo en tmpfs, fuera del paquete, y su flujo."""

    def setUp(self):
        self.base = PruebasExtraccionCompleta("test_extraccion_informe_y_sin_datos_personales")
        self.base.setUp()

    def tearDown(self):
        self.base.tearDown()

    def test_con_la_opcion_deja_copia_en_claro_0600_y_su_huella(self):
        st, args, _ = self.base.extraer(adjuntos_para_carga=True)
        adj = list(st.leer_ndjson("adjuntos.ndjson"))
        self.assertEqual(len(adj), 1)
        self.assertEqual(adj[0]["archivo_carga"], "adjuntos-carga/m3.jpg")
        ruta = st.ruta_de(adj[0]["archivo_carga"])
        with open(ruta, "rb") as f:
            datos = f.read()
        self.assertEqual(datos, b"JPEGDATA-" + TEXTO_SECRETO.encode())
        self.assertEqual(R.sha256_bytes(datos), adj[0]["sha256"])
        self.assertEqual(len(datos), adj[0]["bytes"])
        if os.name == "posix":
            self.assertEqual(os.stat(ruta).st_mode & 0o777, 0o600)
        self.assertEqual(len(self.base.cifrados), 1, "el .age del respaldo se sigue haciendo")

    def test_sin_la_opcion_no_hay_copia_en_claro(self):
        st, args, _ = self.base.extraer()
        self.assertFalse(os.path.exists(st.ruta_de("adjuntos-carga")))
        self.assertNotIn("archivo_carga", list(st.leer_ndjson("adjuntos.ndjson"))[0])

    def test_validar_pide_corte_tmpfs_y_que_no_sea_sin_adjuntos(self):
        original = R.en_tmpfs
        try:
            R.en_tmpfs = lambda ruta: True
            R.validar_adjuntos_para_carga(Args(adjuntos_para_carga=True, corte="2026-11-07T02:00:00Z", staging="/dev/shm/x"))
            R.validar_adjuntos_para_carga(Args(adjuntos_para_carga=False, sin_adjuntos=True, staging="/tmp/x"))
            for malo in (Args(adjuntos_para_carga=True, sin_adjuntos=True, corte="c", staging="s"),
                         Args(adjuntos_para_carga=True, corte=None, staging="s")):
                with self.assertRaises(R.ErrorFatal):
                    R.validar_adjuntos_para_carga(malo)
            R.en_tmpfs = lambda ruta: False
            with self.assertRaises(R.ErrorFatal):
                R.validar_adjuntos_para_carga(Args(adjuntos_para_carga=True, corte="c", staging="/tmp/x"))
        finally:
            R.en_tmpfs = original

    @unittest.skipUnless(shutil.which("tar"), "hace falta tar")
    def test_el_paquete_no_lleva_las_copias_en_claro(self):
        st = R.Staging(os.path.join(self.base.tmp, "staging-tar"))
        os.makedirs(st.ruta_de("adjuntos-carga"))
        with open(st.ruta_de("adjuntos-carga/m3.jpg"), "wb") as f:
            f.write(b"EN-CLARO")
        st.escribir_json("informe.json", {"n": 1})
        salida = os.path.join(self.base.tmp, "paquete.tar")
        with open(salida, "wb") as f:
            subprocess.run(R.comando_tar(st.ruta), stdout=f, check=True)
        lista = subprocess.run(["tar", "-tf", salida], capture_output=True, text=True, check=True).stdout
        self.assertIn("informe.json", lista)
        self.assertNotIn("adjuntos-carga", lista)

    def test_preparar_carga_y_flujo_llevan_el_adjunto_con_su_huella(self):
        st = R.Staging(os.path.join(self.base.tmp, "staging-carga"))
        PruebasVinculoYCarga.armar_staging(types.SimpleNamespace(st=st))
        datos = b"PDF-INVENTADO-" + TEXTO_SECRETO.encode()
        os.makedirs(st.ruta_de("adjuntos-carga"))
        with open(st.ruta_de("adjuntos-carga/f1.jpg"), "wb") as f:
            f.write(datos)
        st.borrar("adjuntos.ndjson")
        st.anexar_ndjson("adjuntos.ndjson", [{"message_id": "f1", "archivo": "adjuntos/f1.jpg.age", "http": 200,
                                              "archivo_carga": "adjuntos-carga/f1.jpg", "tipo": "picture", "ext": "jpg",
                                              "content_type": "image/jpeg", "bytes": len(datos),
                                              "sha256": R.sha256_bytes(datos)}])
        informe = R.preparar_carga(st)
        self.assertEqual(informe["con_adjunto_para_carga"], 1)
        self.assertEqual(informe["bytes_adjuntos_para_carga"], len(datos))
        self.assertEqual(informe["bytes_adjunto_max"], len(datos))
        adjunto = {m["source_id"]: m for m in st.leer_ndjson("carga.ndjson") if m["tipo"] == "mensaje"}["kommo:f1"]["adjunto"]
        self.assertEqual(adjunto["archivo_carga"], "adjuntos-carga/f1.jpg")
        salida = io.StringIO()
        cuenta = R.flujo_adjuntos(st, salida)
        self.assertEqual(cuenta, {"adjuntos": 1, "bytes": len(datos)})
        lineas = [json.loads(x) for x in salida.getvalue().splitlines()]
        self.assertEqual([x["source_id"] for x in lineas], ["kommo:f1"])
        import base64
        self.assertEqual(base64.b64decode(lineas[0]["b64"]), datos)
        # Si el archivo cambió (mismo largo, otro contenido: solo lo ve la huella), o falta, no sale y se cuenta.
        with open(st.ruta_de("adjuntos-carga/f1.jpg"), "wb") as f:
            f.write(b"X" + datos[1:])
        salida = io.StringIO()
        self.assertEqual(R.flujo_adjuntos(st, salida), {"no_coinciden": 1})
        self.assertEqual(salida.getvalue(), "")
        with open(st.ruta_de("adjuntos-carga/f1.jpg"), "wb") as f:
            f.write(datos + b"x")
        self.assertEqual(R.flujo_adjuntos(st, io.StringIO()), {"no_coinciden": 1})
        os.remove(st.ruta_de("adjuntos-carga/f1.jpg"))
        self.assertEqual(R.flujo_adjuntos(st, io.StringIO()), {"faltan": 1})


class PruebasIncremental(unittest.TestCase):
    """Paso 5.3: extracción incremental desde un respaldo anterior hasta un instante de corte fijo."""

    BASE_TS = AHORA - int(3.5 * DIA)
    CORTE_TS = AHORA - 3600
    DESDE_TS = BASE_TS - 24 * 3600  # solape por defecto: 24 h antes del corte anterior

    def setUp(self):
        PruebasExtraccionCompleta.setUp(self)
        s = self.servidor
        # Un mensaje después del corte, y un adjunto en un mensaje anterior al inicio (ya está en la base).
        s.mensajes[10].append(mensaje("m-tarde", 10, AHORA - 60))
        s.mensajes[10][0]["attachment"] = {"type": "file", "file_name": "viejo.pdf", "link": "https://drive-x.kommo.com/f/0?sig=yyy"}
        s.contactos[0]["updated_at"] = AHORA - 2 * DIA   # cambió después de la base
        s.contactos[1]["updated_at"] = AHORA - 450 * DIA  # no cambió
        self.base = os.path.join(self.destino, f"kommo-{stamp_de(self.BASE_TS)}")
        self.escribir_base(self.base)

    def tearDown(self):
        PruebasExtraccionCompleta.tearDown(self)

    def escribir_base(self, carpeta, **extra):
        os.makedirs(carpeta, exist_ok=True)
        m = {"version": "1.1.1", "stamp": os.path.basename(carpeta).replace("kommo-", ""),
             "archivos": [{"archivo": "kommo-x-metadatos.tar.zst.age", "bytes": 10, "sha256": "ab" * 32}]}
        m.update(extra)
        with open(os.path.join(carpeta, "manifiesto.json"), "w", encoding="utf-8") as f:
            json.dump(m, f)

    def extraer(self, **kw):
        kw.setdefault("base", self.base)
        kw.setdefault("corte", iso_de(self.CORTE_TS))
        kw.setdefault("solape_horas", 24)
        # Sin tocar `sondear_huecos` (por defecto -1, todos): el modo incremental tiene que saltarse el sondeo solo.
        return PruebasExtraccionCompleta.extraer(self, **kw)

    def pedidos(self, fragmento):
        return [u for u in self.servidor.peticiones if fragmento in u]

    def test_solo_pide_la_ventana_entre_la_base_y_el_corte(self):
        st, _args, _log = self.extraer()
        plan = st.leer_json("incremental.json")
        self.assertEqual((plan["desde"], plan["corte"]), (self.DESDE_TS, self.CORTE_TS))
        self.assertEqual(plan["base_stamp"], stamp_de(self.BASE_TS))
        eventos = self.pedidos("/api/v4/events")
        self.assertTrue(eventos)
        for u in eventos:
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(u).query)
            self.assertGreaterEqual(int(q["filter[created_at][from]"][0]), self.DESDE_TS, u)
            self.assertLessEqual(int(q["filter[created_at][to]"][0]), self.CORTE_TS, u)
        talks = sorted(t["_talk_id"] for t in st.leer_ndjson("talks.ndjson"))
        self.assertEqual(talks, [10, 12, 15, 16, 17])  # la 11 (hace 400 días) no se toca
        self.assertFalse(self.pedidos("/api/v4/talks/13"), "el sondeo de huecos es del respaldo completo")

    def test_ningun_mensaje_posterior_al_corte_entra(self):
        st, _args, _log = self.extraer()
        ids = sorted(m["id"] for m in st.leer_ndjson("mensajes.ndjson"))
        self.assertEqual(ids, ["m1", "m2", "m3"])
        self.assertEqual(st.marcados("mensajes-despues-del-corte"), {"10:1"})

    def test_adjuntos_solo_de_mensajes_desde_el_inicio(self):
        st, _args, _log = self.extraer()
        adj = [a["message_id"] for a in st.leer_ndjson("adjuntos.ndjson")]
        self.assertEqual(adj, ["m3"])
        self.assertFalse(self.pedidos("drive-x.kommo.com/f/0"), "el adjunto viejo ya está en la base")

    def test_listas_que_cambian_se_piden_por_updated_at(self):
        st, _args, _log = self.extraer()
        contactos = self.pedidos("/api/v4/contacts?")
        self.assertTrue(contactos)
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(contactos[0]).query)
        self.assertEqual((int(q["filter[updated_at][from]"][0]), int(q["filter[updated_at][to]"][0])),
                         (self.DESDE_TS, self.CORTE_TS))
        self.assertEqual([c["id"] for c in st.leer_ndjson("contactos.ndjson")], [500])
        usuarios = self.pedidos("/api/v4/users")
        self.assertTrue(usuarios and all("updated_at" not in u for u in usuarios), "las listas chicas van enteras")

    def test_reanudar_con_el_mismo_corte_no_repite_nada(self):
        self.extraer()
        n1 = len(self.servidor.peticiones)
        st, _args, _log = self.extraer()
        self.assertLess(len(self.servidor.peticiones) - n1, 5)
        self.assertEqual(len(list(st.leer_ndjson("mensajes.ndjson"))), 3)

    def test_otro_corte_u_otra_base_en_el_mismo_staging_es_un_error(self):
        self.extraer()
        with self.assertRaises(R.ErrorFatal) as cm:
            self.extraer(corte=iso_de(self.CORTE_TS - 600))
        self.assertIn("otra corrida incremental", str(cm.exception))
        otra = os.path.join(self.destino, f"kommo-{stamp_de(self.BASE_TS - DIA)}")
        self.escribir_base(otra)
        with self.assertRaises(R.ErrorFatal):
            self.extraer(base=otra)
        with self.assertRaises(R.ErrorFatal) as cm:
            PruebasExtraccionCompleta.extraer(self)  # sin --base ni --corte sobre un staging incremental
        self.assertIn("corrida incremental", str(cm.exception))

    def test_corte_en_el_futuro_o_antes_del_inicio_es_un_error(self):
        with self.assertRaises(R.ErrorFatal) as cm:
            self.extraer(corte=iso_de(AHORA + 3600))
        self.assertIn("futuro", str(cm.exception))
        with self.assertRaises(R.ErrorFatal) as cm:
            self.extraer(corte=iso_de(self.DESDE_TS - 60))
        self.assertIn("no es posterior", str(cm.exception))

    def test_base_y_corte_van_juntos_y_la_base_necesita_manifiesto(self):
        with self.assertRaises(R.ErrorFatal):
            self.extraer(corte=None)
        with self.assertRaises(R.ErrorFatal) as cm:
            self.extraer(base=os.path.join(self.tmp, "no-existe"))
        self.assertIn("manifiesto", str(cm.exception))

    def test_encadena_desde_el_corte_del_incremental_anterior(self):
        previo = os.path.join(self.destino, f"kommo-{stamp_de(AHORA - 2 * DIA)}")
        corte_previo = AHORA - 3 * DIA
        self.escribir_base(previo, incremental={"corte": corte_previo})
        st, _args, _log = self.extraer(base=previo, solape_horas=6)
        self.assertEqual(st.leer_json("incremental.json")["desde"], corte_previo - 6 * 3600)

    def test_el_manifiesto_dice_de_que_base_parte_sin_datos_de_personas(self):
        st, _args, _log = self.extraer()
        bloque = R.bloque_incremental(st)
        self.assertEqual(bloque["base_stamp"], stamp_de(self.BASE_TS))
        self.assertEqual((bloque["desde"], bloque["corte"]), (self.DESDE_TS, self.CORTE_TS))
        self.assertEqual(bloque["base_sha256_paquete"], "ab" * 32)
        self.assertEqual(bloque["corte_utc"], R.utc(self.CORTE_TS))
        texto = json.dumps(bloque)
        with open(self.logfile, encoding="utf-8") as f:
            texto += f.read()
        for marca in (TEXTO_SECRETO, NOMBRE_SECRETO, TELEFONO_SECRETO, "sig=zzz", "sig=yyy", TOKEN_FALSO):
            self.assertNotIn(marca, texto)
        self.assertIsNone(R.bloque_incremental(R.Staging(os.path.join(self.tmp, "vacio"))))

    def test_el_manifiesto_del_paquete_lleva_el_bloque_incremental_y_sirve_de_base(self):
        st, args, _log = self.extraer()
        with open(os.path.join(args.destino_corrida, f"kommo-{os.path.basename(args.destino_corrida)[6:]}-metadatos.tar.zst.age"), "wb") as f:
            f.write(b"AGE-FALSO")
        m = R.construir_manifiesto(st, args.destino_corrida, os.path.basename(args.destino_corrida)[6:], self.recipients)
        self.assertEqual(m["incremental"]["corte"], self.CORTE_TS)
        self.assertIn("adjuntos/m3.jpg.age", [a["archivo"] for a in m["archivos"]])
        # Ese manifiesto es la base de la próxima corrida: su corte es el inicio, menos el solape.
        with open(os.path.join(args.destino_corrida, "manifiesto.json"), "w", encoding="utf-8") as f:
            json.dump(m, f)
        base = R.leer_base(args.destino_corrida)
        self.assertEqual(base["hasta"], self.CORTE_TS)
        self.assertIsNotNone(base["sha256_paquete"])
        completo = R.construir_manifiesto(R.Staging(os.path.join(self.tmp, "otro")), args.destino_corrida, "x", self.recipients)
        self.assertNotIn("incremental", completo)

    def test_el_informe_dice_si_kommo_ignoro_el_filtro_por_updated_at(self):
        st, _args, log = self.extraer()
        # El servidor falso ignora el filtro en las notas de leads: llega una nota vieja.
        st.anexar_ndjson("notas-leads.ndjson", [{"id": 2, "note_type": "common", "updated_at": AHORA - 400 * DIA}])
        r = R.informe(st, log, ahora_ts=AHORA)
        f = r["incremental"]["filtro_updated_at"]
        self.assertEqual(f["contactos"], {"total": 1, "fuera_de_la_ventana": 0})
        self.assertEqual(f["notas-leads"], {"total": 2, "fuera_de_la_ventana": 1})
        completa = R.informe(R.Staging(os.path.join(self.tmp, "otro")), log, ahora_ts=AHORA)
        self.assertIsNone(completa["incremental"])

    def test_parsear_instante(self):
        self.assertEqual(R.parsear_instante("2026-11-20T03:00:00Z"), 1795143600)
        self.assertEqual(R.parsear_instante("2026-11-20"), 1795132800)
        self.assertEqual(R.parsear_instante("1795143600"), 1795143600)
        with self.assertRaises(R.ErrorFatal):
            R.parsear_instante("20/11/2026")


class PruebasCompletaHastaElCorte(unittest.TestCase):
    """5.5 · extracción completa con `--corte` y sin `--base`: la que alimenta la carga."""

    CORTE_TS = AHORA - 3600

    def setUp(self):
        PruebasExtraccionCompleta.setUp(self)
        self.servidor.mensajes[10].append(mensaje("m-tarde", 10, AHORA - 60))

    def tearDown(self):
        PruebasExtraccionCompleta.tearDown(self)

    def test_completa_con_corte_lo_trae_todo_hasta_el_corte_y_nada_despues(self):
        st, args, _log = PruebasExtraccionCompleta.extraer(self, corte=iso_de(self.CORTE_TS))
        self.assertEqual(st.leer_json("corte.json")["corte"], self.CORTE_TS)
        self.assertFalse(st.existe("incremental.json"))
        ids = sorted(m["id"] for m in st.leer_ndjson("mensajes.ndjson"))
        self.assertEqual(ids, ["m1", "m2", "m3", "m4", "m5"])  # m-tarde queda fuera; 11 (hace 400 días) sí entra
        self.assertIn("13", st.marcados("listo-talks"), "la completa sí sondea huecos")
        for u in [u for u in self.servidor.peticiones if "/api/v4/events" in u]:
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(u).query)
            self.assertLessEqual(int(q["filter[created_at][to]"][0]), self.CORTE_TS)
        m = R.construir_manifiesto(st, args.destino_corrida, "x", self.recipients)
        self.assertEqual(m["corte"], self.CORTE_TS)
        self.assertNotIn("incremental", m)

    def test_otro_corte_o_una_base_sobre_ese_staging_es_un_error(self):
        PruebasExtraccionCompleta.extraer(self, corte=iso_de(self.CORTE_TS))
        with self.assertRaises(R.ErrorFatal):
            PruebasExtraccionCompleta.extraer(self, corte=iso_de(self.CORTE_TS - 60))
        with self.assertRaises(R.ErrorFatal):
            PruebasExtraccionCompleta.extraer(self)
        base = os.path.join(self.tmp, "base")
        PruebasIncremental.escribir_base(self, base)
        with self.assertRaises(R.ErrorFatal):
            PruebasExtraccionCompleta.extraer(self, corte=iso_de(self.CORTE_TS), base=base)

    def test_un_incremental_parte_del_corte_de_una_completa(self):
        carpeta = os.path.join(self.tmp, "kommo-20261101T000000Z")
        PruebasIncremental.escribir_base(self, carpeta, corte=self.CORTE_TS - DIA)
        self.assertEqual(R.leer_base(carpeta)["hasta"], self.CORTE_TS - DIA)


def contacto(cid, nombre=NOMBRE_SECRETO, telefonos=(), correos=()):
    cf = []
    if telefonos:
        cf.append({"field_code": "PHONE", "values": [{"value": t} for t in telefonos]})
    if correos:
        cf.append({"field_code": "EMAIL", "values": [{"value": c} for c in correos]})
    return {"id": cid, "name": nombre, "avatar_url": "https://kommo.example/avatar-secreto.png",
            "custom_fields_values": cf or None}


class PruebasVinculoYCarga(unittest.TestCase):
    """5.4 (E.164 y vínculo con el ERP) y 5.5 (archivo de carga reducido), con datos inventados."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="kommo-e5-vinculo-")
        self.st = R.Staging(os.path.join(self.tmp, "staging"))
        # Las pruebas escriben en /tmp; en Linux la foto del ERP solo se acepta en /dev/shm. Esa regla
        # tiene su propia prueba (test_la_foto_del_erp_tiene_que_estar_en_tmpfs), que usa la real.
        self._en_tmpfs = R.en_tmpfs
        R.en_tmpfs = lambda ruta: True

    def tearDown(self):
        R.en_tmpfs = self._en_tmpfs
        shutil.rmtree(self.tmp, ignore_errors=True)

    def foto(self, filas):
        ruta = os.path.join(self.tmp, "clientes.ndjson")
        with open(ruta, "w", encoding="utf-8") as f:
            for fila in filas:
                f.write(json.dumps(fila) + "\n")
        return R.cargar_foto_erp(ruta)

    def test_e164_solo_completa_venezuela_y_respeta_el_codigo_de_pais(self):
        casos = {
            "+58 412-999-8877": ("+584129998877", "con_codigo"),
            "0412 9998877": ("+584129998877", "venezuela_0"),
            "584129998877": ("+584129998877", "venezuela_58"),
            "4129998877": ("+584129998877", "venezuela_10"),
            "0058 212 5550000": ("+582125550000", "con_codigo"),
            "+86 138 0013 8000": ("+8613800138000", "con_codigo"),
            "13800138000": (None, "sin_codigo_de_pais"),
            "12345": (None, "sin_codigo_de_pais"),
            "+12": (None, "largo_invalido"),
            "": (None, "vacio"),
        }
        for entrada, esperado in casos.items():
            self.assertEqual(R.e164(entrada), esperado, entrada)

    def test_la_llave_es_la_misma_que_phone_last10_del_erp(self):
        self.assertEqual(R.ultimos10("+58 (412) 999-8877"), "4129998877")
        self.assertEqual(R.ultimos10("0412-999-8877"), "4129998877")
        self.assertIsNone(R.ultimos10("999-8877"))  # menos de 10: no se cruza
        self.assertEqual(R.correo_normal("  Persona@Ejemplo.TEST "), "persona@ejemplo.test")
        self.assertIsNone(R.correo_normal("sin arroba"))

    def test_vincula_por_telefono_por_correo_ambiguo_y_sin_vinculo(self):
        foto = self.foto([
            {"client_id": "C1", "phone_last10": ["4121111111"], "correos": ["uno@ejemplo.test"]},
            {"client_id": "C2", "phone_last10": ["4142222222"], "correos": ["dos@ejemplo.test"]},
            {"client_id": "C3", "phone_last10": ["4163333333"], "correos": []},
            {"client_id": "C4", "phone_last10": ["4163333333"], "correos": []},  # mismo teléfono que C3: ambiguo
        ])
        filas, informe = R.vincular([
            contacto(10, telefonos=["0412 111 1111"]),                                 # C1 por teléfono
            contacto(11, telefonos=["0424 777 7777"], correos=["DOS@ejemplo.test"]),   # C2 por correo, otro teléfono
            contacto(12, telefonos=["+58 416 333 3333"]),                              # ambiguo: C3 y C4
            contacto(13, telefonos=["0426 555 5555"]),                                 # sin vínculo
            contacto(14, telefonos=["+584121111111"]),                                 # misma persona que 10
            contacto(16, telefonos=["+58 426-555-5555"]),                              # sin cliente, mismo teléfono que 13
        ], foto)
        por_id = {f["kommo_contact_id"]: f for f in filas}
        self.assertEqual((por_id[10]["client_id"], por_id[10]["motivo"]), ("C1", "telefono"))
        self.assertEqual((por_id[11]["client_id"], por_id[11]["motivo"], por_id[11]["otro_telefono"]), ("C2", "correo", True))
        self.assertEqual((por_id[12]["client_id"], por_id[12]["motivo"]), (None, "ambiguo_telefono"))
        self.assertEqual((por_id[13]["client_id"], por_id[13]["motivo"]), (None, "sin_vinculo"))
        self.assertEqual(por_id[14]["grupo"], 10, "mismo teléfono: misma persona")
        self.assertEqual(por_id[16]["grupo"], 13, "mismo teléfono sin cliente del ERP: misma persona igual")
        self.assertEqual(por_id[10]["e164"], ["+584121111111"])
        self.assertEqual(informe["vinculados_por_telefono"], 2)
        self.assertEqual(informe["vinculados_por_correo"], 1)
        self.assertEqual(informe["otro_telefono"], 1)
        self.assertEqual(informe["ambiguos"], 1)
        self.assertEqual(informe["sin_vinculo"], 2)
        self.assertEqual(informe["clientes_en_varios_grupos"], 0)  # E-1
        self.assertEqual(informe["ambiguos_vinculados"], 0)         # E-2
        self.assertEqual(informe["grupos"], 4)
        self.assertEqual(informe["grupos_con_varios_contactos"], 2)

    def test_el_mismo_cliente_con_otro_telefono_queda_en_un_solo_grupo(self):
        foto = self.foto([{"client_id": "C9", "phone_last10": ["4129990000"], "correos": ["nueve@ejemplo.test"]}])
        filas, informe = R.vincular([
            contacto(30, telefonos=["04129990000"]),
            contacto(25, telefonos=["04247770000"], correos=["nueve@ejemplo.test"]),
        ], foto)
        self.assertEqual({f["grupo"] for f in filas}, {25})
        self.assertEqual(informe["clientes_en_varios_grupos"], 0)
        self.assertEqual(informe["otro_telefono"], 1)

    def test_el_informe_del_vinculo_no_lleva_datos_de_personas(self):
        foto = self.foto([{"client_id": "C1", "phone_last10": ["4129998877"], "correos": ["persona@ejemplo.test"]}])
        _filas, informe = R.vincular([contacto(1, telefonos=[TELEFONO_SECRETO], correos=["persona@ejemplo.test"])], foto)
        texto = json.dumps(informe)
        for marca in (NOMBRE_SECRETO, TELEFONO_SECRETO, "4129998877", "persona@ejemplo.test", "C1"):
            self.assertNotIn(marca, texto)

    @unittest.skipUnless(os.name == "posix", "la ruta de tmpfs es de Linux")
    def test_la_foto_del_erp_tiene_que_estar_en_tmpfs(self):
        R.en_tmpfs = self._en_tmpfs
        with self.assertRaises(R.ErrorFatal):
            self.foto([{"client_id": "C1", "phone_last10": ["4121111111"]}])
        self.assertTrue(R.en_tmpfs("/dev/shm/clientes-erp.ndjson"))

    def armar_staging(self):
        st = self.st
        st.anexar_ndjson("contactos.ndjson", [contacto(10, telefonos=["04121111111"]), contacto(14, nombre="Otro Nombre", telefonos=["4121111111"]),
                                               contacto(20, nombre="Tercero", telefonos=[])])
        st.anexar_ndjson("vinculos.ndjson", [
            {"kommo_contact_id": 10, "grupo": 10, "e164": ["+584121111111"], "llaves": ["4121111111"], "correos": [], "client_id": "C1", "motivo": "telefono", "otro_telefono": False},
            {"kommo_contact_id": 14, "grupo": 10, "e164": ["+584121111111"], "llaves": ["4121111111"], "correos": [], "client_id": "C1", "motivo": "telefono", "otro_telefono": False},
            {"kommo_contact_id": 20, "grupo": 20, "e164": [], "llaves": [], "correos": [], "client_id": None, "motivo": "sin_vinculo", "otro_telefono": False},
        ])
        st.anexar_ndjson("talks.ndjson", [
            {"_http": 200, "_talk_id": 100, "talk": {"contact_id": 14, "origin": "waba", "created_at": AHORA - 9 * DIA, "updated_at": AHORA - 8 * DIA}},
            {"_http": 200, "_talk_id": 101, "talk": {"contact_id": 999, "origin": "instagram_business", "created_at": AHORA - 7 * DIA, "updated_at": AHORA - 7 * DIA}},
            {"_http": 403, "_talk_id": 102, "talk": None},
        ])
        bot = mensaje("b1", 100, AHORA - 9 * DIA, "outgoing")
        bot["author"] = {"type": "bot", "name": "Salesbot interno", "avatar_url": "https://kommo.example/x.png"}
        asesora = mensaje("a1", 100, AHORA - 9 * DIA + 60, "outgoing")
        asesora["author"] = {"type": "internal", "name": "Ana María Pérez", "avatar_url": "https://kommo.example/y.png"}
        for m in (bot, asesora):
            m["_talk_id"] = 100
        entrante = dict(mensaje("e1", 100, (AHORA - 9 * DIA) * 1000), _talk_id=100)
        foto = dict(mensaje("f1", 100, AHORA - 8 * DIA, texto=None,
                            adjunto={"type": "picture", "file_name": "x.jpg", "link": "https://drive-x.kommo.com/f/9?sig=zzz"}), _talk_id=100)
        repetido = dict(entrante)
        en_403 = dict(mensaje("z1", 102, AHORA - DIA), _talk_id=102)
        st.anexar_ndjson("mensajes.ndjson", [entrante, bot, asesora, foto, repetido, en_403])
        st.anexar_ndjson("adjuntos.ndjson", [{"message_id": "f1", "archivo": "adjuntos/f1.jpg.age", "http": 200}])
        return st

    def test_preparar_carga_reduce_y_deja_al_asesor_por_nombre_de_pila(self):
        st = self.armar_staging()
        informe = R.preparar_carga(st)
        filas = list(st.leer_ndjson("carga.ndjson"))
        personas = [f for f in filas if f["tipo"] == "persona"]
        self.assertEqual(sorted((p["grupo"], tuple(p["kommo_contact_ids"])) for p in personas), [(10, (10, 14)), (20, (20,))])
        p10 = [p for p in personas if p["grupo"] == 10][0]
        self.assertEqual((p10["telefono"], p10["client_id"], p10["nombre"]), ("+584121111111", "C1", NOMBRE_SECRETO))
        convs = {f["kommo_talk_id"]: f for f in filas if f["tipo"] == "conversacion"}
        self.assertEqual(sorted(convs), [100, 101], "la de 403 no se carga")
        self.assertEqual(convs[100]["grupo"], 10)
        self.assertIsNone(convs[101]["grupo"])
        msjs = {f["source_id"]: f for f in filas if f["tipo"] == "mensaje"}
        self.assertEqual(sorted(msjs), ["kommo:a1", "kommo:b1", "kommo:e1", "kommo:f1"], "sin repetidos ni mensajes de una conversación sin acceso")
        self.assertEqual(msjs["kommo:e1"]["autor"], "cliente")
        self.assertEqual(msjs["kommo:e1"]["creado"], AHORA - 9 * DIA, "milisegundos a segundos")
        self.assertEqual(msjs["kommo:b1"]["autor"], "Bot Kommo")
        self.assertEqual(msjs["kommo:a1"]["autor"], "Ana")
        self.assertEqual(msjs["kommo:f1"]["adjunto"], "adjuntos/f1.jpg.age")
        self.assertEqual(informe, {"con_adjunto": 1, "conversaciones": 2, "conversaciones_sin_contacto": 1, "entrantes": 2,
                                   "mensajes": 4, "mensajes_de_bot": 1, "personas": 2, "salientes": 2, "sin_texto": 1})

    def test_la_carga_no_lleva_avatar_ni_enlaces_firmados_y_el_informe_solo_cuenta(self):
        st = self.armar_staging()
        R.preparar_carga(st)
        with open(st.ruta_de("carga.ndjson"), encoding="utf-8") as f:
            carga = f.read()
        for marca in ("avatar", "kommo.example", "sig=zzz", "custom_fields_values", "Pérez"):
            self.assertNotIn(marca, carga)
        with open(st.ruta_de("carga-informe.json"), encoding="utf-8") as f:
            inf = f.read()
        for marca in (NOMBRE_SECRETO, TEXTO_SECRETO, "Ana", "+58", "C1"):
            self.assertNotIn(marca, inf)

    def test_vincular_borra_la_foto_del_erp_y_deja_solo_conteos_a_la_vista(self):
        st = self.st
        st.anexar_ndjson("contactos.ndjson", [contacto(10, telefonos=["04121111111"])])
        foto = os.path.join(self.tmp, "clientes.ndjson")
        with open(foto, "w", encoding="utf-8") as f:
            f.write(json.dumps({"client_id": "C1", "phone_last10": ["4121111111"], "correos": []}) + "\n")
        args = Args(staging=st.ruta, clientes=foto, conservar_clientes=False)
        log = R.Log(os.path.join(self.tmp, "log.txt"))
        try:
            self.assertEqual(R.cmd_vincular(args, log), 0)
        finally:
            log.cerrar()
        self.assertFalse(os.path.exists(foto), "la foto del ERP se borra al leerla")
        self.assertEqual([f["client_id"] for f in st.leer_ndjson("vinculos.ndjson")], ["C1"])
        self.assertEqual(st.leer_json("vinculo-informe.json")["vinculados_por_telefono"], 1)
        with open(os.path.join(self.tmp, "log.txt"), encoding="utf-8") as f:
            texto = f.read()
        for marca in ("4121111111", "C1", NOMBRE_SECRETO):
            self.assertNotIn(marca, texto)

    def test_preparar_carga_sin_vinculos_es_un_error(self):
        with self.assertRaises(R.ErrorFatal):
            R.preparar_carga(self.st)


def violaciones_de_solo_lectura(fuente: str) -> list[str]:
    """Lo que en el extractor podría escribir en Kommo (SDD-0590, pedido del Director General: el alcance `crm`
    del token permite escribir). Recorre el AST: cada `Request` tiene que llevar `method="GET"` explícito y sin
    `data`; cada apertura (`self.abrir`, `urlopen`) va sin cuerpo; nada de conexiones HTTP a mano ni de `requests`."""
    import ast

    arbol = ast.parse(fuente)
    malas: list[str] = []
    requests_vistos = aperturas = 0

    def nombre(func) -> str:
        partes = []
        while isinstance(func, ast.Attribute):
            partes.append(func.attr)
            func = func.value
        if isinstance(func, ast.Name):
            partes.append(func.id)
        return ".".join(reversed(partes))

    for nodo in ast.walk(arbol):
        if isinstance(nodo, (ast.Import, ast.ImportFrom)):
            modulos = [a.name for a in nodo.names] + ([nodo.module] if isinstance(nodo, ast.ImportFrom) and nodo.module else [])
            for m in modulos:
                if m.split(".")[0] in ("requests", "httpx", "aiohttp", "urllib3", "socket"):
                    malas.append(f"línea {nodo.lineno}: importa {m}")
        if not isinstance(nodo, ast.Call):
            continue
        n = nombre(nodo.func)
        kw = {k.arg: k.value for k in nodo.keywords if k.arg}
        if n.endswith("Request") and n.split(".")[-1] == "Request":
            requests_vistos += 1
            metodo = kw.get("method")
            if not (isinstance(metodo, ast.Constant) and metodo.value == "GET"):
                malas.append(f"línea {nodo.lineno}: Request sin method=\"GET\" explícito")
            if "data" in kw or len(nodo.args) > 1:
                malas.append(f"línea {nodo.lineno}: Request con cuerpo (data)")
        elif n.split(".")[-1] in ("urlopen", "abrir"):
            aperturas += 1
            if "data" in kw or len(nodo.args) > 1:
                malas.append(f"línea {nodo.lineno}: {n} con cuerpo (data)")
        elif n.split(".")[-1] in ("HTTPConnection", "HTTPSConnection", "putrequest"):
            malas.append(f"línea {nodo.lineno}: conexión HTTP a mano ({n})")
        for valor in kw.values():
            if isinstance(valor, ast.Constant) and valor.value in ("POST", "PUT", "PATCH", "DELETE"):
                malas.append(f"línea {nodo.lineno}: método {valor.value}")
    # Piso: si el extractor dejara de tener su única llamada, esta prueba no estaría mirando nada.
    if requests_vistos != 1:
        malas.append(f"se esperaba exactamente 1 Request y hay {requests_vistos}")
    if aperturas != 1:
        malas.append(f"se esperaba exactamente 1 apertura (self.abrir) y hay {aperturas}")
    return malas


class PruebasInformeAntesDeEmpaquetar(unittest.TestCase):
    """SDD-0590 §10.16, hallazgo 3: en la 5.7 se empaquetó sin correr `informe`, y el manifiesto no dijo cuántas
    conversaciones quedaron fuera por 403. `empaquetar` borra el staging, así que sin `informe.json` se niega antes
    de crear o cifrar nada, y el manifiesto lleva los conteos del informe. Con mutantes del extractor."""

    FUENTE = open(RUTA, encoding="utf-8").read()

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="kommo-e5-informe-")
        self.recipients = os.path.join(self.tmp, "recipients.txt")
        with open(self.recipients, "w", encoding="utf-8") as f:
            f.write("# Sam-prueba · creada hoy\nage1" + "q" * 58 + "\n")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @staticmethod
    def staging(M, ruta):
        """Lo mínimo que deja una completa: una conversación leída, otra con 403 y un mensaje."""
        st = M.Staging(ruta)
        st.anexar_ndjson("talks.ndjson", [{"_http": 200, "_talk_id": 10, "talk": {"contact_id": 1, "origin": "waba",
                                                                                  "created_at": AHORA - DIA, "updated_at": AHORA}},
                                          {"_http": 403, "_talk_id": 16, "talk": None}])
        st.anexar_ndjson("mensajes.ndjson", [mensaje("m1", 10, AHORA - DIA)])
        st.marcar("talks-sin-acceso", "16")
        with open(st.ruta_de("stamp.txt"), "w", encoding="utf-8") as f:
            f.write("20261107T050000Z")
        return st

    def problemas(self, M) -> list[str]:
        """Lo que el extractor M hace mal con y sin informe. El cifrado se reemplaza por una falla marcada: llegar
        ahí quiere decir que pasó la guarda."""
        problemas = []
        original = subprocess.Popen
        # Cada extractor, en su carpeta: lo que deja uno no puede tumbar al siguiente (un mutante caería por eso).
        tmp = tempfile.mkdtemp(dir=self.tmp)

        class LlegoACifrar(Exception):
            pass

        def popen_falso(*_a, **_k):
            raise LlegoACifrar()

        subprocess.Popen = popen_falso
        try:
            # 1. Sin informe.json, por la línea de comandos: código 2, sin carpeta de la corrida y el staging entero.
            st = self.staging(M, os.path.join(tmp, "sin"))
            destino = os.path.join(tmp, "destino-sin")
            try:
                rc = M.main(["empaquetar", "--staging", st.ruta, "--destino", destino, "--recipients", self.recipients])
            except LlegoACifrar:
                rc = "llegó a cifrar"
            if rc != 2:
                problemas.append(f"empaquetar sin informe.json dio {rc}, no 2")
            if os.path.exists(destino):
                problemas.append("sin informe.json creó la carpeta de la corrida")
            if not (st.existe("mensajes.ndjson") and st.existe("talks-sin-acceso")):
                problemas.append("sin informe.json tocó el staging")
            # 2. Sin informe.json, llamando a empaquetar() directo (cmd_todo y las pruebas lo hacen así).
            try:
                M.empaquetar(st, os.path.join(tmp, "corrida-directa"), self.recipients, M.Log(None), conservar=True)
                problemas.append("empaquetar() sin informe.json no se negó")
            except M.ErrorFatal as e:
                if "informe" not in str(e):
                    problemas.append(f"la negativa no dice qué falta: {e}")
            except LlegoACifrar:
                problemas.append("empaquetar() sin informe.json llegó a cifrar")
            # 2b. Con informe.md pero sin informe.json (el que lee el manifiesto): también se niega.
            with open(st.ruta_de("informe.md"), "w", encoding="utf-8") as f:
                f.write("# informe a medias\n")
            try:
                rc = M.main(["empaquetar", "--staging", st.ruta, "--destino", destino, "--recipients", self.recipients])
            except LlegoACifrar:
                rc = "llegó a cifrar"
            if rc != 2:
                problemas.append(f"con informe.md y sin informe.json, empaquetar dio {rc}, no 2")
            # 3. --sin-informe empaqueta igual, y el manifiesto lo anota con informe: null.
            try:
                M.main(["empaquetar", "--staging", st.ruta, "--destino", destino, "--recipients", self.recipients,
                        "--sin-informe"])
                problemas.append("con --sin-informe no llegó a cifrar")
            except LlegoACifrar:
                pass
            except SystemExit:
                problemas.append("no entiende --sin-informe")
            if M.construir_manifiesto(st, os.path.join(tmp, "corrida-sin"), "x", self.recipients).get("informe", "falta") is not None:
                problemas.append("sin informe.json, el manifiesto no trae informe: null")
            # 4. Con informe.json: pasa la guarda, y el manifiesto trae los 403 del informe con su huella.
            con = self.staging(M, os.path.join(tmp, "con"))
            M.informe(con, M.Log(None), ahora_ts=AHORA)
            try:
                M.main(["empaquetar", "--staging", con.ruta, "--destino", os.path.join(tmp, "destino-con"),
                        "--recipients", self.recipients])
                problemas.append("con informe.json no llegó a cifrar")
            except LlegoACifrar:
                pass
            bloque = M.construir_manifiesto(con, os.path.join(tmp, "corrida-con"), "x", self.recipients).get("informe") or {}
            esperado = {"sha256": M.sha256_archivo(con.ruta_de("informe.json")), "fecha": M.utc(AHORA),
                        "conversaciones_sin_acceso_403": 1, "mensajes_sin_acceso_403": 0}
            if bloque != esperado:
                problemas.append(f"el manifiesto trae {bloque}, no {esperado}")
        finally:
            subprocess.Popen = original
        return problemas

    def cargar(self, fuente: str):
        modulo = types.ModuleType("respaldar_mutante")
        modulo.__file__ = RUTA
        exec(compile(fuente, RUTA, "exec"), modulo.__dict__)
        return modulo

    def mutar(self, buscar: str, reemplazo: str) -> str:
        self.assertEqual(self.FUENTE.count(buscar), 1, f"el texto a mutar tiene que aparecer una vez: {buscar}")
        return self.FUENTE.replace(buscar, reemplazo)

    def test_sin_informe_se_niega_y_con_informe_el_manifiesto_trae_los_403(self):
        self.assertEqual(self.problemas(R), [])

    def test_mutantes_caen(self):
        mutantes = {
            "la línea de comandos no mira el informe": (
                "    exigir_informe(st, sin_informe)\n    carpeta = preparar_corrida(args, st)\n",
                "    carpeta = preparar_corrida(args, st)\n"),
            "empaquetar() no mira el informe": (
                '    """tar | zstd | age del staging. Si `efimera` es una clave pública, también se cifra para ella (solo ensayos)."""\n'
                "    exigir_informe(st, sin_informe)\n",
                '    """tar | zstd | age del staging. Si `efimera` es una clave pública, también se cifra para ella (solo ensayos)."""\n'),
            "mira informe.md en vez de informe.json": (
                'if not sin_informe and not st.existe("informe.json"):', 'if not sin_informe and not st.existe("informe.md"):'),
            "--sin-informe no deja pasar": ("if not sin_informe and not st.existe", "if not st.existe"),
            "el manifiesto no lleva el informe": ('    manifiesto["informe"] = bloque_informe(st)\n', ""),
            "el manifiesto cuenta los mensajes como conversaciones": (
                '"conversaciones_sin_acceso_403": conversaciones.get("sin_acceso_403")',
                '"conversaciones_sin_acceso_403": conversaciones.get("mensajes_sin_acceso_403")'),
        }
        for nombre, (buscar, poner) in mutantes.items():
            with self.subTest(mutante=nombre):
                self.assertTrue(self.problemas(self.cargar(self.mutar(buscar, poner))), f"el mutante «{nombre}» no se detectó")


class PruebasSoloLectura(unittest.TestCase):
    """El extractor solo lee de Kommo, aunque el token pueda escribir, y probar-token informa bien el emisor."""

    FUENTE = open(RUTA, encoding="utf-8").read()

    def test_el_extractor_solo_hace_get(self):
        self.assertEqual(violaciones_de_solo_lectura(self.FUENTE), [])

    def mutar(self, buscar: str, reemplazo: str) -> str:
        self.assertEqual(self.FUENTE.count(buscar), 1, f"el texto a mutar tiene que aparecer una vez: {buscar}")
        return self.FUENTE.replace(buscar, reemplazo)

    def test_mutantes_de_escritura_caen(self):
        llamada = 'urllib.request.Request(url, headers=cabeceras, method="GET")'
        apertura = "self.abrir(req, timeout=self.timeout)"
        mutantes = {
            "POST": self.mutar(llamada, 'urllib.request.Request(url, headers=cabeceras, method="POST")'),
            "sin method": self.mutar(llamada, "urllib.request.Request(url, headers=cabeceras)"),
            "con data": self.mutar(llamada, 'urllib.request.Request(url, data=b"x", headers=cabeceras, method="GET")'),
            "apertura con cuerpo": self.mutar(apertura, 'self.abrir(req, b"x", timeout=self.timeout)'),
            "conexión a mano": self.mutar(llamada, llamada + '; http.client.HTTPSConnection("kommo.com").request("PUT", "/")'),
            "segunda llamada": self.mutar(llamada, llamada + "; urllib.request.Request(url)"),
        }
        for nombre, fuente in mutantes.items():
            with self.subTest(mutante=nombre):
                self.assertNotEqual(fuente, self.FUENTE)
                self.assertTrue(violaciones_de_solo_lectura(fuente), f"el mutante «{nombre}» no se detectó")

    def test_emisor_ausente_no_dice_que_no_coincide(self):
        texto = R.describir_emisor({"scopes": ["crm"]}, "dtdcargo")
        self.assertIn("no viene en el token", texto)
        self.assertNotIn("coincide", texto)

    def test_emisor_presente_se_compara_con_la_cuenta(self):
        self.assertTrue(R.describir_emisor({"iss": "https://dtdcargo.kommo.com/"}, "dtdcargo").endswith(": sí"))
        self.assertTrue(R.describir_emisor({"iss": "https://otra.kommo.com"}, "dtdcargo").endswith(": no"))


if __name__ == "__main__":
    unittest.main()
