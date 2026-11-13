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

(se completa al cerrar; ver sección «Cierre»)

## FUERA DE ALCANCE DETECTADO

- `PrealertaStatusBadge.tsx` pinta su píldora en línea: sigue como píldora. Componente fuera de la allowlist.
- Avisos con borde o fondo en línea (`CotizacionRequestForm.tsx`, `app/portal/(app)/error.tsx`): pertenecen al tramo 4.
- Primario vino en el portal oscuro: 3,00:1 contra la tarjeta (`#c24450` sobre `#16264a`), justo en el mínimo; el Studio lo resolvió con `--ctl-edge-hi` en la enmienda de elevación. Requiere decisión y tocar `globals.css`.
- `vitest.config` excluye `**/.claude/**`: revisar si eso deja sin correr pruebas cuando se lanzan desde un worktree del harness.

## Impacto documental

- Nuevo `docs/specs/0603-claridad-controles/tramo-3.md`. `spec.md` no se edita (instrucción del encargo); el Director decide si el tramo se enlaza desde la spec al integrar.
- Graphify/Archify: no ejecutados en esta tarea (cambio de CSS y dos componentes); queda para el Director al integrar.
