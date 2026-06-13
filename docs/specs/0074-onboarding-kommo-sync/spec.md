---
sdd: "0074"
title: "Onboarding — sync del alta de cliente a Kommo (push del lead)"
status: in-progress
author: "Claude Code (session context) + founder"
created: 2026-06-13
updated: 2026-06-13
supersedes: null
superseded_by: null
related: ["0042","0043","0046","0058","0062"]
confidencialidad: interno
---

# DTD-0074 — Onboarding: sync del alta de cliente a Kommo (push del lead)

> Cierra el único hueco del "registro simple" del onboarding: cuando un cliente se da de alta en
> `/registro`, **empujar ese cliente a Kommo como lead/contacto**. El resto del onboarding base
> (auth, `clients`, Shipping Mark/MARKBOX) ya existe en producción (SDD-0042).

## Contexto

El handoff de onboarding (`HANDOFF_ONBOARDING_ERP.md`) pide "registro simple → Shipping Mark →
sync Kommo". Al mapear el repo, casi todo ya existe:

- **Auth + `clients` + `client_users`** → SDD-0042 (`/portal`, migr 0080-0081).
- **Shipping Mark `DTD-NNNN`** → RPC `next_markbox_service` → `clients.markbox`, ya invocado en
  `app/registro/actions.ts` (registro express, founder 2026-06-07).
- **Kommo** → SDD-0043 espeja Kommo read-only (pull, migr 0082) + SDD-0058 puente lead→cliente
  (`clients.kommo_lead_id`, migr 0108). Pero la integración es **inbound-only**: el alta de un
  cliente nuevo **NO se empuja** a Kommo.

Este spec añade ese push (outbound de creación), reutilizando el modelo de seguridad del token de
SDD-0043 (token solo en Vault, leído solo por la Edge Function vía `kommo_get_token`).

> **Relación con SDD-0062 (proposed, no construido):** SDD-0062 Slice A define un write-back más
> amplio (outbox `kommo_writeback_outbox` + Edge Function `kommo-writeback` que drena PATCHes de
> precio/etapa, con gate dry-run) y un helper `kommoWrite(baseUrl,token,path,method,body)`. Este
> spec **adelanta solo el helper `kommoWrite`** (misma convención) y un push de **creación** acotado
> al alta — un caso (`create_lead`) que el outbox de 0062 (patch_price/stage/lead) no cubre. Cuando
> 0062 Slice A aterrice, `kommo-push-client` puede migrar a encolar en el outbox; el helper ya queda.

## Objetivo

Que cada alta self-service en `/registro` aparezca en Kommo como **lead + contacto**, con dedup de
contacto por teléfono/email contra los ~2.683 contactos existentes, etiquetado con `markbox`/`tier`/
documento, y enlazado a `clients.kommo_lead_id` para trazabilidad CRM↔ERP. **Best-effort:** un fallo
en el push NUNCA rompe el alta (igual que los pasos email/notify ya existentes).

## Alcance

**DENTRO:**
- Helper `kommoWrite()` (POST/PATCH) en `kommo-sync/kommo-client.ts`, **sin tocar `kommoFetch`**.
- Builders puros `_shared/kommo-outbound.ts` + tests Vitest.
- Edge Function `kommo-push-client` (auth service-key, dedup, crear contacto/lead, enlazar).
- Paso 11 best-effort en `app/registro/actions.ts`.

**FUERA (no en este spec):**
- Outbox / retry / dry-run gate / write-back de PATCH (precio/etapa) → SDD-0062 Slice A.
- Verificación cédula→RIF y tags de "verificado" → SDD-0046 / fase 2 del onboarding.
- `/guia` y FAQ → specs aparte.

## Diseño

### 1. `kommoWrite()` — `supabase/functions/kommo-sync/kommo-client.ts`
Hermano de `kommoFetch` (que queda **intacto**: es el path GET probado en prod por el cron diario,
y `supabase/functions` está fuera del typecheck/lint del gate → no se toca lo que funciona). Espeja
la escalera retry/backoff/rate-limit (401→error, 429/5xx→backoff+reintento) para `method` POST/PATCH
con cuerpo JSON; devuelve el JSON parseado (o null en 204). *(La unificación de la escalera con
`kommoFetch` se hace cuando SDD-0062 Slice A construya el write-back completo.)*

