# SDD-0573 · dejar la 0497 aplicable en producción

Owner: `worker-0573-pines-28538d` · Rama: `claude/0573-0497-pines-prod-28538d` · Worktree: `.claude/worktrees/0573-0497-pines-prod-28538d` · Base: `6d022e94b` · Fecha: 2026-11-01

## OBJETIVO ORIGINAL

La lectura previa de `0497_reverso_al_anular_factura` paró en `next_entry_code`. Encargo: medir todo lo que exige el preflight, corregir los pines sin debilitar el candado, investigar los rojos de `sql-tests`, correr la lectura previa de 0496 y 0497 sobre la cabeza de la rama y proponer el ensayo en prueba. Sin aplicar ni escribir en producción y sin fusionar.

## COMPLETADO

### 1. Esperado contra vivo

Catálogo de producción, solo lectura (`default_transaction_read_only=on`), 2026-11-01 16:34Z. Sin filas de negocio. `sin espacios` es el md5 del `prosrc` sin espacios.

| Función | md5 esperado | md5 vivo | Largo | Resto de propiedades | Clase |
|---|---|---|---|---|---|
| `append_audit_event` | `cd315c07…5832` | igual | 488 | coinciden | igual |
| `append_audit_event_v1` | `4b123fd0…f4bf` | igual | 4579 | coinciden | igual |
| `audit_d2_financial_change` | `651ae102…a172` | igual | 11651 | coinciden | igual |
| `excepcion_al_cierre_vigente` | `f66b2bab…5860` | igual | 248 | coinciden | igual |
| `get_accounting_closing_date` | `7e5d5609…c5a5` | igual | 90 | coinciden | igual |
| `journal_entries_validate_closing` | `b62227b4…0c67` | igual | 1113 | coinciden | igual |
| `journal_entry_is_closed` | `8114d6c6…7208` | igual | 204 | coinciden | igual |
| `journal_lines_validate_closing` | `2f8faeb6…d53e` | igual | 954 | coinciden | igual |
| `void_invoice_with_audit_reason` | `76644e17…6138` | igual | 496 | coinciden | igual |
| `next_entry_code` | `6954cb3e…d524` | `06b5756a…b3bc` | 388 (0078: 393) | coinciden | **solo formato** |

Propiedades comparadas en cada una: dueño, `prokind`, `proretset`, `proisstrict`, `proleakproof`, `proparallel`, volatilidad, `prosecdef`, `provariadic`, `proallargtypes`, `proargmodes`, `proargnames`, `pronargdefaults`, retorno, `proconfig`, lenguaje y expresiones de defaults.

**Por qué `next_entry_code` es solo formato.** Sin espacios, los dos dan `30ce8b9d8606d79b2f20bc07f3a6ac73`. El `diff` muestra dos cambios: el `where` de dos líneas en una, y una línea en blanco menos. Es el mismo valor que ya aceptó la 0493 al aplicarse.

El resto del preflight, 38 comprobaciones, todas PASA:

| Grupo | Comprobaciones |
|---|---|
| Precondición | tablas y funciones nominales presentes; `reverses_entry_id` ausente |
| Restricciones | UNIQUE `(tenant_id, entry_code)` inmediata y no parcial; `journal_lines_entry_id_fkey` singular, CASCADE, no diferible, con sus 4 triggers RI; `journal_entries_invoice_id_fkey` SET NULL |
| Columnas | las 16, con tipo, typmod y `NOT NULL` |
| Relaciones | `relkind` y RLS de las cuatro tablas; dueño `postgres` |
| Triggers | `journal_entries_validate_closing_trg`, `journal_lines_validate_closing_trg`, `audit_d2_journal_entries`, `audit_d2_invoices`: tipo y `enabled=O` |
| ACL | `append_audit_event`: anon no, authenticated no, service_role sí; `append_audit_event_v1`: ninguno |
| Nombres libres | constraints, funciones `i3_*`, triggers, índice y constraints del reverso |

### 2. Corrección del pin

Se aceptan dos cuerpos exactos, solo para `next_entry_code`: el de la 0078, que reconstruyen las pruebas, y el vivo. Es más estricto que el md5 sin espacios de la 0492 y la 0493: un formato desconocido también aborta. Los pines de las otras nueve no cambian.

