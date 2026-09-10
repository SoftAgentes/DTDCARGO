---
sdd: 0442
title: Portal del cliente - claridad de botones y mensajes
status: in-progress
author: Codex
created: 2026-09-05
updated: 2026-09-10
supersedes: null
superseded_by: null
related: [0057, 0170, 0171, 0308, 0313]
confidencialidad: interna
---

# SDD-0442 · Claridad del portal

## Alcance autorizado

Sam solicita claridad en Mis envíos/documentos, consistencia de controles y
jerarquía en Proveedores/Nueva compra. Entrega por PR, sin merge ni despliegue.
Base b8294664. Número obtenido con pnpm sdd:next después de que colores registrara
0441. Rama codex/portal-claridad-botones-mensajes, worktree propio.

## Criterios

- Contador documental separado del botón Ver/Ocultar documentos, chevron,
  aria-expanded y aria-controls con destino estable.
- Pendiente explícito sin falsa descarga. Packing disponible conserva su
  navegación a la compra. Factura/foto sin URL siguen siendo información.
- Gestionar documentos y etiquetas conserva destino y gana énfasis.
- Filtros con selección visible y anunciada; controles touch de al menos 44 px.
- Cabecera alineada al inicio junto a Mis envíos, Nueva compra primero;
  secundarios con superficie y borde perceptibles en claro/oscuro, hover
  diferenciado y respuesta de presión sin añadir tokens globales.
- Ayuda secundaria después de proveedores y acción de alta. Re-comprar dice
  Nueva compra con este proveedor. Cambiar identifica al proveedor.
- Registrar compra conserva su operación y etiqueta; no se toca persistencia,
  numeración, permisos, enlaces de proveedores, Excel, packing list ni backend.

## Contrato y gobernanza

BTN-01, A11Y-01, VIS-01, CMP-01, LNK-01. Se conservan primitivas nativas,
Icon y variantes btn existentes; no hay componentes nuevos ni adopción de
componentes deprecated. El Norte v4.6 informa estructura; BRAND.md rige tokens.
Las discrepancias históricas de tipografía no se propagan: no cambian fuentes.

Acciones de este slice: filtros y desplegables son button, rutina sin
persistencia, auditoría ni fricción aplicables (estado local reversible).
Ver/gestionar/nueva compra son enlaces de navegación autenticada, sin mutación
hasta el formulario destino. Errores/carga de backend no cambian. Cambiar proveedor
conserva handler y requisitos existentes. La ayuda usa details/summary nativo.

## Allowlist exacta

- app/portal/(app)/envios/_components/PortalAlertasHub.tsx
- app/portal/(app)/envios/_components/PortalAlertasHub.test.tsx
- app/portal/(app)/documentos/DocumentsClient.tsx
- app/portal/(app)/documentos/DocumentsClient.test.tsx
- app/portal/(app)/proveedores/SuppliersClient.tsx
- app/portal/(app)/proveedores/SuppliersClient.test.tsx
- app/portal/(app)/compras/nueva/SupplierPicker.tsx
- docs/specs/0442-portal-claridad-botones-mensajes/spec.md
- docs/specs/0442-portal-claridad-botones-mensajes/evidence.md
- docs/specs/README.md (generado; adopción Director/Worker)
- .agents/handoffs/pr30-adopcion-validacion-20260905.md

- docs/specs/0442-portal-claridad-botones-mensajes/qa/index.html
- docs/specs/0442-portal-claridad-botones-mensajes/qa/fixture.tsx
- docs/specs/0442-portal-claridad-botones-mensajes/qa/serve.mjs
- docs/specs/0442-portal-claridad-botones-mensajes/qa/check.mjs
- docs/specs/0442-portal-claridad-botones-mensajes/assets/desktop-light.png
- docs/specs/0442-portal-claridad-botones-mensajes/assets/desktop-dark.png
- docs/specs/0442-portal-claridad-botones-mensajes/assets/mobile-light.png
- docs/specs/0442-portal-claridad-botones-mensajes/assets/mobile-dark.png
- docs/specs/0442-portal-claridad-botones-mensajes/assets/before-desktop-light.png

- app/portal/_components/NewPurchaseButton.tsx

## Coordinación

Colores confirmó no tocar estos componentes; sí cambia tokens globales y badges
compartidos. Revalidar contraste después de integrar esa rama. Los PR 23/27
trabajan perfil; 28 arnés; no se modifican esos archivos. En la adopción
Director/Worker, el índice SDD se regenera en esta rama por asignación del
Director. La fase de adopción autoriza solo commits locales, sin push ni release.

## Evidencia

Ver [evidence.md](evidence.md), con límites y clasificación por criterio.

## Restauración de la decisión founder · 2026-09-10

PR #30 reordenó la ayuda de Proveedores dentro de un `<details>` cerrado y, sin
declararlo como decisión de producto, ocultó al cargar el par que Sam había
fijado el 2026-07-28 para el momento «estoy comprando en China»:
`AlibabaAddressGuide` y `ChinaSupplierClip`. Este slice restaura esa decisión;
no es un ajuste cosmético ni un rediseño.

La reparación saca **el par completo y su comentario de decisión** del
`<details>` y lo deja, todavía junto, después de la lista/alta de proveedores y
antes de la ayuda secundaria. El `<details>` conserva cerrado por defecto la
explicación «Por qué registrar a tu proveedor importa», su mensaje asociado y
`GuiaAlibabaCard`. Este reparto preserva el reordenamiento autorizado por
SDD-0442 —proveedores y alta antes de ayuda secundaria— sin convertir una ayuda
operativa inmediata en contenido que el cliente deba descubrir.

El test de `SuppliersClient` fija las dos mitades de la decisión: el par está
visible y fuera del `<details>` al cargar; la ayuda secundaria sigue plegada,
después de la recompra y del alta, y la recompra conserva el proveedor en su URL.

### Gobernanza y allowlist de este slice

`AGENT-BRIEF` exige SDD y allowlist exacta para cambios de comportamiento; esa
secuencia también aplica en Portal. Se reutiliza SDD-0442 y, para esta
restauración, el alcance queda limitado a:

- `app/portal/(app)/proveedores/SuppliersClient.tsx`
- `app/portal/(app)/proveedores/SuppliersClient.test.tsx`
- `docs/specs/0442-portal-claridad-botones-mensajes/spec.md`
- `docs/specs/0442-portal-claridad-botones-mensajes/evidence.md`
- `docs/specs/0442-portal-claridad-botones-mensajes/assets/*.png`
- `.agents/handoffs/a5-1-direccion-bodega-cn-visible.md`

Clasificación: `cumplimiento` de A11Y-01 al conservar el `<details>/<summary>`
nativo, su teclado y foco; `cumplimiento` de VIS-01 al restaurar jerarquía sin
tokens, fuentes ni tratamientos nuevos; `no aplica` BTN-01, CMP-01 y LNK-01
porque no cambia una acción, no crea/reemplaza componentes y no altera enlaces.
