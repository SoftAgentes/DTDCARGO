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

**Retornos tempranos:** una prueba de estructura exige que cada salida posterior al primer cambio del motivo vaya en su propia línea, justo después de la restauración; un `then return` también cuenta. Todos los anteriores salen sin haberlo tocado. No encontré ningún camino que no restaure.

Nueve mutantes, con el pin recalculado para que no mueran por el pin: todos mueren por comportamiento o por esa estructura.

**Límite:** el `set_config('', true)` que sigue al UPDATE no tiene un testigo propio, porque después no hay otra escritura hasta salir. Esa línea ya existía antes de este cambio.

### 3b. La clase de fallo: 0496 y 0497 con el rol real, sobre el esquema completo

PGlite y `postgres:17` corren como superusuario, y el contrato de la 0497 carga un subconjunto de migraciones (sin 0197, 0466, 0494 ni 0495). `infra/ops/tests/prueba-0497-rol-real.mjs` cubre las dos cosas. Es corrida pesada, no entra al CI y da 54 de 54 con la imagen de producción `supabase/postgres:17.6.1.136`, sin red. Rol `postgres`: `super=false`, `createrole=true`, `createdb=true`, `bypassrls=true`, sin SET sobre el parámetro. Las esperas 0422 y 0423 no se aplican, como en producción.

| Capa | Resultado |
|---|---|
| Reconstrucción como `postgres` hasta la 0495 | PASÓ, 469 migraciones en unos 20 s |
| **Control en rojo:** un parámetro propio en la cabecera | `permission denied to set parameter "dtd.audit_reason"`. La prueba detecta la clase |
| 0496: previa, apply, verificación del paquete real | PASÓ; apply 328 ms |
| `next_entry_code` con el cuerpo vivo | md5 `06b5756a18361fc4d85cec6f6dc4b3bc` |
| 0497: previa, apply, verificación del paquete real | PASÓ; apply 376 ms |
| Funciones con parámetro propio en la cabecera | 0 |
| Contrato 0496 y contrato 0497, en base nueva, como `postgres` | PASÓ, 102 y 144 aserciones |

**Las RPC sobre el esquema completo, con filas sembradas (M1).** Como `authenticated` y `service_role`, conviviendo con `invoices_seal_billing_titular`, `invoices_referral_sale_voided`, `referrals_candado_trg` e `invoices_write_version`:

| Escenario | Resultado |
|---|---|
| Post y post repetido | `posted`, luego `already_posted`; tres líneas cuadradas |
| Void de una venta con IVA | anulada, `write_version` sube a 1, un reverso con sus tres líneas, motivo exacto en `invoice_voided` |
| Titular sellado | sigue congelado: `invoice_titular_frozen` |
| Venta que acreditó un referido | se acredita con la venta; al anularla, el referido vuelve a `registrado` |
| Crédito aplicado | void rechazado con «aplicado sin recibo»; revertido el crédito, void pasa |
| Cobro vivo | factura `parcial`, void rechazado; anulado el cobro, void pasa |
| Renombrar la marca | pasa con una factura sana |
| Rol comercial; `authenticated` en post | se niega; `permission denied for function` |
| Excepción con savepoint, con y sin asiento | valor exterior intacto, rol `postgres`, factura `emitida`, sin reverso |
| Excepción sin capturar, en transacción y sin ella, con y sin valor previo | queda el valor de la sesión o ninguno |

**No aparece ninguna otra falla de permisos ni de convivencia:** ni triggers, ni `alter constraint`, ni GRANT, ni las RPC al ejecutarse.

**Lo que esto no cubre:**

- Los tiempos son sobre tablas casi vacías, sin concurrencia.
- **Las carreras no corren con el rol real:** su guarda exige que `anon`, `authenticated` y `service_role` no existan, y en esta imagen existen. Corren en `postgres:17` como superusuario.
- Auth y Storage son los stubs del repo, no GoTrue ni storage-api. No hay PostgREST: las RPC se llaman por SQL.

### 3c. A2: las guardas congelan facturas de antes

Hallazgo de la revisión independiente. **Mecanismo verificado; si existen en producción, no se sabe.** `i3_invoice_final_check` corre en todo UPDATE de `invoices` y falla al confirmar con 23514 si la factura y su venta no cuadran. Medido en la imagen real, con filas de legado sembradas antes de la 0497:

| Sobre una factura de legado | Resultado |
|---|---|
| Emitida, con la venta anulada desde el Libro diario: **registrar un cobro** | `ERROR: La venta original requiere revisión`; no deja recibo ni pagado |
| **Renombrar la marca** de su cliente | falla igual y no cambia nada |
| Con dos ventas: cualquier UPDATE | `La relación contable de la factura requiere revisión` |
| Anulada sin reverso: cualquier UPDATE | `Una factura anulada con venta requiere su reverso íntegro` |
| Esa misma venta anulada: void y post | void rechazado con «Los antecedentes de venta requieren revisión»; post pide revisión |