Controles en rojo, con PGlite:

| Control | Resultado esperado y obtenido |
|---|---|
| Cuerpo vivo con otra lógica (`+ 2`) | aborta el preflight |
| 0078 con otra lógica | aborta el preflight |
| Cuerpo vivo con un formato desconocido | aborta el preflight |
| Cambio de lógica durante la migración | aborta el postflight |
| md5 vivo en otra función | aborta el preflight |
| Contrato entero con el cuerpo vivo | verde |

Mutantes, todos muertos: sin la guarda de firma, sin el md5 vivo (la 0497 de main) y sin la comparación de cuerpo.

### 3. Defecto nuevo: la 0497 no se podía aplicar

Lo encontré leyendo lo que el preflight no mira. La 0497 creaba dos funciones con un parámetro propio en la cabecera. Medido en producción: `rolsuper=f`, `has_parameter_privilege('postgres','dtd.audit_reason','SET')=f`, `supautils.placeholders` vacío y ninguna función de `public` con un parámetro así.

Sonda en `dtd-cargo-staging-db-1` (misma imagen `supabase/postgres:17.6.1.136`, rol `postgres`, `rolsuper=f`), dentro de una transacción con rollback y sin aplicar ninguna migración:

```text
ERROR:  permission denied to set parameter "dtd.audit_reason"
```

La misma función sin ese parámetro se crea sin error. PGlite y `sql-tests` corren como superusuario, por eso nunca salió. El apply habría fallado con código 6, sin daño, pero después de pedir el OK de Sam.

**Corrección, en commit propio** (`cf7810fe5`). Es un cambio al mecanismo D2/M4, **autorizado por el Director el 2026-11-01; pendiente de que Sam lo vea en el OK nominal**. Queda registrado en D2/M4 de la spec. El Director descartó `GRANT SET ON PARAMETER`.

El motivo se vacía al entrar al bloque que escribe y se devuelve el valor exterior antes de salir, como en la 0421. La cabecera restauraba sola ante un error y el cuerpo no: ahí lo deshace la transacción o el subbloque que lo captura. Cada salida está probada con una sesión real, en PGlite:

| Salida | Lo que se comprueba |
|---|---|
| Éxito, en transacción y sin ella | vuelve el valor exterior. El testigo anota el motivo en cada escritura: vacío en líneas y cabecera, el del documento solo en el UPDATE de la factura |
| Retornos tempranos | `invoice_unavailable`, `invoice_not_postable`, `zero_total` y factura pagada: no tocan el valor exterior ni escriben |
| Excepción capturada con savepoint | con asiento y sin asiento con el motivo ya puesto, con asiento antes de ponerlo, y asiento de venta nuevo: el valor exterior intacto, factura sin cambios, sin reverso |
| Excepción sin capturar | sin transacción y en una que se deshace, con valor previo, con valor vacío y sin valor: no queda nada en la sesión y el rol vuelve a `postgres` |
| Colisión de código | el reintento conserva el motivo exacto y restaura el exterior |

**Retornos tempranos:** una prueba de estructura exige que cada `return` posterior al primer cambio del motivo venga justo después de la restauración. Todos los anteriores salen sin haberlo tocado. No encontré ningún camino que no restaure.

Ocho mutantes, con el pin recalculado para que no mueran por el pin: todos mueren por comportamiento o por esa estructura.

**Límite:** el `set_config('', true)` que sigue al UPDATE no tiene un testigo propio, porque después no hay otra escritura hasta salir. Esa línea ya existía antes de este cambio.

### 3b. La clase de fallo: 0496 y 0497 con el rol real

Encargo del Director: PGlite y `postgres:17` corren como superusuario y pueden esconder otros permisos. Medido en local con `supabase/postgres:17.6.1.136`, la imagen de producción, sin red. Rol `postgres`: `super=false`, `createrole=true`, `createdb=true`, `bypassrls=true`, sin SET sobre el parámetro. Las esperas 0422 y 0423 no se aplican, como en producción.

