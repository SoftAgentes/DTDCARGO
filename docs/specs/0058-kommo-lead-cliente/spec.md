---
sdd: "0058"
title: "Kommo lead → cliente — puente CRM↔ERP (convertir un lead del espejo Kommo en cliente DTD con MARKBOX)"
status: done
author: "Claude Code (carril Kommo · continuación SDD-0043)"
created: 2026-06-04
updated: 2026-06-05
supersedes: null
superseded_by: null
related: ["0043", "0010", "0046", "0042"]
confidencialidad: interno
---

# DTD-0058 — Kommo lead → cliente (puente CRM↔ERP)

> Cierra el gap que dejó **SDD-0043**: el espejo Kommo (`kommo_leads`) y los clientes del
> ERP (`clients`) están **totalmente desconectados** — un lead del CRM nunca se vuelve
> cliente DTD. Esta spec entrega el **puente lead → cliente**: una acción "Convertir a
> cliente" en `/studio/kommo` que crea el `clients` con MARKBOX y guarda el `kommo_lead_id`
> para trazabilidad. **Esto es "conectar el CRM" con valor operativo real.**

## 1. Resumen en una línea

Botón "Convertir a cliente" sobre un lead del espejo Kommo → crea (o reusa) un `clients`
con MARKBOX autogenerado + link `kommo_lead_id`, idempotente por lead.

## 2. Por qué (grounding)

- **Hueco (SDD-0043 §fuera-de-scope):** "Mapeo Kommo → entidades de negocio del ERP
  (cliente/envío/contenedor)" quedó explícitamente diferido. Hoy `clients` no tiene ningún
  `kommo_lead_id` ni FK; la pantalla `/studio/kommo` es 100% read-only.
- **El valor del conector:** sin este puente, Kommo solo espeja datos muertos. Con él, un
  asesor convierte un lead calificado en cliente real (MARKBOX) de un click, con trazabilidad
  de vuelta al CRM. Es el primer flujo *accionable* del módulo Kommo.
- **Reuse:** `next_markbox` (0006), el patrón de server action del Studio, `clients` (0010).

## 3. Decisiones ancladas

1. **Slice A = solo nombre + MARKBOX + link.** El email/teléfono del lead **NO** se prefillan
   en V1: en Kommo viven en el *contacto* (`kommo_contacts.custom_fields`), no en el lead, y el
   mirror **no guarda el link lead↔contacto** (haría falta tocar el sync/schema). Prefill de
   contacto = **Slice B** (gated por ese link). El asesor completa los datos en Clientes.
2. **Idempotente por lead.** Un `kommo_lead_id` mapea a **un** cliente como máximo (índice único
   parcial por tenant). Convertir un lead ya convertido = no-op que devuelve el MARKBOX existente.
3. **Sin dedup por documento.** Los leads no traen RIF/cédula confiable (son pre-venta), así que
   NO se cruza contra el dedup-por-RIF del registro (SDD-0046). El asesor maneja un eventual
   duplicado real desde Clientes (que sí tiene dedup por RIF). El único guard acá es por lead.
4. **El cliente nace SIN portal.** Convertir crea el `clients` operativo (para cotizar/embarcar),
   **no** una cuenta de portal — eso sigue siendo el flujo de invitación/self-registro (SDD-0042).
   `portal_approved_at` queda null (consistente con un cliente recién creado).
5. **`registration_channel = 'kommo'`** (la columna ya existe, 0091) → trazabilidad del origen.
6. **Sin tocar Kommo (inbound-only).** No se escribe nada de vuelta a Kommo (sigue fuera de scope
   de 0043). El link es unidireccional `clients.kommo_lead_id → kommo_leads.id`.

## 4. Approach — Slice A

### Migración `0108_clients_kommo_lead.sql` (aditiva, sin DDL destructivo)
- `alter table clients add column if not exists kommo_lead_id bigint;`
- **FK compuesta** `(tenant_id, kommo_lead_id) references kommo_leads(tenant_id, id) on delete set null`
  — si un lead se borra del espejo (webhook delete), el cliente sobrevive y pierde solo el link.
  *(Verificar que `kommo_leads` tenga PK/unique `(tenant_id, id)`; si no, omitir la FK y dejar solo
  la columna + índice.)*
- **Índice único parcial** `clients_kommo_lead_unique on clients (tenant_id, kommo_lead_id)
  where kommo_lead_id is not null and deleted_at is null` — un lead → un cliente vivo.

### `lib/studio/kommo-queries.ts` (extender, sigue puro)
- `listConvertedLeadIds(supabase, leadIds)` → `Map<number, string>` (kommo_lead_id → markbox)
  para los leads visibles: `select kommo_lead_id, markbox from clients where kommo_lead_id in (...)
  and deleted_at is null`. RLS por tenant. Permite marcar cada row como "Convertir" vs "ya es cliente".

### `lib/studio/kommo-types.ts` (extender)
- `KommoLeadRow` gana un campo derivado opcional `clientMarkbox?: string | null` (lo arma el page
  cruzando con `listConvertedLeadIds`), o se pasa el `Map` aparte al client. (Decisión de impl:
  pasar el map; no recalcular en el cliente.)

