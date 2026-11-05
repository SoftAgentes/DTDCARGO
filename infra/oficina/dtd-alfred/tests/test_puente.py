"""Pruebas del puente de ALFRED en su versión para Discord.

Sin red: Paperclip y Discord son dobles. Solo biblioteca estándar.

    python -m unittest discover -s infra/oficina/dtd-alfred/tests -v

Las corre el harness (`pnpm harness:test`) desde `scripts/tests/oficina-puente.node.mjs`.
"""
import email.message
import io
import json
import pathlib
import sys
import tempfile
import time
import unittest
import urllib.error
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import bridge  # noqa: E402

CFG = {'company_id': 'c1', 'project_id': 'p1', 'alfred_id': 'a1'}


class ApiDoble:
    """Paperclip de mentira: solo sabe crear una tarea."""

    def __init__(self):
        self.llamadas = []

    def __call__(self, method, path, data=None):
        self.llamadas.append((method, path, data))
        if method == 'POST' and path.endswith('/issues'):
            return {'id': 'i1', 'identifier': 'HAI-99', 'title': data['title'], 'status': 'todo',
                    'companyId': 'c1', 'projectId': 'p1'}
        raise AssertionError(path)


class Resp:
    """Respuesta de mentira de `urlopen`."""

    def __init__(self, status=204):
        self.status = status
        self.headers = {}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class Base(unittest.TestCase):
    def nuevo(self, sender=None):
        carpeta = tempfile.TemporaryDirectory()
        enviados, api = [], ApiDoble()
        app = bridge.Bridge(CFG, str(pathlib.Path(carpeta.name) / 'b.sqlite'), api,
                            sender or enviados.append)
        # En Windows el archivo no se puede borrar con la conexión abierta.
        self.addCleanup(carpeta.cleanup)
        self.addCleanup(app.db.close)
        return app, api, enviados


class Encargos(Base):
    def test_un_encargo_crea_la_tarea_y_dice_que_llego_por_discord(self):
        app, api, enviados = self.nuevo()
        r = app.call('encargar_alfred', {'titulo': 'Plan SEO', 'encargo': 'Quiero más visitas'})
        self.assertEqual((r['tarea'], r['estado_envio']), ('HAI-99', 'delivered'))
        cuerpo = api.llamadas[0][2]
        self.assertIn('canal privado: Discord', cuerpo['description'])
        # La clave interna no cambia: cambiarla duplicaría encargos ya registrados.
        self.assertTrue(cuerpo['idempotencyKey'].startswith('telegram:'))
        app.flush()
        self.assertEqual(len(enviados), 1)
        self.assertIn('HAI-99', enviados[0])

    def test_repetir_el_mismo_encargo_no_crea_otra_tarea(self):
        app, api, _ = self.nuevo()
        for _ in range(2):
            app.call('encargar_alfred', {'titulo': 'Plan SEO', 'encargo': 'Quiero más visitas'})
        self.assertEqual(sum(1 for m, _, _ in api.llamadas if m == 'POST'), 1)

    def test_un_canal_desconocido_se_rechaza_y_el_nombre_anterior_ya_no_entra(self):
        app, _, _ = self.nuevo()
        for canal in ('Telegram', 'Otro'):
            with self.assertRaises(ValueError, msg=canal):
                app.call('listar_tareas', {}, canal)


class Salida(Base):
    def test_un_texto_largo_se_parte_en_trozos_que_caben_en_discord(self):
        app, _, enviados = self.nuevo()
        app.emit('largo', 'x' * 5000)
        app.flush()
        self.assertEqual([len(t) for t in enviados], [1900, 1900, 1200])

    def test_si_discord_falla_el_aviso_queda_pendiente_y_se_reintenta(self):
        def falla(_):
            raise RuntimeError('caído')
        app, _, _ = self.nuevo(falla)
        app.emit('k', 'hola')
        app.flush()
        fila = app.db.execute('SELECT sent, attempts, error FROM outbox').fetchone()
        self.assertIsNone(fila['sent'])
        self.assertEqual(fila['attempts'], 1)
        self.assertIn('Discord', fila['error'])

    def test_los_secretos_se_enmascaran_antes_de_salir(self):
        app, _, enviados = self.nuevo()
        app.emit('s', 'token 12345678:' + 'A' * 30)
        app.flush()
        self.assertIn('secreto omitido', enviados[0])
        self.assertNotIn('AAAA', enviados[0])


