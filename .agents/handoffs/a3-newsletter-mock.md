# A3 — Newsletter: mensaje correcto cuando Resend está simulado

Rama: `claude/a3-newsletter-mock-staging-27a0da`. PR en borrador contra `main`; no se mergea (merge = publicación).

## Qué cambió

`lib/studio/newsletter/sender.ts`: `mock_no_key` tiene dos causas y ahora el mensaje las distingue.

| Caso | Mensaje |
|---|---|
| Llave ausente (campaña) | `RESEND_API_KEY no está configurada.` (igual que antes) |
| Llave ausente (prueba) | `RESEND_API_KEY no está configurada; la prueba no salió.` (igual que antes) |
| Entorno de prueba (`APP_ENV=staging`, `code: "app_env_staging"`) | `Estás en el entorno de prueba: el envío está simulado a propósito y no sale ningún correo real.` (la prueba añade ` La prueba no salió.`) |

- Campaña: se decide por `result.code === RESEND_SIMULADO_PRUEBA`.
- Prueba interna: `sendEmail` no propaga `code`, así que se replica el orden de `envioSimulado` (llave presente y `resolveAppEnv() === "staging"`). Tocar `send-email.ts` queda fuera de la lista de archivos permitidos.
- Sin secretos: sólo aparece el nombre de la variable en el caso de llave ausente, como antes.

## Consumidores revisados

- UI del Studio: `app/studio/(app)/marketing/newsletter/actions.ts:176` devuelve `result.error` tal cual; hereda el texto nuevo sin cambios. No se tocó pantalla, así que no aplica `/ui-check`.
- `mail_logs` / destinatarios: en la campaña se siguen guardando con el `error` crudo `mock_no_key` (persistencia, no pantalla). Sin cambios.

## Pruebas

- Nueva: `lib/studio/newsletter/__tests__/sender-mock-no-key.test.ts` (4 casos: staging y llave ausente, en prueba y en campaña).
- Ajustada: `sender-secreto-vacio.test.ts` (su mock de `resend-api` ahora exporta `RESEND_SIMULADO_PRUEBA`).
- **Control rojo:** con `sender.ts` de `HEAD` los 2 casos de staging FALLAN y los 2 de llave ausente pasan; con el cambio, los 4 pasan.

## Cierre (por el diff)

- Vitest `lib/studio/newsletter` + `lib/studio/mail`: PASÓ (10 archivos, 92 pruebas).
- `tsc --noEmit`: PASÓ (exit 0).
- ESLint de archivos tocados: PASÓ (exit 0, con node_modules propio instalado en el worktree).
- `pnpm verify` sobre `7090c7d32` (con turno del Director, una sola corrida): FALLÓ, VERIFY_EXIT=1 (06:31Z). `test` FALLÓ en sus dos pasadas por tiempo agotado con «Failed to start forks worker» en 4 archivos; `e2e` FALLÓ en `e2e/sin-scroll-horizontal.spec.ts:119` (conocido: viene de `next dev`, arreglo en la #365), flaky `e2e/auth.spec.ts:81`; `build` OK; `migrations-applied` sin medir. Según el Director, el log no llegó a esta sesión; lo reporto tal como me lo pasó.
- Los 4 archivos de `test` que fallaron, corridos solos (0 pesadas ajenas, 8,11 GB libres, `--reporter=default --pool=forks`): PASÓ. `document-entity-bitacora-task.migration.test.ts` 20/20, `infra/ops/tests/migraciones.test.mjs` 30/30 (189 s), `scripts/__tests__/entorno-prueba-scripts.test.mjs` 2/2 (197 s), `PackingListProductsStep.test.tsx` 9/9. Con esa medición, los rojos de `test` son de carga/tiempo y no de mi diff. Mi diff no toca ninguno de esos archivos.
- Revisión de voseo: sin formas de voseo en lo escrito.

## Pendientes de esta tarea

- `pnpm verify` completo limpio: pendiente; lo decide el Director.

## FUERA DE ALCANCE DETECTADO

1. `node_modules` del checkout principal sin `es-to-primitive` (rompe ESLint para quien lo use).
2. `sendEmail` (`lib/studio/mail/send-email.ts:225`) descarta el `code` y guarda `error: "no_key"` también en staging; `mail-health` lo leerá como falta de llave. Propagar el `code` es tarea aparte.

## Impacto documental

Ninguno canónico. Graphify/Obsidian: NO DISPONIBLE en este worktree.

## Checklist

Listo: mensaje distinto, pruebas con control rojo, tsc, Vitest vecino, handoff.
Pendiente: ESLint, `pnpm verify`, revisión y merge por el Director.
