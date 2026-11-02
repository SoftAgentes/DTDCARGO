---
sdd: "0591"
title: "Cambiar el plan de cuentas queda para accounting y admin"
status: in-progress
author: "Sam + Claude Opus 5.5"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0040", "0085", "0139", "0492", "0573"]
confidencialidad: interno
---

# SDD-0591 — Cambiar el plan de cuentas queda para accounting y admin

> Cierra en la base lo que hoy sólo cierra la app: quién puede crear, cambiar o
> borrar una cuenta contable.

## Contexto

El 2026-11-02 Sam decidió quitar el filtro de la 0497 (SDD-0573), literal
«Sí, quítalo», porque producción ya no tiene facturas. Sin ese filtro, un cambio
malo en `public.accounts` detiene los cobros con un error visible en vez de pasar
en silencio. La condición que se le planteó: antes de usar el ERP de verdad hay
que restringir quién puede cambiar esa tabla. Después pidió, literal, «Haz esta
tarea aquí: “Restringir quién puede cambiar la tabla de cuentas”».

### El hueco (medido en el catálogo de producción, 2026-11-02)

La tabla tiene una sola policy, `«accounts by tenant»` (0078:147): FOR ALL para
`authenticated`, con `qual` y `with_check` iguales a
`(tenant_id = get_user_tenant_id())`, huella
`f118dd90556c13981e880287a2b28599`. ACL: `authenticated` con SELECT, INSERT,
UPDATE y DELETE; `service_role` con todo; `anon` sin nada.

**Cualquier miembro activo del tenant, de cualquier rol, puede escribir por
PostgREST**, saltándose el guard de las server actions. Hoy hay miembros activos
con roles `marketing` y `warehouse`, que sólo ven un puñado de módulos.

**Los clientes del portal no pasan:** `get_user_tenant_id()` lee `user_tenants`,
donde un cliente no tiene membresía. El contrato lo fija con un actor
`cliente-portal`.

Desde la 0497, la validez de cada venta depende de `is_postable`, `parent_id` y
`code` de esta tabla (`i3_assert_invoice_final` y `scripts/qa/0497-legado-por-clase.sql`).
Un PATCH a `is_postable` de la `4.5` dejaría sin cobro a todas las facturas con
venta del tenant.

### Inventario de escritores (2026-11-02)

| Camino | Cliente | Quién llega |
|---|---|---|
| `createAccount`, `updateAccount` y `deleteAccount` (`app/studio/(app)/contabilidad/actions.ts`) | sesión | `accounting`, `admin` (`moduleEditDenial("accounting")`) |
| Siembras de 0078, 0114, 0122 y 0157 | migración, como `postgres` | no aplica en operación |

- `accounting` es un módulo de dinero, en `LOCKED_MODULES` (`lib/studio/rbac.ts`):
  ningún override de tenant lo abre a otro rol.
- Ningún otro `.insert`, `.update`, `.upsert` o `.delete` sobre `accounts` en
  `app`, `lib`, `scripts` ni `supabase/functions`. No se usa el cliente admin para
  escribirla.
- Ninguna función del catálogo de producción escribe en `accounts`.
- Las migraciones 0498 a 0509, en ramas sin fusionar, tampoco la tocan.

## Decisiones

- **El molde es el de la 0470 (SDD-0492)**, que ya corre en producción:
  `accounts_team_select` para leer y `accounts_accounting_*` para escribir, con
  `current_studio_role()` y la igualdad de tenant. Con dos membresías activas,
  `get_user_tenant_id()` devuelve null y no se escribe nada.
- **El DELETE se queda, a diferencia de la 0470.** `deleteAccount` borra físico
  con el cliente de sesión. Revocarlo rompería esa pantalla; un mutante lo prueba.
  Moverlo a una RPC es un cambio mayor que no hace falta para cerrar el hueco.
- **La lectura no se toca.** Posting, gastos, tesorería, costos y reportes leen el
  plan desde muchos módulos. El contrato lo fija con una aserción por rol.
