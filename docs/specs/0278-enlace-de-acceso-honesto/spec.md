---
sdd: "0278"
title: "El enlace de acceso al portal deja de mentir y de romperse por el navegador"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-08-21
updated: 2026-08-21
supersedes: null
superseded_by: null
related: ["0042", "0094", "0253", "0276"]
confidencialidad: interno
---

# DTD-0278 — El enlace de acceso al portal deja de mentir y de romperse por el navegador

> Una clienta reportó que se registra, el correo tarda un poco y, al abrir el
> enlace, dice que **ya caducó**. Se midió producción: el enlace **no había
> caducado**. En 24 h de `auth_logs` hubo **cero** fallos por tiempo vencido. La
> pantalla le decía "venció" a fallas que eran otra cosa.

## 1. Contexto — qué se midió

Medido el 2026-08-21 contra producción (`xpfuzqombmjmxvprjgmi`), no recordado.

**El TTL real.** `MAILER_OTP_EXP = 3600` s (1 hora), leído del panel Email de
*Sign In / Providers* en el dashboard. Los comentarios del código decían "hoy 30
min" — estaban desactualizados y se corrigen en esta spec.

**Los fallos reales**, últimas 24 h de `auth_logs`:

| Evento | Veces |
|---|---|
| `/verify` con éxito (303) | 11 |
| `/verify` → 403, razón interna **"One-time token not found"** | 5 |
| `/token` → 400 **"code challenge does not match previously saved code verifier"** | 1 |
| `/otp` → 429 (segundo pedido antes de los 60 s del SMTP) | 1 |
| Fallos por **tiempo vencido** | **0** |

**La secuencia que lo explica todo**, a las 17:07 UTC:

- `17:07:38` — `/otp`: sale el correo.
- `17:07:48` — `/verify` **OK (303)** desde una IP residencial y, en el **mismo
  segundo**, `/token` **400 de PKCE** desde otra IP. El enlace se verificó bien;
  lo que falló fue el intercambio.
- `17:07:55` — `/verify` **403 "One-time token not found"** desde
  `173.194.92.177` (**Google**): el escáner de Gmail abriendo el enlace 7
  segundos después, cuando ya estaba consumido.

## 2. Las dos causas, y por qué ninguna es "venció"

**a) PKCE — el enlace sólo servía en el navegador que lo pidió.** El cliente de
`@supabase/ssr` corre en flujo PKCE: al pedir el enlace deja una cookie
`code_verifier` en **ese** navegador y el correo llega con `?code=`. Si el correo
se abre en el navegador interno de Gmail o de WhatsApp, o en el teléfono cuando
se pidió desde la laptop, la cookie no está y `exchangeCodeForSession` falla.

**b) Un solo uso quemado por un robot.** El token muere al primer GET. Los
escáneres de correo abren todo lo que llega — es el mismo bug que SDD-0253 ya
cerró para WhatsApp con el truco de dibujar en GET y consumir en POST.

Y sobre las dos, **el callback las tapaba a todas con `error=expired`**: un solo
mensaje, "el enlace venció o ya se usó", para cinco modos de falla distintos. Un
cliente cuyo enlace estaba vivo pedía otro y chocaba con lo mismo.

## 3. Qué cambia

1. **El enlace se acuña como `token_hash`, no como PKCE.**
   `admin.generateLink` devuelve un `hashed_token` que `verifyOtp` valida
   server-side: funciona desde cualquier navegador. Es el mismo camino que ya
   usan la invitación al portal y `/entrar/[code]`, ambos LIVE.
2. **El correo lo mandamos nosotros**, por el pipeline de siempre
   (`sendEmail` → mail_config + blacklist + mail_logs → Resend). Queda registrado:
   "¿le llegó el correo?" pasa de conjetura a consulta. Y no depende de una
   plantilla pegada a mano en el dashboard.
3. **El enlace apunta a `/abrir`, un intersticial** que dibuja en GET y consume
   en POST. El escáner ve la página y no quema el token.
4. **Un mensaje por causa.** `enlace`, `dispositivo`, `incompleto` — cada uno con
   su texto y su salida. Los códigos viejos (`expired`, `link`) siguen mapeados
   porque hay correos en bandejas que todavía apuntan al callback.
5. **Cerrojo por email** además del de IP: al no pasar por Auth, se pierde su
   límite de 60 s por usuario. 5 por hora y por dirección, con el mismo hash.
6. **Plan B intacto.** Si acuñar o enviar falla, se cae al camino viejo por Auth.
   Es exactamente lo que había hasta hoy: nadie queda peor que antes.

## 4. Efecto lateral que vale la pena nombrar

`generateLink` exige que el `auth.user` exista. Si no existe, se crea confirmado
y se reintenta — como ya hace la invitación.

Eso **cambia un invariante viejo** ("el login nunca crea `auth.users`"), y se
puede porque sólo se llega ahí con un email que **ya tiene fila** en
`client_users` (`invited` o `active`): alguien a quien el equipo ya habilitó.

A cambio, arregla un callejón sin salida que estaba vivo: los **14 clientes en
estado `invited`** —los 14 sin `auth_user_id`— no podían entrar nunca por su
cuenta, porque `signInWithOtp({shouldCreateUser:false})` no manda nada para un
usuario que no existe. Pedían el enlace, veían "te enviamos el enlace" y no
llegaba nada, para siempre.

## 5. Lo que esta spec NO cierra

**El que pide entrar sin tener cuenta sigue viendo "te enviamos el enlace".** Hoy
`/entrar` responde igual exista o no la cuenta, a propósito, para no confirmarle
a un enumerador qué correos son clientes (SDD-0094). El costo es que quien nunca
se registró espera un correo que no va a llegar — y de los **477 clientes vivos,
359 no tienen ninguna fila de acceso**.

La salida recomendada, pendiente de decisión del founder: **mandarle un correo
al que no tiene cuenta** ("alguien pidió entrar con esta dirección y no hay
cuenta — regístrate acá"). La pantalla sigue siendo indistinguible, así que no se
abre el oráculo, y el dueño real de la casilla sí se entera. Queda fuera de esta
spec.

## 6. Evidencia

- Gate: `node scripts/verify.mjs`.
- Tests: `app/entrar/__tests__/actions.test.ts` — 11 casos. Validados por
  mutación: al quitar el chequeo de `queued` y al apuntar el enlace al callback,
  el test correspondiente cae.
- Medición de producción: `auth_logs` vía MCP, y el dashboard de Auth para el TTL.
