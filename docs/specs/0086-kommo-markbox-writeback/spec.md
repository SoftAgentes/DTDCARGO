---
sdd: "0086"
title: "MARKBOX → Kommo al convertir (patch_lead) — cierra el loop lead↔cliente"
status: done
author: "Claude Code (ventana kommo-patch-stage) + founder"
created: 2026-06-14
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0084", "0083", "0062", "0058", "0078"]
confidencialidad: interno
---

# DTD-0086 — MARKBOX → Kommo al convertir (patch_lead)

> Cuando un lead de Kommo se convierte en cliente DTD (gana su MARKBOX / Shipping Mark), escribe ese
> MARKBOX en un campo del lead **en Kommo**, para que el asesor vea ahí que el lead ya es cliente. Cierra
> el loop lead↔cliente del lado de Kommo. Reusa la outbox + el gate dry-run de SDD-0083 (op `patch_lead`,
> ya soportada). **Nace apagado e inerte** hasta que el founder elija el campo + se prendan los flags.

## Contexto

El espejo (SDD-0043) trae el lead a la app, y SDD-0058 lo convierte en cliente (`clients.kommo_lead_id`
+ MARKBOX). Pero **Kommo no se entera**: el asesor sigue viendo el lead "crudo" sin saber que ya es
cliente DTD con su Shipping Mark. SDD-0083 abrió el canal de escritura (outbox + edge function
**op-agnóstica** + gate dry-run) y SDD-0084 agregó el `patch_stage`. Este slice agrega el `patch_lead`
que escribe el MARKBOX en un **custom field** del lead.

**Reusos (sin reinventar):** misma outbox `kommo_writeback_outbox` (`op='patch_lead'` ya está en el CHECK
de migr 0136), misma RPC blindada `enqueue_kommo_writeback`, mismo gate `writeback_enabled/writeback_dry_run`,
**misma edge function `kommo-writeback` SIN cambios** (manda `row.payload` tal cual → para `patch_lead` el
payload es `{custom_fields_values:[{field_id, values:[{value}]}]}`, un PATCH válido de `/api/v4/leads/{id}`).
Modelo de seguridad SDD-0043 (token solo en Vault) y guardrail 0107 (jamás escribe el espejo) intactos.

## Alcance (esta ventana)

### Dónde vive la config
- **Migr 0138**: columna `kommo_connections.markbox_field_id bigint` (nullable → metadata-only instantáneo).
  Es el id del custom field de **leads** en Kommo donde va el MARKBOX. `null` = inerte (no escribe nada).
  **Cero RLS/RPC/policy nuevos** (reusa la RLS de `kommo_connections`: authenticated SELECT, service_role ALL).

### La lógica
- **`lib/studio/kommo-writeback.ts`** (extiende): `buildMarkboxPatchPayload(fieldId, markbox)` (puro) +
  `enqueueKommoMarkboxWriteback(admin, tenant, {leadId, markbox})` (lee `markbox_field_id`; sin campo → no-op;
  encola `patch_lead`; **best-effort, nunca tira**) + `getKommoMarkboxFieldId(supabase)` (lectura RLS para UI).
- **`lib/studio/kommo-queries.ts`** (extiende): `listKommoLeadCustomFields` (campos de `entity_type='leads'`
  del espejo, para el dropdown). Tipo `KommoCustomFieldRow` en `kommo-types.ts`.

### El hook
- **`app/studio/(app)/kommo/actions.ts`** (`convertLeadToClientAction`): tras una conversión OK con MARKBOX,
  encola `enqueueKommoMarkboxWriteback({leadId, markbox})`. Best-effort: no rompe la conversión.

### La config (UI)
- **`MarkboxFieldConfig.tsx`** (nuevo, `"use client"`): un dropdown con los custom fields de leads + botón
  Guardar → `saveKommoMarkboxFieldAction`. Solo tokens `var(--*)` + clases del sistema + Badge.
- **`saveKommoMarkboxFieldAction`** (en `kommo/actions.ts`): **admin-only** (patrón `resolveAdminTenant`),
  valida que el campo exista como campo de leads en el espejo (RLS tenant), upsert `markbox_field_id` vía
  admin client (authenticated no tiene UPDATE en `kommo_connections` → no forjable).
- **`DireccionTab.tsx` + `page.tsx`**: card "MARKBOX en Kommo" bajo el mapa de etapas; `page.tsx` trae
  `listKommoLeadCustomFields` + `getKommoMarkboxFieldId` cuando `tab===direccion`.

## Fuera de alcance (diferido)
- Activar el write real (flip de flags) + deploy de la edge function — **igual que SDD-0083/0084** (mismo
  gate, misma edge function op-agnóstica): un solo deploy habilita valor + etapa + MARKBOX.
- Escribir OTROS campos del lead (valor, tier, teléfono) — la outbox soporta `patch_lead` genérico; este
  slice solo cablea el MARKBOX.
- Campos de tipo select (enum_id) — el builder asume un campo de texto (`{value}`); el dropdown muestra el tipo.

## Criterios de aceptación
- [ ] `node scripts/verify.mjs` verde (incl. tests de `buildMarkboxPatchPayload` + `enqueueKommoMarkboxWriteback`).
- [ ] `pnpm build` (turbopack) verde.
- [ ] Migr 0138 queda como ARCHIVO (no aplicada a prod).
- [ ] Con el campo configurado: convertir un lead → encola un `patch_lead` con el MARKBOX (verificable en la
      outbox). Sin campo configurado → no encola (inerte). La conversión nunca se rompe por el write-back.
- [ ] El guardado del campo es **admin-only** y valida contra el espejo (campo inexistente → error).
- [ ] Cero escritura real a Kommo (dry-run por default) · NUNCA escribe el espejo · frontera intacta.

## Gates para coordinación / founder
- Aplicar migr 0138 a prod (skills Supabase + advisors). **No** requiere deploy nuevo de edge function.
- **Founder:** elegir el campo MARKBOX en `/studio/kommo` → Dirección → "MARKBOX en Kommo" (idealmente un
  custom field de texto creado en Kommo para esto). Hasta entonces queda inerte.
- Flip de flags (`writeback_enabled=true` + `writeback_dry_run=false`) habilita el write real (valor + etapa + MARKBOX).
