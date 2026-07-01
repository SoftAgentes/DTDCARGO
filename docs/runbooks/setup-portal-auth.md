# Setup Portal Auth (magic-link de clientes) · SDD-0042

Runbook para **prender el login del Portal Cliente** (`/portal`). El código
(Fase 1+2) ya está en prod; falta solo el setup de Supabase Auth para que el
magic-link **entregue**. Mismo patrón que `setup-resend.md` /
`setup-web-push.md`: el código está, falta config del founder en el dashboard.

## Qué desbloquea

El cliente entra a `dtdcargo.com/portal`, pone su email, recibe un **enlace
mágico** y queda logueado (passwordless). Ve sus envíos, facturas, timeline y
su MARKBOX. Sin este setup el `signInWithOtp` no manda el mail → el portal no
sirve para clientes reales.

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
| Magic Link | `Tu enlace de acceso al portal · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ brandeada · pendiente de pegar |
| Confirm signup | `Confirma tu cuenta · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ brandeada · pendiente de pegar |
| Invite user | `Te damos acceso a tu portal · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ brandeada · pendiente de pegar |
| Reset Password (Recovery) | `Recupera el acceso a tu cuenta · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ brandeada · pendiente de pegar |
| Change Email Address | `Confirma tu nuevo correo · DTD Cargo` | `{{ .ConfirmationURL }}` | ✅ brandeada · pendiente de pegar |
| Reauthentication (código OTP) | `Tu código de verificación · DTD Cargo` | `{{ .Token }}` | ✅ brandeada · pendiente de pegar |

> Al pegar cada una, cambiá "pendiente de pegar" → **"pegada"** en esta tabla.

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
