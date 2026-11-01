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

PGlite y `postgres:17` corren como superusuario, y el contrato de la 0497 carga un subconjunto de migraciones (sin 0197, 0466, 0494 ni 0495). `infra/ops/tests/prueba-0497-rol-real.mjs` cubre las dos cosas. Es corrida pesada, no entra al CI y da 77 de 77 con la imagen de producción `supabase/postgres:17.6.1.136`, sin red. Rol `postgres`: `super=false`, `createrole=true`, `createdb=true`, `bypassrls=true`, sin SET sobre el parámetro. Las esperas 0422 y 0423 no se aplican, como en producción.

| Capa | Resultado |
|---|---|
| Reconstrucción como `postgres` hasta la 0495 | PASÓ, 469 migraciones en unos 20 s |
| **Control en rojo:** un parámetro propio en la cabecera | `permission denied to set parameter "dtd.audit_reason"`. La prueba detecta la clase |
| 0496: previa, apply, verificación del paquete real | PASÓ; apply 504 ms |
| `next_entry_code` con el cuerpo vivo | md5 `06b5756a18361fc4d85cec6f6dc4b3bc` |
| 0497: previa, apply, verificación del paquete real | PASÓ; apply 485 ms |
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

### 3c. A2: las guardas congelaban facturas de antes

Hallazgo de la revisión independiente: `i3_invoice_final_check` corría en todo UPDATE de `invoices` y fallaba al confirmar si la factura y su venta no cuadraban. Un cobro o un renombre de marca sobre una de esas facturas fallaba sin camino de reparación. Medido en la imagen real con filas sembradas.

**Conteo en producción.** `scripts/qa/0497-legado-por-clase.sql` sale de la lógica real de `i3_assert_invoice_final`, y una prueba lo compara con la función real sobre las mismas filas. Sam autorizó, literal: «Sí, solo conteos (Recomendado)», contar por tipo las facturas viejas con el asiento en mal estado, solo números, sin filas, sin montos y sin clientes. Lo corrió el Director el 2026-11-01 a las 18:30Z, sobre `66b755c13`, en solo lectura:

| Clase | Estado de la factura | n |
|---|---|---:|
| `sin_venta` | `borrador` | 1 |
| `sin_venta` | `emitida` | 3 |
| `sin_venta` | `pagada` | 1 |
| `sin_venta` | `parcial` | 1 |
| `venta_anulada` | `anulada` | 1 |

**Una factura quedaba congelada.** Su saldo es cero, porque la factura y su asiento están anulados: no es un error contable, solo no cumple la regla nueva. **Inferencia del Director:** es una factura de prueba. No se verificó.

**Decisión de Sam, 2026-11-01, literal: «Ajustar la guarda (Recomendado)».** El Director le explicó que la guarda solo revisaría cuando cambia el estado de la factura, si se borra o si se toca su asiento de venta; que no se toca ningún dato; y que cuesta repetir `verify` y otra revisión independiente. **No se autoriza leer ni escribir esa fila.**

**La regla, en el cuerpo de las dos funciones:**

- **`i3_invoice_final`:** en INSERT y DELETE, siempre. En UPDATE, solo si cambia `id`, `tenant_id` o `deleted_at`, o si `status` cambia y alguno de los dos valores está fuera de `emitida, parcial, vencida, pagada`.
- **`i3_journal_entry_final`:** solo si el asiento viejo o el nuevo es `invoice`, `invoice_reversal` o tiene `reverses_entry_id`.

**La regla es más precisa que lo que se le explicó a Sam.** Un cambio de estado entre los cuatro vivos no se revisa. Conviene que lo vea así en el OK nominal.

**Hueco conocido, aceptado por el Director el 2026-11-01, con condiciones.** El filtro no mira la clase: **cualquier factura viva cuya venta no cuadra se puede cobrar hasta `pagada`.** Con la venta anulada, con dos ventas, con líneas descuadradas, con la venta borrada o de otro tenant, entre otras. Medido con `register_collection_receipt` en la imagen real, con venta anulada y con dos ventas (`l_cobro_hueco_conocido`, `l_cobro_hasta_pagada`, `l_cobro_dos_ventas`), y para las 14 clases vivas en la prueba de contrato. **Es más laxo que la 0497 sin filtro, donde fallaría al confirmar, e igual que hoy en producción.** El Director decidió no agregar una comprobación dentro de la 0497 para el hueco residual: se queda la puerta del conteo, con avisar a quien usa el sistema.

