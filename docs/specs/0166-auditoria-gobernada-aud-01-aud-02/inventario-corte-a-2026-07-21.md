# Inventario read-only del Corte A

| Control | Valor |
|---|---|
| SDD | [SDD-0166](spec.md) |
| Corte | A · inventario previo a cualquier reparación de catálogo |
| Fecha | 2026-07-21 |
| Alcance ejecutado | Repositorio, preflight local y snapshot Cloud autorizado |
| Resultado | Inventario read-only completado |
| Escrituras ejecutadas | Ninguna |
| Cloud / producción | Metadatos y tipos distintos; sin payload ni PII |

## 1. Veredicto ejecutivo

El inventario estático del repositorio quedó completo. El inventario efectivo de
una base local **no puede ejecutarse** porque DTD Cargo no tiene una instancia
Supabase local por diseño: el repositorio declara que el entorno local usa el
proyecto Cloud `xpfuzqombmjmxvprjgmi` y prohíbe `supabase start`.

El único contenedor activo corresponde a `ERP_HAMUDI`, tiene un historial de
migraciones distinto y no contiene `public.entity_audit_log`. Existe además un
contenedor detenido de `hailuway-erp`; sus etiquetas Docker confirman que también
pertenece a otro proyecto.

No se usó `public.audit_log` como sustituto: es otro objeto y asumir equivalencia
mezclaría dos sistemas. Tampoco se inició una base nueva, se aplicaron
migraciones, se ejecutaron seeds ni se consultaron payloads o datos personales.

Con autorización explícita del founder se completó después el snapshot efectivo
en el proyecto Cloud **DTD Cargo**. Solo se consultaron catálogos PostgreSQL,
ledger de migraciones y valores distintos de `entity_type`/`actor_type`.

## 2. Método y límites

Se ejecutaron únicamente:

- búsquedas estáticas con `rg` y lectura de archivos versionados;
- inspección read-only de Docker y versión de Supabase CLI;
- consultas a catálogos locales dentro de `BEGIN READ ONLY`;
- comprobación de existencia de tabla e identidad del ledger de migraciones.
- consultas SQL SELECT dirigidas al project ref DTD mediante el conector
  autenticado de Supabase.

No se ejecutó ningún `INSERT`, `UPDATE`, `DELETE`, DDL, reset, seed, start,
push o deploy. En Cloud no se leyeron payloads, IDs de entidades/actores,
tenants, nombres, correos ni otros datos de negocio.

## 3. Inventario declarado por el repositorio

### 3.1 Tabla y columnas

La migración `0066_foundation_v3.sql` declara nueve columnas:

| Columna | Tipo declarado | Regla inicial |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `tenant_id` | `uuid` | NOT NULL, FK a `tenants`, cascade |
| `entity_type` | `text` | NOT NULL, CHECK reemplazable |
| `entity_id` | `uuid` | NOT NULL |
| `actor_type` | `text` | NOT NULL, `user/operario/system` |
| `actor_id` | `uuid` | nullable |
| `event_type` | `text` | NOT NULL |
| `payload` | `jsonb` | NOT NULL, default `{}` |
| `occurred_at` | `timestamptz` | NOT NULL, default `now()` |

La tabla no declara todavía `correlation_id`, `source`, `result`,
`schema_version`, `sensitivity`, `before` o `after` como campos gobernados.

### 3.2 Índices, RLS, policies, grants y Realtime

El estado **declarado** en migraciones es:

| Objeto | Definición del repositorio | Riesgo / observación |
|---|---|---|
| PK | `entity_audit_log_pkey (id)` | Base mínima. |
| Índice de entidad | `(entity_type, entity_id, occurred_at desc)` | Cubre historia por entidad. |
| Índice de tenant | `(tenant_id, occurred_at desc)` | Cubre recientes por tenant. |
| RLS | habilitada | No hay `FORCE ROW LEVEL SECURITY` declarado. |
| Policy SELECT | `authenticated`, tenant actual | No exige capability admin. |
| Policy ALL | `service_role`, `true/true` | Permite todas las operaciones. |
| Grant `authenticated` | `SELECT` | Expone tabla base a cualquier rol autenticado autorizado por RLS. |
| Grant `service_role` | `ALL` | No es append-only; permite UPDATE/DELETE. |
| Realtime | tabla añadida a `supabase_realtime` | Debe reevaluarse al retirar SELECT directo. |

