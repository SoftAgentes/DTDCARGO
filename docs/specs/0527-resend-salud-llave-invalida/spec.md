---
sdd: "0527"
title: "Salud de Resend: una llave borrada deja de salir verde en /studio/debug"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0026","0056","0247","0291"]
confidencialidad: interno
---

# SDD-0527 — Salud de Resend: una llave borrada deja de salir verde en /studio/debug

> `checkResend` lee el cuerpo del 401 de Resend. Una llave «Sending access»
> (`restricted_api_key`) sigue en verde, con el aviso de que el correo entrante
> de Conversaciones no funcionará. Una llave borrada o inválida sale en rojo:
> «llave inválida o borrada».

## Contexto

`lib/studio/integration-health.ts` → `checkResend` llama a
`GET https://api.resend.com/domains` con `RESEND_API_KEY`. El resultado se ve en
`/studio/debug` → Estado → «Resend (mail)», y también lo devuelve
`/api/debug/health` (incluido el modo barato `?cheap=1`, porque Resend no es una
integración medida).

Hasta ahora el chequeo devolvía `ok` ante **cualquier** 401 o 403, para tolerar
las llaves «Sending access» que recomienda `docs/runbooks/setup-resend.md`. Pero
Resend responde 401 a dos llaves muy distintas:

| Llave | Respuesta de `/domains` | ¿Envía? |
|---|---|---|
| «Sending access» (restringida) | 401, `name: "restricted_api_key"` | Sí |
| Borrada o inválida | 401, `message: "API key is invalid"` | No |

Problema confirmado el 2026-10-15: Sam borró por error dos API keys en Resend, y
el panel no podía decir si la llave de un entorno había muerto, porque la llave
borrada también salía verde.

## Objetivo

1. `checkResend` distingue tres casos leyendo el cuerpo de la respuesta.
2. Una llave borrada o inválida sale en rojo con «llave inválida o borrada».
3. La llave nunca aparece en el resultado ni en registros.
4. Se anotan los demás sitios que interpretan un 401 de Resend como éxito.

## Decisión

### Los tres casos

| Respuesta de `GET /domains` | Estado | Texto en `/studio/debug` |
|---|---|---|
| 200 | `ok` | acceso completo · N dominio(s) verificado(s) |
| Error con `name: "restricted_api_key"` | `ok` | llave solo de envío · el correo entrante de Conversaciones no funcionará |
| 401 o 403 sin `restricted_api_key` (incluye «API key is invalid» y cuerpo ilegible) | `error` | llave inválida o borrada · HTTP 401 (o 403) |
| Cualquier otro código (429, 5xx…) | `error` | HTTP N |
| Sin red o timeout | `error` | el motivo de la falla (p. ej. `fetch failed`) |

N cuenta sólo los dominios con `status: "verified"`, igual que antes.

### Razones

- **Se decide por `name`, no por el código.** `restricted_api_key` es la
  evidencia de que la llave existe: Resend la autenticó y le negó el recurso. Un
  401 sin ese nombre puede ser una llave borrada, así que ya no se presume sano.
  Si Resend devolviera `restricted_api_key` con otro código, la llave sigue
  existiendo y el verde sigue siendo cierto.
- **El nombre tiene que venir en `name`.** Un `message` que diga
  «restricted_api_key» no alcanza: se compara el campo, no se busca texto.
- **Un 5xx o un 429 no culpan a la llave.** «Llave inválida o borrada» sólo sale
  con 401 o 403. Con otro código el rojo dice el código, para no mandar a revisar
  la llave cuando el problema es de Resend o de cuota.
- **El aviso del correo entrante va en la llave de sólo envío.** El webhook
  inbound de Conversaciones (`app/api/conversaciones/email/route.ts`) baja el
  cuerpo con `GET /emails/receiving/:id` usando la misma `RESEND_API_KEY`
  (`resendGetReceivedEmail` en `lib/studio/mail/resend-api.ts`). Una llave de
  sólo envío no puede: el endpoint responde 502 y Resend reintenta sin éxito. El
  chequeo sigue en verde porque el envío funciona, pero el texto lo dice.
- **La llave no sale.** Viaja sólo en el header `Authorization`. El resultado no
  copia texto del cuerpo de Resend (`name` se compara, no se muestra) y el
  chequeo no registra nada (ERR-01: «no se muestran … tokens»).
- **Sin cambio visual.** `HealthBadge` ya muestra `error ?? detail` en una línea
  con el texto completo en `title`; sólo cambian los textos y el color del rojo
  que antes salía verde.

### Superficie

| Archivo | Cambio |
|---|---|
| `lib/studio/integration-health.ts` | `resendErrorName()` nuevo y `checkResend` con los tres casos. |
| `lib/studio/__tests__/integration-health.test.ts` | `describe("checkResend · el cuerpo del 401 decide")`: 9 casos. |
| `docs/runbooks/setup-resend.md` | Qué alcanza una llave «Sending access» y cómo leer los tres estados del panel. |

No cambia `checkResendWebhook` (ver «Otros sitios»), ni la UI, ni el endpoint
`/api/debug/health`, ni migraciones.

