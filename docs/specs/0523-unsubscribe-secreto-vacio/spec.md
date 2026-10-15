---
sdd: "0523"
title: "Secretos de firma vacíos cuentan como ausentes: baja de correo, /marca, sal del newsletter y webhook entrante"
status: in-progress
author: "Claude"
created: 2026-10-15
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0518", "0505", "0082", "0238"]
confidencialidad: interno
---

# SDD-0523 — Secretos de firma vacíos cuentan como ausentes

> Una variable de secreto definida pero vacía, o con sólo espacios, se trata igual
> que una sin definir: se pasa al respaldo y, si no queda ninguno, el código falla
> cerrado. Aplica a los cuatro secretos de firma o verificación que se leían con
> `??`. Es el mismo patrón que la [0518](../0518-ga-respaldo-cadena-vacia/spec.md)
> corrigió para `NEXT_PUBLIC_GA_ID`, ahora en secretos de servidor.

## Contexto

Docker Compose pasa `VAR=` como cadena vacía, no como `undefined`. El 2026-10-15
se midió que el contenedor `dtd-cargo-web-1` del servidor propio tenía
`EMAIL_UNSUBSCRIBE_SECRET` definida con largo 0. Las vacías eran a propósito: la
sesión de Contabo las dejó así el 2026-10-13 porque esas variables no existen en
Vercel, y esperaba que la app cayera a `SUPABASE_SERVICE_ROLE_KEY`
(`infra/dtd-cargo/.env.example:102-108`, runbook `servidor-contabo.md:585`). Con
`??` eso no pasa: `"" ?? respaldo` es `""`.

El Director informó después que Contabo ya quitó las vacías del `.env` del
servidor. Esta spec arregla el código para que no vuelva a depender de eso.

### Qué hacía de verdad la cadena vacía (base `a8d99acf`)

El encargo suponía que con `""` los tokens de baja se firmaban con clave vacía y
se podían falsificar. El control rojo muestra que no es así para `""` exacto,
pero sí para un valor de sólo espacios:

| Sitio | Con `""` | Con sólo espacios (`"  "`) |
|---|---|---|
| Baja de correo (`unsubscribe-request.ts:50-53`) | `!secret` la descarta: **toda** baja responde 500 y redirige a `estado=error`, también los enlaces legítimos sellados con el service role | `"  "` pasa como clave: **cualquiera puede sellar un enlace de baja válido** para cualquier correo |
| Emisor de Actualidad (`newsletter/sender.ts:103-105` y `:140-141`) | se niega a enviar («No está configurado el secreto de baja») | firma los enlaces con `"  "` |
| Cookie de `/marca` (`marca/access.ts:139-140`, `:244-245`, `:271-272`) | `!secret` la descarta: `/marca` queda cerrada aunque haya service role | `"  "` pasa como clave: **cualquiera puede fabricar la cookie** y saltarse el código |
| Sal del hash de IP del newsletter (`newsletter/subscribe/route.ts:155-160`) | **no hay `!secret`**: la sal queda en `""` y `consent_ip_hash` es un SHA-256 de `:<ip>`, reversible probando las 2³² IPv4 | la sal es `"  "`, igual de pública |
| Webhook de correo entrante (`conversaciones/email/route.ts:44-51`) | 503: no cae a `RESEND_WEBHOOK_SECRET` | WebCrypto rechaza la clave HMAC de largo cero («Zero-length key is not supported», Node 24.20.0): 401 a todo |

Con la variable vacía en el servidor, entonces, la baja de correo no se podía
falsificar, pero tampoco funcionaba: cualquier enlace de baja que llegara a ese
servidor daba error. *No verificado:* si algún enlace de baja llegó al servidor
propio mientras estuvo vacía. Los correos apuntan a `NEXT_PUBLIC_SITE_URL`, que
sigue en Vercel hasta el corte.

## Decisión

Helper nuevo [`lib/runtime/server-secret.ts`](../../../lib/runtime/server-secret.ts):

```ts
export function firstConfiguredSecret(
  ...candidates: ReadonlyArray<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}
```

