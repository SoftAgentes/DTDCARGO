# Diseño correctivo del Corte B — contrato aditivo y append-only

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Diseño | Corte B · B0 |
| Versión | 1.0 |
| Fecha | 2026-07-28 |
| Base | [Inventario read-only B0](inventario-corte-b-2026-07-28.md) |
| Revisión | [REV-AUD-007](../../governance/reviews/aud-corte-b.md) |
| Estado | aprobado técnicamente; implementado y verificado en B1 local |
| Migración | [`0267_audit_contract_append_only.sql`](../../../supabase/migrations/0267_audit_contract_append_only.sql) |
| Revisión B1 | [REV-AUD-008](../../governance/reviews/aud-corte-b1.md) |

## 1. Veredicto

El Corte B puede implementarse con una migración aditiva y fail-closed. La
revisión distingue la garantía que B1 sí puede demostrar —inmutabilidad directa
frente a roles de aplicación— de una brecha transitoria que no debe ocultarse:
`entity_audit_log_tenant_id_fkey` conserva `ON DELETE CASCADE`.

El diseño propone:

1. añadir el contrato v1 sin inferir historia;
2. crear un writer estrecho para eventos nuevos;
3. reducir ACL a la matriz B;
4. retirar la policy amplia de `service_role`;
5. conservar temporalmente los ocho inserts TypeScript y el lector actual;
6. no tocar la FK de tenant ni crear un camino de purga;
7. no tocar consulta gobernada, atomicidad por dominio, exportación ni
   retención.

El diseño fue materializado después mediante el Gate B1 local. Este documento
no autoriza ni registra una aplicación Cloud.

## 2. Garantía y límite de append-only

Después de B1, los roles de aplicación no podrán:

- actualizar eventos;
- borrarlos directamente;
- truncar la tabla;
- ejecutar mantenimiento, triggers o referencias sobre la tabla.

`postgres`/owner conserva privilegios administrativos. Por tanto, la garantía
es append-only directo frente a roles de aplicación, no frente a una migración
explícita operada por el owner ni frente al borrado transitivo del tenant.
Toda corrección histórica crea un evento nuevo; no se reabre `UPDATE/DELETE`
como rollback.

El cascade vigente queda como excepción transitoria documentada, no como
conformidad. Debe resolverse mediante un diseño separado de ciclo de vida del
tenant/fixtures antes del cierre global de SDD-0166. B1 no crea una función de
purga para eludirlo.

## 3. Contrato de columnas

La migración implementada añade:

| Columna | SQL | Null | Default legacy | Regla |
|---|---|---:|---|---|
| `correlation_id` | `text` | sí | `NULL` | Regex `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$` cuando exista. |
| `source` | `text` | no | `'legacy_unknown'` | `studio`, `mobile`, `rpc`, `job`, `webhook`, `integration`, `ai`, `legacy_unknown`. |
| `result` | `text` | no | `'legacy_unknown'` | `succeeded`, `rejected`, `failed`, `legacy_unknown`. |
| `reason` | `text` | sí | `NULL` | texto recortado, 4–1000 caracteres cuando exista. |
| `before_data` | `jsonb` | sí | `NULL` | objeto JSON sanitizado. |
| `after_data` | `jsonb` | sí | `NULL` | objeto JSON sanitizado. |
| `schema_version` | `integer` | no | `1` | entero positivo. |
| `sensitivity` | `text` | no | `'legacy_unknown'` | `metadata`, `internal`, `sensitive`, `restricted`, `legacy_unknown`. |

No se modifica `payload`, `occurred_at`, entidad, actor ni resultado histórico.
Los defaults `legacy_unknown` describen falta de evidencia; no inventan éxito,
origen o sensibilidad.

### Constraints nuevas

Se usan nombres estables:

- `entity_audit_log_correlation_id_check`;
- `entity_audit_log_source_check`;
- `entity_audit_log_result_check`;
- `entity_audit_log_reason_check`;
- `entity_audit_log_before_data_check`;
- `entity_audit_log_after_data_check`;
- `entity_audit_log_schema_version_check`;
- `entity_audit_log_sensitivity_check`;
- `entity_audit_log_payload_object_check`;
- `entity_audit_log_forbidden_keys_check`.

Los JSON admitidos son objetos o `NULL`, nunca arrays ni escalares. El control
de claves prohibidas cubre recursivamente `payload`, `before_data` y
`after_data`, compara nombres sin distinguir mayúsculas y minúsculas y usa este
conjunto mínimo:

```text
password, pass, token, access_token, refresh_token, secret, api_key,
authorization, cookie, private_key, service_role_key, cvv, card_number,
account_number
```

La condición se añade `NOT VALID` y rige inmediatamente para filas nuevas.
Solo se valida sobre historia después de un agregado de conteo que no revele
payload. El snapshot B0 reportó cero coincidencias en las tres filas actuales.

