# Runbook MAESTRO — Activar el CRM ↔ Kommo (SDD-0083/0084/0086/0087)

> Una sola fuente de verdad para **encender** todo el frente CRM↔Kommo. El código y las migraciones ya
> están LIVE en prod, pero el write-back está **dormido**: falta deployar la edge function que drena la
> cola, configurar 2 cosas en el Studio y prender un flag. Lo ejecuta la **ventana de coordinación + el
> founder** (toca prod). La ventana de desarrollo NO deploya ni escribe en prod.
>
> Detalle fino del drain del write-back → [`deploy-kommo-writeback.md`](deploy-kommo-writeback.md). Webhook
> tiempo-real → [`setup-kommo-webhook.md`](setup-kommo-webhook.md). Push del alta → [`deploy-kommo-push-client.md`](deploy-kommo-push-client.md).

## Estado real de prod (verificado 2026-06-14, MCP)

| Pieza | Estado |
|---|---|
| Migr `0136` outbox + gate (SDD-0083) | ✅ aplicada |
| Migr `0137` `stage_map` (SDD-0084) | ✅ aplicada |
| Migr `0138` `markbox_field_id` (SDD-0086) | ✅ aplicada |
| Migr `0139` `kommo_users` (SDD-0087) | ❌ pendiente (rama `feat/kommo-users` sin merge) |
| Edge `kommo-sync` | ✅ deployada **v3** (todavía SIN el pull de usuarios de 0087) |
| Edge `kommo-webhook` | ✅ deployada v1 (config del webhook en Kommo = aparte) |
| **Edge `kommo-writeback`** | ❌ **NO deployada** ← bloquea TODO el write-back |
| Edge `kommo-push-client` (SDD-0074) | ❌ no deployada (frente aparte) |
| Flags `kommo_connections.writeback_enabled / writeback_dry_run` | `false / true` (apagado, dry-run) |

**Consecuencia hoy:** cada estimado que se envía/acepta/rechaza y cada lead que se convierte **encola** una
fila en `kommo_writeback_outbox` (valor + etapa + MARKBOX), pero como `kommo-writeback` no existe, **nada se
drena** → las filas se acumulan en `pending` y Kommo no recibe nada. No es un bug: es el gate de seguridad.

## 🔑 El unblock #1 — deployar `kommo-writeback`

Sin esta edge function, 0083 (valor) + 0084 (etapa) + 0086 (MARKBOX) están **inertes** (la cola crece, no
drena). Es la acción de mayor impacto. **No escribe nada todavía** al deployarla: el gate sigue en dry-run.

---

## Track COORDINACIÓN (prod)

### A. Encender el write-back (0083 + 0084 + 0086) — ya migrado, solo falta la función
1. **Deploy `kommo-writeback`** (`supabase/functions/kommo-writeback/`), `verify_jwt = OFF` (igual que
   `kommo-sync`/`kommo-webhook`; la auth la hace la función exigiendo el service key).
   URL: `https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback`.
2. **Cron del drain:** confirmar `kommo_cron_key` en Vault (lo usa también `kommo_run_sync`); luego
   programar el job (estaba comentado en 0136 a propósito):
   ```sql
   select cron.schedule('kommo-writeback-drain-dtd', '*/15 * * * *',
     $job$select public.kommo_run_writeback_drain();$job$);
   ```
3. **Validar en DRY-RUN** (cero escritura): forzar el drain y mirar `sync_logs.entity='writeback_dryrun'`
   + la fila de la outbox en `status='skipped'`. Pasos exactos → [`deploy-kommo-writeback.md`](deploy-kommo-writeback.md) §4.
   ⚠️ Si la cola ya tiene muchas `pending` acumuladas, el primer drain las marcará `skipped` (dry-run) en
   lotes de 100; correrlo varias veces o esperar al cron.
4. **Prender el write real** SOLO con OK del founder (ver Track Founder §2):
   ```sql
   update public.kommo_connections
     set writeback_enabled = true, writeback_dry_run = false
     where tenant_id = '<TENANT_ID>';
   ```
   **Rollback** en cualquier momento: `set writeback_dry_run = true` (sigue encolando, deja de escribir).