- Vacía o con sólo espacios cuenta como ausente y se pasa a la siguiente.
- **El valor elegido se usa tal cual, sin recortar.** El `trim` sólo decide. Es
  distinto de la 0518 a propósito: recortar un secreto que hoy tenga espacios
  cambiaría la clave y dejaría sin efecto los enlaces de baja ya enviados, que no
  vencen nunca. El mutante «devuelve el valor recortado» lo vigila.
- Sin ninguno, `null`, y cada llamador conserva su forma de fallar cerrado.
- Recibe valores y no nombres, para que cada sitio siga escribiendo
  `process.env.X` literal y se encuentre con un grep.
- Hay helper compartido porque son cinco sitios en cuatro archivos y tres zonas
  (`lib/studio`, `lib/marca`, `app/api`). La 0518 no lo creó porque era un solo
  caso. `lib/runtime/app-env.ts` ya tenía un `nonEmpty` privado con la misma
  idea, pero devuelve el valor recortado, que aquí no sirve.

Sitios corregidos:

| Sitio | Antes | Después |
|---|---|---|
| `unsubscribeSecret()` (`lib/studio/mail/unsubscribe-token.ts:140-145`) | `EMAIL_UNSUBSCRIBE_SECRET ?? SUPABASE_SERVICE_ROLE_KEY ?? null` | `firstConfiguredSecret(…)` con el mismo orden |
| Log `secretSource` (`lib/studio/mail/unsubscribe-request.ts:73`) | `EMAIL_UNSUBSCRIBE_SECRET ? "dedicated" : "service_role"`: con espacios decía `dedicated` | `unsubscribeSecretSource()` (nuevo, `unsubscribe-token.ts:147-152`), que usa el mismo criterio que el secreto |
| `hashIp()` (`app/api/newsletter/subscribe/route.ts:161-167`) | `NEWSLETTER_IP_HASH_SECRET ?? EMAIL_UNSUBSCRIBE_SECRET ?? SUPABASE_SERVICE_ROLE_KEY ?? "newsletter-local"` | `firstConfiguredSecret(…) ?? "newsletter-local"` |
| `marcaSecret()` (`lib/marca/access.ts:82-87`) | `MARCA_ACCESS_SECRET ?? SUPABASE_SERVICE_ROLE_KEY ?? null` | `firstConfiguredSecret(…)` |
| Webhook entrante (`app/api/conversaciones/email/route.ts:46-49`) | `RESEND_INBOUND_WEBHOOK_SECRET ?? RESEND_WEBHOOK_SECRET` | `firstConfiguredSecret(…)` |

### Fallo cerrado

- Baja: sin secreto, la ruta responde 500 y no verifica ningún token, ni el
  sellado con `""` ni el HMAC histórico; el emisor no firma ni envía.
- `/marca`: sin secreto, `submitBrandCode` devuelve `unavailable` sin llamar a la
  RPC y ninguna cookie abre.
- Webhook entrante: sin ninguno de los dos, 503 sin verificar.
- Sal del newsletter: sin ninguno, sigue `"newsletter-local"`, que era la
  conducta con las tres sin definir. No se cambia a fallo cerrado porque es una
  sal y no una firma, y porque en la práctica no se alcanza: la ruta pide
  `createAdminClient()` antes, y ese cliente lanza sin `SUPABASE_SERVICE_ROLE_KEY`
  (`lib/db/admin.ts:27`). Volverla obligatoria sería un cambio de conducta fuera
  de este encargo.

### Compatibilidad

- Con el dedicado definido, nada cambia: se usa el mismo valor, sin recortar.
- Sin el dedicado (Vercel hoy), nada cambia: se usa el service role.
- Con el dedicado vacío, ahora se usa el service role. Si es la service role de
  Cloud, los enlaces de baja y las cookies de `/marca` emitidos por Vercel valen
  en el servidor propio, que era lo que el `.env.example` del servidor daba por
  hecho.

## Inventario del patrón

Búsqueda: `git grep -nE 'process\.env\.[A-Z0-9_]+[[:space:]]*\?\?' a8d99acf -- '*.ts' '*.tsx' '*.mjs' '*.js' '*.cjs' '*.mts' ':!docs' ':!.agents'`,
sin `NEXT_PUBLIC_*` (la 0518 ya los inventarió). Resultado: **23 líneas en 16 archivos**.
Se contrastó con la auditoría del `.env` del servidor que hizo la sesión de Contabo
(recibida por el Director el 2026-10-15): coincide en todas las variables.