| Capa | Resultado |
|---|---|
| Reconstrucción como `postgres` hasta la 0495 | PASÓ, 469 migraciones en 16 s |
| **Control en rojo:** la 0497 de main | `psql:…:721: ERROR: permission denied to set parameter "dtd.audit_reason"`. El arnés detecta la clase |
| 0496: previa, apply, verificación del paquete real | PASÓ; apply 305 ms |
| `next_entry_code` con el cuerpo vivo | md5 `06b5756a18361fc4d85cec6f6dc4b3bc`, 388 caracteres |
| 0497: previa, apply, verificación del paquete real | PASÓ; apply 332 ms |
| Ledger después del apply | md5 `075eab7f…` y `fdac29d9…`, iguales a los blobs |
| Funciones con parámetro propio en la cabecera | 0 |
| Contrato 0496 en base nueva, como `postgres` | PASÓ, 102 aserciones |
| Contrato 0497 en base nueva, como `postgres` | PASÓ, 144 aserciones |

**No aparece ninguna otra falla de permisos:** ni triggers, ni `alter constraint`, ni GRANT, ni en las RPC al ejecutarse, que el contrato corre con los roles `authenticated` y `service_role`.

**Lo que esto no cubre:**

- Los tiempos son sobre tablas casi vacías, sin concurrencia.
- El CHECK del reverso corre sobre tablas vacías; con datos reales sigue NO VERIFICADO.
- **Las carreras no corren con el rol real:** su guarda exige que `anon`, `authenticated` y `service_role` no existan, y en esta imagen existen. Corren en `postgres:17` como superusuario.
- Las salidas con excepción se probaron en PGlite. Con el rol real corrió el contrato secuencial.
- Auth y Storage son los stubs del repo, no GoTrue ni storage-api.

### 4. Rojos de `sql-tests` que venían de antes

Medido en un contenedor `postgres:17` (17.11). Log anterior del 2026-10-29: `%TEMP%/sqltests2.log`.

| Contrato | Causa | Evidencia | Arreglo |
|---|---|---|---|
| `0497_reverso_al_anular_factura` | **rojo falso**: 1,3 MB de salida, el runner mata a psql | búfer grande: `status=0`, `GREEN: 144 aserciones`; runner: `status=null`, `ENOBUFS` | runner con `maxBuffer` de 64 MiB |
| `0497_reverso_al_anular_factura_carrera` | **rojo falso**, igual; la línea con `ERROR:` era texto de la evidencia | búfer grande: `status=0`, `244 aserciones`; runner: `ENOBUFS` | igual |
| `0467_reversion_credito_carrera` | **rojo real del fixture**: carga la 0497 sin la 0493 | `:875: ERROR: 0497: preflight … excepcion_al_cierre_vigente(uuid) no coincide` | el fixture carga la 0493 como el contrato de la 0497 |

No cambié ninguna aserción. Control: con estos contratos, el runner de main reproduce los dos rojos falsos y el de esta rama da 4 de 4 en verde. Si el runner corta a psql, ahora lo dice en vez de un rojo mudo. Esto también destraba el paso `sql-tests` de `pnpm verify` en main.

### 5. Locks y tiempo de la 0497

Medido con `pg_locks` sobre el fixture (PGlite, sin concurrencia), en una transacción que se deshace:

| Tabla | Lock más fuerte | Por qué |
|---|---|---|
| `journal_entries` | `AccessExclusiveLock` | columna nueva, CHECK; también `ShareLock` del índice y `ShareRowExclusiveLock` de FK y triggers |
| `journal_lines` | `AccessExclusiveLock` | FK a diferible; `ShareRowExclusiveLock` del trigger |
| `invoices` | `ShareRowExclusiveLock` | triggers |
| `accounts` | `AccessShareLock` | lectura del preflight |

Se sostienen hasta el COMMIT, porque todo va en una transacción. Tamaño en producción: `journal_entries` 204.800 bytes, `journal_lines` 65.536 bytes, `invoices` 90.112 bytes. Tiempo sobre el fixture: 56 ms. **Tiempo esperado en producción: menos de 1 s. Es una estimación, no una medida:** se mide en el ensayo. `lock_timeout` de 5 s y `statement_timeout` de 30 s: si una sesión bloquea, aborta sin cambiar nada.

**NO VERIFICADO.** El CHECK `journal_entries_reverso_coherente` valida las filas actuales: abortaría si ya hubiera una fila con `source='invoice_reversal'`. No lo medí porque el encargo es sin filas de negocio. Si pasa, aborta sin daño. Se puede medir con un conteo, con OK.