**No hay camino de reparación dentro de la 0497.** Renombrar una marca toca todas las facturas del cliente, también las anuladas, así que una sola anulada sin reverso le bloquearía el renombre a ese cliente. La radiografía de la SDD-0559 ya mide «anulados con asiento vivo», así que esa clase puede tener filas.

**Conteo:** `scripts/qa/0497-legado-por-clase.sql`. Solo lectura, sin filas: `clase · estado_factura · n`. Va antes de la 0497 y se niega si ya está aplicada. Sale de la lógica real de `i3_assert_invoice_final`, y una prueba lo compara con la función real sobre las mismas filas: cada clase suma una y los totales por mensaje coinciden. Todas las clases se pueden contar sin mostrar filas, aunque por dentro las lee, así que en producción pide autorización. **Lo corre el Director cuando Sam autorice. No lo he corrido en producción.**

**Qué hacer según el resultado (propuesta, sin cambiar nada todavía):**

- **Solo `sana` y `sin_venta`:** A2 no frena. Después de la 0497 no aparecen filas nuevas de legado, porque la guarda de asiento no deja anular uno automático. Conviene correr el conteo justo antes del apply: hasta entonces, el Libro diario todavía puede anular una venta.
- **Con filas en otras clases:** decidir entre dos caminos. Uno es acotar `i3_invoice_final_check` con un `WHEN` a las transiciones que importan (a y desde `anulada`, `deleted_at`, tenant). El otro es reparar esas filas antes, con su propia migración. Las dos cambian la 0497 o agregan otra, y necesitan tu decisión. Si la 0497 cambia, hay que repetir pines, prueba con rol real, `verify` y previa.

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

**El CHECK `journal_entries_reverso_coherente`** valida las filas actuales y abortaría si ya hubiera una con `source='invoice_reversal'`. Lo midió el Director en producción, en una transacción de solo lectura, con la autorización de Sam, literal: «Sí, solo el conteo (Recomendado)». Resultado: `count(*)` = **0**. No frena la 0497 hoy. No cubre lo que entre hasta el apply; por lectura de `929cabf51`, ni `app/`, `lib/`, `components/`, `supabase/functions/` ni sus migraciones nombran ese `source`, así que esa web no lo crea.

**Hora: sí conviene una de poco tráfico, por la ventana y no por los locks.** Entre el apply y la web nueva, la web vieja (`929cabf51`):

- **No puede asentar ventas:** inserta la cabecera primero, la guarda responde 23514 (contrato I3B05) y la web solo lo escribe en el log, así que **la factura queda emitida sin asiento**. Mientras la 0497 no entre junto con la web nueva, nadie debería emitir facturas. M8 ya lo prevé: «pueda degradar posting legado».
- **Anula con reverso, salvo con crédito aplicado o cobro vivo.** La `void` nueva rechaza `paid_amount>0` con 55000. La web vieja revertía el crédito **después** de anular, así que en la ventana esa factura no se anula desde su pantalla: muestra el error. Medido en la imagen real: `n3_void_con_credito`. El camino es revertir el crédito primero; la anulación con asiento y sin crédito está probada en `n1_void`.

### 6. Pantallas a revisar después de aplicar

**Antes de las pantallas, PostgREST tiene que ver la RPC nueva.** La 0497 no hace `notify pgrst`, y un `PGRST202` deja la factura sin asiento. Producción tiene `pgrst_ddl_watch` y `pgrst_drop_watch` activos (`enabled=O`, medido el 2026-11-01), que deberían refrescar la caché con el DDL, pero no se ha comprobado con esta migración. Comprobarlo: `POST /rest/v1/rpc/post_invoice_journal_entry_atomic` con la llave `service_role` y dos UUID que no existen tiene que responder `invoice_unavailable`, sin escribir nada. Si responde `PGRST202`: `notify pgrst, 'reload schema';` y repetir.

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
| Prueba de contrato (`reverso-al-anular-factura.migration.test.ts`, PGlite) | PASÓ | 82 de 82 |
| `infra/ops/tests/prueba-0497-rol-real.mjs` | PASÓ | 54 de 54; §3b |
| Contratos reales en `postgres:17`, runner de esta rama | PASÓ | 4 de 4 |
| `run-sql-tests-salida.node.mjs` en Linux (`node:24`) | PASÓ | 3 de 3; mutante sin `maxBuffer` muere. En Windows se salta: el doble de docker es un script de sh |
| `migrations-lock`, `docs:check`, `sdd:check`, símbolos pendientes | PASÓ | símbolos: 0 ROJO, 3 AMARILLO declarados |
| ESLint de los archivos tocados y `tsc --noEmit` del proyecto | PASÓ | exit 0 en los dos |
| `pnpm verify` | Se detuvo sobre `4c3501b1b` por orden del Director; se repite sobre la cabeza final | el resultado va en el informe |
| Ensayo en el entorno de prueba | NO EJECUTADO | después de `verify` y de que la #345 esté en main; lo avisa el Director |
| Lectura previa 0496 y 0497 | PASÓ | abajo |

