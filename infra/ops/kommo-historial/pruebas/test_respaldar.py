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
import sys
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

    def test_parsear_instante(self):
        self.assertEqual(R.parsear_instante("2026-11-20T03:00:00Z"), 1795143600)
        self.assertEqual(R.parsear_instante("2026-11-20"), 1795132800)
        self.assertEqual(R.parsear_instante("1795143600"), 1795143600)
        with self.assertRaises(R.ErrorFatal):
            R.parsear_instante("20/11/2026")


if __name__ == "__main__":
    unittest.main()
