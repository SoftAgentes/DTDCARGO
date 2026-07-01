---
sdd: "0120"
title: "Datos de la empresa — primera sección real de Administración (identidad fiscal + oficinas + bancos + impuestos)"
status: in-progress
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0085", "0030"]
confidencialidad: interno
---

# SDD-0120 · Datos de la empresa

> **La primera de las 13 secciones de Administración deja de ser placeholder.**
> `/studio/admin` es un shell maestro-detalle (13 secciones agrupadas en
> BÁSICO / INTERMEDIO / PRO) donde hoy solo "Agentes y Skills" tiene módulo
> real; el resto son paneles "por implementar". Esta spec construye la primera
> del grupo BÁSICO — **Datos de la empresa** — con el contenido exacto del
> handoff del Norte (`erp/modules/admin.jsx` · `SectionCompany`).

## Contexto

El diseño del Norte define 4 tarjetas para la sección:

1. **Identificación fiscal + contacto** — razón social, RIF, nombre comercial,
   email comercial, teléfono, WhatsApp Business, sitio web.
2. **Oficinas** — lista CN/VE (nombre + dirección), agregar/editar/eliminar.
3. **Datos bancarios** (aparecen en facturas) — banco, tipo, moneda, número.
4. **Impuestos** — IVA (%), ISLR retención (%), IGTF (%).

La tabla `tenants` solo tenía `display_name`, `brand_*`, `base_currency` e
`iva_enabled`. No existía identidad fiscal, oficinas, bancos ni tasas.

## Modelo de datos (migración 0190)

- **`tenants` += columnas** (1-a-1 con el tenant): `legal_name`, `trade_name`,
  `rif`, `commercial_email`, `phone`, `whatsapp`, `website`, `iva_rate`,
  `islr_rate`, `igtf_rate`. `iva_enabled` ya existía (prende/apaga); las tasas
  son la magnitud. CHECK 0–100 en cada tasa.
- **`company_offices`** (1-a-N): `country` (CHECK `VE|CN`), `name`, `address`,
  `sort_order`, soft-delete. RLS por tenant.
- **`company_bank_accounts`** (1-a-N): `bank_name`, `account_type`,
  `currency` (CHECK `USD|VES|CNY`), `account_number`, `sort_order`,
  soft-delete. RLS por tenant.

Convenciones del repo: enums lógicos = `text + CHECK`; grants explícitos
(auto-expose OFF, `revoke all from anon`); `touch_updated_at()` para
`updated_at`; RLS `using/with check (tenant_id = get_user_tenant_id())`.

## Seguridad

- **Aislamiento duro**: RLS por tenant en las dos tablas nuevas; la fila de
  `tenants` ya está protegida.
- **Edición gateada a rol admin** en la app: cada server action llama
  `moduleEditDenial(supabase, "admin")` (SDD-0085) — backstop server-side
  porque las actions son invocables directo. La sección ya exige
  `requireModuleView("admin")` para verse.
- **RIF** validado y normalizado en la app (`J-30182554-9`), nullable en DB.

## Superficie de código

- `lib/studio/company-types.ts` — enums, shapes, validators sin Zod
  (`validateCompanyIdentityInput`, `validateOfficeInput`,
  `validateBankAccountInput`).
- `lib/studio/company-queries.ts` — `getCompanyData(supabase)` (identidad +
  oficinas + bancos).
- `app/studio/(app)/admin/company-actions.ts` — `updateCompanyIdentityAction`,
  `saveOfficeAction`, `deleteOfficeAction`, `saveBankAccountAction`,
  `deleteBankAccountAction`.
- `app/studio/(app)/admin/_components/CompanySection.tsx` — orquestador client
  (4 tarjetas). Identidad + impuestos comparten un solo save; oficinas y bancos
  usan drawers (`OfficeDrawer`, `BankAccountDrawer`).
- `app/studio/(app)/admin/page.tsx` — fetch condicional (solo cuando la sección
  activa es `company`) + render de `CompanySection`.

## Fuera de alcance (siguientes secciones de Administración)

Master data, Tasas de cambio, Feriados, Apariencia, Numeración & legal,
Permisos, Audit log, API keys, Workflows, Import/Export — cada una es su propia
sección/SDD. Esta spec cierra **solo** "Datos de la empresa".

## Estado

- Migración `0190_datos_empresa.sql` escrita en la rama (worktree `web-norte`),
  **no aplicada a prod** — la aplica coordinación / founder (Director).
- Código listo; `pnpm typecheck` + `pnpm lint` + build de la ruta en verde.
