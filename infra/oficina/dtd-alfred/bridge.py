"""Private, scoped Discord-to-Paperclip task bridge. Python standard library only."""
import hashlib
import json
import os
import pathlib
import re
import socket
import socketserver
import sqlite3
import struct
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from desktop_feed import DesktopFeed

MAX_BYTES = 100_000
CANAL = 'Discord'
TROZO = 1900  # Con margen bajo el tope de Discord.
TOPE_DISCORD = 2000
TOOLS = [
    {'name': 'encargar_alfred', 'description': 'Registra un encargo real de Sam en Paperclip y lo asigna a ALFRED. Usar cuando Sam pide trabajo al equipo; no para saludos o preguntas generales. Devuelve el numero HAI o una referencia de cola persistente. No aprueba, publica ni modifica aplicaciones. Reutiliza solicitud_id al reintentar el mismo encargo.', 'inputSchema': {'type': 'object', 'properties': {'titulo': {'type': 'string', 'maxLength': 200}, 'encargo': {'type': 'string', 'maxLength': 16000}, 'solicitud_id': {'type': 'string', 'description': 'Identificador estable del encargo. Opcional; el puente detecta repeticiones recientes.'}}, 'required': ['titulo', 'encargo'], 'additionalProperties': False}, 'annotations': {'readOnlyHint': False, 'destructiveHint': False, 'idempotentHint': True}},
    {'name': 'consultar_tarea', 'description': 'Consulta un encargo registrado por este canal, su estado y los comentarios de ALFRED. tarea puede ser HAI-20 o la referencia de cola SOL-....', 'inputSchema': {'type': 'object', 'properties': {'tarea': {'type': 'string'}}, 'required': ['tarea'], 'additionalProperties': False}, 'annotations': {'readOnlyHint': True}},
    {'name': 'comentar_tarea', 'description': 'Entrega una aclaracion o seguimiento de Sam a una tarea de ALFRED registrada en este canal. Mantiene la conversacion en la misma tarea. No equivale a aprobar decisiones. Si la tarea estaba terminada, reabrir=true solicita nuevo trabajo.', 'inputSchema': {'type': 'object', 'properties': {'tarea': {'type': 'string'}, 'mensaje': {'type': 'string', 'maxLength': 16000}, 'reabrir': {'type': 'boolean', 'default': False}, 'solicitud_id': {'type': 'string'}}, 'required': ['tarea', 'mensaje'], 'additionalProperties': False}, 'annotations': {'readOnlyHint': False, 'destructiveHint': False, 'idempotentHint': True}},
    {'name': 'listar_tareas', 'description': 'Lista los ultimos encargos registrados desde este canal y las solicitudes en cola. No inventa el estado del resto de la oficina.', 'inputSchema': {'type': 'object', 'properties': {}, 'additionalProperties': False}, 'annotations': {'readOnlyHint': True}},
    {'name': 'estado_conexion', 'description': 'Comprueba el enlace privado con ALFRED y muestra los limites de permisos y solicitudes pendientes.', 'inputSchema': {'type': 'object', 'properties': {}, 'additionalProperties': False}, 'annotations': {'readOnlyHint': True}},
]