- Hoy no hay ninguna fila así en estados vivos, según el conteo.
- Después del apply no encontré camino para crearla: `i3_journal_entry_guard` hace inmutable el asiento de venta.
- Solo entraría una que aparezca antes del apply, entre la puerta y el COMMIT.
- `void` y `post` la siguen rechazando.

**Se pierde la alarma al tocar una fila rota, y la reemplaza un control por corrida.** `scripts/qa/0497-control-posterior.sql` corre con la 0497 aplicada, solo lectura, con conteos por clase. Se apoya en `i3_original_valid` y `i3_mirror_valid`, y dos pruebas lo comparan con `i3_assert_invoice_final` por mensaje: PGlite y la imagen real. Su columna `lectura` separa `emitida_en_la_ventana` (sin asiento, emitida desde la hora del ledger) de `entro_por_el_hueco` (viva y no cuadra). La radiografía también corre con la 0497 y su fila 50 ve esa factura (5 con la venta anulada, 4 con la venta viva), pero no ve todas las clases: no ve `venta_de_otro_tenant`, `venta_sin_codigo`, las dos de fecha, `lineas_ninguna`, `lineas_cuenta_no_clasificable`, `lineas_importe_invalido`, `lineas_sin_cxc_o_ingreso` ni `estado_sin_venta_posible`. Es alarma por corrida, no al momento de tocar la fila.

**Lo que queda probado:**

| Prueba | Resultado |
|---|---|
| Fila `venta_anulada\|anulada` con cobro y crédito vivos: `rename_client_markbox`, `rename_legacy_markboxes`, `void_collection_receipt`, `revert_referral_credits` y anular el asiento `referral_credit` | Pasan en la imagen real |
| Sigue frenando, con su error: hacia `anulada` y `borrador`, reabrir, borrar, DELETE, tenant, tocar el asiento de venta | Imagen real y PGlite |
| Sin la guarda de fila, la aserción frena sola reabrir, borrar y cambiar de tenant | PGlite |
| **Espía en la aserción**, 29 operaciones: a quién llama cada una | PGlite. Hace falta porque un INSERT o DELETE no tiene asientos que contar, y el FK impide cambiar el `id` a una factura que los tenga: ahí la conducta no distingue |
| Mutantes del filtro: sin él y con cada una de las 13 condiciones quitada | 14 de 14 mueren |
| Carreras reales en `postgres:17` | La línea 873 da `"commit": "ERROR"` con «requiere su reverso íntegro»; la 1029 da «Estado de factura y par contable incompatibles». 244 aserciones |
| `0497-legado-por-clase.sql` contra `i3_assert_invoice_final` | Cada clase suma una y los totales por mensaje coinciden |

### Lista de control de la ventana

Para el apply en producción. Nada de esto corre solo.

1. **Puerta justo antes del apply:** correr `scripts/qa/0497-legado-por-clase.sql` y comparar **todas** las filas contra la lista exacta, salvo `sin_venta`. Hoy: `venta_anulada|anulada=1` y nada más. Cualquier otra fila, también `venta_anulada|anulada=2`, frena el apply. **En particular, cualquier `venta_anulada` en `emitida`, `parcial`, `vencida` o `pagada` detiene la ventana:** es el hueco conocido. Atención con `anulada_sin_reverso`: la crea anular desde Facturación con la `void` vieja, y es lo más probable antes del apply.
2. **Hueco residual, que la puerta no cierra:** entre el conteo y el COMMIT, una anulación o una transacción en curso no se ve. Si en ese momento alguien anula una venta desde el Libro diario, la factura entra a la 0497 con la venta anulada y se puede cobrar. Se achica contando justo antes y con quien usa el sistema avisado. Antes de la ventana, Sam detiene Codex y Orca.
3. **Justo después del apply:** PostgREST ve la RPC nueva (§6).
4. **Después de publicar, correr `scripts/qa/0497-control-posterior.sql`, con autorización de Sam,** y comparar contra la línea base de hoy: `sin_venta` con `emitida 3, pagada 1, parcial 1` y `venta_anulada|anulada=1`. Su columna `lectura` dice qué es cada cosa: `emitida_en_la_ventana` es una factura que hay que asentar; `entro_por_el_hueco` es una factura que entró al apply sin cuadrar.
5. **Correr también `scripts/qa/radiografia-integridad.sql`:** su fila 50 cuenta las facturas vivas sin venta viva. No reemplaza el control de arriba, que ve más clases.

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
| Prueba de contrato (`reverso-al-anular-factura.migration.test.ts`, PGlite) | PASÓ | 131 de 131 |
| Mutantes del motivo y del filtro, con el pin recalculado | PASÓ | 9 y 14, ninguno sobrevive. Los del motivo corrieron antes del filtro, que no cambia esas dos funciones |
| `infra/ops/tests/prueba-0497-rol-real.mjs` | PASÓ | 77 de 77; §3b y §3c. Se niega si `--paquetes` trae otro blob: probado con el paquete anterior, sale con 3 |
| Contratos reales en `postgres:17`, runner de esta rama | PASÓ | 4 de 4 |
| `run-sql-tests-salida.node.mjs` en Linux (`node:24`) | PASÓ | 3 de 3; mutante sin `maxBuffer` muere. En Windows se salta: el doble de docker es un script de sh |
| `migrations-lock`, `docs:check`, `sdd:check`, símbolos pendientes | PASÓ | símbolos: 0 ROJO, 3 AMARILLO declarados |
| ESLint de los archivos tocados y `tsc --noEmit` del proyecto | PASÓ | exit 0 en los dos |
| `pnpm verify` sobre `dab79b99f` | **FALLÓ** (exit 1), 16 de 17 pasos medidos | Tabla de abajo |
| Ensayo en el entorno de prueba | NO EJECUTADO | lo avisa el Director |
| Lectura previa 0496 y 0497 | PASÓ | abajo |