### B. Encender los nombres de asesor (0087)
5. **Merge** de `feat/kommo-users` (con OK del founder) → deploy Vercel.
6. **Aplicar migr `0139`** `kommo_users` (MCP `apply_migration` o SQL editor; correr antes los 2 skills
   Supabase + advisors). Crea la tabla espejo (RLS por tenant, sin RPC).
7. **Re-deploy `kommo-sync`** (→ v4): la v3 actual NO trae el pull de usuarios; el código nuevo agrega la
   entidad `users` (`GET /api/v4/users`). Tras el próximo sync (cron diario o manual), `kommo_users` se
   puebla y el tablero muestra el nombre real del asesor en vez de "Asesor #142".
   *(Orden seguro: el código de 0087 ya tolera que la tabla no exista — `getKommoAnalytics` cae a "Asesor #id"
   sin romper — así que el orden 5→6→7 no rompe nada aunque haya un gap entre pasos.)*

---

## Track FOUNDER (en el Studio / Kommo)

1. **Configurar las 2 automatizaciones** en `/studio/kommo` → pestaña **Dirección** (ya están vivas en prod
   porque 0137/0138 están aplicadas; son admin-only):
   - **"Mapa de etapas"** (SDD-0084): elegir, para cada estado del estimado (enviado / aceptado / rechazado),
     a qué **embudo + etapa** de Kommo mover el lead. Lo de `rechazado → etapa de perdido` es lo que limpia
     el cementerio del tablero. Dejar "Sin mapear" lo que no quieras mover.
   - **"MARKBOX en Kommo"** (SDD-0086): elegir el **custom field** del lead donde se escribe el MARKBOX al
     convertir. ⚠️ **Debe ser un campo de TEXTO** en Kommo (no select/numeric). Si no existe, crearlo primero
     en Kommo (Leads → custom fields) y re-sincronizar para que aparezca en el dropdown.
   - Mientras `kommo-writeback` no esté deployada (Track Coord §A.1) o el flag esté apagado, configurar el
     mapa/campo **no escribe nada** — solo deja lista la intención.
2. **Autorizar el write real:** tras ver el dry-run OK (Track Coord §A.3), dar el OK para el flip de flags
   (§A.4). Recién ahí Kommo empieza a recibir valor + etapa + MARKBOX.
3. **Open question #4 (scope del token):** si en el E2E real el PATCH a Kommo devuelve **401**, el token de
   Vault es de **solo-lectura** → regenerar uno con permiso de escritura en Kommo (la integración de la
   misma cuenta). El drain reintenta hasta 5 veces y marca la fila `error`; no rompe el ERP.

---

## Verificación / observabilidad

- **`kommo_writeback_outbox`** — estado por fila: `pending` (en cola) · `sent` (escrito) · `skipped`
  (dry-run o no-aplicable) · `error` (5 intentos fallidos). Panel read-only en `/studio/kommo` → Dirección
  ("Write-back a Kommo": gate + conteos + último drain).
- **`sync_logs`** — `entity='writeback'` (real) · `'writeback_dryrun'` (ensayo) · `'users'` (sync de asesores).
- **Guardrail 0107:** el write-back NUNCA escribe el espejo (`kommo_leads`); Kommo reespeja vía webhook (o
  el sync diario lo pone al día). Un fallo del write-back nunca rompe la transición del estimado ni la conversión.

## Orden recomendado (resumen)

1. **Coord §A.1** deploy `kommo-writeback` → **§A.2** cron → **§A.3** dry-run.
2. **Founder §1** configurar mapa de etapas + campo MARKBOX → **§2** ver dry-run → OK.
3. **Coord §A.4** flip de flags → E2E real (**Founder §3** atento al 401).
4. **Coord §B (5→6→7)** merge + migr 0139 + re-deploy `kommo-sync` → nombres de asesor (independiente de A).
