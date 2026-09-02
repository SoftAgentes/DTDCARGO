---
sdd: 0360
title: Evitar que el foco tardío borre la búsqueda de destino
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0237
  - SDD-0349
confidencialidad: interno
---

# SDD-0360 — Selección de texto sin carrera en DestinoCombobox

## Evidencia y alcance

El run alojado `33660502119` pasó TypeScript/Edge, pero una de 5.958 pruebas
falló: al escribir `mara`, `DestinoCombobox` conservó sólo `a`. El foco programa
`input.select()` con `requestAnimationFrame`, sin vincularlo a la actividad del
usuario. Un frame posterior a las primeras teclas puede seleccionar el texto
nuevo y hacer que la siguiente tecla lo sustituya.

Alcance: interacción de foco/edición del selector público. No cambia estilos,
catálogo, precios, ARIA, llamadas de red, componentes Studio ni base de datos.

## Decisión

- Reproducir de forma determinista el frame retenido y liberado entre teclas.
- Seleccionar la etiqueta elegida sin diferir una modificación del texto/cursor
  al próximo frame. Conservar la selección durante el mouseup del clic inicial.
- Después de la primera interacción, respetar el cursor y la selección manual.
- Mantener Escape, navegación con flechas/Enter, búsqueda sin tildes y el slug
  seleccionado. No relajar tests ni añadir esperas para esconder la carrera.

## Allowlist exacta

- `components/DestinoCombobox.tsx`
- `components/DestinoCombobox.test.tsx`
- `docs/specs/0360-destino-combobox-focus-race/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `docs/audits/2026-09-02-codex-publicacion-y-preflight.md`
- `.agents/handoffs/2026-09-02-destino-combobox-focus-close.md`
- `.agents/handoffs/2026-09-02-ci-calidad-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Gobernanza y aceptación

- A11Y-01 / BUS-01: cumplimiento al conservar teclado, foco, búsqueda y selección
  sin sobrescritura tardía. No se declara adopción transversal del Portal/ERP.
- BTN-01: no aplica a mutaciones; el control sólo elige un destino local.
- MP-01: no aplica a persistencia; no captura, mueve ni borra datos personales.
- Marca/Norte: no hay cambio visual sustancial, tokens, layout o tipografía.
- Unitarios deterministas fallan antes y pasan después: escritura antes del
  primer frame, frame entre letras, Escape y cursor manual posterior.
- Suite completa, TypeScript, lint, docs/numeración, componentes/gobernanza y
  build pasan; comprobar el flujo también en navegador local.
- Push de rama y CI separados de integración, migraciones y producción.

## Estado

Cerrado técnicamente en rama, pendiente de CI alojado completo e integración.
La migración libre 0417 no se utiliza.

Evidencia: 2 fallos deterministas antes del cambio; 13/13 focales y 5.961/5.961
unitarios completos después. TypeScript sin caché, ESLint, docs/numeración,
componentes y gobernanza aprobados. Build aislado sin secretos: 158 páginas,
postbuild y restauración de `tsconfig.json` correctos. Navegador local verificó
escritura, Escape, cursor manual y selección con Enter contra un backend
deny-only. No se relajaron los 10 tests existentes. Detalle en
`.agents/handoffs/2026-09-02-destino-combobox-focus-close.md`.