**Hora: sí conviene una de poco tráfico, por la ventana y no por los locks.** Entre el apply y la web nueva, la web vieja (`929cabf51`) no puede asentar ventas: inserta la cabecera primero, la guarda responde 23514 (contrato I3B05) y la web solo lo escribe en el log, así que **la factura queda emitida sin asiento**. Mientras la 0497 no entre junto con la web nueva, nadie debería emitir facturas. M8 ya lo prevé: «pueda degradar posting legado». La anulación vieja sí sigue andando, y ahora crea el reverso.

### 6. Pantallas a revisar después de aplicar

Con rol contabilidad o admin, salvo donde se indica:

1. **Facturación → emitir** una factura: asiento de venta creado por la RPC nueva. Esto solo es válido con la web nueva.
2. **Facturación → anular**: sin cobro, queda anulada con reverso; con cobro vivo, rechazo con el mensaje de Cobranzas.
3. **Contabilidad → Libro diario**: el reverso se ve con su vínculo; un asiento automático no se edita ni se anula; un asiento manual sigue funcionando, incluido el período cerrado con superclave.
4. **Cobranzas**: registrar y anular un cobro de una factura con asiento.
5. **Reportes → libro de control** e ingresos del período: la factura anulada y su reverso cuadran.
6. **Rol comercial**: anular una factura se niega.

## VALIDACIÓN

| Comprobación | Estado | Detalle |
|---|---|---|
| Prueba de contrato (`reverso-al-anular-factura.migration.test.ts`, PGlite) | PASÓ | 79 de 79 |
| Aplicación completa con el rol real | PASÓ | §3b |
| Contratos reales en `postgres:17`, runner de esta rama | PASÓ | 4 de 4 |
| `run-sql-tests-salida.node.mjs` en Linux (`node:24`) | PASÓ | 3 de 3; mutante sin `maxBuffer` muere. En Windows se salta: el doble de docker es un script de sh |
| `migrations-lock`, `docs:check`, `sdd:check`, símbolos pendientes | PASÓ | símbolos: 0 ROJO, 3 AMARILLO declarados |
| ESLint de los archivos tocados y `tsc --noEmit` del proyecto | PASÓ | exit 0 en los dos |
| `pnpm verify` | NO EJECUTADO | el Director lo da en un turno aparte |
| `run-sql-tests` completo (255 archivos) | NO EJECUTADO | va con ese turno |
| Ensayo en el entorno de prueba | NO EJECUTADO | el Director pidió la propuesta primero |
| Lectura previa 0496 y 0497 | PASÓ | abajo |

Lectura previa e identidad sobre `f80a0fce2a69acb1053376bf401825ae5097252d`, copiadas de la salida de `preparar.mjs`. El commit que agrega esta tabla solo toca este handoff, así que los blobs no cambian. La repetición sobre la cabeza final va en el informe al Director.

| Migración | Blob | Bytes | md5 del blob | md5 de `aplicar.sql` | Evidencia |
|---|---|---:|---|---|---|
| `0496_tarifa_congelada_por_embarque` (SDD-0571) | `0f424008e0b8` | 45610 | `075eab7fae8d9dfb2b06f88335087f8d` | `d3be5cbcdc4d1960e1306d2a9a6a4926` | `/srv/ops/evidencias/previa-0496-dtd-cargo-20261101T170923Z` |
| `0497_reverso_al_anular_factura` (SDD-0573) | `643a317d6531` | 78309 | `fdac29d9f107f14bd8aadda6b3742d80` | `4c7229645fc83f5632f170d7ebc617ae` | `/srv/ops/evidencias/previa-0497-dtd-cargo-20261101T170941Z` |

En la previa de la 0497: 0 sesiones esperando locks, 0 transacciones largas; 13 funciones `nueva` y `void_invoice_with_audit_reason` `igual` a la 0294.

## COMMITS

`3d7c681dc` pines · `cf7810fe5` motivo sin SET en la cabecera · `8fa1c3dc8` rojos de `sql-tests` · `f80a0fce2` y `3a5c47cca` huellas, spec y handoff · más los de las pruebas por salida y el registro en D2/M4.

## PR / BRANCH

Rama propia, PR en borrador contra `main`. Sin fusionar.

