---
sdd: "0306"
title: "El packing list del proveedor llega al cliente"
status: in-progress
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0057","0096","0097","0173"]
confidencialidad: interno
---

# DTD-0306 — El packing list del proveedor llega al cliente

> El proveedor llena su packing list en el enlace que le manda el cliente. El
> equipo lo lee en el Studio. El cliente —para quien se llenó el documento— era
> el único que no podía verlo. Peor: el portal ya le decía que existía, con un
> chip verde que no abría nada.

## 1. Lo que se midió

Todo lo de abajo se comprobó contra el código y las migraciones, no se recordó.

| Hecho | Evidencia |
|---|---|
| El packing list del proveedor vive en `packing_list_submissions` | migr `0147_supplier_packing_uploads.sql:36` |
| Esa tabla tiene RLS activa y **sólo dos** policies: `by tenant` y `service_role` | migr `0147:91`, `0147:94`, `0147:101` |
| El cliente del portal **no tiene fila en `user_tenants`** | [`project-portal-producto`] · arquitectura de aislamiento SDD-0042 |
| ⇒ con la sesión del cliente, la RLS **niega**: la consulta vuelve vacía, siempre y en silencio | RLS activa sin policy aplicable |
| El portal muestra un chip "Packing list ✓" por compra | [`PortalAlertasHub.tsx:340`](../../../app/portal/(app)/envios/_components/PortalAlertasHub.tsx) |
| Ese chip era un `<div>` — anunciaba el documento sin manera de abrirlo | mismo archivo, `DocsPanel` |
| Y su verdad salía **sólo** de `prealerta_documents` (archivo adjunto) | [`envios/page.tsx:75`](../../../app/portal/(app)/envios/page.tsx) |
| ⇒ un proveedor que llenó el formulario online dejaba el chip **en gris** con el documento ya enviado | las dos fuentes nunca se cruzaban |
| `/portal/documentos` promete "BL · Packing List · Facturas · POD" | [`documentos/page.tsx:86`](../../../app/portal/(app)/documentos/page.tsx) |
| …pero lista `shipment_documents`, que es lo que sube el equipo | `listMyDocuments` en `lib/portal/portal-queries.ts:316` |

En resumen: **dos promesas de interfaz sin respaldo** y un documento que existía
para todos menos para su destinatario.

## 2. Alcance

### Entra

1. **Leer el packing list vigente de una compra** desde el portal.
2. **Mostrarlo** en `/portal/compras/[code]`, línea por línea y con totales.
3. **Cotejarlo** contra las cajas que el cliente anunció, mostrando el desajuste.
4. **Arreglar el chip** del hub: que diga la verdad (las dos fuentes) y que abra
   el documento.
5. **Estado de espera** explícito cuando el proveedor todavía no lo mandó.
6. **Sumarlo a `/portal/documentos`** (decisión del founder, 2026-08-26), que
   prometía «Packing List» en su bajada y no lo listaba.

### No entra

- **No se toca la RLS de producción.** No hay migración en este SDD (§4).
- No se toca el formulario del proveedor (`/p/{token}`), ni el Studio, ni el
  packing list como PDF descargable.

## 3-bis. La sección global de Documentos

`/portal/documentos` leía **sólo** `shipment_documents` y su bajada prometía
«BL · Packing List · Facturas comerciales · POD. Los carga nuestro equipo».
Medido, esa frase fallaba por partida doble:

- **El tipo no existía.** `ShipmentDocType` es `"bl" | "pod" | "otro"`
  (`lib/studio/shipment-document-types.ts:10`). Nunca hubo un `packing` ni una
  «factura comercial» en esa tabla: la bajada nombraba tipos que el modelo de
  datos no contempla.
- **Y el autor tampoco.** El packing list no lo carga el equipo — lo llena el
  proveedor.

Ahora la pantalla cruza las dos fuentes y ordena todo por fecha en una sola
lista. Tres decisiones que valen la pena:

1. **Un packing list no es un archivo.** Los demás documentos son objetos en
   Storage con URL firmada; éste son filas de una tabla. Su destino es una ruta
   interna, así que la tarjeta dice **«Ver»** y no «Descargar», y navega dentro
   del portal en vez de abrir pestaña nueva (`kind: "abrir"`). Tratarlo como
   archivo le mentiría al cliente sobre lo que va a pasar al tocarlo.
2. **Cuelga de una compra, no de un envío.** El subtítulo dice «Compra PRE-…» y
   el buscador acepta ese código (`purchaseCode` entra en `filterDocs`). Un
   documento que no se encuentra por su código es, para el cliente, un documento
   que no está — y el fallo es mudo: la pantalla no se rompe, devuelve cero.
3. **Etiquetas propias**, no `shipmentDocTypeLabel("packing")`: ese enum no
   tiene el valor y habría devuelto el genérico «Documento».