class EnvioDiscord(unittest.TestCase):
    def test_sin_menciones_con_agente_propio_y_solo_a_un_webhook_de_discord(self):
        vistos = []

        def abridor(req, timeout):
            vistos.append(req)
            return Resp(204)

        enviar = bridge.discord_sender('https://discord.com/api/webhooks/1/abc', abridor)
        enviar('hola @everyone')
        req = vistos[0]
        datos = json.loads(req.data)
        self.assertEqual(req.full_url, 'https://discord.com/api/webhooks/1/abc?wait=true')
        self.assertEqual(datos['allowed_mentions'], {'parse': []})
        self.assertEqual(datos['content'], 'hola @everyone')
        self.assertIn('DTD-Oficina-Puente', req.get_header('User-agent'))

    def test_una_respuesta_que_no_es_2xx_falla(self):
        enviar = bridge.discord_sender('https://discord.com/api/webhooks/1/abc',
                                       lambda req, timeout: Resp(429))
        with self.assertRaises(RuntimeError):
            enviar('x')

    def test_una_direccion_que_no_es_de_discord_se_rechaza(self):
        with self.assertRaises(ValueError):
            bridge.discord_sender('https://ejemplo.com/hook')


# ─────────────────────────────────────────────────────────────────────────────
# Revisión del parche (SDD-0607). Las pruebas de aquí abajo nacieron en rojo
# contra el parche tal como llegó. Son la excepción las dos de `Guardas` y la de
# la vista previa de enlaces, que fijan lo que el parche ya hacía bien.
# ─────────────────────────────────────────────────────────────────────────────

WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL'


def u16(texto):
    """Largo en unidades UTF-16: la cuenta más exigente que puede hacer Discord."""
    return len(texto.encode('utf-16-le')) // 2


def error_http(codigo, cabeceras=None):
    """El error que de verdad lanza `urlopen` ante un 4xx o 5xx: no devuelve respuesta."""
    mensaje = email.message.Message()
    for nombre, valor in (cabeceras or {}).items():
        mensaje[nombre] = valor
    return urllib.error.HTTPError(WEBHOOK + '?wait=true', codigo, 'x', mensaje, io.BytesIO(b''))


def abridor_que_lanza(codigo, cabeceras=None):
    def abridor(req, timeout):
        raise error_http(codigo, cabeceras)
    return abridor


class RevisionContrato(Base):
    def test_el_contrato_de_la_tarea_ya_no_promete_respuestas_por_telegram(self):
        app, api, _ = self.nuevo()
        app.call('encargar_alfred', {'titulo': 'Plan SEO', 'encargo': 'Quiero más visitas'})
        descripcion = api.llamadas[0][2]['description']
        self.assertNotIn('Telegram', descripcion)
        self.assertIn('se devuelven a Sam por Discord', descripcion)


class RevisionSecretos(Base):
    def enviado(self, texto):
        app, _, enviados = self.nuevo()
        app.emit('s', texto)
        app.flush()
        return '\n'.join(enviados)

    def test_la_direccion_de_un_webhook_de_discord_no_sale(self):
        for direccion in (WEBHOOK,
                          'https://discordapp.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL',
                          'https://canary.discord.com/api/v10/webhooks/123456789012345678/abcDEF_ghi-JKL'):
            salida = self.enviado('La configuré así: ' + direccion + ' y funcionó')
            self.assertIn('secreto omitido', salida, direccion)
            self.assertNotIn('abcDEF_ghi-JKL', salida, direccion)
            self.assertIn('y funcionó', salida, direccion)

    def test_la_llave_de_un_bot_de_discord_no_sale(self):
        llave = 'M' * 26 + '.GaBcDe.' + 'x' * 38
        salida = self.enviado('token del bot: ' + llave)
        self.assertIn('secreto omitido', salida)
        self.assertNotIn('x' * 38, salida)

    def test_una_linea_con_la_variable_del_webhook_no_sale(self):
        salida = self.enviado('paso 1\nDISCORD_WEBHOOK=cualquier-cosa\npaso 2')
        self.assertNotIn('cualquier-cosa', salida)
        self.assertIn('paso 2', salida)


