---
sdd: "0059"
title: "Registro self-service — entrega real del correo de bienvenida + aviso interno de cliente nuevo"
status: done
author: "Claude Code (carril registro · feat/registro-correos)"
created: 2026-06-07
updated: 2026-06-07
supersedes: null
superseded_by: null
related: ["0042", "0032", "0026", "0010", "0036", "0046"]
confidencialidad: interno
---

# DTD-0059 — Registro self-service: entrega real del correo + aviso interno

> Con el SEO/Ads empezaron a llegar clientes nuevos. El registro self-service de `/portal/registro` ya
> les emite el MARKBOX, **pero el correo de bienvenida nunca se entrega** (queda `queued`, no pasa por
> Resend) y su link al portal está roto. Además el equipo no se entera cuando entra un cliente nuevo.
> Esta spec arregla la entrega del correo, el link, y agrega un aviso interno con los datos del cliente.

## 1. Resumen en una línea

`sendWelcomeEmail` deja de solo encolar y delega al `sendEmail` real (Resend, template `welcome_markbox`);
el `portal_link` del correo apunta a `{SITE_URL}/portal/login` (no al subdominio inexistente); y un nuevo
`notifyNewClientToAdmin` avisa a los admins del tenant (email + Telegram, best-effort) cuando alguien se
registra solo. **Sin migración** (reusa template, `mail_config`, `user_tenants`, `user_profiles`).

## 2. Por qué (grounding)

Tres gaps confirmados leyendo el código a 2026-06-07:

1. **El correo de bienvenida no se entrega.** `lib/studio/welcome-email.ts` (`sendWelcomeEmail`) solo
   inserta un `mail_logs` con `status='queued'` y **nunca llama a Resend** (su docstring lo declara
   "V1 NO envía email real"). En cambio `lib/studio/mail/send-email.ts` (`sendEmail`, SDD-0026 Fase 2)
   **sí** llama a Resend y marca `sent` + `resend_message_id`. Resend está vivo en prod
   (`test_mode=false` desde 2026-05-27). → El cliente que se registra en `/portal/registro` ve su
   MARKBOX en pantalla pero **nunca lo recibe por correo**. Mismo gap en el alta admin
   (`createClientAction`), que también usa `sendWelcomeEmail`.
2. **El link del portal en el correo está roto.** `portalLinkFromMarkbox` arma
   `https://portal.dtdcargo.com/{markbox}`. No existe ese rewrite/redirect (`next.config.ts` no lo tiene;
   todo el código referencia `/portal/login` en el dominio principal) y, aun resolviéndolo, no hay ruta
   `/[markbox]`. → enlace muerto.
3. **No hay aviso interno.** Cuando un cliente se registra solo no se notifica a nadie; el founder pidió
   "disponer de los datos de esos clientes junto con su código" → un aviso al equipo evita perderlos de
   vista (la lista `/studio/clientes` existe, pero es pull, no push).

## 3. Alcance

### Incluye

1. **Entrega real del correo de bienvenida.** Reescribir `sendWelcomeEmail` para que **delegue en
   `sendEmail`** (templateSlug `welcome_markbox`, `to`=email, `vars`={client_name, markbox, portal_link}).
   - Mantiene la **firma pública** `sendWelcomeEmail(supabase, tenantId, {markbox, name, email})` y el
     contrato de retorno (`{ ok: true, log_id } | { ok: false, error }`) → los dos call sites
     (`registerClientAction`, `createClientAction`) no cambian. Ambos ya pasan un client service_role
     (`createAdminClient`), que es lo que `sendEmail` requiere.
   - Best-effort se mantiene: nunca tira excepción; un fallo de envío no rompe el alta.
   - Beneficia ambos canales: self-service **y** alta admin pasan a enviar de verdad.
2. **Link correcto.** `portalLinkFromMarkbox` → `${NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com"}/portal/login`.
3. **Aviso interno de cliente nuevo.** Nuevo `notifyNewClientToAdmin(supabaseAdmin, tenantId, payload)`
   en `lib/studio/` modelado sobre `lib/studio/bug-email-notify.ts`:
   - Resuelve los admins del tenant (`user_tenants.role='admin'`, no `disabled_at`).
   - Por cada admin: **email** vía `sendEmail` (subject+html crudos, sin template → sin migración) +
     **Telegram** vía `sendTelegramMessage` si el admin linkeó `user_profiles.telegram_chat_id`.
   - Payload: MARKBOX, nombre, documento (RIF/cédula), email, WhatsApp, ciudad/estado, canal (`portal`).
   - Best-effort por canal (cada fallo se loguea, no rompe el alta ni los otros canales).
   - Se **wirea solo en `registerClientAction`** (self-service): el alta admin la inicia un humano que ya
     sabe del cliente → notificarlo sería ruido.
4. **Tests (Vitest)** que cubren el acceptance (sección 6).

### No incluye (fuera de alcance)

- El **gate de activación** (cuenta pending vs active) y el wording "tu cuenta está activa" del template
  `welcome_markbox` (vive en DB; el founder lo edita por la UI de Mailing o una futura migración). Es la
  inconsistencia conocida de SDD-0042 Fase 5 (gate en stand-by), separada de esta spec.
