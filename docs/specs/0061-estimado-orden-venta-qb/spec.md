---
sdd: "0061"
title: "Estimado → Orden de venta (modelo QuickBooks): retira 'cotización', captura el estimado web en el ERP y lo vincula al registro del cliente"
status: done
author: "Claude Code (carril comercial · sesión con founder 2026-06-07)"
created: 2026-06-07
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0001", "0002", "0011", "0021", "0040", "0041", "0044", "0042", "0046", "0057", "0058", "0010", "0055"]
confidencialidad: interno
---

# DTD-0061 — Estimado → Orden de venta (modelo QuickBooks)

> **Nota de numeración (2026-06-07):** renumerado de **0059 → 0061**. El 0059 colisionaba con `0059-financiero-china` y el 0060 con `0060-documentos-versionado` (ambos en `feat/brochure`, sin mergear), más `0059-registro-correos-aviso` en `feat/registro-correos`. 0061 verificado libre en las 4 ramas/worktrees. Migraciones de este SDD usan **0113+** (0110-0112 ya tomadas en otras ramas).

> Alinea el ERP al **flujo documental de QuickBooks** y **retira la palabra "cotización" de todo el sistema**:
> el documento provisional se llama **Estimado** (ex-"cotizador"), el confirmado **Orden de venta** (nuevo).
> Además cierra el hueco del embudo SEO: hoy la estimación web es **efímera** (solo sobrevive si el cliente
> toca WhatsApp) y no hay puente al registro ni al ERP. Esta spec captura el estimado web en el ERP (con
> **nota + contacto**), lo **vincula al registro del cliente por número de estimado**, y deja el modelo
> contable QB (Estimado → Orden de venta → Factura · Orden de compra → Bill) como norte.

## 1. Resumen en una línea

El cliente estima en la web → se crea un **Estimado** en el ERP (con nota, nombre, teléfono, código `EST-XXXX`) que el asesor cierra con datos reales tras el registro del cliente, convirtiéndolo en **Orden de venta**; y "cotización" desaparece del vocabulario (público + ERP).

## 2. Por qué (grounding · verificado en código)

- **El embudo de alta intención se pierde.** `app/cotizar/` y `components/CotizarForm.tsx` son **mock**
  (`DTD-LEAD-XXXX` efímero, comentario `// MOCK ... cuando el ERP exponga POST /api/public/cotizar y /leads`);
  `/calculadora` solo hace handoff a WhatsApp. **Cero persistencia.** No hay CTA de las calculadoras al registro.
- **El registro ya existe pero está desconectado.** `app/portal/(auth)/registro/` crea `clients` + MARKBOX
  (`next_markbox`, cuenta PENDIENTE, gate por aprobación o primera carga). Nadie lo enlaza desde la estimación.
- **El correo de "enviado" ya existe.** `app/studio/(app)/cotizador/actions.ts` dispara `quote_sent`/`quote_accepted`
  vía `fireMailEvent` (Resend, vivo en prod) en las transiciones `draft→sent`/`sent→accepted`.
- **Confusión de nombres.** `/cotizar` (form internacional China→VE que capta contacto) ≠ `/calculadora`
  (LCL marítima) ≠ la calculadora terrestre del último km (`UltimoKmCalculator`, **embebida** dentro de `/cotizar`,
  único uso). El nombre "cotizar" choca con la cotización formal → el founder quiere reservar el concepto.
- **El modelo QB ya tiene casi todas las piezas:** `facturacion` (0021), `contabilidad` (0040), `cobranzas` (0041),
  `tesoreria` (0044, con **Bill** real: `lib/studio/treasury/bill-queries.ts`, `BillDrawer`, `supplier-payment-posting`),
  `proveedores` (0057, **prealertas** = compras del cliente a sus proveedores). Faltan: **Orden de venta** y **OC de DTD**.
- **Reuse del linkeo:** `clients.kommo_lead_id` (SDD-0058) es el patrón para atar un documento externo a un cliente.

> Plan estratégico completo aprobado por el founder: ver `.claude/plans/title-flujo-de-registro-mossy-dongarra.md`.

## 3. Decisiones ancladas (definidas con el founder)

1. **"Cotización" se retira en TODO el sistema** (público + ERP). Vocabulario nuevo:
   - **Estimado** = documento provisional (web o manual). Es el módulo ex-`cotizador` renombrado. QB = *Estimate*.
   - **Orden de venta** = el estimado confirmado, con datos reales. **Entidad nueva**. QB = *Sales Order*.
2. **Renombres de calculadoras públicas:** `/cotizar` → **`/estimacion`** (con **301 permanente**); la calculadora
   terrestre sale a página propia **`/calculadora-terrestre`** con **enlace contextual** desde `/estimacion`;
   `/calculadora` (LCL) sin cambios.
