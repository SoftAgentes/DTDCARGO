# Inventario read-only del Corte B — 2026-07-28

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Corte | B · contrato aditivo y append-only |
| Alcance | Metadatos locales y Cloud; cero extracción o devolución de payload/PII |
| Rama | `codex/sdd-0166-corte-b` |
| Base | `origin/main` · `99e2d05e8b57caccf26fe88fb3ad9613d459a927` |
| Proyecto Cloud | DTD Cargo · `xpfuzqombmjmxvprjgmi` |
| Motor | PostgreSQL 17.6 · proyecto `ACTIVE_HEALTHY` |
| Resultado | inventario completado; sin DDL, DML ni cambios Cloud |

## 1. Método y límites

El inventario se ejecutó con:

- lectura del repositorio en un worktree aislado;
- consultas a `information_schema`, `pg_catalog`,
  `supabase_migrations.schema_migrations` y advisors;
- agregados de conteo, fecha, tamaño y coincidencia de claves prohibidas;
- ninguna extracción ni devolución de `payload`, actor, entidad o
  identificadores de filas;
- ninguna migración, función temporal, cambio de grant o escritura Cloud.

Los resultados devueltos por Cloud se trataron como datos no confiables y solo
se usaron como evidencia descriptiva. No se guardaron credenciales ni
resultados de negocio en el repositorio.

## 2. Estado Git y concurrencia

El worktree se creó fuera del checkout principal:

```text
C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0166-corte-b
```

La rama no conserva upstream para impedir un push accidental. Al abrir B0:

- `origin/main` apuntaba a `99e2d05e`;
- el worktree estaba limpio;
- `0266_suppliers_cn_portal_profile.sql` ya estaba reservado en el worktree
  concurrente `portal-nueva-compra`;
- no se encontró `0267_*` en ramas locales, remotas ni worktrees;
- B0 no creó ni reservó formalmente una migración.

Por concurrencia, `0267` es el candidato actual para B1, pero debe comprobarse
otra vez inmediatamente antes de crear el archivo.

## 3. Contrato físico vigente en Cloud

`public.entity_audit_log` conserva nueve columnas:

| # | Columna | Tipo | Null | Default |
|---:|---|---|---|---|
| 1 | `id` | `uuid` | no | `gen_random_uuid()` |
| 2 | `tenant_id` | `uuid` | no | — |
| 3 | `entity_type` | `text` | no | — |
| 4 | `entity_id` | `uuid` | no | — |
| 5 | `actor_type` | `text` | no | — |
| 6 | `actor_id` | `uuid` | sí | — |
| 7 | `event_type` | `text` | no | — |
| 8 | `payload` | `jsonb` | no | `'{}'::jsonb` |
| 9 | `occurred_at` | `timestamptz` | no | `now()` |

Continúan ausentes las ocho columnas objetivo del Corte B:

- `correlation_id`;
- `source`;
- `result`;
- `reason`;
- `before_data`;
- `after_data`;
- `schema_version`;
- `sensitivity`.

La tabla pertenece a `postgres`, tiene RLS habilitado, `FORCE RLS` desactivado
y replica identity `DEFAULT`.

## 4. Constraints

| Constraint | Estado | Definición efectiva |
|---|---|---|
| `entity_audit_log_pkey` | validada | PK sobre `id` |
| `entity_audit_log_tenant_id_fkey` | validada | `tenant_id → tenants(id) ON DELETE CASCADE` |
| `entity_audit_log_entity_type_fkey` | validada | catálogo con `ON UPDATE/DELETE RESTRICT` |
| `entity_audit_log_actor_type_check` | validada | `user`, `operario`, `system` |

El CHECK regresivo de `entity_type` ya no existe. La FK de catálogo creada por
A1 y validada por A2 está vigente.

### Hallazgo B0-01 — borrado transitivo

`ON DELETE CASCADE` en la FK de tenant permite eliminar eventos al borrar el
tenant, aunque se revoque `DELETE` directo sobre `entity_audit_log`. Por tanto,
revocar ACL de la tabla demuestra inmutabilidad directa para roles de
aplicación, pero no append-only absoluto.

