# Setup Portal Auth (magic-link de clientes) · SDD-0042

Runbook para **prender el login del Portal Cliente** (`/portal`). El código
(Fase 1+2) ya está en prod; falta solo el setup de Supabase Auth para que el
magic-link **entregue**. Mismo patrón que `setup-resend.md` /
`setup-web-push.md`: el código está, falta config del founder en el dashboard.

> ⚠️ **Nota del 2026-10-19 · producción ya no es Supabase Cloud.** Desde el corte
> del 2026-10-14 (02:00Z), Auth de producción es el GoTrue del servidor propio
> (VPS de Contabo, `https://supabase.dtdcargo.com`), y desde el 2026-10-16 la
> web también corre ahí; Vercel está en pausa. El proyecto de Cloud
> `xpfuzqombmjmxvprjgmi` y sus enlaces al dashboard (sección «Proyecto
> Supabase») son la copia del corte, que se pausa el 2026-10-28: no los uses
> para configurar. Lo vigente es la sección [Self-hosted](#self-hosted-sdd-0505):
> variables del `.env` del servidor (`/srv/dtd-cargo/.env`), plantillas servidas
> por `auth-templates`. Lo opera la sesión de Contabo con el OK de Sam:
> [`servidor-contabo.md`](servidor-contabo.md).

## Qué desbloquea

El cliente entra a `dtdcargo.com/portal`, pone su email, recibe un **enlace
mágico** y queda logueado (passwordless). Ve sus envíos, facturas, timeline y
su MARKBOX. Sin este setup el `signInWithOtp` no manda el mail → el portal no
sirve para clientes reales.

## 🔴 Desactualizado desde SDD-0278 (2026-08-21) — leer esto antes que lo de abajo

Lo que sigue describe el camino por **Supabase Auth con PKCE**, que hoy es el
**plan B**. El camino normal cambió:

- El enlace se acuña con `admin.generateLink` como **`token_hash`**, y lo manda
  **nuestro** pipeline (`sendEmail` → Resend), no la plantilla del dashboard.
- Apunta a **`/abrir`**, un intersticial que dibuja en GET y consume en POST,
  para que un escáner de correo no queme el token.
- La puerta vive en **`app/entrar/actions.ts`**, no en `app/portal/(auth)/login/`
  (eso se movió con SDD-0276).
- El TTL medido en el dashboard es **`MAILER_OTP_EXP = 3600 s`** (1 hora). El
  SMTP tiene además **"Minimum interval per user" = 60 s**: dos pedidos seguidos
  al mismo correo dan 429 y el segundo NO sale. **Acuñar cuenta como pedido:**
  `generateLink` escribe `recovery_sent_at`, así que el `/otp` de los 60 s
  siguientes también da 429 (SDD-0597).

**La plantilla Magic Link del dashboard sigue haciendo falta**: es la que se usa
cuando se va por el camino viejo. No la borres.

## Cómo funciona (para entender qué tocar)

- `app/portal/(auth)/login/actions.ts` → `signInWithOtp({ email, options: {
  emailRedirectTo: "${SITE_URL}/portal/callback", shouldCreateUser: true } })`.
- `SITE_URL = NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com"`.
- El mail trae un link a `/portal/callback?code=...` → la route
  `app/portal/(auth)/callback/route.ts` hace `exchangeCodeForSession(code)`
  (flujo PKCE) → setea cookies SSR → `portal_bind_session` valida el vínculo.
- **Pre-check:** el login solo manda el enlace a emails que existen en
  `client_users` con status `invited` o `active`. A un email no habilitado le
  responde "pedile a tu asesor que te invite". Los habilita el admin desde
  Studio → cliente → "Acceso al portal".

## Proyecto Supabase

- **ref:** `xpfuzqombmjmxvprjgmi` (name: DoorTuDoor)
- Auth URL config: https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/auth/url-configuration
- Auth providers: https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/auth/providers
- SMTP settings: https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/settings/auth

## Self-hosted (SDD-0505)

En el servidor propio ([servidor-contabo.md](servidor-contabo.md)) no hay
dashboard: todo lo que abajo se configura «a mano en Supabase» es una variable
de GoTrue en el `.env` de `infra/dtd-cargo/` (`compose.supabase.yml`). Hay dos
columnas de nombres porque el compose oficial de Supabase expone unas variables
cortas y las traduce a las `GOTRUE_*` que lee el contenedor `auth`; el
`.env.example` de infra usa las cortas. Los valores son los mismos que se
midieron en el dashboard de Cloud.

| Paso de este runbook (dashboard) | Variable del `.env` (compose) | Variable que lee GoTrue | Valor |
|---|---|---|---|
| Paso 1 · Site URL | `SITE_URL` | `GOTRUE_SITE_URL` | `https://dtdcargo.com` |
| Paso 2 · Redirect URLs | `ADDITIONAL_REDIRECT_URLS` | `GOTRUE_URI_ALLOW_LIST` | `https://dtdcargo.com/portal/callback` (staging: su host; separadas por coma) |
| Paso 3 · Email provider ON | `ENABLE_EMAIL_SIGNUP` | `GOTRUE_EXTERNAL_EMAIL_ENABLED` | `true` |
| Paso 3 · Confirm email | `ENABLE_EMAIL_AUTOCONFIRM` | `GOTRUE_MAILER_AUTOCONFIRM` | `false` (igual que en Cloud: el magic-link confirma) |
| TTL del enlace (`MAILER_OTP_EXP = 3600 s`) | `MAILER_OTP_EXP` | `GOTRUE_MAILER_OTP_EXP` | `3600` |
| «Minimum interval per user» = 60 s | — | `GOTRUE_SMTP_MAX_FREQUENCY` | `60s` |
| Paso 4 · SMTP custom (Resend) | `SMTP_HOST` · `SMTP_PORT` · `SMTP_USER` · `SMTP_PASS` · `SMTP_ADMIN_EMAIL` · `SMTP_SENDER_NAME` | `GOTRUE_SMTP_HOST` · `GOTRUE_SMTP_PORT` · `GOTRUE_SMTP_USER` · `GOTRUE_SMTP_PASS` · `GOTRUE_SMTP_ADMIN_EMAIL` · `GOTRUE_SMTP_SENDER_NAME` | `smtp.resend.com` · `465` · `resend` · la API key de Resend · `no-responder@dtdcargo.com` · `DTD Cargo` |
| Paso 4b · Rate limit de emails | — | `GOTRUE_RATE_LIMIT_EMAIL_SENT` | `50` (por hora) |
| Plantilla Magic Link (y las otras cinco) | `MAILER_TEMPLATES_MAGIC_LINK` (`_INVITE`, `_CONFIRMATION`, `_RECOVERY`, `_EMAIL_CHANGE`, `_REAUTHENTICATION`) | `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK` (…) | `http://auth-templates/magic-link.html` (…): el servicio `auth-templates` del compose sirve `infra/dtd-cargo/supabase/templates/`, que son los mismos HTML de la sección «Plantillas de email branded» de abajo |
| Subject de cada plantilla | `MAILER_SUBJECTS_MAGIC_LINK` (…) | `GOTRUE_MAILER_SUBJECTS_MAGIC_LINK` (…) | los subjects de la tabla «Checklist de plantillas» |

Qué necesita cada camino de entrada:

- **Camino normal (SDD-0278, `token_hash`)**: `app/entrar/actions.ts` acuña el
  enlace con `admin.generateLink` (`lib/studio/portal/magic-link.ts`), lo manda
  **nuestro** pipeline por Resend y apunta a `/abrir`, donde
  `app/abrir/actions.ts:43` lo consume con `verifyOtp`. No necesita SMTP de
  GoTrue, ni la whitelist de redirect, ni la plantilla Magic Link: necesita
  `SUPABASE_SERVICE_ROLE_KEY` en el `.env` de la app (la `SERVICE_ROLE_KEY`
  firmada con el `JWT_SECRET` del stack) y la `NEXT_PUBLIC_SUPABASE_URL` del
  host propio. Deja igual el proveedor Email encendido: es un toggle, no
  infraestructura, y el plan B lo exige.
- **Plan B (`signInWithOtp` PKCE, `sendMagicLinkLegacy` en
  `app/entrar/actions.ts`)**: sirve sólo donde todavía no se acuñó nada, es decir
  cuando Resend no puede enviar (sin `RESEND_API_KEY`, o con `APP_ENV=staging`),
  cuando acuñar falla y cuando falta el cliente admin. Necesita **todo** lo de la
  tabla: SMTP, `GOTRUE_URI_ALLOW_LIST` con `/portal/callback` y la plantilla
  Magic Link servida por `auth-templates`. Si falta cualquiera, el plan B no
  entrega.
- **Si Resend falla después de acuñar no hay plan B.** El `/otp` daría 429 por el
  intervalo mínimo. Además, en producción el SMTP de Auth es Resend con la misma
  clave (medido el 2026-11-02 por sha256, sin registrarlo), así que una caída de
  Resend o de esa clave se llevaría también el plan B (inferido, sin provocar
  ninguna falla). La persona ve lo mismo que si hubiera salido: la pantalla no
  afirma el envío y le ofrece pedir otro o escribir por WhatsApp. El fallo queda
  en `mail_logs` con `status=failed`, y `/api/cron/mail-health` avisa al equipo
  cada 30 min.

Prueba de humo, al levantar el stack y después de cada cambio del `.env` de
Auth: en el Studio, invita un cliente de prueba (fila en `client_users` con
status `invited`), pide el enlace desde `/entrar` con ese correo y abre el
correo en **otro** navegador (o en el teléfono). Debe caer en `/abrir`, apretar
el botón y entrar al portal: eso prueba el camino `token_hash` y que `verifyOtp`
llega al GoTrue propio. El plan B se prueba en staging, donde `/entrar` va siempre
por ahí porque Resend está simulado: pide el enlace con el cliente de la semilla y
espera 60 s entre pedidos. El correo tiene que salir por el SMTP de GoTrue con la
plantilla branded y el enlace a `/portal/callback`.

Lo que no cambia: `MAILER_OTP_EXP` sigue en 3600 s y el intervalo mínimo en
60 s porque son los valores medidos en producción, no porque GoTrue los traiga
por defecto.

## Paso 1 · Site URL

Auth → URL Configuration → **Site URL**:

```
https://dtdcargo.com
```

## Paso 2 · Redirect URLs (whitelist)

Auth → URL Configuration → **Redirect URLs** → agregar:

```
https://dtdcargo.com/portal/callback
http://localhost:3000/portal/callback   # solo si vas a probar en dev local
```

> Sin esto, Supabase rechaza el `emailRedirectTo` y el link no loguea.

## Paso 3 · Email provider ON

Auth → Providers → **Email** → Enable. Con magic-link alcanza el toggle de
Email habilitado (no hace falta password). Dejá "Confirm email" como venga;
el magic-link ya confirma por sí mismo.

## Paso 4 · Custom SMTP vía Resend (OBLIGATORIO desde SDD-0094)

> ⚠️ **Desde SDD-0094 (acceso-email) el portal es SOLO-EMAIL** — se quitó el
> login por markbox+contraseña. El magic-link es la **única** puerta, y el email
> built-in de Supabase la tapa al 3er-4to envío/hora → **los clientes quedan
> bloqueados.** Pasó de "recomendado" a **obligatorio**. (2026-06-18: confirmado
> en vivo — un test pegó el rate-limit "No pudimos enviar el enlace ahora".)

El email **built-in** de Supabase tiene rate-limit duro (~2-4 mails/hora) y no
es para producción. Como ya tenemos **Resend** configurado y el dominio
`dtdcargo.com` verificado, conectá Resend como SMTP custom:

Auth → settings → **SMTP Settings** → Enable Custom SMTP:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) ó `587` (STARTTLS) |
| Username | `resend` |
| Password | la **Resend API key** (la misma `RESEND_API_KEY` de Vercel) |
| Sender email | `no-responder@dtdcargo.com` (cualquier `@dtdcargo.com`; dominio verificado en Resend) |
| Sender name | `DTD Cargo` |

