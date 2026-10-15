---
sdd: "0533"
title: "Salud del webhook de Resend: una llave borrada deja de salir verde en /studio/debug"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0026","0247","0527"]
confidencialidad: interno
---

# SDD-0533 — Salud del webhook de Resend: una llave borrada deja de salir verde en /studio/debug

> `checkResendWebhook` lee el cuerpo del 401 de Resend, como `checkResend` desde
> la SDD-0527. Sólo la pareja 401 + `restricted_api_key` (llave «Sending
> access») sigue en verde. Una llave borrada, inválida o inactiva sale en rojo:
> «llave inválida o borrada».

## Contexto

`lib/studio/integration-health.ts` → `checkResendWebhook` llama a
`GET https://api.resend.com/webhooks` con `RESEND_API_KEY` cuando además está
`RESEND_WEBHOOK_SECRET`. El resultado se ve en `/studio/debug` → Estado →
«Resend webhook» y también lo devuelve `/api/debug/health` (incluido
`?cheap=1`: no es una integración medida).

El chequeo devolvía `ok` («secret configurado · lista no legible con key
Sending-scoped») ante **cualquier** 401 o 403. Una llave borrada o inválida
también responde 401 («API key is invalid»), así que con el secret configurado
la fila seguía verde con la llave muerta. La SDD-0527 corrigió el mismo defecto
en `checkResend` y dejó este anotado fuera de alcance («Otros sitios», punto 1).
Contexto del 2026-10-15: Sam borró por error dos API keys en Resend.

### La referencia de errores de Resend

Consultada el 2026-10-15 en `https://resend.com/docs/api-reference/errors`
(entradas relevantes, resumidas):

| `name` | Código | Mensaje | Acción sugerida por Resend |
|---|---|---|---|
| `missing_api_key` | 401 | falta la llave en el header | enviar el header |
| `restricted_api_key` | 401 | la llave sólo puede enviar correos | usar una llave con Full access |
| `restricted_api_key` | **403** | «API key is not active» | revisar la llave y crear otra |
| `suspended_api_key` | 403 | la llave está suspendida | contactar a soporte |

El mismo `name` aparece con 403 para una llave **inactiva**, que no envía. Por
eso este chequeo exige el código 401 además del nombre. La respuesta «API key is
invalid» de una llave borrada (401) es la que Sam confirmó el 2026-10-15 y la
que usa la SDD-0527; no figura en esa tabla.

## Objetivo

1. `checkResendWebhook` distingue la llave de sólo envío de la llave muerta
   leyendo el cuerpo de la respuesta.
2. Una llave borrada, inválida o inactiva sale en rojo con «llave inválida o
   borrada».
3. Ni la llave ni el secret aparecen en el resultado ni en registros.

## Decisión

### Los casos

| Respuesta de `GET /webhooks` | Estado | Texto en `/studio/debug` |
|---|---|---|
| 200 con al menos un webhook | `ok` | N webhook(s) activo(s) (sin cambio) |
| 200 sin webhooks | `error` | Secret seteado pero sin webhooks registrados (sin cambio) |
| 401 con `name: "restricted_api_key"` | `ok` | secret configurado · llave solo de envío, no puede listar webhooks |
| 401 o 403 en cualquier otro caso (incluye «API key is invalid», `restricted_api_key` con 403, `suspended_api_key` y cuerpo ilegible) | `error` | llave inválida o borrada · HTTP 401 (o 403) |
| Cualquier otro código (429, 5xx…) | `error` | HTTP N (sin cambio) |
| Sin red o timeout | `error` | el motivo de la falla, p. ej. `fetch failed` (sin cambio) |

### Razones

- **Se reutiliza `resendErrorName()`** de la SDD-0527: se compara el campo
  `name`, no se busca texto en `message`, y nunca se copia al resultado.