- Cualquier **migración** SQL (no hace falta).
- Cambios a la **UI** del form de registro o del login.
- **Push browser** del aviso interno (el bug-notify lo tiene; acá se difiere — email + Telegram alcanzan).
- `git push` / deploy / aplicar nada a prod (lo hace el founder).

## 4. Diseño

- **No toca el Norte visual** (es backend de entrega de correo + notificación; sin pantallas nuevas).
- Reusa el patrón de notificación multi-canal de **SDD-0036 Fase 5** (`bug-email-notify.ts`) y el helper
  de correo de **SDD-0026 Fase 2** (`send-email.ts` → Resend).

## 5. Archivos afectados (estimado)

- `lib/studio/welcome-email.ts` — `sendWelcomeEmail` delega en `sendEmail`; `portalLinkFromMarkbox` fix.
- `lib/studio/new-client-notify.ts` *(nuevo)* — `notifyNewClientToAdmin` + helpers (resolver admins,
  Telegram opt-in), espejando `bug-email-notify.ts`.
- `app/portal/(auth)/registro/actions.ts` — wire de `notifyNewClientToAdmin` tras crear el cliente;
  ajustar el wording del warning (de "encolar" a "enviar").
- Tests: `lib/studio/__tests__/welcome-email.test.ts` (o ampliar) + `lib/studio/__tests__/new-client-notify.test.ts`.

## 6. Acceptance

1. Un registro self-service exitoso produce un `mail_logs` con `status='sent'` y `resend_message_id` no
   nulo cuando Resend responde OK (en test: `resendSend` mockeado a `{ ok, id }`; se verifica que
   `sendEmail`/Resend fue invocado con template `welcome_markbox` + las vars correctas — **no** queda en
   `queued`).
2. El `portal_link` renderizado en el correo es `https://dtdcargo.com/portal/login` (o el `SITE_URL`
   configurado), nunca `portal.dtdcargo.com/...`.
3. Tras el alta, **cada admin** del tenant recibe el aviso: email siempre; Telegram solo si tiene
   `telegram_chat_id`. El cuerpo incluye MARKBOX + nombre + documento + email + WhatsApp + ciudad.
4. **Robustez best-effort:** si el envío del correo o el aviso fallan, `registerClientAction` devuelve
   igual `{ ok: true, markbox, warning? }` (el cliente queda creado con su MARKBOX).
5. `node scripts/verify.mjs` termina **verde** (lint + typecheck + test + docs:check).

## 7. Notas de implementación / gotchas

- `sendEmail` necesita **service_role** (el INSERT en `mail_logs` está bloqueado para `authenticated`).
  Ambos callers ya pasan `createAdminClient()`. No cambiar eso.
- `sendEmail` respeta `mail_config.test_mode`: en dev/test redirige a `internal_test_email`. Los tests
  deben **mockear** `resend-api`/`mail_config`, no pegarle a Resend real.
- Telegram es **opt-in por usuario** (`user_profiles.telegram_chat_id`). Sin token (`TELEGRAM_BOT_TOKEN`)
  o sin chat linkeado → skip silencioso (igual que bug-notify). No es un error.
- El aviso interno **no** crea outbox/idempotencia (igual que bug-notify V1) — es best-effort de un solo
  disparo. Si en volumen genera ruido, se evalúa un digest (futuro).

## 8. Adjuntos

Ninguno.

## 9. Estado de implementación (2026-06-07)

**Shipped vía harness** (implement → gate verde → reviewer independiente APPROVED en 1 ronda) en la
rama/worktree `feat/registro-correos`. **LOCAL — sin push/deploy** (lo hace el founder).

- **Gate** `node scripts/verify.mjs` VERDE: lint 0 errores · rsc-boundary OK · typecheck OK ·
  **1261 tests passed (80 files)** · docs:check OK.
- **Reviewer** validó: frontera público↔ERP limpia (el portal es 5ª superficie, no marketing) · ciclo de
  imports roto (`renderTemplate` solo lo importa `send-email` desde `render-template`) · best-effort real
  (`registerClientAction` siempre devuelve `{ ok: true, markbox }`; el aviso es `Promise<void>` con
  try/catch global, independiente del welcome) · ambos callers pasan `createAdminClient()` (service_role) ·
  XSS escapado en el correo interno (`escapeHtml`) sin filtrar clave/secretos.
- **Sin migración.** Reusa template `welcome_markbox`, `mail_config`, `user_tenants`, `user_profiles`.
- **Beneficio colateral:** el alta admin (`createClientAction`) también pasa a enviar el correo de verdad
  (comparte `sendWelcomeEmail`).
- **Deep-link del aviso** `/studio/clientes/<markbox>` → ruta `[markbox]/page.tsx` (existe, resuelve).
- **Notas menores no bloqueantes** (heredadas de SDD-0032, fuera de alcance): el welcome saluda con
  `input.name` (nombre de contacto) aun cuando es empresa.

**Gates externos para que rinda en prod** (ya satisfechos según estado conocido): Resend vivo con
`test_mode=false` (envío real activo desde 2026-05-27); admins con `telegram_chat_id` linkeado reciben
también el aviso por Telegram (los que no, solo email).
