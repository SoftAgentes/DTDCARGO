# Runbook — Deploy + activación del write-back `kommo-writeback` (SDD-0083)

> Cómo poner en producción el write-back de valor ERP→Kommo **sin tocar tu Kommo real hasta estar
> seguro**: nace **apagado** (no escribe), se valida en **dry-run** (loguea el PATCH que haría) y recién
> después se prende. Lo ejecuta la **ventana de coordinación / el founder** (toca prod). La ventana de
> desarrollo NO deploya ni escribe en prod.

> ⚠️ **Nota del 2026-10-19 · producción ya no es Supabase Cloud ni Vercel.** Desde el corte del
> 2026-10-14 (02:00Z), la base, el Vault, pg_cron y las Edge Functions de Kommo viven en el Supabase del
> servidor propio (VPS de Contabo) y, desde el 2026-10-16, también la web; Vercel está en pausa. El
> proyecto de Cloud `xpfuzqombmjmxvprjgmi` que nombra este runbook es la copia del corte y se pausa el
> 2026-10-28: no lo uses para operar. En el servidor:
>
> - **Migraciones:** con [`aplicar-migraciones-prod.md`](aplicar-migraciones-prod.md) (psql en
>   `dtd-cargo-db-1`, OK nominal de Sam), nunca con `apply_migration` ni el editor SQL de Cloud.
> - **URL:** `https://supabase.dtdcargo.com/functions/v1/kommo-writeback`. La base la llama con el
>   secreto `functions_base_url` del Vault (migración 0472) y el job `kommo-writeback-drain-dtd` corre
>   en el pg_cron del servidor (activo al 2026-10-16, según
>   `.agents/handoffs/plan-retiro-vercel-supabase-20261016.md`).
> - **Código:** la carpeta `functions/` del servidor se arma desde `supabase/functions/` del repo
>   ([`infra/dtd-cargo/README.md`](../../infra/dtd-cargo/README.md) › Arrancar). Logs:
>   `docker logs dtd-cargo-functions-1`.
>
> Lo opera la sesión de Contabo con el OK de Sam: [`servidor-contabo.md`](servidor-contabo.md) §3.6. Lo
> de abajo queda como registro de cómo se hizo en Cloud.

## Qué es esto

Cuando un estimado pasa a `sent`/`accepted`, el ERP **encola** un `patch_price` (su `total_usd` → el
`price` del lead en Kommo) en la tabla `kommo_writeback_outbox`. La Edge Function `kommo-writeback`
drena la cola, abre el token de Kommo en Vault (solo ella puede) y hace el `PATCH /api/v4/leads/{id}`.
Apaga la ceguera del $0 que mostró el tablero (SDD-0078).

**Doble gate de seguridad (nace apagado):** la función escribe de verdad SOLO si
`kommo_connections.writeback_enabled = true` **AND** `writeback_dry_run = false`. Los defaults son
`false`/`true` → en cualquier otro caso es **dry-run** (loguea + marca la fila `skipped`). El guardrail
0107 garantiza que el write-back **nunca** escribe el espejo (`kommo_leads`); Kommo reespeja vía webhook.

## Prerrequisitos

- `kommo_connections` del tenant DTD `active` con el token vivo en Vault (la MISMA conexión del
  `kommo-sync` nocturno — si el sync anda, esto está OK).
- Rama `feat/kommo-writeback` mergeada + desplegada en Vercel (para que el cotizador encole). *(Merge/
  push los hace coordinación con OK del founder.)*

## Paso 1 — Aplicar la migración 0136

Aplicar `supabase/migrations/0136_kommo_writeback_outbox.sql` a prod (MCP `apply_migration` o SQL editor),
**corriendo antes los 2 skills Supabase + advisors**. Crea: la outbox, las columnas `writeback_enabled`/
`writeback_dry_run` (nacen `false`/`true`), las 5 RPCs (blindadas a service_role) y el `kommo_run_writeback_drain()`.
La tabla y las columnas nacen seguras (gate apagado) — aplicar la migración NO escribe nada a Kommo.

## Paso 2 — Deploy de la Edge Function (sigue sin escribir: gate apagado)

Deploy de `kommo-writeback` (carpeta `supabase/functions/kommo-writeback/`), `verify_jwt = OFF` (igual
que `kommo-sync`/`kommo-webhook`; la auth la hace la función exigiendo el service key del proyecto).
URL: `https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback`.
Como `writeback_enabled=false`, aunque corra solo logueará en dry-run.

