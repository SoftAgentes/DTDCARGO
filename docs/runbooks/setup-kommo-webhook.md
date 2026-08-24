# Setup Webhook de Kommo · DTD Studio

> SDD-0043 Alcance B · push en vivo desde Kommo CRM.
> Una vez configurado, cada cambio de lead/contacto en Kommo dispara un POST a
> la Edge Function `kommo-webhook`, que actualiza las tablas espejo `kommo_*`
> casi en tiempo real (en vez de esperar el pull diario de pg_cron).
>
> El **pull diario de pg_cron (`kommo_run_sync`) queda como backstop de
> reconciliación** — si un webhook se pierde, la corrida diaria lo recupera.

## 0. Pre-requisitos (ya en prod)

- Edge Function `kommo-sync` desplegada y funcionando (Alcance A).
- Tablas `kommo_*` + Vault + RPC `kommo_get_token` (migr 0082/0083).
- Migración `0107_kommo_webhook_guard.sql` **aplicada** (trigger que descarta
  updates fuera de orden). La aplica el founder por MCP.
- Edge Function `kommo-webhook` desplegada con `verify_jwt = OFF` (la despliega
  el founder por MCP, igual que `kommo-sync`; las keys nuevas `sb_secret_*` no
  son JWT, así que el gateway con verify_jwt=on las rechazaría — la auth real es
  el `?secret=` de la URL).

## 1. Generar el secret del webhook

El secret protege la function de POSTs no autorizados. Generá uno fuerte:

```bash
openssl rand -hex 32
```

Anotalo · es tu `KOMMO_WEBHOOK_SECRET`.

## 2. Setear el secret de la Edge Function

La function lee `KOMMO_WEBHOOK_SECRET` de su entorno. Dos vías:

### Dashboard (recomendado)

Supabase Dashboard → **Edge Functions → Secrets** → New secret:

```
KOMMO_WEBHOOK_SECRET = <el hex del paso 1>
```

### CLI

```bash
supabase secrets set KOMMO_WEBHOOK_SECRET=<el hex del paso 1>
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles para todas
> las functions del proyecto (no hay que setearlas).

## 3. Configurar el webhook en Kommo

En Kommo (`doortudoor.kommo.com`): **Ajustes → Integraciones → API / Webhooks**
→ Agregar webhook (o "Crear webhook").

**URL del webhook:**

```
https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-webhook?secret=<KOMMO_WEBHOOK_SECRET>
```

(Reemplazá `<KOMMO_WEBHOOK_SECRET>` por el hex del paso 1 — va en la query string,
no en un header.)

> 🔴 **Medido el 2026-08-24: la cuenta real NO está así.** El webhook de
> producción tiene marcado **"Todos"**, no estos 6. O sea que Kommo nos manda
> **cada evento que soporta**, y `parseKommoWebhookPayload` descarta en silencio
> todo lo que no sea `leads|contacts` × `add|update|status|delete`.
>
> No es un bug —espejar de más no rompe nada— pero cambia una conclusión que
> este runbook inducía: **no hace falta habilitar nada para recibir los eventos
> de mensajería; ya están llegando.** Lo que falta es saber leerlos (SDD-0288).
>
> La tabla de abajo sigue siendo el **mínimo** que el espejo necesita, no lo que
> hay configurado hoy.
>
> ⚠️ **Y hay un SEGUNDO webhook en esa pantalla**, que este runbook nunca
> mencionó: `https://qp1-nova.ru/api/events/ai_calls_...`, suscrito a *"Nota
> agregada al lead / al contacto / a la compañía"*. No es nuestro. Ver
> [`kommo-webhook-tercero-qp1-nova.md`](kommo-webhook-tercero-qp1-nova.md).

**Eventos a marcar (mínimo del espejo):**

| Entidad   | Evento            | Por qué |
|-----------|-------------------|---------|
| Lead      | Añadido (add)     | nuevo lead → upsert |
| Lead      | Cambiado (update) | edición de campos → upsert |
| Lead      | Etapa (status)    | movimiento de pipeline → upsert |
| Lead      | Eliminado (delete)| borra la fila espejo |
| Contacto  | Añadido (add)     | nuevo contacto → upsert |
| Contacto  | Cambiado (update) | edición → upsert |

> No hace falta marcar "Contacto eliminado" para el MVP, pero si Kommo lo ofrece
> y querés simetría, la function ya maneja `contacts[delete]`.

Guardá. Kommo manda un POST de prueba al guardar — si el secret está bien, la
function responde **200**.

## 4. Verificar

1. En Kommo, creá o editá un lead.
2. En el Studio: `/studio/kommo` debería reflejar el cambio en segundos (o
   revisá `sync_logs` filtrando `entity like 'webhook_%'`).
3. Logs de la function: Supabase Dashboard → Edge Functions → `kommo-webhook` →
   Logs. Buscá `{ ok: true, events: N }`.

## Cómo responde la function (contrato)

| Situación | HTTP | Nota |
|-----------|------|------|
| Secret inválido / ausente | **403** | el único 4xx; Kommo no debería reintentar |
| Sin eventos en el body | 200 | nada que hacer |
| `account[subdomain]` sin conexión activa | 200 | log, sin reintento infinito de Kommo |
| Token no en Vault | 200 | log |
| Eventos aplicados OK | 200 | `{ ok, events, summary }` + reset de `status='active'` |
| Error interno irrecuperable | **500** | Kommo reintenta; sin filtrar secretos |

La function **resetea `kommo_connections.status='active'` + `last_error=null`** en
cada éxito, así que un webhook exitoso destraba la conexión si había quedado en
`error` (deuda #1 del spec).

## Notas de seguridad

- El secret va en la URL (query string). Kommo lo guarda como parte de la config
  del webhook; no se expone al frontend. Rotación: cambiá el secret de la
  function + actualizá la URL del webhook en Kommo (los dos a la vez).
- La function no escribe en Kommo (read-only sobre el CRM). Solo lee la entidad
  por id y la espeja.