**Logs de esta validación,** fuera del repo, en `0573-evidencia/` dentro de la carpeta de notas del grupo de sesiones (`local_535053f4-40c2-4124-a280-63f4fc882820`): `rol-real.log`, `mutantes-filtro.log`, `mutantes-motivo.log`, `contrato.log` y `verify-dab79b99f.log`, con los scripts de los mutantes al lado.

**El `verify` sobre `dab79b99f`, paso por paso.**

| Paso | Estado | Detalle |
|---|---|---|
| `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions` | PASÓ | |
| `test` | **FALLÓ**, sin ninguna aserción en rojo | Dos intentos: 13221 y 13170 pruebas pasadas, 0 fallidas. El exit 1 viene de «Failed to start forks worker… Timeout waiting for worker to respond», 2 y 6 archivos. Esos 6 archivos, aislados: PASÓ, 118 de 118. Es carga de la máquina, no el código |
| `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check` | PASÓ | |
| `migrations-applied` | NO DISPONIBLE | sin `.env.local`; no se copiaron secretos |
| `pending-migration-symbols` | PASÓ | 0 ROJO, 3 AMARILLO declarados |
| `sql-tests` | PASÓ | 249 contratos, incluidos los tres que estaban en rojo |
| `schema-rebuild` | PASÓ | |
| `e2e` | **FALLÓ** | Un spec en los dos intentos: `sin-scroll-horizontal.spec.ts:119`, timeout de 20 s en un test de 60 s. Más `auth.spec.ts:81`, flaky en el primero. 218 y 219 pasadas. Aislados, sin carga: PASÓ, 3 de 3 cada uno, con el primero tardando 35 s. Esta rama no toca `e2e/`, `app/` ni `components/` |
| `build` | PASÓ | |

**Lectura:** no hay un rojo atribuible a esta rama, pero el `verify` no cerró en verde y sigue siendo FALLÓ. Lo que corrió después son pruebas puntuales y el CI. Los commits posteriores a `dab79b99f` no tocan el blob.

Identidad vigente y lectura previa, copiadas de la salida de `preparar.mjs` y `aplicar-remoto.sh` sobre `1e31a642f19ddf577bbd863da8f94b957cc74aa0`. Los commits posteriores solo tocan este handoff. **La lectura previa PASÓ en las dos**, con scripts del servidor iguales al checkout.

| Migración | Blob | Bytes | md5 del blob | md5 de `aplicar.sql` | Evidencia de la lectura previa |
|---|---|---:|---|---|---|
| `0496_tarifa_congelada_por_embarque` (SDD-0571) | `0f424008e0b8` | 45610 | `075eab7fae8d9dfb2b06f88335087f8d` | `d3be5cbcdc4d1960e1306d2a9a6a4926` | `/srv/ops/evidencias/previa-0496-dtd-cargo-20261101T205838Z` |
| `0497_reverso_al_anular_factura` (SDD-0573) | `7f8450fa6417` | 79544 | `86a8bdbc8bdcaf5586157db018c1164c` | `2f6948f17f5f2ebc4a295f82f363baad` | `/srv/ops/evidencias/previa-0497-dtd-cargo-20261101T205857Z` |