class ApiError(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__(f'Paperclip HTTP {status}')


class Api:
    def __init__(self, token, base='http://127.0.0.1:3100/api'):
        self.token, self.base = token, base

    def __call__(self, method, path, data=None):
        req = urllib.request.Request(self.base + path, method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'},
            data=json.dumps(data).encode() if data is not None else None)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise ApiError(exc.code) from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ApiError('NO_DISPONIBLE') from None


def clean_text(value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f'Texto obligatorio, maximo {limit} caracteres')
    return value.strip()


def mask_secrets(text):
    text = re.sub(r'\b\d{8,12}:[A-Za-z0-9_-]{25,}\b', '[secreto omitido]', text)
    text = re.sub(r'(?i)\b(?:sk-[a-z0-9_-]{16,}|pcp_[a-z0-9_-]{16,}|pc_[a-z0-9_-]{16,})\b', '[secreto omitido]', text)
    # Discord: la direccion de un webhook y la llave de un bot tambien son secretos.
    text = re.sub(r'(?i)https://(?:[a-z0-9-]+\.)?discord(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[a-z0-9._-]+', '[secreto omitido]', text)
    text = re.sub(r'\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b', '[secreto omitido]', text)
    return re.sub(r'(?im)^.*(?:API_KEY|BOT_TOKEN|PASSWORD|PRIVATE KEY|DISCORD_WEBHOOK|WEBHOOK_URL)\s*[=:].*$', '[secreto omitido]', text)


class AvisoRechazado(Exception):
    """El canal no acepta este contenido y no lo aceptara al reintentar."""


class EnvioEnEspera(RuntimeError):
    """El canal pidio esperar `esperar` segundos antes del proximo envio."""
    def __init__(self, esperar):
        self.esperar = esperar
        super().__init__('Discord pidio esperar')


def unidades(texto):
    """Largo en unidades UTF-16: la cuenta mas exigente que puede hacer Discord."""
    return len(texto) + sum(1 for c in texto if ord(c) > 0xFFFF)


def partir(texto, limite=TROZO):
    """Separa el primer trozo, de a lo sumo `limite` unidades. Devuelve (trozo, resto)."""
    usado = 0
    for i, c in enumerate(texto):
        usado += 2 if ord(c) > 0xFFFF else 1
        if usado > limite and i:
            return texto[:i], texto[i:]
    return texto, ''


def segundos(valor, defecto):
    try:
        s = float(valor)
    except (TypeError, ValueError):
        return defecto
    return s if 0 <= s < float('inf') else defecto


class Bridge:
    def __init__(self, config, db_path, api, sender):
        self.cfg, self.api, self.sender = config, api, sender
        self.lock = threading.RLock()
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
          payload TEXT NOT NULL, status TEXT NOT NULL, issue_id TEXT,
          identifier TEXT, created REAL NOT NULL, error TEXT, next_try REAL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY, identifier TEXT NOT NULL, title TEXT NOT NULL,
          status TEXT NOT NULL, comments TEXT NOT NULL DEFAULT '[]', updated REAL NOT NULL,
          alerted_error TEXT, last_status_notice TEXT);
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY, body TEXT NOT NULL, sent REAL, attempts INTEGER DEFAULT 0,
          next_try REAL DEFAULT 0, error TEXT);
        ''')
        self.db.commit()

        self.desktop_feed = DesktopFeed(self.db, self.cfg, mask_secrets)

    def emit(self, key, text):
        resto, index = mask_secrets(text), 0
        while resto:
            body, resto = partir(resto)
            self.db.execute('INSERT OR IGNORE INTO outbox(id,body) VALUES (?,?)', (f'{key}:{index}', body))
            index += 1
        self.db.commit()

    def register_request(self, kind, payload, requested_id=None):
        identity_payload = {k:v for k,v in payload.items() if k != 'canal'}
        digest = hashlib.sha256(json.dumps([kind, identity_payload], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        if requested_id:
            requested_id = clean_text(requested_id, 160)
            rid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'dtd-telegram:' + requested_id))
            old = self.db.execute('SELECT * FROM requests WHERE id=?', (rid,)).fetchone()
            if old and old['fingerprint'] != digest:
                raise ValueError('solicitud_id ya pertenece a otro encargo')
        else:
            old = self.db.execute('SELECT * FROM requests WHERE fingerprint=? AND created>? ORDER BY created DESC LIMIT 1', (digest, time.time()-600)).fetchone()
            rid = old['id'] if old else str(uuid.uuid4())
        if not old:
            self.db.execute('INSERT INTO requests(id,fingerprint,kind,payload,status,created) VALUES (?,?,?,?,?,?)', (rid,digest,kind,json.dumps(payload,ensure_ascii=False),'queued',time.time()))
            self.db.commit()
        self.process_request(rid)
        row = self.db.execute('SELECT * FROM requests WHERE id=?', (rid,)).fetchone()
        return self.request_view(row)

    def request_view(self, row):
        return {'referencia': 'SOL-'+row['id'], 'estado_envio': row['status'], 'tarea': row['identifier'], 'error': row['error'], 'mensaje': 'Registrado en Paperclip y asignado a ALFRED.' if row['status']=='delivered' else 'Solicitud conservada en la cola. Todavia NO esta confirmada la entrega a ALFRED.'}

    def process_request(self, rid):
        row = self.db.execute('SELECT * FROM requests WHERE id=?', (rid,)).fetchone()
        if row['status'] in ('delivered','rejected') or row['next_try'] > time.time():
            return
        payload = json.loads(row['payload'])
        try:
            if row['kind'] == 'task':
                body = {'title': payload['titulo'], 'description': self.description(payload['encargo'],payload.get('canal',CANAL)),
                    'projectId': self.cfg['project_id'], 'assigneeAgentId': self.cfg['alfred_id'],
                    'status': 'todo', 'priority': 'medium', 'idempotencyKey': 'telegram:'+rid}
                issue = self.api('POST', '/companies/'+self.cfg['company_id']+'/issues', body)
                self.verify_issue(issue)
                issue_id, identifier = issue['id'], issue['identifier']
                self.db.execute('INSERT OR IGNORE INTO tasks(id,identifier,title,status,updated) VALUES (?,?,?,?,?)', (issue_id,identifier,issue['title'],issue['status'],time.time()))
            else:
                task = self.task_row(payload['tarea'])
                issue_id, identifier = task['id'], task['identifier']
                issue = self.api('GET', '/issues/'+issue_id)
                self.verify_issue(issue)
                resume = issue['status'] not in ('done','cancelled') or payload.get('reabrir',False)
                comment = {'body': 'Mensaje de Sam por '+payload.get('canal',CANAL)+' (seguimiento, no aprobacion formal):\n\n'+payload['mensaje'], 'clientRequestId': rid, 'reopen': payload.get('reabrir',False), 'resume': resume}
                try:
                    self.api('POST', '/issues/'+issue_id+'/comments', comment)
                except ApiError as exc:
                    # A human pause or unresolved dependency must keep execution
                    # paused, but the clarification should still reach the record.
                    if exc.status != 409 or not resume or payload.get('reabrir',False):
                        raise
                    comment['resume'] = False
                    self.api('POST', '/issues/'+issue_id+'/comments', comment)
            self.db.execute('UPDATE requests SET status=?,issue_id=?,identifier=?,error=NULL WHERE id=?', ('delivered',issue_id,identifier,rid))
            self.db.commit()
            self.emit('receipt:'+rid, f'Oficina DTD · {identifier}\n'+('Encargo registrado y asignado a ALFRED. Te avisare aqui cuando deje avances, un bloqueo o el resultado.' if row['kind']=='task' else 'Tu seguimiento quedo registrado en la tarea de ALFRED.'))
        except ApiError as exc:
            state = 'rejected' if exc.status in (400,401,403,404,409,422) else 'queued'
            self.db.execute('UPDATE requests SET status=?,error=?,next_try=? WHERE id=?', (state,str(exc),time.time()+30,rid))
            self.db.commit()
            self.emit('request-error:'+rid+':'+str(exc.status), f'Oficina DTD · SOL-{rid}\nNo pude confirmar la entrega a ALFRED: {exc}. Tu encargo esta guardado. '+('Se requiere revisar la conexion o los permisos.' if state=='rejected' else 'Reintentare automaticamente con la misma referencia, sin crear un encargo nuevo.'))

    def description(self, task, channel=CANAL):
        return ('Encargo de Sam recibido por su canal privado: '+channel+'.\n\n'+task+
            '\n\n---\nContrato de trabajo del canal: ALFRED coordina a los agentes ya aprobados, registra subtareas con parentId, revisa sus entregas y deja el resultado final como comentario de ESTA tarea. No cierres la tarea principal antes de revisar las subtareas. Si esperas una entrega, deja el bloqueo y su responsable claramente registrados; usa blockParentUntilDone al crear subtareas cuando corresponda. Las respuestas y bloqueos se devuelven a Sam por '+CANAL+'; las entregas y cierres tambien aparecen en Avisos de ALFRED en Hermes App.\n'
            'Las aprobaciones formales siguen en Paperclip y las realiza Sam. Este canal no autoriza aprobar solicitudes, contratar agentes, aumentar presupuestos, publicar, contactar clientes, desplegar cambios ni modificar aplicaciones o bases de datos. No cambies configuraciones de agentes para cumplir un encargo. Si hace falta una autorizacion, explicala y espera la decision humana.\n')

    def verify_issue(self, issue):
        if issue.get('companyId') != self.cfg['company_id'] or issue.get('projectId') != self.cfg['project_id']:
            raise ValueError('La tarea queda fuera del proyecto autorizado para este canal')

    def task_row(self, ref):
        ref = clean_text(ref, 100)
        if ref.startswith('SOL-'):
            row = self.db.execute('SELECT * FROM requests WHERE id=?', (ref[4:],)).fetchone()
            if row and row['issue_id']:
                ref = row['issue_id']
            else:
                raise ValueError('La solicitud todavia no tiene una tarea confirmada en Paperclip')
        row = self.db.execute('SELECT * FROM tasks WHERE id=? OR identifier=?', (ref,ref.upper())).fetchone()
        if not row:
            raise ValueError('Solo puedo consultar o continuar encargos registrados por este canal. Usa listar_tareas.')
        return row

    def call(self, name, args, channel=CANAL):
        if channel not in (CANAL,'Hermes App'):
            raise ValueError('Canal no autorizado')
        if name == 'desktop_feed' and channel == 'Hermes App':
            if not isinstance(args, dict) or set(args) - {'after'}:
                raise ValueError('Parametros no permitidos')
            with self.lock:
                return self.desktop_feed.read(args.get('after', 0))
        tool = next((t for t in TOOLS if t['name']==name), None)
        if not tool:
            raise ValueError('Operacion no permitida. Las aprobaciones y administracion quedan bajo control de Sam.')
        props = tool['inputSchema']['properties']
        if not isinstance(args,dict) or set(args)-set(props):
            raise ValueError('Parametros no permitidos')
        with self.lock:
            if name == 'encargar_alfred':
                payload={'titulo':clean_text(args.get('titulo'),200),'encargo':clean_text(args.get('encargo'),16000)}
                if channel != CANAL:payload['canal']=channel
                return self.register_request('task', payload, args.get('solicitud_id'))
            if name == 'comentar_tarea':
                task=self.task_row(args.get('tarea'))
                if 'reabrir' in args and not isinstance(args['reabrir'],bool):
                    raise ValueError('reabrir debe ser booleano')
                payload={'tarea':task['identifier'],'mensaje':clean_text(args.get('mensaje'),16000),'reabrir':args.get('reabrir',False)}
                if channel != CANAL:payload['canal']=channel
                return self.register_request('comment', payload, args.get('solicitud_id'))
            if name == 'consultar_tarea':
                ref=clean_text(args.get('tarea'),100)
                if ref.startswith('SOL-'):
                    pending=self.db.execute('SELECT * FROM requests WHERE id=?',(ref[4:],)).fetchone()
                    if pending and not pending['issue_id']:
                        return self.request_view(pending)
                task=self.task_row(ref)
                issue=self.api('GET','/issues/'+task['id']);self.verify_issue(issue)
                comments=self.api('GET','/issues/'+task['id']+'/comments')
                return {'tarea':issue['identifier'],'titulo':issue['title'],'estado':issue['status'],'url':self.issue_url(issue['identifier']),'comentarios':[{'autor':c.get('authorAgentId') or c.get('authorUserId'),'fecha':c.get('createdAt'),'texto':mask_secrets(c.get('body',''))[:16000]} for c in comments[-12:]]}
            if name == 'listar_tareas':
                return {'tareas':[dict(x) for x in self.db.execute('SELECT identifier as tarea,title as titulo,status as estado FROM tasks ORDER BY updated DESC LIMIT 30')], 'pendientes':[self.request_view(x) for x in self.db.execute("SELECT * FROM requests WHERE status!='delivered' ORDER BY created DESC LIMIT 20")]}
            me=self.api('GET','/agents/me')
            return {'conectado':me.get('id')==self.cfg['alfred_id'],'agente':me.get('name'),'tipo_permiso':(me.get('keyScope') or {}).get('kind'),'aprobaciones':'Solo Sam, manualmente en Paperclip. El puente no tiene una llave de Junta ni herramientas de aprobacion.','solicitudes_pendientes':self.db.execute("SELECT count(*) FROM requests WHERE status!='delivered'").fetchone()[0]}

    def issue_url(self, identifier):
        return 'http://localhost:3100/HAI/issues/'+identifier

    def poll_tasks(self):
        for task in list(self.db.execute('SELECT * FROM tasks ORDER BY updated DESC LIMIT 200')):
            try:
                issue=self.api('GET','/issues/'+task['id']);self.verify_issue(issue)
                comments=self.api('GET','/issues/'+task['id']+'/comments')
                seen=set(json.loads(task['comments']))
                self.desktop_feed.observe(issue, comments, task['status'], seen)
                fresh=[c for c in comments if c.get('id') not in seen and c.get('authorAgentId') and not c.get('body','').startswith(('Mensaje de Sam por Telegram','Mensaje de Sam por Discord','Mensaje de Sam por Hermes App'))]
                fresh.sort(key=lambda c:c.get('createdAt',''))
                for comment in fresh:
                    author = 'ALFRED' if comment.get('authorAgentId') == self.cfg['alfred_id'] else 'Equipo de la oficina'
                    self.emit('comment:'+comment['id'], f"{author} · {issue['identifier']} · {issue['status']}\n{issue['title']}\n\n{comment.get('body','')}\n\nPaperclip (en tu PC con tunel): {self.issue_url(issue['identifier'])}")
                if not fresh and issue['status'] != task['status'] and issue['status'] in ('blocked','in_review','done','cancelled'):
                    self.emit('status:'+task['id']+':'+str(issue.get('updatedAt')), f"ALFRED · {issue['identifier']}\n{issue['title']}\nEstado registrado en Paperclip: {issue['status']}. Puedes pedirme el detalle de esta tarea.")
                seen.update(c['id'] for c in comments)
                self.db.execute('UPDATE tasks SET status=?,comments=?,updated=?,alerted_error=NULL WHERE id=?', (issue['status'],json.dumps(sorted(seen)),time.time(),task['id']))
                self.db.commit()
            except ApiError as exc:
                self.desktop_feed.health(task['id'], str(exc))
                self.db.commit()
                if task['alerted_error'] != str(exc):
                    self.emit('poll-error:'+task['id']+':'+str(exc.status),f"Oficina DTD · {task['identifier']}\nNo puedo consultar el avance ahora ({exc}). El encargo sigue registrado; reintentare la consulta.")
                    self.db.execute('UPDATE tasks SET alerted_error=? WHERE id=?',(str(exc),task['id']));self.db.commit()

    def flush(self):
        # En orden estricto: el primer aviso que no sale frena a los que vienen detras,
        # para que un mensaje largo no llegue con sus trozos desordenados.
        for row in list(self.db.execute('SELECT * FROM outbox WHERE sent IS NULL ORDER BY rowid LIMIT 12')):
            if row['next_try'] > time.time():
                return
            resto = row['body']
            while True:
                # Un aviso guardado antes del corte puede traer el largo de Telegram.
                body, resto = partir(resto)
                pausa = None
                try:
                    if body.strip():
                        pausa = self.sender(body)
                except AvisoRechazado:
                    # Reintentarlo no cambia nada y frenaria a todos: se descarta avisando.
                    self.db.execute('UPDATE outbox SET sent=?,attempts=attempts+1,error=? WHERE id=?',(time.time(),'Descartado: el canal rechazo el contenido',row['id']))
                    if not row['id'].startswith('descartado:'):
                        self.db.execute('INSERT OR IGNORE INTO outbox(id,body) VALUES (?,?)',('descartado:'+row['id'],'Oficina DTD · Un aviso no pudo entregarse por este canal porque '+CANAL+' rechazo su contenido. Consulta la tarea en Paperclip.'))
                    self.db.commit()
                    break
                except Exception as exc:
                    espera = getattr(exc,'esperar',None)
                    demora = min(300,30*(row['attempts']+1)) if espera is None else min(300,max(1,espera))
                    self.db.execute('UPDATE outbox SET attempts=attempts+1,next_try=?,error=? WHERE id=?',(time.time()+demora,CANAL+' no disponible; envio pendiente',row['id']))
                    self.db.commit()
                    return
                if resto:
                    self.db.execute('UPDATE outbox SET body=? WHERE id=?',(resto,row['id']))
                else:
                    self.db.execute('UPDATE outbox SET sent=?,attempts=attempts+1,error=NULL WHERE id=?',(time.time(),row['id']))
                self.db.commit()
                if pausa:
                    return  # El canal aviso que no quedan envios en esta ventana: sigue el proximo ciclo.
                if not resto:
                    break

    def tick(self):
        with self.lock:
            for row in list(self.db.execute("SELECT id FROM requests WHERE status='queued' AND next_try<=?",(time.time(),))):
                self.process_request(row['id'])
            self.poll_tasks()
            self.flush()


def discord_sender(webhook, opener=urllib.request.urlopen):
    """Publica en un canal de Discord por su webhook. Sin menciones y sin vista previa de enlaces.

    El envio devuelve None, o los segundos que Discord pide esperar cuando avisa que no quedan
    envios en la ventana. Lanza EnvioEnEspera ante un 429 y AvisoRechazado ante un contenido que
    Discord no va a aceptar. Ningun error lleva la direccion del webhook, que es un secreto.
    """
    partes = urllib.parse.urlsplit(webhook)
    if (partes.scheme != 'https' or partes.netloc != 'discord.com' or partes.query or partes.fragment
            or not re.fullmatch(r'/api/webhooks/\d+/[A-Za-z0-9_-]+', partes.path)):
        raise ValueError('La credencial discord_webhook no es la direccion limpia de un webhook de Discord')
    def sender(body):
        if not body.strip() or unidades(body) > TOPE_DISCORD:
            raise AvisoRechazado()
        data=json.dumps({'content':body,'allowed_mentions':{'parse':[]},'flags':4}).encode()
        req=urllib.request.Request(webhook+'?wait=true',data=data,headers={'Content-Type':'application/json','User-Agent':'DTD-Oficina-Puente/1.0 (+https://dtdcargo.com)'})
        try:
            with opener(req,timeout=20) as resp:
                codigo,cabeceras=resp.status,resp.headers
        except urllib.error.HTTPError as exc:
            # urlopen no devuelve los 4xx y 5xx: los lanza. El error trae la direccion; no se propaga.
            codigo,cabeceras=exc.code,exc.headers
            exc.close()
        cabeceras=cabeceras or {}
        if codigo == 429:
            raise EnvioEnEspera(segundos(cabeceras.get('Retry-After'),5))
        if codigo == 400:
            raise AvisoRechazado()
        if not 200 <= codigo < 300:
            raise RuntimeError('Discord rechazado')
        if cabeceras.get('X-RateLimit-Remaining') == '0':
            return segundos(cabeceras.get('X-RateLimit-Reset-After'),1)
        return None
    return sender


def main():
    cfg=json.loads(pathlib.Path('/etc/dtd-alfred/config.json').read_text())
    cred=pathlib.Path(os.environ['CREDENTIALS_DIRECTORY'])
    token=(cred/'paperclip_token').read_text().strip()
    webhook=(cred/'discord_webhook').read_text().strip()
    sender=discord_sender(webhook)
    app=Bridge(cfg,'/var/lib/dtd-alfred/bridge.sqlite',Api(token),sender)
    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            _,uid,_=struct.unpack('3i',self.request.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))
            if uid not in (0,self.server.allowed_uid):
                return
            raw=self.rfile.readline(MAX_BYTES+1)
            if len(raw)>MAX_BYTES:
                return
            try:
                data=json.loads(raw)
                result={'ok':True,'result':app.call(data.get('name'),data.get('arguments',{}),self.server.channel)}
            except (ValueError,ApiError) as exc:
                result={'ok':False,'error':str(exc)}
            except Exception:
                result={'ok':False,'error':'Error interno; no se confirma ninguna accion. Consulta la referencia antes de reintentar.'}
            self.wfile.write(json.dumps(result,ensure_ascii=False).encode()+b'\n')
    class Server(socketserver.ThreadingUnixStreamServer):
        daemon_threads=True
    endpoints=[('/run/dtd-alfred/bridge.sock',cfg['allowed_uid'],CANAL)]
    if cfg.get('desktop_uid'):
        endpoints.append(('/run/dtd-alfred-sam/bridge.sock',cfg['desktop_uid'],'Hermes App'))
    for path,allowed_uid,channel in endpoints:
        if channel == 'Hermes App':
            os.chown(os.path.dirname(path),-1,cfg['desktop_gid'])
            os.chmod(os.path.dirname(path),0o750)
        if os.path.exists(path):os.unlink(path)
        server=Server(path,Handler);server.allowed_uid=allowed_uid;server.channel=channel
        if channel == 'Hermes App':os.chown(path,-1,cfg['desktop_gid'])
        os.chmod(path,0o660)
        threading.Thread(target=server.serve_forever,daemon=True).start()
    print('Puente ALFRED iniciado; credencial task_bridge; socket privado.',flush=True)
    while True:
        try:app.tick()
        except Exception:print('Ciclo pendiente; el estado persistente se conserva.',flush=True)
        time.sleep(15)


if __name__=='__main__':main()