3. **Nota + contacto al estimar:** al oprimir el botón de estimar en **cualquier** calculadora aparece un modal
   *"¿Querés agregar una nota extra?"* (ej: "Tengo la mercancía lista") **+ nombre + teléfono**. En `/calculadora`
   (hoy sin contacto) el modal pide los tres; en `/estimacion` ya hay contacto → se suma solo la nota.
4. **Botón de doble acción:** un clic "Enviar por WhatsApp" hace **dos cosas** — (a) `POST /api/public/estimacion`
   crea el Estimado en el ERP (datos + nota + nombre + teléfono + `EST-XXXX`), y (b) abre `wa.me` con el mensaje
   (incluye nota + datos + `EST-XXXX`). El estimado queda en el ERP **aunque el cliente no llegue a enviar el WhatsApp**.
5. **Cruce WhatsApp ↔ ERP:** por código `EST-XXXX` + teléfono, **y** cruce con el lead de Kommo por teléfono
   (reusa el conector inbound; evita bandeja duplicada).
6. **Vínculo Estimado ↔ registro de cliente (llave = `EST-XXXX`):**
   - Automático (camino feliz): el CTA "Registrate…" lleva `/portal/registro?est=EST-XXXX`; al registrarse el cliente
     queda atado al estimado (se puebla `client_markbox`).
   - **Automático por datos:** si **teléfono + email calzan exacto** entre estimado y registro, se vincula solo.
   - Búsqueda manual (red de seguridad): el asesor busca por `EST-XXXX` en el ERP y vincula a mano si el match es ambiguo.
7. **CTA de registro = opcional** (junto a WhatsApp, no gatea el precio). Filosofía de baja fricción.
8. **Conversión con comparación:** al cerrar, el sistema **compara** datos provisionales (estimado) vs reales (registro)
   antes de convertir Estimado → Orden de venta.
9. **Modelo QB completo = futuro** ("cuando lleguemos a esa etapa"): Estimado → Orden de venta → Factura · Estimado →
   Factura (directo) · Estimado → Orden de compra (DTD) → Bill. **Órdenes de compra** = módulo con 2 sub-tipos:
   *OC de cliente* (= prealertas, 0057) y *OC de DTD* (nueva, agente de compra → genera el Bill de Tesorería).
10. **Frontera público↔ERP intacta:** el form público NO importa Supabase; persiste vía route handler server-side
    con admin client (patrón portal/kommo).
11. **No romper datos.** El rename es de vocabulario/UI + códigos nuevos (`Q-` → `EST-`); los `quotes` existentes
    sobreviven (no DDL destructivo).

## 4. Mapa QuickBooks → DTD

```
VENTAS (cliente)
  Estimate      → ESTIMADO (ex-cotizador renombrado) · web (con nota) o manual
  Sales Order   → ORDEN DE VENTA (NUEVA) · el estimado confirmado, datos reales
  Invoice       → FACTURA (0021, existe)
  Receive Pmt   → COBRANZAS (0041, existe)
  + Embarque (existe) = ejecución operativa

COMPRAS (proveedor)
  Purchase Order→ ÓRDENES DE COMPRA (módulo, 2 sub-tipos):
                    · OC de cliente = PREALERTAS (0057, existe)
                    · OC de DTD (NUEVA) — DTD compra como agente de compra
  Bill          → BILL (0044, existe) — la OC de DTD, al recibir, genera el Bill
  Pay Bills     → TESORERÍA (existe)
```

Cadena near-term:
```
Estimado (provisional, web)
   │ asesor cierra · cliente se registra → datos reales · comparación provisional vs real
   ▼
Orden de venta (confirmada) → Embarque (operar) + Factura (cobrar) → Cobranzas
```

## 5. Approach por fases

### Fase A — Renombres de calculadoras públicas (near-term, bajo riesgo)
- Renombrar carpeta `app/cotizar/` → `app/estimacion/` (+ `components/CotizarForm.tsx` → `EstimacionForm.tsx`).
  Metadata: title "Estimación inicial", `canonical: "/estimacion"`, og path, breadcrumb. Copy: "cotización"→"estimación".
- Nueva `app/calculadora-terrestre/page.tsx` montando `UltimoKmCalculator`; sacar la sección embebida de
  `EstimacionForm.tsx` y dejar **enlace contextual** ("¿Necesitás el flete interno? → Calculadora terrestre").
  Metadata + breadcrumb + canonical propios.
