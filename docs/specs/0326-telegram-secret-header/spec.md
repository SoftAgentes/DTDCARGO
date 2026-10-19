---
sdd: 0326
title: Retirar el secreto del webhook Telegram de la URL
status: in-progress
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0036
  - SDD-0247
  - SDD-0271
confidencialidad: interno
---

# SDD-0326 — Retirar el secreto del webhook Telegram de la URL

## Problema

El webhook activo fue diseñado con `?secret=` porque el código asumía que
Telegram no enviaba headers propios. Esa premisa está desactualizada: el Bot API
acepta `secret_token` en `setWebhook` y lo entrega en
`X-Telegram-Bot-Api-Secret-Token`. Una credencial en la URL puede terminar en
access logs, historial, observabilidad o copias de diagnóstico.

## Contrato local

1. `TELEGRAM_WEBHOOK_SECRET` sólo autentica el header oficial y debe cumplir el
   alfabeto y longitud que admite Telegram.
2. La presencia de un header incorrecto falla con 403 y nunca degrada al query.
3. El secreto primario enviado como `?secret=` falla con 403.
4. Durante el corte, sólo
   `TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET` puede autenticar el query viejo.
5. Ausencia o formato inválido del secreto primario falla cerrado con 503 sin
   revelar nombres de variables ni valores.
6. La autenticación ocurre antes de parsear el update o tocar la base de datos.
7. El panel de salud marca error si `getWebhookInfo` devuelve una URL con el
   parámetro `secret`, sin copiar su valor al mensaje, o si la compatibilidad
   legacy sigue configurada después del corte.
8. El runbook exige rotación, URL limpia, smoke y retiro del secreto legacy.

## Corte alojado obligatorio

El cambio local no se puede considerar operativo hasta completar, en orden:

1. configurar el secreto legacy actual en Vercel;
2. desplegar la compatibilidad;
3. rotar el secreto primario y desplegar;
4. ejecutar `setWebhook` con URL limpia y `secret_token`;
5. verificar `getWebhookInfo` y el flujo `/start`;
6. eliminar el secreto legacy y volver a desplegar.

Todos esos pasos son escrituras externas separadas y requieren autorización
específica. No se ejecutan como parte de este commit.

> **Nota del 2026-10-19 (Worker de documentación, sin cambiar el registro).**
> Desde el 2026-10-16 Vercel está en pausa y la web corre en el servidor propio
> (VPS de Contabo): los pasos de arriba que nombran Vercel ya no se ejecutan
> ahí. En el corte, la sesión de Contabo corrió `setWebhook` con URL limpia y
> `secret_token` desde el servidor (`infra/ops/web/telegram-webhook.sh set`, el
> 2026-10-16 a las 07:06Z, según el registro de
> `docs/runbooks/servidor-contabo.md` §3.6), con el `TELEGRAM_WEBHOOK_SECRET`
> del `.env` del servidor. Hoy `app/api/telegram/webhook/route.ts` compara solo
> ese secreto, en el header (SDD-0499). Si algo de este corte sigue pendiente,
> se hace en el `.env` del servidor y con ese script. No comprobé
> `getWebhookInfo` ni el flujo `/start` para esta nota: cerrar la spec pide esa
> evidencia.

## Fuente del proveedor

- [Telegram Bot API · setWebhook](https://core.telegram.org/bots/api#setwebhook),
  consultado el 2026-09-02: `secret_token` produce el header
  `X-Telegram-Bot-Api-Secret-Token` y admite 1–256 caracteres del alfabeto
  documentado.

## Allowlist exacta

- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/webhook/route.test.ts`
- `lib/studio/integration-health.ts`
- `lib/studio/__tests__/integration-health.test.ts`
- `.env.example`
- `docs/runbooks/setup-telegram-bot.md`
- `docs/specs/0326-telegram-secret-header/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/2026-09-02-telegram-secret-header-close.md`

## Aceptación

- Tests prueban header válido, query primario rechazado, compatibilidad legacy
  explícita, no-downgrade, configuración inválida y auth antes del JSON.
- La salud diferencia URL limpia de URL con secreto sin filtrar el valor.
- Lint, TypeScript, documentación, gobernanza y verificación canónica pasan.
- El estado permanece `in-progress` hasta completar el corte alojado.