### `app/studio/(app)/kommo/actions.ts` (NUEVO · "use server")
- `convertLeadToClientAction(leadId: number): Promise<{ ok?: true; markbox?: string; created?: boolean; error?: string }>`
  1. `createClient()` + resolver `tenant_id` desde `user_tenants` (patrón estándar; sin tenant → error).
  2. **Guard idempotente:** `clients` where `kommo_lead_id = leadId` y `deleted_at null` → si existe,
     return `{ ok, markbox, created: false }`.
  3. Cargar el lead: `kommo_leads` where `id = leadId` (RLS por tenant) → `name`. Sin lead → error.
  4. `rpc('next_markbox', { p_tenant_id })`.
  5. `insert clients { tenant_id, markbox, name: lead.name ?? 'Lead Kommo <id>', kommo_lead_id: leadId,
     tier: 'regular', registration_channel: 'kommo' }`. Si choca el índice único (race) → re-leer y
     devolver el existente (no romper).
  6. `revalidatePath('/studio/kommo')` → return `{ ok, markbox, created: true }`.

### UI — `app/studio/(app)/kommo/_components/KommoClient.tsx` (extender)
- `page.tsx` pasa el `Map<leadId, markbox>` (de `listConvertedLeadIds` sobre los leads listados).
- En cada row de lead: si ya es cliente → **Badge "DTD-XXXX"** (link a `/studio/clientes/<markbox>`);
  si no → **`<ActionButton variant="dark" size="xs">` "Convertir a cliente"** (acción con side-effect →
  ActionButton, regla del Studio). Anti-doble-submit incluido.
- **Trazabilidad (regla Studio):** al convertir, `toast.success("Cliente DTD-XXXX creado desde el lead
  · Ver en Clientes")` con link a `/studio/clientes/<markbox>?highlight=...&hl-tone=warm`. La row queda
  con el badge (rastro visible). No navegamos automático (el asesor sigue en Kommo).
- Solo tokens `var(--*)` + primitivas del sistema.

### Tests Vitest
- `lib/studio/__tests__/kommo-convert.test.ts` (o extender el de kommo): con stub `SupabaseClient`,
  asserta: (a) lead ya convertido → devuelve markbox sin insertar; (b) lead nuevo → next_markbox +
  insert con `kommo_lead_id`/`registration_channel='kommo'`; (c) `listConvertedLeadIds` arma el map por
  `kommo_lead_id`. Gate verde.

## 5. Acceptance

### Slice A
- [ ] Migración `0108` aditiva: `clients.kommo_lead_id` + índice único parcial (+ FK si el schema lo permite).
- [ ] `/studio/kommo`: cada lead muestra **"Convertir a cliente"** (si no convertido) o **Badge MARKBOX**
      con link a Clientes (si ya convertido).
- [ ] Convertir crea `clients` con MARKBOX (`next_markbox`) + `kommo_lead_id` + `registration_channel='kommo'`;
      **idempotente** (segundo intento devuelve el mismo MARKBOX, no duplica).
- [ ] Toast de trazabilidad con link a `/studio/clientes/<markbox>`; la row queda con el badge.
- [ ] `node scripts/verify.mjs` 🟢. `ui-ux-designer` OK. Migración la aplica el founder (no el harness).

## 6. Fuera de alcance (respetar)

- **Prefill de email/teléfono/dirección desde el contacto de Kommo** → Slice B (necesita mirrorear el
  link lead↔contacto en el sync — toca SDD-0043). No fabricar datos de contacto.
- **Crear cuenta de portal** para el cliente convertido → es el flujo de SDD-0042 (invitación/self-registro).
- **Escribir de vuelta a Kommo** (marcar el lead como "convertido", mover de etapa) → outbound, fuera de 0043.
- **Auto-conversión** (trigger/webhook que crea clientes solo) → V1 es **manual** (el asesor decide qué lead
  es cliente real; evita basura, regla founder de validación de identidad).
- **Dedup por nombre** (riesgoso) → solo guard por `kommo_lead_id`.

## 7. Notas de implementación

### Slice A — implementado (2026-06-05, directo + gate + ui-ux)

**Archivos:**
- `supabase/migrations/0108_clients_kommo_lead.sql` — aditiva: `clients.kommo_lead_id bigint` + FK compuesta
  `(tenant_id, kommo_lead_id) → kommo_leads(tenant_id, id) on delete set null` (verificado: PK de `kommo_leads`
  ES `(tenant_id, id)`, migr 0082) + índice único parcial `clients_kommo_lead_unique`. **NO aplicada a prod**
  (la aplica el founder por MCP).
- `lib/studio/kommo-convert.ts` (puro, server-safe): `convertLead(supabase, tenantId, leadId)` (idempotente por
  lead, reusa `next_markbox`, inserta cliente operativo `tier='regular'` + `registration_channel='kommo'`, maneja el
  race del índice único) + `listConvertedLeadIds(supabase, leadIds)` → `Record<leadId, markbox>`.
