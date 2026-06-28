---
sdd: "0117"
title: "Recibo y finiquito en PDF server-side (@react-pdf/renderer) — reemplaza window.print()"
status: draft
author: "Claude Code (Director) + founder"
created: 2026-06-28
updated: 2026-06-28
supersedes: null
superseded_by: null
related: ["0113", "0109", "0103"]
confidencialidad: interno
---

# SDD-0117 · Recibo y finiquito en PDF server-side

> Cierra el §9.6 abierto de [SDD-0113](../0113-empleado-self-service/spec.md) y la deuda de PDF de
> [SDD-0109](../0109-nomina-liquidacion-finiquito/spec.md): hoy el recibo del empleado y el finiquito
> se "exportan" con `window.print()` (print-to-PDF del navegador, fidelidad variable, sin membrete
> legal). Esta spec genera **PDF real server-side**, descargable, con membrete del empleador.

## 0. Por qué — y qué NO es

**El hueco:** `app/m/emp/_components/ReciboTab.tsx` y el detalle del finiquito usan `window.print()`
con `@media print` scopeado. Funciona como apaño pero: (1) el resultado depende del navegador/SO del
empleado; (2) no hay un archivo PDF que se pueda adjuntar/enviar/archivar; (3) sin membrete legal del
empleador. El §9.6 de SDD-0113 dejó el **motor de PDF sin decidir**.

**Decisión de motor (founder 2026-06-28): `@react-pdf/renderer`.** JS puro, sin headless browser →
corre en serverless de Vercel sin Chromium ni cold-starts. Los documentos (recibo/finiquito) son
estructurados (campos + tablas) → encajan en su modelo de componentes. Descartado Puppeteer (pesa
~300MB, frágil en Lambda). 1ª dependencia de PDF del repo.

**NO entra:**
- ❌ Recalcular montos. El PDF **lee** los datos ya computados (`get_my_payslip` RPC fail-closed para
  el recibo; `nomina_settlements` + lines para el finiquito). Cero lógica fiscal nueva.
- ❌ Cambiar RLS/migraciones. **Sin migración.** El acceso se acota con las RPCs/queries existentes.
- ❌ Envío automático por email/WhatsApp del PDF (el deep-link `wa.me` actual se mantiene; adjuntar el
  PDF firmado = fase posterior).

## 1. Alcance por slices

| Slice | Entregable | Migración |
|---|---|---|
| **A — Recibo (0113)** | route `app/m/emp/recibo/[period]/pdf/route.ts` → `<Document>` con el desglose del recibo, acotado por `get_employee_id_for_user()`. Botón "Descargar PDF" en `ReciboTab` apunta al route (reemplaza `window.print()`). | sin migración |
| **B — Finiquito (0109)** | route equivalente para `nomina_settlements`; más campos (prestaciones/fracciones/indemnización Art.92/intereses/deducciones) + membrete legal. Acotado a admin/accounting (mismo gate que el módulo). | sin migración |

Slice A primero (más simple, read-only). B es additivo sobre el mismo motor + componentes compartidos.

## 2. Arquitectura

- **`lib/studio/pdf/`** (nuevo, transversal):
  - `pdf-doc.tsx` — primitivas compartidas: `<Page>` con membrete (logo `<BrandMark>` no aplica en
    PDF → texto "DTD Cargo" + datos del empleador), estilos base (tokens **hardcodeados** a valores de
    luz; react-pdf no lee CSS vars), tabla de renglones, footer legal.
  - `recibo-pdf.tsx` — `<ReciboDocument payslip={...} employee={...} />`.
  - `finiquito-pdf.tsx` (Slice B) — `<FiniquitoDocument settlement={...} lines={...} />`.
- **Route handlers** (no server actions; un PDF binario va por GET → descarga/preview):
  - `app/m/emp/recibo/[period]/pdf/route.ts` — resuelve `get_employee_id_for_user()`, llama
    `get_my_payslip(period)` (fail-closed: si no es suyo o no está confirmado/pagado → 404), renderiza
    con `renderToBuffer(<ReciboDocument/>)`, devuelve `application/pdf` con
    `Content-Disposition: inline; filename="recibo-<period>.pdf"`.
  - Slice B: `app/studio/(app)/nomina/finiquito/[id]/pdf/route.ts` con gate `nomina_can_access()`.
