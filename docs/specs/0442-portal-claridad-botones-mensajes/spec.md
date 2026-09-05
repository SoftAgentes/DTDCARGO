---
sdd: 0442
title: Portal del cliente - claridad de botones y mensajes
status: in-progress
author: Codex
created: 2026-09-05
updated: 2026-09-05
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
trabajan perfil; 28 arnés; no se modifican esos archivos. El índice SDD generado
lo regenera coordinación, según runbook multiventana.

## Evidencia

Ver [evidence.md](evidence.md), con límites y clasificación por criterio.