class RevisionTrozos(Base):
    def test_un_aviso_que_ya_estaba_en_cola_con_el_largo_de_telegram_sale_en_trozos_y_en_orden(self):
        # Antes del corte los avisos se guardaban en trozos de 3.500. Los que queden
        # sin enviar los manda el puente nuevo, y Discord no los acepta enteros.
        app, _, enviados = self.nuevo()
        viejo = 'a' * 1900 + 'b' * 1600
        app.db.execute('INSERT INTO outbox(id,body) VALUES (?,?)', ('comment:viejo:0', viejo))
        app.db.execute('INSERT INTO outbox(id,body) VALUES (?,?)', ('receipt:despues:0', 'fin'))
        app.db.commit()
        app.flush()
        self.assertTrue(all(u16(t) <= 2000 for t in enviados), [len(t) for t in enviados])
        self.assertEqual(enviados, ['a' * 1900, 'b' * 1600, 'fin'])
        self.assertEqual(app.db.execute('SELECT count(*) FROM outbox WHERE sent IS NULL').fetchone()[0], 0)

    def test_si_falla_a_mitad_de_un_aviso_largo_el_reintento_no_repite_lo_ya_enviado(self):
        enviados, fallas = [], []

        def sender(body):
            if body.startswith('b') and not fallas:
                fallas.append(body)
                raise RuntimeError('caído')
            enviados.append(body)

        app, _, _ = self.nuevo(sender)
        app.db.execute('INSERT INTO outbox(id,body) VALUES (?,?)', ('comment:viejo:0', 'a' * 1900 + 'b' * 1600))
        app.db.commit()
        app.flush()
        self.assertEqual(enviados, ['a' * 1900])
        app.db.execute('UPDATE outbox SET next_try=0')
        app.db.commit()
        app.flush()
        self.assertEqual(enviados, ['a' * 1900, 'b' * 1600])

    def test_los_trozos_se_miden_como_los_cuenta_discord_en_el_peor_caso(self):
        # Un emoji es un carácter para Python y dos unidades para quien cuenta en UTF-16.
        app, _, enviados = self.nuevo()
        texto = '😀' * 1500
        app.emit('emojis', texto)
        app.flush()
        self.assertTrue(all(u16(t) <= 2000 for t in enviados), [u16(t) for t in enviados])
        self.assertEqual(''.join(enviados), texto)

    def test_un_trozo_en_blanco_no_se_envia_ni_frena(self):
        app, _, enviados = self.nuevo()
        app.db.execute('INSERT INTO outbox(id,body) VALUES (?,?)', ('blanco:0', ' \n '))
        app.db.execute('INSERT INTO outbox(id,body) VALUES (?,?)', ('otro:0', 'hola'))
        app.db.commit()
        app.flush()
        self.assertEqual(enviados, ['hola'])
        self.assertEqual(app.db.execute('SELECT count(*) FROM outbox WHERE sent IS NULL').fetchone()[0], 0)


