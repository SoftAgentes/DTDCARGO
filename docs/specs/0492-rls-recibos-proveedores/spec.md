---
sdd: "0492"
title: "Escribir cobros y cuentas por pagar queda para accounting y admin"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-19
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0044", "0085", "0139", "0251", "0350", "0365", "0488", "0489"]
confidencialidad: interno
---

# SDD-0492 — Escribir cobros y cuentas por pagar queda para accounting y admin

## Contexto

Junta dos hallazgos del mismo tipo, que el Director verificó y asignó el
2026-09-19:

- el punto 1 del «Fuera de alcance» de la SDD-0488: la RLS de
  `payment_receipts` sólo filtra por tenant (0079:145, con la 0230), y
  `void_payment_receipt_with_audit_reason` no exige rol;
- el punto 1 del «Fuera de alcance» de la SDD-0489: lo mismo en `suppliers`,
  `supplier_bills` y `supplier_payments` (0088:266-282), donde además se puede
  escribir `paid_amount` y `status`, y las envolturas
  `void_supplier_*_with_audit_reason` tampoco exigen rol.

### El hueco (medido)

Cada una de las cuatro tablas tiene **una sola policy**, `«<tabla> by tenant»`,
FOR ALL para `authenticated`, con `qual` y `with_check` iguales a
`(tenant_id = get_user_tenant_id())`. Se leyó del catálogo de producción el
2026-09-19: misma huella `f118dd90556c13981e880287a2b28599` en las cuatro, y
ACL `{authenticated=arwd, service_role=arwdDxtm}`, sin nada para `anon`.

Con eso, **cualquier miembro del tenant, de cualquier rol, podía hacer INSERT,
UPDATE o DELETE por PostgREST**, saltándose el guard de las server actions: el
comercial podía cargar un cobro, mover el `paid_amount` de una CxP o borrar una
orden de pago. El contrato lo reproduce: sin la 0470, `commercial-A` inserta un
recibo de cobro sin que nada lo frene.

La app no tiene ese problema: Cobranzas, Facturación y Tesorería son módulos de
dinero (`accounting` + `admin`), Rendiciones es admin-only, y la recepción de
una compra asistida pide la capability `approve_money`. El hueco es que **la
base no lo sabía**.

### Inventario de escritores (2026-09-19)

Antes de restringir nada se inventarió quién escribe hoy, para no romper a
ningún rol legítimo:

| Camino | Cliente | Quién llega | Tablas |
|---|---|---|---|
| Cobranzas: registrar, identificar y anular (`collections-actions.ts`) | sesión | `accounting`, `admin` (módulo de dinero) | `payment_receipts` |
| Facturación: registrar pago (`facturacion/actions.ts:612`) | sesión | `accounting`, `admin` | `payment_receipts` |
| Tesorería: proveedor, CxP y orden de pago (`tesoreria/actions.ts`, `treasury-actions.ts`) | sesión | `accounting`, `admin` | las tres de proveedores |
| Compras asistidas: recibir una OC (`purchase-orders/actions.ts:344`) | sesión | capability `approve_money` = `accounting`, `admin` | `suppliers`, `supplier_bills` |
| Rendiciones: emitir y anular (`renditions/actions-helpers.ts`) | sesión | `admin` + superadmin | `payment_receipts` |
| RPC de la 0467 y de la 0468 | INVOKER | ya exigen `admin` o `accounting` | `payment_receipts`, proveedores |
| `rename_client_markbox` (0371) | DEFINER de postgres | cualquiera que edite un cliente | `payment_receipts.client_markbox` |

- Los módulos de dinero y Rendiciones están en `LOCKED_MODULES`
  (`lib/studio/rbac.ts`): ningún override de tenant los abre a otro rol.
- El módulo RBAC llamado `suppliers` es `/studio/proveedores`, que escribe
  `suppliers_cn` (el catálogo del cliente), no la tabla `suppliers`.
- Nadie borra filas de estas tablas: se anulan. No hay un solo `.delete()` en
  el repo sobre ellas, ni escritores con el cliente admin.

## Decisiones

### Del Director (2026-09-19), revisables por Sam

1. **Las tres envolturas de la 0294 exigen rol** con `assert_studio_role`, y el
   release va **0468 → 0470**. La alternativa era no tocar sus cuerpos y
   dejarlo sólo a la RLS de UPDATE: cierra igual el hueco, pero el que no tiene
   rol recibe un `false` en silencio en vez de un 42501.