## 3. Allowlist exacta

| Archivo | Acción |
|---|---|
| `lib/portal/packing-list-queries.ts` | nuevo |
| `lib/portal/__tests__/packing-list-queries.test.ts` | nuevo |
| `app/portal/(app)/compras/[code]/_components/PackingListDelProveedor.tsx` | nuevo |
| `app/portal/(app)/compras/[code]/page.tsx` | edita — carga y renderiza la sección |
| `app/portal/(app)/envios/page.tsx` | edita — presencia real del packing list |
| `app/portal/(app)/envios/_components/PortalAlertasHub.tsx` | edita — chip clicable |
| `lib/portal/documentos-filter.ts` | edita — `purchaseCode` + `kind` |
| `lib/portal/documentos-filter.test.ts` | edita — 5 pruebas del caso compra |
| `app/portal/(app)/documentos/page.tsx` | edita — cruza las dos fuentes |
| `app/portal/(app)/documentos/DocumentsClient.tsx` | edita — «Ver» vs «Descargar» |
| `docs/specs/0306-packing-list-en-el-portal/spec.md` | nuevo |

## 4. Decisión de acceso: admin client, no policy nueva

Había dos caminos para que el cliente pudiera leer la tabla:

**(a) Una policy nueva** de portal sobre `packing_list_submissions`, por
markbox. Es el patrón de `shipment_events` (migr 0196) y Academia (0145).

**(b) Admin client tras probar la propiedad.** Es el patrón de las recepciones
de bodega (`purchase-reception-queries.ts`) y de las consolidaciones en el
detalle de envío.

**Se eligió (b).** Razones, en orden:

1. **Es el patrón que ya vive en esta misma pantalla.** `/portal/compras/[code]`
   ya lee `warehouse_receipts_cn` así. Meter un segundo mecanismo de acceso en
   una pantalla que ya tiene uno la vuelve más difícil de auditar, no menos.
2. **No toca producción.** Una policy nueva es una migración, y una migración
   necesita el OK del founder nombrándola y una ventana de aplicación. Esto se
   despliega con el código.
3. **El control de acceso queda en un solo lugar legible**: la página prueba la
   propiedad una vez y de ahí bajan todas las lecturas.

El riesgo de (b) es conocido y es que el admin client **no tiene red de
seguridad**: si el llamador se equivoca de id, la RLS no lo va a atajar. Se
mitiga en tres capas:

- `getPrealertaByCode(userClient, code, { markbox })` corta con 404 antes de
  llegar a la lectura;
- la query recibe el markbox y **descarta** cualquier submission que traiga otro;
- el módulo lleva el aviso 🔴 en la cabecera, igual que su vecino, para que no se
  reuse sin leer el contrato.

## 5. Gobernanza aplicable

| Política | Cómo se cumple | Clasificación |
|---|---|---|
| **TBL-01** §móvil | Once campos por fila no caben en 375px. Tabla `<table>` en ≥md; **tarjeta por fila** en teléfono, con los mismos datos. No hay versión móvil recortada. | cumplimiento |
| **TBL-01** §encabezados | Los encabezados declaran la unidad: `Peso (kg)`, `CBM`, `Uds/caja`. | cumplimiento |
| **TBL-01** §vacío | "Sin packing list" y "packing list sin líneas" son **dos estados distintos** con dos textos distintos. | cumplimiento |
| **TBL-01** §sort/filtro/paginación | La tabla no ordena ni filtra ni pagina: es un documento, y su orden es el que le dio el proveedor. Reordenarlo sería alterarlo. | no aplica |
| **A11Y-01** · WCAG 2.1.1 | El contenedor con scroll lleva `tabIndex={0}` + `role="region"` + nombre accesible: sin eso las columnas de la derecha son inalcanzables por teclado. | cumplimiento |
| **A11Y-01** · WCAG 1.4.1 | El cotejo no se comunica por color: lleva ícono **y** la frase con el número exacto. | cumplimiento |
| **VIS-02** | El nombre chino del producto va en `--font-noto-sc` con `lang="zh-Hans"`. | cumplimiento |
| **VIS-01** / `BRAND.md` | Sólo tokens `var(--*)`. El importe destacado usa `--color-wine-text` (BD-026), que es wine **como texto** y no voltea en el portal oscuro; `--color-wine` sí lo haría. | cumplimiento |
| **LNK-01** | El chip navega dentro del portal, misma pestaña. No hay cambio de contexto que señalizar. | no aplica |
| **CMP-01** | No se crea componente candidato a canónico: es una pantalla de un solo uso. Cero consumidores nuevos de un `deprecated`. | cumplimiento |
| **ERR-01** / **LOD-01** | Server component: no hay estado de carga que gestionar. El fallo de lectura degrada a "todavía no lo envió", que es el estado que ya se mostraba. | cumplimiento |