> Sin SMTP custom el portal "anda" pero se queda sin mails apenas 2-3 clientes
> piden enlace en la misma hora.

## Paso 4b · Subir el rate-limit de emails de Auth

Con SMTP custom puesto, el cap built-in deja de aplicar — **pero hay que subir el
límite a mano**, si no Supabase sigue capando:

Auth → **Rate Limits** → **"Rate limit for sending emails"** → subir de ~4/hora a
un número razonable (ej. **30-50/hora**). Resend aguanta de sobra; el límite es
solo anti-abuso.

## Paso 5 · Verificar E2E

1. En Studio, asegurate de que un cliente de prueba tenga el **portal
   habilitado** (cliente → "Acceso al portal" → invitar). Eso crea la row en
   `client_users` (status `invited`).
2. Andá a `https://dtdcargo.com/portal`, poné ese email, "Enviar enlace".
3. Llega el mail (revisá spam la 1ª vez) → tap → debería loguear y caer en
   "Mis envíos".
4. Si dice "todavía no tiene el portal habilitado" → el email no está en
   `client_users` invited/active (paso 1).
5. Si el link da error de redirect → revisá paso 2 (URL exacta, sin slash de
   más).

## Troubleshooting

- **No llega el mail** → paso 4 (SMTP) o rate-limit del built-in. Revisá logs
  de Resend (dashboard) o Auth → Logs en Supabase.