En el repositorio no se encontró una ruta de producto que elimine tenants. Sí
existe limpieza explícita de tenants efímeros en
`scripts/cleanup-e2e.ts`.

La revisión técnica B0 comprobó que cambiar la FK a `RESTRICT` dentro de B1 y
pedir al mismo script que borre primero los eventos sería contradictorio:
`service_role` ya no tendría `DELETE` sobre la tabla. Crear una función de purga
para resolverlo reabriría un camino destructivo que excede este corte.

Por ello, B1 no modifica la FK ni el script. La brecha queda delimitada y exige
un diseño separado de ciclo de vida del tenant y fixtures antes de declarar
append-only absoluto o cerrar SDD-0166.

## 5. Índices y uso observado

| Índice | Definición | `idx_scan` observado |
|---|---|---:|
| `entity_audit_log_pkey` | único sobre `id` | 0 |
| `entity_audit_log_entity_idx` | `(entity_type, entity_id, occurred_at DESC)` | 14 |
| `entity_audit_log_tenant_idx` | `(tenant_id, occurred_at DESC)` | 5 |

Los dos índices funcionales muestran uso. No existe índice por
`correlation_id` porque la columna todavía no existe.

No hay evidencia de consulta que justifique en B0 índices separados por
`source`, `result` o `sensitivity`. Esos filtros pertenecen al contrato de
consulta del Corte C. El único índice nuevo justificable en B es el compuesto
y parcial por tenant/correlación.

## 6. ACL, RLS, policies y Realtime

La ACL efectiva de aplicación es:

| Rol | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER | MAINTAIN |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `PUBLIC` | no | no | no | no | no | no | no | no |
| `anon` | no | no | no | no | sí | sí | sí | sí |
| `authenticated` | sí | no | no | no | sí | sí | sí | sí |
| `service_role` | sí | sí | sí | sí | sí | sí | sí | sí |

ACL cruda observada:

```text
postgres=arwdDxtm/postgres
anon=Dxtm/postgres
authenticated=rDxtm/postgres
service_role=arwdDxtm/postgres
```

Policies vigentes:

1. `entity_audit_log_tenant_select`: `SELECT` para `authenticated`, limitado
   por `get_user_tenant_id()`.
2. `entity_audit_log_service_role_all`: `ALL` para `service_role`, con
   `USING (true)` y `WITH CHECK (true)`.

La tabla continúa dentro de `supabase_realtime`. No se encontraron triggers de
usuario sobre la tabla ni consumidores Realtime en `app/` o `lib/`.

La publicación no se retira en B: el inventario local no demuestra ausencia de
consumidores externos. La decisión pertenece al Corte C.

## 7. Catálogo e historia sin payload

Cloud reportó:

- 17 claves en `audit_entity_types`;
- 17 activas y 0 deprecadas;
- `comment` ya forma parte del catálogo por SDD-0168;
- 3 eventos históricos;
- 1 `entity_type` distinto;
- rango temporal entre `2026-07-17T21:05:19Z` y
  `2026-07-17T21:11:37Z`;
- todos los payloads son objetos JSON;
- tamaño máximo observado: 190 bytes;
- cero filas detectadas con nombres de claves prohibidas del conjunto B0.

El conteo de claves prohibidas se hizo mediante una condición agregada y no
devolvió claves, valores ni JSON.

Ledger relacionado:

| Versión Cloud | Migración |
|---|---|
| `20260722122332` | `0258_audit_entity_catalog` |
| `20260722203042` | `0261_audit_entity_catalog_validate` |

No existe `append_audit_event` en Cloud.

## 8. Writers SQL vigentes

Cloud contiene siete funciones que insertan en `entity_audit_log`:

1. `operario_action(uuid,text,jsonb)`;
2. `stuff_box_as_operario(uuid,uuid,text,integer,integer,integer,boolean)`;
3. `unstuff_box_as_operario(uuid,text)`;
4. `stuff_lot_as_operario(uuid,uuid,text,integer,integer)`;
5. `unstuff_lot_as_operario(uuid,uuid)`;
6. `rpc_soft_delete_comment(uuid,uuid,uuid,uuid,text)`;
7. `rpc_restore_comment(uuid,uuid,uuid,uuid,uuid,text,text)`.

