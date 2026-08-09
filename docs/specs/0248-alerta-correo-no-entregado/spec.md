---
sdd: 0248
title: Alerta de correo no entregado
status: in-progress
author: Claude (ventana auditoría 2026-08-05)
created: 2026-08-05
updated: 2026-08-05
supersedes: null
superseded_by: null
related: [0026, 0059, 0143]
confidencialidad: interna
---

# SDD-0248 · Alerta de correo no entregado

## Problema

Medido en producción el 2026-08-05: **8 correos en `queued`** (el más viejo del
2026-05-29) y **4 rebotados**. Entre ellos, tres correos de bienvenida de
clientes que se registraron el 7 de junio y **nunca supieron su Shipping Mark**.

Dos meses sin que nadie se enterara. No fue un caso raro: es lo que el sistema
hace por diseño.

### La cadena exacta

1. `resendSend` devuelve `mock_no_key` si no hay `RESEND_API_KEY`
   (`lib/studio/mail/resend-api.ts:50`).
2. `sendEmail` traduce eso a **`{ok: true, queued: true}`** — éxito
   (`lib/studio/mail/send-email.ts`, rama 7c).
3. `sendWelcomeEmail` **descartaba** el flag `queued` y devolvía `{ok: true}`.
4. `registerClientAction` miraba `welcome.ok` → sin warning → el cliente veía
   "todo bien" en pantalla.
5. La fila queda en `queued` **para siempre**: `/api/cron/mail-scheduled` drena
   `mail_scheduled`, que es **otra tabla**. Nada reintenta `mail_logs`.
6. `error` quedaba en `null`, así que la fila era indistinguible de un correo en
   vuelo. No se podía ni diagnosticar.

Ningún paso "falla". El correo simplemente no llega y el sistema reporta éxito.

## Alcance

Este SDD **no** construye un reintento automático. Construye la **visibilidad**:
que nadie pueda pasar días sin enterarse. El reenvío sigue siendo una decisión
humana, porque las dos causas se arreglan distinto (ver §Modos de falla).

### Modos de falla

| Modo | Qué pasó | Cómo se arregla |
|---|---|---|
| `nunca_salio` | Sigue en `queued` pasada la ventana. No se entregó a Resend. | Reenviar |
| `no_llego` | Resend lo aceptó y rebotó / falló / lo marcaron spam. | Reenviar **no** sirve: contactar al cliente por otro canal y corregirle el correo |

## Diseño

- **`lib/studio/mail/mail-health.ts`** — clasificación pura y testeable sin DB ni
  red. Recibe el "ahora" como parámetro para poder fijar la ventana en el test.
- **`lib/studio/mail/mail-health-notify.ts`** — aviso por los dos canales que ya
  usa `new-client-notify`: correo a cada admin + Telegram a los que linkearon su
  chat.
- **`app/api/cron/mail-health/route.ts`** — orquesta: lee, clasifica, avisa,
  marca. Auth por `CRON_SECRET` en header. `?dry=1` clasifica sin avisar.
- **`vercel.json`** — `*/30 * * * *`. El objetivo es que nadie pase DÍAS sin
  enterarse, no reaccionar en un minuto.

### Decisiones

**Telegram es el canal que importa.** Este aviso existe porque el correo falla;
mandarlo solo por correo sería avisar del incendio por la casa que se quema.
Telegram no depende de Resend.

**Dedup en `metadata.health_alerted_at`, sin migración.** Cada fila se avisa una
vez. La primera corrida saca el atraso histórico (por eso la ventana por defecto
es de 400 días) y a partir de ahí solo habla cuando hay algo nuevo.

**⚠️ Guard anti-bucle.** El aviso se manda por correo. Si ese correo se queda en
`queued`, la siguiente corrida avisaría de él, y así para siempre. Por eso
`classifyMailFailure` ignora todo lo que traiga
`metadata.source = 'mail-health'`. Está cubierto por test **validado con
mutación**: al quitar el guard, 2 tests se ponen rojos.

**Marcar DESPUÉS de avisar.** Si el aviso revienta, la próxima corrida lo
reintenta. Al revés se perdería el aviso en silencio — que es exactamente el bug
que este SDD existe para no repetir.

### Cambios de contrato (fuera del cron)

1. `sendEmail` ahora escribe `error: 'no_key'` en la fila que queda en `queued`.
   El docstring ya decía que lo hacía; el código no lo hacía. Sin eso la fila es
   indiagnosticable.
2. `WelcomeEmailResult` gana el campo `queued`, que antes se descartaba.
3. `registerClientAction` muestra el warning "el email de bienvenida no se pudo
   enviar" también cuando quedó en `queued`. Para el cliente es lo mismo: no le
   llegó.

## Lo que este SDD NO hace

- No reintenta envíos automáticamente.
- No rescata los 12 correos ya atascados — eso es una acción de operación, con la
  lista en `docs/audits/estado-operacional-2026-08-05.md`.
- No toca las otras 150 rutas best-effort del repo (ver §3.1 de esa auditoría).
  Este SDD cubre una sola: la del correo, que es la que estaba sangrando.

## Verificación

- `lib/studio/mail/__tests__/mail-health.test.ts` — 12 casos, incluidos el borde
  exacto de la ventana y el anti-bucle. **Validado con mutación.**
- `lib/studio/__tests__/welcome-email.test.ts` — caso nuevo para `queued:true`.
- `pnpm typecheck` · `pnpm lint` · `node scripts/verify.mjs`.