2. **El DELETE se retira del todo** (sin policy y sin GRANT para
   `authenticated`; `service_role` conserva el suyo), por la permanencia de
   MP-01. La alternativa era dejarlo sólo para `accounting` y `admin`.

### De diseño, con evidencia

- **El molde es el de la 0407** (SDD-0350), que ya hizo esto con `invoices` y
  está aplicada: `<tabla>_team_select` para leer, `<tabla>_accounting_insert` y
  `<tabla>_accounting_update` para escribir, y `revoke delete`. Misma familia de
  tablas de dinero, mismo criterio de rol que las RPC de la 0467 y la 0468.

  **Por qué ese molde y no el de la 0422**, que el encargo daba como criterio
  (el Director lo revisó y lo aprobó así el 2026-09-19):
  - el criterio de rol es el mismo en las dos: membresía activa del tenant con
    `accounting` o `admin`. Cambia la forma, no la regla;
  - la 0422 es una frontera de **sólo lectura**: mueve toda la escritura de
    `payment_reports` a comandos auditados (0421) y deja la tabla sin DML. Acá
    la escritura se queda en la tabla, que es justo lo que hizo la 0407;
  - la 0407 es la hermana **ya aplicada** de estas tablas de dinero: `invoices`
    y `payment_receipts` se escriben en el mismo flujo de Cobranzas. Una sola
    forma en el dominio se revisa mejor que dos;
  - la 0422 correlaciona la membresía con el `tenant_id` de la fila; acá la
    igualdad de tenant ya lo hace, como se explica abajo.
- **La lectura no se toca.** Sigue siendo tenant-wide, la deuda deliberada que
  ya anotó la 0407: hay módulos que consumen agregados. El contrato lo fija con
  una aserción por rol.
- **`current_studio_role()` alcanza, y la igualdad de tenant ata la fila.** Con
  dos membresías activas, `get_user_tenant_id()` (0453) devuelve null y no se
  escribe nada, así que no hace falta correlacionar la membresía con
  `tenant_id` como en la 0422.
- **El orden lo obliga un md5, no una dependencia de comportamiento.** La 0468
  fija el cuerpo de `void_supplier_payment_with_audit_reason`; medido: con la
  0470 primero, el preflight de la 0468 aborta sin cambiar nada.
- **`rename_client_markbox` no se ve afectada:** es DEFINER de `postgres`, dueño
  de las tablas, y ninguna tiene `FORCE ROW LEVEL SECURITY`. El preflight lo
  exige y el postflight comprueba que el FORCE sigue apagado.

## Alcance

### Qué cambia

- **`supabase/migrations/0470_rls_escritura_cobros_proveedores.sql`:** las tres
  policies por tabla, el `revoke delete`, el assert en las tres envolturas de la
  0294 y los comentarios de las cuatro tablas. Con preflight (huellas de las
  policies, ACL y md5 de los cuerpos de producción) y postflight.
- **Nada de TypeScript.** Ninguna acción cambia: todas las que escriben ya
  corren con `accounting` o `admin`.

### Qué no cambia

- Las lecturas, las filas, `service_role`, los generadores `next_*`,
  `rename_client_markbox`, las RPC de la 0467 y la 0468 y los triggers de
  auditoría (0290) y de `updated_at`.
- `suppliers_cn`, el catálogo comercial, con sus propias policies (0105, 0229).

### Allowlist exacta

- `supabase/migrations/0470_rls_escritura_cobros_proveedores.sql` (nueva)
- `supabase/tests/0470_rls_escritura_cobros_proveedores.test.sql` (nuevo)
- `lib/studio/__tests__/rls-escritura-cobros-proveedores.migration.test.ts` (nuevo)
- `supabase/migrations-baseline.json` (sólo la espera de la 0470)
- `docs/specs/0492-rls-recibos-proveedores/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0492-rls-recibos-proveedores.md`

## Aceptación

1. **El contrato SQL pasa con la 0470 y falla sin ella** (control rojo: el
   comercial da de alta un cobro). Cubre, por tabla:
   - que los siete roles activos del tenant siguen leyendo lo mismo;
   - que sólo `accounting` y `admin` dan de alta y editan; los demás reciben
     42501 al insertar y no alcanzan ninguna fila al editar;
   - que nadie borra por la API, ni `accounting`, y que `service_role` sí;
   - que un `accounting` de otro tenant y uno desactivado no leen ni escriben;
   - que el soft delete de `accounting` sigue pasando (la trampa de la 0230);
   - que las envolturas de la 0294 rebotan al comercial con 42501 y siguen
     funcionando con rol, con su razón humana en la auditoría D2;
   - que las RPC de la 0467 siguen funcionando encima;
   - la forma de las policies, la ACL y la de las envolturas;
   - que no cambia nada más: policies, ACL, triggers y funciones ajenas.