- **SEO:** `redirects()` en `next.config.ts` → `/cotizar` ⇒ `/estimacion` (`permanent: true`). `app/sitemap.ts`:
  cambiar `/cotizar`→`/estimacion` + agregar `/calculadora-terrestre`. Enlaces internos directos al URL nuevo:
  `components/HeroCotizador.tsx`, `scripts/seed-mail-templates.ts:161`.
- Allowlists de ruta pública: `eslint.config.mjs:34` (`app/cotizar/**`→`app/estimacion/**` + `app/calculadora-terrestre/**`),
  `proxy.ts:16,103`. Tests: `e2e/smoke.spec.ts:31-32,84`. Comentarios sueltos (`DecimalInput`, `UltimoKmCalculator`, `lib/design-tokens.ts`).

### Fase B — Estimado web → ERP + registro (near-term · puntos 1 y 2 del founder)
- **Migración aditiva** `supabase/migrations/0113_estimado_web.sql` (usar **0113+** — 0110-0112 ya tomadas en otras ramas; re-chequear al implementar): estimado de prospecto sobre `quotes` —
  `client_markbox` nullable + `prospect_email`/`prospect_whatsapp` + `nota` + `source` (`web`/`manual`) + estado/flag
  "por revisar". RPC de código `EST-YYYY-NNNN` (ver Fase C; coordinar con el rename de `next_quote_code`).
- `app/api/public/estimacion/route.ts` (NUEVO): persiste el estimado vía admin client (server-side, boundary-safe).
- `components/EstimacionForm.tsx` + `components/CalculadoraForm.tsx`: **modal nota+nombre+teléfono** antes del envío +
  **botón de doble acción** (POST al ERP + abre `wa.me` con `EST-XXXX`) + **CTA opcional de registro**
  ("Registrate y obtené tu MARKBOX" → `/portal/registro?est=EST-XXXX`).
- `lib/studio/mail/mail-rule-engine.ts`: soportar destinatario `prospect_email` para estimados sin markbox.
- `app/portal/(auth)/registro/actions.ts`: captura `?est=EST-XXXX`, **linkeo automático** (puebla `client_markbox`),
  y **vínculo automático por teléfono+email exacto** si no hay código. Comparación provisional vs real.
- Módulo Estimados (ex-cotizador): **búsqueda por número de estimado** + acción "Vincular a cliente" (manual) +
  filtro "web · por revisar".
- Cruce con Kommo por teléfono (reusa `lib/studio/kommo*`).

### Fase C — Rename interno del ERP: "cotización" → "estimado" / "orden de venta" (transversal)
- Módulo `/studio/cotizador` → **Estimados** (decidir: renombrar ruta a `/studio/estimados` vs solo labels;
  impacta `StudioSidebar.tsx` + links internos + `lib/studio/quote-*`).
- Código `Q-YYYY-NNNN` → **`EST-YYYY-NNNN`** (RPC `next_quote_code` → `next_estimate_code`).
- Sidebar, badges, copy, plantillas de correo (`seed-mail-templates.ts`), eventos de mailing (`quote_sent`→`estimate_sent`…),
  tests, spec 0011. Sin romper datos `quotes` existentes.
- *Transversal por volumen de strings → `pnpm lint` + `node scripts/verify.mjs` obligatorios.*

### Fase D — Modelo contable QuickBooks (FUTURO · puede generar sub-SDDs)
- **Entidad Orden de venta** (`OV-YYYY-NNNN`): el estimado confirmado; → Embarque + Factura. Conversión con comparación de datos.
- **Módulo Órdenes de compra**: lista *OC de cliente* (= prealertas, 0057) + *OC de DTD* (nueva → genera Bill de Tesorería).
- Conversiones estilo QB (botón "Convertir en…"): Estimado → Orden de venta / Factura / Orden de compra (DTD); OC de DTD → Bill.
- **Reusar:** Factura (0021), Bill/Tesorería (0044), Cobranzas (0041), Prealertas (0057), Embarque.
- *Detalle a definir al construir: secuencia exacta Embarque↔Factura tras la Orden de venta.*

## 6. Acceptance

### Fase A
- [ ] `/estimacion` carga (ex `/cotizar`); `/cotizar` responde **301** a `/estimacion`.
- [ ] `/calculadora-terrestre` carga standalone + enlace contextual desde `/estimacion`.
- [ ] `app/sitemap.ts` actualizado (sin `/cotizar`, con `/estimacion` + `/calculadora-terrestre`); enlaces internos al URL nuevo.
- [ ] `pnpm lint` 🟢 (frontera + allowlists). `e2e/smoke.spec.ts` verde con rutas nuevas. `ui-ux-designer` OK.