**Datos personales:** no aplica. El chequeo no lee ni mueve datos personales; la
respuesta de `/domains` trae nombres de dominio y se sigue usando sólo para
contarlos.

### Gobernanza

| Política | Clasificación |
|---|---|
| ERR-01 (errores seguros, sin tokens) | cumplimiento: el rojo dice qué pasó sin la llave ni el texto de Resend. |
| VIS-01 / VIS-02 | no aplica: sin cambio visual; el badge danger ya va con texto. |
| AUD-01 / AUD-02 | no aplica: lectura de salud, sin mutaciones. |

## Otros sitios que interpretan un 401 de Resend como éxito

Barrido del 2026-10-15 sobre `app/`, `lib/`, `components/`, `scripts/`, `infra/`
y `supabase/functions/` (`api.resend.com`, `RESEND_API_KEY`, `status === 401/403`,
`restricted`, «Sending»):

1. **`checkResendWebhook`** (`lib/studio/integration-health.ts`, mismo archivo).
   Llama a `GET /webhooks` y devuelve `ok` («secret configurado · lista no legible
   con key Sending-scoped») ante cualquier 401 o 403. Con una llave borrada y
   `RESEND_WEBHOOK_SECRET` configurado, la fila «Resend webhook» sigue en verde.
   Mismo defecto; **no se corrige aquí** por alcance. El arreglo es el mismo
   criterio (`resendErrorName(r.body) === "restricted_api_key"`) con sus pruebas.
2. **`docs/runbooks/setup-resend.md`, paso 2** decía «Sending access (suficiente;
   full access innecesario)». Es cierto para enviar, pero no para el correo
   entrante de Conversaciones (`docs/runbooks/setup-resend-inbound.md`), que baja
   el contenido con la misma llave. Se corrige el texto en esta SDD; no cambia la
   recomendación.

Revisados y **sin** el defecto (tratan cualquier no-2xx como error):
`resendSend`, `resendBatchSend` y `resendGetReceivedEmail`
(`lib/studio/mail/resend-api.ts`); `app/api/conversaciones/email/route.ts`
(502 si no baja el cuerpo); `lib/studio/newsletter/sender.ts` y
`lib/studio/mail/resend-stuck.ts` (usan las funciones anteriores). El 401 de
`app/api/webhooks/resend` y de `app/api/conversaciones/email` es la respuesta
propia ante una firma inválida, no un 401 de Resend.

Relacionado, sin ser un 401 tratado como éxito: el SMTP de Supabase Auth del
servidor usa la `RESEND_API_KEY` como contraseña (`docs/runbooks/setup-portal-auth.md`,
paso 4). Si esa llave es una de las borradas, los correos de Auth también dejan
de salir, y este chequeo no lo mide (prueba el entorno de la app, no el de
GoTrue).

## Criterios de aceptación

1. 200 de `/domains` → `ok`, «acceso completo · N dominio(s) verificado(s)»,
   contando sólo `verified`.
2. Error con `name: "restricted_api_key"` → `ok`, con «solo de envío» y
   «correo entrante de Conversaciones».
3. 401 «API key is invalid» → `error`, «llave inválida o borrada · HTTP 401».
4. 403 sin `restricted_api_key` y 401 sin cuerpo legible → `error`, «llave
   inválida o borrada».
5. `restricted_api_key` sólo en `message` → `error`.
6. 500 → `error` «HTTP 500», sin culpar a la llave; sin red → `error` con el
   motivo.
7. En los cuatro escenarios (200, sólo envío, inválida, 500), con la llave
   devuelta adrede en el cuerpo, la llave viaja en el header y no aparece en el
   resultado ni en `console.*`.
8. Control rojo: los casos 1–5 fallan contra el código de `origin/main`.
9. Mutantes sobre las líneas del diff: todos muertos, con control verde.

## Evidencia

Se completa en `.agents/handoffs/0527-resend-salud-llave-invalida.md`.

## Registro de integración (2026-10-15)

- **PR:** #228 (`claude/upbeat-poincare-8b87cc`). Cabeza `3f851baa` fusionada con `--match-head-commit`; merge `262ba234` a las 11:54:04Z.
- **CI:** «Calidad continua» PASÓ sobre esa cabeza (run 38728500639), con la suite y el build. `pnpm verify` local: NO EJECUTADO (una corrida pesada a la vez; el CI corre la suite completa).
- **Deploy:** el status de Vercel del merge dice «Deployment has completed» (11:56:12Z). El ID del deployment y el alias quedan NO VERIFICADOS: el conector de Vercel responde 403.
- **Decisión de Sam,** literal: «Así está bien: «llave inválida o borrada» solo con 401/403; un 500 o 429 dice el código.»
- **Revisión del Director:** aprobado decidir por el campo `name` (`restricted_api_key`) y no por el texto ni por el código.
- **Smoke de Sam: PENDIENTE.** Abrir `/studio/debug` y confirmar que la fila de Resend refleja la llave vigente.
- **Estado:** integrada. La spec sigue en `in-progress` hasta el smoke.
