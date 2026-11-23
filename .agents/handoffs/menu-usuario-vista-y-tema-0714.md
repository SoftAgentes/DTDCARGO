# Handoff · SDD-0714 — Vista y tema en el menú del usuario

Fecha: 2026-11-23 · Worker: Claude (Opus 5.5) · Rama: `claude/menu-usuario-vistas-8b67c9` · Reserva: `codex/sdd-reserve-0714-menu-usuario-vista-y-tema` + `refs/dtd/reservations/0714` (publicadas).

## Qué pidió Sam

«Menú del usuario: sí, así, y que la vista quede guardada en mi usuario (opción B)» (2026-11-23, maqueta aprobada).

## Qué quedó

- La barra superior ya no lleva el selector de vista ni el sol/luna. Quedan buscar, Conversaciones, la campana y la pastilla con el nombre.
- Menú del usuario, en orden: nombre y rol real → **Vista** (Normal / Compacta / Súper compacta) → **Tema** (Claro / Oscuro / Automático) → Mi perfil y las opciones de cuenta que ya existían → Cerrar sesión.
- **Opción B, sin migración:** se guarda en `user_metadata.studio_apariencia = { vista, tema }` con `auth.updateUser({ data })` (`app/studio/(app)/_actions/apariencia-actions.ts`). La acción valida contra el catálogo. `localStorage` queda como respaldo y el script anti-parpadeo lo sigue aplicando. Al montar el Studio, `AparienciaUsuario` aplica lo de la cuenta si difiere; si la cuenta no tiene nada y el navegador sí, lo sube una vez.
- «Automático» sigue a `prefers-color-scheme`, también en vivo.
- Admin › Apariencia usa el mismo hook y ofrece Automático.
- El menú se arma con `opcionesDeCuenta` en `StudioTopbar.tsx`: el Modo de prueba (SDD-0713) entra con una entrada. **No se agregó.**
- Se borró `DensityToggle.tsx` con su prueba; el estilo `.studio-vista` se reusa con el modificador `--menu`.

## Evidencia

Pendiente de completar con el turno de PC (vitest, tsc, eslint) y con el CI de la PR.

| Comprobación | Estado |
|---|---|
| vitest de los archivos tocados | NO EJECUTADO (esperando turno) |
| tsc / eslint | NO EJECUTADO (esperando turno) |
| `/ui-check` | PASÓ con 2 ajustes menores, ya aplicados: hover ≠ elegido; Tab fuera cierra el menú |
| Capturas claro/oscuro × 3 vistas | NO EJECUTADO (esperando turno para `next dev`) |
| `carril.mjs` | revisión previa (server action + «usuario» en la ruta) |

## Impacto documental

- `docs/specs/0714-menu-usuario-vista-y-tema/spec.md` (nueva).
- `app/studio/CLAUDE.md`, regla 2: la vista y el tema viven en el menú del usuario.

## Pendientes de esta tarea

- Completar la evidencia de arriba y abrir la PR.

## FUERA DE ALCANCE DETECTADO

- Los nombres de rol vienen de `ROLE_LABELS` en español; un usuario con zh-CN ve el rol en español.
- El hover del `.studio-vista` de SDD-0688 rellenaba igual que la opción elegida; aquí solo se corrigió dentro del menú (el selector de la barra ya no existe).
