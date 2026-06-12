---
sdd: "0070"
title: "Expediente de defensa legal (SDD-E del handoff) — cadena de evidencia de 1 clic por operación (aceptación + packing + fotos origen + cronología + POD)"
status: approved
author: "handoff Claude Chat (capa legal) + Claude Code"
created: 2026-06-11
updated: 2026-06-11
supersedes: null
superseded_by: null
related: ["0067", "0068", "0069", "0054", "0016", "0029", "0057"]
confidencialidad: interno
---

# DTD-0070 — Expediente de defensa legal (SDD-E)

> Última pieza grande de la capa legal (`docs/legal/HANDOFF_CAPA_LEGAL.md` §SDD-E,
> orden B→C→A→**E**→D; B/C/D ya en prod). El handoff lo define: "Función 'expediente de
> defensa': un click → PDF con aceptación de términos + packing list + fotos + eventos +
> POD de una operación." Branch: `feat/expediente-defensa`.

## 1. Resumen en una línea

Una página imprimible admin-only `/studio/legal/expediente/[code]` que, dado el código de un
envío, **reúne toda la cadena de evidencia** ya dispersa en el sistema —aceptación de T&C
(con hash verificado), packing/documentos de compra, fotos de almacén origen, cronología de
eventos y prueba de entrega (POD)— en un documento de defensa de 1 clic (print→PDF).

## 2. Por qué

- Handoff SDD-E + DoD: "Export de expediente de defensa por operación". Ante un reclamo,
  el dueño necesita en 1 clic TODA la prueba de una operación, no buscarla en 5 módulos.
- **Las 5 piezas YA EXISTEN** (investigación 2026-06-11): aceptación (`legal_acceptances`,
  SDD-0067), packing (`prealertas`+`prealerta_documents`, SDD-0057), fotos de origen
  (`warehouse_receipts_cn`+`warehouse_receipt_photos`, SDD-0016), cronología
  (`shipment_events`, SDD-0002), POD (`dispatch_pods`, SDD-0029). SDD-E es **orquestación
  pura, SIN migración** — todo cuelga del código del envío.
- Cierra el ciclo legal: B (aceptación) + C (recibos) + D (rendición) producen evidencia;
  E la **consolida en prueba presentable**.

## 3. Decisiones ancladas

1. **Clave = el código del envío.** `shipments.code` (confirmado `text not null` en 0002).
   Ruta `/studio/legal/expediente/[code]`. ⚠️ El implementer DEBE confirmar que la columna
   que matchea `legal_acceptances.quote_code` es `code` (lo que sella el Portal en la action
   de aceptación de SDD-0067/0068) — si la action sella `shipment_code` u otra, usar esa. La
   unión legal↔envío es string-match, no FK.
2. **Sin migración.** Toda la data existe; el expediente es SOLO LECTURA. No hay tabla nueva
   de "expediente generado" (no lo pide el handoff). Próximo SDD = 0070; ninguna migración.
3. **Patrón = la página imprimible de SDD-0067/0068.** Calca
   `app/studio/(app)/legal/evidencia/[code]/page.tsx`: server component, `@media print` que
   oculta el shell del Studio (`[data-print-hide]`), re-ancla tokens al valor light canónico
   (dark mode no sangra al papel), `PrintButton` → `window.print()`. "PDF" = imprimir →
   Guardar como PDF del navegador. **No hay lib de PDF en el repo** (confirmado: cero
   pdfkit/puppeteer/jspdf/@react-pdf) — es el patrón de la casa.
4. **Admin-only.** Evidencia con PII (IP, user_agent de la aceptación; nombre/CI del receptor
   en el POD). Gate idéntico a `evidencia/[code]`: `user_tenants.role !== 'admin'` →
   `redirect('/studio/dashboard')`. RLS por tenant en todas las tablas leídas = segunda capa.
5. **Fail-soft por sección.** Cada una de las 5 piezas, si no tiene datos, renderiza "Sin
   registros" en vez de romper. Es evidencia: se muestra lo que hay. Un **índice de
   completitud** al tope dice qué piezas están presentes/ausentes (el abogado ve de un vistazo
   qué prueba existe). Helper PURO `summarizeCompleteness(file)` (testeable sin DB).
6. **Fotos vía signed URLs server-side.** `supabase.storage.from(bucket).createSignedUrls(
   paths, 3600)` (patrón de `signDocumentUrls`, `lib/studio/shipment-document-queries.ts`),
   pasadas a `<img src>`. Buckets: `receipt-photos` (fotos CN + foto/firma del POD),
   `prealerta-docs` (packing/factura/fotos de la prealerta). TTL 1h (se imprime en segundos).
7. **Múltiples aceptaciones por envío** (re-aceptación por nueva versión de T&C): se listan
   TODAS, marcando cuál es la vigente (la última con docs vigentes). El POD es indirecto
   (4 saltos: envío → recepciones CN consolidadas → dispatch_order_packages →
   dispatch_orders → dispatch_pods) → query con fail-soft si la cadena se corta.

