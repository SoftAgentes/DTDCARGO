---
sdd: 0351
title: Aplicar RBAC admin-only al dominio Mailing
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0026
  - SDD-0085
  - SDD-0139
  - SDD-0143
confidencialidad: interno
---

# SDD-0351 — RBAC admin-only para Mailing

> **Nota de importación — 2026-09-11.** Esta spec se importa desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0408_mailing_admin_rbac` queda **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción en esta tarea**: el
> `done` de la cabecera no significa que este contrato esté vigente en la base real. Aplicarla
> exige OK nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`. El
> checklist de auditoría y los handoffs del 2026-09-02 que cita su allowlist histórica no
> forman parte de este lote.

## Estado real

La aplicación declara `mailing` como módulo admin-only y todas sus Server
Actions usan el guard correspondiente. Sin embargo, la base permitía CRUD por
tenant a cualquier sesión `authenticated` sobre plantillas, firmas, reglas,
configuración, blacklist y correos programados. El replay del historial también
restituyó EXECUTE a `authenticated` sobre dos RPC `SECURITY DEFINER` internas.

## Decisión

1. Exigir tenant activo y `current_studio_role() = 'admin'` en todas las
   operaciones expuestas de las seis tablas administrativas.
2. Reemplazar las policies tenant/owner permisivas, incluida la expansión de
   firmas introducida por SDD-0143.
3. Fijar ACL explícitas por tabla para que `authenticated` no herede TRUNCATE u
   otros privilegios fuera del CRUD requerido por la UI.
4. Reservar `mail_increment_template_metrics` y `mail_check_blacklist` a
   `service_role`; el código vigente las usa en orquestadores privilegiados.
5. No cerrar `mail_logs` en este slice: Cobranzas usa una lectura tenant-wide
   para spam y recordatorios de facturas. Requiere una RPC minimizada separada.

## Gate SGE-00

- `cumplimiento` SGE-00.05: el rol se prueba en RLS además del guard de Next.
- `cumplimiento` SGE-00.06/11: una sesión no-admin no ve ni muta configuración
  de correo, y una membresía desactivada falla cerrada.
- `cumplimiento` ERR-01: los rechazos siguen el contrato PostgREST/RLS que las
  Server Actions ya traducen a mensajes controlados.
- `no aplica`: visuales, accesibilidad, IA o cambio de flujo de envío.
- `no conformidad acotada`: `mail_logs` mantiene SELECT tenant-wide hasta crear
  el facade requerido por Cobranzas; no se amplían sus grants ni policies.

## MP-01 y datos

- Plantillas/reglas/config/programados: configuración operativa P1/P2; el admin
  conserva su ciclo de vida vigente.
- Blacklist, firmas y programados pueden contener email/teléfono/cuerpo; el
  cambio reduce sus lectores y escritores. No captura, mueve ni elimina datos.
- `service_role` conserva el procesamiento de colas, webhooks y métricas.

## Allowlist exacta

- `supabase/migrations/0408_mailing_admin_rbac.sql`
- `supabase/tests/0408_mailing_admin_rbac.test.sql`
- `docs/specs/0351-mailing-rbac/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-mailing-rbac-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- `commercial`, `operations`, `accounting`, `warehouse`, `support` y
  `marketing` no leen ni mutan las seis tablas administrativas por PostgREST.
- Admin desactivado y admin de otro tenant no cruzan el gate.
- Admin activo conserva SELECT y el CRUD específico de cada tabla.
- `authenticated` no ejecuta las dos RPC internas; `service_role` sí.
- `mail_logs` no cambia y su deuda queda visible en el checklist P1.
- Contrato SQL, rebuild, docs, numeración, gobernanza y diff pasan.

## Fuera de alcance

- Minimizar `mail_logs` para Cobranzas y el dashboard.
- Cambiar Resend, crons, acciones, UI, plantillas o datos existentes.
- Aplicar la migración a Cloud/Producción.
