# Handoff — resumen diario de reportes a Discord `#bugs` (SDD-0036 §11)

Fecha: 2026-11-16. Worker Claude Code, sesión hija de «Faro (Lumi Asistente Estudio)». Sin subagentes.
Rama: `claude/elated-lalande-c8d876` (worktree `.claude/worktrees/elated-lalande-c8d876`), nacida de main `c4d155a8a`.

Estado: lista para revisión. PR publicada contra main por orden del Director General. No está fusionada ni desplegada.

## OBJETIVO ORIGINAL

Decisión D-13 de Sam (SDD-0637 §7.6, 2026-11-16): los reportes de gravedad alta y crítica siguen llegando a
Discord al momento, y lo demás llega en un resumen diario sin datos de clientes. El Director General decidió
registrarlo como enmienda de la SDD-0036, sin número nuevo.

## QUÉ QUEDÓ

- `lib/studio/notify/bug-daily-digest.ts`:
  - `buildBugDailyDigest`, función pura que arma el aviso;
  - `ventanaDelResumen`, el día anterior en hora de Caracas;
  - `fetchBugDigestRows`, que pide sólo `folio, category, severity, module`;
  - `runBugDailyDigest`.
- `app/api/cron/bug-daily-digest/route.ts`: cron con `CRON_SECRET` por header. Sin `DISCORD_TENANT_ID` o sin
  webhook de `#bugs` responde `discord-apagado` y no toca la base.
- `MinimalAlert.codigos`, para la lista de folios. Sólo acepta textos con forma de código. La cola
  `studio_alert_outbox` lo guarda y lo relee con el mismo filtro.
- `isKnownModuleSlug`: un módulo fuera de la lista cerrada se cuenta como «Otro módulo».
- `vercel.json`: cron diario a las `5 12 * * *` (08:05 en Caracas). El crontab se regeneró y
  `build-crontab.test.ts` pasó de 22 a 23 crons.
- Enmienda §11 en `docs/specs/0036-bug-reporter/spec.md`, con la D-13 citada, la allowlist y la aceptación.

Sin migración. El aviso al momento (`notifyBugCreatedToAdmin`) no cambió. Telegram no se tocó.

## EVIDENCIA

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ (625 specs) |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ |
| `node scripts/build-crontab.mjs --check` | PASÓ (29 crons) |
| Vitest local (`bug-daily-digest.test.ts`, `build-crontab.test.ts`, pruebas de alert-outbox/minimal-alert) | NO EJECUTADO: el worktree no tiene `node_modules` y el DG pidió usar la CI de GitHub como portón |
| `pnpm verify` | NO EJECUTADO, por la misma razón |
| CI de GitHub | ver la PR |

## PENDIENTES DE ESTA TAREA

- Leer la CI de la PR. Si sale roja, pedir turno al DG, que va detrás de la SDD-0646 y la SDD-0648.
- Para que el resumen salga en producción hacen falta el merge y el despliegue, cada uno con su autorización.
  Las variables `DISCORD_TENANT_ID` y `DISCORD_WEBHOOK_BUGS` ya existen por la SDD-0606. El valor del webhook es
  secreto y no va al repositorio.
- Límite conocido: dos corridas el mismo día mandan dos resúmenes iguales. El crontab lo agenda una sola vez.

## FUERA DE ALCANCE DETECTADO

- La cabecera de `lib/studio/bug-email-notify.ts` todavía describe Telegram como canal activo, aunque está
  retirado (SDD-0606). Es documentación vieja y no la toqué.

## IMPACTO DOCUMENTAL

- SDD-0036: enmienda §11 y `updated: 2026-11-16`.
- La SDD-0637 §7.6 (D-13) apunta a esta tarea. Cuando se fusione, se puede enlazar la PR desde ahí.
