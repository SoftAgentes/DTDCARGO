# SDD-0589 · paso 9.3: estado de la guía por usuario (handoff)

Rama `codex/0589-e9-estado`, worktree `DTD-worktrees/0589-e9-estado`, desde `main` en `186d505ff`. Encargo del Director General, 2026-11-06: la 9.3 entera, en local y en una PR en borrador, bajo SDD-0589.

## Puertas

- **No hay OK de Sam al diseño de la migración 0517.** Está en su lista; la fila 9.3 no cuenta como OK.
- Fusionar la PR y aplicar la 0517, en prueba o en producción, esperan su OK.
- **Aplicar la 0517 enciende el arranque automático:** cada persona de Studio verá abrirse sola la guía de demostración del Dashboard la primera vez que entre después. Sin la 0517, nada cambia.
- `verify` pide turno al Director General.

## Qué quedó

El detalle, con allowlist, cambios frente a §8, evidencia y `revisar-datos-ve`, está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-06 · Paso 9.3».

- **Migración 0517**, reservada con `codex/migration-reserve-0517-user-guide-prefs` (`be6e0f949`), y su contrato en PGlite.
- **Código:** validador, lectura, acción, almacén por usuario, motor con arranque automático, botón «Guía» sin montar y montaje con el estado del servidor.
- **S-6 y S-7**, pendientes de Sam, con las propuestas del guion como constantes en `lib/studio/guia/preferencias.ts`.
- **Prueba de «sin nada no abre»,** pedida por el Director General.

## Pendiente

- El OK de Sam al diseño de la migración, a la fusión y a la aplicación.
- **S-6 y S-7:** cuando Sam conteste, cambiar las constantes.
- **Montar `<GuiaBoton />` en `StudioTopbar.tsx`** cuando la adopción del rediseño (SDD-0603) lo permita: es una línea.
- **Fila 9.3 del checklist:** no se tocó; queda `pendiente` hasta que el Director General decida cómo contarla.
- **9.6:** `/ui-check` en vivo y prueba con quien atiende.

## FUERA DE ALCANCE DETECTADO

- `user_dashboard_prefs` (0233) no exige `disabled_at is null`: un usuario desactivado conserva el acceso a su fila del Dashboard. Ya lo anotaba §8.2. No se toca aquí.