## 6. Verificación

- [x] `pnpm test lib/portal/__tests__/packing-list-queries.test.ts` — 7/7
- [x] **Mutación**: `<= 0` → `< 0` y `Math.round` → `Math.trunc` tumban 2 de 7.
      Los tests muerden; no son decorativos.
- [x] **`node scripts/verify.mjs` → `EXIT=0` · TODO VERDE (15/15 pasos medidos)**
      · unit **5769/5769** en 490 archivos · e2e **150 pasadas**, 18 saltadas
      (Tier 3 con seed) · ningún paso omitido.
- [x] Contraste WCAG medido en los DOS temas sobre el shell real del portal:
      **0 fallos** en 38 elementos (30 de la tabla + 8 de las tarjetas móviles).
      Peor caso 4,85:1 (oscuro) y 5,11:1 (claro), sobre el umbral de 4,5.
- [x] Scroll de la tabla **probado**, no inspeccionado: la región recibe foco y
      `scrollLeft` avanza. A 768 px la tabla desborda su región **sin** abrir
      scroll horizontal en la página (753 = 753 px).
- [x] 375 · 768 · 1265 px sin desborde horizontal; en teléfono la tabla se
      oculta y las 8 tarjetas conservan todos los campos.

### Dos bugs que sólo aparecieron al medir el render

1. **Contraste 1,11:1** en el número de caja. En el tema oscuro del portal
   `--color-white` y `--color-ink` voltean; ese `<span>` no llevaba clase de
   color y heredaba un navy fijo que no voltea con ellos — navy sobre navy. Con
   `text-ink`: **13,08:1**.
2. **Dos separadores decimales en la misma pantalla.** La tabla usaba `es-VE`
   (`85,2 kg`) sobre una pantalla cuyo `medida()` usa `en-US` (`85.2 kg`).
   Alineado a `en-US`, con decimales fijos por magnitud.

### Nota de método

El banco de medición se montó bajo `/portal/probe-0306`, fuera del grupo
`(app)` — el proxy sólo corta `/studio` y `/back`, así que no pide sesión — con
el div del tema copiado literal de `(app)/layout.tsx:72-76`, incluida la
variable de JetBrains Mono. Lo único sintético fue el contenido. Se borró al
terminar y `git status` lo confirma.

⚠️ El gate falló una vez en `build` con `ENOENT` sobre un `.tmp` de
`.next-verify`. **No era el código:** había dos `verify.mjs` solapados sobre el
mismo directorio. Corriendo uno solo, verde.

## 7. Hallazgos abiertos (no se corrigen acá)

1. ✅ **Cerrado** — `/portal/documentos` ya lista el packing list (§3-bis).
   Decisión del founder el 2026-08-26.

2. **El número SDD-0281 lo reclaman DOS trabajos, y los dos están en `main`.**
   Medido el 2026-08-26 con `origin/main` fresco:

   | Commit | Hora | Trabajo | ¿Spec? |
   |---|---|---|---|
   | `b5af1821` | 06:35:01 | Detalle de compra del portal (bodega de Yiwu) | ❌ **ninguna** |
   | `3fce82a9` | 06:43:30 | Estado de cuenta / carril comercial | ✅ `0281-documentos-del-carril-comercial` |

   Dos ventanas trabajaron en paralelo el mismo día y ambas tomaron el 0281,
   con 8 minutos de diferencia.

   **La regla de siempre no aplica.** «Se mueve la que NO está en `main`» sirve
   cuando una de las dos todavía es local; acá las dos están publicadas.

   **Y el gate no puede verlo:** `check-numbering.mjs` compara **carpetas** de
   spec y de migración. Como el trabajo del detalle de compra nunca creó
   carpeta, no hay duplicado que detectar y `numbering` sale verde — el
   correlativo tampoco muestra hueco. El punto ciego es la cita en comentarios,
   que ningún paso mira.

   **Alcance real:** de los ~20 archivos que citan `SDD-0281`, la gran mayoría
   (cotizador, facturación, cobranzas, dashboard, clientes, PDFs, export CSV)
   pertenece legítimamente a la spec que sí existe. **Sólo 4** citan el número
   por el otro trabajo: `lib/portal/purchase-reception-queries.ts`,
   `app/portal/(app)/compras/[code]/page.tsx`,
   `app/portal/(app)/compras/ComprasList.tsx` y una mención en
   `app/studio/(app)/cn/actions.ts`.

   **Recomendación:** no tocar la spec 0281 —es la dueña legítima, tiene carpeta
   y 16 archivos la citan bien— y darle al detalle de compra **un número propio
   con spec retroactiva** que documente lo ya construido, corrigiendo esas 4
   citas. Es un cambio barato y sin riesgo de runtime. Queda a decisión del
   founder porque toca trabajo de otra ventana.
