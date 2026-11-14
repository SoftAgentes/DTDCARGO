# Handoff · SDD-0603, tramo 4e, avisos del portal del cliente

- **Owner:** Claude (Worker), sesión hija del Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Rama:** `claude/0603-t4e-portal-avisos-dd68a3`, desde `claude/rebrand-base-main` = `origin/main` `da8d123ee`.
- **Worktree:** `.claude/worktrees/0603-t4e-portal-avisos-dd68a3`.
- **SDD:** extensión de 0628 al portal, sin número nuevo. Detalle en `docs/specs/0603-claridad-controles/tramo-4e.md`.
- **Autorización:** encargo del Subdirector Rebrand: push de la rama propia y PR lista (no draft) contra main, sin Auto-fix. Prohibido fusionar, imagen de prueba y producción.

## Arranque

- Allowlist de 11 candidatos: `rebrand-0603-allowlist-t4e-da8d123ee.txt` en las notas del top.
- `gh pr list` + `gh pr diff --name-only`: ninguna PR abierta toca los 11 archivos. #546 lista `claridad.css` y `claridad-portal-contract.test.ts` solo porque su base es vieja (trae el T3): `git diff HEAD origin/claude/0603-t4b-plataforma-0af1d7 -- app/portal/` vacío. `claridad-portal-contract.test.ts` no se tocó.

## Hecho

- Clase `.portal-aviso` (bloque 2b de `app/portal/claridad.css`): franja plana, cuatro tonos por `data-tono`, `StatusIcon` compartido, color del estado en el icono y tinte dorado en el fondo de atención. Sin componente nuevo → sin registro CMP-01.
- 13 franjas en los 11 archivos; clasificación completa en `tramo-4e.md`. Textos visibles sin cambios; roles sin cambios (ningún `alert`).
- Contrato nuevo `app/portal/__tests__/avisos-portal-contract.test.ts`: 24 mediciones de contraste, conteo de franjas por archivo y tono sin comentarios, icono según tono, franja sin cajón, restos de color en línea fijados por archivo, ocho mutantes.
- Nota «Extensión al portal: tramo 4e» en `docs/specs/0628-aviso-studio/spec.md`.

## Validación

- `/ui-check` sobre el diff: un hallazgo alto, aplicado: atención en claro no tenía el acento dorado de BRAND §Estados (solo la forma del icono la distinguía de info) → fondo `color-mix` del dorado existente al 14 %.
- Contraste recalculado aparte con Node: peor caso icono de atención en oscuro 4,46:1; el mutante M8 (60 %) baja el texto oscuro a 3,92:1.
- Conteo de franjas y restos recalculado aparte con Node sobre los archivos reales: coincide con `ESPERADO`.
- Vitest focal, tsc, eslint: ver «Corrida con turno» abajo.
- `pnpm verify`: NO EJECUTADO local; portón = CI de GitHub.

## Corrida con turno

Pendiente al escribir: turno pedido al Subdirector Rebrand para `pnpm install` y vitest focal.

## Impacto documental

- `tramo-4e.md` nuevo y nota en la 0628. Graphify/Obsidian: sin cambio propio; lo recoge el Director al integrar.

## FUERA DE ALCANCE DETECTADO

- `CotizacionRequestForm.tsx` y `app/portal/(app)/error.tsx` (los cita el handoff del T3 como avisos en línea): no están en esta allowlist.
- `DataChangeEditor.tsx`, caja «Ya usaste tus 3 cambios»: cajón neutro sin color en línea ni rol; candidato para un tramo siguiente.
- `perfil/page.tsx`, sección «Tu Shipping Mark»: tarjeta de contenido con borde izquierdo vino en línea; no es aviso, pero es un acento de borde izquierdo que BRAND desaconseja. Decisión de diseño aparte.
- `CedulaPhotoRow.tsx`, fila del documento: borde izquierdo ámbar condicional en línea (fila resaltada). No entra en el recuento del contrato porque es `style={x ? undefined : {…}}`.
- `PrealertaStatusBadge.tsx` (heredado del T3): píldora en línea.