- **Caller**: el botón "Imprimir / PDF" del recibo pasa a `<a href="/m/emp/recibo/<period>/pdf"
  target="_blank">Descargar PDF</a>` (abre el PDF real; el navegador ofrece guardar). Se conserva
  WhatsApp (`wa.me`). `window.print()` se retira de esa superficie.

## 3. Seguridad

- **Acotado al dueño**: el route del recibo NO recibe el employee_id por param — lo resuelve de la
  sesión vía `get_employee_id_for_user()`. `[period]` solo filtra; un empleado nunca ve el recibo de
  otro (mismo gate que el RPC, ya probado en SDD-0113).
- **Finiquito (Slice B)**: gate `nomina_can_access()` (admin/accounting) — el finiquito es money/PII;
  no se expone al empleado salvo que se decida en otra spec.
- **Sin datos en el bundle cliente**: el PDF se arma 100% server-side; el cliente solo recibe el
  binario. PII no viaja al JS del navegador.
- **No cachear**: `Cache-Control: private, no-store` (el PDF lleva sueldo/PII).

## 4. Criterios de aceptación

- Un empleado abre `/m/emp/recibo/<period>/pdf` de SU período confirmado/pagado → descarga un PDF
  legible con membrete, desglose (asignaciones/deducciones/neto) y nota legal. Cero `window.print()`.
- Pedir el PDF de un período ajeno o en borrador → 404 (no filtra existencia/PII).
- El PDF abre igual en Chrome/Safari/móvil (no depende del navegador del empleado).
- Vitest: el componente `<ReciboDocument>` renderiza sin throw con un payslip mock; el route devuelve
  404 cuando `get_my_payslip` da null. `renderToBuffer` produce un Buffer no vacío.
- `node scripts/verify.mjs` 🟢 + `pnpm build` 🟢 (la dependencia nueva no rompe el build de Vercel).

## 5. Decisiones / riesgos

- **Fuentes en el PDF**: react-pdf no usa las fuentes del sitio por defecto. V1 usa Helvetica
  (built-in de react-pdf) para evitar registrar/transportar Archivo. Registrar Archivo en el PDF =
  pulido posterior si el founder lo pide (la marca en el membrete se cubre con texto + color).
- **Tamaño del bundle**: `@react-pdf/renderer` (~vendor) solo entra en los route handlers de PDF
  (server), no en el cliente → no infla el JS del navegador.
- **Membrete legal**: datos del empleador (razón social/RIF) van SOLO en el PDF como documento formal
  (igual que el schema, nunca en la web pública). Confirmar el texto exacto con el founder.

## 6. Archivos
```
package.json                                       (editar: + @react-pdf/renderer)
lib/studio/pdf/pdf-doc.tsx                         (nuevo · primitivas)
lib/studio/pdf/recibo-pdf.tsx                      (nuevo · Slice A)
lib/studio/pdf/__tests__/recibo-pdf.test.ts        (nuevo)
app/m/emp/recibo/[period]/pdf/route.ts             (nuevo · Slice A)
app/m/emp/_components/ReciboTab.tsx                (editar: botón PDF → route, retira window.print)
lib/studio/pdf/finiquito-pdf.tsx                   (Slice B)
app/studio/(app)/nomina/finiquito/[id]/pdf/route.ts (Slice B)
```

## 7. Referencias
- Recibo/payslip: [SDD-0113](../0113-empleado-self-service/spec.md) §4.2 + RPC `get_my_payslip` (migr 0182).
- Finiquito: [SDD-0109](../0109-nomina-liquidacion-finiquito/spec.md) (`nomina_settlements`, migr 0179).
- Motor: `@react-pdf/renderer` (v4, compatible React 19).
