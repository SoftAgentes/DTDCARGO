---
sdd: "0171"
title: "Portal — datos de bodega CN, filtros de Documentos y armazón unificado"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-28
updated: 2026-08-02
supersedes: null
superseded_by: null
related: ["0042", "0057", "0093", "0116", "0169", "0170"]
confidencialidad: interno
---

# SDD-0171 — Portal · tanda de ganancias baratas

## 1. Decisión aprobada

Tercera tanda de la **Fase 7 del Revestido**: tres arreglos de bajo riesgo del
portal contra el Norte, ninguno con migración.

## 2. Alcance

### 2.1 Datos de la bodega CN — un solo componente, el bueno

Había **tres** piezas pintando la misma dirección de Yiwu:

| Componente | Dónde | Qué daba |
|---|---|---|
| `ChinaSupplierClip` | Home del portal · `/contacto` | Texto para pegar en **WeChat** |
| `WarehouseAddressCard` (local) | `/portal/proveedores` | 5 campos, **una** copia a granel |
| `AlibabaAddressGuide` | `/shipping-mark` · FAQ · lección de Academia | **9 campos** bilingües, copia campo por campo, "Copiar todo", plegable |

`WarehouseAddressCard` era un subconjunto estricto del tercero. Se **elimina** y
`/portal/proveedores` pasa a usar `AlibabaAddressGuide`.

`ChinaSupplierClip` **se queda**: resuelve otro momento (hablarle al proveedor por
WeChat), no el de llenar un formulario de compra.

Para poder montarlo en el portal hubo que arreglar tres cosas del componente:

1. **`markbox` opcional** (mismo patrón que `ChinaSupplierClip`): en el portal el
   código ya se conoce → se muestra, no se pide. Sin la prop, las páginas
   públicas mantienen el input. Retrocompatible.
2. **`text-white` → `--color-on-accent`** en "Copiar todo". En el tema oscuro del
   portal `--color-white` vale navy, así que el botón habría quedado
   navy-sobre-wine — el bug ya documentado. Medido después del arreglo: **4.96**.
3. **`MARK_BG` mezclaba con `#ffffff` literal** → `var(--color-white)`, para que
   el bloque del mark no quede como un parche claro sobre la tarjeta oscura.
   Shipping Mark medido: **6.12**.

### 2.2 Documentos con filtros

Era una grilla pelada: con 30 documentos de 8 envíos, encontrar un BL era ir a
ojo. Ahora **chips por tipo con conteo** + **buscador**, como el Norte.

- `lib/portal/documentos-filter.ts` — lógica PURA (12 tests): `normalize()` con
  **NFD** (sin ella "aduana" no encuentra "Aduaná" y el buscador parece roto),
  `buildTypeChips()` (solo ofrece tipos presentes) y `filterDocs()` (busca por
  etiqueta larga, corta y código de envío).
- `DocumentsClient.tsx` — solo estado de interfaz. El servidor manda las filas ya
  aplanadas (etiquetas, meta y signed URL resueltas) para no arrastrar tipos de
  `lib/studio` al cliente.

Verificado en navegador: `FÁCTURA`→1 · `0288`→1 · `lading`→2 · `zzz`→estado vacío.

### 2.3 Armazón de Academia y Club

Las dos traían contenedor propio (`max-w-3xl mx-auto`) y `<h1>` de 24px, cuando
el resto del portal usa `eyebrow` + `h-display` sobre el `wrap` del layout: se
leían como otro producto. Pasan al patrón común.

## 3. Fuera de alcance · DESIGN-CHECK pendientes

- **`AlibabaAddressGuide` en el Home** (que es donde el Norte lo pone, como
  `PortalBuyWebData`): ahí ya vive `ChinaSupplierClip`, y apilar dos tarjetas con
  la misma dirección se lee como ruido. **Requiere decisión del founder** sobre
  cuál va en el Home y con qué encuadre. Por eso se montó en Proveedores, donde
  reemplaza a un duplicado peor sin inventar diseño.
- **"Reportar pago" como destino del nav** (el Norte lo lista en FINANZAS): el
  prototipo del Norte **no implementa** esa vista (`window.PortalReportarPago` no
  existe en `_norte`), así que construirla sería inventar. Hoy la capacidad es
  alcanzable desde el menú "Crear" → "Reportar un pago" y desde cada factura.
- Fusionar comprobantes de pago dentro de Documentos (el Norte lo hace): es otra
  fuente de datos, no cabe en esta tanda.

## 4. Verificación

- `node scripts/verify.mjs` verde.
- 12 tests nuevos en `documentos-filter.test.ts`.
- Revisión en navegador (claro + oscuro) con datos de andamiaje: contraste medido
  y filtrado probado extremo a extremo.
