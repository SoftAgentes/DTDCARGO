# RESUMEN · feat/correos-auth

Ventana secundaria (Modo Forja). Rama `feat/correos-auth`. **NO push.**

## Qué se hizo

Brandear los correos de **Supabase Auth** (versionados en el runbook, para que el
founder los pegue en el dashboard) + un ajuste de diseño pedido en vivo por Sam.

### 1. Runbook `docs/runbooks/setup-portal-auth.md` (sección "Plantillas de email branded")

- **3 plantillas nuevas** brandeadas (mismo molde: Archivo · navy #0F1E3D · papel
  #FBFAF7 · wine #7F0F1A · cierre "Con Confianza"):
  - **Reset Password (Recovery)** — subject `Recupera el acceso a tu cuenta · DTD Cargo`
  - **Change Email Address** — subject `Confirma tu nuevo correo · DTD Cargo`
  - **Reauthentication (código OTP)** — subject `Tu código de verificación · DTD Cargo`
    (usa `{{ .Token }}`, no `ConfirmationURL` — código en caja mono, sin botón)
- **Tabla-checklist** al inicio de la sección: plantilla → subject → variable →
  estado, con el link directo al dashboard para pegar cada una.
- **Nota SDD-0094**: el portal es solo magic-link; el Reset casi no aplica a clientes
  de portal, se brandeó por si hay cuentas con clave (registro público / legacy).
- **Rediseño del fallback** (pedido de Sam): en las 5 plantillas con botón se cambió
  la URL cruda a lo largo (escandalosa) por una línea chica:
  *"¿El botón no funciona? **Áblelo aquí**."* — con el enlace metido dentro de "aquí".

### 2. `lib/studio/portal-invite-email.ts` (correo de invitación del Studio, SDD-0042)

- Sam lo vio en una captura con el mismo link crudo escandaloso. Con su OK explícito
  (era otro sistema), se aplicó el **mismo fallback chico** ("Ábrelo aquí").
- Es HTML inline (Resend), no toca la app ni migración. Test verde: 6/6 en
  `lib/studio/__tests__/portal-invite-email.test.ts`.

## Checklist de plantillas de Auth (pendiente: pegar por el founder)

Todas están **brandeadas en el runbook**; falta **pegarlas** en
https://supabase.com/dashboard/project/xpfuzqombmjmxvprjgmi/auth/templates

| Plantilla | Subject | Estado |
|---|---|---|
| Magic Link | Tu enlace de acceso al portal · DTD Cargo | brandeada · **pendiente de pegar** |
| Confirm signup | Confirma tu cuenta · DTD Cargo | brandeada · **pendiente de pegar** |
| Invite user | Te damos acceso a tu portal · DTD Cargo | brandeada · **pendiente de pegar** |
| Reset Password | Recupera el acceso a tu cuenta · DTD Cargo | brandeada · **pendiente de pegar** |
| Change Email | Confirma tu nuevo correo · DTD Cargo | brandeada · **pendiente de pegar** |
| Reauthentication | Tu código de verificación · DTD Cargo | brandeada · **pendiente de pegar** |

> ⚠️ La captura del founder mostró el **Magic Link todavía en inglés (default de
> fábrica)** → aún no está pegado. La entrega es el HTML; pegar es paso manual del founder.

## Aclaración importante (2 sistemas distintos de correo)

- **Supabase Auth** (magic-link, reset, etc.) → se editan en el **dashboard**, HTML
  versionado en el runbook. Estos son los de esta tarea.
- **Studio / mailing** (bienvenida, factura, etc.) → `scripts/seed-mail-templates.ts`
  + `/studio/mailing`, se mandan por Resend API. **NO se tocaron** (otro sistema).
  El único de código que se tocó fue `portal-invite-email.ts`, y solo porque Sam
  lo pidió en vivo por el link crudo.

## Commits (en `feat/correos-auth`)

- `docs(runbooks): correos Auth brandeados (reset/cambio-email/OTP) + checklist + fallback chico`
- `feat(studio): SDD-0042 — fallback compacto en el correo de invitación del portal`

## Follow-ups

- Founder: pegar las 6 plantillas en el dashboard de Auth (empezando por el Magic
  Link, que sigue en default inglés).
- Si se quiere unificar el diseño de TODOS los correos del Studio (bienvenida,
  factura…) → tarea de otra ventana sobre `/studio/mailing` + `seed-mail-templates.ts`.

## Verificación

- `node node_modules/vitest/vitest.mjs run lib/studio/__tests__/portal-invite-email.test.ts` → **6/6 verde**.
  (node_modules se resolvió vía junction al repo principal; el worktree nuevo no
  trae deps. Junction ya removido.)
