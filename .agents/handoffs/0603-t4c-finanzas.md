# Handoff · SDD-0603 · T4c Finanzas y compras (adopción de `Aviso`)

- **Owner:** Worker T4c (`w-0603-t4c`), sesión abierta por el Subdirector Rebrand.
- **Ruta:** `.claude/worktrees/0603-t4c-finanzas-8a1392`
- **Rama:** `claude/0603-t4c-finanzas-8a1392`, desde `claude/tren-ae` @ `4441f65ac` (tren #540, ola 1, trae `Aviso`).
- **SDD:** 0603 «Claridad de controles», tramo 4c; componente de SDD-0628.
- **Objetivo:** los avisos hechos a mano del grupo Finanzas y compras pasan a `<Aviso>` (BD-037: franja plana con ícono, sin contorno).
- **Alcance:** allowlist exacta de 47 archivos (`rebrand-0603-allowlist-t4c-4441f65ac.txt` en las notas del Subdirector), más `.test` vecinos, `docs/specs/0603-claridad-controles/tramo-4c.md` y este handoff.
- **Permisos:** push de la rama propia y PR lista para revisión contra main. Prohibido fusionar, imagen de prueba y producción.
- **Corrección del DG (vía Subdirector, 2026-11-14):** Auto-fix **apagado** en la PR. El DG trae main una sola vez cuando arma el tren; este Worker no trae main.

## OBJETIVO ORIGINAL

Reemplazar por `<Aviso>` las cajas de aviso hechas a mano de los 47 archivos, sin tocar pills, textos, montos ni nada fuera de la allowlist.

## COMPLETADO

- 43 archivos convertidos, 62 `<Aviso>`. 4 «no aplica»: `ExpenseRowActions`, `BuilderView` y `CustomsFilingsList` (sin aviso real) y `nomina/form-bits` (bloqueado por `tabIndex`). Detalle por archivo en `tramo-4c.md`.
- `reportes/__tests__/estado-gerencial-mezclado.test.tsx`: `note` → `status`, porque la nota es ahora `Aviso`.
- Contrato nuevo `app/studio/(app)/__tests__/avisos-finanzas-contract.test.ts`, con cuenta exacta por archivo, tabla de excepciones con motivo y cuatro mutantes.
- `/ui-check`: OK para commit. Sin hex, colores ni CSS nuevos.
- La conversión se repartió en tres subagentes con archivos disjuntos. El Worker revisó el diff completo: textos conservados, ningún `tabIndex`, `id` ni `aria-*` perdido y ningún import sin uso.

## VALIDACIÓN

| Comprobación | Estado |
|---|---|
| `git diff --check` | PASÓ |
| Diff = allowlist + test vecino + contrato + docs | PASÓ (revisado con `git diff --name-only` contra la lista) |
| `/ui-check` | PASÓ (advisory, 4 notas menores en `tramo-4c.md`) |
| `pnpm install --frozen-lockfile` | PASÓ (con turno del Subdirector) |
| Vitest focal: los 16 módulos del tramo, `app/studio/(app)/__tests__`, `avisos-contract`, `frontend-state-contract`, `drawer-derived-state-contract`, `payment-report-ui` | PASÓ, 50 archivos y 479 pruebas. En la primera corrida fallaron 2, ambas del contrato nuevo, cuyo regex no veía los ternarios. Corregido y vuelto a correr: 7/7. |
| Mutantes del contrato | PASÓ: los cuatro rompen la regla |
| `tsc --noEmit -p .` | PASÓ (exit 0) |
| eslint `--max-warnings=0` sobre el diff | PASÓ (exit 0) |
| `pnpm verify` | NO EJECUTADO: el portón es el CI de GitHub |
| Vista en pantalla (claro, oscuro, compacto) | NO DISPONIBLE: va en la imagen de prueba, fuera de este encargo |

## COMMITS

- `e26cf19b2` feat(studio): SDD-0603 — tramo 4c, avisos de Finanzas y compras en Aviso

## PR / BRANCH

Pendiente: push y PR lista para revisión después del vitest focal.

## PENDIENTES DE ESTA TAREA

1. Revisión independiente del DG y armado del tren. Al armarlo, el DG trae main.
2. Ver en la imagen de prueba, en claro, oscuro y compacto, antes de fusionar.

## Decisiones para la revisión

- `PartnerAlertsBanner` y «Alerta SENIAT» pasan a `role="alert"` por ser tono error. Si no deben interrumpir, la alternativa es `atencion`.
- En `cotizador/[code]/page` se quitó el «✓» que duplicaba el ícono de éxito.

## FUERA DE ALCANCE DETECTADO

- `Aviso` no acepta `tabIndex`. `useDialogA11y` enfoca `[role="alert"][tabindex="-1"]`, así que `nomina/form-bits` (`ErrorBox`) no se puede convertir sin ampliar `Aviso.tsx`. Lo mismo valdría para cualquier aviso que deba recibir el foco.
- `EmpleadoDrawer.tsx:123` usa `ErrorBox` para `state.accessWarning`, que es una advertencia y no un error.
- Mensajes de 11,5 px en color de estado que ocupan el lugar de un select («No hay cuentas…», en `BillDrawer`, `PoDrawer` e `InvoiceDetailClient`): son texto de campo y quedaron. Podrían revisarse con el criterio de mensajes de campo.

## Impacto documental

`tramo-4c.md` nuevo. Sin cambios en `spec.md`, el registro ni el índice. Graphify, Archify y Obsidian no se tocaron: el cierre documental lo hace el Director desde main integrado.
