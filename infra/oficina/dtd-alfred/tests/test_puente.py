"""Pruebas del puente de ALFRED en su versión para Discord.

Sin red: Paperclip y Discord son dobles. Solo biblioteca estándar.

    python -m unittest discover -s infra/oficina/dtd-alfred/tests -v

Las corre el harness (`pnpm harness:test`) desde `scripts/tests/oficina-puente.node.mjs`.
"""
import json
import pathlib
import sys
import tempfile
import unittest

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


if __name__ == '__main__':
    unittest.main()