- **"Email logins are disabled"** → paso 3.
- **`redirect_to is not allowed`** → paso 2, la URL no está whitelisteada.
- **Loguea pero lo saca enseguida** → el vínculo `portal_bind_session` no
  encontró `client_users` para ese auth user; el email del magic-link debe
  coincidir (case-insensitive) con el de `client_users`.

## Plantillas de email branded (Auth · referencia versionada)

Las plantillas de **Supabase Auth** se editan a mano en el dashboard
(**Auth → Email Templates**) — **no** viven en `mail_templates` (esas son las del
Studio, vía Resend API). Acá quedan versionadas para no depender solo del
dashboard. Mismo molde que `welcome_markbox` (`0120`): **Archivo · navy `#0F1E3D` ·
papel `#FBFAF7` · acento wine `#7F0F1A` · cierre "Con Confianza"**.

> **Regla:** conservar **`{{ .ConfirmationURL }}`** tal cual (sintaxis Go de Auth,
> distinta del `{{var}}` del Studio). Auth no conoce el nombre del cliente en estos
> correos → saludo genérico (sin `client_name`). La plantilla de código de
> verificación usa **`{{ .Token }}`** (no `ConfirmationURL`) — respetá esa variable.

> **Nota (SDD-0094):** el portal es **solo magic-link** (passwordless), así que el
> **Reset Password** casi no le aplica a clientes de portal. Igual queda brandeado
> por si hay cuentas con contraseña (ej. registro público / cuentas legacy). No lo
> borres del dashboard: si algún día una cuenta con clave pide reset, este es el
> correo que sale.

