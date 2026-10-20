# SDD-0575 — Propuesta de contrato para asientos sin fallos silenciosos

**Fecha de revisión:** 2026-10-20.

**Estado:** propuesta documental para revisión del Director; implementación NO APROBADA.

**Destino:** asset de la [SDD-0575](../spec.md), conservado para revisión del Director; no sustituye su contrato final ni aprueba implementación.

**Base consultada:** `main` en `8e9e0f505322cd57b3230cce6b16b45b5554cb8a`.

**SDD consultada:** rama `codex/sdd-0575-asientos-sin-fallos-silenciosos`, HEAD `b4bd7cc23394fde1e8543ffc400e271bbd2b9006`.

**Procedencia:** propuesta temporal `0575-contrato-propuesto.md`, SHA256 `177d4b07450cded9f229358ef4bf0eb4c043788f29f019db842e9474a22ce760`, revisada por el Director antes de este encargo de conservación documental. Se adapta su ubicación y sus enlaces; se conservan la evidencia fechada y sus límites.
**Límites:** la revisión original leyó fuentes locales y documentación oficial de PostgreSQL 17; solo escribió el temporal. Esta incorporación guarda documentación en la rama autorizada. No implementa SQL/producto ni ejecuta pruebas, reserva de migración, instalación, DB, merge, despliegue o Graphify. El commit/push documental no aprueba producto.

## 1. Resultado propuesto y decisiones que se conservan

Se propone una RPC de contabilización por documento, con un subbloque que contiene las escrituras contables inseparables. Si falla ese subbloque, se revierten la cabecera, las líneas, el vínculo y la evidencia de una excepción de cierre que no llegó a utilizarse. Después se registra el motivo fuera del subbloque fallido, sin volver a lanzar una excepción que revierta también ese registro.

La garantía depende de que la transacción exterior pueda confirmar. Si falla el registro del motivo, se cancela la llamada, se pierde la conexión o falla la confirmación exterior, no se promete que el motivo haya quedado guardado. El cliente debe poder representar **estado desconocido** y comprobar el resultado por la identidad del documento antes de repetirlo.

Se conservan las decisiones del Director registradas en la SDD:

1. RPC atómica por documento que falle cerrado.
2. Período cerrado bloqueado salvo excepción gobernada por 0566; sin refecha silenciosa.
3. Sección «Asientos no creados» dentro de «Por contabilizar».
4. Tres PR secuenciales: 0575-a → 0575-b → 0575-c.
5. Gasto incluido desde el contrato de 0575-a, junto con los otros cuatro posters y las variantes del cobro.

**Número de migración PENDIENTE**, a inventariar y reservar por el Director. Las firmas, contratos de permisos, lista exacta de archivos por PR y base integrada todavía deben aprobarse. Nada de este documento concede autorización de implementación.

Los casos de la radiografía del 18 de octubre son **datos de prueba**, según la decisión de Sam en el §9 del plan. Esta propuesta no autoriza su reparación, reasiento, lectura de filas ni borrado.

## 2. Evidencia reproducible y alcance de lectura

Las referencias E01–E17 de esta sección se basan en los bytes rastreados de `main` `8e9e0f50`, salvo las dos fuentes de 0575 expresamente identificadas. Las líneas corresponden a esos SHA de lectura; los enlaces relativos permiten ubicar las fuentes en el repositorio, que pueden haber avanzado desde la revisión. Los hashes de los archivos centrales están en el anexo. Se leyeron completos la SDD, su handoff y los cinco posters. De sus consumidores, migraciones y dependencias se leyeron los bloques pertinentes; esto no es una auditoría global de todas las rutas contables.

