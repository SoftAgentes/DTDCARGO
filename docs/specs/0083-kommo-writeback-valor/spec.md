---
sdd: "0083"
title: "Write-back de valor a Kommo — outbox + value-sync (implementa SDD-0062 Slice A+B)"
status: in-progress
author: "Claude Code (ventana kommo-writeback) + founder"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0062", "0043", "0058", "0061", "0078"]
confidencialidad: interno
---

# DTD-0083 — Write-back de valor a Kommo (Slice A+B de SDD-0062)

> Las **primeras escrituras del ERP de vuelta a Kommo**. Apaga la ceguera del $0 que mostró el
> tablero (SDD-0078): cuando un estimado se envía/acepta, manda su `total_usd` al `price` del lead en
> Kommo. **Nace en dry-run** (`writeback_enabled=false`, `writeback_dry_run=true`): en prod solo
> registra el PATCH que haría. Riesgo cero hasta que el founder prenda el flag.

## Contexto

Hoy la integración Kommo↔ERP es inbound-only (espejo SDD-0043). El tablero (SDD-0078) probó que el
`price` de los leads en Kommo es **$0** en el 100% — el pipeline es inmedible *dentro* de Kommo,
aunque el ERP ya tiene el valor real (estimados `total_usd`). Este slice abre el canal de escritura,
con guardrails, para mandar ese valor al lead.

**Modelo de seguridad (SDD-0043, respetado):** el token de Kommo vive en Vault y SOLO lo lee una edge
function. Por eso el ERP (runtime Next) **solo encola** en una outbox; la **edge function `kommo-writeback`**
drena la cola, lee el token y hace el PATCH. El token nunca entra al runtime de la app.

**Guardrail 0107 (respetado):** la escritura NUNCA toca el espejo (`kommo_leads`). El flujo es
ERP → PATCH Kommo → webhook de Kommo → upsert del espejo con el `kommo_updated_at` autoritativo.

## Alcance (esta ventana)

### Slice A — Fundación del write-back (dry-run)
- **Migr 0136**: tabla `kommo_writeback_outbox` (`op` ∈ `patch_price|patch_stage|patch_lead`, `payload`
  jsonb, `idempotency_key` unique parcial entre pendientes, `status` ∈ `pending|sent|skipped|error`,
  `attempts`, `last_error`, `kommo_updated_at_at_enqueue`) + columnas `kommo_connections.writeback_enabled`
  (default false) / `writeback_dry_run` (default true) + RPCs security-definer (`enqueue/mark_sent/
  bump_attempt/mark_skipped`, `revoke execute from public, anon, authenticated` + grant service_role).
- **Edge function `kommo-writeback`** (clon del patrón de `kommo-push-client`): drena la outbox; dry-run →
  loguea el PATCH + `mark_skipped`; real (writeback_enabled && !dry_run) → `kommoWrite` PATCH
  `/api/v4/leads/{id}` → `mark_sent`. Reusa `kommoWrite` (429-only retry) + `resolveDryRun`.
- **`lib/studio/kommo-writeback.ts`**: `enqueueKommoWriteback()` (resuelve el lead vía
  `client_markbox → clients.kommo_lead_id`, arma el payload, llama el RPC; best-effort) + builder puro
  testeado. *(Plano, no carpeta — matchea los `kommo-*.ts` existentes.)*
- **Drain por pg_cron**: RPC `kommo_run_writeback_drain()` + `cron.schedule` **comentado** (coordinación
  lo prende tras deployar la edge function — evita crons fallando contra una función inexistente).

### Slice B — Value-sync (el hook)
- Hook en `transitionStatus()` (`app/studio/(app)/cotizador/actions.ts`, **al lado de `fireMailEvent`**):
  a `sent`/`accepted`, si el estimado tiene `client_markbox` con `kommo_lead_id` → `enqueueKommoWriteback(patch_price {price: total_usd})`. Hereda el gate dry-run.
- **Sin columna nueva en `quotes`**: el lead se resuelve por `client_markbox → clients.kommo_lead_id`
  (simplifica el `0115` que proponía SDD-0062 — un cruce, no una columna).

## Fuera de alcance (diferido)
- **`patch_stage`** (mapa etapa-Kommo ⇄ estado-estimado, open question #5 de SDD-0062) — la outbox lo
  soporta como `op`, pero el hook solo encola `patch_price`. Pendiente el mapa del founder.
- Activar el write real (flip `writeback_enabled`/`writeback_dry_run`) + deploy de la edge function +
  `cron.schedule` del drain + verificar scope de escritura del token (open question #4: un 401 lo revela).

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. tests del builder + enqueue).
- [ ] `pnpm build` (turbopack) verde.
- [ ] Migr 0136 queda como ARCHIVO (no aplicada a prod).
- [ ] Enviar/aceptar un estimado con lead vinculado encola un `patch_price` (verificable en la outbox);
      sin lead vinculado, no encola (best-effort, no rompe la transición).
- [ ] Cero escritura real a Kommo (dry-run por default) · NUNCA escribe el espejo · frontera intacta.

## Gates para coordinación / founder
- Aplicar migr 0136 a prod (skills Supabase + advisors). Deploy edge function `kommo-writeback`.
- Setear `kommo_cron_key` en Vault (si no está) + descomentar el `cron.schedule` del drain.
- E2E dry-run (ver el PATCH en `sync_logs`) → flip `writeback_enabled=true` + `writeback_dry_run=false`
  en `kommo_connections` → E2E real (un 401 revela si el token NO tiene scope de escritura, open q#4).
- Decidir el mapa de etapas para habilitar `patch_stage`.
