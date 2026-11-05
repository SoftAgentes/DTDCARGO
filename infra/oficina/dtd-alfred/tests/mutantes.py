"""Mutantes del puente de ALFRED: rompe una línea por vez y exige que alguna prueba falle.

uso: python mutantes.py <carpeta infra/oficina/dtd-alfred>
No toca la carpeta de origen: trabaja sobre copias temporales.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

origen = pathlib.Path(sys.argv[1])

MUTANTES = [
    ('M0 sin mutar (la base tiene que pasar)', None, None),
    ('M1 el contrato vuelve a decir Telegram', "se devuelven a Sam por '+CANAL+';", 'se devuelven a Sam por Telegram;'),
    ('M2 sin máscara de webhook', r"discord(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[a-z0-9._-]+', '[secreto omitido]'", r"discordXX(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[a-z0-9._-]+', '[secreto omitido]'"),
    ('M3 sin máscara de llave de bot', r"\.[A-Za-z0-9_-]{27,}\b', '[secreto omitido]'", r"\.[A-Za-z0-9_-]{270,}\b', '[secreto omitido]'"),
    ('M4 sin máscara de la variable del webhook', '|DISCORD_WEBHOOK|WEBHOOK_URL)', ')'),
    ('M5 partir cuenta caracteres y no unidades', 'usado += 2 if ord(c) > 0xFFFF else 1', 'usado += 1'),
    ('M6 un aviso que espera no frena a los demás', "            if row['next_try'] > time.time():\n                return\n", "            if row['next_try'] > time.time():\n                continue\n"),
    ('M7 tras un fallo sigue con los siguientes', "                    self.db.commit()\n                    return\n                if resto:", "                    self.db.commit()\n                    break\n                if resto:"),
    ('M8 ignora el aviso de que no quedan envíos', '                if pausa:\n', '                if False:\n'),
    ('M9 ignora el plazo que pide Discord', 'min(300,max(1,espera))', '30'),
    ('M10 encadena avisos de descarte', "if not row['id'].startswith('descartado:'):", 'if True:'),
    ('M11 el 429 deja de ser espera', 'if codigo == 429:', 'if codigo == 499:'),
    ('M12 el 400 deja de ser rechazo', 'if codigo == 400:', 'if codigo == 499:'),
    ('M13 acepta un webhook con consulta', 'or partes.query or partes.fragment', 'or partes.fragment'),
    ('M14 acepta un webhook con fragmento', 'or partes.query or partes.fragment', 'or partes.query'),
    ('M15 acepta otro host que termina igual', "partes.netloc not in ('discord.com', 'discordapp.com')", "not partes.netloc.endswith('discord.com')"),
    ('M16 acepta http', "partes.scheme != 'https' or ", ''),
    ('M17 no valida la forma de la ruta', r"or not re.fullmatch(r'/api/webhooks/\d+/[A-Za-z0-9_-]+', partes.path)", "or not partes.path.startswith('/api/webhooks/')"),
    ('M18 el tope se mide en caracteres', 'unidades(body) > TOPE_DISCORD', 'len(body) > TOPE_DISCORD'),
    ('M19 el envío no rechaza un cuerpo en blanco', 'if not body.strip() or unidades(body)', 'if unidades(body)'),
    ('M20 envía trozos en blanco', '                    if body.strip():\n', '                    if True:\n'),
    ('M21 deja pasar menciones', "'allowed_mentions':{'parse':[]}", "'allowed_mentions':{'parse':['everyone']}"),
    ('M22 con vista previa de enlaces', "'flags':4", "'flags':0"),
    ('M23 cambia la clave de idempotencia', "'idempotencyKey': 'telegram:'+rid", "'idempotencyKey': 'discord:'+rid"),
    ('M24 cambia la raíz de solicitud_id', "'dtd-telegram:' + requested_id", "'dtd-discord:' + requested_id"),
    ('M25 lo que Sam escribió por Discord vuelve como aviso', "'Mensaje de Sam por Telegram','Mensaje de Sam por Discord','Mensaje de Sam por Hermes App'", "'Mensaje de Sam por Telegram','Mensaje de Sam por Hermes App'"),
    ('M26 no lee que no quedan envíos', "cabeceras.get('X-RateLimit-Remaining') == '0'", "cabeceras.get('X-RateLimit-Remaining') == 'x'"),
    ('M27 el reintento repite lo ya enviado', "'UPDATE outbox SET body=?,message_ids=? WHERE id=?',(resto,", "'UPDATE outbox SET body=?,message_ids=? WHERE id=?',(row['body'],"),
    ('M28 trozos del largo de Telegram', 'TROZO = 1900', 'TROZO = 3500'),
    ('M29 el canal anterior vuelve a entrar', "if channel not in (CANAL,'Hermes App'):", "if channel not in (CANAL,'Telegram','Hermes App'):"),
    ('M30 no enmascara al emitir', 'resto, index = mask_secrets(text), 0', 'resto, index = text, 0'),
    ('M31 un fallo marca el aviso como enviado', "'UPDATE outbox SET attempts=attempts+1,next_try=?,error=? WHERE id=?'", "'UPDATE outbox SET sent=1,attempts=attempts+1,next_try=?,error=? WHERE id=?'"),
    ('M32 no lee Retry-After', "segundos(cabeceras.get('Retry-After'),", "segundos(None,"),
    ('M33 no lee Reset-After', "segundos(cabeceras.get('X-RateLimit-Reset-After'),1)", "segundos(None,1)"),
    ('M34 un descarte no avisa', "self.db.execute('INSERT OR IGNORE INTO outbox(id,body) VALUES (?,?)',('descartado:'+row['id']", "self.db.execute('SELECT ?,?',('descartado:'+row['id']"),
    ('M35 un descarte queda sin marcar', "(time.time(),'Descartado: el canal rechazo el contenido',row['id'])", "(None,'Descartado: el canal rechazo el contenido',row['id'])"),
    # Revisión de Codex (A1, M1, M2, M4).
    ('M36 el aviso de un comentario vuelve a llevar su texto', "Hay un comentario nuevo en esta tarea.", "{comment.get('body','')}"),
    ('M37 el aviso de estado vuelve a llevar el título', "f\"ALFRED · {issue['identifier']}\\nEstado registrado", "f\"ALFRED · {issue['identifier']}\\n{issue['title']}\\nEstado registrado"),
    ('M38 el 429 no lee el cuerpo', "segundos(datos.get('retry_after'),5)", '5'),
    ('M39 no guarda el id del mensaje', 'ids.append(id_de_mensaje(resultado))', 'pass'),
    ('M40 la entrega incierta se reintenta', "WHERE sent IS NULL AND uncertain IS NULL ORDER BY rowid", "WHERE sent IS NULL ORDER BY rowid"),
    ('M41 no espera tras una entrega incierta', 'self.espera_hasta = time.time()+ESPERA_TRAS_INCIERTA', 'self.espera_hasta = 0'),
    ('M42 un tiempo agotado se reintenta como si no hubiera salido', "            raise EntregaIncierta() from None\n        cabeceras", "            raise RuntimeError('x') from None\n        cabeceras"),
    ('M43 una conexión rechazada pasa por incierta', "if isinstance(exc.reason,(ConnectionRefusedError,socket.gaierror)):", 'if False:'),
    ('M44 no acepta discordapp', "partes.netloc not in ('discord.com', 'discordapp.com')", "partes.netloc != 'discord.com'"),
    ('M45 User-Agent fuera de formato', "'User-Agent':'DiscordBot (https://dtdcargo.com, 1.0)'", "'User-Agent':'DTD-Oficina-Puente/1.0'"),
    ('M46 corta en medio de un enlace', 'if corte >= i // 2:', 'if False:'),
    ('M47 la base vieja no gana columnas', 'if nombre not in columnas:', 'if False:'),
    ('M48 el estado no cuenta los inciertos', "'avisos_inciertos':self.db.execute('SELECT count(*) FROM outbox WHERE sent IS NULL AND uncertain IS NOT NULL')", "'avisos_inciertos':self.db.execute('SELECT 0')"),
]

fallas = 0
for nombre, viejo, nuevo in MUTANTES:
    with tempfile.TemporaryDirectory() as tmp:
        copia = pathlib.Path(tmp) / 'dtd-alfred'
        shutil.copytree(origen, copia, ignore=shutil.ignore_patterns('__pycache__'))
        if viejo is not None:
            archivo = copia / 'bridge.py'
            texto = archivo.read_text(encoding='utf-8')
            if texto.count(viejo) != 1:
                print(f'INVÁLIDO  {nombre}: {texto.count(viejo)} coincidencias')
                fallas += 1
                continue
            archivo.write_text(texto.replace(viejo, nuevo), encoding='utf-8', newline='\n')
        r = subprocess.run([sys.executable, '-I', '-B', '-m', 'unittest', 'discover', '-s', str(copia / 'tests')],
                           capture_output=True, text=True)
        rojo = r.returncode != 0
        if viejo is None:
            ok = not rojo
            print(('PASA     ' if ok else 'ROTA     ') + nombre)
        else:
            ok = rojo
            cuantas = [l for l in r.stderr.splitlines() if l.startswith(('FAIL:', 'ERROR:'))]
            print(('MUERE    ' if ok else 'SOBREVIVE ') + nombre + (f' · {len(cuantas)} pruebas' if ok else ''))
        fallas += 0 if ok else 1
print(f'RESULTADO: {len(MUTANTES) - 1} mutantes, {fallas} problemas')
sys.exit(1 if fallas else 0)