### Fase B
- [x] Modal de nota (+ nombre/teléfono en `/calculadora`) antes del envío; el WhatsApp incluye nota + datos + `EST-XXXX`. *(B1)*
- [x] Un clic crea el Estimado en el ERP ("web · por revisar") **y** abre WhatsApp; el estimado persiste sin depender del envío. *(B1)*
- [x] CTA opcional de registro con `?est=`; al registrarse, vínculo automático (o por teléfono+email exacto). *(B2)*
- [x] Búsqueda por número de estimado + "Vincular a cliente" en el ERP. *(B2)*
- [x] Migración aditiva (no rompe `quotes`); frontera intacta (form público sin Supabase). `node scripts/verify.mjs` 🟢. *(B1 migr 0113 · B2 sin migración)*

### Fase C
- [x] "Cotización" no aparece en UI/copy/códigos del ERP; módulo = "Estimados"; códigos `EST-`. *(C)*
- [x] Datos `quotes` existentes intactos (sin DDL · sigue usando tabla `quotes` + columna `quote_code`). `verify` 🟢. *(C)* `pnpm lint` cubierto por el gate; `ui-ux-designer` pendiente.

### Fase D (futuro)
- [ ] Entidad Orden de venta + conversiones; módulo Órdenes de compra (OC cliente/DTD); OC de DTD → Bill.

## 7. Fuera de alcance (respetar)

- **WhatsApp Business API** (ingesta automática de mensajes). El cruce es por `EST` + teléfono + Kommo; nada de Meta API.
- **Gatear el precio detrás del registro.** El CTA es opcional (decisión founder).
- **Escribir de vuelta a Kommo** (sigue inbound-only, 0043).
- **Modelo QB completo ya** — Fase D es futuro y por etapas.
- **Migrar/romper `quotes` existentes** — el rename es aditivo + de vocabulario.

## 8. Diseño

Sin mockup del Norte aprobado para estas pantallas todavía. UI reusa primitivas del Studio (`ActionButton`, `DrawerShell`,
`Badge`, `useToast`, `useRowHighlight`) + tokens `var(--*)` + `BRAND.md`. Cualquier pantalla nueva (modal de nota, módulo
Órdenes de compra) pasa por `ui-ux-designer` antes del commit (regla founder). Si hace falta diseño nuevo → `DESIGN-CHECK`.

## 9. Adjuntos

- Plan estratégico aprobado (origen de esta spec): `.claude/plans/title-flujo-de-registro-mossy-dongarra.md`.
- Referencia visual del flujo QuickBooks: foto del founder (Vendors/Customers/Employees) — adjuntar a `assets/` si se quiere versionar.

## 10. Notas de implementación

### Fase A — implementada (2026-06-07 · harness implement→verify→review)

**Archivos:**
- `app/cotizar/` → `app/estimacion/` (`git mv`); `components/CotizarForm.tsx` → `components/EstimacionForm.tsx` (export `CotizarForm`→`EstimacionForm`). Metadata "Estimación inicial" + canonical/og/breadcrumb `/estimacion`; eyebrow "Estimación" (fix ui-ux); copy "cotización"→"estimación".
- `app/calculadora-terrestre/page.tsx` (NUEVO) — monta `<UltimoKmCalculator/>` standalone (hero + `card-shadow`); se sacó la sección embebida de `EstimacionForm` y se dejó un **enlace contextual** sobrio hacia la terrestre. `UltimoKmCalculator` perdió el `border-t-2` y el "(opcional)" (ya no es sección embebida).
- SEO: `next.config.ts` `redirects()` 301 `/cotizar`→`/estimacion`; `app/sitemap.ts` (cambia + agrega terrestre); `scripts/seed-mail-templates.ts`, `public/llms.txt` actualizados.
- Allowlists: `eslint.config.mjs` (`app/estimacion/**` + `app/calculadora-terrestre/**`); `proxy.ts` (solo comentarios — el matcher cubre `/studio` y `/back`, el sitio público no pasa por el proxy).
- Tests: `app/estimacion/__tests__/fase-a-renames.test.ts` (NUEVO, 10 it) + `e2e/smoke.spec.ts` (301 + terrestre + sitemap). Gate `node scripts/verify.mjs` 🟢 (1262 tests).

**Review:** `reviewer` APPROVED · `ui-ux-designer` "ship it" (aplicado: eyebrow `Estima`→`Estimación`).

**Diferido (fuera de Fase A):** comentarios en `lib/design-tokens.ts:121` (lock de otra ventana, lane SDD-0060), `AGENTS.md` tabla integraciones, `public/brand/README.md` (docs); nit ui-ux BAJO preexistente: emoji 🚛 decorativo en `UltimoKmCalculator` (no es regresión de esta fase).

### Fase B — Slice B1 implementado (2026-06-07 · harness implement→verify)

