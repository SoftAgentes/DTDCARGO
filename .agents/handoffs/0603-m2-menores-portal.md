# Handoff · SDD-0603, pendientes menores del portal (m2)

- **Owner:** Claude (Worker), sesión hija del Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Rama:** `claude/0603-m2-menores-portal-b3e5e3`, desde `claude/rebrand-base-main` = `origin/main` `651bdbd73`.
- **Worktree:** `.claude/worktrees/0603-m2-menores-portal-b3e5e3`.
- **SDD:** 0603, sin número nuevo. Detalle en `docs/specs/0603-claridad-controles/menores-portal.md`.
- **Autorización:** encargo del Subdirector Rebrand: push de la rama propia y PR lista (no draft) contra main, sin Auto-fix y sin traer main. Prohibido fusionar.

## Hecho

1. `claridad-portal-contract.test.ts`: la comprobación de tokens usados y declarados pasa a `tokensSinDeclarar(css, globals)`, que quita los comentarios. Mutantes M6 (token declarado solo en un comentario) y M7 (`var()` citado solo en un comentario).
2. `avisos-portal-contract.test.ts`: tercer tema `claro-explicito` (`data-portal-theme="light"`), con tokens e iconos resueltos por los bloques `[data-portal-theme="light"]` y `[data-portal-theme]`. Piso de 24 a 36 mediciones. Mutantes M9, M10 y M11, que rompen solo en ese tema.
3. Borde de la franja en claro: medido, 1,09:1 contra el papel y 1,14:1 contra la tarjeta. **Decisión: se deja.** Ningún relleno con tokens existentes llega a 3:1 sin tumbar el texto, y un contorno es lo que BD-037 le quita a lo que avisa. `app/portal/claridad.css` **no se tocó**. La decisión queda como propiedad: `fallasSinFranja` mide icono y texto contra el papel y la tarjeta en los tres temas; mutante M12.

## Validación

- Sustituto mínimo de Vitest en Node 24 (sin `node_modules`, tipos quitados por Node): `claridad-portal-contract` 47/47 y `avisos-portal-contract` 59/59. PASÓ, pero **no es Vitest**: el sustituto implementa solo los comparadores que usan estos dos archivos.
- Inversos sobre copias en temp (sin tocar el árbol): al devolver `tokensSinDeclarar` a leer comentarios fallan M6 y M7; al quitarle los selectores al claro explícito fallan M9, M10 y M11; al anular `fallasSinFranja` falla M12.
- Contraste recalculado aparte con Node sobre los valores de `globals.css`: coincide con las tablas de `menores-portal.md`.
- `git diff --check`: PASÓ.
- Vitest real, ESLint, `tsc`, `pnpm docs:check`, `pnpm sdd:check`, `pnpm verify`: **NO EJECUTADO** local. El Subdirector Rebrand negó el turno de instalación (PC ocupada por otra sesión, 2026-11-14): la corrida real es la del CI de GitHub.
- `/ui-check`: no aplica, no se tocó CSS ni componentes.

## Pendiente de esta tarea

- Leer el job Unitarios del CI y avisar al Subdirector si los dos contratos pasaron, con número de PR y cabeza.

## Impacto documental

- `menores-portal.md` nuevo. `spec.md`, `tramo-3.md` y `tramo-4e.md` no se editan (fuera de la allowlist). Graphify/Obsidian: lo recoge el Director al integrar.

## FUERA DE ALCANCE DETECTADO

- El contrato del tramo 3 mide dos temas; el claro explícito solo se agregó al de avisos, como pedía el encargo.
- En el contrato del tramo 3, `regla` y `desde` buscan selectores en la hoja con comentarios. Riesgo bajo (el comentario tendría que empezar línea con el selector exacto y ` {`).
- En `globals.css` hay varios bloques `[data-portal-theme="dark"]`; los dos contratos leen solo el primero, que es el que trae los `--color-*`.
- Si Sam quiere la franja más marcada en pantalla: relleno `--color-grey-200` (1,19:1 en claro). Decisión de diseño aparte; no hace falta para AA.
