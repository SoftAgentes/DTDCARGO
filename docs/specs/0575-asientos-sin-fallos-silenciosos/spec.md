---
sdd: "0575"
title: "Asientos sin fallos silenciosos: lo que no se asienta se ve, se explica y se puede asentar"
status: draft
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0557", "0559", "0566", "0572", "0573"]
confidencialidad: interno
---

# SDD-0575 — Asientos sin fallos silenciosos

> La 2.2 del plan contable (cierra B3): «Asientos sin fallos silenciosos: tabla de fallos con pantalla «Asientos no creados» y «asentar pendientes»; lock en `next_entry_code`; unicidad por origen; guard de período visible en Cobranzas y Tesorería» (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md:825`).

**Estado: DISEÑO con decisiones del Director registradas el 2026-10-20, revisables por Sam.** Este registro documental no aprueba ni completa la implementación. Antes de implementar faltan los contratos verificables, la allowlist exacta de cada PR y el número de migración, pendiente del inventario y la reserva del Director.

La [propuesta de contrato transaccional](assets/contrato-transaccional-propuesto.md) conserva la revisión de código sobre `main` `8e9e0f505322cd57b3230cce6b16b45b5554cb8a`, sus referencias y límites. La dirección técnica resumida abajo fue revisada por el Director; las firmas, permisos finales, capacidades de origen, listas de archivos por PR y base integrada siguen propuestas que el Director cerrará con el Worker antes de producto. La incorporación documental queda sujeta a revisión de su diff.

## Qué cambia para Sam

Hoy, cuando un documento no se asienta, nadie se entera. La factura, el cobro, la CxP o el pago se guardan, pero el asiento no se crea y el error se pierde en el log. Solo la pestaña «Por contabilizar» (SDD-0557) los encuentra después, sin decir por qué.

Con esta SDD:

1. **Al guardar**, si el asiento no se puede crear, la pantalla lo dice con el motivo y qué hacer:
   - «sin tasa: cárgala en Contabilidad › Tasas de cambio»;
   - «período cerrado»;
   - «falta la cuenta 1.1.2»;
   - …
2. **Contabilidad › «Por contabilizar» › sección «Asientos no creados»** lista cada documento sin asiento: tipo, código, fecha, monto, motivo del último intento y cuántas veces se intentó.
3. Desde esa lista se puede **«Asentar»** uno o **«Asentar pendientes»** sobre una selección acotada. Primero corre un **ensayo en seco** que muestra qué asientos se crearían, sin efectos persistentes. Los límites y la concurrencia del lote quedan pendientes del contrato.
4. **Cobranzas y Tesorería** avisan antes de guardar si la fecha cae en un período cerrado, como ya lo hacen Gastos y el Libro diario.

## Evidencia (lo que hay hoy)

El inventario técnico siguiente procede del diseño del 2026-10-20 y de las SDD citadas, con las correcciones verificadas en la revisión conservada en el asset sobre `main` `8e9e0f505322cd57b3230cce6b16b45b5554cb8a`. Sus rutas, líneas y dependencias se revalidarán contra los SHA que se usen al implementar cada PR; esta entrega documental no ejecutó producto ni comprobó producción. La corrección sobre los datos de prueba se contrastó con el §9 del plan en esa misma base.

### Los asientos son best-effort, del lado de la app

- **Cada asiento automático se declara best-effort** en su cabecera: `invoice-posting.ts`, `receipt-posting.ts`, `bill-posting.ts` y `supplier-payment-posting.ts`, línea 15, «si algo falla, NO rompe la emisión (el caller logea y sigue)».
  - Corre con service_role y no es transaccional: cabecera y líneas son dos inserts.
  - El `catch` está en `invoice-posting.ts:181`, `receipt-posting.ts:293`, `bill-posting.ts:211` y `supplier-payment-posting.ts:216` (SDD-0566, *Evidencia para la 2.2*).
- **El período cerrado no se mira en la app** para esos cuatro documentos. `isPeriodClosed` no aparece en:
  - `facturacion/actions.ts`;
  - `lib/studio/sales-orders/actions.ts`;
  - `lib/studio/collections-actions.ts`;
  - `lib/studio/treasury/treasury-actions.ts`.

  Con fecha cerrada, el insert choca con `journal_entries_validate_closing` (0133) y el `catch` lo convierte en un resultado: el documento se guarda sin asiento (SDD-0566).
- **Sin tasa tampoco se asienta.** La SDD-0572 define que un cobro, una CxP o un pago en bolívares o yuanes sin tasa devuelve `missing-fx-rate` y no se asienta. Esta SDD debe conservar esa decisión y hacer visible el motivo; el estado de integración de la dependencia se comprobará antes de implementar.

### Unicidad del código y del documento

- **El código del asiento es max + 1, sin candado.** `next_entry_code` (`0078_contabilidad.sql:91-111`) calcula `max(...) + 1` y la app inserta en otra llamada.
  - Hay `unique (tenant_id, entry_code)` (`0078:58`). Si dos documentos se asientan a la vez, el segundo choca con `23505` y el `catch` lo pierde.
  - Un candado dentro de `next_entry_code` **no** lo arregla: la transacción de PostgREST termina al devolver el código, antes del insert.
- **La unicidad por origen requiere inventario; no está ausente en todos los casos.** `journal_entries` ya tiene las columnas de origen (el plan decía lo contrario, B3):
  - `invoice_id` (0078);
  - `receipt_id` (0079);
  - `bill_id` y `supplier_payment_id` (0088);
  - `charge_id` (0114);
  - `expense_id` (0132);
  - `claim_id` (0157).

  Además del crédito de referido (`0237:95`), **gasto ya tiene** `je_one_live_entry_per_expense` (`0132_expense_posting.sql:36-42`): unicidad de `expense_id` cuando `status = 'asentado' and deleted_at is null`. El contrato de la 0575-a debe conciliar esa protección existente con sus índices propuestos; no duplicarla ni afirmar que falta.

- **CxP persiste `source = 'supplier_bill'`.** Lo confirman `bill-posting.ts:177-190` y `0088_tesoreria.sql:61`. Ese valor de origen contable no implica renombrar indiscriminadamente un `kind` de UI o un discriminante de API llamado `bill`; el contrato debe declarar su mapeo.

### La idempotencia y el vínculo con el documento

- **La idempotencia cuenta asientos anulados.** `invoice-posting.ts:62-71` y `receipt-posting.ts:203-211` dan por existente cualquier asiento no borrado, incluido el **anulado**, y la reclasificación repite el defecto (`:464-473`). Un documento cuyo asiento se anuló no se vuelve a asentar nunca (SDD-0559, fuera de alcance 1 y 2).
- **Asiento vivo no equivale a cualquier cabecera no anulada.** La definición canónica de `libro-control.ts:247-250` exige `status = 'asentado'` y no borrado. `expense-posting.ts:117-126` ya usa ese estado. Un predicado de índice puede proteger también otras cabeceras, pero no permite responder «ya existente» como éxito contable si el asiento es borrador, está vacío o es inconsistente.
- **El vínculo de vuelta no se comprueba.** `collections-actions.ts:215-219` no guarda `journal_entry_id` cuando el asiento ya existía, y los vínculos se escriben con el cliente de sesión sin mirar el error (0559, punto 3).
- **El borrado de compensación no mira su error.** Si fallan las líneas, nueve lugares borran la cabecera sin comprobar el resultado. Si ese borrado falla, queda un asiento `asentado` sin líneas, que la idempotencia ya no rehace (0559, punto 7; trampa AFI2 de la fixture).

### Lo que falta para verlo y para repararlo

- **No hay registro de fallos ni pantalla para reasentar.** «Por contabilizar» (`PorContabilizarTab.tsx`, SDD-0557) es de solo lectura y dice «No asienta nada: reparar el posting es la fase 2 del plan contable». No explica el motivo.
- **Gastos** es el quinto documento best-effort (`expense-posting.ts:1-20`), pero sí mira el cierre (`app/m/erp/actions.ts:94`, `:257`).
- **Los casos de la radiografía son datos de prueba.** La radiografía del 2026-10-18 registró 5 de 5 facturas emitidas sin asiento y un recibo que apunta a un asiento anulado. Sam aclaró su condición de datos de prueba, recogida en el §9 de `docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`. Esos conteos no acreditan casos reales que deban repararse ni autorizan reparar o borrar los datos de prueba.

### Modelos a copiar

| Migración | Qué aporta |
|---|---|
| 0485 | Reclamos: indemnización con `correlation_id` y `unique_violation` controlada |
| 0497 | Reverso al anular, SDD-0573: referencia de RPC atómica y `SECURITY DEFINER`; su regla de fecha no se traslada a esta SDD |
| 0340 | Anulación de gastos con gobierno |
| 0316 | Liquidación de nómina con gobierno |

## Diseño con decisiones registradas

### 1. «No asentado» se deriva, el motivo se registra

**La lista de pendientes se calcula, no se guarda.** Son los documentos vivos que deberían tener asiento y no tienen uno vivo, la misma regla de «Por contabilizar». Abarca los cinco tipos: factura, cobro (aplicado, sin identificar y su reclasificación), CxP, pago a proveedor y gasto. Así la lista no puede desincronizarse.

**Nombre y campos propuestos para una tabla nueva, `accounting_posting_attempts`, que registre el motivo pendiente:**

| Campo | Qué guarda |
|---|---|
| `tenant_id` | el tenant |
| `doc_kind`, `doc_id` | el documento |
| operación/origen, por cerrar | distingue el cobro inicial de su reclasificación; no deben pisarse el motivo por compartir `receipt_id` |
| `motivo` | código cerrado: `sin_tasa`, `periodo_cerrado`, `falta_cuenta`, `choque_de_codigo`, `no_cuadra`, `otro` |
| `detalle` | texto sin PII |
| `intentos` | cuántas veces se intentó |
| `primero_at`, `ultimo_at` | primer y último intento |

El diseño prevé RLS por tenant y lectura para admin y contabilidad. La autoridad de escritura, la identidad de operación, el contador y el ciclo de vida del intento deben quedar cerrados en el contrato de la 0575-a. La propuesta es retirar el motivo pendiente cuando el asiento se cree correctamente. La dirección revisada para conservar el motivo se detalla abajo; aún requiere contrato y pruebas. La lista se deriva también del documento y del asiento: si el motivo no pudo guardarse, debe poder mostrar «motivo no disponible» sin ocultar el pendiente.

### 2. Una RPC atómica por documento que falle cerrado

**Decisión del Director:** la contabilización se resuelve mediante una RPC atómica por documento. Ante un fallo no puede devolver éxito ni dejar cabecera, líneas o vínculos parciales. Incluye factura, cobro y su reclasificación, CxP, pago a proveedor y gasto desde el contrato de la 0575-a.

La firma provisional es `asentar_documento(p_kind text, p_id uuid, p_ensayo boolean)`, con `SECURITY DEFINER`. El reintento manual se limita a admin y contabilidad; el posting automático conserva los permisos vigentes de cada operación de negocio sin otorgar un reintento genérico a sus operadores. Firma, composición de entradas, permisos finales, resultados y alcance de la transacción se fijarán en el contrato antes de implementar. No se confía tenant/actor del cliente ni se concede una excepción de cierre por usar `service_role`. El diseño debe cubrir:

1. **Serialización:** el candado por tenant/ámbito del código y el candado del documento deben proteger la transacción real y coordinarse con los otros escritores. El diseño de `pg_advisory_xact_lock` es provisional: usarlo solo en la RPC de generación de código no protege un insert posterior, ni coordina escritores que no lo adopten.
2. **Idempotencia:** para responder «ya existente», el asiento debe estar **asentado**, no borrado, ser íntegro y balanceado y corresponder al tenant, documento y origen correctos. El vínculo exigible se valida o se corrige atómicamente si su reparación está autorizada; un vínculo contradictorio bloquea. Factura y gasto no adquieren un backlink que su esquema no tenga.
3. **Validaciones:** tasa, período, cuentas y cuadre. Un fallo registrable devuelve un código cerrado y deja un motivo consultable cuando el registro exterior y la transacción completa confirman; los demás casos no se presentan como éxito ni como motivo durable.
4. **Inserción:** cabecera y líneas juntas, con el vínculo del documento. Si algo falla, se revierten todas las escrituras contables parciales de ese intento.
5. **Ensayo:** con `p_ensayo = true`, devuelve un preview distinto de un resultado de escritura. No cambia documentos, intentos, asientos, líneas, auditoría, excepciones, correlativos ni contadores de superclave; no verifica la clave por un camino con efectos. Ejecutar y revertir al final no sustituye esta propiedad.

**Dirección técnica revisada: rollback del subbloque y motivo exterior condicionado al commit.** Las escrituras contables inseparables se proponen dentro de un subbloque transaccional que se revierte al capturar un fallo. El motivo se registra después, fuera del bloque fallido, sin relanzar un error que revierta también ese registro. La documentación oficial de PostgreSQL 17 y la propuesta completa están en el [asset de contrato](assets/contrato-transaccional-propuesto.md#4-frontera-transaccional-y-conservación-del-motivo). Es una dirección revisada, no SQL implementado ni contrato final aprobado.

La aceptación verificable será: ante un fallo inducido durante líneas o vínculo, no quedan cabeceras, líneas ni vínculos parciales del intento; si confirma la transacción exterior, el motivo permanece consultable por el tenant autorizado; el ensayo no produce efectos. Si falla guardar el motivo, se cancela la llamada, se pierde la conexión o revierte la transacción exterior, **no se promete persistencia del intento**. La UI debe representar el resultado desconocido y reconciliar por identidad de operación antes de repetir.

**Resultado contable separado del guardado:** `contabilizado`, `ya_existente`, `no_contabilizado` y `estado_desconocido`, con combinaciones válidas de asiento/motivo y preview diferenciado. Un HTTP 200 o `ok: true` del guardado no equivale a éxito contable. El resultado debe llegar a todos los consumidores, incluidos ventas, CN y gastos web/móvil; cambiar solo los cinco posters no elimina el silencio.

Los cinco posters de la app pasarán a llamar esta RPC en la 0575-b. Las cuentas y las líneas se armarán en SQL con las reglas vigentes de las dependencias integradas, incluido el gasto desde la 0575-a, con contratos de paridad antes de sustituir cada `*-posting.ts`.

### 3. Unicidad por origen

Se proponen índices únicos parciales en `journal_entries` por par (`source`, columna de origen). El predicado inicial `status <> 'anulado' and deleted_at is null` es **provisional**: puede proteger cabeceras que todavía no cuentan como contabilizadas. Debe conciliarse con el índice de gasto existente, cuyo predicado exige `asentado`, y con la definición de éxito de la sección 2.

Valores de `source` persistidos que debe reconocer el contrato:

- `invoice` → `invoice_id`;
- `receipt` → `receipt_id`;
- `receipt_reclass` → `receipt_id`;
- `supplier_bill` → `bill_id` (CxP; no implica renombrar un `kind` de UI `bill`);
- `supplier_payment` → `supplier_payment_id`;
- `expense` → `expense_id`.

**Preflight previsto:** contar conflictos según el predicado final de cada índice y abortar la migración si existen, distinguiendo asiento contabilizado, borrador y otros estados. El contrato y sus pruebas locales se definirán en la 0575-a; cualquier lectura de producción requiere su autorización específica y esta entrega no la realiza ni la concede.

### 4. Período cerrado

**Decisión del Director:** una fecha en período cerrado bloquea la operación salvo que se tramite y registre una excepción gobernada por la SDD-0566. La app comprobará el cierre antes de guardar en Facturación, Cobranzas y Tesorería, y la RPC repetirá el control. El gasto conserva ese mismo gobierno. Sin la excepción aplicable no se guarda la operación bloqueada.

No se cambia silenciosamente la fecha al primer día abierto ni se importa la regla de fecha del reverso de la 0497. Los contratos deben demostrar el bloqueo sin excepción y la trazabilidad de la excepción admitida, conservando la fecha solicitada.

**Dirección revisada: la guarda autoritativa debe abarcar la mutación de origen.** Los consumidores actuales confirman varias operaciones de negocio antes de llamar al poster; una RPC contable posterior no puede revertir ese guardado. La comprobación de app mejora el aviso, pero no cierra la carrera con un cambio de período. La [matriz por flujo](assets/contrato-transaccional-propuesto.md#83-matriz-de-la-transacción-necesaria-por-flujo) distingue entradas transaccionales nuevas de extensiones a RPC existentes. Sus capacidades, locks, permisos y callers siguen pendientes de contrato en 0575-a/b. La auto-facturación CN no convierte la consolidación de almacén en una operación contable ni autoriza una excepción de `service_role`.

### 5. Pantalla «Asientos no creados»

**Decisión del Director:** será una sección dentro de «Por contabilizar». El diseño visual y sus estados se concretarán en el contrato y la allowlist de la 0575-c.

- **Lista:** tipo, código con enlace, fecha, monto en su moneda, motivo y su texto con qué hacer, intentos y último intento.
- **«Asentar»** por fila, y **«Asentar pendientes»** sobre una selección acotada: primero corre el ensayo en seco y después la confirmación. Cada ejecución revalida permiso y documento; los límites/concurrencia del lote se fijarán en el contrato, sin asumir aprobado el ejemplo del asset.
- **Estados:** vacío («Todo asentado»), cargando, error, sin permiso y resultado desconocido. Un lote puede terminar parcialmente; se informa cada resultado y se reconcilian los desconocidos antes de reintentar.

### 6. Datos de prueba y operaciones posteriores

El §9 del plan aclara que los casos de la radiografía del 2026-10-18 son **datos de prueba**. La SDD construirá el mecanismo general de «asentar pendientes» sin convertir esos ejemplos en una tarea de reparación autorizada.

No se autoriza asentar, reasentar, corregir ni borrar esos datos en esta entrega. Una operación futura requerirá alcance y autorización propios; cada nueva radiografía de producción necesita autorización escrita. Un borrado también debe considerar los residuos en `entity_audit_log`, según el §9 del plan.

Las pruebas de la futura implementación usarán fixtures sintéticos locales. El orden operativo respecto de los consolidados se coordinará con el Director cuando exista una operación concreta aprobada.

## Tres PR secuenciales

| PR | Contenido | Migración |
|---|---|---|
| **0575-a** | Contrato de persistencia de intentos, índices únicos y preflight, RPC para factura, cobro y reclasificación, CxP, pago a proveedor **y gasto**, con contrato PGlite, contrato Docker y mutantes | sí; **número PENDIENTE** del inventario y la reserva del Director |
| **0575-b** | Los cinco posters llaman la RPC, el aviso al guardar y el control de período gobernado por la 0566 en los consumidores afectados | no prevista; depende del contrato integrado de la 0575-a |
| **0575-c** | Sección «Asientos no creados» dentro de «Por contabilizar», con «Asentar», «Asentar pendientes» y ensayo en seco para los cinco tipos | no prevista; depende de la 0575-b |

La ausencia de migración prevista en 0575-b depende de que 0575-a deje integradas todas las capacidades de origen y cierre necesarias. La lista de rutas del asset es un inventario **provisional**, no una allowlist de implementación. El Director cerrará ese reparto con el Worker antes de producto.

**Decisión del Director:** el orden es 0575-a → 0575-b → 0575-c, con revisión e integración seriales. Esta entrega registra el reparto; no abre las PR ni autoriza implementar, fusionar o aplicar una migración.

## Decisiones del Director por delegación (2026-10-20)

| Decisión | Resolución registrada |
|---|---|
| Atomicidad | RPC atómica por documento que falle cerrado |
| Período cerrado | Bloquea salvo excepción gobernada por la 0566; nunca refecha silenciosamente |
| Ubicación | Sección dentro de «Por contabilizar» |
| Entrega | Tres PR secuenciales; número de migración pendiente del Director |
| Gasto | Incluido desde el contrato de la RPC en la 0575-a y conectado en la 0575-b |

Estas decisiones se registran por encargo del Director bajo la delegación actual de Sam y son revisables por él. Se conserva `status: draft`: una decisión de diseño no equivale a implementación aprobada o terminada.

## Pendientes antes de implementar

1. El Director inventaría y reserva el número de migración de la 0575-a; no se asigna uno desde este diseño.
2. Cerrar contratos verificables y allowlist exacta por cada PR, con roles/tenant, atomicidad, idempotencia, concurrencia, vínculo, paridad de cuentas, ensayo y alcance del lote.
3. Cerrar y probar en la 0575-a la composición de subbloque/motivo exterior, resultado desconocido, ensayo sin efectos, permisos y ciclo de vida de intentos. La dirección revisada no sustituye esas pruebas.
4. Revalidar las dependencias 0557, 0559, 0566, 0569, 0572 y 0573 contra sus SHA integrados, identificar el contrato integrado de Caracas y coordinar los consumidores compartidos. Las refs del asset son evidencia de lectura fechada, no certificación de integración actual.
5. Obtener el encargo de implementación acotado para cada PR. Lecturas, migraciones, operaciones sobre datos, merge y publicación productiva conservan sus permisos específicos.

## Qué NO cambia

- La regla de cuentas de cada documento (solo se mueve a SQL).
- El asiento de la venta sigue al nominal hasta la 2.3 (B2).
- Los datos existentes: este diseño no autoriza su reparación ni borrado; los ejemplos de la radiografía son datos de prueba.

## Fuera de alcance

- Los asientos de crédito de referido, reclamos, nómina, depreciación y liquidaciones, que tienen su propio camino.
- La invariante de `scripts/qa/cobro-factura-race.mjs:20-22` sin los créditos de referido (0559, punto 4).
- El endurecimiento de `infra/ops/migraciones/aplicar.sh:114-117` (0559, punto 6), cuyo dueño es el Director.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | no aplica a esta entrega documental | contratos y allowlist exacta pendientes por cada PR antes de implementar |
| Producción | no aplica a esta entrega documental | no se consulta ni modifica; futura migración con número del Director, previa, OK nominal de Sam y runbook |
| Datos personales | no aplica a esta entrega documental | no se capturan ni mueven datos; la futura implementación debe evaluar privacidad, tenant y roles y mantener `detalle` sin PII |
| ERR-01 | no aplica a esta entrega documental | el contrato de implementación debe exigir que cada motivo visible explique qué hacer |

## Validación

La validación de producto está **NO EJECUTADA**: es diseño y no hay implementación. Las comprobaciones documentales y su resultado se registran en `.agents/handoffs/0575-asientos-sin-fallos-silenciosos.md`.