Identidad vigente, copiada de la salida de `preparar.mjs` sobre `1e8511405`. La cabecera de la 0497 cambió el blob, así que estos valores reemplazan a los anteriores. Los commits posteriores no tocan las migraciones. La lectura previa sobre la cabeza final, con su evidencia, va en el informe al Director.

| Migración | Blob | Bytes | md5 del blob | md5 de `aplicar.sql` |
|---|---|---:|---|---|
| `0496_tarifa_congelada_por_embarque` (SDD-0571) | `0f424008e0b8` | 45610 | `075eab7fae8d9dfb2b06f88335087f8d` | `d3be5cbcdc4d1960e1306d2a9a6a4926` |
| `0497_reverso_al_anular_factura` (SDD-0573) | `71f9227dbfe5` | 78415 | `08cb7a480e020f0d1a81ace9f0a9e6b7` | `d4a2b28d9781dc55c691945895b8ad58` |

En la lectura previa anterior de la 0497 (`previa-0497-dtd-cargo-20261101T170941Z`, solo cambia la cabecera): 0 sesiones esperando locks, 0 transacciones largas; 13 funciones `nueva` y `void_invoice_with_audit_reason` `igual` a la 0294.

## COMMITS

`3d7c681dc` pines · `cf7810fe5` motivo sin SET en la cabecera · `8fa1c3dc8` rojos de `sql-tests` · `f80a0fce2` y `3a5c47cca` huellas, spec y handoff · `6faefc691` pruebas por salida · `4c3501b1b` registro en D2/M4 · `1e8511405` cabecera, prueba del runner y de estructura · más el del conteo de legado y la prueba con el rol real.

## PR / BRANCH

Rama propia, PR en borrador contra `main`. Sin fusionar.

## PENDIENTES DE ESTA TAREA

- Que Sam vea el cambio de mecanismo D2/M4 al pedirle el OK nominal.
- **A2:** el conteo en producción, con la autorización de Sam, y la decisión según el resultado.
- Ensayo en prueba, con el aviso del Director.

## Propuesta de ensayo en prueba, 0492–0497 (NO EJECUTADO)

**Estado medido, solo lectura:** ledger de prueba con 483 filas, última `0491_freight_carriers_auditoria`. Web `cfa7da01` del 2026-10-16. Base con 164 MiB de 1 GiB; el VPS tiene 13,5 GB disponibles.

**Sin reset, decidido por Sam.** El runbook §4 pide reset, pero prueba tiene datos reales de consolidados que Sam autorizó (§2.1) y el reset los borra. El Director aceptó la propuesta incremental con respaldo, y Sam eligió el 2026-11-01, literal: «Sin borrar, con respaldo (Recomendado)». Va después de `verify` y de que la #345 esté en main, y lo avisa el Director.

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

- **`edge-functions` está en rojo y no viene de esta rama.** `deno check` falla con TS7031 y TS7006 en `supabase/functions/kommo-webhook/index.ts:388,391`. Esta rama no toca `supabase/functions/` (`git diff` vacío contra la base) y ese archivo no cambia desde el 2026-10-15. Verifies anteriores lo dieron PASÓ. **Inferencia:** importa `jsr:@supabase/supabase-js@2` sin lockfile, así que la versión flota y puede haber cambiado sus tipos. No lo comprobé.
- **Las pruebas de migración no corren con el rol de producción en el CI.** PGlite y `postgres:17` son superusuario. `infra/ops/tests/prueba-0497-rol-real.mjs` queda como corrida manual y solo para esta migración. Una opción: generalizarla al gate de migraciones.
- **El ledger de `_supabase-platform-stubs.supabase.sql` no tiene `created_by`, `idempotency_key` ni `rollback`:** un `aplicar.sql` real falla ahí. Lo sorteé en mi arnés con un `alter table`.
- **La 0495 está en el ledger de producción pero sigue en `pendingBelowCutoff` y sin sellar.** Falta su cierre del runbook §6.
- **Una factura emitida entre el apply y la web nueva queda sin asiento.** Conviene un conteo de control después de publicar, con OK. Revisar si hace falta un camino para asentarla.
- `0497_…_carrera.test.sql` imprime evidencia cruda de 500 KB por corrida. Ya no rompe, pero ensucia.

## HANDOFF AL DIRECTOR

El informe va en el mensaje de cierre, con la identidad de la cabeza final. Impacto documental: spec 0573 y este handoff. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main. Claim liberado al terminar.