No existen migraciones posteriores que revoquen o estrechen estos grants o
policies para `entity_audit_log`.

### 3.3 Evolución del catálogo de entidades

El CHECK fue sustituido repetidamente por una lista completa. La última
declaración está en `0241_estiba_por_zonas.sql` y permite 15 tipos:

```text
shipment
dispatch_order
dispatch_order_package
warehouse_receipt_cn
warehouse_receipt_ve
invoice
journal_entry
account
payment_receipt
supplier
supplier_bill
supplier_payment
purchase_order
sales_order
consolidation
```

Hallazgo bloqueante de catálogo: `0123_rendiciones.sql` añadió `rendition`, pero
`0124`, `0125` y finalmente `0241` reconstruyeron el CHECK sin conservarlo. El
writer de rendiciones sigue emitiendo `entity_type = 'rendition'`; por su
`try/catch` best-effort, el fallo puede perder el evento sin revertir la acción.

El repositorio no contiene todavía una tabla catálogo aditiva ni una FK desde
`entity_audit_log.entity_type`.

### 3.4 Writers SQL

Se localizaron 23 sitios históricos de `INSERT` en migraciones. Como varias
migraciones reemplazan la función completa, los writers SQL efectivos
declarados por el estado final del repositorio son cinco:

| Función | Última definición | Seguridad declarada | Relación con la mutación |
|---|---|---|---|
| `operario_action` | `0072` | `SECURITY DEFINER`, search path fijado, EXECUTE solo `service_role` | Evento dentro de la misma función/tx. |
| `stuff_box_as_operario` | `0241` | `SECURITY DEFINER`, search path fijado | Evento dentro de la misma función/tx; no hay GRANT explícito a `service_role` en esa migración. |
| `unstuff_box_as_operario` | `0241` | `SECURITY DEFINER`, search path fijado | Evento dentro de la misma función/tx; no hay GRANT explícito a `service_role` en esa migración. |
| `stuff_lot_as_operario` | `0246` | `SECURITY DEFINER`, EXECUTE solo `service_role` | Evento dentro de la misma función/tx. |
| `unstuff_lot_as_operario` | `0246` | `SECURITY DEFINER`, EXECUTE solo `service_role` | Evento dentro de la misma función/tx. |

La ausencia de un GRANT explícito en `0241` es una inconsistencia declarativa;
su ACL efectiva no puede confirmarse sin consultar la base correcta.

### 3.5 Writers TypeScript

Se localizaron ocho archivos que insertan directamente mediante un cliente
administrativo:

| Writer | Tipos principales | Modo de fallo |
|---|---|---|
| `app/studio/(app)/contabilidad/actions.ts` | `journal_entry`, `account` | best-effort; captura y registra error |
| `app/studio/(app)/facturacion/actions.ts` | `invoice` | best-effort; captura y registra error |
| `app/studio/(app)/tesoreria/actions.ts` | `supplier` | best-effort; captura y registra error |
| `lib/studio/collections-actions.ts` | `payment_receipt` | best-effort; captura y registra error |
| `lib/studio/purchase-orders/actions.ts` | `purchase_order` | best-effort; captura y registra error |
| `lib/studio/renditions/actions-helpers.ts` | `rendition` | best-effort; captura y registra error |
| `lib/studio/sales-orders/actions.ts` | `sales_order` | best-effort; captura y registra error |
| `lib/studio/treasury/treasury-actions.ts` | `supplier_bill`, `supplier_payment` | best-effort; captura y registra error |

Los ocho permiten que la mutación de negocio termine aunque falle el evento.
No cumplen la atomicidad exigida por AUD-01 para operaciones críticas.

