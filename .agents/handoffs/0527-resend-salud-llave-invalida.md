# Handoff · SDD-0527 · Salud de Resend: una llave borrada deja de salir verde en /studio/debug

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15, Caracas 02:20 a 02:45 aprox. (UTC 06:20 a 06:45) |
| Task ID / owner | `resend-salud-llave-invalida` / sesión Worker `55e983bd-02cb-4fe5-97b0-76d87ed0f7fd` |
| Claim del harness | `55e983bd-02cb-4fe5-97b0-76d87ed0f7fd` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\upbeat-poincare-8b87cc` |
| Rama | `claude/upbeat-poincare-8b87cc` |
| Base | `origin/main` `a8d99acf` (merge de la #223); sin cambios en main hasta 06:42 UTC |
| SDD | [0527](../../docs/specs/0527-resend-salud-llave-invalida/spec.md), `in-progress`. Reserva local `codex/sdd-reserve-0527-resend-salud-llave-invalida` (`882be30b`), sin push; el número coincidió con el del inventario (0527) |
| Estado de la tarea | lista para revisión |
| Permisos | commits selectivos, push de la rama propia y PR contra `main`. Sin merge (congelados hasta después del corte de Vercel al servidor propio, 2026-10-15 en la noche, Caracas), sin producción ni base de datos. `pnpm verify` completo no ejecutado: requiere turno del Director |

## Objetivo

`checkResend` (`lib/studio/integration-health.ts`) devolvía `ok` ante cualquier 401
o 403 de `GET /domains`, para tolerar las llaves «Sending access». Una llave borrada
también responde 401 («API key is invalid») y salía verde en `/studio/debug` →
Estado → Resend. Sam borró por error dos llaves en Resend y el panel no podía decir
si la de un entorno había muerto.

Pedido: leer el cuerpo y distinguir 200 (acceso completo, con dominios
verificados), 401 `restricted_api_key` (sana, sólo envío, con aviso del correo
entrante de Conversaciones) y el resto (rojo, «llave inválida o borrada»), sin
exponer ni registrar la llave; anotar otros sitios con el mismo defecto.

## Qué se hizo

- **`checkResend`.** Helper `resendErrorName(body)` que lee `name` sin confiar en
  la forma del cuerpo. Casos:

  | Respuesta | Estado | Texto |
  |---|---|---|
  | 200 | `ok` | acceso completo · N dominio(s) verificado(s) |
  | `name: "restricted_api_key"` | `ok` | llave solo de envío · el correo entrante de Conversaciones no funcionará |
  | 401/403 sin ese nombre (incluye cuerpo ilegible) | `error` | llave inválida o borrada · HTTP 401/403 |
  | otro código | `error` | HTTP N |
  | sin red | `error` | motivo (`fetch failed`, timeout) |

- **Decisiones de criterio (a revisar):**
  1. Se decide por `name`, no por el código: `restricted_api_key` prueba que la
     llave existe. El pedido decía «401 restricted_api_key»; este criterio lo
     cumple y además no pone rojo si Resend cambiara el código de ese caso.
  2. «Llave inválida o borrada» sólo sale con 401/403. Un 500 o un 429 salen
     rojos con el código, sin culpar a la llave. El pedido decía «401 … o
     cualquier otro error: rojo, «llave inválida o borrada»»; se lee como «rojo
     siempre» y el texto de la llave sólo donde la llave es la causa probable.
     Si Sam prefiere el texto en todos los rojos, es un cambio de una línea.
- **Pruebas.** `describe("checkResend · el cuerpo del 401 decide")` en
  `lib/studio/__tests__/integration-health.test.ts`, 9 casos, por
  `checkAllIntegrations` (la entrada de `/studio/debug` y `/api/debug/health`).
- **Docs.** Spec 0527, índice regenerado y `docs/runbooks/setup-resend.md`: paso 2
  (Sending access alcanza para enviar, no para el correo entrante) y tres filas de
  troubleshooting con los estados del panel.

## Otros sitios que interpretan un 401 de Resend como éxito

1. **`checkResendWebhook`** (mismo archivo): `GET /webhooks` con 401/403 → `ok`
   «secret configurado · lista no legible con key Sending-scoped». Con una llave
   borrada y `RESEND_WEBHOOK_SECRET` puesto, la fila «Resend webhook» sigue verde.
   **Anotado, no corregido** (el encargo pedía anotarlos). Arreglo: el mismo
   criterio con `resendErrorName` y sus pruebas.
2. **`docs/runbooks/setup-resend.md` paso 2**: «Sending access (suficiente; full
   access innecesario)». Corregido en esta tarea (es el texto que el panel nuevo
   contradice).

Sin el defecto: `resendSend`, `resendBatchSend`, `resendGetReceivedEmail`
(`lib/studio/mail/resend-api.ts`), `app/api/conversaciones/email/route.ts` (502
si no baja el cuerpo), `lib/studio/newsletter/sender.ts`,
`lib/studio/mail/resend-stuck.ts`. Los 401 de `app/api/webhooks/resend` y de
`app/api/conversaciones/email` son respuestas propias por firma inválida.
`supabase/functions/` no usa Resend (los 401 de `kommo-sync` son de Kommo).

## VALIDACIÓN

Todo sobre el worktree de arriba, base `a8d99acf`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| Control rojo | `vitest run lib/studio/__tests__/integration-health.test.ts` con `integration-health.ts` idéntico a `origin/main` (`git diff` 0 líneas) | PASÓ como control: `Tests 6 failed \| 12 passed (18)`. Fallan los casos 200, sólo envío, 401 inválida, 403, 401 sin cuerpo y `restricted` en `message`; los 3 nuevos que pasan son de regresión (500, sin red, llave no expuesta) |
| Pruebas focalizadas | mismo archivo con el arreglo | PASÓ: `Tests 18 passed (18)` |
| Mutantes | 14, sólo sobre líneas del diff, sobre copia y restaurando desde la copia; muerto sólo con `Tests N failed` | PASÓ: control `Tests 18 passed (18)`, 14/14 muertos, archivo restaurado idéntico. Corredor en el scratchpad de la sesión (`mutantes-0527.mjs`) |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0) |
| `eslint` | `lib/studio/integration-health.ts` y su prueba | PASÓ (exit 0, sin salida) |
| `corepack pnpm docs:check` | índice de specs | FALLÓ la primera vez (índice desactualizado por la spec nueva); PASÓ tras `pnpm docs:index` |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; choques históricos de migraciones ya conocidos) |
| `git diff --check` | diff de la tarea | PASÓ |
| `pnpm verify` | completo | NO EJECUTADO: requiere turno del Director (una corrida pesada a la vez) |
| UI en navegador | `/studio/debug` → Estado | NO EJECUTADO: sin cambio de UI; el badge ya muestra `error ?? detail`. Verlo con una llave real de cada tipo requiere secretos de un entorno |
| Llave real contra Resend | — | NO EJECUTADO: no se usaron llaves reales. Los cuerpos simulados siguen lo confirmado por Sam el 2026-10-15 (`restricted_api_key` y «API key is invalid», ambos 401) |

Mutantes (nombre → resultado):

| # | Mutante | Tests |
|---|---|---|
| M1 | restricted por código 401, no por `name` | 3 failed |
| M2 | cualquier error con cuerpo cuenta como restricted | 4 failed |
| M3 | quita el 403 del rojo de llave | 1 failed |
| M4 | quita el 401 del rojo de llave | 2 failed |
| M5 | cualquier 4xx/5xx culpa a la llave | 1 failed |
| M6 | lee `message` en vez de `name` | 2 failed |
| M7 | sin cuerpo se presume restricted | 2 failed |
| M8 | la llave de sólo envío sale roja | 1 failed |
| M9 | sin aviso del correo entrante | 1 failed |
| M10 | sin «acceso completo» en el 200 | 1 failed |
| M11 | el rojo copia el `message` de Resend | 4 failed |
| M12 | registra la llave con `console.warn` | 1 failed |
| M13 | la llave en el detalle del 200 | 2 failed |
| M14 | vuelve el comportamiento viejo (401/403 = ok) | 4 failed |

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0527, `docs/specs/README.md` (índice),
  `docs/runbooks/setup-resend.md`.
- El índice regenerado lista 0522–0526 como huecos: son reservas de otras sesiones
  que todavía no están en main. El driver de merge del índice lo resuelve al
  integrar.
- `corepack pnpm knowledge:status` (exit 0, `ok: false`): estructural `INVALID`
  (3365 missing, 4573 pending), semántico `INVALID` (1208 pending). Es el estado de
  un worktree nuevo sin derivados de Graphify, no causado por esta tarea. No se
  reconstruyó aquí (corrida pesada; la publica el Director desde main).
- `knowledge:visual` / `knowledge:visual:check`: NO EJECUTADO, dependen de un grafo
  estructural válido. El cambio no altera la arquitectura que mapea Archify.
- Obsidian: sin cambios; la publicación es del Director desde main integrado.

## COMMITS

| Hash | Propósito |
|---|---|
| `c745d5e7` | reserva SDD-0527 (cherry-pick del stub `882be30b`) |
| `e7578739` | `feat(studio)`: `checkResend` con los tres casos y sus 9 pruebas |
| `047c4ec4` | `docs(sdd)`: spec, índice y runbook |
| commit que contiene este documento | handoff |

## PR / BRANCH

Rama `claude/upbeat-poincare-8b87cc`, base `main`. La URL de la PR queda en su
descripción y en el cierre de la sesión. Sin fusionar: merges congelados hasta
después del corte de Vercel al servidor propio.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo, con turno del Director.
- Revisión de las dos decisiones de criterio (por `name`; texto de la llave sólo
  en 401/403).
- Estado SDD a `done` al integrar, si la revisión acepta.

## FUERA DE ALCANCE DETECTADO

- **`checkResendWebhook` trata 401/403 como sano** (mismo defecto, mismo archivo).
  Propuesta: aplicar `resendErrorName` con sus pruebas en una SDD propia.
- **SMTP de Supabase Auth usa la misma `RESEND_API_KEY`** como contraseña
  (`docs/runbooks/setup-portal-auth.md` paso 4; handoff 0505). Si la llave borrada
  es la del servidor, los correos de Auth (enlaces, invitaciones) también caen, y
  ningún chequeo lo mide. Conviene confirmar qué llave tiene cada entorno antes del
  corte.
- `docs/runbooks/setup-resend-inbound.md` usa voseo («querés», sección 4). No se
  tocó.

## HANDOFF AL DIRECTOR

1. Revisar la PR y las dos decisiones de criterio.
2. Dar turno para `pnpm verify` o correrlo al integrar.
3. Integrar después del corte (merge y deploy son autorizaciones aparte).
4. Decidir si `checkResendWebhook` va en una SDD propia.
5. Al integrar: estado SDD `done`, índice y Graphify desde main.

Sesiones consumidoras: ninguna. Ownership liberado al cerrar esta sesión.
