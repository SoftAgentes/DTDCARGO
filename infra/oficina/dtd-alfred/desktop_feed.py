"""Durable, read-only delivery feed for Sam's Hermes desktop. No Paperclip writes."""
import json
import time


class DesktopFeed:
    def __init__(self, db, config, sanitize):
        self.db, self.cfg, self.sanitize = db, config, sanitize
        db.executescript('''
        CREATE TABLE IF NOT EXISTS desktop_events (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE,
          payload TEXT NOT NULL, recorded REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS desktop_health (
          task_id TEXT PRIMARY KEY, checked REAL NOT NULL, error TEXT);
        ''')
        db.commit()

    def observe(self, issue, comments, previous_status, seen):
        status = issue['status']
        fresh = [c for c in comments if c.get('id') not in seen
                 and c.get('authorAgentId') == self.cfg['alfred_id']
                 and not c.get('body', '').startswith(('Mensaje de Sam por Telegram', 'Mensaje de Sam por Discord', 'Mensaje de Sam por Hermes App'))]
        fresh.sort(key=lambda c: c.get('createdAt', ''))
        if status in ('in_review', 'done'):
            if fresh:
                for comment in fresh:
                    self.record(issue, comment, 'comment:' + comment['id'])
            elif status != previous_status:
                authored = [c for c in comments if c.get('authorAgentId') == self.cfg['alfred_id']
                            and not c.get('body', '').startswith('Mensaje de Sam por ')]
                authored.sort(key=lambda c: c.get('createdAt', ''))
                self.record(issue, authored[-1] if authored else None,
                            'status:' + issue['id'] + ':' + str(issue.get('updatedAt')))
        self.health(issue['id'])

    def health(self, task_id, error=None):
        self.db.execute('INSERT INTO desktop_health VALUES (?,?,?) ON CONFLICT(task_id) DO UPDATE SET checked=excluded.checked,error=excluded.error',
                        (task_id, time.time(), error))

    def record(self, issue, comment, key, initial=False):
        if issue.get('companyId') != self.cfg['company_id'] or issue.get('projectId') != self.cfg['project_id']:
            raise ValueError('Tarea fuera del proyecto autorizado')
        if issue['status'] not in ('in_review', 'done'):
            raise ValueError('Estado sin entrega ni cierre')
        payload = {
            'event_id': key, 'task': issue['identifier'], 'title': self.sanitize(issue['title']),
            'kind': 'entrega' if issue['status'] == 'in_review' else 'cierre',
            'status': issue['status'], 'body': self.sanitize((comment or {}).get('body', ''))[:32000],
            'occurred_at': (comment or {}).get('createdAt') or issue.get('updatedAt'),
            'url': 'http://localhost:3100/HAI/issues/' + issue['identifier'],
            'initial': initial,
        }
        self.db.execute('INSERT OR IGNORE INTO desktop_events(event_id,payload,recorded) VALUES (?,?,?)',
                        (key, json.dumps(payload, ensure_ascii=False), time.time()))

    def read(self, after=0):
        if isinstance(after, bool) or not isinstance(after, int) or after < 0:
            raise ValueError('Cursor no valido')
        rows = self.db.execute('SELECT seq,payload FROM desktop_events WHERE seq>? ORDER BY seq LIMIT 10', (after,)).fetchall()
        events = [dict(json.loads(row['payload']), seq=row['seq']) for row in rows]
        health = self.db.execute('SELECT MIN(checked) AS oldest, SUM(error IS NOT NULL) AS errors FROM desktop_health').fetchone()
        return {'source': 'oficina-dtd-sam', 'events': events,
                'cursor': events[-1]['seq'] if events else after,
                'checked_at': health['oldest'], 'unavailable_tasks': health['errors'] or 0,
                'approval': 'manual-en-paperclip'}
