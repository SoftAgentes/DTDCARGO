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
- Outbox / retry / write-back de PATCH (precio/etapa) → SDD-0062 Slice A. *(El dry-run gate sí se construyó acá.)*
- Verificación cédula→RIF y tags de "verificado" → SDD-0046 / fase 2 del onboarding.
- `/guia` y FAQ → specs aparte.
- **Entitlements `tiene_carga`/`tiene_curso` + capas de acceso** (HANDOFF §3.1, agregado por el founder
  2026-06-13): controlan qué módulos ve el cliente en el portal (flag automático al contratar, **nunca
  manual**; 3 capas público/registrado/portal-por-servicio). → M3 `/guia` + portal por módulos;
  necesitará una **migración** (2 columnas bool en `clients`, hoy inexistentes). Fuente archivada en
  [`assets/HANDOFF_ONBOARDING_ERP.md`](./assets/HANDOFF_ONBOARDING_ERP.md).

## Diseño

### 1. `kommoWrite()` — `supabase/functions/kommo-sync/kommo-client.ts`
Hermano de `kommoFetch` (que queda **intacto**: es el path GET probado en prod por el cron diario,
y `supabase/functions` está fuera del typecheck/lint del gate → no se toca lo que funciona). Espeja
la escalera retry/backoff/rate-limit (401→error) para `method` POST/PATCH con cuerpo JSON; devuelve el
JSON parseado (o null en 204). **A diferencia de `kommoFetch` (GET), reintenta SOLO 429** (rate-limit =
no procesado, seguro); en **5xx NO reintenta** — un POST no es idempotente y reintentarlo duplicaría
(revisión 3-expertos SDD-0074). *(Unificación con `kommoFetch` → SDD-0062 Slice A.)*

### 2. Builders puros — `supabase/functions/_shared/kommo-outbound.ts`
TS puro (sin globals de Deno) → testeable con Vitest dentro de `node scripts/verify.mjs`, igual que
`_shared/kommo-mapping.ts`:
- `resolveLeadFields(rows)` → `markbox|rif|tier` con `{id, type, enums}` (match por nombre/code).
  Campo no hallado → se omite (graceful).
- `buildCfValue(meta, value)` → arma el custom field según su tipo: **SELECT** (con enums, p.ej.
  `tier`) → mapea a `enum_id` (match case-insensitive); si no hay opción equivalente → **omite**
  (mandar texto libre a un select da 400 y tumbaría el lead entero). **TEXT** → `{value}`.
- `buildContactPayload(client)` → contacto con phone/email vía `field_code` PHONE/EMAIL.
- `buildLeadPayload(client, fields)` → lead **sin** embeber contacto (solo nombre + custom fields).
  `buildContactLink(contactId)` → cuerpo de `POST /leads/{id}/link`.
- `matchContact` / `pickDedupQueries` → dedup exacto por teléfono (últimos 10 dígitos) y luego email.

### 3. Edge Function — `supabase/functions/kommo-push-client/index.ts`
Clon del patrón de auth de `kommo-sync/index.ts` (service-key en Authorization/apikey,
`verify_jwt=OFF`). Body `{ tenant_id, client_id }`. Flujo:
1. Resolver `kommo_connections` (active) + token (`kommo_get_token`).
2. Leer `clients` (name, email, phone, rif, markbox, doc_kind, tier, kommo_lead_id).
3. **Idempotente:** si `clients.kommo_lead_id` ≠ null → PATCH ese lead (refresca tags) y termina.
4. Cargar `kommo_custom_fields` (con `type`+`enums`) → `resolveLeadFields`.
5. Dedup: `GET /api/v4/contacts?query=<phone>` (limit 250, pausa entre queries) y luego `<email>` →
   `matchContact`. Match → reusar `contact_id`; si no → `POST /api/v4/contacts`.
6. `POST /api/v4/leads` (**sin** embeber contacto) → `POST /api/v4/leads/{id}/link` para enlazar el
   contacto (camino documentado; el `_embedded` en el create simple puede ignorarse en silencio o 400).
7. **Lead autoritativo + FK:** el create solo devuelve el `id` → `GET /api/v4/leads/{id}` y se mapea
   ESO (`mapLeadRow`) al espejo `kommo_leads` (satisface `clients_kommo_lead_fk`, migr 0108). Si el GET
   falla, stub id-only (el webhook/sync lo refresca). Recién entonces `update clients set kommo_lead_id`.
8. `sync_logs` (entity `push_client` · `push_client_dryrun` en ensayo). Devuelve
   `{ lead_id, contact_id, mode: created|matched|patched }`.

**Gate de escritura (dry-run, estilo SDD-0062 "nace apagado"):** la función **nace en dry-run** —
por default NO escribe en Kommo (resuelve campos, dedupea con GETs y arma los payloads, los loguea y
termina con `entity='push_client_dryrun'`). Escribe real solo con el secreto `KOMMO_PUSH_DRY_RUN="false"`;
el body `{dry_run:true}` puede FORZAR ensayo (nunca al revés). Decisión vía helper puro `resolveDryRun()`
(testeado). Así la 1ª validación E2E no toca los contactos reales. Procedimiento: `docs/runbooks/deploy-kommo-push-client.md`.

### 4. Cableado — `app/registro/actions.ts`
Paso 11 tras `notifyNewClientToAdmin`: **fire-and-forget con `after()` de `next/server`** →
`admin.functions.invoke("kommo-push-client", …)` corre DESPUÉS de responderle al cliente, para NO
meterle la latencia de Kommo (cold start + round-trips + backoff) a la inscripción (revisión
3-expertos). try/catch + `console.warn`; un fallo nunca afecta el alta.

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
- [ ] La función nace en dry-run (no escribe hasta `KOMMO_PUSH_DRY_RUN=false`) → validable sin tocar Kommo real.
- [ ] (E2E, coordinación) un alta real aparece como lead en Kommo y `clients.kommo_lead_id` queda set.

## Pendiente de coordinación (fuera de esta ventana)
- Deploy de la Edge Function `kommo-push-client` a prod (nace en dry-run). Validar en dry-run → flip
  `KOMMO_PUSH_DRY_RUN=false` → E2E real con contacto de prueba. **Runbook:** `docs/runbooks/deploy-kommo-push-client.md`.
- `kommo_connections` del tenant DTD `active` + token vivo en Vault.
- Push de `feat/onboarding-erp` + merge a main (deploy Vercel).
- E2E en vivo con un contacto de prueba (escribe en Kommo real + `clients` de prod).
- `/in` a `AGENTS.md` (SDD-0074).