En la de la 0497: 0 sesiones esperando locks, 0 transacciones largas, 13 funciones `nueva`, `void_invoice_with_audit_reason` `igual` a la 0294 y `previa.err` vacío.

## COMMITS

`3d7c681dc` pines · `cf7810fe5` motivo sin SET en la cabecera · `8fa1c3dc8` rojos de `sql-tests` · `f80a0fce2` y `3a5c47cca` huellas, spec y handoff · `6faefc691` pruebas por salida · `4c3501b1b` registro en D2/M4 · `1e8511405` cabecera, prueba del runner y de estructura · `7d58c604d` conteo de legado y prueba con el rol real · `66b755c13` merge de main con la #345 · `c09acce20` filtro de la guarda · más el de esta evidencia.

## PR / BRANCH

Rama propia, PR en borrador contra `main`. Sin fusionar.

## PENDIENTES DE ESTA TAREA

- Que Sam vea el cambio de mecanismo D2/M4 al pedirle el OK nominal.
- Que Sam vea el filtro de la guarda y el hueco conocido en el OK nominal, con la regla exacta.
- Otra revisión independiente del filtro, antes del ensayo.
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

- **`edge-functions` dio rojo local dos veces y no era del código.** `deno check` dio TS7031 y TS7006 en `supabase/functions/kommo-webhook/index.ts:388,391` en los `verify` de `4c3501b1b` y `66b755c13`. **Corrijo lo que escribí antes:** dije que la causa era la versión flotante de `jsr:@supabase/supabase-js@2`, y no lo es. Con caché de Deno vacía, el árbol de `origin/main` da exit 0 con `2.90.0`, `2.110.0`, `2.115.0`, `2.116.0`, `2.117.0` y `2.118.0`, y también sin fijar versión. El rojo salía con la caché de esta máquina, y `main` fallaba igual en esa misma caché, con `supabase/functions` idéntico a esta rama. Después de mis corridas, esa caché también da exit 0 y el `verify` de `dab79b99f` lo dio verde. **Inferencia:** caché de Deno desactualizada en esta máquina; ya no se puede comprobar porque se refrescó. Por eso el CI, que parte de una caché limpia, no lo mostraba.
- **Otra vía a facturas inválidas, que ya existía:** un `PATCH` directo con `is_postable=false` sobre la cuenta 4.5 vuelve inválidas las ventas del tenant, porque la 0497 no pone guardas sobre `accounts` y la RLS es `for all` por tenant. La acción de Contabilidad lo impide con movimientos; el `PATCH` directo no. El permiso ya existía, y el filtro le quita el ruido: esas ventas ya no congelan un cobro. Corrijo lo que dije: esto no es solo por SQL directo.
- **5 facturas `sin_venta` que no son borrador** (`emitida 3, pagada 1, parcial 1`): no tienen asiento de venta. Parece el defecto B3. **Inferencia,** sin revisar esas filas.
- **Las pruebas de migración no corren con el rol de producción en el CI.** PGlite y `postgres:17` son superusuario. `infra/ops/tests/prueba-0497-rol-real.mjs` queda como corrida manual y solo para esta migración. Una opción: generalizarla al gate de migraciones.
- **El ledger de `_supabase-platform-stubs.supabase.sql` no tiene `created_by`, `idempotency_key` ni `rollback`:** un `aplicar.sql` real falla ahí. Lo sorteé en mi arnés con un `alter table`.
- **La 0495 está en el ledger de producción pero sigue en `pendingBelowCutoff` y sin sellar.** Falta su cierre del runbook §6.
- **Una factura emitida entre el apply y la web nueva queda sin asiento.** Conviene un conteo de control después de publicar, con OK. Revisar si hace falta un camino para asentarla.
- `0497_…_carrera.test.sql` imprime evidencia cruda de 500 KB por corrida. Ya no rompe, pero ensucia.

## HANDOFF AL DIRECTOR

El informe va en el mensaje de cierre, con la identidad de la cabeza final. Impacto documental: spec 0573 y este handoff. Graphify, Archify y Obsidian: NO EJECUTADOS, los publica el Director desde main. Claim liberado al terminar.
