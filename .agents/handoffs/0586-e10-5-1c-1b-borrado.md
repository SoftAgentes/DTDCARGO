# Handoff · SDD-0586 paso 10.5, PR 1c-1b — el hilo borrado y el enlace a la Bandeja con permiso

- **Owner:** Claude Worker «10.5», en la sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), que coordina con el Director General.
- **Claim:** `worker-10.5-1c-1b`.
- **Ruta y rama:** `DTD-worktrees/0586-e10-5-1c-1b-borrado`, rama `codex/0586-e10-5-1c-1b-borrado`, desde `main` en `146d5ea5e` (el tren #441, con la 1c-1).
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md), §10.5.16, fila 1c-1b y «1c-1b · diseño».

## Decisión del DG (2026-11-08, comunicada por el Subdirector)

- Va en una pieza chica aparte, después de la #440, con rama y PR propias.
- **Es condición para encender `chatwoot_portal` en producción, como la 1c-1.** En prueba no se espera.
- El enlace con permiso entra aquí porque era trivial.
- Sin migración y sin acciones exportadas nuevas.

## Lo hecho

- **`setStatusAction`:**
  - Si la sesión no encuentra el hilo (borrado o de otro tenant), devuelve «Conversación no encontrada.» y no escribe, igual que `sendReplyAction`.
  - El `update` lleva `.is("deleted_at", null)`.
  - Antes cambiaba la fila. Y en un hilo del portal borrado, la traba de la 1c-1 no corría.
- **«Responder en la Bandeja →» solo con acceso:**
  - La page calcula `moduleViewDenial(supabase, "bandeja")` y `listFeatureFlags` (`chatwoot_inbox`). Son las dos capas de `bandeja/layout.tsx`.
  - Le pasa `puedeVerBandeja` al hilo por `ConversacionesClient`. Si no se pasa, vale `false`.
  - El campo `bandeja` del detalle no cambia. Es un número entero sin PII (I).
- **`route-auth.test.ts`:** el fixture del detalle lleva `channel: "email"` explícito, y también `tenant_id`.
- **Mutantes:** 6 nuevos en `mutantes-solo-lectura.cjs`, del M33 al M38 (38 en total). Se ajustaron los fragmentos del M26 y del M28.
- **Handoff de la 1c-1:** la frase del hilo borrado queda como corregida aquí.

## Validación (turno del Subdirector, 12:21Z a 12:30:39Z)

| Comprobación | Estado |
|---|---|
| Rojo previo: las 4 fuentes de `main` con las pruebas nuevas | 5 fallan y 28 pasan, de 33. Fallan tres casos de la 1c-1b (hilo y page), «hilo borrado» y «flag apagado», que ahora espera `deleted_at` en el update |
| Pruebas por importador en todo el repo, más los contratos que recorren archivos, con `--maxWorkers=1` | PASÓ: 10 archivos y 563 casos (route-auth, send-reply, set-status, thread-solo-lectura, SaldoPendienteContexto, la pieza, los dos contratos de `app/studio/_components`, `rbac-actions-guard` y `rbac-api-guard`), y además `feature-flags-catalog` (13 de 13) |
| `tsc --noEmit` | PASÓ, después de cambiar `flags[MODULE_FLAG_MAP.bandeja]` (tipo con `undefined`) por `flags.chatwoot_inbox` |
| ESLint sobre lo tocado y `git diff --check` | PASÓ |
| Los 38 mutantes (12:27:20Z a 12:30:39Z, sobre `9171f0c47`) | PASÓ: 38 de 38 mueren, con las 5 bases verdes (11, 18, 10, 5 y 13), los 6 archivos restaurados y `git status` vacío |
| `pnpm verify` y el build local | NO EJECUTADO: por la regla de la máquina. El portón es el CI |

## Pendientes de esta tarea

- Push, PR en borrador y el SHA al Subdirector.
- Sumar la 1c-1b como condición al guion de encendido. Ya lo hizo la #438 (`3f4acbbae`, en `main`).

## FUERA DE ALCANCE DETECTADO

- El campo `bandeja` del detalle se sigue entregando a quien ve el hilo, aunque no tenga acceso a la Bandeja. Es un número sin PII. Cortarlo también cambiaría `route-auth` y la prueba de la ruta: queda para la 1c-2 si el DG lo pide.
- **La 1c-2** (estado, conciliación y trigger, también con el flag apagado, que rechace salientes y cambios de canal en un hilo del portal): migración 0521, que reserva el DG. El número se pide con el diseño.