**Alcance B1** (puntos 1 y 2 del founder): capturar el estimado web en el ERP + modal nota/contacto + botón de doble acción. **EXCLUIDO (Slice B2, no tocado):** linkeo automático al registro (`?est=`/teléfono+email), búsqueda por `EST` + "Vincular a cliente" en el módulo, cruce Kommo, mail a prospecto, rename interno cotización→estimado (Fase C).

**Archivos:**
- `supabase/migrations/0113_estimado_web.sql` (NUEVO, aditiva, **NO aplicada a prod**): `quotes.client_markbox` → NULLABLE; cols `prospect_name`/`prospect_email`/`prospect_whatsapp`/`nota` + `source` (`studio`|`web`, default `studio`, CHECK) + índice `quotes_tenant_source_idx`; RPC `next_estimate_code(uuid)` → `EST-YYYY-NNNN` (cuenta solo `EST-%`, padding 4, `security definer`, grants a authenticated+service_role).
- `lib/public/estimado-web.ts` (NUEVO, **lógica pura boundary-safe**, sin imports de DB): `validateEstimadoInput` (sin Zod), `buildEstimadoRow` (payload calc → fila `quotes` llenando TODOS los NOT NULL), `buildEstimadoWhatsAppMessage` (base + nota + EST), `serviceForCalc`.
- `app/api/public/estimacion/route.ts` (NUEVO, route handler fino): POST → valida → resuelve tenant DTD → `next_estimate_code` → insert vía `createAdminClient()` → `{ ok, estimateCode }` / `apiError`. **Único puente público↔ERP de la feature.**
- `components/EstimadoModal.tsx` (NUEVO): modal sobrio (nota opcional + nombre + teléfono), tokens de marca + Archivo, fetch POST + fallback (abre WhatsApp aunque el POST falle).
- `components/CalculadoraForm.tsx` (LCL `/calculadora`): el CTA con precio válido abre el modal (pide los 3); el CTA de alerta sigue como link directo a WhatsApp (no hay estimado que capturar).
- `components/EstimacionForm.tsx` (`/estimacion`): "Estimar ahora" calcula el rango y abre el modal prefilleado (nombre/teléfono del form); el mock `DTD-LEAD-XXXX` efímero pasó a ser el `EST-XXXX` real del ERP en la pantalla de éxito.
- `lib/public/__tests__/estimado-web.test.ts` (NUEVO, 14 it): mapeo payload→row (LCL + aéreo), validación (campos faltantes, monto inválido, calc inválida, defaults, coma decimal), armado del mensaje WhatsApp con nota+EST.

**Decisiones de implementación:**
- **`tenant_id`:** resuelto en el route handler con el mismo patrón que `app/portal/(auth)/registro/actions.ts` — primer tenant por `created_at` (DTD es hoy single-tenant operativo). NO se hardcodeó UUID.
- **NOT NULL de `quotes` (`client_name`, `service`, `origin`, `destination`, `subtotal_usd`, `total_usd`, `packaging`):** **NO se aflojaron** — se LLENAN en el insert vía `buildEstimadoRow`. `client_name` = snapshot del nombre del prospecto; `service` = `puerta_a_puerta_DDP` (producto comercial de la web para las 3 calc); `origin`/`destination` de la calc o defaults (`China`/`Venezuela`); `subtotal_usd`/`total_usd` del estimado; `packaging` de la calc o `carton`.
- **RLS:** insert con admin client (service_role) que bypassa RLS → sin policy nueva. `quotes` no tiene FORCE RLS (verificado en 0007) → service_role pasa limpio. RLS de lectura del Studio intacta.

**Gate:** `node scripts/verify.mjs` 🟢 (1284 tests).

**Pendiente founder:** aplicar `0113` a prod. **Pendiente review:** `reviewer` + `ui-ux-designer` (modal nuevo).

### Fase B — Slice B2 implementado (2026-06-07 · harness implement→verify→review)

**Alcance B2** (puntos 1-5 de "Fase B"): vínculo estimado web ↔ cliente (automático por código + por datos, manual desde el módulo), búsqueda + cola "web · por revisar", cruce con Kommo por teléfono, mail a prospecto. **SIN migración nueva** — todo se monta sobre el schema de `0113` (B1). **EXCLUIDO:** Fase C (rename interno cotización→estimado) y Fase D (modelo QB).

