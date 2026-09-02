---
sdd: 0354
title: Minimizar la facturación anual para Fidelización y CRM
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0021
  - SDD-0051
  - SDD-0052
  - SDD-0078
  - SDD-0252
  - SDD-0350
confidencialidad: interno
---

# SDD-0354 — Facturación anual minimizada

## Estado real

Fidelización, CRM y dos reportes sólo necesitan el total facturado en USD por
Shipping Mark durante los últimos 12 meses. Sin embargo, la implementación
leía todas las facturas del tenant con moneda, tasa, estado y fechas, y agregaba
esos detalles en TypeScript. Eso exponía datos financieros fila por fila a
roles comerciales y bloqueaba el cierre posterior del SELECT de `invoices`.

## Decisión

1. Crear `studio_client_annual_billing(date)`, sin parámetro de tenant y ligada
   a la membresía activa del caller.
2. Exigir acceso efectivo a Fidelización, CRM o Reportes. Reportes mantiene el
   candado `accounting|admin`; los otros dos módulos respetan concesiones y
   revocaciones en `studio_role_module_overrides` antes de usar su default.
3. Normalizar y agregar dentro de Postgres: USD/USDT 1:1, VES dividido por una
   tasa positiva y CNY/valores sin tasa omitidos; contar sólo estados billable.
4. Devolver únicamente `client_markbox` y `billed_usd`, paginados con orden
   estable. Ningún detalle individual sale hacia la aplicación.
5. Limitar la fecha de referencia al presente ±1 día para tolerar la frontera
   de zona horaria sin permitir enumeración histórica arbitraria.
6. Mantener temporalmente `invoices_team_select`; se cerrará cuando los demás
   consumidores no financieros tengan sus propias fachadas.

## Gate SGE-00 y privacidad

- `cumplimiento` SGE-00.05/06: tenant y rol se derivan de la sesión dentro de
  `SECURITY DEFINER`; otro tenant no puede seleccionar su objetivo.
- `cumplimiento` SGE-00.11: errores y truncamiento abortan el cálculo en vez de
  publicar un tier plausible pero incompleto.
- `cumplimiento` MP-01: CRM/Fidelización reciben sólo un agregado por Shipping
  Mark; moneda, tasa, estado, fechas e ids de factura permanecen en la base.
- `no aplica`: UI, envío de correo, escritura financiera o datos existentes.

## Allowlist exacta

- `lib/studio/fidelizacion/queries.ts`
- `lib/studio/fidelizacion/__tests__/queries.test.ts`
- `lib/studio/reports/__tests__/queries.test.ts`
- `supabase/migrations/0411_client_annual_billing_facade.sql`
- `supabase/tests/0411_client_annual_billing_facade.test.sql`
- `docs/specs/0354-client-annual-billing-facade/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-client-annual-billing-facade-close.md`
- `.agents/handoffs/2026-09-02-client-annual-billing-overrides-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Fidelización, CRM y Reportes no leen facturas individuales para calcular la
  facturación trailing-12m.
- La normalización, estados, fecha fallback, soft-delete y aislamiento quedan
  cubiertos por contrato SQL con rollback total.
- Roles con acceso efectivo reciben sólo su tenant; revocaciones explícitas,
  roles sin acceso, cuentas desactivadas y fechas históricas arbitrarias fallan
  cerrados. Una concesión a Fidelización/CRM no abre facturas individuales.
- Pruebas focales, contrato SQL, rebuild, TypeScript, lint, docs, numeración,
  gobernanza y diff pasan.

## Fuera de alcance

- Endurecer todavía la policy SELECT general de `invoices`.
- Cambiar tiers, umbrales, monedas soportadas o historia existente.
- Aplicar la migración a Cloud/Producción.