### 2. Builders puros — `supabase/functions/_shared/kommo-outbound.ts`
TS puro (sin globals de Deno) → testeable con Vitest dentro de `node scripts/verify.mjs`, igual que
`_shared/kommo-mapping.ts`:
- `resolveFieldIds(customFieldsMirrorRows)` → mapa `markbox|rif|tier → field_id` (match por
  nombre/code, como el `getFieldValue` inverso). Campo no encontrado → se omite (graceful).
- `buildContactPayload(client)` → contacto Kommo con phone/email vía `field_code` PHONE/EMAIL.
- `buildLeadPayload(client, contactId, fieldIdMap)` → lead con `_embedded.contacts:[{id}]` +
  `custom_fields_values` solo de los campos resueltos.
- `matchContact(contacts, phone, email)` / `pickDedupQueries(client)` → dedup exacto por
  teléfono y luego email sobre el resultado de la búsqueda de Kommo.

### 3. Edge Function — `supabase/functions/kommo-push-client/index.ts`
Clon del patrón de auth de `kommo-sync/index.ts` (service-key en Authorization/apikey,
`verify_jwt=OFF`). Body `{ tenant_id, client_id }`. Flujo:
1. Resolver `kommo_connections` (active) + token (`kommo_get_token`).
2. Leer `clients` (name, email, phone, rif, markbox, doc_kind, tier, kommo_lead_id).
3. **Idempotente:** si `clients.kommo_lead_id` ≠ null → PATCH ese lead (refresca tags) y termina.
4. Cargar `kommo_custom_fields` (espejo) → `resolveFieldIds`.
5. Dedup: `GET /api/v4/contacts?query=<phone>` y luego `<email>` → `matchContact`. Match → reusar
   `contact_id`; si no → `POST /api/v4/contacts`.
6. `POST /api/v4/leads` con contacto enlazado + custom fields.
7. **Orden del FK:** `clients_kommo_lead_fk` (migr 0108) exige el lead en el espejo antes de
   enlazarlo → `upsert` del lead **autoritativo de la respuesta de Kommo** en `kommo_leads`
   (`mapLeadRow`), y recién entonces `update clients set kommo_lead_id`. *(Es dato autoritativo de
   Kommo, no fabricado → consistente con el guardrail 0107; el webhook/sync lo refresca idempotente.)*
8. `sync_logs` (entity `push_client`). Devuelve `{ lead_id, contact_id, mode: created|matched|patched }`.

### 4. Cableado — `app/registro/actions.ts`
Paso 11 best-effort tras `notifyNewClientToAdmin`: `admin.functions.invoke("kommo-push-client",
{ body: { tenant_id, client_id } })` en try/catch + `console.warn`. No bloquea ni cambia el `return`.

## Seguridad / PII
- El token de Kommo **solo** lo lee la Edge Function vía `kommo_get_token` (Vault, service_role) —
  nunca entra al runtime de Next.js/Vercel.
- La función exige el service-key del proyecto (igual que `kommo-sync`); no es invocable anónima.
- El documento (cédula/RIF) se envía a Kommo como dato del lead (es semi-público y el CRM ya maneja
  ese dato); no se loguea crudo.

## Idempotencia
- `clients.kommo_lead_id` ≠ null → PATCH (no recrea). Re-invocar el push del mismo cliente no
  duplica leads.
- El upsert al espejo `kommo_leads` es por PK `(tenant_id, id)`.

## Criterios de aceptación
- [ ] `kommoWrite` agregado sin modificar `kommoFetch` (callers GET intactos).
- [ ] Tests Vitest de `kommo-outbound` verdes en `node scripts/verify.mjs` (payloads, resolución de
      field_id, dedup, caso idempotente).
- [ ] El alta en `/registro` invoca `kommo-push-client` best-effort (un fallo NO rompe el alta).
- [ ] (E2E, coordinación) un alta real aparece como lead en Kommo y `clients.kommo_lead_id` queda set.

## Pendiente de coordinación (fuera de esta ventana)
- Deploy de la Edge Function `kommo-push-client` a prod.
- `kommo_connections` del tenant DTD `active` + token vivo en Vault.
- Push de `feat/onboarding-erp` + merge a main (deploy Vercel).
- E2E en vivo con un contacto de prueba (escribe en Kommo real + `clients` de prod).
- `/in` a `AGENTS.md` (SDD-0074).
