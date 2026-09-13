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

> **Nota de importación — 2026-09-12.** Esta spec se importa desde la PR #21 (`ea9952a4`; commits
> `a5d9c897` y `219f9400`) con su contenido original, `status: done` incluido: ese estado describe el
> cierre técnico local de la rama de origen, no la aplicación en producción. Su migración
> `0411_client_annual_billing_facade` está **PENDIENTE DE APLICAR** y declarada en
> `supabase/migrations-baseline.json`; fusionar no autoriza aplicarla. Lote L07 del bloque C: **0407 →
> 0411, 0412 y 0413 → despliegue y smoke por roles → 0414**; el preflight de 0411 exige 0407. Es
> **MIGRATE-FIRST**: sin 0411 la RPC no existe (PGRST202, medido con postgrest-js 2.106.1 contra
> PostgREST v16.1), `clientAnnualBilling` lanza y fallan Fidelización, el CRM (su analítica corre en
> todas las pestañas) y Reportes → Comercial; `commercialByAgent` traga el error, pero comparte la carga
> con `commercialByClient`, que falla. El degradado está declarado en
> `supabase/pending-migration-symbol-declarations.json`. `lib/studio/fidelizacion/queries.ts` y los dos
> tests entran idénticos al origen: `main` no tocó esos archivos desde la base común.
>
> Paridad medida contra el cálculo de `main` con datos sintéticos y PostgREST: igual en la ventana de 12
> meses (bordes de año y de día UTC), monedas, tasas, estados, clientes fusionados y tenants. **Diverge**
> donde `main` fallaba: la RPC excluye facturas borradas y con `issued_at` futuro, neta los totales
> negativos, suma en `numeric` (12 × 12.500 VES / 3 da 50.000 USD, nivel Silver; `main` sumaba
> 49.999,99999999999 y daba Bronze) y no suma a un principal dual la factura de otro tenant que `main`
> tomaba por la policy Portal histórica. Esas divergencias quedan como decisión del Director en el
> handoff. No se importan el checklist `docs/audits/2026-09-02-codex-arranque-checklist.md` ni los
> handoffs `2026-09-02-*` de la allowlist; entran fuera de ella los dos registros de migraciones
> pendientes, que exigen los gates `migrations-applied` y `pending-migration-symbols`, y el handoff de
> esta importación, `.agents/handoffs/c-l07-fidelizacion-conversations.md`. Sin desviaciones: la
> migración y su contrato son idénticos al origen.

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
