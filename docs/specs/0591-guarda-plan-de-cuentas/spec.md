---
sdd: "0591"
title: "Cambiar el plan de cuentas queda para accounting y admin"
status: in-progress
author: "Sam + Claude Opus 5.5"
created: 2026-11-02
updated: 2026-11-03
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

## 2026-11-03 · La 0510 aplicada en producción: cierre del runbook §6

La 0510 se aplicó hoy. Lo que antes en esta spec dice que no está aplicada es de su fecha. La identidad la pasó el Director General, de la salida del apply. Este cierre no consultó producción. El md5 y los bytes sí se comprobaron contra el archivo. Detalle en `.agents/handoffs/0591-guarda-plan-de-cuentas.md`.

| Dato | Valor |
|---|---|
| COMMIT | 2026-11-03T17:02:55.956Z |
| `version` del ledger | `20261103170255` |
| md5 y bytes | `53c078ff06e1b1b889a1f79295ac10e1`, 12056 |
| Filas del ledger | 503 después de aplicar también la 0511, leído por el Director General. 502 después de la 0510 es **inferencia**: no es una lectura de ese momento |
| Respaldo previo | `dtd-cargo-20261103T170055Z` |
| Evidencia | `/srv/ops/evidencias/apply-0510-dtd-cargo-20261103T170254Z` |
| Ensayo en prueba | `ensayo-0510-0511-prueba-20261103T163820Z`, 6 puntos PASÓ, según el Director General. Punto 5: se puso una cuenta sintética con rol `operations` y se devolvió. Sin ejecutar: asientos por pantalla |
| OK literal de Sam | «Autorizo: prueba y luego producción», en el chat del Director General, a «¿Autorizas aplicar las guardas contables 0510 y 0511 en dtd-cargo y fusionar sus PR #351 y #352?». Condición: primero en prueba, comprobando guardar una cuenta bancaria como administrador; si algo falla en prueba, parar y avisar |
| Merge | la #351, 2026-11-03T18:11:29Z, `6e89a4117`. Hora que pasó el Director General |
| Sello en el candado | sha256 `f236c923b22a11886ef2d780a3206243929a410e1c0daf294fb390f9c41dde20`, `ledger` exacta |

La 0510 salió de `pendingBelowCutoff`. No tenía declaraciones de símbolos. Su cabecera «NO APLICADA A PRODUCCIÓN» no se corrige: la identidad se prueba por md5. Ninguna prueba afirmaba la espera, así que no cambió ninguna. La web no cambia ni se publica con este cierre.
