---
sdd: "0143"
title: "Mailing al Norte — Firmas, Envío manual y Programados (+ cron)"
status: in-progress
author: "Claude Code (ventana secundaria · worktree mailing-norte) + founder"
created: 2026-07-03
updated: 2026-07-03
supersedes: null
superseded_by: null
related: ["0026", "0085"]
confidencialidad: interno
---

# SDD-0143 · Mailing al Norte

> Lleva el módulo **Mailing** (`/studio/mailing`) a la estructura del Norte
> (`docs/design/studio/_norte/erp/modules/mailing*.jsx`): 7 tabs en orden y
> las 3 vistas que faltaban construidas **de verdad** (Firmas, Envío manual,
> Programados con cron). Decisión del founder (2026-07-03): "construir todo real".

## Contexto

El Mailing en prod tenía 5 tabs (Logs default · Templates · Reglas · Config ·
Blacklist). El Norte define 7: **Templates · Firmas · Envío manual · Programados
· Reglas auto. · Configuración · Logs**, con Templates como default y Blacklist
plegada dentro de Configuración.

## Slices

### A — Reshape (sin backend) · commit `40888602`
Tabs al orden del Norte, default Templates, renombres (Reglas auto. /
Configuración), Blacklist dentro de Configuración, subtítulo dinámico por tab.

### B — Firmas · commit `68f10a11` · **migración 0206**
Tab real portado de `mailing-signatures.jsx`: lista de equipo (todos los
miembros del tenant) + editor con selector de 5 layouts, campos, idioma y
preview en vivo. `renderSignatureHtml()` (`lib/studio/mail-signature-render.ts`)
es función pura reusada por Envío manual.
- **Decisión (founder):** el admin edita la firma de **cualquier** miembro.
- **Migración 0206:** columna `mail_signatures.lang` (es/en/zh) + policies
  tenant-scoped (permissive, conviven con las owner-scoped de 0018). El gating
  a rol admin lo hace la app (módulo admin-only), no la RLS — regla de la casa
  "RLS por tenant, rol en la app".
- Mapeo layouts Norte→enum: clasico→corporate, compacto→inline, vertical→card,
  minimo→minimal, foto→image_only.

### D — Programados + cron · commit `e0d32667` · **migración 0207**
Tab real portado de `mailing-scheduled.jsx`: KPIs (En cola / Total) + cola con
"Enviar ya" y cancelar.
- **Migración 0207:** tabla `mail_scheduled` (cola) + RLS tenant-scoped + índice.
- **Decisión (founder):** motor = tabla + **cron**. `/api/cron/mail-scheduled`
  procesa los `queued` vencidos de todos los tenants vía `sendEmail()`, marca
  `sent`/`failed`. Auth `CRON_SECRET` Bearer (patrón `purge-throttle`).
  Registrado en `vercel.json` (`*/5 * * * *`).

### C — Envío manual · commit `bb29d6e6`
Tab real portado de `mailing-compose.jsx`: canal Email/WhatsApp, Para + CC/BCC,
Asunto, cuerpo, firma adjunta con preview, "Enviar ahora" (`sendManualEmailAction`)
y "Programar" (reusa `scheduleEmailAction`).
- Helper `buildOutgoingHtml` compartido entre envío inmediato y programado:
  body texto→`<br>` + firma horneada al encolar (el cron manda `body_html`
  crudo) → el programado sale idéntico al inmediato.

## Fuera de alcance (V1)
- Integración WhatsApp real (el canal es display, como en el Norte).
- Uploader de adjuntos en Envío manual (`sendEmail` no los soporta hoy).
- Picker de clientes/leads en Compose (simplificado a input de email).
- Editor rich del cuerpo (se usa textarea texto plano → `<br>`).

## Pendiente del Director (integración)
1. Aplicar migraciones **0206** y **0207** a prod (revisión con skills Supabase
   seguridad + postgres antes de aplicar).
2. Setear `CRON_SECRET` y confirmar el schedule de Vercel para
   `/api/cron/mail-scheduled`.
3. `node scripts/verify.mjs` + `pnpm build` antes de merge.
4. Check `ui-ux-designer` de las 3 vistas nuevas.
5. Regenerar `docs/specs/README.md` (`pnpm docs:index`) y marcar `status: done`.

## Verificación (lane)
`tsc --noEmit` + `eslint` verdes en las 4 slices. Migraciones NO aplicadas a
prod (las aplica el Director). Sin push.