| Variable | Dónde | Qué hace `""` | Decisión |
|---|---|---|---|
| `EMAIL_UNSUBSCRIBE_SECRET` | `unsubscribe-token.ts:138`, `newsletter/subscribe/route.ts:158` | ver tabla de contexto | **se corrige** |
| `NEWSLETTER_IP_HASH_SECRET` | `newsletter/subscribe/route.ts:157` | sal vacía | **se corrige** |
| `MARCA_ACCESS_SECRET` | `marca/access.ts:81` | ver tabla de contexto | **se corrige** |
| `RESEND_INBOUND_WEBHOOK_SECRET` | `conversaciones/email/route.ts:45` | 503, no cae al de delivery | **se corrige**: es un secreto de verificación, aunque `""` no abra nada |
| `SUPABASE_SERVICE_ROLE_KEY` | `unsubscribe-token.ts:139`, `newsletter/subscribe/route.ts:159`, `marca/access.ts:82` | es el último eslabón de las tres cadenas de arriba | **se corrige** con ellas |
| `BITACORA_ACTA_MODEL` | `bitacora/extract.ts:263`, `escucha-extract.ts:111`, `digest-extract.ts:28` | el modelo queda en `""` y la llamada a Anthropic falla | no se corrige: no es secreto; va al handoff |
| `BITACORA_ESCUCHA_MODEL` | `escucha-extract.ts:110` | ídem | ídem |
| `CONVERSATION_DIGEST_MODEL` | `digest-extract.ts:27` | ídem | ídem |
| `IDENTITY_CNE_PROVIDER` | `identity/index.ts:51` | `"".toLowerCase()` no es `verifik`, así que cae a `cedulave`, igual que sin definir | no se corrige: sin efecto |
| `VERCEL_GIT_COMMIT_SHA` | `app/studio/(app)/layout.tsx:46` | eslabón de `NEXT_PUBLIC_BUILD_SHA`, ya inventariado en la 0518 | no se corrige |
| `VERCEL_GIT_COMMIT_REF` | `env-status.ts:122` | rama vacía en el panel de entorno | no se corrige: informativo |
| `DTD_ATTACHMENTS_AWS_AUTH_MODE` | `scripts/attachments-pilot-worker.mjs:30`, `attachments-aws-live-validation.mjs:46` | en el worker da igual (`static` por omisión); en la validación cambia de `default-chain` a credenciales estáticas | no se corrige: script de operación, no secreto |
| `DTD_ATTACHMENTS_SCAN_TIMEOUT_SECONDS`, `DTD_ATTACHMENTS_CLAMAV_ADAPTER_PORT`, `DTD_ATTACHMENTS_AWS_MONTHLY_BUDGET_USD` | `scripts/attachments-*.mjs` | `Number("")` es 0: tiempo 0, puerto 0, presupuesto 0 | no se corrige: scripts de operación |
| `D2_LOCAL_TRANSPORT` | `e2e/diagnostics/d2-webkit-auth-cors.mjs:30` | etiqueta vacía en un diagnóstico | no se corrige |
| `E2E_SUPABASE_SINTETICO_PORT` | `scripts/verify.mjs:285` | ya hace `String(…).trim()` | no aplica |

### Fuera del patrón literal

