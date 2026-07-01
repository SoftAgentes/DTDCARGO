# RESUMEN — worktree `web-norte` · Administración (SDD-0120 + SDD-0121)

**Sesión:** secundaria (no push, no toca `main`, no aplica migrations a prod).
**Rama:** `feat/web-norte` (off `main`).
**Fecha:** 2026-07-01.

Dos secciones de `/studio/admin` dejan de ser placeholder:
- **SDD-0120 · Datos de la empresa** (con migración 0190).
- **SDD-0121 · Apariencia** (sin migración).

---

## SDD-0120 · Datos de la empresa

### Qué se hizo

Primera sección real de **Administración** (`/studio/admin`): la sección
**"Datos de la empresa"** deja de ser placeholder y guarda en DB. 4 tarjetas
del handoff del Norte (`erp/modules/admin.jsx · SectionCompany`):

1. Identificación fiscal + contacto (razón social, RIF, nombre comercial,
   email, teléfono, WhatsApp, sitio web).
2. Oficinas CN/VE (1-a-N, drawer CRUD).
3. Datos bancarios (1-a-N, drawer CRUD).
4. Impuestos (IVA / ISLR / IGTF + toggle IVA activo).

Identidad + impuestos comparten un solo "Guardar cambios"; oficinas y bancos
usan drawers con su propia CRUD.

## Archivos tocados

**Nuevos:**
- `supabase/migrations/0190_datos_empresa.sql` — columnas fiscales en `tenants`
  + tablas `company_offices` y `company_bank_accounts` (RLS por tenant, grants
  explícitos, soft-delete).
- `lib/studio/company-types.ts` — enums, shapes, validators (sin Zod).
- `lib/studio/company-queries.ts` — `getCompanyData(supabase)`.
- `app/studio/(app)/admin/company-actions.ts` — 5 server actions (gate admin
  vía `moduleEditDenial`).
- `app/studio/(app)/admin/_components/CompanySection.tsx` — orquestador client.
- `app/studio/(app)/admin/_components/OfficeDrawer.tsx`
- `app/studio/(app)/admin/_components/BankAccountDrawer.tsx`
- `docs/specs/0120-datos-empresa/spec.md`

**Modificados:**
- `app/studio/(app)/admin/page.tsx` — fetch condicional + render de
  `CompanySection`; `sddRef` de la sección company → SDD-0120.

---

## SDD-0121 · Apariencia (sin migración)

Segunda sección real de Administración. Preferencias por-usuario (localStorage,
mismo patrón que el theme existente) + material de marca read-only:

- **Densidad** (compact/normal/spacious) — el control genuinamente nuevo (el CSS
  ya traía `[data-density]`, faltaba dónde elegirla).
- **Tema** (light/dark) — comparte mecanismo con el toggle del topbar vía helper
  `appearance-prefs` (evento `studio:appearance`) → sincronizados en vivo.
- **Paleta de marca** read-only (bloqueada) + **Recursos de marca** (links a
  `/interno/marca` y `/marca/brand-book`).
- **Logo & favicon** → panel "por implementar" (Storage + gobernanza de marca).

**Archivos nuevos:** `app/studio/_components/appearance-prefs.ts`,
`app/studio/(app)/admin/_components/AppearanceSection.tsx`,
`docs/specs/0121-apariencia/spec.md`.
**Modificados:** `app/studio/layout.tsx` (FOUC + densidad),
`app/studio/(app)/_components/StudioTopbar.tsx` (usa helper + escucha evento),
`app/studio/(app)/admin/page.tsx` (render appearance; `sddRef` → SDD-0121).

---

## Verificación (ambas slices)

- `tsc --noEmit` → ✅ verde
- `eslint` (archivos nuevos + modificados, incluye frontera público↔ERP) → ✅
  verde (solo warnings pre-existentes `set-state-in-effect` al hidratar de
  localStorage, mismo patrón que ya tenía el topbar).
- `next build` (app completa) → ✅ EXIT 0
- `build-docs-index --check` (frontmatter de 0120 y 0121) → ✅ verde

## Pendiente para el Director (integración)

1. **Aplicar migración `0190_datos_empresa.sql` a prod** (validar antes con
   dry-run tx `begin…rollback`). Solo aplica a SDD-0120; SDD-0121 no tiene
   migración. El código de company referencia columnas/tablas nuevas → esa
   sección no funciona en runtime hasta aplicarla.
2. **Regenerar el índice SDD** (`pnpm docs:index` → `docs/specs/README.md`) —
   archivo compartido, no lo toqué. Debe incluir 0120 y 0121.
3. Merge de `feat/web-norte` → `main` + push (gate del founder).
4. Opcional: check `ui-ux-designer` pre-merge (regla del founder para pantallas
   nuevas).

## No hecho (fuera de alcance)

Las otras secciones de Administración (Master data, Tasas de cambio, Feriados,
Numeración & legal, Permisos, Audit log, API keys, Workflows, Import/Export)
siguen como placeholder — cada una es su propio SDD. Ojo: **Tasas** y
**Feriados** ya tienen infra parcial en DB (`tenant_fx_history`,
`nomina_holidays`) → conviene diseñarlas con ese contexto, no greenfield.
