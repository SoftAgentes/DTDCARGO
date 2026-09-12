---
sdd: 0353
title: Minimizar el contexto de correo de Cobranzas
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0026
  - SDD-0085
  - SDD-0306
  - SDD-0351
  - SDD-0358
confidencialidad: interno
---

# SDD-0353 — Contexto de correo mínimo para Cobranzas

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commits
> `e0c560a6` y `fa420f3f`) con su contenido original, `status: done` incluido: ese estado describe el
> cierre técnico local de la rama de origen, no la aplicación en producción. Su migración
> `0410_collections_mail_context` está **PENDIENTE DE APLICAR** y declarada en
> `supabase/migrations-baseline.json`; fusionar no autoriza aplicarla. Lote L10 del bloque C, con
> orden obligatorio **0410 → despliegue y verificación de Cobranzas → 0415** (SDD-0358): la decisión 5
> la cumple 0415, no 0410. Es **MIGRATE-FIRST**: sin 0410 la RPC no existe, `contextoDeEnvio` lanza y
> la vista previa y el envío de recordatorios fallan cerrados sin enviar nada; el degradado está
> declarado en `supabase/pending-migration-symbol-declarations.json`. `recordatorios-queries.ts` y su
> test entran idénticos al origen: `main` no tocó ese módulo desde la base común. No se importan el
> checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los handoffs `2026-09-02-*` de la
> allowlist; entran fuera de ella los dos registros de migraciones pendientes, que exigen los gates
> `migrations-applied` y `pending-migration-symbols`, y el handoff de esta importación,
> `.agents/handoffs/c-l10-recordatorios-cobranzas.md`, donde queda la evidencia local.

## Estado real

Cobranzas sólo necesita saber si el cliente tiene email, si presentó una queja
y cuándo salió el último recordatorio de cada factura. Para calcularlo leía
directamente emails, metadata y todo `mail_logs` del tenant. Esa dependencia
impedía completar el RBAC admin-only de Mailing en SDD-0351.

## Decisión

1. Crear `collections_mail_context(uuid[])`, sin parámetro de tenant y limitada
   a facturas del tenant activo que el caller solicita.
2. Exigir `accounting|admin` dentro de la función `SECURITY DEFINER` y limitar
   cada llamada a 1.000 facturas.
3. Devolver únicamente `invoice_id`, Shipping Mark, dos flags y la fecha UTC del
   último recordatorio. Email y metadata no salen de la base.
4. Migrar `contextoDeEnvio()` a la RPC y fallar cerrado si no puede calcularla.
5. Restringir el SELECT directo de `mail_logs` a admin; `service_role` conserva
   envío, webhooks y health checks. **Secuencia corregida antes de publicar
   (SDD-0358):** 0410 sólo crea el facade compatible; 0415 restringe la lectura
   después de desplegar y verificar la aplicación consumidora.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: función y policy prueban rol + tenant; ids de otro
  tenant devuelven cero filas.
- `cumplimiento` SGE-00.11: un error de autorización aborta el preview/envío en
  vez de asumir que el cliente acepta correo.
- `cumplimiento` MP-01: la capa de Cobranzas recibe señales minimizadas, no email
  ni metadata del histórico.
- `no aplica`: visuales, accesibilidad, IA o cambio del criterio de recordatorio.

## Allowlist exacta

- `lib/studio/collections/recordatorios-queries.ts`
- `lib/studio/collections/__tests__/recordatorios-queries.test.ts`
- `supabase/migrations/0410_collections_mail_context.sql`
- `supabase/tests/0410_collections_mail_context.test.sql`
- `docs/specs/0353-collections-mail-context/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-collections-mail-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Cobranzas no consulta `clients.email` ni `mail_logs` directamente.
- Accounting/admin reciben sólo señales de sus facturas; otros roles,
  membresías desactivadas y otros tenants fallan cerrados.
- Admin conserva la consola completa de Mailing y service_role el runtime.
- Las pruebas focales, contrato SQL, rebuild, TypeScript, lint, docs,
  numeración, gobernanza y diff pasan.

## Fuera de alcance

- Cambiar el criterio o frecuencia de recordatorios.
- Cambiar Resend, crons, webhooks, UI o datos existentes.
- Aplicar la migración a Cloud/Producción.
