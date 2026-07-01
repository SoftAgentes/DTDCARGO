# RESUMEN — worktree `web-norte` · Administración (SDD-0120 → 0127)

**Sesión:** secundaria (no push, no toca `main`, no aplica migrations a prod).
**Rama:** `feat/web-norte` (off `main`).
**Fecha:** 2026-07-01.

Ocho secciones de `/studio/admin` dejan de ser placeholder:
- **SDD-0120 · Datos de la empresa** (migración 0190).
- **SDD-0121 · Apariencia** (sin migración).
- **SDD-0122 · Numeración & legal** (migración 0191, solo texto).
- **SDD-0123 · Audit log** (read-only, sin migración).
- **SDD-0124 · Permisos por rol** (read-only, sin migración).
- **SDD-0125 · Master data** (read-only hub, sin migración).
- **SDD-0126 · Tasas de cambio** (sin migración; gestiona tenant_fx_history).
- **SDD-0127 · Feriados & ferias** (migración 0192, tabla nueva).

Con esto quedan reales BÁSICO completo + INTERMEDIO completo. Faltan solo las
PRO (API keys, Workflows, Import/Export) — infra nueva/sensible, cada una su
spec con tu dirección.

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

## SDD-0122 · Numeración & legal (migración 0191, solo texto)

Tercera sección. V1 conservadora en lo fiscal:
- **Formatos de numeración** = **read-only**. Los correlativos son legales/fijos
  (viven en RPCs). Facturas y Estimados muestran "próximo" en vivo (seguro:
  `next_invoice_code`/`next_quote_code` son `SELECT max+1`, NO consumen); el
  resto = "fijo por diseño". Hacerlos editables = spec fiscal con gate contador
  → fuera de alcance.
- **Leyendas legales en facturas** = editable (pie + T&C), guardado en `tenants`
  (no en `fiscal_settings`, para no tocar el módulo Fiscal). Migración 0191 = 2
  columnas de texto aditivas (sin lógica de numeración → no sensible).

**Archivos nuevos:** `lib/studio/numbering-{types,queries}.ts`,
`app/studio/(app)/admin/numbering-actions.ts`,
`app/studio/(app)/admin/_components/NumberingSection.tsx`,
`supabase/migrations/0191_invoice_legal_legends.sql`,
`docs/specs/0122-numeracion-legal/spec.md`.
**Modificados:** `app/studio/(app)/admin/page.tsx` (fetch + render; `sddRef` →
SDD-0122).

**Follow-ups:** consumir las leyendas en el PDF/renderer de facturación ·
numeración editable de verdad (prefijo/padding, notas déb/créd, control SENIAT)
= spec fiscal con gate contador.

---

## SDD-0123/0124/0125 · Audit + Permisos + Master data (read-only, sin migración)

Tres secciones read-only en un solo commit (comparten el wiring de `page.tsx`):

- **Audit log (0123)** — viewer de `entity_audit_log` (últimos ~100 eventos:
  cuándo/entidad/evento/actor/payload) + filtros client-side por entidad/actor.
  Solo `select` (el INSERT es service_role). `lib/studio/audit-{types,queries}.ts`
  + `_components/AuditLogSection.tsx`.
- **Permisos por rol (0124)** — matriz rol×módulo derivada en vivo de la config
  RBAC estática (`canAccessModule`/`canEditModule`, SDD-0085). TOTAL/V·E/V/—.
  No editable (RBAC vive en código). `_components/PermissionsSection.tsx`.
- **Master data (0125)** — hub read-only: tiers de cliente (código) + punteros a
  `/studio/servicios` y `/studio/admin/rutas` + chips "por implementar"
  (segmentos, doc types, HS, AES). `_components/MasterDataSection.tsx`.

**Modificado:** `app/studio/(app)/admin/page.tsx` (fetch de audit + render de las
tres; `sddRef` → 0123/0124/0125). Specs `docs/specs/0123..0125`.

---

## SDD-0126 · Tasas de cambio (sin migración)

Gestiona `tenant_fx_history` (migr 0074), que YA es el store de tasas (gastos +
posting contable leen la última). No creé fuente de verdad nueva:
- **Tasas vigentes** — última por par (CNY/USD, VES/USD) con fecha.
- **Registrar tasa** — INSERT append-only (el grant ya existía); warning suave
  fuera de rango (`FX_RATE_SANITY_RANGE`).

`lib/studio/exchange-rates-{types,queries}.ts` (reusa `getLastFxRate`) +
`admin/exchange-rates-actions.ts` + `_components/ExchangeRatesSection.tsx`.

## SDD-0127 · Feriados & ferias (migración 0192)

Sección "Feriados CN/VE" ampliada a **ferias comerciales** (Cantón/Yiwu) — ambos
pegan en lead times/SLAs. Tabla nueva `operational_calendar` (country VE|CN,
kind holiday|fair, start/end date, note; RLS por tenant, soft-delete). **No**
reusa `nomina_holidays` (dominio nómina distinto).

`supabase/migrations/0192_operational_calendar.sql` +
`lib/studio/op-calendar-{types,queries}.ts` + `admin/calendar-actions.ts` +
`_components/CalendarSection.tsx` + `CalendarEventDrawer.tsx`. CRUD admin-gated.

**Modificado (ambas):** `app/studio/(app)/admin/page.tsx` (fetch + render;
label de holidays → "Feriados & ferias"; sddRef → 0126/0127).

---

## Verificación (las ocho secciones)

- `tsc --noEmit` → ✅ verde
- `eslint` (archivos nuevos + modificados, incluye frontera público↔ERP) → ✅
  verde (solo warnings pre-existentes `set-state-in-effect` al hidratar de
  localStorage, mismo patrón que ya tenía el topbar).
- `next build` (app completa) → ✅ EXIT 0
- `build-docs-index --check` (frontmatter de 0120 y 0121) → ✅ verde

## Pendiente para el Director (integración)

1. **Aplicar migraciones a prod** (validar antes con dry-run tx
   `begin…rollback`): `0190_datos_empresa.sql` (SDD-0120),
   `0191_invoice_legal_legends.sql` (SDD-0122) y
   `0192_operational_calendar.sql` (SDD-0127). Las secciones read-only y Tasas
   no necesitan migración. Company/numbering/feriados referencian columnas/tablas
   nuevas → no guardan en runtime hasta aplicarlas.
2. **Regenerar el índice SDD** (`pnpm docs:index` → `docs/specs/README.md`) —
   archivo compartido, no lo toqué. Debe incluir 0120 → 0127.
3. Merge de `feat/web-norte` → `main` + push (gate del founder).
4. Opcional: check `ui-ux-designer` pre-merge (regla del founder para pantallas
   nuevas).

## No hecho (fuera de alcance)

Las otras secciones de Administración (Master data, Tasas de cambio, Feriados,
Numeración & legal, Permisos, Audit log, API keys, Workflows, Import/Export)
siguen como placeholder — cada una es su propio SDD. Ojo: **Tasas** y
**Feriados** ya tienen infra parcial en DB (`tenant_fx_history`,
`nomina_holidays`) → conviene diseñarlas con ese contexto, no greenfield.