### 3.6 Lectura actual

`lib/studio/audit-queries.ts` realiza SELECT directo sobre la tabla base, ordena
por `occurred_at` y limita a 100 por defecto / 500 máximo. Devuelve `payload`
completo. `AuditLogSection.tsx` filtra en cliente.

`lib/studio/audit-types.ts` solo humaniza seis entidades y convierte cualquier
`actor_type` desconocido en `system`, lo que puede falsificar autoría. No existe
RPC gobernada, cursor opaco, redacción por allowlist, capability, exportación,
hold o retención automatizada.

## 4. Preflight de bases locales

| Evidencia | Resultado |
|---|---|
| Supabase CLI | `2.108.0` |
| `supabase/config.toml` en este repo | No existe ni está versionado |
| Contenedor PostgreSQL activo | `supabase_db_ERP_HAMUDI` |
| Otro contenedor PostgreSQL | `supabase_db_hailuway-erp`, detenido y ajeno |
| PostgreSQL | `17.6`, base `postgres` |
| Migraciones del contenedor | 126 |
| Última migración local | `20260720125000 · supabase_security_hardening_v2_product_service_catalogs` |
| Coincidencias con migraciones DTD muestreadas | 0 |
| `public.entity_audit_log` | No existe |
| Otros objetos con “audit” | existe `public.audit_log`, no inspeccionado como sustituto |

El repositorio confirma además:

- `docs/marketing/servicios-infografias/videos/PROMPT-CODEX-VIDEOS.md`: “No hay
  base local”; `pnpm dev` apunta a producción;
- `.claude/commands/build.md` y `.claude/commands/forja.md`: prohíben
  `supabase start`, Docker local y `config.toml` para DTD.

Conclusión: no existe una instancia local elegible para probar SDD-0166.
Consultar las bases de otros proyectos no demostraría el estado de DTD Cargo.

## 5. Snapshot efectivo Cloud autorizado

### 5.1 Identidad

| Control | Resultado |
|---|---|
| Proyecto | `DTD Cargo` |
| Project ref | `xpfuzqombmjmxvprjgmi` |
| Estado | `ACTIVE_HEALTHY` |
| Región | `us-east-1` |
| PostgreSQL | `17.6.1.121` |

### 5.2 Tabla efectiva

La tabla tiene las mismas nueve columnas declaradas por 0066. Su estado
efectivo es:

| Control | Resultado Cloud |
|---|---|
| Owner | `postgres` |
| RLS | habilitada |
| FORCE RLS | no |
| Replica identity | default |
| Constraints | cuatro, validados: PK, FK tenant, CHECK actor y CHECK entidad |
| Índices | PK + entidad/historia + tenant/recientes |
| Policies | dos: tenant SELECT y service-role ALL |
| Triggers propios | ninguno |
| Realtime | incluida en `supabase_realtime` |

El CHECK efectivo permite los mismos 15 tipos de 0241 y **no contiene
`rendition`**. El CHECK de actor solo permite `user`, `operario` y `system`.

### 5.3 Privilegios efectivos

`has_table_privilege` confirmó:

| Rol | SELECT | INSERT | UPDATE | DELETE | TRUNCATE | TRIGGER / REFERENCES / MAINTAIN |
|---|---:|---:|---:|---:|---:|---:|
| `anon` | no | no | no | no | **sí** | **sí** |
| `authenticated` | **sí** | no | no | no | **sí** | **sí** |
| `service_role` | **sí** | **sí** | **sí** | **sí** | **sí** | **sí** |

`anon` y `authenticated` no tienen `BYPASSRLS`; `service_role` sí. La mera
existencia de un privilegio no demuestra una ruta explotable desde PostgREST,
pero `TRUNCATE`, `TRIGGER`, `REFERENCES` y `MAINTAIN` incumplen el mínimo
privilegio esperado para estos roles y deben entrar en la reparación.

### 5.4 Funciones

Cloud contiene las cinco funciones detectadas en el repo. Todas son
`SECURITY DEFINER`, tienen `search_path=public` y EXECUTE limitado a `postgres`
y `service_role`:

- `operario_action`;
- `stuff_box_as_operario`;
- `unstuff_box_as_operario`;
- `stuff_lot_as_operario`;
- `unstuff_lot_as_operario`.

Cloud sí registra EXECUTE de `service_role` para las dos funciones de 0241,
aunque esa concesión no aparece explícita en el archivo 0241 del repositorio.
Esto es drift declarativo y debe explicarse antes de escribir el forward-fix.

### 5.5 Tipos históricos distintos

Sin consultar payload, IDs ni cantidades, los únicos valores actualmente
presentes son:

| Dimensión | Valor |
|---|---|
| `entity_type` | `consolidation` |
| `actor_type` | `operario` |

La ausencia de `rendition` es consistente con el CHECK regresivo, pero no prueba
por sí sola cuántos eventos pudieron perderse.

### 5.6 Ledger relevante

Cloud confirma aplicadas 0066, el fix de tipo de 0072, 0123, 0241 y 0246. Por
tanto, la omisión de `rendition` no es una hipótesis basada solo en archivos: es
el constraint efectivo posterior a migraciones realmente aplicadas.

## 6. Matriz de cumplimiento del inventario

| Requisito del Corte A | Repo | Cloud DTD | Estado |
|---|---:|---:|---|
| Columnas | Sí | Sí | Completo |
| CHECKs | Sí | Sí | Completo |
| Policies / RLS | Sí, declaradas | Sí, efectivas | Completo |
| Grants / ACL | Sí, declarados | Sí, efectivos | Completo |
| Funciones writers | Sí | Sí | Completo |
| Índices | Sí, declarados | Sí, efectivos | Completo |
| Tipos distintos existentes | No aplica al código | Sí | Completo |
| Catálogo aditivo y FK | Ausente | Ausente | No implementado |
| Reparación de `rendition` | No ejecutada | No ejecutada | Fuera de autorización |

## 7. Hallazgos priorizados

1. **Catálogo regresivo:** `rendition` está en uso pero no en el CHECK final.
2. **Pérdida silenciosa:** ocho writers TypeScript son best-effort.
3. **Historia mutable:** `service_role` puede UPDATE, DELETE y TRUNCATE.
4. **Privilegios inesperados:** `anon` y `authenticated` pueden TRUNCATE y
   conservan TRIGGER, REFERENCES y MAINTAIN sobre el log.
5. **Lectura demasiado amplia:** `authenticated` conserva SELECT a la tabla y
   el viewer devuelve payload crudo.
6. **Drift de funciones:** Cloud concede EXECUTE a `service_role` para las
   funciones de 0241, pero el archivo no documenta esa concesión.
7. **Sin base local DTD:** futuras verificaciones requieren Cloud read-only o un
   entorno descartable autorizado y diseñado expresamente.

## 8. Gate de salida

El requisito de inventario previo del Corte A queda **completo**. Antes de crear
una migración correctiva todavía se requiere aprobar un diseño que:

- construya el catálogo como unión aditiva y preserve los 15 tipos permitidos,
  `rendition` y los valores históricos observados;
- retire privilegios sobrantes sin romper los cinco writers SQL ni los ocho
  consumidores TypeScript;
- explique el drift de ACL de 0241;
- incluya prueba de regresión para `rendition` y prueba negativa de UPDATE,
  DELETE y TRUNCATE por roles no autorizados.

Completar este gate **no autoriza** crear ni aplicar la migración correctiva.

## 9. Revalidación

El 2026-07-21 se repitió el inventario por solicitud del founder. Los resultados
del repositorio permanecieron estables: 18 migraciones con referencias, 23 sitios
SQL históricos, cinco funciones writer y ocho writers TypeScript directos. La
consulta del catálogo de `supabase_db_ERP_HAMUDI` volvió a ejecutarse dentro de
`BEGIN READ ONLY` y confirmó 126 migraciones ajenas, cero coincidencias en la
muestra DTD y ausencia de `public.entity_audit_log`.