## 4. Approach (archivos)

- **`lib/studio/legal/expediente-types.ts`** (NUEVO) — `DefenseFile` (las 5 secciones +
  cabecera del envío), `DefenseSection<T>` (genérico: `present: boolean` + `items: T[]`),
  tipos de cada pieza. Helper PURO **`summarizeCompleteness(file): { present: string[];
  missing: string[]; count: number }`**.
- **`lib/studio/legal/expediente-queries.ts`** (NUEVO) — **`getDefenseFile(supabase,
  {tenantId, shipmentCode}): Promise<DefenseFile | null>`** (null si el envío no existe en el
  tenant). Orquesta:
  1. Cabecera: `shipments` (code, cliente, markbox, fechas, servicio) por `code`+tenant.
  2. Aceptación: **REUSA `listAcceptanceEvidenceByQuote(supabase, {tenantId, quoteCode:
     code})`** (`lib/studio/legal/queries.ts:578`) — ya trae hash verificado.
  3. Packing: `prealertas` where `shipment_id` + `prealerta_documents` (firmar bucket
     `prealerta-docs`).
  4. Fotos origen: `warehouse_receipts_cn` where `shipment_id` + `warehouse_receipt_photos`
     (firmar bucket `receipt-photos`).
  5. Cronología: `shipment_events` where `shipment_id`, order `occurred_at`.
  6. POD: join indirecto (recepciones → `dispatch_order_packages` package_kind=
     'warehouse_receipt_cn' → `dispatch_orders` → `dispatch_pods`), firmar foto+firma.
  Queries puras que reciben `SupabaseClient`. Las URLs se firman acá (batch por bucket).
- **`app/studio/(app)/legal/expediente/[code]/page.tsx`** (NUEVO) — server, admin-only
  (calca el gate de `evidencia/[code]`). Render: acciones `data-print-hide` (Volver +
  PrintButton) · contenedor `#legal-expediente` con cabecera DTD Cargo + datos del envío +
  **índice de completitud** + las 5 secciones (cada una con su título, fail-soft "Sin
  registros") + `@media print` (mismo bloque de tokens re-anclados que evidencia/recibo).
  Fotos como `<img>` con signed URLs. Solo tokens `var(--*)`.
- **`app/studio/(app)/legal/expediente/[code]/PrintButton.tsx`** (NUEVO) — copia literal del
  de `evidencia/[code]`.
- **Entry points:**
  - Primario: botón "Expediente de defensa" en el detalle del envío
    (`app/studio/(app)/tracking/[id]/...`, donde el admin ve la orden), link a
    `/studio/legal/expediente/<code>` en pestaña nueva (`target="_blank"`). Solo admin.
  - Secundario: en `LegalClient.tsx`, un `<input>` "Buscar expediente por código de envío" +
    botón que navega a la ruta (análogo al acceso de aceptaciones; sin estado nuevo).
- **Tests Vitest** (`lib/studio/legal/__tests__/expediente.test.ts`):
  `summarizeCompleteness` (5/5, parcial, 0/5) · `getDefenseFile` con stub de Supabase (cada
  sección presente/vacía sin romper; envío inexistente → null) · hash de la aceptación
  heredado de 0067 (fila intacta → válida, alterada → inválida) · el join indirecto del POD
  con stub (cadena completa → POD presente; cadena cortada → fail-soft vacío).

## 5. Acceptance

- [ ] `/studio/legal/expediente/[code]` admin-only (no-admin → redirect dashboard) reúne las
      5 secciones de un envío real; las que tienen datos renderizan, las vacías dicen "Sin
      registros"; el índice de completitud cuadra.
- [ ] Aceptación con hash verificado (reusa la query de 0067); múltiples aceptaciones se
      listan marcando la vigente.
- [ ] Fotos (origen + POD) cargan vía signed URLs; `window.print()` produce PDF limpio (solo
      `#legal-expediente`, sin el shell del Studio).
- [ ] POD por el join indirecto; si la cadena se corta, sección fail-soft sin romper.
- [ ] Entry points: botón en el detalle del envío + buscador en `/studio/legal`.
- [ ] `node scripts/verify.mjs` 🟢. SIN migración. SIN cambios en otras tablas/módulos.

## 6. Fuera de alcance (respetar)

- **NO** migración / NO tabla de "expediente generado" (solo lectura).
- **NO** PDF server-side ni ZIP de fotos originales (V1 = print-to-PDF del navegador).
- **NO** promover la captura de fotos en Yiwu (operativo, no de esta spec); el expediente las
  muestra si existen.
- **NO** tocar la generación del packing .xlsx (`/p/[token]/packlist`); el expediente lista
  los documentos subidos de la prealerta, no regenera el Excel.
- **NO** cambiar `legal_acceptances`, el gate AUT-04 ni los módulos de almacén/despacho.