### Checklist de plantillas (pegar en el dashboard)

Pegá cada bloque en **[Auth → Email Templates](https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/auth/templates)** (una plantilla por pestaña), copiá el subject sugerido y marcá acá cuando quede pegada.

| Plantilla (Supabase) | Subject sugerido | Variable | Estado |
|---|---|---|---|
| Magic Link | `Tu enlace de acceso al portal · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ pegada en dashboard |
| Confirm signup | `Confirma tu cuenta · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ pegada en dashboard |
| Invite user | `Te damos acceso a tu portal · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ pegada en dashboard |
| Reset Password (Recovery) | `Recupera el acceso a tu cuenta · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ pegada en dashboard |
| Change Email Address | `Confirma tu nuevo correo · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ pegada en dashboard |
| Reauthentication (código OTP) | `Tu código de verificación · DTD Cargo` | `{{ .Token }}` | ✅ pegada en dashboard |

> ✅ **Las 6 quedaron pegadas en el dashboard (2026-07-01).** Si en el futuro se
> re-brandean, actualizá el HTML acá primero y volvé a pegarlas.

### Magic Link · subject `Tu enlace de acceso al portal · DTD Cargo`

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Tu enlace de acceso</b></p>
<p style="margin:0 0 16px">Haz clic en el botón para entrar a tu portal de DTD Cargo. El enlace caduca pronto y se usa una sola vez.</p>
<p style="margin:0 0 20px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Acceder a mi portal</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="{{ .ConfirmationURL }}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No pediste esto? Ignora este correo, tu cuenta sigue segura.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```