- **Se exige el 401, a diferencia de `checkResend`.** El pedido era aplicar el
  mismo criterio que la SDD-0527 (cualquier código con `restricted_api_key` →
  verde). La referencia de errores de Resend contradice la premisa de esa SDD
  («si Resend devolviera `restricted_api_key` con otro código, la llave sigue
  existiendo»): con 403 significa «API key is not active». Con el criterio de
  la SDD-0527 una llave inactiva saldría verde aquí, que es justo lo que esta
  SDD corrige. El hueco equivalente en `checkResend` queda anotado en «Fuera de
  alcance».
- **Un 5xx o un 429 no culpan a la llave.** «Llave inválida o borrada» sólo sale
  con 401 o 403; con otro código el rojo dice el código.
- **El verde de sólo envío no confirma el webhook.** Con esa llave Resend no
  deja listar `/webhooks`; el texto lo dice para que se confirme en el dashboard
  de Resend, como antes.
- **La llave y el secret no salen.** La llave viaja sólo en el header
  `Authorization`; el secret sólo se mira para saber si está configurado y no
  viaja a Resend. El resultado no copia texto del cuerpo y el chequeo no
  registra nada (ERR-01).
- **Sin cambio visual.** `HealthBadge` ya muestra `error ?? detail`; sólo cambian
  el texto del verde de sólo envío y el color de los 401/403 que antes salían
  verdes.

### Superficie

| Archivo | Cambio |
|---|---|
| `lib/studio/integration-health.ts` | `checkResendWebhook` con los casos de arriba. |
| `lib/studio/__tests__/integration-health.test.ts` | `describe("checkResendWebhook · el cuerpo del 401 decide")`: 11 casos. |
| `docs/runbooks/setup-resend.md` | Troubleshooting: cómo leer la fila «Resend webhook». |

No cambian `checkResend`, la UI, `/api/debug/health` ni migraciones.

**Datos personales:** no aplica. El chequeo no lee ni mueve datos personales; de
`/webhooks` sólo se cuentan los elementos.

### Gobernanza

| Política | Clasificación |
|---|---|
| ERR-01 (errores seguros, sin tokens) | cumplimiento: el rojo dice qué pasó sin la llave, el secret ni el texto de Resend. |
| VIS-01 / VIS-02 | no aplica: sin cambio visual; el badge danger ya va con texto. |
| AUD-01 / AUD-02 | no aplica: lectura de salud, sin mutaciones. |

## Fuera de alcance

- **`checkResend` (SDD-0527) da verde a `restricted_api_key` con 403.** Compara
  sólo el `name`, así que una llave inactiva («API key is not active», 403)
  sale «llave solo de envío». Arreglo propuesto: exigir `r.status === 401` en
  esa rama, con una prueba de 403 `restricted_api_key`. No se toca aquí porque
  cambia el comportamiento de otra SDD.
- **`suspended_api_key` (403) sale «llave inválida o borrada».** La acción
  correcta es contactar a soporte, no crear otra llave. El texto incluye el
  código; distinguirlo sería otra decisión.

## Criterios de aceptación

1. 200 con webhooks → `ok`, «N webhook(s) activo(s)»; 200 sin webhooks →
   `error`, «Secret seteado pero sin webhooks registrados».
2. 401 con `name: "restricted_api_key"` → `ok`, «secret configurado · llave
   solo de envío, no puede listar webhooks».
3. 401 «API key is invalid», 403 `suspended_api_key`, 403 `restricted_api_key`
   («API key is not active») y 401 sin cuerpo legible → `error`, «llave
   inválida o borrada · HTTP N».
4. `restricted_api_key` sólo en `message` → `error`.
5. 500 → `error` «HTTP 500»; sin red → `error` con el motivo.
6. En cinco escenarios (200, sólo envío, inválida, inactiva, 500), con la llave
   y el secret devueltos adrede en el cuerpo, la llave viaja sólo en el header,
   el secret no viaja, y ninguno aparece en el resultado ni en `console.*`.
7. Control rojo: los casos 2–4 fallan contra el código de `origin/main`.
8. Mutantes sobre las líneas del diff: todos muertos, con control verde.

## Evidencia

Se completa en `.agents/handoffs/0533-resend-webhook-salud-llave-invalida.md`.