Los demás secretos de firma o verificación del servidor no usan `??` y ya tratan
`""` como ausente con `!secret` o `!token`: `CRON_SECRET` (21 lecturas, vía
`matchesBearerSecret`, `lib/http/secret-compare.ts:49-55`, o `if (!secret)`),
`RESEND_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `DEBUG_HEALTH_SECRET`,
`CBM_ESTUDIO_TOKEN`, `DTD_ATTACHMENTS_AV_TOKEN` y `DOCUMENT_IMPORT_RATE_SECRET`
(que además exige 32 caracteres). Con sólo espacios, esos sí aceptarían
`"  "` como secreto; queda anotado en el handoff y no se corrige aquí.

## Aceptación

- [x] Con `EMAIL_UNSUBSCRIBE_SECRET` vacía o con sólo espacios, el secreto de baja
  es el service role; un token sellado con el valor de la variable no da de baja,
  y uno sellado con el service role sí (formato v2 y HMAC histórico).
- [x] Sin ningún secreto válido (vacíos, espacios o sin definir), la baja responde
  error sin verificar tokens y el emisor no firma ni envía.
- [x] Con el dedicado definido, se usa ese valor sin recortar.
- [x] El log `secretSource` dice la fuente que se usó de verdad.
- [x] `/marca`: vacía o con espacios cae al service role; sin ninguno, no abre
  ninguna cookie (tampoco la interna) y no consulta la RPC.
- [x] Sal del newsletter: salta las vacías; sin ninguna, `"newsletter-local"`
  como antes.
- [x] Webhook entrante: vacío o con espacios cae al de delivery; sin ninguno, 503.
- [x] Control rojo contra `a8d99acf` y mutantes muertos.
- [x] Inventario del patrón con la razón de cada caso no corregido.

## Allowlist

- `lib/runtime/server-secret.ts` (nuevo) y `lib/runtime/__tests__/server-secret.test.ts`.
- `lib/studio/mail/unsubscribe-token.ts`, `lib/studio/mail/unsubscribe-request.ts`
  y `lib/studio/mail/__tests__/unsubscribe-secreto-vacio.test.ts`.
- `lib/studio/newsletter/__tests__/sender-secreto-vacio.test.ts`.
- `app/api/newsletter/subscribe/route.ts` y `app/api/newsletter/subscribe/__tests__/route.test.ts`.
- `lib/marca/access.ts` y `lib/marca/__tests__/access-secreto-vacio.test.ts`.
- `app/api/conversaciones/email/route.ts` y `app/api/conversaciones/email/__tests__/route.test.ts`.
- `docs/specs/0523-unsubscribe-secreto-vacio/spec.md` y `docs/specs/README.md` (índice regenerado).
- `.agents/handoffs/0523-unsubscribe-secreto-vacio.md`.

## Evidencia

- **Pruebas nuevas:** 57 casos en 6 archivos, en verde. Suites vecinas
  (`lib/studio/mail`, `lib/marca`, `app/marca`, `lib/studio/newsletter`,
  `lib/runtime`, `lib/http`, `app/api/newsletter`, `app/api/conversaciones`,
  `app/api/email`, `lib/studio/conversaciones`): 29 archivos, 401 casos, en verde.
- **Control rojo** (las pruebas nuevas contra el código de `a8d99acf`, con el
  helper presente): **32 fallan y 25 pasan**. De las 25, 6 son del helper, que no
  existe en main. Ejemplos: con la dedicada vacía, el token del service role da
  `estado=error` en vez de `estado=actualidad`; con sólo espacios y sin service
  role, el token sellado con `" "` da `estado=actualidad` (baja falsificada); la
  sal con todas vacías sale de `""`, no de `"newsletter-local"`; el webhook con el
  inbound vacío responde 503 en vez de verificar con el de delivery.
- **Mutantes** (16, todos sobre líneas del diff; control verde 57/57 antes y
  después; cada uno cuenta como muerto sólo si la salida trae la línea `Tests`):
  helper sin `trim` (19 fallan), helper que recorta el valor (2), helper con
  semántica de `??` (32), helper que toma el último (10), helper que devuelve `""`
  en vez de `null` (6), `unsubscribeSecret` con `??` (13) o sin service role (11),
  `unsubscribeSecretSource` con la verdad de antes (3), log con la expresión de
  antes (1), sal con `??` (5), sal sin el secreto de baja (2), sal con respaldo
  `""` (2), `marcaSecret` con `??` (6) o sin service role (4), webhook con `??`
  (3) o con el orden invertido (1). **Los 16 mueren.**

## Riesgos

- Si en algún entorno el dedicado está vacío y el service role **no** es el de
  Cloud (por ejemplo, un Supabase propio en el servidor después del corte), los
  enlaces de baja y las cookies de `/marca` emitidos por Vercel no valdrán allí.
  Eso ya pasaba hoy al quitar las vacías; esta spec no lo empeora. Lo que lo
  resuelve es fijar un `EMAIL_UNSUBSCRIBE_SECRET` igual en los dos lados, y eso
  lo deciden Sam y la sesión de Contabo.
- Un secreto dedicado con espacios en los bordes se sigue usando con ellos. Es
  deliberado (ver Decisión).
