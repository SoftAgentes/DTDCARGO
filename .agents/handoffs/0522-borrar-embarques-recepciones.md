# Handoff · SDD-0522 · Borrado auditado de embarques y recepciones de prueba

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 |
| Task ID | 0522-borrar-embarques-recepciones |
| Owner | subagente Worker del Director (claim `worker-0522-agent-a3b622475fa7e5225`, liberado al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a3b622475fa7e5225` |
| Rama | `codex/borrar-embarques-recepciones` |
| Base | `origin/main` en `a8d99acf` (#223); sin cambios en main al cerrar |
| SDD | [0522](../../docs/specs/0522-borrar-embarques-recepciones/spec.md) · `in-progress` · reserva local `codex/sdd-reserve-0522-borrar-embarques-recepciones` (`6e43f60d`, sin push; el stub ya está en esta rama) |
| Migración | `0476_borrado_embarques_recepciones.sql` · **NO APLICADA** · espera en `pendingBelowCutoff` |
| PR | ver «PR / BRANCH» |
| Estado de tarea | lista-para-revision (PR draft, migrate-first) |

## OBJETIVO ORIGINAL

Que Sam (admin) pueda escoger y eliminar embarques (`/studio/embarques`) y recepciones del
Almacén CN (`/studio/cn`) de prueba: borrado lógico auditado (P2), motivo obligatorio, todo o nada,
sin borrar lo que tenga dependencias vivas y con la UI diciendo qué lo bloquea. Pedido literal y
decisiones de Sam en la spec.

## COMPLETADO

- **Migración 0476** (1093 líneas): 4 RPC (dos de lectura y dos de borrado), 4 funciones internas, 3
  funciones de trigger, 4 triggers, revoke del DELETE de `authenticated` sobre `shipments` y
  `warehouse_receipts_cn`, preflight y postflight con huella. Detalle y citas en la spec.
  - **Guardas de embarques** (13): ya eliminado, entregado, factura no anulada, gasto, CxP no
    anulada, costeo, Financiero China (3 tablas), aduana, ruta TMS no cancelada, reclamo,
    consolidación naviera viva, recepciones CN vivas y compra (prealerta) viva unida.
  - **Guardas de recepciones** (7): ya eliminada, consolidada en embarque vivo, orden de despacho no
    cancelada (polimórfico por `package_kind`), compra viva, orden de venta viva, caja recibida en
    una recepción VE viva y caja estibada en una consolidación viva.
  - **Agregados al encargo, justificados en la spec**:
    - compra unida al embarque (`prealertas.shipment_id`);
    - orden de venta, recepción VE y estiba de la recepción;
    - el retiro de las cajas al eliminar la recepción;
    - la cancelación inmediata de los avisos programados;
    - los triggers BEFORE que cierran el UPDATE directo de `deleted_at` para `authenticated` y
      `anon`, como `guard_ve_delivery_completion` de 0321.
  - La compra de la recepción **se bloquea, no se revierte** (por qué, en la spec).
- **App**:
  - capabilities `delete_shipments` / `delete_warehouse_receipts` (admin);
  - la regla pura `lib/studio/borrado/reglas.ts`, que la UI y el servidor comparten, y
    `servidor.ts`;
  - las acciones nuevas o migradas (Embarques, Tracking, DELETE de la API, Almacén CN);
  - el rollback de `createReceiptAction` por el cliente admin;
  - `listReceipts` y los KPIs del Almacén CN sin eliminadas;
  - las claves i18n en es-VE y zh-CN.
- **UI**:
  - casillas y barra en Embarques, con la casilla fuera del `<button>`;
  - «Eliminar…» en la barra del Almacén CN;
  - en Tracking, el botón sólo para quien puede y el modal con motivo.
- **Pruebas**:
  - contrato SQL de 215 aserciones (psql en Docker y PGlite), control rojo, 8 casos de drift y 76
    mutantes de la migración, todos muertos, más 2 equivalentes documentados;
  - 116 casos nuevos o reescritos en Vitest y 47 mutantes manuales de la app: 46 muertos y 1
    equivalente;
  - 0416 ajustada.
- **Locks medidos**: ShareRowExclusive + ShareUpdateExclusive sobre las dos tablas, 147 ms. Con
  contención, corta a los 5,16 s por `lock_timeout` y se revierte entera.

## VALIDACIÓN

SHA verificado: `ca733ee5`, la cabeza de la rama antes del commit de documentación (ver COMMITS).
Entre ese SHA y la punta sólo hay documentos: la spec, el índice y este handoff.

| Comprobación | Resultado |
|---|---|
| Contrato `0476` con psql en `postgres:17` (Docker, contenedor efímero propio) | PASÓ: `TEST 0476 GREEN: 215 aserciones`; control rojo falla en «el equipo borró físicamente un embarque por la API» |
| Contrato `0416` con psql (ajustado) | PASÓ |
| Vitest `borrado-embarques-recepciones.migration.test.ts` (PGlite: verde, rojo, 8 drift, 76 mutantes) | PASÓ: 87/87, 287 s |
| Vitest de la regla, servidor, acciones, UI y listados (9 archivos nuevos o reescritos) | PASÓ |
| Vitest de las suites existentes afectadas (route-auth, pantallas-muestran-la-denegacion, EmbarquesClient.adjuntos, rbac-actions-guard, rbac, listados, avisos, warehouse-cn-markbox-retirado, módulo de eventos, cobranzas) | PASÓ: 517 + 593 casos en las dos corridas |
| Mutantes manuales de la app (corredor con control verde de 153 casos y sha256) | PASÓ: 46/47 muertos; 1 equivalente |
| `tsc --noEmit` | PASÓ |
| ESLint sobre los archivos tocados | PASÓ |
| `pnpm docs:check` / `pnpm sdd:check` / `pnpm governance:check` / `pnpm components:check` | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 1 AMARILLO declarado (`sdd-0522-borrado-embarques-recepciones`) |
| `git diff --check` y espacios sobrantes en archivos nuevos | PASÓ |
| `/ui-check` (advisory) | OK con ajustes menores (abajo) |
| `pnpm knowledge:status` | NO DISPONIBLE en el worktree: `ok: false`, Graphify estructural/semántico `INVALID` (no hay grafo en este árbol), Archify `ARCHIFY_RUNTIME_MISSING`, Obsidian `PENDING`. No se publicó nada: lo hace el Director desde main |
| `corepack pnpm verify` completo | exit 0, 16 de 17 pasos medidos sin fallos; `migrations-applied` NO EJECUTADO (detalle abajo) |

**/ui-check** (no bloqueante):
1. ⭐ [media] padding, gap y bottom de la barra fuera de la escala de 4px, copiados de la BulkBar del
   Almacén CN para que las dos se vean igual (corregir las dos juntas).
2. [media] Casillas de 16 px, bajo el piso de 32 px de BTN-01 §7; mismo tamaño que el Almacén CN.
3. [baja] Las filas bloqueadas son más altas por el motivo visible.
4. [baja] El botón de fila de Embarques no tiene foco propio (ya venía así).

### Resultado de verify

Una sola corrida, con turno del Director: 2026-10-15, de 07:20:29 a 07:42:51 UTC (03:20 a 03:42
en Caracas). Corrió sobre `ca733ee5`, con la spec, el índice y este handoff todavía sin commit. Son
sólo documentos, y después de cerrarlos se repitieron `docs:check` y `sdd:check` (ver COMMITS). Resumen de la herramienta: «16 de 17
pasos corrieron de verdad» y «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied». Exit 0 no
equivale a un cierre verde completo.

| Paso | Resultado |
|---|---|
| harness | PASÓ |
| lint | PASÓ: 0 errores; 15 avisos, todos en archivos que esta rama no toca |
| rsc-boundary | PASÓ (1668 módulos) |
| typecheck | PASÓ |
| edge-functions | PASÓ (4 funciones) |
| test (Vitest) | PASÓ: 716 archivos pasaron y 1 omitido; 9883 pruebas pasaron y 1 omitida; 346 s |
| docs:check | PASÓ |
| numbering | PASÓ: sin números repetidos |
| feature-constants | PASÓ (6 banderas) |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO EJECUTADO: `[SKIP]` sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` en el worktree (por regla no se copian secretos). La 0476 no está aplicada a propósito |
| pending-migration-symbols | PASÓ: 0 ROJO · 1 AMARILLO declarado (`soft_delete_shipments_with_audit_reason`) |
| sql-tests | PASÓ: 229 contratos en `postgres:17`, entre ellos `0476_borrado_embarques_recepciones` y `0416_portal_shipments_tenant_boundary` |
| schema-rebuild | PASÓ: 472 migraciones; 454 aplicadas desde cero y 18 sólo de ledger; aislamiento multi-tenant en 219 tablas |
| e2e | PASÓ con aviso: 177 pasaron, 20 omitidas, 1 inestable y ninguna falló. La inestable es `e2e/auth.spec.ts:81` («Acceso: un token inválido…»), ajena a esta rama, que pasó en el reintento. El proceso salió ≠0 por el worker de WebKit en Windows, como reconoce la herramienta |
| build | PASÓ: build de producción OK y `tsconfig.json` restaurado |

## COMMITS

- `6e43f60d` chore(sdd): reserva SDD-0522 (stub de la reserva local, del que parte esta rama).
- `4a5cfa87` feat(studio): SDD-0522 — migración 0476 de borrado auditado de embarques y recepciones.
- `1e8ad350` feat(studio): SDD-0522 — regla, acciones y capabilities del borrado.
- `ca733ee5` feat(studio): SDD-0522 — elegir y eliminar en Embarques, Almacén CN y Tracking.
- El commit que contiene este documento: docs: SDD-0522 — spec, índice y handoff. Antes del commit
  se repitieron `docs:check` y `sdd:check` sobre los documentos ya cerrados.

## PR / BRANCH

- Rama `codex/borrar-embarques-recepciones`, base `main`, worktree arriba.
- PR draft: se publica al cerrar (URL en el resumen del Worker y en la PR).

## PENDIENTES DE ESTA TAREA

1. `migrations-applied` sin medir en el worktree: lo cierra la aplicación en producción (punto 2).
2. Aplicar la 0476 en producción (Director, con OK nominal de Sam) y retirar la espera y la
   declaración de símbolos antes de fusionar.
3. Smoke de Sam (abajo) después de desplegar.
4. Prueba visual en navegador real (SGE-00.10): no se pudo hacer sin una sesión de Studio. La cubre
   el smoke.

## FUERA DE ALCANCE DETECTADO

1. **`POST /api/studio/shipments` sin gate de edición** (`app/api/studio/shipments/route.ts:64-99`):
   valida el payload y el tenant (`getUserTenantId`) e inserta, sin `moduleEditDenial`. Cualquier
   miembro del tenant crea envíos por la API. (Anotado por el Director; confirmado.)
2. **Restaurar por PostgREST sigue abierto y sin auditoría**: la policy FOR ALL de `shipments` y
   `warehouse_receipts_cn` (0230) deja a `authenticated` poner `deleted_at = null`. El registro
   reaparece sin evento ni revalidación (MP-01 §6). La 0476 sólo cierra el paso de NULL a valor.
3. **Alertas de gastos de embarques eliminados**: `countActiveAlerts`, `listActiveAlerts` y
   `activeAlertShipmentIds` (`lib/studio/expense-alerts-queries.ts:20-74`) no miran
   `shipments.deleted_at`. Con las guardas (un contenedor con recepciones vivas no se borra y la
   alerta se revierte al sacarlas) es difícil que quede una viva, pero no imposible.
4. **Estimados convertidos**: `quoteDeleteBlockReason` (SDD-0300) bloquea el borrado de un estimado
   con `converted_to_shipment_id` aunque ese embarque esté eliminado. Sam no podrá borrar desde el
   Cotizador los estimados de prueba que convirtió.
5. **Detalle de una recepción eliminada**: `getReceiptById` (`lib/studio/warehouse-cn-queries.ts:207`)
   no filtra `deleted_at`: por URL se sigue abriendo. Los demás lectores de `warehouse_receipts_cn`
   revisados sí filtran.
6. **Barras de selección fuera de la escala de 4px y casillas de 16 px** (ui-check 1 y 2), en el
   Almacén CN desde antes y ahora también en Embarques: corrección transversal.
7. **`MODAL_BACKDROP` de `FooterActions.tsx`** usa `rgba(...)` inline (preexistente).

## HANDOFF AL DIRECTOR

### Antes de aplicar: lecturas en producción (READ ONLY, catálogo, sin filas de negocio)

La forma más fiel es correr el **preflight solo, dentro de una transacción que se revierte**. No
escribe nada: sólo lee catálogo y `audit_entity_types`, y fija un GUC de sesión que el ROLLBACK
deshace.

```sql
begin;
set local lock_timeout = '5s';
-- pegar aquí, sin cambios, el bloque `do $preflight$ … $preflight$;` de
-- supabase/migrations/0476_borrado_embarques_recepciones.sql (líneas 107-376)
rollback;
```

Si termina sin error, el preflight pasará al aplicar. Además, para el registro:

```sql
-- quien aplica: debe omitir RLS (las RPC son SECURITY DEFINER)
select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user;
-- grants actuales de las dos tablas (authenticated tiene DELETE hoy; anon nada)
select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type)
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('shipments', 'warehouse_receipts_cn')
  and grantee in ('anon', 'authenticated', 'service_role')
group by 1, 2 order by 1, 2;
-- el rollback de createReceiptAction necesita DELETE de service_role (no lo exige la migración)
select has_table_privilege('service_role', 'public.warehouse_receipts_cn', 'DELETE');
-- triggers vivos de las dos tablas
select tgrelid::regclass, tgname, tgenabled from pg_trigger
where tgrelid in ('public.shipments'::regclass, 'public.warehouse_receipts_cn'::regclass)
  and not tgisinternal order by 1, 2;
-- nada con los nombres de la 0476 (esperado: 0 filas)
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and (proname like 'soft_delete_%' or proname like '%delete_blockers%'
       or proname in ('shipments_audit_soft_delete', 'warehouse_receipts_cn_audit_soft_delete'));
```

### Orden de despliegue (migrate-first)

1. Lecturas de arriba. Si algo difiere de lo que exige el preflight, la migración aborta sin cambiar
   nada.
2. OK nominal de Sam: «autorizo aplicar 0476_borrado_embarques_recepciones».
3. Aplicar en el servidor propio (`dtd-cargo-db-1`), en baja actividad, de a una, en una
   transacción con la fila del ledger y el name exacto (runbook). Si corta por `lock_timeout`
   (5 s), reintentar.
4. Postflight (catálogo):
   - las 11 funciones con su `prosecdef`, `proconfig = {search_path=""}` y ACL: las cuatro RPC sólo
     con EXECUTE para `authenticated`; el resto, sólo el dueño;
   - los 4 triggers habilitados (`pg_get_triggerdef`);
   - `has_table_privilege('authenticated', 'public.shipments', 'DELETE')` y el de
     `warehouse_receipts_cn` en `false`, con SELECT/INSERT/UPDATE en `true`;
   - identidad del ledger contra el blob (md5 y bytes).
5. Retirar en esta rama la espera `0476_borrado_embarques_recepciones` de
   `supabase/migrations-baseline.json` y la declaración `sdd-0522-borrado-embarques-recepciones` de
   `supabase/pending-migration-symbol-declarations.json`, con CI verde sobre ese commit.
6. Fusionar la PR (despliega). En la ventana entre 3 y 6, «Eliminar envío» de Tracking y el DELETE
   de la API del código viejo fallan con su error (no borran nada).

### Smoke para Sam (después de desplegar)

Como **admin (Sam)**:

1. `/studio/embarques`: aparece una casilla en cada fila. Un embarque con factura, gasto o aduana
   tiene la casilla gris y, debajo, «No se puede eliminar: tiene …». Uno entregado dice «ya se
   entregó».
2. Elige 2 embarques de prueba (o la casilla del cliente) → barra «2 embarques seleccionados» →
   «Eliminar…». El diálogo nombra los 2 códigos y la consecuencia, y el foco queda en Cancelar.
   Cancelar → no cambia nada.
3. Repite, escribe un motivo («Embarques de prueba») → «Eliminar embarques» → un solo aviso «2
   embarques eliminados…». Los 2 desaparecen de Embarques y de la barra de Tracking.
   **Falla si** desaparece uno solo, si sale más de un aviso o si se borró uno bloqueado.
4. Administración › Auditoría: 2 eventos `shipment_deleted`, con Sam como actor y el motivo.
5. `/studio/cn`: elige una recepción de prueba → «Eliminar…» → el diálogo dice cuántas cajas se
   retiran → confirmar → un aviso y la recepción sale de la tabla y de los KPIs. Elige una
   consolidada: «Eliminar…» queda gris con «está consolidada en un embarque…».
6. Abre una recepción con `?lang=cn`: la barra dice «删除…» y el diálogo está en chino.

Con un usuario **no admin** (por ejemplo, operaciones):

7. En `/studio/embarques` no hay casillas; en `/studio/cn` la barra no tiene «Eliminar…»; en el
   detalle de Tracking no aparece «Eliminar envío».

### Otros

- **Cambios compartidos**: `lib/studio/rbac.ts` (dos capabilities), `lib/i18n/*` (claves nuevas),
  `rbac-actions-guard.test.ts` (totales 75/431), `route-auth.test.ts` (mock de
  `capabilityDenial`), `pantallas-muestran-la-denegacion.test.tsx` y la 0416.
- **Impacto documental**: la spec 0522 (nueva) y este handoff. No se actualizó
  `docs/legal/privacidad/mapa-de-borrado.md`: el borrado no cambia qué datos se conservan (P2,
  todo se conserva). Proponer una fila para embarques y recepciones queda a decisión del Director.
- **Conocimiento**: Graphify y Archify no se reconstruyeron en el worktree (NO DISPONIBLE, ver
  VALIDACIÓN); la publicación desde main la hace el Director.
- **Ownership**: claim liberado al cerrar; worktree y rama se conservan.