| Ref. | Fuente y líneas | Hallazgo observado |
|---|---|---|
| E01 | [Spec 0575](<../spec.md>), líneas 108–167; [handoff](<../../../../.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md>) | La persistencia del motivo frente al rollback queda abierta. La firma y la autoridad de escritura son provisionales. Los cinco tipos se incluyen desde 0575-a. |
| E02 | [invoice-posting.ts](<../../../../lib/studio/accounting/invoice-posting.ts#L62>), líneas 62–83, 112–138 y 173–180 | Detecta existencia por `invoice_id` y no borrado, sin exigir `asentado`. Genera código, inserta cabecera y luego líneas mediante operaciones separadas. La eliminación compensatoria no comprueba su resultado. |
| E03 | [receipt-posting.ts](<../../../../lib/studio/accounting/receipt-posting.ts#L75>), líneas 75–85, 108–189, 203–210, 324–433 y 458–497 | Hay cobro aplicado, cobro sin referencia y reclasificación. La reclasificación usa `receipt_reclass`. La comprobación de existencia no exige asiento asentado. El fallback de tasa ausente mantiene el nominal en esta base. |
| E04 | [bill-posting.ts](<../../../../lib/studio/accounting/bill-posting.ts#L124>), líneas 63–73, 124–162 y 177–210 | El origen persistido es **`supplier_bill`**, no `bill`. La cabecera y las líneas se escriben por separado. El vínculo se completa en el consumidor. |
| E05 | [supplier-payment-posting.ts](<../../../../lib/studio/accounting/supplier-payment-posting.ts#L124>), líneas 63–73, 124–167 y 181–215 | Se repiten el fallback nominal, la existencia sin estado y la escritura separada. El origen es `supplier_payment`. |
| E06 | [expense-posting.ts](<../../../../lib/studio/accounting/expense-posting.ts#L117>), líneas 35–40, 85–105, 117–161, 176–204 y 242–259 | El gasto ya está expresado en `amount_usd`. Su existencia sí exige `asentado`. Importe no positivo y cuenta ausente pueden devolver `ok: true` con `skipped`. `syncExpenseEntry` devuelve `void` y solo registra errores en consola. |
| E07 | [collections-actions.ts](<../../../../lib/studio/collections-actions.ts#L180>), líneas 180–233, 266–332 y 429–470 | El negocio se guarda antes de contabilizar. Los vínculos posteriores del cobro no verifican el error de actualización. Identificar el cobro guarda la aplicación antes de crear su reclasificación. Los consumidores pueden devolver éxito con posting fallido. |
| E08 | [treasury-actions.ts](<../../../../lib/studio/treasury/treasury-actions.ts#L118>), líneas 118–201 y 318–363 | CxP y pago se guardan antes del poster; la actualización posterior de `journal_entry_id` no verifica el error. |
| E09 | [Facturación/actions.ts](<../../../../app/studio/(app)/facturacion/actions.ts#L175>), líneas 175–192, 338–408 y 545–601; [sales-orders/actions.ts](<../../../../lib/studio/sales-orders/actions.ts#L626>), líneas 626–655 | El wrapper de Facturación devuelve `void`. Emitir/crear factura y la facturación desde ventas pueden terminar en éxito después de fallar el asiento. Ventas declara expresamente el posting fuera de la transacción de negocio. |
| E10 | [Gastos/actions.ts](<../../../../app/studio/(app)/gastos/actions.ts#L121>), líneas 121–125, 174–208 y 275–318; [móvil/actions.ts](<../../../../app/m/erp/actions.ts#L66>), líneas 66–98, 186–193 y 342–350; [rbac.ts](<../../../../lib/studio/rbac.ts#L114>) | Los operadores de gastos tienen permisos distintos al reintento contable manual. Existen guardas de cierre en la app. Editar gasto anula el asiento anterior y sincroniza el nuevo en pasos separados. |
| E11 | [libro-control.ts](<../../../../lib/studio/accounting/libro-control.ts#L156>), líneas 156–168, 247–250, 288–305 y 399–425; [PorContabilizarTab.tsx](<../../../../app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx#L13>) | La proyección tiene cuatro tipos de documento, no gasto. Su definición canónica de vivo es `asentado` y no borrado. La pantalla actual solo consulta; no ejecuta asientos. |
| E12 | [0078_contabilidad.sql](<../../../../supabase/migrations/0078_contabilidad.sql#L57>), líneas 57 y 91–111; [0132_expense_posting.sql](<../../../../supabase/migrations/0132_expense_posting.sql#L36>), líneas 21–42 | Hay unicidad `(tenant_id, entry_code)` y asignación de código `max + 1`, sin candado, basada en el año de `current_date`. **Ya existe** `je_one_live_entry_per_expense` para gasto asentado y no borrado. |
| E13 | [0079_cobranzas.sql](<../../../../supabase/migrations/0079_cobranzas.sql#L39>); [0088_tesoreria.sql](<../../../../supabase/migrations/0088_tesoreria.sql#L61>), líneas 61, 79 y 100–115 | Cobro, CxP y pago tienen `journal_entry_id`. En el contrato observado de factura y gasto se usa el vínculo desde `journal_entries`; no se debe inventar un backlink obligatorio que el esquema no tenga. |
| E14 | [Spec 0566](<../../0566-cierre-contable-con-superclave/spec.md>), líneas 65–119 y 265–267; [0493_cierre_contable_superclave.sql](<../../../../supabase/migrations/0493_cierre_contable_superclave.sql#L253>), líneas 253–289, 323–393 y 400–462 | 0566 gobierna asientos manuales y exige una extensión explícita para los flujos automáticos. Su autorización valida sesión, tenant, permisos, motivo, nonce y transacción. El verificador de clave modifica contadores. La función de permiso contempla overrides; no equivale a una comprobación estricta de los dos roles autorizados para este reintento. |
| E15 | [0467_cobro_factura_atomico.sql](<../../../../supabase/migrations/0467_cobro_factura_atomico.sql#L191>), líneas 191–193, 268–270, 348–350 y 411–415; [0468_pago_proveedor_atomico.sql](<../../../../supabase/migrations/0468_pago_proveedor_atomico.sql#L179>), líneas 179–181, 254–256 y 312–314 | Las RPC de negocio existentes usan identidad autenticada y membresía activa. Son una frontera distinta de los posters actuales que crean un cliente `service_role`. |
| E16 | [period-queries.ts](<../../../../lib/studio/accounting/period-queries.ts#L57>), líneas 57–72; [plan contable](<../../../audits/2026-10-18-contabilidad-diagnostico-y-plan.md>) | El helper de cierre tolera esquema ausente como abierto; esa compatibilidad histórica no puede certificar una ejecución nueva que debe fallar cerrada. El plan declara los casos del 18 de octubre como datos de prueba y separa cualquier autorización de borrado. |
| E17 | [sales-orders/actions.ts](<../../../../lib/studio/sales-orders/actions.ts#L481>), líneas 481–505 y 551–555; [CN/actions.ts](<../../../../app/studio/(app)/cn/actions.ts#L456>), líneas 456–466, 532–539 y 563–587; [0128_sales_order_invoicing_hardening.sql](<../../../../supabase/migrations/0128_sales_order_invoicing_hardening.sql#L394>), líneas 394–400 | La auto-facturación se dispara después de confirmar la recepción, sin bloquearla. `sales_order_claim_and_invoice` es una RPC existente exclusiva de `service_role`; no equivale a permiso para usar superclave. El hook de CN deriva el tenant de la sesión y el permiso del módulo CN. |

## 3. Contrato de resultado de dominio

El resultado del guardado del documento y el resultado contable son datos distintos. Un transporte exitoso o un `ok: true` del guardado no debe convertirse en una confirmación contable.

| Resultado contable | Significado exigible | Presentación y siguiente paso |
|---|---|---|
| `contabilizado` | La llamada confirmada creó un asiento asentado, íntegro, balanceado y del tenant/origen correctos, con todos sus vínculos exigibles. | Mostrar código e identidad del asiento. Refrescar la proyección. |
| `ya_existente` | Se comprobó un asiento vigente e íntegro para esa misma operación. Un vínculo faltante permitido quedó corregido atómicamente o se verificó que ya era correcto. | Mostrar el asiento existente. No crear otro ni contar esta respuesta como un fallo. |
| `no_contabilizado` | La llamada terminó de forma conocida sin contabilizar ese intento. Si se trata de un fallo registrable de un documento existente, el motivo quedó confirmado fuera del subbloque fallido. | Mostrar motivo seguro y acción correspondiente. No afirmar éxito contable. |
| `estado_desconocido` | No se puede confirmar el resultado completo: timeout, pérdida de respuesta, cancelación, error exterior o imposibilidad de confirmar el registro del fallo. | Mostrar «Estamos comprobando el resultado» o «No se pudo confirmar». Consultar y reconciliar antes de permitir otro intento. |

La propuesta incluye, sujetos a la firma definitiva: identidad de documento y operación, resultado, identificador/código del asiento cuando proceda, código de motivo, mensaje seguro, identificador de correlación y confirmación de si el motivo quedó registrado. `entry_id` o un código aislados no prueban integridad. El contrato debe impedir combinaciones contradictorias, como `contabilizado` sin asiento o `no_contabilizado` con un asiento parcial.

La denegación de permisos o un documento invisible se resuelve antes de producir información contable o modificar intentos. Su respuesta no debe revelar existencia, tenant, importes ni motivos de otro usuario. Un código de correlación sirve para diagnóstico; no concede autorización.

**Ensayo:** debe tener una respuesta de preview diferenciada, con plan/bloqueos y `modo = ensayo`. Nunca devuelve `contabilizado` ni `ya_existente` como afirmación de una nueva escritura. Puede informar que un asiento ya existe, como observación de lectura con su fecha de consulta.

Los actuales `skipped: true` por importe cero, falta de cuenta o duplicado no son intercambiables. La duplicidad válida puede ser `ya_existente`; importe no positivo, falta de cuenta y documento que no admite posting deben clasificarse de forma explícita. El catálogo final de motivos debe distinguir un bloqueo corregible de una inconsistencia que exige revisión, sin exponer errores SQL crudos.

## 4. Frontera transaccional y conservación del motivo

PostgreSQL 17 permite capturar un error en un bloque PL/pgSQL con `EXCEPTION`: revierte los cambios persistentes de ese bloque y continúa en el manejador; las variables conservan valores útiles para clasificar el fallo. Un error dentro del propio manejador se propaga. `OTHERS` tampoco es una garantía de captura de cancelaciones. Estas propiedades sustentan el subbloque propuesto; **no crean una transacción autónoma para el motivo**. [Documentación oficial de PostgreSQL 17](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING).

Orden conceptual, sin implementar SQL:

1. **Autoridad y lectura:** validar actor autenticado, membresía activa, permiso de esta operación y documento del tenant derivado en servidor. Leer el importe, moneda, tasa congelada, fecha, cuentas y estado desde fuentes autorizadas. No aceptar esos valores como hechos por venir del navegador.
2. **Ensayo separado:** si se solicitó preview, ejecutar solo lecturas y validaciones puras, y devolver el plan. No entrar a la rama que crea intentos, verifica una superclave con contadores, reserva códigos o escribe auditoría.
3. **Serialización y revalidación real:** adquirir los candados establecidos por contrato; releer el documento y sus asientos bajo ese régimen. Revalidar estado, permisos, período, cuentas, moneda/tasa y la precondición del preview. Las decisiones del preview no autorizan la ejecución.
4. **Subbloque contable:** incorporar, como una unidad, la creación del asiento y sus líneas, el backlink cuando existe, la evidencia de la excepción de cierre utilizada y toda escritura asociada que afirme éxito contable. Si ya existe un asiento válido, la eventual corrección autorizada de su backlink pertenece a esta misma unidad.
5. **Fallo capturado:** conservar en variables una clasificación segura del error. Revertir las escrituras del subbloque. No ejecutar eliminaciones compensatorias por llamadas independientes.
6. **Registro exterior del fallo:** fuera del subbloque revertido, guardar o actualizar el motivo y el contador aplicables al documento/operación. Devolver `no_contabilizado` solo cuando esa escritura y la llamada exterior terminen de forma confirmada. No relanzar después un error que deshaga el motivo.
7. **Éxito:** retirar el motivo pendiente de esa operación conforme a su política aprobada y confirmar el asiento con sus vínculos. Si esa finalización obligatoria falla, no devolver éxito; la transacción debe mantener una situación coherente que la reconciliación pueda reconocer.

Las validaciones de dominio que detectan un bloqueo antes de insertar líneas pueden producir un resultado normal de fallo y registrar el motivo, sin fabricar una excepción SQL. Los fallos de integridad durante una escritura sí necesitan la reversión del subbloque. El mismo resultado externo debe describir ambos casos de forma consistente.

### 4.1 Qué queda fuera de la garantía de durabilidad

Si falla guardar el motivo, no se debe ocultar el fallo ni afirmar «motivo guardado». Se propone abortar la transacción exterior y emitir un error técnico seguro que el adaptador traduzca conservadoramente a `estado_desconocido` hasta reconciliar. Aunque una respuesta inequívoca de rollback permita saber que esta transacción no confirmó, no prueba por sí sola el estado de otro intento concurrente.

Un fallo de commit, una restricción diferida, una cancelación o la desconexión pueden deshacer el motivo exterior o impedir saber si la llamada confirmó. La propuesta no promete registrar todos esos incidentes dentro de la misma transacción que fracasó. Una futura solución de observabilidad externa sería otro contrato y no es necesaria para fingir aquí una garantía inexistente.

La lista de pendientes debe derivarse también del documento y su falta de asiento válido. **No dependerá exclusivamente de que exista una fila de intentos.** Así puede mostrar «motivo no disponible» cuando el documento está sin contabilizar pero el motivo no pudo guardarse. Esta lectura no demuestra qué pasó en una llamada todavía en curso.

Los mensajes guardados deben ser un catálogo seguro: código de dominio, contexto técnico mínimo y correlación. No guardar claves, tokens, parámetros SQL, nombres personales, recibos crudos o mensajes de DB que incluyan datos de negocio. La clasificación de un conflicto único debe usar la restricción real y el contexto; no tratar cualquier `23505` como «ya existente».

### 4.2 Identidad y ciclo de vida del motivo

La clave lógica debe distinguir al menos tenant, tipo, documento y **operación/origen contable**. Un recibo inicial y su reclasificación no pueden pisarse el último motivo porque comparten `receipt_id`.

`intentos` debe definirse como ejecuciones reales con resultado de fallo registrado, no clics de interfaz, previews ni reenvíos que encuentran un asiento ya existente. Si se desea contar exactamente una solicitud de negocio aun después de reenvíos por timeout, hace falta un contrato de deduplicación de solicitud verificable; el identificador de correlación por sí solo no lo garantiza.

Se mantiene la intención de retirar el motivo pendiente al contabilizar. Antes de implementar hay que fijar si el historial y los contadores sobreviven en otra evidencia o si la tabla representa únicamente el bloqueo actual. No deducir una política de retención a partir de un `delete` conveniente.

## 5. Permisos: reintento manual y posting automático

**Reintento manual y lote:** exclusivamente admin/accounting del tenant autorizado, con membresía activa, validación de servidor/DB y sin acceso directo de escritura a la tabla de intentos. La UI no es una frontera de seguridad. Debe decidirse cómo se combina ese requisito de rol con una revocación de edición vigente; nunca convertir un override de otro rol en permiso nuevo de reintento.

**Posting automático:** conservar los permisos ya establecidos para crear/editar cada documento. Gastos y el hook de CN incluyen operadores que no tienen por qué adquirir una facultad general de reasentar documentos. No basta con convertir todos los callers a una RPC que solo acepte contabilidad: eso rompería operaciones que hoy son válidas. Tampoco se puede abrir la RPC genérica a esos roles para compensarlo.

Se propone un núcleo interno no ejecutable directamente por clientes y entradas autenticadas acordes con cada flujo. La entrada manual exige el rol contable; la entrada de negocio comprueba el permiso existente del documento y llama al núcleo dentro de su autoridad. No aceptar `modo = automatico`, `tenant_id` ni `actor_id` del cliente como credenciales de esa autoridad.

Los posters actuales usan un cliente `service_role`. Esa credencial prueba la identidad técnica del servidor, no la identidad humana ni la legitimidad de una operación. El contrato nuevo debe preservar la sesión autenticada verificable o una composición de funciones internas que ya la haya comprobado. Un adaptador privilegiado no puede inferir autoridad a partir del ID recibido ni confiar en una identidad reenviada por el navegador.

0566 limita expresamente las funciones que reciben la superclave: no deben ganar `EXECUTE` para `service_role` como atajo. La composición del posting automático con una excepción de cierre exige una entrada autenticada gobernada. Debe verificarse el conjunto final de grants/revokes y `search_path`, además de los tests por rol. La propuesta no amplía roles, no cambia RLS ni determina que una clave suplanta un permiso faltante.

En particular, la autoridad técnica que ya tiene `sales_order_claim_and_invoice` puede conservarse para su automatización existente, con validaciones de origen y período, pero **no se interpreta como una excepción de cierre**. Si el disparador no aporta un contexto humano autorizado para tramitarla, la operación financiera queda bloqueada y se deriva al flujo gobernado. El contexto de actor/auditoría para ese caso debe cerrarse expresamente; no se inventa un usuario contable a partir de `service_role` ni se amplía el rol CN.

## 6. Ensayo con cero escrituras

El ensayo debe usar las mismas reglas de cálculo, fechas, permisos, cuentas y elegibilidad que la ejecución, pero una rama sin efectos persistentes. No basta con ejecutar la operación y hacer rollback al final.

La comprobación futura debe comparar antes/después: intentos contables, cabeceras, líneas, backlinks, documentos, auditoría, excepciones de cierre, contadores/bloqueos de superclave y correlativos. Tampoco debe consumir un número mediante un allocator con efectos ni disparar una notificación/outbox.

Los valores consumidos por secuencias no se recuperan necesariamente al abortar. Por eso un supuesto «ensayo con rollback» puede alterar el estado aun sin filas nuevas. [Funciones de secuencia de PostgreSQL 17](https://www.postgresql.org/docs/17/functions-sequence.html).

El ensayo informa que una operación necesita una excepción gobernada, pero no comprueba una superclave mediante el verificador con contadores ni la considera previamente autorizada. No crea nonce, evidencia de autorización ni reserva de cupo. La ejecución vuelve a verificar todos esos elementos.

Para el preview se pueden mostrar líneas proyectadas y totales, sin prometer el código definitivo del asiento. El preview debe identificarse como una lectura fechada; no bloquea cambios de terceros ni garantiza que la ejecución posterior aún sea admisible.

## 7. Idempotencia, vínculos y timeout ambiguo

### 7.1 Identidad de un asiento que cuenta como resultado

Usar tenant + origen + ID de documento/operación. La clave de CxP debe usar el origen real `supplier_bill`. Cobro inicial y reclasificación son orígenes distintos.

Un asiento que permite responder `ya_existente` debe estar `asentado`, sin borrar, con líneas válidas y balanceadas, pertenecer al tenant/documento correcto y tener los vínculos exigibles. La definición de E11 es más estricta que «no anulado».

Los índices únicos pueden tener un predicado más amplio para impedir duplicados reservados o borradores; eso no convierte esos borradores en asientos contabilizados. Debe conciliarse el predicado nuevo con el índice ya existente de gasto. Un encabezado vacío, un borrador inesperado, dos candidatos o un vínculo a otro origen exigen un motivo de inconsistencia, sin reparaciones históricas implícitas.

Para factura y gasto se valida el FK desde `journal_entries`; no se añade un backlink por conveniencia. Para CxP, pago y recibo se valida también el `journal_entry_id` aplicable. El backlink del recibo inicial **no se sustituye por su reclasificación**. Religar un backlink ausente solo es seguro si el candidato único ya es válido y del origen correcto; un vínculo contradictorio se bloquea para revisión.

### 7.2 Concurrencia y códigos

El candado del documento debe coordinarse con sus mutaciones y con la anulación de 0573. Para factura, 0573 toma primero la fila de factura; el contrato nuevo debe fijar un orden compatible, evitando que un reintento cree un asiento después de que esa factura se anuló.

La reserva/generación de código y la inserción deben estar dentro de la misma transacción real. Un advisory lock liberado al acabar una llamada separada al generador no protege la inserción posterior. La clave de serialización debe identificar el ámbito compartido antes de generar el código; no depender de un código candidato que ya pudo competir.

Un candado usado solo por 0575 **no serializa escritores que no lo usan**. La rama 0573 consultada reintenta el choque de código, y el generador observado de main usa `max + 1`. Deben mantenerse la restricción única y un comportamiento acotado ante conflictos, identificando la restricción concreta antes de decidir reintentar. No absorber una violación de unicidad del origen como si fuera únicamente un choque de numeración.

La numeración actual usa el año de `current_date`. La política final debe verificar coherencia y paridad para fechas históricas y el cambio de año; no se autoriza cambiar silenciosamente la numeración como efecto lateral de arreglar el posting.

### 7.3 Respuesta perdida o timeout

Si el cliente pierde la respuesta, no debe concluir «falló y no escribió». Debe consultar con la misma identidad de operación y permiso. Si existe el asiento válido, converge a `ya_existente`; si la primera operación sigue activa, no se debe tomar una ausencia momentánea como autorización para duplicar.

El reintento real vuelve a tomar el candado y a comprobar la unicidad antes de escribir. La UI no dispara reintentos automáticos indefinidos. Un lock timeout produce un resultado transitorio seguro; se conserva el límite del lote y se informa qué documentos siguen sin confirmar.

Las pruebas deben cubrir tanto «commit realizado y respuesta perdida» como «rollback y respuesta perdida», además del caso concurrente. Tener idempotencia contable no garantiza que un contador de solicitudes sea exactamente una vez; son contratos separados.

## 8. Período cerrado, 0566 y fecha de Caracas

Se conserva el bloqueo salvo excepción gobernada y se conserva la fecha solicitada. La regla de 0573 que coloca un **reverso** en un período abierto no se transfiere a la creación de un asiento pendiente.

### 8.1 Composición de la excepción

0566 en la base leída cubre RPC de asientos manuales. Reusar su modelo para estos documentos exige una extensión contractual explícita: mismo actor autenticado, tenant, motivo, política, nonce, transacción y trazabilidad de la operación concreta.

Una composición viable por revisar es invocar la autorización gobernada dentro del subbloque contable antes de las escrituras que requieren la excepción. Si la clave es incorrecta y el helper devuelve un resultado normal, no se debe lanzar luego una excepción que borre los contadores de seguridad: se sale sin crear contabilidad y se confirma el fallo gobernado. Si la clave es válida y se registra la excepción pero fallan las líneas o el vínculo, el subbloque revierte también la excepción que no se consumó.

No se recomienda inventar un nuevo verificador ni mover la autorización fuera de su transacción. Debe comprobarse la composición exacta con los helpers de 0493: operaciones permitidas, orden de creación de identidad/código, limpieza del contexto local y comportamiento ante fallo del registro exterior. Un fallo exterior también puede revertir contadores de esa transacción; no se debe prometer una durabilidad separada que 0566 no ofrece.

El modo de cierre vigente y la ausencia de clave no pueden convertirse en bypass. El ensayo no verifica claves. La función nueva no recibe permiso por `service_role` para las funciones que actualmente lo prohíben.

### 8.2 Guardar el documento antes de contabilizar es una frontera distinta

E07–E10 muestran que varias acciones ya confirmaron el documento cuando empieza el poster. **Una RPC contable posterior no puede revertir ese guardado anterior.** Agregar solo una validación en la app y otra en el poster no prueba «sin excepción no se guarda la operación bloqueada»: hay una carrera entre ambas transacciones.

El contrato de 0575-a debe prever la guarda autoritativa de período en la mutación de origen, y 0575-b debe utilizarla. La guarda y esa mutación necesitan un régimen de bloqueo/revalidación compatible con el cambio del cierre. Las escrituras directas de factura, CxP, recibo sin referencia y gasto requieren revisar esa frontera, además de las RPC de cobro, identificación y pago existentes.

Debe fijarse expresamente el caso en que el período cambia después de un guardado permitido y antes de contabilizar: la RPC contable vuelve a bloquear y el documento queda visible como pendiente. Esa secuencia no puede presentarse como una única transacción que revierte todo. Si el contrato final exige que el guardado y la decisión contable de cierre sean inseparables, será necesario orquestarlos en la misma transacción de origen, preservando la RPC/núcleo por documento y las reglas de negocio existentes.

Esto es un **bloqueador de contrato y allowlist**, no autorización para ampliar producto ahora. La futura 0575-a debe contener la capacidad de DB que 0575-b realmente consumirá; no se puede mantener «b sin migración» mientras se deja sin definir esa capacidad.

También debe fallar cerrado la ausencia de la capacidad/esquema requerido. El fallback histórico de `period-queries.ts` para una tabla ausente puede servir a una consulta antigua; no prueba que sea seguro guardar bajo el contrato nuevo.

### 8.3 Matriz de la transacción necesaria por flujo

«Transacción propia» en esta tabla significa una entrada DB que pueda abarcar las escrituras de esa operación. Varias llamadas PostgREST desde una server action no se vuelven una transacción por estar dentro de la misma función TypeScript.

| Caso y frontera observada | ¿La RPC nueva de un documento existente basta? | Capacidad/caller que debe revisar el contrato |
|---|---|---|
| Reintentar un documento ya persistido, sin cambiar su negocio. | **Sí**, para asiento, vínculo, motivo e idempotencia. No deshace una operación de negocio antigua. | Nueva RPC de retry con autoridad admin/accounting; revalidación de origen y período. La lista no autoriza el retry por sí sola. |
| Crear factura emitida o emitir un borrador: inserción/actualización directa en Facturación, seguida del poster (E09). | **No** para impedir el guardado inicial en cierre. | Entrada transaccional nueva o composición DB equivalente para guardar/emitir con la guarda autoritativa. Adaptar `app/studio/(app)/facturacion/actions.ts`; conservar requisitos legales y la política separada de un borrador que no genera asiento. |
| Auto-factura desde recepción CN: `sales_order_claim_and_invoice` ya reclama y crea factura atómicamente; posting fuera (E17). | **No** para el cierre de la factura que la RPC ya creó. | Extender la RPC existente mediante la nueva migración, conservando claim, gates, denominador y permisos actuales; adaptar `lib/studio/sales-orders/actions.ts` y el consumo del resultado en `app/studio/(app)/cn/actions.ts`. No abrir la superclave a `service_role`. |
| Cobro aplicado: `register_collection_receipt` confirma recibo y saldo antes del poster (E07/E15). | **No** para devolver el recibo/saldo previo ante bloqueo del guardado. | Extender esa RPC de negocio con la guarda/composición aprobada y adaptar `collections-actions.ts`. Conservar el lock de factura y la identidad autenticada. |
| Cobro sin referencia: código e inserción directa en `payment_receipts` (E07). | **No** para su creación. | Entrada transaccional nueva para código/recibo/guarda y eventual núcleo contable; adaptar el mismo consumidor. Conservar puente y fondos de terceros. |
| Identificación: `identify_collection_receipt` aplica el recibo a la factura antes de reclasificar (E07/E15). | **No** para impedir una aplicación en cierre o revertir una ya confirmada. | Extender la RPC existente y su caller; validar la fecha del cobro y la evidencia del asiento inicial. Fijar atómicamente qué aplicación/reclasificación admite el contrato. |
| Crear CxP: código e inserción directa de `supplier_bills` (E08). | **No** para su guardado. | Entrada transaccional nueva con permiso de Tesorería y guarda; adaptar `treasury-actions.ts`. `supplier_bill` sigue siendo el origen contable. |
| Pago a proveedor: `register_supplier_payment_order` guarda pago y saldo antes del poster (E08/E15). | **No** para impedir el pago de negocio en cierre. | Extender la RPC de negocio y el caller; preservar sus candados, moneda congelada y permisos. |
| Crear gasto web/móvil: inserción directa después de una guarda en app (E10). | **No** para su guardado inicial. | Entrada transaccional nueva o composición equivalente con el permiso/ámbito actual del operador y la guarda; adaptar ambos callers, sin conceder reintento manual al operador. |
| Editar gasto: actualizar documento, anular asiento viejo y crear el nuevo son pasos separados (E10). | **No** para la edición/sustitución completa. | Definir una operación transaccional propia que coordine versión del gasto, asiento anterior y sustituto. El contrato debe decidir qué se conserva ante un fallo; no presentar la llamada al nuevo poster como atomicidad de los tres pasos. |

Para las entradas nuevas, la implementación no puede conservar un camino de escritura alternativo que eluda la guarda y aun así afirmar protección de DB. El inventario de permisos/RLS y rutas de escritura debe fijar cómo se hace efectiva la frontera, sin ampliar privilegios ni retirar los permisos de negocio legítimos.

Si el cierre bloquea la creación antes de que exista un documento, el resultado de negocio es «no guardado». No se crea un pendiente ficticio ni una fila de intentos que afirme apuntar a un documento existente. La conservación de un motivo por documento se aplica a documentos persistidos; cualquier registro de solicitudes sin documento requeriría su propio contrato.

La consolidación CN ya es independiente y se confirma antes del hook financiero. Mantener la facturación bloqueada no equivale a deshacer la consolidación ni autoriza cambiar esa operación de almacén. El resultado visible debe separar «recepción consolidada», «factura creada/no creada» y «asiento contabilizado/no confirmado».

Los efectos externos a DB, como archivos de comprobantes o correo, no pasan a ser reversibles por introducir una RPC. Esta entrega no modifica su política ni promete una transacción que los incluya; la allowlist de consumidores debe mantener esa frontera visible.

### 8.4 Fecha y dependencias

Una fecha de negocio ya almacenada como `DATE` se conserva. Cuando el origen es un instante, debe aplicarse la política Caracas integrada; no un `.slice(0, 10)` UTC por comodidad. Reclasificar conserva la fecha económica del cobro original y su base monetaria, sin usar automáticamente «hoy».

No se identificó en esta lectura acotada un SHA integrado que cierre el contrato general de Caracas para emisión y posting. La SDD-0572 lo declara fuera de su alcance y el plan lo exige. Por tanto, **identificar/revisar/integrar ese contrato queda pendiente**. No se crea una SDD ni una regla nueva de calendario desde este documento.

## 9. Paridad contable de los cinco posters

El contrato incluye cinco módulos y siete variantes mínimas. La migración a SQL no debe cambiar cuentas, titularidad de fondos, moneda funcional, IVA ni política de ingreso como efecto lateral.

| Módulo / variante | Regla observada que debe tener fixture de paridad | Condición adicional |
|---|---|---|
| Factura | Debe CxC `1.1.2` por total; haber ingreso `4.5` por base e IVA `2.1.5` cuando corresponde. | Se conserva la política nominal de la etapa vigente; la conversión de factura queda fuera hasta el contrato que la sustituya. Verificar balance y redondeo de base/IVA/total. |
| Cobro aplicado | Debe cuenta de caja/banco seleccionada; haber CxC `1.1.2`. | Conversión canónica de la dependencia integrada, tasa congelada y cuenta imputable del mismo tenant. |
| Cobro sin referencia | Debe caja/banco; haber puente `2.1.8`. | No convertirlo en ingreso ni reducir CxC antes de identificarlo. Preservar la clasificación de fondos autorizada. |
| Reclasificación de cobro | Debe puente `2.1.8`; haber CxC `1.1.2`. | Mismo cobro, base monetaria y fecha económica. Exige justificar el asiento inicial correspondiente y no cambiar su backlink. |
| CxP | Debe cuenta de gasto/imputación; haber CxP `2.1.1`. | Origen real `supplier_bill`; conversión/tasa según 0572 integrada. |
| Pago a proveedor | Debe CxP `2.1.1`; haber caja/banco seleccionado. | Misma moneda/tasa congelada del contrato de negocio, sin fallback inventado. |
| Gasto | Debe cuenta imputada; haber contrapartida por método (`cash`, `transfer`, `card`, `usdt`). | `amount_usd` ya es importe funcional. No dividirlo otra vez. Incluido en 0575-a y en UI/reintento, no diferido. |

La reclasificación requiere especial cuidado si el recibo se identificó mientras faltaba el asiento inicial: el estado actual del recibo no basta para inferir qué flujo original se ejecutó. Debe reconstruirse solo desde la evidencia autorizada que el contrato defina, o bloquear con un motivo explícito. Crear directamente CxC y luego reclasificar también el puente puede duplicar el efecto. No se autoriza reconstrucción histórica especulativa.

Las reglas de redondeo JS/SQL requieren fixtures de límites y centavos. Deben cubrir tasas ausentes/no positivas, moneda no admitida, importes no finitos/no positivos y cuentas de otro tenant/no imputables. La nueva implementación debe leer la tasa congelada de la operación: no consultar la tasa de hoy para corregir un asiento pasado.

Editar gasto hoy anula el asiento anterior antes de sincronizar el nuevo. La RPC nueva no vuelve atómico ese par si se conserva el diseño en dos llamadas. El contrato debe delimitar la sustitución autorizada del gasto, su estado anterior, motivo de fallo y resultado visible, sin ampliar silenciosamente a los reversos de los demás dominios.

## 10. Lote acotado y revalidación al ejecutar

«Asentar pendientes» debe operar sobre una selección explícita y limitada de documentos, no sobre una consulta abierta que cambie mientras se ejecuta. La cifra máxima y la concurrencia deben fijarse antes de implementar; se propone como punto de revisión un máximo inicial de 25 documentos y una ejecución a la vez, sin convertir esa cifra en una decisión ya aprobada.

El preview devuelve candidatos, bloqueados, ya existentes y la versión/precondición pertinente de cada documento. La confirmación usa esa selección; cada RPC vuelve a validar permiso, tenant, estado, fecha/cierre, importe/tasa/cuentas y vínculo. Un cambio relevante invalida el plan de esa fila y obliga a revisar su resultado, sin aplicar automáticamente una contabilización diferente a la confirmada.

La unidad atómica es cada documento/operación. Un lote puede terminar parcialmente; su resumen muestra contabilizados, existentes, bloqueados, fallidos y desconocidos por separado. Cancelar deja de iniciar nuevas llamadas, pero no afirma que una llamada en curso haya sido revertida.

El botón no debe repetir indefinidamente los desconocidos. Primero se reconcilian. Un único recibo que necesita resolver el asiento inicial y la reclasificación requiere un orden explícito o una operación documental que contemple ambos eventos; no dos filas independientes cuya ejecución pueda invertirse.

## 11. Dependencias y contradicciones que impiden cerrar el contrato

Los siguientes estados son de refs locales consultadas, no prueba de despliegue ni de producción. No se ejecutó fetch ni auditoría de PR/CI en esta subtarea.

| Elemento | Evidencia y estado | Consecuencia para 0575 |
|---|---|---|
| 0572 / conversión | Rama `codex/sdd-0572-conversor-usd-reemplazos`, SHA `9c254107c7c1b9544bf91ebff177ab790b438f5f`; no es ancestro de `main` `8e9e0f50`. Spec `docs/specs/0572-conversor-usd-reemplazos/spec.md` y cambios de receipt/bill/payment consultados. | Esperar su base integrada y la dependencia canónica 0569. Comparar SQL con ese contrato, no con el fallback nominal de main observado. Factura y gasto conservan sus límites expresos. |
| 0573 / anulación | Rama `codex/sdd-0573-reverso-al-anular`, SHA `89f15a5dcb9c9047e9a289fd499563c201ab5701`; no es ancestro de esa main. `supabase/migrations/0497_reverso_al_anular_factura.sql`, líneas 154–160, 181–199 y 212–235, consultadas desde la ref. | El asiento original sigue asentado y el reverso tiene `source = invoice_reversal` y `reverses_entry_id`. Reintentar debe validar la factura y su reverso, coordinar el lock de la factura y no reasentar una anulada. No copiar la fecha del reverso al posting normal. |
| Caracas | Plan, línea 824; UTC aún presente en posters/emisión observados. 0572 excluye la tarea general de fechas. | Contrato/SHA integrado por identificar. Casos de borde de día, mes y año quedan obligatorios para la implementación futura. |
| 0566 | Spec y migración 0493 presentes en main. La spec delimita el alcance manual y los permisos de clave. | Presencia en Git no prueba aplicación en DB. Hay que cerrar la composición automática y sus grants sin degradar el gobierno. |
| Origen de CxP | Spec 0575 enumera `bill`; poster y esquema usan `supplier_bill`. | Corregir el contrato antes de crear índices, búsquedas y preflight. No migrar datos a un nuevo nombre por accidente. |
| Unicidad de gasto | Spec menciona ausencia general de índice de origen salvo referido; 0132 ya crea `je_one_live_entry_per_expense`. | Inventariar/reusar o conciliar ese índice. No crear un diseño incompatible ni declarar que gasto carece de protección. |
| Asiento vivo | Spec: no anulado/no borrado; E11: asentado/no borrado. | Separar predicado de unicidad y prueba de contabilización. Un borrador no permite devolver éxito. |
| `ok`, saltos y vínculos | E02–E10 muestran `ok: true` con saltos, errores solo en consola y backlinks sin comprobar. | El tipo de resultado debe recorrer todos los consumidores, incluidas ventas y gastos web/móvil. Cambiar solo los cinco posters no elimina el silencio. |
| Guardado/cierre | Documentos ya confirmados antes del poster; chequeo previo de app no es transaccional. | Cerrar la frontera de escritura de origen y su allowlist en 0575-a/b. |
| UI y tipos | Por contabilizar tiene cuatro tipos y cálculo específico para reclasificación. | Incluir gasto y separar eventos del recibo; evitar ocultar un fallo porque ya existe otro asiento del mismo recibo. |

La 0497 ya pertenece a 0573; este documento no la reserva ni propone editarla. Las migraciones históricas citadas son evidencia. Cualquier cambio nuevo irá en una migración futura con número pendiente y sobre la base final, sin renumerar ni modificar una aplicada.

## 12. Criterios verificables para la implementación futura

**Todos los ensayos de esta sección: NO EJECUTADOS en esta entrega.** Son criterios propuestos; no resultados ni cobertura certificada.

| ID | Ensayo / fallo inducido | Resultado exigible |
|---|---|---|
| C01 | Fallar al insertar líneas después de insertar cabecera. | Ninguna cabecera/línea/vínculo parcial del intento. Motivo consultable del tenant autorizado si la transacción exterior confirma. |
| C02 | Fallar al completar el backlink de recibo, CxP o pago. | Se revierte la unidad contable completa. No éxito aparente por tener cabecera y líneas. Motivo exterior confirmado. |
| C03 | Fallar también al guardar el motivo o al confirmar la transacción exterior. | Sin promesa de motivo durable. Resultado técnico seguro/desconocido y reconciliación. Nunca `contabilizado` por un retorno intermedio. |
| C04 | Ejecutar preview de cada variante, incluida fecha cerrada y clave incorrecta suministrada. | Cero cambios en documentos, intentos, asientos, líneas, auditoría, excepciones, correlativos y contadores de clave. La clave no se verifica por el camino con efectos. |
| C05 | Dos reintentos simultáneos del mismo origen; respuesta perdida tras commit y tras rollback. | A lo sumo un asiento válido. Convergencia a existente o fallo conocido tras reconciliación; ningún duplicado ni reintento infinito. |
| C06 | Colisión de código concurrente con otro escritor; violación distinta de unicidad. | Retry acotado solo donde corresponde. No confundir origen duplicado, reverso duplicado o cualquier otra restricción con un choque de código. |
| C07 | Asiento borrador, anulado, borrado, vacío, duplicado o con backlink cruzado. | Ningún falso `ya_existente`. Motivo explícito. No reparación de datos históricos implícita. |
| C08 | Siete variantes de la tabla de paridad, con redondeo, IVA, fondos y tasas límite. | Líneas/importe/fecha iguales al contrato integrado aplicable. Ausencia de tasa no usa nominal, cero ni tasa de hoy. Gasto no reconvierte USD. |
| C09 | Reclasificación repetida y cobro identificado sin asiento inicial válido. | No sobrescribir backlink inicial ni duplicar CxC/puente. Orden y evidencia de origen exigidos; bloqueo cuando no se puede reconstruir con certeza. |
| C10 | Roles legítimos y no legítimos, membresía revocada, tenant/actor falsificados y documento ajeno. | Manual solo roles autorizados; operadores conservan únicamente su flujo existente. Cero efectos e información ajena para accesos denegados. |
| C11 | Cierre sin excepción; con excepción válida; clave errónea; cierre que cambia entre preview y ejecución. | Bloqueo real en la mutación pertinente; fecha intacta. Contadores de clave según 0566. Excepción consumada solo si se concreta la escritura autorizada. |
| C12 | Carrera entre guardado de origen y cambio del cierre; anulación 0573 contra retry 0575. | Resultado conforme a la frontera transaccional aprobada. Ningún asiento nuevo sobre una factura anulada. No presentar dos transacciones como una. |
| C13 | Fecha cerca de las 20:00 de Caracas, cambio de mes/año, fecha histórica y reclasificación. | Política integrada de Caracas aplicada una sola vez; fecha económica conservada y numeración según contrato explícito. |
| C14 | Lote parcialmente válido, permisos/datos cambiados, cancelación y un resultado desconocido. | Revalidación por fila, límite aplicado y resumen exacto; no «todo asentado» si falta confirmar una fila. |
| C15 | Tabla de intentos sin fila o motivo no guardado; gasto pendiente; reclasificación pendiente con recibo inicial correcto. | La lista sigue detectando el faltante a partir de documento/asiento. No depende solo de intentos ni oculta gasto/reclasificación. |
| C16 | Mutantes que ignoran errores de vínculo, consideran cualquier header existente, devuelven éxito desde catch o escriben durante ensayo. | Los contratos detectan cada debilitamiento. Ejecutar en el turno de recursos autorizado, no en esta revisión. |

El cierre de producto exigirá las comprobaciones canónicas y evidencia del SHA real, además de los contratos PGlite/Docker que la SDD pide. Ninguna prueba local sustituye una decisión de aplicación de migración o una comprobación de producción autorizada.

## 13. Archivos previsibles por PR — clasificación provisional

Esta sección **no es la allowlist exacta aprobada**. Separa rutas observadas de candidatos nuevos. Las rutas con nombre propuesto pueden cambiar tras fijar la base integrada. Cada PR debe congelar su lista antes de editar; no se autoriza una familia completa de directorios.

### 0575-a — Contrato y capacidad de DB para los cinco tipos

| Clasificación | Ruta o grupo de rutas | Motivo |
|---|---|---|
| Nueva, número pendiente | `supabase/migrations/` → un archivo nuevo de 0575 cuyo nombre y número aprobará el Director. | Intentos, unicidad/preflight, RPC/núcleo, permisos, cierre/autoridad y capacidades de origen que consumirá b. Incluye gasto y reclasificación. |
| Nuevas, nombres pendientes | `supabase/tests/` → contrato SQL de la migración; `lib/studio/__tests__/` → contrato PGlite correspondiente. | Invariantes C01–C16 pertinentes a DB, permisos, persistencia, paridad y concurrencia donde el arnés realmente la soporte. |
| Condicionales, rutas por inventariar | Fixtures/registradores de migraciones y del contrato Docker usados por el arnés vigente. | Solo si el arnés requiere incorporaciones; no asumir una ruta ni modificar infraestructura ajena sin la allowlist. |
| Existentes, documentación de tarea | `docs/specs/0575-asientos-sin-fallos-silenciosos/spec.md`, `docs/specs/README.md` generado, `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md`. | Contrato cerrado, decisiones aceptadas, cobertura real y pendientes. |

Los cambios de funciones históricas se expresarían en la nueva migración. No editar 0078, 0132, 0467, 0468, 0493 ni 0497 para simular que nunca tuvieron el comportamiento anterior. El preflight de duplicados es parte del contrato futuro; no autoriza lectura de producción ahora ni corrección automática.

### 0575-b — Adaptadores y resultados visibles al guardar

| Clasificación | Rutas observadas / candidatas | Motivo |
|---|---|---|
| Existentes, núcleo previsto | `lib/studio/accounting/invoice-posting.ts`, `receipt-posting.ts`, `bill-posting.ts`, `supplier-payment-posting.ts`, `expense-posting.ts`. | Sustituir la persistencia fragmentada por la RPC, conservar cálculo/contrato integrado y propagar resultados. |
| Nueva, nombre propuesto | `lib/studio/accounting/posting-result.ts` o la ubicación de tipos compartidos aprobada. | Unión de resultados y adaptador común sin ocultar errores. La necesidad y el nombre siguen provisionales. |
| Existentes, consumidores observados | `lib/studio/collections-actions.ts`, `lib/studio/treasury/treasury-actions.ts`, `app/studio/(app)/facturacion/actions.ts`, `lib/studio/sales-orders/actions.ts`, `app/studio/(app)/cn/actions.ts`, `app/studio/(app)/gastos/actions.ts`, `app/m/erp/actions.ts`. | Preservar autoridad, usar la capacidad de cierre integrada y devolver el resultado contable al usuario, incluido gasto editado y factura de ventas. CN consume el resultado de auto-facturación sin convertirlo en permiso contable general. |
| Condicionales, consumidores de resultados | `app/studio/(app)/cobranzas/actions.ts`, `app/studio/(app)/tesoreria/actions.ts` y los formularios/clientes que hoy consumen cada resultado. | Deben inventariarse por firma final. Cambiar solo las acciones de servidor no asegura que el aviso sea visible. |
| Existentes/nuevas, pruebas por fijar | Tests de los cinco adaptadores, de las acciones y de la presentación del resultado. | Verificar paridad, permiso de operadores, fallos visibles y resultado desconocido. No sustituir contratos de DB por mocks que siempre devuelvan éxito. |
| Existentes, documentación de tarea | Spec, índice generado y handoff de 0575. | Evidencia y límites del cambio de consumidores. |

No se prevé migración en b **solo si a deja integradas todas las capacidades necesarias**. Si el contrato final revela una capacidad faltante, detener y revisar el reparto antes de editar; no esconder ese trabajo como ajuste menor de la app.

### 0575-c — Sección de pendientes y ejecución controlada

| Clasificación | Rutas observadas / candidatas | Motivo |
|---|---|---|
| Existentes, UI | `app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx`, y según el contrato de props `ContabilidadClient.tsx` y `app/studio/(app)/contabilidad/page.tsx`. | Sección dentro de la pantalla decidida; estados, preview, confirmación y resumen por fila. |
| Existentes, proyección | `lib/studio/accounting/libro-control.ts`, `lib/studio/accounting/libro-control-queries.ts`. | Conciliar asiento vivo, gasto y operaciones de recibo, sin romper el cuadre existente. |
| Nueva o existente, por elegir | Acción/consulta específica de reintento dentro del área contable; si se usa `app/studio/(app)/contabilidad/actions.ts`, fijar su alcance exacto. | Permiso explícito admin/accounting, lote acotado, revalidación y reconciliación tras timeout. |
| Existentes/nuevas, pruebas | `app/studio/(app)/contabilidad/__tests__/por-contabilizar.test.tsx`, `lib/studio/accounting/__tests__/libro-control.test.ts`, `lib/studio/accounting/__tests__/libro-control-queries.test.ts` y contratos nuevos estrictamente necesarios. | Cinco tipos, reclasificación, ausencia de motivo, estados desconocidos y resultado parcial del lote. |
| Existentes, documentación de tarea | Spec, índice generado y handoff de 0575. | Cierre trazable, limitaciones y estado de conocimiento por separado. |

## 14. Revisión pendiente y límites finales

Antes de autorizar implementación, el Director debe cerrar: base final de 0569/0572/0573 y Caracas; autoridad de posting automático frente al retry manual; composición con 0566 y guardado de origen; definición de asiento válido/índices; identidad y retención del motivo; protocolo de resultado/timeout; operación del cobro identificado sin asiento inicial; límites del lote; firmas y allowlist exacta de cada PR; número reservado de migración.

Esta propuesta no demuestra que esos contratos estén implementados. Las consultas de refs solo describen el estado local leído. La presencia de 0493 en Git no prueba su aplicación real. No se comprobó producción ni se abrieron filas de negocio.

**Estado de la revisión original:** lectura documental y de código e inspección de SHA/hashes realizadas; su única escritura fue el temporal fuera de Git. Pruebas, lint, build, verify, DB, migración, implementación y publicación de producto: NO EJECUTADOS. El [handoff de la tarea](../../../../.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md) registra por separado la conservación documental, su validación y su publicación en rama.

## Anexo A. Hashes de bytes de las fuentes centrales

SHA256 calculados localmente durante esta revisión. Los caminos son relativos a la raíz del repositorio; el encabezado distingue la base main de lectura y la rama 0575. Los dos últimos hashes corresponden a la spec/handoff en el HEAD de lectura `b4bd7cc2`, antes de esta incorporación documental, no a sus bytes posteriores.

| Archivo | SHA256 |
|---|---|
| `lib/studio/accounting/invoice-posting.ts` | `d5d2f73c870a03cbd37715eb3331fce697fa0cdf60d86e3dcef85d3ed5a20982` |
| `lib/studio/accounting/receipt-posting.ts` | `7af8cbeec0871fa590b73b8392bc872b0119bfe9df0102d1c2e6e9ea5e7bc58d` |
| `lib/studio/accounting/bill-posting.ts` | `23aca5d8e7bc6ebb94a64a7a9b1ff91843aa22af0c3555dcd9b9138d1e7478ec` |
| `lib/studio/accounting/supplier-payment-posting.ts` | `cf99d3932e8999869beec33b9702cc1015a12dc27e292b00d553f1483f4f9c6b` |
| `lib/studio/accounting/expense-posting.ts` | `0413f6993c9a77e9c1ae113cd8420f561f267ff55fafc4444bfd47c2ae2a9f26` |
| `lib/studio/collections-actions.ts` | `0289d9306926999de7e868a4c72c09b65993cff58a50c1d02330407b45a16da1` |
| `lib/studio/treasury/treasury-actions.ts` | `b02019220c54c5139f3604ccd12d052aa980bfab99a21e0f630987adf1efbd20` |
| `app/studio/(app)/facturacion/actions.ts` | `091e0503461727fad55e61b7948f459e943a7992b4a8a9c852da8ae76a82070d` |
| `lib/studio/sales-orders/actions.ts` | `3c72ed7c0e0ebe63842f08d5696f1102d54c6486075b6113f5eb95d922c1c782` |
| `app/studio/(app)/gastos/actions.ts` | `9525cad17f1eb28a54e7fc4dec1f314a2a79c6257b3ca9f5dbc1fa73d91145e5` |
| `app/m/erp/actions.ts` | `f1ba20676b58bf307a0bdcdfa0a0620be2582316917685225291928697519299` |
| `lib/studio/accounting/libro-control.ts` | `b186644358b1cdce317b2a9716cc871059bc2e6bee302ea30368b9f331a5e34f` |
| `supabase/migrations/0493_cierre_contable_superclave.sql` | `603a78db5ef8af008c8aa7061de5321ad06038b1c867d61500494ad3035f7374` |
| `app/studio/(app)/cn/actions.ts` | `659911c6980dcf53c429573ecc471515cd16ef8e858c2d33829386f0b6a7bf4c` |
| `supabase/migrations/0128_sales_order_invoicing_hardening.sql` | `a55968bb725bae3a8150d25afd767e7baaed90b33292a88c2c9ef2b3e366bed3` |
| `docs/specs/0575-asientos-sin-fallos-silenciosos/spec.md` (worktree 0575) | `cd865d3f416383d24b500e329ca1388dec6b2f3122ba36f24e6bb19a84d3cd80` |
| `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md` (worktree 0575) | `97a09ca56ce7afe4ef9c3b543423aca793934bc00dfa8721ea99fcde334956eb` |