class RevisionOrden(Base):
    def tres(self, sender):
        app, _, _ = self.nuevo(sender)
        for clave, texto in (('k1', 'uno'), ('k2', 'dos'), ('k3', 'tres')):
            app.emit(clave, texto)
        return app

    def test_si_un_envio_falla_los_que_vienen_detras_esperan_su_turno(self):
        enviados, fallas = [], []

        def sender(body):
            if body == 'dos' and not fallas:
                fallas.append(body)
                raise RuntimeError('caído')
            enviados.append(body)

        app = self.tres(sender)
        app.flush()
        self.assertEqual(enviados, ['uno'])
        app.flush()  # «dos» todavía espera su reintento: «tres» no se le adelanta.
        self.assertEqual(enviados, ['uno'])
        app.db.execute('UPDATE outbox SET next_try=0')
        app.db.commit()
        app.flush()
        self.assertEqual(enviados, ['uno', 'dos', 'tres'])

    def test_cuando_discord_pide_esperar_se_espera_ese_plazo_y_no_el_generico(self):
        def sender(body):
            raise bridge.EnvioEnEspera(7)

        app = self.tres(sender)
        antes = time.time()
        app.flush()
        fila = app.db.execute("SELECT * FROM outbox WHERE id='k1:0'").fetchone()
        self.assertIsNone(fila['sent'])
        self.assertTrue(antes + 6 <= fila['next_try'] <= time.time() + 8, fila['next_try'] - antes)

    def test_si_discord_avisa_que_no_quedan_envios_la_tanda_se_corta_ahi(self):
        enviados = []

        def sender(body):
            enviados.append(body)
            return 2.0  # «no te quedan envíos en esta ventana»

        app = self.tres(sender)
        app.flush()
        self.assertEqual(enviados, ['uno'])
        app.flush()
        self.assertEqual(enviados, ['uno', 'dos'])

    def test_un_contenido_que_discord_rechaza_se_descarta_avisando_y_no_frena_a_los_demas(self):
        enviados = []

        def sender(body):
            if body == 'dos':
                raise bridge.AvisoRechazado()
            enviados.append(body)

        app = self.tres(sender)
        app.flush()
        self.assertEqual(enviados, ['uno', 'tres'])
        app.flush()  # El aviso del descarte se encoló detrás y sale en la tanda siguiente.
        self.assertEqual(len(enviados), 3)
        self.assertIn('no pudo entregarse', enviados[2])
        fila = app.db.execute("SELECT * FROM outbox WHERE id='k2:0'").fetchone()
        self.assertIsNotNone(fila['sent'])
        self.assertIn('Descartado', fila['error'])
        self.assertEqual(app.db.execute('SELECT count(*) FROM outbox WHERE sent IS NULL').fetchone()[0], 0)

    def test_si_hasta_el_aviso_de_descarte_se_rechaza_no_se_encadena_otro(self):
        def sender(body):
            raise bridge.AvisoRechazado()

        app, _, _ = self.nuevo(sender)
        app.emit('k', 'hola')
        for _ in range(4):
            app.flush()
        self.assertEqual(app.db.execute('SELECT count(*) FROM outbox').fetchone()[0], 2)
        self.assertEqual(app.db.execute('SELECT count(*) FROM outbox WHERE sent IS NULL').fetchone()[0], 0)