**Archivos (16: 2 nuevos + 14 modificados):**
- `lib/studio/estimado-linking.ts` (NUEVO, **lógica pura boundary-safe**, sin Supabase): `normalizePhone`/`phonesMatch` (compara los **últimos 10 dígitos** = número nacional VE, tolera `+58`/`0`/bare sin falsos positivos por prefijo), `emailsMatch` (exacto case-insensitive), `prospectMatches` (Slice 2: exige teléfono **Y** email), `resolveClientRecipientEmail` (Slice 5: override → markbox → prospecto).
- `lib/studio/__tests__/estimado-linking.test.ts` (NUEVO, 18 it): cubre los 4 predicados incl. casos de formato de teléfono, email vacío, match parcial, y la cascada de destinatario.
- `lib/studio/quote-queries.ts`: `QUOTE_COLUMNS` + `prospect_*`/`nota`/`source`; filtro `source` (`web`/`studio`/`web_review` = web sin vincular); búsqueda por `prospect_*`; **3 funciones de vínculo** — `linkEstimateByCode` (Slice 1), `linkEstimatesByContact` (Slice 2, narrow por email en DB + `prospectMatches` en JS), `linkEstimateToClient` (Slice 3 manual, valida cliente-en-tenant + snapshot del nombre). Todas idempotentes: solo tocan `source='web'` + `client_markbox is null` + vivas, con guard anti-race en el UPDATE.
- `lib/studio/quote-types.ts`: `Quote.client_markbox` → **nullable**; cols nuevas; `QuoteSource`; helper `isUnlinkedWebEstimate`.
- `app/portal/(auth)/registro/{page,RegisterForm,actions}.tsx/.ts`: **Slice 1+2** — `page` lee `?est=` (capado 40 chars) → `RegisterForm` (aviso sobrio + hidden `est`) → `actions` paso **6b** (best-effort en try/catch, NO rompe el alta): `linkEstimateByCode` primero, si no `linkEstimatesByContact`.
- `components/EstimacionForm.tsx` + `components/CalculadoraForm.tsx`: **Slice 1 (CTA público)** — "Registrate y obtené tu MARKBOX" → `/portal/registro?est=EST-XXXX` (en el success de EstimacionForm; banner post-estimado en CalculadoraForm). **Boundary-safe**: solo `<Link>`, cero imports del ERP.
- `app/studio/(app)/cotizador/`: **Slice 3 UI** — `_components/CotizadorClient.tsx` (chip "Web · por revisar" en `studio-btn-warning` + badge "Web · sin vincular"), `[code]/page.tsx` (sección "Prospecto · capturado de la web" + nota + MARKBOX "— sin vincular —"), `_components/QuoteDetailClient.tsx` (panel "Vincular a cliente" con acento wine + advisory Kommo), `actions.ts` (`linkEstimateToClientAction`).
- `lib/studio/kommo-convert.ts`: **Slice 4** — `findKommoContactsByPhone` (reusa `parseContactFields` + `phonesMatch`; advisory, cap 500 recientes — el teléfono vive en `custom_fields` jsonb, no en columna).
- `lib/studio/mail/mail-rule-engine.ts` + `cotizador/actions.ts`: **Slice 5** — `FireMailEventInput.prospectEmail` resuelto vía `resolveClientRecipientEmail`; `transitionStatus` pasa `prospect_email` → un estimado web sin markbox le manda el mail al prospecto.
- `lib/studio/costing/__tests__/sliceC.test.ts`: fixture `Quote` actualizado con las cols nuevas (typecheck).

**Decisiones de implementación:**
- **Sin migración:** B2 no toca DDL — `client_markbox` nullable, `prospect_*`/`nota`/`source` y el índice `quotes_tenant_source_idx` ya vienen de `0113`.
- **Slice 2 = teléfono Y email** (decisión founder §3.6): `prospectMatches` exige ambos; un estimado sin email no se vincula por datos (queda para código o manual).
- **Frontera intacta:** el linkeo lo hacen el admin client del registro (Slices 1/2) y el client RLS del Studio (Slice 3); los componentes públicos solo agregan un `<Link>`.

**Gate:** `node scripts/verify.mjs` 🟢 (1302 tests). **Review:** `reviewer` **APPROVED** (0 findings bloqueantes); `ui-ux-designer` "ship it" (aplicado A1: chip activo `studio-btn-warning`; B2 alineación input↔botón; B3 acento wine al panel de vínculo).

**Pendiente founder:** B2 no necesita migración (0113 ya en prod). Resto del SDD pendiente: Fase C (rename interno) y Fase D (modelo QB).

### Fase C — implementada (2026-06-07 · harness implement→verify)

**Alcance:** rename de vocabulario/UI del ERP "cotización" → "estimado" + códigos nuevos `EST-`. **SIN migración, SIN DDL.** Los datos `quotes` existentes (incl. códigos `Q-` viejos) sobreviven intactos: NO se renombró carpeta/ruta (`cotizador/`, `/studio/cotizador`), nombres de archivo/tipo (`Quote*`, `CotizadorClient`, `QuoteDrawer`), tabla `quotes`, columna `quote_code`, RPC `next_quote_code` (queda; solo dejó de usarse para códigos nuevos), eventos de mailing `quote_sent`/`quote_accepted`, ni los slugs de template `quote_sent`/`quote_accepted` (reglas vivas en prod).

