---
sdd: "0084"
title: "Mapa de etapas + write-back de etapa a Kommo (cierra SDD-0062 Slice B)"
status: in-progress
author: "Claude Code (ventana kommo-patch-stage) + founder"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0083", "0062", "0078", "0043", "0058"]
confidencialidad: interno
---

# DTD-0084 — Mapa de etapas + write-back de etapa a Kommo (Slice B de SDD-0062)

> Cierra el `patch_stage` que SDD-0083 dejó diferido (open question #5 del founder). Cuando un estimado
> cambia de estado (enviado / aceptado / rechazado), mueve el lead de Kommo a la **etapa** que el founder
> mapeó — no solo el valor. El mapa lo configura el founder en `/studio/kommo` (pestaña Dirección). **Nace
> apagado**: reusa el MISMO gate dry-run de SDD-0083 (`writeback_enabled=false`, `writeback_dry_run=true`)
> y queda **inerte hasta que el founder configure el mapa**. Riesgo cero.

## Contexto

SDD-0083 abrió el canal de escritura ERP→Kommo y mandó el **valor** (`patch_price`), pero dejó el
`patch_stage` afuera porque faltaba el mapa etapa-Kommo ⇄ estado-estimado. La outbox (migr 0136) ya
**soporta `patch_stage` como `op`**, la edge function `kommo-writeback` ya manda `row.payload` tal cual
en el PATCH `/api/v4/leads/{id}` (es **op-agnóstica**), y el gate dry-run ya existe. O sea: el cableado
de escritura ya está; lo único que falta es **dónde vive el mapa** y **la lógica de encolar la etapa**.

**Reusos (sin reinventar):** misma outbox + RPC `enqueue_kommo_writeback` (ya blindada en 0136) + mismo
gate (`writeback_enabled`/`writeback_dry_run`) + misma edge function (**sin cambios**). Mismo modelo de
seguridad SDD-0043 (token solo en Vault, el ERP solo encola) y guardrail 0107 (jamás se escribe el espejo).

## Alcance (esta ventana)

### Dónde vive el mapa
- **Migr 0137**: columna `kommo_connections.stage_map jsonb not null default '{}'::jsonb` (default
  constante → **metadata-only**, sin reescritura). Forma:
  `{ "sent": {"pipeline_id":N,"status_id":N}, "accepted": {...}, "rejected": {...} }` (solo estados
  configurados). **Cero RLS/RPC/policy nuevos**: `kommo_connections` ya tiene RLS (authenticated SELECT
  por tenant + service_role ALL). authenticated **lee** el mapa (UI) pero **NO** puede escribirlo (no hay
  grant UPDATE) → el guardado va por server action con admin client = **no forjable vía PostgREST**.

### La lógica
- **`lib/studio/kommo-writeback.ts`** (extiende): `buildStagePatchPayload(target)→{status_id,pipeline_id}`
  (puro) + `normalizeStageMap(raw)` (puro, valida forma) + `enqueueKommoStageWriteback(admin,tenant,{clientMarkbox,estimateStatus})`
  (lee `stage_map[estimateStatus]`; si no está mapeado → no-op; resuelve lead por `markbox→kommo_lead_id`;
  encola `patch_stage`; **best-effort, nunca tira**) + `getKommoStageMap(supabase)` (lectura RLS para la UI).
- **`lib/studio/kommo-types.ts`** (extiende): `EstimateStageKey` (`sent|accepted|rejected`) +
  `ESTIMATE_STAGE_KEYS` + `ESTIMATE_STAGE_LABELS` + `KommoStageTarget` + `KommoStageMap`.

### El hook
- **`app/studio/(app)/cotizador/actions.ts`** (`transitionStatus`): tras el update, encola
  `enqueueKommoStageWriteback` en las **3** transiciones (sent/accepted/**rejected**). Incluir `rejected`
  → etapa de perdido es lo que **limpia el cementerio** (SDD-0078). Hereda el gate dry-run.

### La config (UI)
- **`StageMapConfig.tsx`** (nuevo, `"use client"`): 3 filas (enviado/aceptado/rechazado), cada una con
  select de embudo (`kommo_pipelines`) + select de etapa (`kommo_statuses` filtrada por embudo) + "sin
  mapear". Botón "Guardar" → `saveKommoStageMapAction`. Solo tokens `var(--*)`, componentes del sistema.
- **`saveKommoStageMapAction`** (en `kommo/actions.ts`): **admin-only** (patrón `resolveAdminTenant`),
  valida que cada `(pipeline_id,status_id)` exista en el espejo (`kommo_statuses`, RLS tenant), upsert vía
  admin client en `kommo_connections.stage_map`.
- **`DireccionTab.tsx` + `page.tsx`**: render del card de mapa bajo el panel de write-back; `page.tsx`
  trae `getKommoStageMap` + el rol del viewer (canEdit) cuando `tab===direccion` (pipelines/statuses ya se traen).

## Fuera de alcance (diferido)
- Activar el write real (flip de flags) + deploy de la edge function `kommo-writeback` + `cron.schedule`
  del drain → **igual que SDD-0083** (mismo gate, misma edge function): un solo deploy habilita valor Y etapa.
- `patch_lead` (otros campos del lead) — la outbox lo soporta como `op`; sin hook todavía.
- Espejar `kommo_users` (nombres de asesor) — otra ventana / follow-up.

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. tests de `buildStagePatchPayload` + `normalizeStageMap` + `enqueueKommoStageWriteback`).
- [ ] `pnpm build` (turbopack) verde.
- [ ] Migr 0137 queda como ARCHIVO (no aplicada a prod).
- [ ] Con el mapa configurado: enviar/aceptar/rechazar un estimado con lead vinculado encola un
      `patch_stage` con `{status_id,pipeline_id}` (verificable en la outbox). Sin mapa o sin lead → no encola.
- [ ] El guardado del mapa es **admin-only** y valida contra el espejo (etapa inexistente → error).
- [ ] Cero escritura real a Kommo (dry-run por default) · NUNCA escribe el espejo · frontera pública↔ERP intacta.

## Gates para coordinación / founder
- Aplicar migr 0137 a prod (skills Supabase + advisors). **No** requiere deploy nuevo de edge function
  (la `kommo-writeback` es op-agnóstica) — pero sí depende de que esa edge function se deploye (gate
  heredado de SDD-0083).
- **Founder:** configurar el mapa en `/studio/kommo` → Dirección → "Mapa de etapas" (elegir embudo+etapa
  para enviado/aceptado/rechazado). Hasta entonces el `patch_stage` queda inerte (no encola nada).
- Flip de flags (`writeback_enabled=true` + `writeback_dry_run=false`) habilita el write real de valor Y etapa.
