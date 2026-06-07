---
sdd: "0061"
title: "Estimado → Orden de venta (modelo QuickBooks): retira 'cotización', captura el estimado web en el ERP y lo vincula al registro del cliente"
status: draft
author: "Claude Code (carril comercial · sesión con founder 2026-06-07)"
created: 2026-06-07
updated: 2026-06-07
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
- [ ] Modal de nota (+ nombre/teléfono en `/calculadora`) antes del envío; el WhatsApp incluye nota + datos + `EST-XXXX`.
- [ ] Un clic crea el Estimado en el ERP ("web · por revisar") **y** abre WhatsApp; el estimado persiste sin depender del envío.
- [ ] CTA opcional de registro con `?est=`; al registrarse, vínculo automático (o por teléfono+email exacto).
- [ ] Búsqueda por número de estimado + "Vincular a cliente" en el ERP.
- [ ] Migración aditiva (no rompe `quotes`); frontera intacta (form público sin Supabase). `node scripts/verify.mjs` 🟢.

### Fase C
- [ ] "Cotización" no aparece en UI/copy/códigos del ERP; módulo = "Estimados"; códigos `EST-`.
- [ ] Datos `quotes` existentes intactos. `pnpm lint` + `verify` 🟢. `ui-ux-designer` OK.

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

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
