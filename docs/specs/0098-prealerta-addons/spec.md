---
sdd: "0098"
title: "Prealertas — menú de servicios de recepción (add-ons) + video-ayuda + regla antes-de-almacén"
status: in-progress
author: "Claude Code (ventana prealertas-ads) + founder"
created: 2026-06-20
updated: 2026-06-20
supersedes: null
superseded_by: null
related: ["0057", "0090", "0091", "0066", "0076"]
confidencialidad: interno
---

# SDD-0098 — Servicios de recepción ("ads") sobre la prealerta

> Al registrar (o desde el detalle de) su **compra/prealerta** (SDD-0057), el cliente puede pedir
> **servicios de valor agregado** sobre ella: Verificación, Inspección al recibir, Reempaque, Compactar,
> Etiquetado, Cotizar/medir, Hold. Cobro **advisory** (lo cotiza el asesor). Con **video-ayuda** y la
> regla **"pídelo antes de que llegue a la bodega"**.

## Contexto

Ingeniería inversa (autorizada, founder) del portal del courier Miami→VE **OneWayID/One Way Cargo**:
sus "pre-alertas" son un **menú de servicios** que el cliente declara sobre carga entrante, antes de
que llegue al almacén (form dinámico con video contextual + galería de shorts + consentimiento +
principio rector). Nuestras prealertas (`/portal/compras`, SDD-0057) capturaban la compra pero **no
dejaban pedir servicios sobre ella** — ese es el hueco.

**Decisión:** NO replicar su sistema de 7 tipos tipificados (choca con nuestro modelo de compra).
Tomar su **visión** — un menú configurable de servicios de recepción colgado a la prealerta — adaptado
a China→VE y marca DTD (copy propio, videos propios con personal propio, cobro advisory; **no se copian
sus textos ni se embeben sus videos**).

## Alcance (decidido con el founder)

- Menú de **7 servicios** seedeados, **todos activos** por default; `is_active` los prende/apaga por
  tenant sin deploy. La **Inspección de calidad al recibir** (técnica) es distinta del servicio externo
  `inspeccion-calidad` (en fábrica, SDD-0063/0076) — son dos.
- **Video-ayuda** (config-driven, `video_url` NULL hasta grabar los shorts): contextual al elegir el
  servicio + galería permanente. Placeholder "próximamente" cuando no hay video (nunca iframe roto).
- **Regla "antes de almacén":** aviso destacado + marca `timing='tardia'` (la fija el trigger en DB si
  la prealerta ya fue recibida — no forjable).
- **Lado operador = captura + aviso:** se guarda la solicitud + `fireWorkflowEvent('prealerta_servicio_
  solicitado')` avisa al equipo; el asesor cotiza/gestiona por fuera. Sin bandeja en Studio (futuro).

### Fuera de alcance
- Bandeja/gestión del operador en Studio. · Cobro real / fees fijos (advisory, sin montos inventados).
- Editor de la config (`prealerta_addons`) en Studio (hoy se togglea por SQL/MCP). · Auto-matching
  reempaque/hold ↔ múltiples prealertas (el cliente lista trackings; el asesor une).

## Diseño

### Migración 0150 (descrita, **NO aplicada** — la aplica coordinación)
`supabase/migrations/0150_prealerta_addons.sql` — aditiva, text+CHECK (sin enum nativo):
- **`prealerta_addons`** (catálogo configurable por tenant): code (CHECK 7), label, description,
  notas_placeholder, consent_text, video_url, multi_tracking, sort, is_active. Seedeado con los 7 (copy
  marca DTD, advisory, video NULL). RLS SELECT = equipo OR cliente del portal del tenant; write = equipo.
- **`prealerta_service_requests`** (solicitud del cliente sobre UNA prealerta): addon_code (CHECK 7),
  status (solicitada→en_proceso→atendida/descartada/invalida), timing (a_tiempo/tardia), trackings[],
  consent_accepted, notes, quoted_amount_usd, processed_by/at. RLS **doble** (espeja 0105): cliente CRUD
  de las suyas (markbox+tenant, INSERT exige consent=true); operador SELECT/UPDATE por tenant. **Trigger
  `prealerta_service_request_guard` (SECURITY INVOKER):** valida que `prealerta_id` es del mismo
  (tenant, markbox) y fija `timing` (defensa en DB, lección `feedback_polymorphic_table_db_validation`).
  Índice único parcial `(prealerta_id, addon_code) where deleted_at is null`.

### Código
- **`lib/studio/prealertas/addons.ts`:** los 7 DEFAULTS (== seed), tipos, validadores, `mergePrealertaAddons`
  (DB pisa, código respalda → cero pantalla vacía y funciona ANTES de la migración).
- **`lib/studio/prealertas/queries.ts`:** `listActivePrealertaAddons` + `listPrealertaServiceRequests`
  (fallback a defaults/[] ante error → no rompe en prod pre-migración).
- **`app/portal/(app)/proveedores/actions.ts`:** `createPrealertaAction` inserta los servicios elegidos
  (best-effort) + dispara el evento; nueva `requestPrealertaServiceAction` (desde el detalle).
- **UI portal:** picker + video + galería + aviso (`_components/PrealertaAddons.tsx`,
  `PrealertaServiceBadge.tsx`) en el form de alta y la galería en "Tus proveedores"; bloque de servicios +
  "pedir un servicio" en el detalle (`compras/[code]/etiquetas/ServiceSection.tsx`).
- **Tests:** `lib/studio/prealertas/__tests__/addons.test.ts` (merge, validadores, anti-drift código↔CHECK).

## Verificación
`node scripts/verify.mjs` VERDE + `pnpm build` (turbopack). La UI degrada a defaults de código (inserts
best-effort) → renderiza sin las tablas. E2E real (persistencia) requiere la migr 0150 aplicada.

## Para la coordinación
Aplicar 0150 a prod · merge `feat/prealertas-ads` → main. Founder: grabar shorts → cargar `video_url`;
togglear `is_active`; opcional step de flujo para `prealerta_servicio_solicitado`.