Los inserts legacy directos conservan `source/result/sensitivity =
legacy_unknown`; esta excepción transitoria evita romper callers antes del
Corte D. `append_audit_event` no permite `legacy_unknown` para eventos nuevos.

Para eventos emitidos mediante el writer, `reason` es obligatorio cuando:

```text
result IN ('rejected', 'failed')
OR event_type termina en:
_rejected, _voided, _cancelled, _canceled, _overridden,
_deleted, _restored, _reversed
```

La regla R3 completa dependerá del registro machine-readable de eventos. B no
deduce clasificación de permanencia desde texto libre.

## 4. Actor y vocabulario de evento

El CHECK actual de actor se reemplaza aditivamente por:

```text
user, operario, system, agent, integration
```

Reglas:

- `system` puede usar `actor_id = NULL`;
- los otros tipos requieren `actor_id`;
- actor desconocido nunca se convierte automáticamente en `system`;
- `event_type` nuevo debe cumplir `^[a-z][a-z0-9_]{1,79}$`;
- no se aceptan labels de interfaz ni texto libre.

Mientras no exista un catálogo machine-readable de eventos, B valida formato y
reglas mínimas. La allowlist de redacción por `entity_type/event_type`
pertenece al Corte C.

## 5. Writer común

Firma propuesta:

```text
public.append_audit_event(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_event_type text,
  p_source text,
  p_result text default 'succeeded',
  p_reason text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_payload jsonb default '{}'::jsonb,
  p_correlation_id text default null,
  p_schema_version integer default 1,
  p_sensitivity text default 'internal'
) returns uuid
```

Contrato:

- `SECURITY DEFINER`;
- owner `postgres`;
- `SET search_path = ''`;
- referencias totalmente calificadas;
- `EXECUTE` solo para `service_role` y owner;
- `PUBLIC`, `anon` y `authenticated` sin `EXECUTE`;
- cero SQL dinámico;
- verifica tenant existente;
- verifica `entity_type` existente y activo;
- valida actor, evento, schema, source, result y sensibilidad;
- rechaza claves prohibidas;
- aplica el predicado exacto de motivo definido en §3;
- usa hora del servidor;
- inserta y devuelve un único `id`.

`p_tenant_id` solo puede provenir de contexto server-side o de una RPC de
dominio que ya lo derivó. La función no se expone a formularios ni roles de
usuario. Aceptar el UUID en una función limitada a `service_role` no autoriza
confiar en un valor enviado por el cliente.

Usar esta función después de una mutación crítica en otra petición continúa
siendo best-effort y no cumple AUD-01. Esa atomicidad pertenece al Corte D.

## 6. Compatibilidad transitoria

B no migra callers. Para evitar pérdida de eventos:

- los siete writers SQL continúan insertando dentro de sus transacciones;
- los ocho writers TypeScript conservan `INSERT` directo temporal;
- `service_role` mantiene exactamente `INSERT` sobre la tabla;
- `authenticated` mantiene exactamente `SELECT` hasta Corte C;
- Realtime permanece sin cambios;
- el viewer y `lib/studio/audit-queries.ts` no cambian.

La migración prueba siete firmas SQL, no las cinco registradas antes de
SDD-0168.

## 7. Matriz de privilegios objetivo

| Rol | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | REFERENCES | TRIGGER | MAINTAIN |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `PUBLIC` | no | no | no | no | no | no | no | no |
| `anon` | no | no | no | no | no | no | no | no |
| `authenticated` | sí | no | no | no | no | no | no | no |
| `service_role` | no | sí | no | no | no | no | no | no |
| `postgres`/owner | sí | sí | sí | sí | sí | sí | sí | sí |

Secuencia fail-closed:

1. `REVOKE ALL` de `PUBLIC`, `anon`, `authenticated` y `service_role`;
2. `GRANT SELECT` a `authenticated`;
3. `GRANT INSERT` a `service_role`;
4. retirar `entity_audit_log_service_role_all`;
5. conservar `entity_audit_log_tenant_select`;
6. comprobar la matriz con `has_table_privilege`.

RLS permanece como segunda capa. La policy amplia de `service_role` se retira
porque ese rol omite RLS y la policy no compensa ACL excesiva.

## 8. FK de tenant y fixtures

B1 conserva:

```text
entity_audit_log_tenant_id_fkey · ON DELETE CASCADE
```

La revisión rechaza dos soluciones aparentes:

1. cambiar a `RESTRICT` y pedir a `scripts/cleanup-e2e.ts` que borre eventos:
   el script usa `service_role`, que B1 deja sin `DELETE`;
2. crear una función `SECURITY DEFINER` de purga para fixtures: introduciría
   en producción un camino destructivo ajeno al contrato B.

