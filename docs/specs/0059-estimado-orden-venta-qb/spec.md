---
sdd: "0059"
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

# DTD-0059 — Estimado → Orden de venta (modelo QuickBooks)

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
- **Migración aditiva** `supabase/migrations/NNNN_estimado_web.sql`: estimado de prospecto sobre `quotes` —
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

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
