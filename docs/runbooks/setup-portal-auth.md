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
| Sender email | `no-reply@dtdcargo.com` (dominio verificado en Resend) |
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