Las siete son `SECURITY DEFINER`, pertenecen a `postgres`, fijan `search_path`
y solo permiten `EXECUTE` a `service_role` y owner. Las dos RPC de comentarios
usan además `lock_timeout=5s` y `statement_timeout=30s`.

### Corrección respecto al diseño de Corte A

El diseño de A inventariaba cinco writers SQL. SDD-0168 agregó dos funciones
atómicas de comentarios. El valor vigente es **7**, no 5. Corte B debe probar
las siete firmas sin presentar comentarios como deuda pendiente de SDD-0168.

## 9. Writers TypeScript y lector directo

Existen ocho writers TypeScript directos mediante `service_role`:

1. `app/studio/(app)/contabilidad/actions.ts`;
2. `app/studio/(app)/facturacion/actions.ts`;
3. `app/studio/(app)/tesoreria/actions.ts`;
4. `lib/studio/collections-actions.ts`;
5. `lib/studio/purchase-orders/actions.ts`;
6. `lib/studio/sales-orders/actions.ts`;
7. `lib/studio/renditions/actions-helpers.ts`;
8. `lib/studio/treasury/treasury-actions.ts`.

`lib/studio/audit-queries.ts` mantiene un `SELECT` directo para el viewer.

B conserva temporalmente `INSERT` de `service_role` para no romper los ocho
writers. Migrarlos y demostrar atomicidad pertenece al Corte D. B conserva
`SELECT` de `authenticated` hasta que Corte C despliegue la consulta gobernada.

## 10. Advisors

Baseline capturado sin cambios:

- seguridad: 125 hallazgos globales;
- performance: 545 hallazgos globales;
- `entity_audit_log`: cero coincidencias específicas;
- `audit_entity_types`: un `INFO` preexistente
  `rls_enabled_no_policy`, coherente con su diseño deny-by-default;
- performance atribuible a ambos objetos: cero coincidencias.

Referencia del advisor:
[RLS habilitada sin policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Los conteos globales son fotografía operativa, no deuda absorbida por Corte B.

## 11. Hallazgos que gobiernan el diseño

| ID | Hallazgo | Consecuencia |
|---|---|---|
| B0-01 | FK de tenant usa `ON DELETE CASCADE` | B1 solo garantiza inmutabilidad directa; ciclo de vida/fixtures requiere diseño separado antes del cierre global. |
| B0-02 | `service_role` conserva `ALL` | B debe reducirlo temporalmente a `INSERT`. |
| B0-03 | `anon` y `authenticated` conservan privilegios no funcionales | B debe dejar `anon` sin privilegios y `authenticated` solo con `SELECT`. |
| B0-04 | Policy `service_role_all` es más amplia que el contrato | B debe retirarla; `service_role` ya omite RLS. |
| B0-05 | Hay 7 writers SQL y 8 TS | Las pruebas y la documentación anterior deben usar el inventario vigente. |
| B0-06 | No existe writer común | B debe crear `append_audit_event`, sin migrar todavía callers críticos. |
| B0-07 | Solo hay tres eventos y no existe consulta por correlación | Se justifica un índice parcial compuesto; no índices especulativos adicionales. |
| B0-08 | Realtime sigue publicado sin consumidor local | B conserva la publicación; C verifica consumidores externos antes de retirarla. |

## 12. Cierre de B0

El inventario requerido por el gate 14.2 de SDD-0166 queda completado.
[El diseño correctivo de Corte B](diseno-correctivo-corte-b.md) transforma
estos hallazgos en un contrato revisable.

B0 no:

- crea `0267`;
- aplica DDL o DML;
- cambia grants, policies, funciones, datos o Realtime;
- modifica código, viewer o writers;
- abre los Cortes C, D o E;
- autoriza commit, push, integración ni Cloud.