2. **El mismo contrato en CI**, con PGlite
   (`rls-escritura-cobros-proveedores.migration.test.ts`), porque el CI no tiene
   Docker.
3. **Mutantes de la 0470 fuera del repo**, cada uno corrido también **sin el
   postflight de la propia migración**, para que lo tenga que cazar la matriz de
   roles del contrato y no el autochequeo.
4. **Compatibilidad con la 0468** (PR #169), fuera del repo: en el orden
   0468 → 0470 sus RPC siguen funcionando; en el orden inverso su preflight
   aborta sin cambiar nada.
5. `pnpm verify` completo, con la espera declarada.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | El rol deja de ser sólo un gate de la app: lo exige la RLS, como ya hacía `invoices` (0407). |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | El camino por PostgREST se cierra en la base; no se avisa después. |
| MP-01 (permanencia) | **cumplimiento** | `authenticated` pierde el DELETE físico: los cobros y las órdenes se anulan, con su razón. |
| AUD-01 (auditoría de mutaciones) | **cumplimiento** | La D2 (0290) y la razón humana (0294/0267) siguen iguales; el contrato lo comprueba. |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No cambian pantallas ni botones: ningún rol pierde nada que hoy pueda hacer desde el Studio. |

## Release

- **Orden: MIGRATE-FIRST, y después de la 0468.** Primero el OK nominal de Sam
  nombrando la 0470, después se aplica con el runbook de producción, y sólo
  entonces se integra la PR, que va en DRAFT con «NO FUSIONAR hasta aplicar
  0470» en la primera línea.
- Si la 0468 (PR #169) se aplica, va **antes**. Si se aplicara primero la 0470,
  el preflight de la 0468 aborta sin cambiar nada y hay que actualizar su huella
  (medida: `b1d007101562c1b727fcf921a746f635`, sin espacios
  `52727f731062ed77ce19749830f60d09`).
- **Sin cambios de app, no hay ventana de incompatibilidad:** la aplicación
  desplegada hoy ya escribe sólo con `accounting` y `admin`.
- **Efecto para `service_role`:** las envolturas de la 0294 llamadas con el
  cliente admin pasan a fallar con 42501, porque `auth.uid()` es null. Hoy no
  hay ningún llamador así (inventario); si apareciera, se resuelve llamándolas
  con el cliente de sesión, como hace Tesorería.

## Evidencia

- **`pnpm verify` completo** sobre `f7bbd27c` (base `main` `dd764c66`), en el
  turno del Director, el 2026-09-19, de 21:53 a 22:06 UTC: **16 de 17 pasos
  PASARON y ninguno falló.**
  - test: 8117 ✓ y 1 omitido, en 621 archivos, con los 12 casos del envoltorio
    PGlite;
  - sql-tests: 219 contratos en `postgres:17`, con el de la 0470;
  - schema-rebuild y build;
  - e2e: 166 ✓. Los 2 flaky son ajenos: el selector combinado de la calculadora
    pública, que pasó al reintento;
  - typecheck; lint con 0 errores y 15 avisos en archivos ajenos;
  - docs, numbering y gobernanza; el gate de símbolos: `0 ROJO · 0 AMARILLO`.
- **`migrations-applied`: NO DISPONIBLE**, porque el worktree no tiene
  credenciales. La 0470 no está aplicada a propósito: es la espera.
- El resto va en el handoff: el contrato con la matriz de roles, su envoltorio
  PGlite, los mutantes (con y sin el postflight de la propia migración) y la
  compatibilidad con la 0468 en los dos órdenes.

## Fuera de alcance detectado

1. **La lectura sigue tenant-wide** en las cuatro tablas, como en `invoices`.
   Cerrarla pide RPC minimizadas para los módulos que consumen agregados; es la
   deuda que ya anotó la 0407 y no se toca en un slice de integridad.
2. **`next_bill_code` y `next_supplier_code` (0088) calculan `max+1` sin lock**,
   y truncan pasado 9999 con `lpad(…, 4)`. Es el punto 2 y 3 del «Fuera de
   alcance» de la SDD-0489.
3. **`suppliers_cn`** (0105, 0229) tiene su propio juego de policies, con
   escritura para el equipo del tenant. Es el catálogo comercial del cliente, no
   mueve plata, y queda como está.
