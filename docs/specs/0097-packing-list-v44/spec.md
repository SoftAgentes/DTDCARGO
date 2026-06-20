---
sdd: "0097"
title: "Packing list Norte v4.4 — propagación a producción (editor del proveedor)"
status: in-progress
author: "Claude (DTD)"
created: 2026-06-20
updated: 2026-06-20
supersedes: null
superseded_by: null
related: ["0096", "0057"]
confidencialidad: interna
---

# SDD-0097 — Packing list Norte v4.4 → producción

## 1. Resumen en una línea

Propaga el rediseño **Norte v4.4** del packing list (`_norte/packlist/`) a la página pública del
proveedor `/p/[token]`: de "form simple" (SDD-0096) a un **editor de documento completo** —
autoguardado + historial, agrupar ítems por caja, etiquetas QR reales, adjuntos con contador,
trilingüe e identidad de la bodega. Apila sobre SDD-0096; **sin migración** (localStorage + JSONB).

## 2. Contexto

SDD-0096 dejó vivo el packing list online del proveedor (form + Excel branded + adjuntos + envío
versionado). El **NORTE-SYNC v4.3→v4.4** (`153fb03`) evolucionó el mockup `_norte/packlist/` a un
editor mucho más rico. Este SDD cierra el drift portando ese diseño a prod **por slices**
(handoff-first: el mockup es la fuente). Todo lo nuevo es **aditivo y backward-compatible**.

Decisiones del founder: **los 4 slices**; **persistencia = localStorage** (sin backend para
autosave/historial); plan formal previo (aprobado); identificación sigue por **token de la orden**;
el **SUBMIT versionado server-side de SDD-0096 se mantiene intacto** (mismo payload + RPC
`submit_packing_list`).

## 3. Slices (todos en `app/p/[token]/`)

### Slice A — Editor del documento v4.4 (`PackingListFormSection.tsx`)
- **Identidad CN:** header "义乌市林冠进出口有限公司 · DTD Cargo" + 2 teléfonos (fijo + móvil 186) + línea de
  dirección de bodega + folio editable.
- **SUPPLIER / CLIENT split:** proveedor (empresa/persona, email, tel/WeChat, **dirección**, **ciudad**);
  cliente (唛头/mark, nombre, **teléfono**, **email**, **fecha** con display chino `年月日`).
- **Autoguardado + historial** en **localStorage POR TOKEN** (`dtd-packlist-{token}` + `-history`, cap 12,
  debounce 600 ms + heartbeat 8 s, "Guardar versión", panel Historial con **Restaurar** reversible).
  Lógica pura testeable: `lib/studio/prealertas/packlist-draft.ts`.
- **Trilingüe** ES/EN toggle (ZH siempre visible).
- **Excel vacío (CSV)** + **PDF (imprimir)** con print-CSS.
- **Reglas de bodega** (método nuevo, sin grupo WeChat) + **footer "收货信息"** con Copiar (empresa CN +
  林冠 + `candywu@ywlgcanopy.com`, en `CONTACT.cn`).
- **Excel template** (`scripts/build-packlist-template.mjs`) al layout v4.4 (prefill C5/C6/C7/C8/I3 intacto).
- Dirección/ciudad van en el documento + localStorage; **no** se persisten server-side en V1 (follow-up).

### Slice B — Caja Padre (agrupar ítems en una caja)
- El botón "+" de una fila agrega un sub-ítem `{ same:true, qtyDirect }` en la **misma caja**. La fila
  **líder** muestra el sumatorio del grupo (qty/amount) + toggle colapsar (`+N`); la fila **hija** lleva
  ctns/perctn/wkg/cbm **readonly** y solo `qtyDirect` editable; **Nº de caja automático** (rangos
  consecutivos). Portado de `packlist.js` (`leadOf`/`groupSum`/`applyCollapse`/`recalcCartons`).
- **Lógica pura** (`packlist-form.ts`): `rowCalc` respeta `same` (qty=qtyDirect, weight/vol=0);
  `computeTotals` → la fila líder aporta cajas/peso/vol, la `same` solo qty/amount → **no doble-cuenta**
  (3 tests). `same`/`qtyDirect` viajan en el `rows` JSONB (sin migración).

### Slice C — Etiquetas QR reales + adjuntos con contador
- **QR reales** (`ProviderShareClient.tsx` · `LabelCard`): reemplaza el placeholder gris por
  `qrcode.react · QRCodeSVG` (`value=${SITE_URL}/verificar?c=<markbox>`, navy de marca), **1 por caja**;
  Imprimir/PDF + print-CSS intactos.
- **`/verificar` (`app/verificar/page.tsx`)** — destino del QR, **implementada**: página pública DB-backed
  (fuera de la frontera ESLint, como `/registro` y `/p`) que confirma si el Shipping Mark pertenece a un
  envío DTD, **sin exponer datos del cliente** (solo lee `markbox`). 4 estados: verificado / no reconocido /
  inconcluso (DB no responde) / entrada manual (sin `?c=`); CTAs WhatsApp + Rastrear; foco a11y (WCAG 2.4.7)
  + marca pública (Archivo + tokens). Input saneado a `[A-Z0-9-]` (sin comodines a la query). `noindex`.
- **Adjuntos con contador** (`SupplierUploadSection.tsx`): pastilla "N 附件 · Y doc · Z 📷" (categoriza por
  MIME) + copy reforzado (factura + packing list originales + fotos, para aduana). Route `/upload` sin cambios.
- Dep: `qrcode.react@^4.2.0`.

### Slice D — Vista Móvil (proveedor 100 % móvil)
- El v4.4 (`Vista Móvil · Packing List.html`) es **el mismo documento responsivo** (no una versión aparte):
  tabla con **scroll horizontal** + **columnas de identidad congeladas** (`#`/marca `sticky-left`), barra
  de **totales sticky**, SUPPLIER/CLIENT a 1 columna, targets de toque ≥32-40 px. **Resuelto dentro de
  Slice A** (NO stacked-cards — contradice el diseño del Norte).

## 4. Modelo de datos

**Sin migración.** `same`/`qtyDirect` (Caja Padre) y dirección/ciudad van en el `rows` JSONB / el
documento. Autoguardado e historial = **localStorage** (cliente). El SUBMIT sigue usando la tabla
`packing_list_submissions` + RPC `submit_packing_list` de **migr 0147** (SDD-0096) sin cambios.

## 5. Verificación

- `node scripts/verify.mjs` VERDE + `pnpm build` (turbopack). Unit: `packlist-form.ts` (Caja Padre, sin
  doble-conteo) + `packlist-draft.ts` (autosave/restore). Excel round-trip (`packlist.test.ts`).
- Gate por slice verificado por el orquestador (tsc 0 · next build OK · tests) — lección: el subagente
  puede reportar verde en falso (Slice A llegó con `tsc` roto en el bloque de reglas), **re-verificar
  siempre**.
- Visual: `/p/{token}` real vs el mockup (`node scripts/norte.mjs`); móvil por resize. `ui-ux-designer`
  pasó (marca OK, sin BRAND-CHECK).

## 6. Estado

Slices **A · B · C · D** implementados en `feat/packlist-v44` (commits `1e429d5` · `b58befd` · `17db4e1c`;
D dentro de A) + **diferidas cerradas**: `/verificar` real (destino del QR) + número de las reglas de
bodega en **wine**. **Sin push, sin merge.** Pendiente coordinación: merge + push. Founder: confirmar los
datos de bodega v4.4 (empresa CN, `candywu@ywlgcanopy.com`, fijo 0579) como canónicos en `CONTACT.cn`;
server-persist de dirección/ciudad = follow-up.
