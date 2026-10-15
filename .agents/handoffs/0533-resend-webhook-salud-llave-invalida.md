# Handoff · SDD-0533 · Salud del webhook de Resend: una llave borrada deja de salir verde en /studio/debug

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 07:50 a 08:10 aprox. (UTC 11:50 a 12:10) |
| Task ID / owner | `resend-webhook-salud-llave-invalida` / sesión Worker `912c9170-d91a-44fd-9059-1d70761bc312`, iniciada por la sesión `local_8d82c726-2313-4b05-bfea-a4bbccdb32eb` |
| Claim del harness | `912c9170-d91a-44fd-9059-1d70761bc312` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\focused-mestorf-69fb3b` |
| Rama | `claude/focused-mestorf-69fb3b` |
| Base | `origin/main` `262ba234` (merge de la #228, SDD-0527). La #228 se fusionó a las 11:54 UTC, durante la preparación: la rama avanzó por fast-forward desde `f3651f24`, sin apilar ni copiar cambios |
| SDD | [0533](../../docs/specs/0533-resend-webhook-salud-llave-invalida/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0533-resend-webhook-salud-llave-invalida` (`9119dd6b`), sin push; el commit de reserva está en esta rama |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main`. Sin merge (congelados hasta que el Director los reabra, después del corte de Vercel al servidor propio), sin producción ni base de datos. `pnpm verify` completo no ejecutado: requiere turno del Director |

## Objetivo

`checkResendWebhook` (`lib/studio/integration-health.ts`) llama a
`GET https://api.resend.com/webhooks` y devolvía `ok` («secret configurado · lista
no legible con key Sending-scoped») ante cualquier 401 o 403. Una llave borrada
también responde 401 («API key is invalid»), así que con `RESEND_WEBHOOK_SECRET`
configurado la fila «Resend webhook» de `/studio/debug` salía verde con la llave
muerta. La SDD-0527 lo dejó anotado fuera de alcance.

Pedido: aplicar el criterio de la SDD-0527 reutilizando `resendErrorName(body)`
(`restricted_api_key` → verde de sólo envío; otro 401/403 → «llave inválida o
borrada · HTTP N»; otros códigos → rojo con el código), sin exponer la llave, con
pruebas por `checkAllIntegrations`, control rojo y mutantes.

## Qué se hizo

- **`checkResendWebhook`.** Reutiliza `resendErrorName()`. 401 +
  `restricted_api_key` → `ok` «secret configurado · llave solo de envío, no puede
  listar webhooks». Cualquier otro 401/403 → `error` «llave inválida o borrada ·
  HTTP N». El 200 (con y sin webhooks), los otros códigos y la falla de red no
  cambian.
- **Desvío del pedido, con evidencia.** El pedido decía «`name:
  "restricted_api_key"` → ok», como la SDD-0527, que decide sólo por el nombre.
  La referencia de errores de Resend (`https://resend.com/docs/api-reference/errors`,
  consultada el 2026-10-15) lista `restricted_api_key` **dos veces**: 401 «This API
  key is restricted to only send emails» y **403 «API key is not active»** (acción
  sugerida: crear otra llave). Con el criterio literal, una llave inactiva saldría
  verde aquí. Por eso la rama verde exige `r.status === 401` además del nombre. Los
  casos pedidos se cumplen igual; se agrega la prueba del 403 inactivo.
- **Pruebas.** `describe("checkResendWebhook · el cuerpo del 401 decide")`, 11
  casos por `checkAllIntegrations({ skipMetered: true })` con `RESEND_API_KEY` y
  `RESEND_WEBHOOK_SECRET` puestos: 200 con webhooks, 200 sin webhooks, 401
  restricted, 401 inválida, 403 `suspended_api_key`, 403 `restricted_api_key`
  inactiva, 401 sin cuerpo legible, `restricted_api_key` sólo en `message`, 500,
  sin red, y llave/secret no expuestos (cinco escenarios con ambos devueltos adrede
  en el cuerpo; la llave viaja sólo en el header, el secret no viaja, nada en el
  resultado ni en `console.*`).
- **Docs.** Spec 0533, índice regenerado y `docs/runbooks/setup-resend.md`
  (Troubleshooting: dos filas para leer «Resend webhook» en `/studio/debug`).

## VALIDACIÓN

Todo sobre el worktree de arriba, base `262ba234`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| Control rojo | `vitest run lib/studio/__tests__/integration-health.test.ts` con `integration-health.ts` idéntico a `origin/main` (`git diff` 0 líneas), restaurado después (sha256 `09e247adda44` antes y después) | PASÓ como control: `Tests 6 failed \| 23 passed (29)`. Fallan 401 restricted, 401 inválida, 403, 403 inactiva, 401 sin cuerpo y `restricted_api_key` en `message`. Los 5 nuevos que pasan son de regresión (200 con y sin webhooks, 500, sin red, llave no expuesta) |
| Pruebas focalizadas | mismo archivo con el arreglo | PASÓ: `Tests 29 passed (29)` (18 previos + 11 nuevos) |
| Mutantes | 15, sólo dentro de `checkResendWebhook` (cada uno exige una única coincidencia en la función, para no tocar el código gemelo de `checkResend`), restaurando desde la copia; muerto sólo con `Tests N failed` | PASÓ: control inicial y final `Tests 29 passed (29)`, 15/15 muertos, archivo restaurado idéntico (`09e247adda44`). Corredor en el scratchpad de la sesión (`mutantes-0533.mjs`), vitest invocado con `node node_modules/vitest/vitest.mjs`, sin `--reporter=basic` |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0) |
| `eslint` | `lib/studio/integration-health.ts` y su prueba | PASÓ (exit 0, sin salida) |
| `corepack pnpm docs:check` | índice de specs | FALLÓ la primera vez (índice desactualizado por la spec nueva); PASÓ tras `pnpm docs:index` (511 specs) |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; choques históricos de migraciones ya conocidos) |
| `git diff --check` | diff de la tarea | PASÓ |
| `pnpm verify` | completo | NO EJECUTADO: requiere turno del Director (una corrida pesada a la vez) |
| UI en navegador | `/studio/debug` → Estado | NO EJECUTADO: sin cambio de UI; el badge ya muestra `error ?? detail`. Verlo con una llave real de cada tipo requiere secretos de un entorno |
| Llave real contra Resend | — | NO EJECUTADO: no se usaron llaves reales. Los cuerpos simulados siguen la referencia de errores de Resend y lo confirmado por Sam el 2026-10-15 para la SDD-0527 («API key is invalid», 401) |

