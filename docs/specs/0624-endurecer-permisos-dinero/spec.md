---
sdd: "0624"
title: "Endurecimiento de permisos: dinero, gastos y deuda RBAC"
status: in-progress
author: "Claude Code (sesión del Director) + Sam"
created: 2026-11-11
updated: 2026-11-11
supersedes: null
superseded_by: null
related: ["0085", "0139", "0252", "0407", "0470", "0492", "0500", "0593", "0622"]
confidencialidad: interno
---

# SDD-0624 — Endurecimiento de permisos: dinero, gastos y deuda RBAC

## 1. Por qué

El 2026-11-11 Sam pidió una revisión exhaustiva de la permisología del Studio y
autorizó avanzar los arreglos. Una auditoría de solo lectura (HEAD `09e6b279f`)
encontró que en varios módulos la matriz de `lib/studio/rbac.ts` se cumple sólo
en la aplicación: la base filtra por tenant, no por rol, y cualquier miembro
activo —incluido `support`, que es de solo lectura— puede leer, y en algunos
casos escribir, por PostgREST con el JWT de su propia sesión.

Esta spec cubre lo que NO es Comercial. Las tablas comerciales (tarifas,
cotizaciones, conversaciones, órdenes, CRM, bandeja) y la lectura de rol en
dashboard, topbar y búsqueda global van en la SDD-0622 (accesos por persona),
que agrega `user_has_module`.

## 2. Qué cambia

### 2.1 Base de datos — migración `0528_rls_lectura_dinero_y_gastos.sql`

| Tabla / objeto | Antes | Después |
|---|---|---|
| `journal_entries`, `journal_lines`, `payment_receipts`, `supplier_bills`, `supplier_payments` (SELECT) | `*_team_select`: todo el tenant | `*_money_select`: tenant + `studio_can_read_money()` (accounting o admin activos) |
| `studio_can_read_money()` | — | Helper único. La SDD-0622 lo redefine para sumar los accesos por persona sin tocar policies |
| `claim_indemnity_entry_codes(uuid[])` | — | DEFINER; sólo `(claim_id, entry_code)` de asientos asentados del tenant, para quien ve Reclamos |
| `expenses_insert`, `expenses_update` (dueño) | cualquier membresía | además, rol activo distinto de `support` |

Se quedan como están, a propósito: `suppliers` (lo usan commercial y
operations), `company_bank_accounts` (el número sale en cotizaciones y
facturas), `accounts` (plan de cuentas, sin montos), y `expenses_cn_team` /
`expenses_ve_accounting` (el equipo CN comparte los gastos por diseño, 0074).

Crear el gasto propio sigue abierto al staff no-support a propósito: el ERP
móvil (`/m/erp`) deja a comercial y operaciones cargar sus gastos de calle, y
la tabla lo dice desde la 0047 («cada user del tenant carga los suyos»).

**Depende de la 0470 y la 0511**, que según sus cabeceras no están aplicadas
en producción. El preflight de la 0528 aborta si sus policies `*_team_select`
no existen. Aplicar exige OK de Sam nombrando el archivo y medir el ledger
antes (`docs/runbooks/aplicar-migraciones-prod.md`).

### 2.2 Aplicación

- **Reclamos** (`lib/studio/reclamos/claims-queries.ts`): `listClaimEntryCodes`
  usa la RPC nueva; si la base aún no la tiene (`PGRST202`/`42883`), cae a la
  lectura cruda, que en esa base sigue abierta.
- **Agentes** (`app/api/studio/agents/run/route.ts`): `moduleEditDenial(…,
  "admin")` → 403 antes de crear el cliente admin o llamar al orquestador.
- **Páginas sensibles**: toda `page.tsx` de un módulo de dinero, solo-admin o
  gastos llama ella misma a `requireModuleView` (antes sólo su `layout.tsx`;
  un layout compartido no se vuelve a ejecutar en la navegación parcial).
  También `bugs`, `menciones`, `mis-bugs` y `usuarios`.
- **DEUDA de `rbac-actions-guard.test.ts`: 24 → 3.** Gate central en academia
  ×2, club, reclamos (resolución financiera → `moduleEditDenial("accounting")`),
  geocodificación de clientes, gastos ×2, documentos ×3, bitácora ×2, bugs
  (`tenantAdminGate`), facturación ×2 y nómina ×2. Las 4 del perfil propio
  pasan a EXCEPCIONES con el alcance verificado. Quedan las 3 de tarifas, que
  son de la SDD-0622.

### 2.3 Hallazgos de la auditoría que NO se cambian

| Hallazgo | Decisión | Razón |
|---|---|---|
| `0496:721` deja a accounting congelar tarifas normales | No aplica | accounting ya tiene la vía elevada (`fix_frozen_rate`); negarle la normal sería incoherente |
| `expenses_cn_team` edita gastos ajenos | No aplica | Es el diseño de la 0074 (la alerta de consolidación la atiende cualquiera del equipo CN) |
| `expenses_insert` abierto a commercial/marketing | Parcial | Sólo se cierra a `support`; ver §2.1 |

## 3. Pruebas

- `supabase/tests/0528_rls_lectura_dinero_y_gastos.test.sql` + su espejo
  PGlite `lib/studio/__tests__/rls-lectura-dinero-y-gastos.migration.test.ts`:
  matriz de 9 actores × 5 tablas, la RPC de reclamos, gastos, lo intacto;
  control rojo (sin 0528 el comercial lee asientos) y 5 mutantes cazados. Un
  sexto mutante (las líneas sin el helper) sobrevive a propósito: el EXISTS de
  `journal_lines` ya pasa por la RLS de `journal_entries`.
- `lib/studio/__tests__/page-gates-sensibles.test.ts`: contrato nuevo; el
  módulo sale de la ruta (`moduleIdForPath`), con piso y control de
  excepciones muertas. Detectó solo la página de Usuarios sin gate.
- `app/api/studio/agents/run/__tests__/route-gate.test.ts`: 403 sin Admin.
- `rbac-actions-guard.test.ts` y `rbac-view-guard.test.ts` actualizados
  (listas congeladas y allowlist).

## 4. Fuera de alcance detectado

- `legal/layout.tsx` exige el módulo `legal` (admin) y por eso bloquea
  `legal/expediente/[code]` a commercial y support, aunque la capability
  `view_defense_file` (SDD-0070) se lo abrió el 2026-07-19. Es un defecto
  funcional previo, no de seguridad.
- La lectura de `invoices` ya la cerró la 0414 (`invoices_accounting_select`); la
  0528 aplica el mismo molde a las cinco tablas que faltaban.
