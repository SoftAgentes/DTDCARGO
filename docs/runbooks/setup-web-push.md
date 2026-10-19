# Setup Web Push (notificaciones operario) · Sprint 4 v3

Runbook para activar las notificaciones push de las PWAs operario
(`/m/cn`, `/m/ve/bodeguero`, `/m/ve/camionero`). Mismo patrón operativo
que `setup-resend.md` y `setup-telegram-bot.md`: el código ya está, falta
el setup del founder (3 env vars + redeploy).

> ⚠️ **Nota del 2026-10-19 · la web ya no corre en Vercel.** Desde el
> 2026-10-16 la web corre en el servidor propio (VPS de Contabo) y se publica
> sola con el vigilante ([`publicacion-automatica-web.md`](publicacion-automatica-web.md));
> Vercel está en pausa. Donde abajo dice «Vercel»:
>
> - **Variables:** las tres VAPID se copiaron de Vercel al `.env` del servidor
>   (`/srv/dtd-cargo/.env`) antes del corte, y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
>   está además como Variable del repo en GitHub, porque se fija al construir
>   la imagen ([`servidor-contabo.md`](servidor-contabo.md) §3.1, puntos 2 y 3).
>   Un cambio se aplica recreando el contenedor `web` (y, para la pública, con
>   una imagen nueva), no con un redeploy. Lo hace la sesión de Contabo con el
>   OK de Sam.
> - **Cron:** `vercel.json` sigue siendo la fuente de los horarios, pero los
>   corre el contenedor `cron` del servidor (`infra/dtd-cargo/cron/crontab`,
>   generado con `scripts/build-crontab.mjs`). El límite del plan Hobby de
>   Vercel ya no aplica.
>
> Lo de abajo queda como registro de cómo se hizo en Vercel.

## Qué hace

Cuando el bodeguero cierra una carga (OD → `lista`), el camionero asignado
recibe una notificación push en su teléfono — **aunque la PWA esté cerrada**.
Tap en la notificación → abre la ruta del día.

Arquitectura:
- `outbox_push_events` (cola durable) ← `enqueue_operario_push` RPC
- worker drain `/api/cron/push-drain` (cron cada minuto + inline tras encolar)
- `web-push` lib con VAPID → push service del browser (FCM/APNs/Mozilla)
- SW `public/m/sw.js` recibe el `push` event → `showNotification`

## Paso 1 · Generar las VAPID keys

VAPID = el par de llaves que identifica al servidor ante el push service.
Se generan **una sola vez** y se reusan para siempre.

```bash
pnpm exec web-push generate-vapid-keys
```

Salida (ejemplo):

```
Public Key:
BNc...largo...key

Private Key:
xK2...secreto...
```

## Paso 2 · Setear las 3 env vars

En Vercel (Project → Settings → Environment Variables) y en `.env.local`
para dev:

| Var | Valor | Scope |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | el **Public Key** del paso 1 | client + server |
| `VAPID_PRIVATE_KEY` | el **Private Key** del paso 1 | **server only** |
| `VAPID_SUBJECT` | `mailto:vzla@dtdcargo.com` (o el contacto que prefieras) | server only |

> ⚠️ El `NEXT_PUBLIC_` se inyecta en el bundle del cliente — es la public
> key, no hay problema. El `VAPID_PRIVATE_KEY` **nunca** debe llevar prefijo
> `NEXT_PUBLIC_`.

`CRON_SECRET` ya debería existir (lo usa ceo-brief). Si no:

```
CRON_SECRET=<un random largo · openssl rand -hex 32>
```

## Paso 3 · Redeploy

Las env vars `NEXT_PUBLIC_*` requieren rebuild. Redeploy desde Vercel o
push a la rama.

## Paso 4 · Verificar el cron

`vercel.json` ya tiene el cron:

```json
{ "path": "/api/cron/push-drain", "schedule": "* * * * *" }
```

> **Vercel Hobby tier**: el cron mínimo es **diario** (no por minuto). Si
> estás en Hobby, el push igual funciona casi-instantáneo porque el drain
> se dispara **inline** tras encolar (no depende solo del cron). El cron
> es backstop para reintentos. Si querés cron por minuto, hacé falta Pro.

Test manual del drain:

```bash
# El secret va por header (Authorization: Bearer), nunca por query-param.
curl -H "Authorization: Bearer <CRON_SECRET>" \
  "https://dtdcargo.com/api/cron/push-drain"
# → {"ok":true,"processed":N,"delivered":M,"failed":K}
```

## Paso 5 · Probar end-to-end

1. Abrí `/m/ve/camionero` en el teléfono (Chrome Android funciona mejor;
   iOS necesita "Agregar a pantalla de inicio" + iOS 16.4+).
2. Menú (⋮) → **Activar notificaciones** → conceder permiso.
3. Desde otro device/sesión, como bodeguero, cerrá una carga de una OD
   asignada a ese camionero (OD → `lista`).
4. El teléfono del camionero debe recibir "Ruta lista para salir" en
   segundos.

Verificar la subscription guardada:

```sql
select operario_id, left(endpoint, 50) as endpoint_head, created_at
from operario_push_subscriptions;
```

Verificar el outbox:

```sql
select target_id, payload->>'title' as title, sent_at, attempts
from outbox_push_events
order by created_at desc limit 10;
```

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| "Activar notificaciones" no aparece en el menú | browser sin soporte o falta `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | verificar env var + redeploy. iOS Safari necesita PWA instalada + 16.4+ |
| Permiso concedido pero no llega push | VAPID private key mal / no seteada | revisar `VAPID_PRIVATE_KEY` en server env |
| `outbox_push_events` se llena pero `sent_at` queda null | el drain no corre / VAPID no configurada | `ensureVapid()` loguea warning si falta key. Correr drain manual |
| `delivered: 0` con subscriptions existentes | endpoint muerto (410) → auto-borrado | el operario re-activa desde el menú |
| Notificación llega sin ícono | falta `public/brand/dtdcargo-isologo-primary.png` | ya existe en el repo |

## Notas de seguridad

- Las subscriptions son por-operario (`operario_push_subscriptions`),
  separadas de las de los users admin (`user_notification_prefs` · SDD-0036).
- Endpoints `/api/m/push/{subscribe,unsubscribe}` validan la cookie
  `dtd_op` (PIN auth) antes de tocar la tabla.
- El drain solo corre con `CRON_SECRET` válido.
- Auto-unsubscribe en 410/404 → no acumulamos endpoints muertos.
