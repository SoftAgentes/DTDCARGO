---
sdd: 0360
title: Evitar que el foco tardío borre la búsqueda de destino
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-05
supersedes: null
superseded_by: null
related:
  - SDD-0237
  - SDD-0349
  - SDD-0444
confidencialidad: interno
---

# SDD-0360 — Selección de texto sin carrera en DestinoCombobox

## Evidencia y procedencia

Extracción selectiva de 46afa953633507c1f506f2a879f3d8431155f2ad (PR #21),
sobre main b8294664a1b4f9e25c423dd814f4813fa5b1be8f. La spec se reutiliza;
no se incorpora el commit completo ni sus auditorías/handoffs históricos.

El foco original programa input.select() con requestAnimationFrame. Si ese
frame llega después de las primeras teclas, selecciona la búsqueda nueva y
la siguiente tecla la reemplaza. El Director informó los fallos alojados
34000203916 (#34) y 34000219160 (#32), ambos antes de Escape en el test que
espera mara. Componente/test coinciden con main en esas bases.

La evidencia histórica de #21 no valida esta extracción: se generan regresiones
deterministas y comprobaciones nuevas sobre las combinaciones entregadas.

## Decisión

- Seleccionar la etiqueta elegida durante onFocus, antes de la primera tecla.
- Conservar la selección en el mouseup del clic inicial mediante una ref.
- Invalidar esa intención al escribir, presionar una tecla o salir del control;
  respetar después el cursor y la selección manual.
- Mantener Escape, flechas/Enter, búsqueda sin tildes y el slug seleccionado.
- No relajar tests ni añadir esperas para ocultar la carrera.

## Allowlist exacta de la extracción

- components/DestinoCombobox.tsx
- components/DestinoCombobox.test.tsx
- docs/specs/0360-destino-combobox-focus-race/spec.md
- docs/specs/README.md (generado)
- .agents/handoffs/2026-09-05-destino-focus-extract.md

En A/B solo se amplía coordinación en sus handoffs vigentes y specs0349/0444
para incorporar esta dependencia. Workflow y gates permanecen intactos.

## Gobernanza

- cumplimiento: A11Y-01/BUS-01, foco/teclado/búsqueda/selección sin borrado tardío;
  verificar el flujo acotado, sin afirmar conformidad transversal del producto.
- no aplica: BTN-01 sobre mutaciones, MP-01 y privacidad: selección local sin
  nueva captura, movimiento ni borrado de datos personales, persistencia o red.
- cumplimiento: BRAND leída; no cambiar estilos, tokens, copy, layout o fuentes.
- no aplica: diseño nuevo/Norte/ui-check visual sustancial; se conserva el diseño.

## Aceptación

- [x] Dos regresiones deterministas fallan con componente original: escritura
  antes del primer frame y frame entre letras.
- [x] Pasan 13 tests focales: las 10 pruebas previas más las tres del origen,
  incluyendo Escape y cursor manual después de editar.
- [x] Navegador local con fixture ficticio comprueba foco, escritura, Escape,
  flechas/Enter, clic y cursor; sin credenciales ni datos reales.
- [ ] Combinación final pasa gates aplicables de pnpm verify; registrar cada
  fallo/SKIP externo. Suite/build se reutilizan solo con equivalencia demostrada
  del árbol de producto; docs/gates afectados se verifican después de coordinar.
- [x] Compatibilidad textual con #31 648bddf6 informada por Director sobre
  copias temporales; no prueba integración/validación visual completa de #31.
- [ ] Producto en commit identificable, merges locales A/B y handoff con SHA.

## Autorización y entrega

Trabajo, pruebas y commits/merges locales selectivos. Los pushes/actualizaciones
de PR están reservados al Director después de revisar SHA. Sin merge main,
producción, ledger con credenciales, migraciones, rulesets/secrets ni cleanup.

[Handoff de esta extracción](../../../.agents/handoffs/2026-09-05-destino-focus-extract.md).
