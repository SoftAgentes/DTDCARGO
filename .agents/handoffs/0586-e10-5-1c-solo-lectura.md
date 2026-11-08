# Handoff · SDD-0586 paso 10.5, PR 1c-1 — Studio en solo lectura para los hilos del portal

- **Owner:** Claude Worker «10.5», sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`), que coordina con el Director General.
- **Claim:** `worker-10.5-1c`.
- **Ruta y rama:** `DTD-worktrees/0586-e10-5-1c-solo-lectura`, rama `codex/0586-e10-5-1c-solo-lectura`, desde `main` en `efd7e70f6` (la #434 fusionada).
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md), §10.5.16, «PR 1c · partición» y «1c-1 · diseño». Las piezas anteriores: la 1a (#424, `0586-e10-5-ida.md`) y la 1b (#434, `0586-e10-5-1b-vuelta.md`).

## Decisión del DG del 2026-11-08, ~10:22Z (comunicada por el Subdirector)

- Sí a todo. La 1c va en cuatro piezas, cada una en su rama y su PR desde `main`: la 1c-1 (Studio en solo lectura) primero, después la 1c-2 (estado, conciliación y el trigger de la base), la 1c-3 (CRM) y la 1c-4 (respaldo).
- `assignAction` y `markCaseAction` no se traban.
- El riesgo residual de PostgREST queda aceptado para la 1c-1, y el trigger va en la migración de la 1c-2.
- En producción no se enciende `chatwoot_portal` hasta tener la 1c-1 publicada. En prueba se hace el punta a punta.
- **(I) inferencia del Worker, sin medir en una base:** las policies de la 0106 (`"conversations by tenant"` y `"conversation_messages by tenant"`) son FOR ALL para `authenticated` por tenant, sin rol. Así se leen en el SQL de `main`; no se midió en prueba ni en producción.

## Reglas de esta PR

- **Sin migración y sin acciones exportadas nuevas.** El inventario del RBAC sigue en 463.
- No se fusiona desde aquí: fusiona el DG. PR en borrador, y el push en un comando aparte, después de leer las pruebas.
- Prohibido sin OK nominal de Sam: encender `chatwoot_portal`, crear la bandeja o las variables en el VPS, aplicar migraciones fuera de una base local o efímera, y cargar P4.
- Máquina: dos corridas medianas a la vez como máximo. La tanda de mutantes, con turno del Subdirector.

## Lo hecho (2026-11-08)

- **La pieza de la traba:** `lib/studio/chatwoot/portal-solo-lectura.ts`. `trabaPortal()` da «activa», «apagada» o «no_se_sabe». Lee la fila de `feature_flags` con la sesión, y solo si `chatwootPortalConfig()` existe y es del mismo tenant. Si la lectura falla, da «no_se_sabe» (fail-closed). `rechazoPortal()` solo mira los hilos del portal.
- **La traba en el servidor:**
  - `sendReplyAction` rechaza después del gate de edición, sin insertar ni avisar.
  - `setStatusAction` lee el `channel` del hilo con la sesión y rechaza igual. Si esa lectura falla, no escribe: no se sabe si el hilo es del portal. Ese caso lo encontré al armar los mutantes; antes seguía al update.
- **La ruta del detalle** (`/api/studio/conversaciones/[id]`) suma `bandeja`: el número de la conversación en Chatwoot, sacado de `chatwoot_portal_hilos` con service_role. Lo lee solo en un hilo del portal, después de comprobar con la sesión que el hilo es del tenant, y filtrado por el hilo y por el tenant. Si no hay vínculo o la lectura falla, da `null`.
- **La pantalla:**
  - La page calcula la traba una vez y se la pasa al hilo por `ConversacionesClient`.
  - En un hilo del portal con la traba puesta, la caja y las respuestas rápidas se cambian por un aviso (`role="note"`), con «Responder en la Bandeja →» hacia `/studio/bandeja?c=<n>`, o sin enlace si todavía no hay número.
  - El selector de estado queda deshabilitado, con `aria-describedby` y `title`.
  - Asignar y «Caso» siguen como hoy.
  - Si la traba es «no_se_sabe», el aviso dice que no se pudo comprobar y pide recargar.
- **Mutantes:** el ejecutor `infra/chatwoot/pruebas/portal/mutantes-solo-lectura.cjs` tiene 32 mutantes en la pieza, las dos acciones, la ruta, el hilo, el cliente y la page. `--revisar` confirma que los 32 fragmentos aparecen una sola vez.

## Validación

| Comprobación | Estado |
|---|---|
| Pruebas nuevas y tocadas, en vitest con `--maxWorkers=1`: `send-reply-gate` (15), `set-status-gate` (9), `thread-solo-lectura` (10, con la page), la ruta `[id]` (5) y `portal-solo-lectura` (11) | PASÓ |
| El módulo (`conversaciones/**`), `lib/studio/chatwoot/**` y `rbac-actions-guard` (463) | PASÓ: 43 archivos y 1228 casos; se saltan las 2 PoC de Chatwoot, que corren en Actions |
| Rojo previo sobre `main` (las 5 fuentes de `main` y las pruebas finales) | 14 fallan y 28 pasan, de 42. Los que pasan son los casos de «como antes». `portal-solo-lectura.test.ts` no carga en `main` porque la pieza es nueva |
| `tsc --noEmit` | PASÓ |
| ESLint sobre lo tocado | PASÓ (0 errores, 0 avisos; `infra/` lo ignora la configuración) |
| `/ui-check` del aviso | PASÓ sin bloquear. Un hallazgo medio, aplicado: el `title` del selector deshabilitado. Uno bajo, que queda: el `padding` 12/14 es el del compositor que reemplaza |
| Los 32 mutantes | PENDIENTE: piden turno al Subdirector |
| `pnpm verify` y el build local | NO EJECUTADO: por la regla de la máquina del encargo. Desde el 2026-11-07 el portón es el CI de GitHub con revisión independiente |

## Impacto documental

- La spec (§10.5.16, «1c-1 · diseño»): la decisión del DG, la etiqueta (I) de la 0106, la lectura fail-closed de `setStatusAction`, el texto del aviso «no se sabe», el `title`, la prueba de la page y la allowlist exacta.
- Sin cambios en runbooks. El de encendido (#438) ya pide la 1c-1 publicada antes de encender en producción.

## Pendientes de esta tarea

- La tanda de mutantes, con turno.
- Traer `main` (`3c14715ad`, la #437). El cruce está medido: no hay conflicto en la spec.
- Push, PR en borrador, y el SHA, el numstat y los rojos previos al Subdirector.

## FUERA DE ALCANCE DETECTADO

- El riesgo residual (I) de la 0106: un `authenticated` del equipo puede escribir un saliente en un hilo del portal directo por PostgREST. Lo cierra el trigger de la 1c-2 (decisión del DG).
- Un hilo borrado (`deleted_at`) no se lee en `setStatusAction`, así que el update sigue como hoy y no cambia filas. Es el comportamiento de antes, sin tocar.
