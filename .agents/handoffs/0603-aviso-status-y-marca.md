# 0603 — enmienda de cierre: aviso `status` y marca al día

- **Owner/sesión:** Worker `worker-0603-aviso` · **Rama:** `codex/0603-aviso-status-y-marca` · **SDD:** 0603 (enmienda de cierre, allowlist en `spec.md`)
- **Base:** `origin/main` 540d607f8. Sin base de datos ni producción.

## OBJETIVO ORIGINAL
Dos decisiones de Sam (2026-11-15, chat del Director General): (1) aviso de créditos sin liberar en `status` en las dos pantallas; (2) documentos de marca dejan de decir «por tramos», y la excepción de selección en tinta se mantiene.

## COMPLETADO
- `StrandedCreditsBanner` (`FidelizacionClient.tsx`): `urgente` fuera; ahora `status`, igual que la factura. Comentario con la decisión.
- Contrato `avisos-t4d-contract.test.ts`: nuevo bloque que exige que el banner no lleve `urgente` y un mutante que lo devuelve.
- `BRAND.md` §Controles y `BRAND-DECISIONS.md` (BD-037, índice): «Adoptada en producción el 2026-11-15 … siete pantallas … PR #318». Excepción a VIS-01 §3 registrada como revisada y mantenida (BD-037 y spec).
- `spec.md`: sección «Enmienda de cierre» con allowlist; quitados de pendientes el aviso y la revisión de la excepción. `tramo-5e.md` «Roles vivos»: decisión anotada.

## VALIDACIÓN
- vitest (contrato 4d, annual-billing de Fidelización, `Aviso`): PASÓ, 3 archivos, 104/104, tras la revisión independiente. Historia: en una corrida intermedia fallaba 1 de 104 (103/104) el mutante propio, porque mi script había metido caracteres de retroceso (``) en una regex del test y la aserción no coincidía. Lo corregí. La revisión pidió además que el mutante corra la misma regla sobre el texto mutado y espere que falle: hecho (`bannerEsStatus`). El «80/80» que dije antes era de solo dos archivos; el resultado vigente es 104/104.
- `tsc --noEmit`: PASÓ.
- `pnpm docs:check`: PASÓ (índice sincronizado con 619 specs).
- `pnpm sdd:check`: PASÓ (sin números repetidos; los choques históricos ya aplicados en prod salen como aviso, no como fallo).
- `/ui-check` sobre el diff: el único cambio visual es quitar `urgente` (el rol pasa de `alert` a `status`; el aspecto no cambia). Sin hex, sin fuentes, sin espaciado nuevo. Veredicto: OK para commit.
- Observación de la revisión atendida: `tramo-4d.md` decía «urgente» para el banner; corregido y añadido a la allowlist de la enmienda.
- `pnpm verify`: NO EJECUTADO (requiere turno del DG; el cambio es de una prop y docs).

## COMMITS / PR
Ver PR de la rama `codex/0603-aviso-status-y-marca`.

## PENDIENTES DE ESTA TAREA
`pnpm verify` con turno del DG, si lo quiere antes del portón.

## FUERA DE ALCANCE DETECTADO
- `pnpm docs:check` lanzó una instalación de dependencias en el worktree (no pedí turno para ello; ocurrió dentro de ese comando). Anotado por la regla de una corrida pesada a la vez.
- Las siete pantallas de la PR #318 siguen detenidas (sin cambio).

## Impacto documental
Actualizados: BRAND.md, BRAND-DECISIONS.md, spec 0603, tramo-5e. Sin propuestas de conocimiento nuevo.

## HANDOFF AL DIRECTOR
PR lista para revisión, sin auto-merge. Fusionar por el portón.