- `app/studio/(app)/kommo/actions.ts` (NUEVO, `"use server"`): `convertLeadToClientAction(leadId)` resuelve el
  tenant desde `user_tenants` + delega en `convertLead` + `revalidatePath`.
- `app/studio/(app)/kommo/page.tsx` — agrega `listConvertedLeadIds` sobre los leads listados → pasa el map a la UI.
- `app/studio/(app)/kommo/_components/KommoClient.tsx` — tabla de leads pasa de 4 a 5 columnas (nueva "Cliente DTD").
  La fila dejó de ser un `<a>` envolvente (anti-patrón: `<a>` con `ActionButton` adentro = HTML inválido) → ahora es
  `div` grid; el **nombre** es el link a Kommo. 5ª columna: `<ActionButton variant="dark" size="sm">` "Convertir a
  cliente" o `<Badge tone="success">` con el MARKBOX (link a `/studio/clientes/<markbox>`) si ya convertido. Estado
  optimista + `toast.success(... "Ver en Clientes")` (trazabilidad sin navegar). `successLabel={null}` (el rastro es
  el Badge persistente).
- `app/studio/studio.css` — `.studio-link-quiet` (link discreto subraya al hover) + `.studio-row-hover` (feedback de
  posición en tabla densa, sin cursor pointer). Fixes del ui-ux review.
- Tests: `lib/studio/__tests__/kommo-convert.test.ts` (7 casos: idempotencia, insert con `kommo_lead_id`/canal,
  fallback de nombre, lead inexistente, leadId inválido, `listConvertedLeadIds` map + vacío). Gate verde (1233 tests).

**ui-ux-designer:** OK. Fixes aplicados: affordance del nombre-link (`.studio-link-quiet`), botón `xs`→`sm` (regla 2:
tablas usan `sm`), hover de fila sutil, comentario del merge optimista monotónico. Nits Low diferidos (fmtDate con año,
icono externo en el nombre).

**Pendiente:** founder aplica `0108` a prod.

### Slice B — implementado (2026-06-05, approach "picker manual" · sin infra)

> **Decisión founder 2026-06-05:** en vez de mirrorear el link lead↔contacto (que tocaba las Edge Functions de
> SDD-0043 + re-sync), el asesor **elige el contacto** en un drawer. Funciona sobre los datos ya espejados, **sin
> migración ni cambio de Edge Functions**.

**Hallazgo de datos (verificado en prod vía MCP):** el **email/teléfono viven SOLO en el contacto**
(`kommo_contacts.custom_fields`, códigos `EMAIL`/`PHONE`, type multitext); los **leads NO traen datos de contacto**
(sus custom_fields son tracking/UTM/finanzas; solo 30/2.659 tienen alguno) y su **nombre suele ser inútil**
("Lead #NNNN" — el nombre real está en el contacto). **Kommo NO tiene dirección** (campos de contacto =
Email/Teléfono/Posición/T&C) → la dirección sigue manual en Clientes. El espejo **no guarda el link lead↔contacto**
→ por eso el match lo hace la persona.

**Archivos:**
- `lib/studio/kommo-convert.ts` — `parseContactFields(custom_fields)` (extrae email+teléfono del primer valor de cada
  code, tolera formas raras) + `searchKommoContacts(supabase, q)` (ilike por nombre, email/teléfono parseados, RLS por
  tenant) + `convertLead` ahora acepta `prefill?: {name,email,phone}` (el nombre del contacto gana sobre el del lead;
  email/teléfono solo si vienen).
- `app/studio/(app)/kommo/actions.ts` — `searchKommoContactsAction(q)` + `convertLeadToClientAction(leadId, prefill?)`.
- `app/studio/(app)/kommo/_components/ConvertLeadDrawer.tsx` (NUEVO) — `DrawerShell` + búsqueda server-side debounced
  (guard de race con `reqId`, carga inicial inmediata) + lista de contactos seleccionables (`aria-pressed`, borde wine
  + Badge "Elegido") + **un solo botón contextual** ("Convertir con <contacto>" / "Convertir sin contacto", fix ui-ux).
- `KommoClient.tsx` — el botón de la row ahora abre el drawer (acción no mutante → botón plano); el convert real lo
  dispara el drawer; el `onConverted` del padre cierra el drawer + actualiza el Badge + dispara el toast.
- `studio.css` — `.kommo-contact-pick:hover/:focus-visible` (affordance + fix AA 2.4.7; el borde/fondo inline ganan,
  por eso hover=box-shadow y focus=outline).
- Tests: +7 en `kommo-convert.test.ts` (parseContactFields casos borde, searchKommoContacts mapeo, convertLead con
  prefill — el nombre del contacto gana + email/phone en el insert). Gate verde (1240 tests). `ui-ux-designer` OK
  (fixes aplicados: 1 botón contextual + focus-visible).

**Sin migración, sin cambio de Edge Functions, sin re-sync.** El "approach A" (mirrorear el link automáticamente)
queda como mejora futura si se quiere quitar el paso manual.