**Archivos (copy/labels + código del generador):**
- **Módulo Estimados** `app/studio/(app)/cotizador/`: `page.tsx` (`metadata.title` → "Estimados"), `[code]/page.tsx` ("Detalle estimado" + "Total estimado" + "Este estimado ya fue convertido…"), `_components/CotizadorClient.tsx` (h1 "Estimados.", "+ Nuevo estimado", empty states), `_components/QuoteDrawer.tsx` (título "Nuevo/Editar estimado", toasts, SplitAction labels, "Total estimado"), `_components/QuoteDetailClient.tsx` (enviar/aceptar/convertir → "estimado"), `actions.ts` (**RPC `next_quote_code` → `next_estimate_code`** en `createQuote` + mensajes de error).
- **Sidebar + i18n:** `_components/StudioSidebar.tsx` (`label` "Cotizador"→"Estimados"); `lib/i18n/es-VE/chrome.ts` ("Estimados") + `lib/i18n/zh-CN/chrome.ts` (报价→估价).
- **Dashboard:** `RecentQuotesCard.tsx` ("Estimados recientes"), `RecentActivityCard.tsx` (status `quoted` label "Cotizado"→"Estimado"), `page.tsx` (KPIs "Estimados del mes"/"Total estimado").
- **Mail (solo labels/copy, identificadores intactos):** `lib/studio/mail-types.ts` (`RULE_EVENT_LABELS.quote_sent/accepted` + `CATEGORY_DEFAULT_SUBJECT.comercial`), `lib/studio/mail-sample-vars.ts` (sample `quote_code` → `EST-2026-0042`), `scripts/seed-mail-templates.ts` (name/subject/body de `quote_sent`/`quote_accepted`, **slug intacto**), `mailing/_components/RulesView.tsx`.
- **Otros labels ERP:** `costing/_components/CostingClient.tsx` + `lib/studio/costing/{ui,queries}.ts` (incl. `FORECAST_BUCKET_LABEL` ahora masculino), `legal/_components/LegalClient.tsx` + `lib/studio/legal/{types,queries}.ts`, `lib/studio/comments/types.ts` (`COMMENT_ENTITY_LABELS.quote.label` → "Estimado"), `lib/studio/bug-module-name.ts` (display "Estimados"), `lib/studio/fidelizacion/types.ts`, `lib/studio/user-types.ts` (ROLE_DESCRIPTIONS), `lib/studio/calculator-settings-types.ts`, `usuarios/`, `tarifas/`, `embarques/` empty states, `debug/_components/EstadoTab.tsx`, primitivas `ActionButton`/`SplitActionButton`/`ToastProvider` (doc-comments).
- **Tests:** `app/studio/(app)/cotizador/__tests__/fase-c-rename.test.ts` (NUEVO) — asserta labels nuevos, `next_estimate_code` en `createQuote`, slugs de mailing intactos, y que en el módulo solo quedan refs a la ruta/identificador (no copy). Descripciones de `sliceC.test.ts`/`legal/queries.test.ts` actualizadas.
- **Spec 0011:** nota de renombre (vocabulario) al tope; `updated` bump. Title del índice sin cambios (es histórico de Sprint 1).

**Decisiones:**
- `next_estimate_code` ya existía (creada en B1, migr 0113, grant a `authenticated`) → `createQuote` (cliente RLS del Studio) la invoca con `p_tenant_id`. Códigos `Q-` viejos coexisten (la RPC cuenta solo `EST-%`).
- "estimado" es masculino → se ajustó el género de labels heredados de "cotización" (femenino): "aceptada/enviada" → "aceptado/enviado" en forecast y dashboard.
- **No tocado el sitio público** (`/estimacion`, `/calculadora`, `components/` raíz, tests de calculadora públicos): es otra pista (marca-sensible, Fase A).

**Gate:** `node scripts/verify.mjs` 🟢. **Pendiente review:** `reviewer` + `ui-ux-designer` (copy del módulo). **Pendiente:** Fase D (modelo QB).

### Fase B2.5 — unificación del registro en `/registro` (2026-06-07 · harness)

**Por qué:** había DOS "registro" → confusión. `/registro` (público) era una página de **marketing sin formulario** que apuntaba a `/portal/registro` (el form real que genera el MARKBOX). Las CTAs "Registrate" del sitio (Hero/Nav/Footer/JoinCTA) caían en la página de marketing → parecía que "no generaba markbox". **Verificado en prod (read-only): el backend NO estaba roto** (RPCs `next_markbox`/`next_markbox_service` + columnas + 3 altas reales por portal en 21 días). El problema era 100% el **funnel/routing**.

