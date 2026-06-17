---
sdd: "0094"
title: "Acceso al portal solo por email (magic-link) — retira el login por Shipping Mark"
status: in-progress
author: "founder"
created: 2026-06-17
updated: 2026-06-17
supersedes: null
superseded_by: null
related: ["0042", "0065"]
confidencialidad: interno
---

# DTD-0094 — Acceso al portal solo por email

> **El cliente entra al portal con su email + un enlace de acceso (magic-link). Se retira el login por Shipping Mark (MARKBOX) + contraseña.** Regla del founder (2026-06-17): *"el cliente no se va a acordar de su código markbox, pero de su email siempre se va a acordar"*. El Shipping Mark sigue siendo el identificador interno de las cajas — deja de ser credencial de acceso.

---

## 1. Resumen en una línea

El login del portal (`/portal/login`) pasa a tener **un solo método**: email → magic-link de Supabase Auth (ya existente, `requestMagicLink` + callback `portal_bind_session`). Se elimina el formulario y la lógica de **MARKBOX + contraseña** y el "¿olvidaste tu contraseña?". **Sin cambios de DB** (RLS, RPCs y el identificador `markbox` quedan intactos).

## 2. Motivación

- El acceso por código es un punto de fricción y de olvido: el cliente no recuerda `DTD-XXXX`.
- El login por contraseña ya estaba **roto/inconsistente**: el registro genera una contraseña **aleatoria** (no la cédula), pero el copy del login decía *"la contraseña inicial es tu cédula"* → el cliente nunca podía entrar por esa vía. (El "password = cédula" fue una **vulnerabilidad parchada**; este cambio retira el residuo.)
- El portal se **diseñó originalmente** para entrar por email/magic-link (SDD-0042 §1); el login por MARKBOX fue un añadido posterior (Fase 6). Esto vuelve al diseño original.

## 3. Alcance

### 3.1 Se ELIMINA
- **UI** (`app/portal/(auth)/login/LoginForm.tsx`): formulario MARKBOX+contraseña, el texto "tu usuario es tu Shipping Mark / la contraseña inicial es tu cédula", el bloque "¿Olvidaste tu contraseña?" (`ForgotPassword`) y `ResetSent`, el estado `showMagic`.
- **Server actions** (`app/portal/(auth)/login/actions.ts`): `loginWithMarkbox()`, `emailForMarkbox()`, `resetPasswordByMarkbox()`, el tipo `PortalPasswordLoginState`, el import de `lookupEmailByMarkbox`.
- **Query** (`lib/portal/portal-queries.ts`): `lookupEmailByMarkbox()` (queda huérfana).
- **Param** (`app/portal/(auth)/login/page.tsx`): `prefillMarkbox` / `?markbox=`.
- **Test** (`lib/portal/__tests__/login-markbox.test.ts`): se retira (cubría el lookup por MARKBOX).

### 3.2 Se MANTIENE (pasa a método único)
- `requestMagicLink()` íntegra (incluye el pre-check best-effort contra `client_users` invited/active).
- El callback `app/portal/(auth)/callback/route.ts` + `portal_bind_session` (vínculo por email).
- El magic-link deja de ser alternativa colapsada y pasa a ser **el formulario primario** del login.

### 3.3 Se AJUSTA (copy)
- `app/registro/RegisterForm.tsx` (pantalla de éxito): el Shipping Mark se presenta como **código de tus cajas**, no como "usuario"; la instrucción de acceso pasa a "entra con tu email — te mandamos un enlace al correo". El botón "Ir al portal" deja de llevar `?markbox=`.

### 3.4 NO se toca (fuera de alcance)
- Esquema, RLS, RPCs (`get_portal_client_id`, `portal_bind_session`), tabla `client_users`. **Sin migración.**
- El `markbox`/`MARKBOX_REGEX` como identificador interno (columnas, props, filtros) — intacto (SDD-0065).
- El registro en sí (campos, dedup, anti-abuso) salvo la copy de la pantalla de éxito.
- La contraseña aleatoria que genera el alta sigue existiendo (inerte; el magic-link no la usa). Limpiarla = fuera de alcance.

## 4. Seguridad
- El magic-link mantiene el pre-check anti-enumeración (mensaje genérico si el email no está habilitado) y el gate de vínculo en el callback.
- Al retirar el password-login se elimina toda superficie donde la contraseña pudiera derivarse de la cédula/RIF.

## 5. Verificación
- `node scripts/verify.mjs` verde (lint + typecheck + tests + docs:check); `next build` OK.
- Sin referencias colgantes a las funciones/props retiradas (grep limpio).
- Revisión visual del login por el agente `ui-ux-designer` (cambio de pantalla).
- Manual (coordinación, post-deploy): registrar un cliente → en `/portal/login` pedir enlace por email → entrar.

## 6. Estado
`in-progress` — implementado en rama `feat/acceso-email` (ventana secundaria). Pendiente: merge + deploy por coordinación. Sin migración a prod.