## PENDIENTES DE ESTA TAREA

- Que Sam vea el cambio de mecanismo D2/M4 al pedirle el OK nominal.
- Turno para `pnpm verify`.
- Ensayo en prueba: la propuesta está abajo y espera revisión del Director.

## Propuesta de ensayo en prueba, 0492–0497 (NO EJECUTADO)

**Estado medido, solo lectura:** ledger de prueba con 483 filas, última `0491_freight_carriers_auditoria`. Web `cfa7da01` del 2026-10-16. Base con 164 MiB de 1 GiB; el VPS tiene 13,5 GB disponibles.

**Recomiendo no resetear.** El runbook §4 pide reset, pero prueba tiene datos reales de consolidados que Sam autorizó (§2.1) y el reset los borra. Propongo incremental, con un respaldo antes. Es una desviación del runbook y la decides tú.

| Paso | Qué | Tiempo estimado |
|---|---|---|
| 1 | `pg_dump` de la base de prueba a `/srv/ops`, para poder volver | 2 min |
| 2 | `preparar.mjs --proyecto dtd-cargo-staging` de las seis migraciones, desde una sola cabeza | 2 min |
| 3 | `aplicar-remoto.sh --proyecto dtd-cargo-staging --paso previa`, de a una | 5 min |
| 4 | Apply en lote, con `--esperada … --paquete …` en orden, parando en la primera falla | 5 min |
| 5 | Smoke A: web vieja con base nueva, pantallas de arriba | 15 min |
| 6 | Imagen de la cabeza (`build-image-prueba.yml`) y `desplegar-prueba.sh` | 15 min |
| 7 | Smoke B por rol, y «aprobado en prueba» de Sam | 30 min, con Sam |

**Riesgos:**

1. **Qué agrega sobre §3b:** GoTrue y storage-api de verdad, tablas con datos (el CHECK y el índice corren sobre filas), la web vieja contra la base nueva y los smokes por rol. Los permisos del rol ya se probaron en local.
2. **Prueba no cubre el cuerpo vivo:** tiene el `next_entry_code` de la 0078 (393 caracteres). Esa rama la cubren §3b, PGlite y la lectura previa de producción.
3. **Volver atrás cuesta:** sin reset, solo con el respaldo del paso 1. Con reset se pierden los datos reales.
4. **La web de prueba es más vieja que la de producción.** Asienta igual, cabecera primero, así que sirve para la ventana, pero no es la misma imagen.
5. **La evidencia vale para un SHA.** Un commit que toque la 0497 obliga a repetir. Conviene ensayar después de tu revisión.
6. **Hay que confirmar la imagen:** `build-image-prueba.yml` depende de las variables `PRUEBA_*` y el repo cambió de dueño. No lo verifiqué; la sesión `publicacion-softagentes` lleva ese frente.
7. **Una sola ranura:** prueba muestra una rama a la vez.

## FUERA DE ALCANCE DETECTADO

- **Las pruebas de migración no corren con el rol de producción.** PGlite y `postgres:17` son superusuario, así que esta clase de defecto no se detecta hasta el apply. La comprobación de §3b fue un script de una sola vez y no queda en el repo. `pnpm schema:rebuild:supabase` ya reconstruye como `postgres` en la imagen real, pero no corre el apply empaquetado ni los contratos, y no está en `verify`. Una opción: agregarlo como paso del CI o del gate de migraciones.
- **El ledger de `_supabase-platform-stubs.supabase.sql` no tiene `created_by`, `idempotency_key` ni `rollback`:** un `aplicar.sql` real falla ahí. Lo sorteé en mi arnés con un `alter table`.
- **La 0495 está en el ledger de producción pero sigue en `pendingBelowCutoff` y sin sellar.** Falta su cierre del runbook §6.
- **Una factura emitida entre el apply y la web nueva queda sin asiento.** Conviene un conteo de control después de publicar, con OK. Revisar si hace falta un camino para asentarla.
- `0497_…_carrera.test.sql` imprime evidencia cruda de 500 KB por corrida. Ya no rompe, pero ensucia.

## HANDOFF AL DIRECTOR

El informe va en el mensaje de cierre, con la identidad de la cabeza final. Impacto documental: spec 0573 y este handoff. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main. Claim liberado al terminar.