**Decisión founder:** un solo punto de alta = **`dtdcargo.com/registro`** = el form real.

**Cambios (move, no reescritura):**
- `git mv` del form del portal → público: `app/portal/(auth)/registro/{RegisterForm.tsx,actions.ts,__tests__/*}` → `app/registro/` (renames, historia preservada; los tests resuelven `../actions` igual).
- `app/registro/page.tsx`: de marketing → **el form** (SEO/canonical preservado + check "ya logueado → /portal" + captura `?est=` B2 + chrome público Nav/Footer).
- `app/portal/(auth)/registro/page.tsx`: ahora **redirect a `/registro`** (compat de links viejos: CTAs de calculadora, welcome email, bookmarks; preserva `?est=`).
- Refs `/portal/registro` → `/registro`: `EstimacionForm.tsx`, `CalculadoraForm.tsx` (CTAs con `?est=`), `LoginForm.tsx` ("Creá tu cuenta"). `next.config.ts` (comentario; `bodySizeLimit` 12mb es global → cubre `/registro`).

**Decisión de frontera (documentada):** `app/registro/` pasa a ser una **ruta pública Supabase-backed**. La frontera ESLint NO la restringe (la lista cubre `estimacion/track/calculadora/...` + `components/`, no `registro`). Mismo patrón sancionado que **`app/invitar/`** (AGENTS.md: "ruta pública que usa DB por diseño"). El sitio de marketing sigue Supabase-free; solo `/registro` (alta de cuenta) toca DB, contenido en su propia ruta.

**Gate:** `node scripts/verify.mjs` 🟢 (incl. rsc-boundary + tests movidos). `main` intacto.

**Diferido (analizado · NO en esta pista) — Sync Norte v2.4 · Registro:** el form vivo está detrás del Norte `Registro Cliente.html` v2.4: (1) **foto de la fachada** (paso dirección), (2) **"¿Ya tenés una compra?"** = prealerta opcional al firmar + lógica anti "caja huérfana", (3) "Listo" enriquecido (copiar para proveedor, guía código+sticker, CTA prealerta). Va por handoff-first + ui-ux, coherente con el modelo OV↔prealerta (Fase D).

### Fase B — Portal · "Estimados" del cliente (read-only) (2026-06-09 · sesión con founder, worktree `chore/retoques`)

**Por qué:** el cliente generaba estimados en la web pero no los veía en su portal. Se suma una **5ª↔ sección read-only** "Estimados" al portal: TODOS los estimados ligados a su MARKBOX (los `source='web'` ya vinculados por código/datos + los que le armó un asesor `source='studio'`). Cierra el loop "estimé → me registré → veo mi estimado".

**Archivos:**
- **Migración `0117_quotes_portal_rls.sql`** (NUEVA, **NO aplicada a prod**): policy `quotes portal self read` (SELECT por `client_markbox = get_portal_client_markbox()`) — espejo de `invoices portal self read` (0085). Antes el cliente NO podía leer `quotes` (solo existía la RLS del equipo). Sin DDL sobre la tabla.
- `lib/portal/portal-types.ts`: `PortalEstimateRow` + label/tono **de cara al cliente** (`portalEstimateStatusLabel` mapea `draft`→"En revisión"; masculino: Enviado/Aceptado/Rechazado/Vencido).
- `lib/portal/portal-queries.ts`: `listMyEstimates` (filtra EXPLÍCITO por markbox, defensa en profundidad como el resto del portal).
- `app/portal/(app)/estimados/page.tsx` (NUEVO) + `app/portal/_components/EstimateRow.tsx` (NUEVO): lista read-only + CTA "Pedir que lo confirmen" (WhatsApp con `EST-XXXX`; la conversión la maneja el asesor).
- `app/portal/_components/PortalNav.tsx`: + ítem "Estimados" (tras "Mis envíos"); nav "Compras" queda limpio (decisión founder).
- `lib/portal/__tests__/estimates.test.ts` (NUEVO, 7 it): mapeo + aislamiento sin markbox + labels.

**Decisiones (founder):** mostrar **todos** sus estimados (web + studio); **read-only + CTA al asesor**. **Sync Norte pendiente:** el Norte (`_norte/portal/app.jsx`) aún no tiene pantalla "Estimados" en el portal → Cloud Design la espeja luego.

**Review:** `ui-ux-designer` "ship it" (aplicado: focus ring del CTA compacto, a11y). **Gate `node scripts/verify.mjs` VERDE**. Migración `0117` **NO** aplicada a prod. Sin push.

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