Mutantes (nombre → resultado):

| # | Mutante | Tests |
|---|---|---|
| M1 | restricted por nombre con cualquier código (sin el 401) | 1 failed |
| M2 | restricted por código 401, no por `name` | 3 failed |
| M3 | `&&` → `\|\|` en la condición de sólo envío | 4 failed |
| M4 | lee `message` en vez de `name` | 2 failed |
| M5 | sin cuerpo se presume restricted | 1 failed |
| M6 | la llave de sólo envío sale roja | 1 failed |
| M7 | vuelve el texto viejo «Sending-scoped» | 1 failed |
| M8 | quita el 403 del rojo de llave | 2 failed |
| M9 | el rojo dice siempre HTTP 401 | 2 failed |
| M10 | vuelve el comportamiento viejo (401/403 = ok) | 5 failed |
| M11 | el rojo copia el `message` de Resend | 6 failed |
| M12 | registra la llave con `console.warn` | 1 failed |
| M13 | el verde copia el `message` de Resend | 2 failed |
| M14 | sólo envío con 401 o 403 (`<= 403`) | 1 failed |
| M15 | el secret en el detalle del verde | 2 failed |

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0533, `docs/specs/README.md` (índice),
  `docs/runbooks/setup-resend.md`.
- El índice regenerado lista 0528–0532 como huecos: son reservas de otras sesiones
  que todavía no están en main. El driver de merge del índice lo resuelve al
  integrar.
- `corepack pnpm knowledge:status` (exit 0, `ok: false`): estructural `INVALID`,
  semántico `INVALID`, con `mainRevision` local `f3651f24` y `origin/main`
  `262ba234`. Es el estado de un worktree sin derivados de Graphify, igual que en la
  SDD-0527; no lo causa esta tarea. No se reconstruyó aquí (corrida pesada; la
  publica el Director desde main).
- `knowledge:visual` / `knowledge:visual:check`: NO EJECUTADO, dependen de un grafo
  estructural válido. El cambio no altera la arquitectura que mapea Archify.
- Obsidian: sin cambios; la publicación es del Director desde main integrado.

## COMMITS

| Hash | Propósito |
|---|---|
| `9119dd6b` | reserva SDD-0533 (commit del script de reserva, sobre `262ba234`) |
| `c9a219fb` | `feat(studio)`: `checkResendWebhook` y sus 11 pruebas |
| `0263f904` | `docs(sdd)`: spec, índice y runbook |
| commit que contiene este documento | handoff |

## PR / BRANCH

Rama `claude/focused-mestorf-69fb3b`, base `main`. La URL de la PR queda en su
descripción y en el cierre de la sesión. Sin fusionar: merges congelados hasta que
el Director los reabra.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo, con turno del Director.
- Revisión del desvío de criterio (401 + `restricted_api_key`, no sólo el nombre).
- Estado SDD a `done` al integrar, si la revisión acepta.

## FUERA DE ALCANCE DETECTADO

- **`checkResend` (SDD-0527, ya en main) da verde a `restricted_api_key` con 403.**
  Compara sólo `name`, así que una llave inactiva («API key is not active», 403)
  sale «llave solo de envío». Arreglo: exigir `r.status === 401` en esa rama y una
  prueba de 403 `restricted_api_key`. La premisa de la spec 0527 («si Resend
  devolviera `restricted_api_key` con otro código, la llave sigue existiendo») la
  contradice la referencia de Resend. Propuesto como tarea aparte.
- **`suspended_api_key` (403) sale «llave inválida o borrada»** en los dos
  chequeos. La acción correcta es soporte de Resend; el runbook lo menciona en la
  fila del webhook. Distinguir el texto sería otra decisión.
- `docs/runbooks/setup-resend.md` mezcla voseo («tenés», «andate», «ingresá») en
  secciones viejas. Las filas nuevas van en tuteo; no se tocó el resto.

## HANDOFF AL DIRECTOR

1. Revisar la PR y el desvío de criterio (401 obligatorio para el verde).
2. Decidir si `checkResend` recibe el mismo ajuste en una SDD propia.
3. Dar turno para `pnpm verify` o correrlo al integrar.
4. Integrar cuando se reabran los merges (merge y deploy son autorizaciones aparte).
5. Al integrar: estado SDD `done`, índice y Graphify desde main; la reserva local
   `codex/sdd-reserve-0533-resend-webhook-salud-llave-invalida` se puede borrar
   una vez la spec esté en main.

Sesiones consumidoras: ninguna. Ownership liberado al cerrar esta sesión.