## Paso 3 — Programar el drain (pg_cron)

1. Confirmar que `kommo_cron_key` está en Vault (lo usa también `kommo_run_sync`). Si no, setearlo.
2. **Descomentar** el `cron.schedule` al final de la migración 0136 y ejecutarlo (o correrlo suelto):
   ```sql
   select cron.schedule('kommo-writeback-drain-dtd', '*/15 * * * *', $job$select public.kommo_run_writeback_drain();$job$);
   ```
   *(Se dejó comentado a propósito: así el cron no falla contra una función no deployada. Recién acá, con
   la función ya arriba, se prende.)*

## Paso 4 — Validar en DRY-RUN (cero escritura en Kommo)

Objetivo: ver que el encolado y el drain funcionan, sin escribir nada.
- En el ERP, **enviá/aceptá un estimado de un cliente que tenga lead de Kommo vinculado**
  (`clients.kommo_lead_id` ≠ null). Eso encola una fila `pending` en `kommo_writeback_outbox`.
- Forzá el drain (o esperá al cron):
  ```bash
  curl -X POST https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" \
    -d '{"tenant_id":"<TENANT_ID>"}'
  ```
- Chequeá:
  - **Logs de la función:** línea `[kommo-writeback][dry-run] would PATCH lead <id> patch_price { price: … }`.
  - `kommo_writeback_outbox`: la fila pasó a `status='skipped'` (`last_error='dry-run'`).
  - `sync_logs`: `entity='writeback_dryrun'`, `status='ok'`.
- Confirmá que el `price` que loguea = `total_usd` del estimado redondeado. Si calza, el cableado está OK.

## Paso 5 — Prender la escritura real

En `kommo_connections` del tenant:
```sql
update public.kommo_connections
  set writeback_enabled = true, writeback_dry_run = false
  where tenant_id = '<TENANT_ID>';
```
(También se puede forzar un dry-run puntual mandando `{"dry_run":true}` en el body del drain, sin tocar
las columnas.)

## Paso 6 — E2E real con un estimado de PRUEBA (+ cleanup)

- Enviá/aceptá un estimado de prueba de un cliente con lead vinculado y un `total_usd` reconocible.
- Drená (curl o cron) y confirmá:
  - el **lead en Kommo** ahora muestra ese `price` (antes $0);
  - el **webhook de Kommo reespeja** el lead → `kommo_leads.price` se actualiza solo (NO lo escribe el
    write-back: guardrail 0107). Si el webhook no está activo, el espejo se pone al día en el sync diario;
  - `kommo_writeback_outbox`: `status='sent'`; `sync_logs`: `entity='writeback'`, `status='ok'`.
- **⚠️ Scope del token (open question #4 de SDD-0062):** si el PATCH devuelve **401**, el token de Vault
  es de solo-lectura → hay que regenerar uno con permiso de escritura en Kommo. El drain marca la fila
  con el error (`bump_attempt`) y reintenta hasta 5 veces; a la 5ª la deja en `status='error'`.
- **Limpieza:** revertí el `price` de prueba en Kommo si corresponde; soft-delete del estimado/cliente de
  prueba en el ERP si lo creaste para esto.

## Rollback

En cualquier momento, volver a dry-run sin tocar código:
```sql
update public.kommo_connections set writeback_dry_run = true where tenant_id = '<TENANT_ID>';
```
(o `writeback_enabled = false`). El cotizador sigue encolando, pero el drain deja de escribir. El hook es
best-effort: un fallo del write-back **nunca** rompe la transición del estimado.

## Notas

- **Observabilidad:** `sync_logs` (`writeback` real · `writeback_dryrun` ensayo) + `kommo_writeback_outbox`
  (estado por fila) + logs de la función.
- **Idempotencia:** 1 `patch_price` pendiente por lead (índice único parcial); re-encolar actualiza el
  payload (gana el último `total_usd`).
- **Diferido — `patch_stage`:** la outbox ya soporta `op='patch_stage'`, pero el hook solo encola
  `patch_price`. Falta el **mapa etapa-Kommo ⇄ estado-estimado** (decisión del founder, open q#5) para
  habilitarlo.
- **Seguridad:** el token nunca sale de la Edge Function (SDD-0043). Las RPCs son service_role-only.
