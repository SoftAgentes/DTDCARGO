# Handoff · SDD-0603, tramo 3, portal del cliente

- **Owner:** Claude (Worker), sesión hija del Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`). Claim: `local_t3-portal`.
- **Rama:** `claude/0603-t3-portal`, desde `origin/main` `11f90a32e`.
- **Worktree:** `.claude/worktrees/0603-t3-portal-5dee40`.
- **SDD:** 0603; detalle del tramo en `docs/specs/0603-claridad-controles/tramo-3.md`.
- **Autorización:** encargo del Subdirector Rebrand: preparar, publicar la rama propia y abrir PR lista, sin fusionar. Fusionar lo decide el Director General.

## Arranque

- `gh pr list`: ninguna PR abierta toca archivos de la allowlist. Nada que sacar para pasada final.
- El Subdirector Portal del cliente confirmó (según el encargo) que no tiene en vuelo ninguno de estos archivos.

## Hecho

Ver tabla «Qué cambia» de `tramo-3.md`. En corto: `.btn-ghost` con contorno de tinta y sombra de nivel; campos de `main` con contorno `--color-grey-500`; `FileField` con contorno ≥3:1 y foco de teclado arreglado (el input iba después del label y `peer-*` nunca aplicaba); sub-pestañas del hub como control con partes, activa rellena de tinta; filtros `aria-pressed` con relleno de tinta; estados sin píldora; avisos con cajón como franja plana; enlaces de texto subrayados. Todo bajo `.portal-sys`.

## Validación

- `/ui-check` sobre el diff: OK con ajustes menores, aplicados (relleno 16 px, radio concéntrico, hover en `--color-grey-100`).
- Contraste recalculado aparte con Node sobre los tokens de `globals.css`: coincide con las cifras de `tramo-3.md`.
- `git diff --check`: PASÓ.
- Contrato, pruebas focales del portal y `pnpm verify`: NO EJECUTADO local: sin node_modules; cubre el CI de GitHub (regla del DG, 2026-11-13, transmitida por el Subdirector Rebrand).

## Revisión independiente (2026-11-13) y corrección

- Bloqueo: el contrato leía los tokens claros de `:root`, pero los `--color-*` claros viven en `@theme` de `app/globals.css`; `token()` lanzaba y fallaban todas las del tema claro y los mutantes M1 a M4. Arreglo: leer `@theme`.
- Al correrlo aparecieron dos fallas más del propio contrato: el piso pedía 14 pares y la hoja real da 13 (el par 14 solo existe si el estado vuelve a tener fondo), y el chequeo de `!important`/`[style` leía también los comentarios. Piso a 13; ese chequeo ahora ignora comentarios.
- Con `pnpm install --frozen-lockfile` autorizado por el Subdirector Rebrand: contrato 45/45 PASÓ (14 del tema claro; M1 a M5 mueren); `vitest run app/portal` 43 archivos, 386 pruebas PASÓ; ESLint de lo tocado PASÓ; `tsc --noEmit` PASÓ. `pnpm verify` completo: NO EJECUTADO local; lo cubre el CI de GitHub.

## Publicación

- Rama publicada `claude/0603-t3-portal`; se trajo `origin/main` con merge, sin conflictos. El diff contra main es exactamente la allowlist.
- PR #537, lista (no draft), sin fusionar. Fusionar: Director General, con revisión independiente y CI verde.

## FUERA DE ALCANCE DETECTADO

- `PrealertaStatusBadge.tsx` pinta su píldora en línea: sigue como píldora. Componente fuera de la allowlist.
- Avisos con borde o fondo en línea (`CotizacionRequestForm.tsx`, `app/portal/(app)/error.tsx`): quedan para un tramo aparte, «T4e · avisos del portal», después de fusionar esta PR (corrección del Subdirector Rebrand: el T4a es solo del Studio).
- Primario vino en el portal oscuro: 3,00:1 contra la tarjeta (`#c24450` sobre `#16264a`), justo en el mínimo; el Studio lo resolvió con `--ctl-edge-hi` en la enmienda de elevación. Requiere decisión y tocar `globals.css`.
- Hipótesis sin comprobar: `vitest.config` excluye `**/.claude/**`; al correr desde un worktree del harness se confirma si el contrato se recoge (el conteo de pruebas lo dirá).

## Impacto documental

- Nuevo `docs/specs/0603-claridad-controles/tramo-3.md`. `spec.md` no se edita (instrucción del encargo); el Director decide si el tramo se enlaza desde la spec al integrar.
- Graphify/Archify: no ejecutados en esta tarea (cambio de CSS y dos componentes); queda para el Director al integrar.