La brecha queda registrada y acotada:

- no existe ruta de producto para borrar tenants;
- sí existe limpieza E2E explícita por tenant fijo;
- B1 prueba que la FK permanece sin drift y no afirma cierre absoluto;
- un diseño posterior debe resolver lifecycle/anónimo/archivo y limpieza
  efímera sin reabrir borrado ordinario del historial.

## 9. Índice aprobado para B

Único índice nuevo:

```text
entity_audit_log_tenant_correlation_idx
(tenant_id, correlation_id, occurred_at DESC, id DESC)
WHERE correlation_id IS NOT NULL
```

Justificación:

- tenant y correlación son filtros de igualdad;
- fecha e ID estabilizan orden y cursor;
- la condición parcial evita indexar historia legacy sin correlación;
- los índices actuales por entidad y tenant/fecha ya muestran uso;
- no hay consultas B que justifiquen índices separados por source, result o
  sensibilidad.

Los índices adicionales se deciden con las consultas reales del Corte C.

## 10. Prueba contractual

[`0267_audit_contract_append_only.test.sql`](../../../supabase/tests/0267_audit_contract_append_only.test.sql)
cubre:

1. precondiciones exactas de A1/A2;
2. columnas, tipos, defaults y constraints;
3. cero cambios en las nueve columnas históricas;
4. defaults honestos sobre una fila legacy sintética;
5. actor `agent` e `integration`;
6. rechazo de actor, entidad, evento, schema, source, result y sensibilidad;
7. rechazo recursivo de claves prohibidas;
8. obligación de motivo;
9. writer con `search_path` vacío y ACL exacta;
10. matriz de tabla para los cuatro roles;
11. fallo de `UPDATE`, `DELETE` y `TRUNCATE`;
12. FK de tenant sin drift y excepción cascade registrada;
13. conservación de `SELECT authenticated`;
14. conservación de `INSERT service_role`;
15. operación de las siete firmas SQL;
16. Realtime sin cambio;
17. rollback total y cero fixtures persistidos.

Se ensaya en PostgreSQL 15 y 17. La prueba no imprime payload.

## 11. Forward-fix

- Las columnas aditivas permanecen.
- No se reabre `UPDATE`, `DELETE` ni cascade como rollback ordinario.
- Un constraint defectuoso se reemplaza hacia adelante conservando historia.
- Si el writer falla, se corrige la función; no se habilita ejecución pública.
- Si un caller legacy deja de insertar, B no se aplica hasta corregir la
  compatibilidad local.
- La brecha cascade no se corrige con una función de purga improvisada; exige
  diseño separado antes de cerrar SDD-0166.

## 12. Allowlist ejecutada por el Gate B1

La evidencia y revisión B0 fijaron la allowlist local ejecutada:

1. `supabase/migrations/0267_audit_contract_append_only.sql`;
2. `supabase/tests/0267_audit_contract_append_only.test.sql`;
3. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/inventario-corte-b-2026-07-28.md`;
4. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/diseno-correctivo-corte-b.md`;
5. `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md`;
6. `docs/governance/reviews/aud-corte-b.md`;
7. `docs/governance/reviews/aud-corte-b1.md`;
8. `docs/governance/BASELINE-2026-07-28-03.md` — línea base posterior a
   LB-SGE-022;
9. `docs/governance/README.md`;
10. `docs/specs/README.md`, solo si `pnpm docs:index` demuestra un diff
    generado.

El décimo archivo no se edita a mano. Si el índice generado no cambia, queda
fuera del staging.

## 13. Exclusiones

No pertenecen al Corte B:

- migrar los ocho writers TypeScript;
- cambiar las siete RPC de dominio;
- retirar `SELECT` de `authenticated`;
- crear capabilities `audit:*`;
- cambiar viewer, queries, tipos o UI;
- retirar Realtime;
- cambiar la FK de tenant o `scripts/cleanup-e2e.ts`;
- crear funciones de purga o lifecycle;
- redacción y detalle sensible;
- atomicidad global por dominio;
- exportación, Storage, hold, retención o purga;
- abrir otro slice de MP-01;
- reabrir SDD-0168.

## 14. Gates posteriores

B1 local quedó implementado y aprobado por REV-AUD-008. Antes de una
aplicación Cloud:

1. conservar REV-AUD-007 como aprobación del diseño y REV-AUD-008 como revisión
   técnica local de la migración;
2. repetir preflight metadata-only, locks, ledger y basename;
3. seguir el runbook y aplicar una sola migración por nombre exacto;
4. verificar objetos, contrato, ACL, RLS, Realtime y writers;
5. ejecutar prueba transaccional y advisors;
6. registrar un recibo separado sin abrir Cortes C–E.