### Confirm signup · subject `Confirma tu cuenta · DTD Cargo`

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Confirma tu cuenta</b></p>
<p style="margin:0 0 16px">Gracias por registrarte en DTD Cargo. Confirma tu correo para activar tu acceso al portal de clientes.</p>
<p style="margin:0 0 20px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Confirmar mi cuenta</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="{{ .ConfirmationURL }}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No fuiste tú? Ignora este correo.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```

### Invite user · subject `Te damos acceso a tu portal · DTD Cargo`

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Te damos acceso a tu portal</b></p>
<p style="margin:0 0 16px">Tu asesor de DTD Cargo te habilitó el portal de clientes. Entra para ver tus envíos, facturas y tu Shipping Mark.</p>
<p style="margin:0 0 20px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Entrar a mi portal</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="{{ .ConfirmationURL }}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No esperabas esto? Escríbenos antes de entrar.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```

### Reset Password (Recovery) · subject `Recupera el acceso a tu cuenta · DTD Cargo`

> Casi no aplica a clientes de portal (magic-link, sin contraseña). Queda por si
> hay cuentas con clave (registro público / legacy). Ver la **Nota (SDD-0094)** arriba.

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Recupera el acceso a tu cuenta</b></p>
<p style="margin:0 0 16px">Pediste restablecer el acceso a tu cuenta de DTD Cargo. Haz clic en el botón para elegir una nueva contraseña. El enlace caduca pronto y se usa una sola vez.</p>
<p style="margin:0 0 20px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Restablecer mi acceso</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="{{ .ConfirmationURL }}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No fuiste tú? Ignora este correo, tu cuenta sigue segura.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```

### Change Email Address · subject `Confirma tu nuevo correo · DTD Cargo`

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Confirma tu nuevo correo</b></p>
<p style="margin:0 0 16px">Pediste cambiar el correo de tu cuenta de DTD Cargo. Haz clic en el botón para confirmar esta dirección como tu nuevo correo de acceso.</p>
<p style="margin:0 0 20px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7F0F1A;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:7px;font-weight:700;font-size:15px">Confirmar mi nuevo correo</a>
</p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">¿El botón no funciona? <a href="{{ .ConfirmationURL }}" style="color:#7F0F1A;text-decoration:underline">Ábrelo aquí</a>.</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No fuiste tú? Ignora este correo, tu cuenta sigue segura.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```

### Reauthentication (código OTP) · subject `Tu código de verificación · DTD Cargo`

> Esta plantilla usa **`{{ .Token }}`** (el código de 6 dígitos), **no**
> `{{ .ConfirmationURL }}`. No hay botón ni enlace: se muestra el código para copiar.

```html
<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 12px"><b>Tu código de verificación</b></p>
<p style="margin:0 0 16px">Usa este código para confirmar tu identidad en DTD Cargo. Caduca pronto y se usa una sola vez.</p>
<p style="margin:0 0 20px;text-align:center">
  <span style="display:inline-block;background:#FFFFFF;border:1px solid #E8E6E2;color:#0F1E3D;padding:16px 28px;border-radius:7px;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;font-size:28px;letter-spacing:6px">{{ .Token }}</span>
</p>
<p style="margin:0 0 12px;color:#6B6B6B;font-size:13px">¿No fuiste tú? Ignora este correo, tu cuenta sigue segura.</p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Con Confianza, de China a tu puerta.</p>
</div>
```