class RevisionEnvioDiscord(unittest.TestCase):
    def test_un_429_de_verdad_dice_cuanto_esperar(self):
        enviar = bridge.discord_sender(WEBHOOK, abridor_que_lanza(429, {'Retry-After': '3.5'}))
        with self.assertRaises(bridge.EnvioEnEspera) as caso:
            enviar('x')
        self.assertEqual(caso.exception.esperar, 3.5)

    def test_un_429_sin_plazo_espera_un_plazo_propio(self):
        enviar = bridge.discord_sender(WEBHOOK, abridor_que_lanza(429))
        with self.assertRaises(bridge.EnvioEnEspera) as caso:
            enviar('x')
        self.assertEqual(caso.exception.esperar, 5)

    def test_un_400_es_un_contenido_rechazado_y_no_un_reintento(self):
        enviar = bridge.discord_sender(WEBHOOK, abridor_que_lanza(400))
        with self.assertRaises(bridge.AvisoRechazado):
            enviar('x')

    def test_un_webhook_borrado_o_sin_permiso_se_reintenta_y_no_filtra_la_direccion(self):
        for codigo in (401, 403, 404, 500):
            enviar = bridge.discord_sender(WEBHOOK, abridor_que_lanza(codigo))
            with self.assertRaises(RuntimeError) as caso:
                enviar('x')
            self.assertNotIsInstance(caso.exception, bridge.EnvioEnEspera, codigo)
            self.assertNotIn('abcDEF', str(caso.exception) + repr(caso.exception), codigo)
            self.assertFalse(hasattr(caso.exception, 'url'), codigo)

    def test_avisa_cuando_discord_dice_que_no_quedan_envios_en_la_ventana(self):
        def con(cabeceras):
            def abridor(req, timeout):
                r = Resp(200)
                r.headers = cabeceras
                return r
            return bridge.discord_sender(WEBHOOK, abridor)

        self.assertEqual(con({'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '1.25'})('x'), 1.25)
        self.assertEqual(con({'X-RateLimit-Remaining': '0'})('x'), 1)
        self.assertIsNone(con({'X-RateLimit-Remaining': '3', 'X-RateLimit-Reset-After': '1.25'})('x'))
        self.assertIsNone(con({})('x'))

    def test_el_mensaje_sale_sin_vista_previa_de_enlaces(self):
        vistos = []

        def abridor(req, timeout):
            vistos.append(json.loads(req.data))
            return Resp(204)

        bridge.discord_sender(WEBHOOK, abridor)('mira https://dtdcargo.com')
        self.assertEqual(vistos[0]['flags'], 4)

    def test_un_mensaje_que_discord_no_va_a_aceptar_no_llega_a_pedirse(self):
        llamadas = []

        def abridor(req, timeout):
            llamadas.append(req)
            return Resp(204)

        enviar = bridge.discord_sender(WEBHOOK, abridor)
        for cuerpo in ('x' * 2001, '😀' * 1001, '', '  \n '):
            with self.assertRaises(bridge.AvisoRechazado, msg=repr(cuerpo[:5])):
                enviar(cuerpo)
        self.assertEqual(llamadas, [])
        enviar('x' * 2000)
        self.assertEqual(len(llamadas), 1)

    def test_la_credencial_tiene_que_ser_la_direccion_limpia_de_un_webhook(self):
        malas = (WEBHOOK + '?wait=true', WEBHOOK + '?thread_id=1', WEBHOOK + '#x',
                 WEBHOOK.replace('https://', 'http://'),
                 'https://discord.com.ejemplo.com/api/webhooks/1/abc',
                 'https://usuario@discord.com/api/webhooks/1/abc',
                 'https://discord.com/api/webhooks/123456789012345678',
                 'https://discord.com/api/webhooks/123456789012345678/abc/slack',
                 'https://discord.com/api/webhooks/no-numero/abc', '')
        for mala in malas:
            with self.assertRaises(ValueError, msg=mala) as caso:
                bridge.discord_sender(mala)
            self.assertNotIn('abcDEF', str(caso.exception), mala)
        bridge.discord_sender(WEBHOOK)  # la limpia sí entra


class Guardas(Base):
    def test_el_identificador_de_solicitud_conserva_su_raiz(self):
        # Si la raíz cambiara, reintentar un encargo anterior al corte crearía otra tarea.
        app, _, _ = self.nuevo()
        r = app.call('encargar_alfred', {'titulo': 'T', 'encargo': 'E', 'solicitud_id': 'abc'})
        self.assertEqual(r['referencia'], 'SOL-' + str(uuid.uuid5(uuid.NAMESPACE_URL, 'dtd-telegram:abc')))

    def test_lo_que_sam_escribio_no_vuelve_como_aviso_y_lo_de_alfred_si(self):
        class ApiConComentarios(ApiDoble):
            def __call__(self, method, path, data=None):
                if method == 'GET' and path == '/issues/i1':
                    return {'id': 'i1', 'identifier': 'HAI-99', 'title': 'T', 'status': 'in_progress',
                            'companyId': 'c1', 'projectId': 'p1'}
                if method == 'GET' and path == '/issues/i1/comments':
                    return [
                        {'id': 'c1', 'authorAgentId': 'a1', 'createdAt': '1',
                         'body': 'Mensaje de Sam por Discord (seguimiento, no aprobacion formal):\n\nhola'},
                        {'id': 'c2', 'authorAgentId': 'a1', 'createdAt': '2',
                         'body': 'Mensaje de Sam por Telegram (seguimiento, no aprobacion formal):\n\nviejo'},
                        {'id': 'c3', 'authorAgentId': 'a1', 'createdAt': '3', 'body': 'Avance: listo el borrador'},
                    ]
                return super().__call__(method, path, data)

        app, _, enviados = self.nuevo()
        app.api = ApiConComentarios()
        app.call('encargar_alfred', {'titulo': 'T', 'encargo': 'E'})
        app.flush()
        del enviados[:]
        app.poll_tasks()
        app.flush()
        self.assertEqual(len(enviados), 1)
        self.assertIn('Avance: listo el borrador', enviados[0])
        self.assertNotIn('hola', enviados[0])


if __name__ == '__main__':
    unittest.main()