- **La app no cambia.** Los roles sin permiso ya los frena el guard; lo que cambia
  es que la base también lo sabe.
- **Sin orden obligatorio respecto de la 0497.** La 0510 sólo toca policies de
  `accounts` y no fija cuerpos de la 0497. La condición de Sam sí fija el momento:
  antes del uso real del ERP.
- **Límites con `set local`, sin `reset`**, para que alcancen al INSERT del ledger
  que agrega el empaquetador, la lección de la 0497.

## Qué cambia

`supabase/migrations/0510_rls_escritura_accounts.sql`: preflight, cuatro policies
en lugar de `«accounts by tenant»`, postflight.

## Qué no cambia

Las lecturas, las filas, los GRANT, `service_role`, los triggers de auditoría
(0290) y de `updated_at`, y la app.

## Allowlist exacta

- `supabase/migrations/0510_rls_escritura_accounts.sql` (nueva)
- `supabase/tests/0510_rls_escritura_accounts.test.sql` (nuevo)
- `lib/studio/__tests__/rls-escritura-accounts.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (sólo la espera de la 0510)
- `docs/specs/0591-guarda-plan-de-cuentas/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0591-guarda-plan-de-cuentas.md`

## Aceptación

1. **El contrato SQL pasa con la 0510 y falla sin ella** (control rojo: el
   comercial da de alta una cuenta). Cubre:
   - que los siete roles activos del tenant siguen leyendo el plan;
   - que `accounting` y `admin` crean, editan con la misma escritura de
     `updateAccount` y borran;
   - que `commercial`, `operations`, `warehouse`, `support` y `marketing` reciben
     42501 al crear y no alcanzan ninguna fila al editar `is_postable`,
     `parent_id`, `code` o `type` de la `4.5`, ni al borrar;
   - que un usuario desactivado, uno con dos membresías y un cliente del portal no
     leen ni escriben;
   - que un `accounting` de otro tenant no cruza, y que el de este no se lleva una
     cuenta a otro tenant;
   - que `anon` no tiene acceso y que `service_role` sigue escribiendo;
   - que un intento rechazado no deja evento de auditoría y uno permitido sí;
   - la forma de las policies y la ACL;
   - que no cambia nada más: filas, policies, ACL, triggers y funciones.
2. **El mismo contrato en CI**, con PGlite, porque el CI no tiene Docker.
3. **Mutantes de la 0510 en la prueba**, corridos sin el postflight propio para
   que los cace la matriz de roles, y uno con el postflight.
4. `pnpm verify` completo, con la espera declarada.

Aplicar en producción no es parte de esta aceptación: exige OK de Sam nombrando
el archivo, por `docs/runbooks/aplicar-migraciones-prod.md`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | El rol deja de ser sólo un gate de la app: lo exige la RLS. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | El camino por PostgREST se cierra en la base. |
| MP-01 (permanencia) | **excepción** | `accounting` y `admin` conservan el DELETE físico que ya usa `deleteAccount`, que exige cuenta sin subcuentas ni movimientos. No empeora: hoy lo tiene cualquier rol. |
| AUD-01, AUD-02 (auditoría) | **cumplimiento** | `audit_d2_accounts` no cambia; el contrato comprueba que un cambio permitido deja su evento. |

## Fuera de alcance detectado

1. **`accounting` y `admin` todavía pueden hacer ese PATCH por PostgREST.** La
   regla «una cuenta con movimientos no se vuelve grupo» y la validación del plan
   viven en `updateAccount`, no en la base. Proteger las cuentas con movimientos
   exige un trigger; esta spec sólo decide quién.
2. **`journal_entries` y `journal_lines` tienen el mismo hueco**: `«journal_entries
   by tenant»` y `«journal_lines by entry tenant»` son FOR ALL y sólo piden el
   tenant, medido en producción el 2026-11-02. `company_bank_accounts` también.
   Necesitan su propio inventario de escritores, porque el posting corre desde
   varios módulos.
