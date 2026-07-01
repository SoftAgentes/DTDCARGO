# RESUMEN · feat/portal-invite-directo

Ventana secundaria (Modo Forja). Rama `feat/portal-invite-directo`. **NO push.**

## Objetivo (founder 2026-07-01)

Cambio de decisión sobre los "clientes viejos": la invitación al portal ya NO tiene
paso extra. Dos vías:
1. **Correo de invitación DIRECTO** (un clic → adentro).
2. **Compartir acceso por WhatsApp** desde la tarjeta del cliente (coordinación en
   vivo, porque el enlace vence en 30 min).

## Qué se hizo

### 1. Correo de invitación directo — `lib/studio/portal-invite-email.ts`
- Nuevo `generatePortalAccessLink(admin, email)`: genera un enlace mágico real con
  `admin.auth.admin.generateLink({ type: 'magiclink' })` → `action_link`. Cae en
  `/portal/callback?token_hash=…&type=magiclink` (el callback ya lo soporta, SDD-0042).
- Si el cliente aún no tiene `auth.user` (invitado sin 1er ingreso), lo crea
  confirmado (`createUser email_confirm`) y reintenta — como el login
  (`signInWithOtp shouldCreateUser:true`).
- Best-effort: cualquier fallo → `null` → **fallback** al viejo `/portal/login` con
  email precargado (la invitación nunca se rompe).
- `inviteHtml(url, name, direct)`: copy de un clic + "un solo uso, vence pronto"
  cuando es directo; fallback al copy viejo si no.

### 2. Compartir por WhatsApp — Studio
- `app/studio/(app)/clientes/actions.ts` → nueva acción `portalAccessLinkAction(clientId)`:
  genera un enlace fresco + devuelve el `wa.me` raw del cliente (`toWhatsAppRaw`).
- `PortalAccessCard.tsx`: botón **"Compartir por WhatsApp"** (variante dark) cuando el
  cliente está invited/active; al generar, revela un link **"Abrir WhatsApp con el
  acceso →"** (wa.me con el enlace + mensaje precargado). No usa `window.open` (evita
  el bloqueo de popups tras el await). Si el cliente no tiene teléfono → wa.me sin
  destinatario (el asesor elige el chat).

### ⚠️ Seguridad (dejada en comentarios + copy)
El enlace **loguea a quien lo abra COMO el cliente**. Reglas: mandarlo SOLO a su
canal (su correo/su WhatsApp); es de **un solo uso** y **caduca**. La tarjeta lo
dice explícito ("envíaselo solo al cliente").

## Verificación
- `node scripts/verify.mjs` → **TODO VERDE**: lint, rsc-boundary, typecheck,
  **2970 tests** (205 archivos), docs. +6 tests nuevos en
  `lib/studio/__tests__/portal-invite-email.test.ts` (generación directa, reintento
  con createUser, fallback a null, correo directo vs. fallback).
- Revisión `ui-ux-designer` (regla del founder) sobre PortalAccessCard: **aplicados**
  el hallazgo ALTA (contraste del link "Abrir WhatsApp" roto en dark mode → ahora usa
  `studio-btn-primary`, texto claro sobre wine + focus en ambos temas) + 2 BAJA
  (successLabel a participio "Acceso generado"; nota de seguridad a `--ink-soft`).
  Se dejó como criterio el trigger en `dark` (CTA revelado en wine = jerarquía clara).
- node_modules del worktree = junction al repo principal; se remueve al cerrar.

## ⚠️ Colisión de ramas (para el Director)
`lib/studio/portal-invite-email.ts` **también fue modificado en `feat/correos-auth`**
(fix del fallback "Ábrelo aquí"). Esta rama reescribe más de ese archivo. **Secuencia
sugerida: mergear `feat/correos-auth` primero, luego esta.** El conflicto es en el
`inviteHtml`/fallback; ambas versiones usan "Ábrelo aquí", así que resolver es fácil
(gana esta, que además tiene el enlace directo).

## Follow-ups
- Verificar en vivo con Supabase real que `generateLink('magiclink')` + `createUser`
  cubre el caso cliente-nuevo-sin-auth.user (los tests mockean el admin).
- El TTL del enlace (30 min) vive en Supabase Auth (dashboard), no en código
  ([[project_portal_magic_link_ttl]]). Si se quiere más margen para el correo, subirlo.
