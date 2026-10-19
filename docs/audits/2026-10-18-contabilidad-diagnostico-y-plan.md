# Contabilidad y administración del ERP DTD Cargo — diagnóstico y plan · 2026-10-18

> **Para quién.** Sam (founder) y la persona que llevará la contabilidad en QuickBooks.
> Está escrito para leerse de corrido; los detalles técnicos con `archivo:línea` están
> en los anexos.
>
> **Método.** Sesión Worker «Contabilidad» sobre `main` `e27c6747`. 14 lectores en
> paralelo, uno por área (facturación, cobranzas, contabilidad, fiscal, gastos y
> tesorería, costing y Financiero China, reportes, perfil del cliente, CRM y
> conversaciones, ciclo del embarque, multimoneda, QuickBooks existente, portal,
> controles y auditoría); cada hallazgo alto o medio pasó por revisores escépticos
> con dos lentes (código y contable); 6 investigadores externos con fuentes
> fechadas y un verificador por afirmación clave (QuickBooks Online, sistemas de
> carga, SENIAT, perfil de cliente, automatización por hitos, reportes); y un panel
> de tres arquitectos («la contadora manda», «integridad primero», «operación
> primero»), tres jueces por plan (contador, ingeniería, founder) y una síntesis.
> Los jueces encontraron errores de hecho en los tres planes; están corregidos aquí.
> Todo lo que dice «hoy» se verificó en código y migraciones.
>
> **Límite.** El análisis no leyó producción. Después, con tu autorización («autorizo
> la radiografía 1.1 con conteos y sumas, sin datos personales»), el **Director
> corrió la radiografía 1.1 el 2026-10-18 (~23:00Z)**: solo lectura, conteos y
> sumas, sin nombres ni RIF. Sus resultados están en la sección 0 y en cada
> problema, marcados «medido por el Director». Lo que sigue dependiendo de datos
> que no se midieron lleva la etiqueta **NO VERIFICADO**.

---

## 0. Resumen en una página

**Lo que tienes es mucho mejor de lo que parece desde afuera.** El ERP ya trabaja
como QuickBooks: el operador llena formularios (factura, cobro, cuenta por pagar,
pago, gasto) y el sistema arma solo el asiento de doble partida. Tiene plan de
cuentas con los tipos de Intuit, cierre de período que bloquea en la base de datos
(más fuerte que el de QuickBooks), cobros y pagos atómicos, auditoría con motivo
humano, titular fiscal sellado en la factura y un vocabulario que ya es el de
QuickBooks (Estimado → Orden de venta → Factura → Recibo). Nada de eso hay que
rehacerlo.

**Pero hoy los libros no dicen la verdad**, y por eso no conviene conectar
QuickBooks todavía. Las fugas son concretas y verificadas en código:

1. **Anular una factura no revierte su asiento**: cuentas por cobrar, ingresos e
   IVA quedan inflados por cada anulación.
2. **Una factura en bolívares se asienta como si fueran dólares** (el cobro sí se
   convierte): la cuenta de clientes nunca se salda y el ingreso se multiplica por
   la tasa.
3. **Los asientos son «best-effort»**: si fallan, el documento queda emitido o
   cobrado sin asiento y nadie lo ve.
4. **Confirmar un reporte de pago del portal** marca la factura como pagada **sin
   recibo ni asiento**.
5. **No hay notas de crédito, ni número de control SENIAT**; el correlativo deja
   huecos y reinicia cada año.
6. **Todo el ingreso cae en una sola cuenta** (4.5); las líneas de factura no saben
   qué servicio vendieron.
7. **Cualquier rol del equipo puede editar o borrar asientos** por la API, y una
   factura emitida sigue siendo editable en la base.

**Lo que se midió en producción** (radiografía 1.1, medido por el Director el
2026-10-18 ~23:00Z, un solo tenant):

| Qué | Resultado |
|---|---|
| Tamaño | 6 facturas, 2 asientos (4 líneas), 1 recibo, 0 reportes de pago, 0 cuentas por pagar, 0 pagos a proveedor |
| Facturas | **Todas en USD**, ninguna sin tasa: 3 emitidas, 1 parcial, 1 pagada, 1 anulada |
| Asientos | Los 2 están anulados (uno de factura, uno de recibo). **0 asientos vivos** |
| B1 · anuladas con asiento vivo | 0 |
| B2 · facturas en otra moneda | 0 |
| **B3 · documentos sin asiento** | **5 de 5 facturas emitidas, parciales o pagadas sin asiento**; el único recibo apunta a un asiento anulado |
| B4 · reportes de pago confirmados sin recibo | 0 (no hay reportes) |
| **Clientes (1.1.2)** | **1.1.2 = 0 en el mayor, contra un saldo abierto mayor que cero en facturas** |
| Proveedores (2.1.1) | 2.1.1 = 0 en el mayor y 0 en cuentas por pagar: cuadra |
| Ingresos 4.5 e IVA 2.1.5 | Sin movimiento vivo |
| Asientos descuadrados vivos | 0 |
| Facturas no borrador por año | 2026: 6 |

En Git solo van conteos y comparaciones: los montos de la radiografía son datos
financieros de clientes reales y no se escriben aquí.

**Qué significa:** el mayor de producción está prácticamente vacío. B1, B2 y B4
**no tienen casos hoy**: son riesgos latentes que hay que cerrar antes de que
crezca el volumen. Lo que sí está vivo es **B3**: los asientos no se crean, o se
anulan, y nadie lo ve. Con 6 facturas, la reparación es barata, y conviene hacerla
**antes de cargar los consolidados en la base oficial**. Una inferencia mía que
falta medir: 3 facturas tienen cobro registrado (la parcial, la pagada y la
anulada) y solo existe 1 recibo, así que al menos parte de esos cobros no vino de
un recibo; y la factura anulada tiene cobro registrado (el caso «anulada con abono»
de B13). La próxima corrida de la radiografía debe cruzar `paid_amount` contra los
recibos.

**Cuando llega un embarque hoy no pasa nada** si no hubo orden de venta (el caso
típico de Yiwu): la factura se hace a mano, el precio por CBM no queda guardado en
ningún lado, el contenedor `C-` no tiene cliente y el portal no lo ve.

**Lo que recomiendo:**

- **El ERP es el sistema de registro de la operación y de todo lo legal
  venezolano**: factura con número de control, libros de compras y ventas, **Diario
  y Mayor en bolívares** (el Código de Comercio exige la contabilidad en moneda
  nacional), IGTF, retenciones, cobranza, costo por embarque y perfil del cliente.
- **QuickBooks Online edición Global, plan Plus, moneda base USD**, es el **libro
  gerencial en dólares** donde trabaja la contadora: pérdidas y ganancias, balance,
  flujo de efectivo, conciliación bancaria, antigüedad de cuentas por cobrar,
  estados de cuenta.
- **Se sincronizan documentos, no asientos** (clientes, servicios, facturas, notas
  de crédito, cobros, facturas de proveedor), en una sola dirección ERP → QBO, con
  la misma cola idempotente que ya usas con Kommo. El asiento (Journal Entry) se
  reserva para lo que QuickBooks no sabe: diferencia en cambio, IGTF, provisiones.
- **Un solo dueño del cobro: el ERP.** La contadora concilia bancos en QuickBooks
  pero no registra cobros allí.
- **El bolívar no puede vivir en QuickBooks** (su lista oficial solo trae el
  extinto VEF). Los bancos en Bs se llevan en el ERP y en QuickBooks como cuenta en
  USD equivalente con revaluación mensual.
- **Orden en siete fases** (sección 8): una rebanada visible en la primera semana
  sin depender de ninguna decisión externa; después la integridad del mayor y del
  cobro (incluido cobrar en bolívares y las notas de crédito); después lo fiscal y
  los libros legales en Bs; la operación del embarque; el perfil del cliente y el
  cierre mensual; el conector; y el corte. La parte del embarque que no depende de
  lo fiscal (tarifa por CBM congelada, envío por cliente, embarques sin facturar)
  puede correr en paralelo desde la fase 2 si quieres verla antes.

**Lo que necesito de ti y de la contadora** está en la sección 9: 18 decisiones,
ordenadas por lo que bloquean. Las primeras: la moneda funcional y cómo se trata
la diferencia en cambio, cómo se reparan los datos históricos (y tu autorización
para medirlos), el dueño del cobro, el tratamiento de los anticipos, y si DTD es
Sujeto Pasivo Especial.

---

## 1. Lo que ya tienes y funciona bien (no se rehace)

| Pieza | Dónde está | Por qué importa para QuickBooks |
|---|---|---|
| Asiento automático detrás de cada formulario: factura, cobro, pago sin referencia, cuenta por pagar, pago a proveedor, gasto, reclamo, crédito de referido, depreciación, finiquito, socio China | `lib/studio/accounting/*-posting.ts` | Es el modelo «forms-first» de QuickBooks. Permite sincronizar documentos y dejar que QuickBooks arme su propio asiento. |
| Plan de cuentas con tipo de Intuit (`qbo_type`) y cascada tipo → subtipo | migraciones `0078`, `0131` (SDD-0077) | El mapeo cuenta ↔ cuenta de QuickBooks es casi directo. |
| Cierre de período que bloquea en la base para todos los roles, incluido `service_role` | migración `0133` (SDD-0080) | Equivale a «Close the books» con contraseña, pero ni los procesos automáticos lo saltan. |
| Cobro, pago a proveedor y crédito de referido atómicos (bloqueo de fila, rol, saldo estricto, lock del correlativo) | migraciones `0467`, `0468`, `0471` | No se pierden sumas por concurrencia; es la base para que el Payment de QuickBooks sea confiable. |
| Auditoría D2: evento en la misma transacción que el cambio, motivo humano obligatorio para anular, log solo de agregar | migraciones `0267`, `0290`, `0294` | Rastro de quién, cuándo y por qué en documentos financieros. |
| Titular fiscal sellado al emitir la factura (nombre, documento, domicilio) e inmutable | migración `0466` | La factura que llegue a QuickBooks lleva el titular correcto. |
| Libros fiscales con foto inmutable al asentar, solo de agregar, por RPC con rol | migración `0165` (SDD-0104) | Base para un cierre fiscal auditable. |
| Financiero China: se niega a asentar sin tasa; libro doble USD/RMB con tasa de 6 decimales por movimiento | `lib/studio/partner-finance/` | Es el modelo correcto de multimoneda que falta en el resto. |
| Cola de escritura a Kommo: outbox → drenaje → idempotencia → eco, con gate de «modo seco» y token en Vault | migraciones `0136`, `0364`, `0365`, `0377` | Es la arquitectura exacta que conviene para el conector de QuickBooks. |
| Reportes que leen todo (paginan hasta el final y fallan si se recortan); estado de cuenta con una sola función pura compartida por Studio, portal y PDF | `lib/studio/reports/`, `lib/portal/statement-ledger.ts` | Los reportes nuevos se construyen sobre un patrón que no inventa datos. |
| Motor de auto-factura por orden de venta: transaccional, idempotente, con verificación humana | migración `0128`, `lib/studio/sales-orders/invoicing.ts` | Se extiende, no se reemplaza, para el caso sin orden de venta. |

---

## 2. Lo que impide que los libros cuadren hoy

Veinticuatro problemas transversales: B1-B18 aparecieron en dos o más informes de
área; B19-B24 los encontró el crítico de completitud y los verificaron en código
cinco lectores extra. De
los 168 hallazgos individuales de los 14 informes, los revisores escépticos
(lente código y lente contable) **confirmaron 136 y no refutaron ninguno**; los 32
restantes son de severidad baja o fortalezas, que por diseño no pasaron por
revisión. Algunos se ajustaron de redacción o severidad. La evidencia completa, con
`archivo:línea` y el veredicto de cada revisor, está en el anexo A.

### B1. Anular una factura no revierte su asiento de venta
`voidInvoice` llama a la RPC `void_invoice_with_audit_reason`, que solo cambia el
estado a `anulada` (`supabase/migrations/0294_audit_d2_human_reasons.sql:162-168`).
`lib/studio/accounting/invoice-posting.ts` no tiene función de reverso; el recibo,
la cuenta por pagar, el pago y el gasto sí la tienen. **Efecto:** cada anulación
deja inflados Clientes (1.1.2), Ingresos (4.5) e IVA por pagar (2.1.5); el libro
de ventas, que sí excluye anuladas, deja de cuadrar con el mayor. Es lo primero
que detecta cualquier contador cruzando libro de ventas contra mayor. **Medido por
el Director (2026-10-18): 0 anuladas con asiento vivo.** Riesgo latente, sin
reparación histórica que hacer.

### B2. La factura en bolívares, yuanes o USDT se asienta sin convertir a dólares
`InvoicePostingInput` no recibe moneda ni tasa (`invoice-posting.ts:28-37`); el
asiento usa `base`, `iva` y `total` tal cual. El cobro sí divide por la tasa
(`receipt-posting.ts:75-85`). Ejemplo: factura Bs 36.000 a tasa 36 → el mayor
debita 36.000 «USD»; el cobro acredita 1.000 → quedan 35.000 USD fantasma en
Clientes y el ingreso se multiplica por 36. Además, cuando falta la tasa, recibo,
cuenta por pagar y pago asientan el monto nominal, y dos pruebas defienden ese
comportamiento (`lib/studio/__tests__/payment.test.ts:326-328`,
`lib/studio/treasury/__tests__/treasury.test.ts:332-334`). **Medido por el
Director (2026-10-18): las 6 facturas de producción están en USD y ninguna sin
tasa.** El efecto hoy es cero y el riesgo es latente; la reclasificación histórica
de 2.3 no tiene casos.

### B3. Los asientos son «best-effort» y nadie ve los que fallan
El documento se escribe en su transacción; el asiento se intenta después con el
cliente administrador y, si falla (período cerrado, cuenta faltante, carrera del
correlativo `next_entry_code` sin lock), solo queda un `console.error`
(`app/studio/(app)/facturacion/actions.ts:171-192`, `lib/studio/collections-actions.ts:203-231`,
`lib/studio/treasury/treasury-actions.ts:171-199`). No hay bandeja de «asientos no
creados», ni reporte «documentos sin asiento», ni comparación subdiario ↔ mayor.
La anulación «neutraliza» marcando el asiento como `anulado`; si cae en período
cerrado, el trigger lo rechaza y el asiento queda vivo sin aviso. Detalle: el
vínculo documento ↔ asiento va al revés en casi todos los casos (`journal_entries`
solo tiene `invoice_id`; recibos, cuentas por pagar y pagos guardan su
`journal_entry_id`), así que la unicidad por origen hay que ponerla de ese lado.
**Medido por el Director (2026-10-18): es el problema vivo.** 5 de 5 facturas
emitidas, parciales o pagadas no tienen asiento; el único recibo apunta a un
asiento anulado; hay 0 asientos vivos, y Clientes (1.1.2) da 0 en el mayor contra
un saldo abierto mayor que cero en facturas.

### B4. Confirmar un reporte de pago del portal da la factura por pagada sin recibo ni asiento
`payment_private.run_report_command 'confirm'` (migración `0464:305-318`) suma
`paid_amount` y marca el reporte; nunca inserta en `payment_receipts` ni en
`journal_entries`. Fue una decisión explícita de SDD-0134 («confirmar = solo
marca»; el «Slice C» contable quedó diferido y nunca se construyó). Resultado: hay
dos caminos para cobrar una factura y solo uno (Cobranzas) alimenta el auxiliar de
recibos, el mayor, el flujo de caja, la separación de fondos, la rendición y la
conciliación. Si se conectara QuickBooks así, esos cobros no tendrían un Payment
que sincronizar. **Medido por el Director (2026-10-18): 0 reportes de pago en
producción**, así que no hay backfill histórico; el defecto hay que cerrarlo antes
de que el portal se use para reportar pagos.

### B5. Sin notas de crédito ni número de control; correlativo con huecos y reinicio anual
El código `F-YYYY-NNNN` se asigna al crear el borrador (borrar un borrador deja un
hueco), `next_invoice_code` no tiene lock y reinicia cada año (`0077_invoices.sql:63-83`).
**`invoices` no tiene columna de número de control**: la única `control_number`
está en las líneas congeladas de `fiscal_book_entries` (`0165`) y el código siempre
le escribe `null` (`lib/studio/fiscal/types.ts:384`). No existe nota de crédito ni
de débito para facturas de clientes (la única es `supplier_credit_notes`, del socio
China). Las anuladas desaparecen del libro de ventas en vez de aparecer en cero.
Para QuickBooks, la nota de crédito es el «Credit Memo» que se aplica contra la
factura: sin ella no hay forma de reflejar un ajuste parcial.

### B6. Todo el ingreso cae en 4.5 y las líneas no saben qué servicio vendieron
`SALES_INCOME_CODE = "4.5"` fijo (`invoice-posting.ts:24-26`). Las cuentas 4.1.1
LCL, 4.1.2 FCL, 4.1.3 DDP y 4.4 aduana están sembradas y nunca reciben
movimiento. `invoices.lines` es JSON libre e `invoices.client_markbox` es texto sin
llave foránea. **Ojo: «Productos y servicios» ya existe a medias**: hay 20
servicios canónicos (`lib/shared/service-catalog.ts`), `service_configs` con
add-ons e historial de precios (`0130`) y costos por CBM del transportista
(`0330`); pero `service_configs.mapeo_contable` es un texto que ningún asiento lee
y las líneas de factura no apuntan al catálogo. Falta conectarlo, no inventarlo.
Sin esa conexión no hay pérdidas y ganancias por línea de negocio ni Items para
QuickBooks.

### B7. IGTF configurado en dos lugares y aplicado en ninguno
`fiscal_settings` (`igtf_enabled`, `igtf_rate_fx`, `igtf_is_perception_agent`,
además de `iva_withholding_agent`, migración `0141`) y `tenants.igtf_rate`
(migración `0190`) existen y se editan en dos formularios; ningún cobro, asiento ni
recibo los lee. Depende de si DTD es Sujeto Pasivo Especial, pregunta abierta desde
SDD-0073 §8.4. La solución es consolidar en `fiscal_settings`, no agregar otra
bandera.

### B8. Libros fiscales con monedas mezcladas, sin tasa BCV trazable y con fechas en UTC
El libro de ventas y el de compras suman USD y VES sin convertir a bolívares
(`fiscal/types.ts:178`: «USD funcional, sin normalizar moneda»); filtran por
`created_at` en UTC y no por fecha de emisión (`fiscal/queries.ts:221-227`); la
fecha de emisión se calcula en UTC y Caracas es UTC−4 (una factura de las 8:30 pm
cae al día siguiente, y el 31 de diciembre al año siguiente). `tenant_fx_history`
no guarda si la tasa es BCV, paralela o manual, ni la fecha de vigencia. Conviven
constantes fijas (36, 36.45, 7.18) y la regla de conversión a USD está copiada en
seis sitios, con divergencia en CNY (en unos vale 0, en otros se divide por la
tasa). El libro de compras no tiene base ni crédito fiscal (`supplier_bills` no
discrimina IVA) y no incluye las declaraciones de aduana (DUA) que sí registra el
módulo aduanal.

### B9. Sin diferencia en cambio; no se puede cobrar en bolívares una factura en dólares
La RPC de cobro fija la moneda del recibo igual a la de la factura y hereda su
tasa (`0467:225-230`; `PAYMENT_CURRENCY` si difiere, `:303-304`). El pago a
proveedor hereda la tasa de la cuenta por pagar. La cuenta 6.19 «Diferencia en
cambio» está sembrada y sin uso. `accounts` no tiene moneda: un banco en Bs se
modela como saldo USD. No hay crédito a favor del cliente, anticipos ni pago que
cubra varias facturas (decisión «estricta» del 2026-09-18). No hay revaluación de
saldos en moneda extranjera ni SDD previa que la cubra (es trabajo nuevo). En
QuickBooks el patrón es: factura en la moneda del cliente, pago registrado con la
tasa del día y la diferencia va sola a «Exchange Gain or Loss».

### B10. La plata recaudada para la Operadora se reconoce como ingreso propio
`fund_class = third_party` existe y la separación de fondos se calcula por recibo,
pero el asiento de emisión acredita 4.5 por el total y la rendición quincenal
(SDD-0069) no genera asiento ni pasivo «por rendir». Un contador espera un pasivo
por fondos de terceros y revenue solo por el servicio propio.

### B11. El costo por embarque es un memo manual y el margen no es confiable
`shipment_costs` (siete montos) se teclea o se prellena desde un template fijo
por embarque (no por CBM). No se deriva de los cargos del socio, las cuentas por
pagar ni los gastos que sí llegan al mayor; `supplier_charges` no tiene
`shipment_id` (las cuentas por pagar y los gastos sí lo tienen, pero nadie los
suma al margen). El período filtra ingresos pero no costos (aparecen márgenes
negativos falsos); el ingreso del margen incluye IVA, y cuando una factura junta
varios envíos (como las del lote SDD-0543) el costing le carga todo el ingreso al
primero (`lib/studio/costing/queries.ts:153-200`). El socio China tiene dos
pasivos en paralelo (2.1.1 y 2.1.7), no hay forma de pagarle contra 2.1.7, el
libro bilateral no tiene productor (saldo siempre 0) y los cargos en RMB no se
asientan porque la pantalla no pide tasa.

### B12. Cuando llega un embarque no pasa nada si no hubo orden de venta
Lo detallo en la sección 3.

### B13. El perfil del cliente no es un perfil contable ni «360»
Sin saldo abierto ni vencido en la cabecera; sin facturas, recibos, cotizaciones ni
órdenes; historial de embarques sin estado, CBM ni monto (tope silencioso de 200);
estado de cuenta en una página aparte que solo abre contabilidad, aunque el botón
lo ven todos; abonos fechados al vencimiento y no al recibo real (decisión del
2026-07-29, cuando aún no se usaban los recibos para esto); solo la moneda
dominante; una factura anulada con abono parcial desaparece; tras fusionar
duplicados, la ficha no ve lo del código retirado (el vínculo es por texto); sin
pestaña de conversaciones ni CRM; notas sin fecha ni autor; sin términos de pago,
límite de crédito ni condición fiscal. La SDD-0483 (historial de cambios, tarea planeada y reservada) sigue
como stub de reserva en una rama remota.

### B14. El portal muestra las facturas anuladas como deuda
`listMyInvoices` solo excluye borradores (`lib/portal/portal-queries.ts:255`): los
KPI, el saldo del inicio, el estado de cuenta, su PDF y el comprobante suman
anuladas; el Studio las excluye. Recorte silencioso de 100 facturas (el Studio
usa 200). El PDF del estado de cuenta sale sin la identidad fiscal del emisor. El
cliente no recibe aviso cuando su reporte de pago se confirma o rechaza.

### B15. El CRM no guarda lo que se conversa
El espejo de Kommo guarda fechas del último mensaje y tareas; el texto de WhatsApp
y las notas se descartan a propósito en el parser del webhook. El módulo
Conversaciones solo tiene portal y correo entrante (la respuesta por correo quedó
apagada aunque la spec diga lo contrario; WhatsApp nunca se cableó). El vínculo
cliente ↔ contacto de Kommo cubre 62 de 457 clientes (13,6 % al 2026-08-18) y los
clientes con saldo o carga no están en Kommo. Hay dos definiciones distintas de
«saldo del cliente» (Conversaciones y el job de Kommo).

### B16. El libro mayor es editable por cualquier rol y la factura emitida no es inmutable
`accounts`, `journal_entries` y `journal_lines` conservan desde `0078` una policy
«FOR ALL» por tenant sin rol y permiso de borrado a `authenticated`; nunca se
endurecieron (facturas y cobros sí, en `0407`/`0414`/`0470`). No hay trigger de
Σ debe = Σ haber ni de inmutabilidad de asientos asentados; `journal_lines` está
fuera de la auditoría. De una factura emitida solo se congela el titular: montos,
moneda, tasa y fechas siguen editables por la API y el log no registra montos.
Un solo rol crea proveedor, causa, paga y anula sin segunda firma. Reabrir un
período no deja historial. El log de auditoría es «solo agregar» para la
aplicación, pero no tiene trigger de inmutabilidad frente al dueño de la base. De
las pruebas de base de datos, los 242 contratos `.test.sql` solo corren con Docker
en `pnpm verify`; el CI sí corre 31 pruebas de migración en PGlite, pero ninguna
cubre auditoría ni cierre de período: hay que extender ese arnés.

### B17. Cuatro cifras de ingreso y faltan los reportes que la contadora pide primero
Ingresos: Contabilidad (libro acumulado histórico, sin fecha), Dirección (libro del
mes), Reportes (libro del período), Dashboard (suma cruda de facturas). El balance
no cierra el ejercicio a 3.4 ni acepta fecha de corte; no hay balance de
comprobación; el diario corta en 500 asientos sin aviso y no exporta; el
«Cashflow» es facturado vs cobrado (sin salidas ni bancos). Faltan: saldos por
cliente, antigüedad por cliente y por proveedor, embarques sin facturar, flujo de
caja real, pérdidas y ganancias por servicio, pagos no aplicados, conciliación
subdiario ↔ mayor. La posición de IVA tiene crédito fiscal y retenciones fijados
en 0.

### B18. QuickBooks: no hay integración, identificadores externos ni exportación
Búsqueda de `iif|qbo|intuit|oauth` en el código: vacía salvo `accounts.qbo_type`.
La exportación se difirió tres veces (migración `0114`, SDD-0059, SDD-0115). El
documento `docs/architecture/contabilidad-qbo-online.md` (junio) está
desactualizado: dice que no hay conciliación bancaria ni asiento de gasto, y ambos
existen desde SDD-0105 y SDD-0079. SDD-0061/0072 adoptaron la «Orden de venta»
del QuickBooks **Desktop** de la foto que mandaste; QuickBooks **Online** no la
expone por API abierta (su flujo es Estimado → Factura).

### Lo que encontró el crítico de completitud (frentes que ningún lector cubría)

El crítico propuso seis frentes; cinco lectores extra los revisaron a fondo en
código (detalle en el anexo A, sección «Áreas extra»). Estos hallazgos están
verificados por su lector, pero no pasaron por revisores escépticos.

**B19. La plata que DTD pone por cuenta del cliente termina como costo propio.**
Al recibir una compra asistida, `receivePurchaseOrder` crea la cuenta por pagar al
proveedor contra una cuenta de costo 5.x (`lib/studio/purchase-orders/actions.ts:335-345`,
spec 0071); del lado del cliente no nace nada por esa mercancía: ni factura, ni
anticipo, ni cuenta por cobrar reembolsable, ni la comisión publicada en la web,
que es el ingreso real del servicio. Peor: el formulario propone por defecto la
primera cuenta que empieza con «5.», que es la 5.1 «Flete comprado a navieras»
(`ordenes-compra/_components/PoDrawer.tsx:407-411`), así que el valor de la
mercancía infla el costo del flete; ya existe la 5.10 «mercancía pagada a fábrica
por cuenta del cliente», que usa Financiero China. El puente compra → cuenta por
pagar no es atómico. Los gastos marcados «cobrables» son una etiqueta sin efecto:
no generan cargo al cliente. Falta decidir si en la compra asistida DTD es
**principal** (revende: factura completa con su IVA) o **agente** (compra por
cuenta del cliente: cuentas de paso y factura solo de la comisión); cambia
ingresos, IVA e ISLR (decisión 17).

**B20. Créditos y descuentos al cliente que viven fuera de la factura.**
(a) Al referido se le promete un descuento de USD 60 en su primer embarque
(correo, portal y valor por defecto en `lib/studio/fidelizacion/types.ts:119`) y
ningún código lo aplica; como una línea de factura no puede ser negativa, hoy solo
se podría dar bajando un precio sin dejar rastro. (b) **Riesgo alto:** el crédito de
USD 80 del que refiere **puede nacer sin venta, renacer después de aplicado y
aplicarse dos veces**: la máquina de estados de `referrals` no tiene candado
(`app/studio/(app)/fidelizacion/actions.ts:220-260`), un crédito «aplicado» puede
volver a «acreditado» y abonar una segunda factura sin asiento nuevo, y la RLS «for
all» deja a cualquier rol del tenant cambiar estado y monto por la API. (c) El
premio se asienta como gasto 6.11 «Publicidad» mientras la pantalla dice
«descuento sobre la venta». (d) La indemnización por reclamo sale siempre de caja
por el 100 % (`0485`): no admite compensarla contra una factura, ni registra el
recupero del seguro o del transportista, ni moneda y tasa. Hay que decidir si estos
créditos son contra-ingreso o gasto, y que aterricen como línea o nota de crédito
sobre la factura (decisión 16).

**B21. La contadora no ve parte de la contabilidad, y lo que no ve está abierto por
la API.** Con rol `accounting`, Dirección, Rendiciones y Financiero China son solo
para administrador (`lib/studio/rbac.ts:111,118`), y Financiero China y Rendiciones
exigen además ser administrador de plataforma, aunque las specs 0059 y 0069 le
asignan a Contabilidad esa conciliación y esa liquidación. Ella verá en el mayor
los asientos de la 2.1.7 (Socio China), y podrá anularlos, sin ver su origen ni el
detector de descuadres. A la inversa, **las siete tablas del Socio China dan
lectura y escritura a cualquier empleado del tenant por la API** (policy «for all»
solo por tenant, `0114:444-506`, sin auditoría): el candado existe solo en la app.
Operaciones y almacén asientan gastos directo en el estado de resultados y en caja,
sin borrador ni revisión de la contadora (`lib/studio/rbac.ts:114`,
`gastos/actions.ts:199-208`). Tampoco existe un perfil de solo lectura para un
contador externo.

**B22. No hay arranque contable.** No existe forma de cargar saldos iniciales
(la búsqueda de «saldo inicial» solo aparece en la conciliación bancaria) ni la
cuenta de patrimonio de apertura que QuickBooks usa («Opening Balance Equity»), ni
política de conservación de los libros. Es lo que define la fecha de corte del
libro y lo primero que la contadora va a preguntar.

**B23. La nómina mensual no entra al libro.** El corte mensual «no genera asiento
contable» ni al confirmar ni al pagar (`app/studio/(app)/nomina/actions.ts:964-967`
y `:1205-1206`); solo el finiquito asienta. El estado de resultados omite el mayor
gasto fijo.

**B24. La migración `0422` sigue pendiente en producción desde el 2026-09-13.** Es
una de las dos únicas esperas declaradas (`supabase/migrations-baseline.json:40`;
la otra es la `0423`). Mientras falte, la RPC heredada `confirm_payment_report`
sigue ejecutable para accounting/admin y **suma el reporte a `paid_amount` sin mirar
si la factura ya está pagada, si el monto excede el saldo o si la moneda
coincide**, sin recibo ni auditoría (`0359:64-135`); las reglas nuevas solo viven
en el comando de la `0464`, que lo admite en su propio texto. Además, la policy de
`payment_reports` deja escribir reportes por la API sin pasar por los comandos
auditados (`0195:96-109`). Hoy no hay reportes de pago en producción (radiografía
del 2026-10-18), así que el daño es latente; pero hay que aplicarla antes de que el
portal se use para reportar pagos y antes de la 2.7. Aparte: nada en el repo impide
editar una migración ya aplicada (el md5 solo está fijado en pruebas para cinco
archivos); queda como hallazgo de ingeniería para el Director.

---

## 3. Qué pasa hoy cuando llega un embarque, y qué debería pasar

### Hoy

La única automatización documental es la auto-factura de la orden de venta, y
exige una cadena que el negocio casi no usa: Estimado → Orden de venta → compra
del cliente (prealerta) atada a esa orden → recepción en Yiwu ligada a esa compra
→ un operador marca «verificada para facturar» → marca «consolidado». Solo ahí
`autoInvoiceForReceipt` llama a la RPC `sales_order_claim_and_invoice` y nace una
factura ya **emitida**, prorrateada **por cajas** (no por CBM real), sin
`shipment_id` (por eso salta el gate legal DDP que la emisión manual sí aplica) y
con asiento best-effort. SDD-0284 midió el 2026-08-24: **0 de 8 compras tenían
orden de venta.**

La recepción directa en Yiwu —el caso típico— no genera factura, estimado ni
orden. El precio por CBM no queda guardado en el embarque, ni en la recepción, ni
en la orden de venta: solo existe en el estimado (si lo hubo), en el tarifario y
en las listas de precios. Al consolidar, el Almacén CN crea un envío contenedor
`C-YYYY-NNNN` **sin cliente** que el portal no ve; Naviera tiene otro modelo de
consolidación (contenedores con estados consolidando → cerrado → zarpado →
arribado). La llegada a Venezuela y la entrega se marcan a mano; el POD del
camionero está detrás de un flag apagado; la máquina de estados del embarque no se
aplica en la base (cualquier transición vale). El `payment_status` de la
recepción es un «pagado» manual desconectado de las facturas.

Aquí entra el Excel de Yiwu que vas a mandar: hoy no hay dónde guardar el «precio
venta CBM» por embarque. El lote SDD-0543 lo resolvió a mano para los contenedores
59 al 64 en la base de prueba; hace falta convertirlo en función del sistema.

### Lo que debería pasar (documento por hito)

Dos entidades separadas, como hacen Magaya, CargoWise y GoFreight: los **cargos**
del embarque (líneas con concepto, CBM medido, tarifa congelada y su versión,
estado estimado → confirmado → facturado) y los **documentos**. Un documento por
(embarque, hito, tipo, versión), con llave única, generado por outbox para que
ningún reintento duplique nada. (Ojo: `shipment_events` y `shipment_documents` ya
existen con otro propósito; la línea de tiempo se extiende y los documentos
generados van en una tabla nueva.)

| Hito | Documento en el ERP | En QuickBooks | ¿Toca libros? | Nota fiscal |
|---|---|---|---|---|
| Solicitud / cotización | Estimado `EST-` (ya existe) | Estimate (opcional) | No | Ninguna |
| Recepción en Yiwu con CBM medido | Confirmación de recepción + cargo confirmado con tarifa congelada | Nada (el «cargo diferido» no existe en la API) | No | Ninguna |
| Consolidado / zarpe | Pre-factura informativa por cliente y contenedor (la factura en `borrador` del lote 0543), visible en el portal como «por aceptar» | Nada | No | Debe decir que no es factura fiscal y no otorga crédito fiscal |
| Llegada a Venezuela (tras desconsolidar) | Aviso de llegada + **Factura fiscal** `F-` emitida desde los cargos confirmados, con `shipment_id`, número de control, tasa BCV del día, vencimiento inmediato y leyenda «pago requerido para liberación» | Invoice con el mismo número | Sí: nace la cuenta por cobrar | Aquí nace el hecho imponible del IVA y se congela la tasa (LIVA arts. 13 y 25) |
| Cobro | Recibo `R-` | Payment aplicado | Sí | IGTF si aplica |
| Almacenaje, demoras, aduana conocidos después | Factura complementaria `F-` dentro de 30 días (nunca editar la emitida) | Invoice | Sí | Servicio nuevo, no corrección |
| Entrega con POD | Cierre del embarque con verificación «sin cargos por facturar»; ajuste de precio o tasa por nota de crédito `NC-` o débito `ND-` | CreditMemo / Invoice con prefijo ND- | Sí | Las notas referencian fecha, número y monto de la factura (Providencia 0071 arts. 22-24) |

Si al llegar el embarque no tiene tarifa congelada, el sistema **no factura**: lo
deja en «llegado, pendiente de precio», avisa al operador y solo sale el aviso de
llegada con monto «por confirmar».

¿Por qué la factura fiscal al llegar y no al recibir en China? Porque emitirla
antes adelanta el débito fiscal del IVA y congela una tasa BCV que después no
coincide con el cobro (cada embarque generaría una nota de débito); porque la
práctica del sector marítimo es «aviso de llegada + no hay liberación sin pago»
(en LCL el aviso sale tras la desconsolidación, 2-5 días después del arribo); y
porque coincide con lo que ya decidiste en la SDD-0543 (factura en borrador hasta
aceptar términos para el 59, el 64 y la parte DDP del 60; los FCL 61, 62 y 63 sin
factura). Es una recomendación; está en las decisiones de la sección 9.

**Una advertencia fiscal:** si un cliente paga **antes** de la factura (anticipo),
ese pago hace nacer el hecho imponible del IVA («lo que ocurra primero», LIVA
arts. 13.3.e y 55.2). Un anticipo no puede quedarse como saldo a favor sin factura
al cierre del período: es un reparo típico del SENIAT. Lo trata la decisión 4.

---

## 4. QuickBooks Online: qué comprar, cómo conectarlo y qué va a cada lado

### Qué comprar (hechos con fuente, verificados por un segundo agente)

- **Edición Global, no la de Estados Unidos.** En la página oficial «Elige tu
  país», Venezuela lleva a QuickBooks Online Global. La edición US calcula impuesto
  sobre ventas automático por direcciones de EE. UU. y **sobrescribe** los códigos
  de impuesto que mande la app: no se puede modelar el IVA.
- **Plan Plus como mínimo** (multimoneda, clases y ubicaciones hasta 40
  combinadas, 250 cuentas, 4 campos personalizados, proyectos). Advanced solo si se
  superan esos topes. Los precios no se publican estáticos; hay que confirmarlos en
  la cuenta.
- **Moneda base USD, fijada antes de activar multimoneda: es irreversible.**
- **El bolívar no existe en QuickBooks.** La lista oficial de 155 monedas trae
  solo «VEF – Venezuealan Bolivar Fuerte» (código extinto, con errata y todo); no
  trae VES ni VED. Verificado el 2026-10-18 en la página de Intuit. CNY tampoco
  apareció en la lectura automatizada: hay que confirmarlo en «Manage Currencies»
  del sandbox antes de diseñar RMB.
- Las tasas automáticas de QuickBooks vienen de IHS Markit cada 4 horas, no del
  BCV: no sirven para nada fiscal.
- La factura de QuickBooks **no es factura fiscal SENIAT** (sin imprenta ni número
  de control). Nunca se le manda su PDF al cliente.
- API: OAuth 2.0 (token de acceso 1 hora; refresh 100 días rodantes, tope 5 años,
  rota cada ~24 h: hay que guardar siempre el último); 500 solicitudes/min por
  compañía, 10/s; lotes de hasta 30 operaciones; el identificador de idempotencia
  `requestid` admite 50 caracteres suelto pero **36 dentro de un lote** (y debe
  coincidir con el `bId`), así que se usa un UUID de 36; `SyncToken` optimista; CDC
  de 30 días; webhooks que exigen responder en 3 s y pueden llegar fuera de orden;
  `minorversion=75` es la única soportada; `DocNumber` de hasta 21 caracteres; 3
  campos personalizados por transacción vía REST. Intuit recomienda importar
  facturas y pagos en orden cronológico en lotes de 10. **Una nota de crédito
  (CreditMemo) no tiene anulación documentada por API, solo borrado**: por eso una
  NC del ERP no se anula, se compensa con una nota de débito. La API de órdenes de
  venta está «solo para uso restringido» (socios Gold/Platinum); Projects y Custom
  Fields API son de pago (Silver, USD 300/mes o más); el cargo diferido (Delayed
  Charge) no está en la API. Una app propia de nivel Builder (gratis) no debe contar
  con nada de eso.

### Cómo lo hace la industria (Magaya, GoFreight, Linbis, Logitude, CargoWise, Tai, Aljex)

El sistema de carga es el registro de la operación; QuickBooks es el libro
contable. Se empujan documentos de cuentas por cobrar y por pagar (Customer,
Vendor, Item, Invoice, CreditMemo, Bill, VendorCredit) en una sola dirección; los
pagos tienen **un solo dueño** (GoFreight fija la dirección en la instalación y no
la cambia; Tai documenta sobrepagos cuando alguien aplica a mano en QuickBooks);
el costeo por embarque se aproxima en QuickBooks con sub-cliente, clase y
ubicación, pero la utilidad por embarque vive en el sistema de carga. Las quejas
típicas: duplicados por reintentos sin idempotencia, facturas editadas después de
sincronizar (Magaya no propaga la edición), saldos distintos por dos dueños del
pago. Magaya, además, limita su extensión a empresas con sede en EE. UU.

### Arquitectura recomendada

| Qué | Sistema de registro | ¿Va a QuickBooks? | Cómo |
|---|---|---|---|
| Embarque, HBL, contenedor, CBM, estado | ERP | No | Solo como referencia: campo personalizado, nota privada o sub-cliente |
| Cargos y precio por CBM | ERP | Sí, agregados en la factura | Líneas de Invoice con Item = concepto del catálogo |
| Clientes y proveedores (maestros) | ERP (origen), QBO (copia) | Sí | Customer con DisplayName «Nombre (RIF)», RIF en PrimaryTaxIdentifier; Vendor |
| Factura fiscal y notas | ERP emite, QBO contabiliza | Sí | Invoice con el mismo número; CreditMemo; nota de débito como Invoice `ND-` |
| Cobros y pagos | **Un solo dueño: ERP** | Sí, una dirección | Payment aplicado a la factura; BillPayment |
| Facturas de proveedor y gastos | ERP | Sí | Bill, VendorCredit, Purchase |
| Bancos y conciliación bancaria | QBO (USD); ERP (extractos en Bs) | — | Banco en Bs = cuenta USD «equivalente» en QBO, movimientos a tasa BCV del día, revaluación mensual por asiento desde el ERP |
| Libro mayor **gerencial** en USD, cierre gerencial, estados financieros | QBO | — | La contadora concilia y cierra con contraseña |
| **Diario y Mayor legales en bolívares** (Código de Comercio) | **ERP** | No | Generados desde el equivalente en Bs guardado en cada asiento a la tasa del día |
| IVA, IGTF, retenciones, libros SENIAT, número de control | ERP | No (solo el pasivo) | Conciliación mensual de totales contra las cuentas de QBO |
| Utilidad por embarque, cliente, ruta | ERP (costing) | No | «Income by Customer» de QBO como control |
| Diferencia en cambio, IGTF, provisiones de costo, ingreso devengado, fondos de la Operadora, nómina, depreciación, socio China | ERP calcula | Sí, como Journal Entry | Lista corta y cerrada |

**Transporte:** una cola `qbo_outbox` copiada de `kommo_writeback_outbox`
(outbox en la misma transacción → drenaje → `requestid` determinista → eco),
una tabla `qbo_sync_map` (entidad del ERP → Id, SyncToken y hash en QuickBooks),
gate de «modo seco» por tenant, manejo de los errores 6140 (número duplicado),
6240 (nombre duplicado), 6430 (ítem sin cuenta), 5010 (SyncToken viejo) y 429
(espera de 60 s) como errores de negocio en una bandeja visible; webhooks más CDC
diaria de respaldo; regla de no conformidad (si alguien edita en QuickBooks algo
sincronizado, el ERP reenvía su versión: el ERP gana); monitor de la edad del
refresh token con alerta a los 80 días.

**El diario del ERP no se apaga, y es el libro legal.** QuickBooks es el libro
gerencial en USD; el diario del ERP sigue siendo (1) el motor que arma los asientos
a partir de los documentos, (2) el espejo de control que se cuadra cada mes contra
QuickBooks por cliente, proveedor y banco, y (3) **la fuente del Diario y el Mayor
en bolívares** que exige el Código de Comercio, porque cada asiento guardará su
equivalente en Bs a la tasa BCV del día. Un Diario en Bs reconstruido desde
QuickBooks con una tasa mensual no es el libro que exige la ley. Las pantallas
gerenciales en USD del Studio pueden leer la Reports API de QuickBooks
(ProfitAndLoss, BalanceSheet, AgedReceivables, CustomerBalanceDetail; máximo seis
meses por consulta) después del corte; lo fiscal y lo legal sigue saliendo del ERP.

**Datos personales:** nombre, RIF y correo de clientes salen a servidores de Intuit
fuera de Venezuela. Es un movimiento de datos personales: pasa por
`revisar-datos-ve` antes del primer envío, con campos mínimos (ni cédulas, ni
teléfonos, ni direcciones de entrega).

---

## 5. Lo fiscal venezolano que QuickBooks no hace y el ERP debe hacer

Hechos con fuente (fechas en el anexo B):

- **IVA 16 %** (vigente desde 2020). La base en divisas se convierte a bolívares a
  la tasa del día del hecho imponible (LIVA art. 25); la factura en divisas debe
  mostrar ambas cantidades y el tipo de cambio (Providencia 0071 art. 13 n.º 14).
  El flete internacional queda fuera del débito fiscal, pero manejo, almacenaje y
  gestión aduanal en Venezuela se gravan al 16 %: hace falta un catálogo de
  conceptos con tratamiento fiscal por línea y la marca (E), y la prorrata de
  créditos fiscales cuando conviven ventas gravadas y exentas (LIVA arts. 34-35).
  Si el flete China → Venezuela es «no sujeto» o «exento» es interpretación:
  conviene consulta formal al SENIAT.
- **IGTF 3 %** sobre pagos en divisas o cripto sin mediación del sistema financiero
  nacional, percibido por los Sujetos Pasivos Especiales (Providencia 000013/2022),
  reflejado en la factura y declarado quincenalmente; 0 % en bolívares desde julio
  de 2024.
- **Retenciones de IVA** 75 % / 100 % (Providencia 000054/2025, vigente desde el
  1-08-2025), comprobante de 14 caracteres `AAAAMMSSSSSSSS`: las practica el
  Sujeto Pasivo Especial. **Retenciones de ISLR** por concepto (Decreto 1.808): las
  practica **cualquier** persona jurídica que paga (no solo el especial) y se
  enteran en los tres primeros días hábiles del mes siguiente; ser especial solo
  cambia el calendario.
- **Factura fiscal:** la Providencia 0071 sigue vigente; la 000102/2024 regula la
  facturación digital con imprenta digital autorizada que asigna el número de
  control; la 000121/2024 (homologación de software) fue **derogada el 12-08-2026**
  sin sustituta: ya no hace falta software homologado, pero el número de control
  de imprenta autorizada sigue siendo obligatorio.
- **Libros de compras y ventas** según el Reglamento (arts. 70-78), en bolívares,
  con resumen mensual que cuadre con la declaración; los contadores piden
  exportación TXT/XML; las anuladas van con montos en cero; las notas referencian
  la factura.
- **Libros legales** (Diario, Mayor, Inventarios) en bolívares según el Código de
  Comercio (arts. 32-33), salvo autorización de la Administración Tributaria para
  llevarlos en divisas. QuickBooks no puede producirlos en Bs: los produce el ERP
  (fase 3).

**Lo que el ERP debe guardar por documento** (tabla completa en el anexo B):
por factura: fecha y hora de emisión en hora de Caracas, número fiscal, número de
control y lote de la imprenta, RIF y condición del cliente, concepto por línea con
tratamiento (gravado / exento (E) / no sujeto), moneda, tasa BCV del día con fecha
de valor y fuente, base e IVA por alícuota en Bs y USD, IGTF si aplica, referencia
al embarque, estado. Por cobro: fecha, medio, moneda y monto, tasa BCV del día del
cobro, facturas aplicadas, IGTF percibido, comprobantes de retención recibidos,
diferencia en cambio. Por gasto: proveedor con RIF, factura y número de control,
base por alícuota, crédito fiscal deducible o no, retenciones practicadas, moneda y
tasa, embarque.

---

## 6. Reportes: lo que hay, lo que falta y qué debe cuadrar con qué

### Lo que hay

Dieciocho vistas en `/studio/reportes` (operacionales, comerciales, contables,
constructor, rentabilidad), pérdidas y ganancias y balance en Contabilidad, un
tablero ejecutivo (Dirección) y un dashboard configurable. Casi todo exporta CSV
y lee todo (sin recortes silenciosos). Lo que no hay es la pieza que un contador
de QuickBooks espera primero.

### Lo que falta, priorizado

| Prioridad | Reporte | Fuente de verdad | Vive en |
|---|---|---|---|
| Imprescindible | Antigüedad de cuentas por cobrar **por cliente** (corriente, 1-30, 31-60, 61-90, +90) con embarque y promesa de pago | ERP; QBO para totales tras el corte | Ambos |
| Imprescindible | Saldos por cliente (Customer Balance Summary) y facturas abiertas con pagos no aplicados | ERP; QBO tras el corte | Ambos |
| Imprescindible | Estado de cuenta del cliente en tres formatos (saldo anterior, partidas abiertas, movimientos) con abonos reales y tabla de antigüedad | ERP (emite y envía) | ERP y portal |
| Imprescindible | **Embarques sin facturar** (hito, días, CBM, tarifa, monto esperado, responsable; meta 0 al cierre) | ERP | ERP |
| Imprescindible | **Margen por embarque** con costo estimado / confirmado / real, variación y provisión | ERP (costing) | ERP |
| Imprescindible | Pérdidas y ganancias mensual devengado, por clase (LCL/FCL/DDP) y por cliente; balance a una fecha; flujo de efectivo real | ERP hoy; QBO (gerencial USD) tras el corte | Ambos |
| Imprescindible | Libros fiscales SENIAT en Bs (ventas, compras, IVA, retenciones, IGTF) y TXT | ERP (fiscal) | ERP |
| Imprescindible | Diario, Mayor y balance de comprobación exportables, sin tope de 500; **Diario y Mayor en Bs** | ERP | ERP (y QBO en USD) |
| Imprescindible | Conciliación subdiario ↔ mayor y «documentos sin asiento» | ERP | ERP |
| Importante | Antigüedad de cuentas por pagar y saldos por proveedor (con moneda) | ERP + QBO | Ambos |
| Importante | Ventas por cliente y por servicio **por período** (hoy fija a 12 meses); volumen CBM por ruta y servicio | ERP (CBM) y QBO (ventas) | Ambos |
| Importante | Reconciliación de la sincronización ERP → QBO (enviados, aceptados, rechazados, duplicados) | Integración | ERP |
| Deseable | Tránsito, entrega a tiempo, utilización del consolidado, reclamos; tablero mensual con margen %, margen por CBM, DSO, % sin facturar, top-5 clientes | ERP | ERP |

### Una sola cifra de verdad

Hoy hay **cuatro** cifras de ingreso con reglas distintas (B17). Hace falta una
sola función de ingreso del período, usada por Contabilidad, Dirección, Reportes y
Dashboard, con fecha de reconocimiento = emisión, moneda funcional USD y período
fiscal explícito; y que cada tarjeta de dinero diga si está en «USD normalizado» o
en «moneda de operación».

### Los ocho cuadres del cierre de mes

Es lo que «ata» libros y reportes. Primero se corren contra el propio ERP; después
del conector, contra QuickBooks:

1. Facturado del mes = ventas por cliente = ingreso del estado de resultados (devengado).
2. Total de la antigüedad de CxC (método «fecha de corte») = CxC del balance = saldos por cliente del ERP.
3. Cobrado = pagos recibidos = depósitos conciliados; fondos por depositar ≈ 0.
4. Total de la antigüedad de CxP = CxP del balance = proveedores del ERP.
5. Embarques completados con factura o con ingreso devengado = 100 %.
6. Provisiones por embarque = saldo de «costos acumulados por pagar»; reverso al llegar la factura del proveedor.
7. Débito fiscal del libro de ventas = IVA por pagar; IGTF percibido = IGTF declarado.
8. Bancos (USD, Bs, RMB) = extractos = tesorería del ERP.

Semanal para CxC, cobros y pagos no aplicados; mensual los ocho, con tolerancia
cero en CxC, CxP y bancos; el período se cierra solo cuando los ocho cuadran.

---

## 7. El perfil del cliente que pides

Inspirado en la página de cliente de QuickBooks Online (pestañas Lista de
transacciones, Feed de actividad, Estados de cuenta, Detalles, Notas, Tareas;
saldo pendiente arriba a la derecha; botón «Nueva transacción») y en lo que los
sistemas de carga añaden (roles de contacto, límite de crédito con exposición en
tránsito, CBM, alertas de inactivos / vencidos / sobre límite).

**Cabecera fija (tres franjas):**

1. Identidad: nombre comercial y razón social, RIF, condición (ordinario / especial,
   «retiene IVA»), moneda de facturación, vendedor, semáforo (al día / en mora /
   bloqueado por crédito).
2. Seis cifras: saldo abierto en USD con equivalente en Bs y fecha de la tasa;
   vencido con el tramo más antiguo («USD 1.240 · 31-60 días»); último pago (fecha y
   monto); embarques en curso; CBM de los últimos 12 meses; último embarque.
3. Acciones rápidas: nueva cotización, nueva factura, registrar cobro, enviar
   estado de cuenta (elige el tipo), enviar recordatorio, nota, abrir en Kommo y,
   cuando exista, abrir en QuickBooks.

**Pestañas:**

| # | Pestaña | Qué muestra | Prioridad |
|---|---|---|---|
| 1 | Resumen | Tarjetas de 12 meses (ingreso neto de notas, margen %, embarques, CBM, ticket promedio, días promedio de pago), mini antigüedad, próximos arribos, últimas actividades, notas fijadas, alertas | media |
| 2 | Embarques | En curso (por ETA, con hito, contenedor/BL, CBM, facturado y pendiente) e histórico; filtros por modalidad (LCL/FCL/aéreo), estado, año, ruta; totales por modalidad | **alta** |
| 3 | Transacciones y estado de cuenta | Gemela de la lista de transacciones de QuickBooks: fecha, tipo, número, embarque, vencimiento, monto, saldo corrido; filtros por tipo, estado y fecha; un bloque por moneda; antigüedad por tramos; estado de cuenta en tres formatos con abonos **reales** (recibo `R-`, fecha, método, referencia) y registro de envíos | **alta** |
| 4 | Cotizaciones y tarifas pactadas | Estimados con estado y conversión; tarifa por CBM vigente del cliente y su fecha | media |
| 5 | Historial (CRM) | Línea de tiempo única: notas con autor y fecha (fijables), gestiones de cobranza, eventos del sistema (factura emitida, pago, llegada), hilos de Conversaciones, resúmenes mensuales y tarjeta de Kommo (contacto vinculado, trato y etapa, tareas vencidas, enlace al trato). Primera etapa sin copiar el chat de WhatsApp | **alta** |
| 6 | Datos del cliente | Fiscal (RIF, razón social, dirección fiscal, condición, agente de retención), contactos con roles (principal, facturas, cobranza, operaciones, notificar), direcciones de entrega, condiciones comerciales (términos de pago, método, moneda, tipo de cliente), origen y vendedor, bloque QuickBooks (Id y estado de sincronización) | **alta** |
| 7 | Crédito y cobranza | Límite, exposición = saldo + embarques en tránsito sin facturar, disponible, semáforo; promesas de pago; comprobantes de retención recibidos; días promedio de pago vs. términos. El ERP es el dueño del crédito: QuickBooks no tiene límite que bloquee ni lo expone en su API | media |
| 8 | Documentos | Legales, contractuales, por embarque (BL, packing, aviso de llegada, POD), fiscales; reutiliza los adjuntos ya ligados a embarques y facturas | media |

**Reglas que lo hacen posible:** una sola función de «saldo por cliente y moneda»
compartida por Cobranzas, Conversaciones, el job de Kommo y el perfil; consultar
por el conjunto de códigos del cliente (Shipping Mark actual ∪ historial ∪
fichas fusionadas) y, a mediano plazo, llave foránea `client_id` en facturas y
embarques; las fórmulas de los indicadores fijadas en un solo sitio para que dos
pantallas no den cifras distintas; permisos: saldo abierto y vencido visibles para
todo rol con acceso a clientes (como QuickBooks le da a ventas), detalle de
facturas y recibos bajo el permiso de facturación; pasa por `/ui-check` y por
`revisar-datos-ve` (contactos, condición fiscal, conversaciones).

---

## 8. El plan por fases

**Cómo se eligió.** Tres arquitectos propusieron planes desde ángulos distintos y
tres jueces (un contador venezolano senior con QuickBooks, el director de
ingeniería del repo y el founder) los puntuaron sobre 60: «integridad primero» 42,
«la contadora manda» 41, «operación primero» 41. El plan de abajo parte del
ganador, corrige sus errores de hecho e injerta lo mejor de los otros dos: una
rebanada visible en la primera semana (de «la contadora manda»), el cobro en
bolívares y las notas de crédito en la primera fase de fondo, los libros legales
en bolívares construidos en el ERP, y la tarifa por CBM congelada con el Excel de
Yiwu como fuente auditada (de «operación primero»).

**Por qué este orden.** Un libro que miente no se arregla copiándolo a otro
sistema: se duplica la mentira y después nadie puede conciliar. Pero cada fase deja
algo que ves y que la contadora usa de inmediato, y cada una es prerrequisito
técnico de la siguiente.

**Mi ajuste.** El plan del panel pone la operación del embarque en la fase 4. Como
tú pediste expresamente que el embarque genere su documento solo, recomiendo
**adelantar la parte que no depende de lo fiscal** —tarifa por CBM congelada
(4.1), envío por cliente al consolidar (4.2) y embarques sin facturar (4.5)— a un
carril paralelo desde la fase 2: tocan archivos distintos (`app/studio/(app)/cn`,
`lib/studio/sales-orders`, `shipments`) y no chocan con el mayor. La **emisión
automática de la factura fiscal al llegar (4.3) espera** al número de control de
la fase 3, porque sin él la factura que emita el sistema no tiene validez fiscal.

Cada entrega es una SDD en `docs/specs/NNNN-slug/spec.md` con allowlist exacta,
pruebas y PR en borrador; los números los asigna `pnpm sdd:next` al abrir cada
tarea (la última en `main` es la 0551); cada migración pide su número libre al
Director, se aplica con tu OK nominal y la ejecuta el Director. Tamaños
orientativos: S (días), M (una semana), L (dos), XL (tres o más).

### Fase 1 — Rebanada visible y radiografía (sin decisiones externas)

Que veas mejoras en la primera semana y que el tamaño de las reparaciones quede
medido antes de pedir ningún OK nominal. Las cinco SDD son paralelizables porque no
comparten archivos.

**Qué ves al terminar:** el portal ya no muestra facturas anuladas como deuda y
lista todas las facturas; al abrir un cliente ves arriba cuánto debe, cuánto está
vencido y de cuándo es el último pago (la misma cifra que Cobranzas y Kommo); en
Reportes hay una sola cifra de ingreso, balance de comprobación, diario completo
descargable y dos listas nuevas: documentos sin asiento y diferencia subdiario
contra mayor. La contadora recibe balance de comprobación y diario en CSV desde el
primer mes.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 1.1 | Radiografía de integridad repetible. **Primera corrida ya hecha: medido por el Director el 2026-10-18 (~23:00Z)** con la autorización de Sam («autorizo la radiografía 1.1 con conteos y sumas, sin datos personales»): solo lectura, sin nombres ni RIF; resultado en la sección 0 (0 asientos vivos, 5 de 5 facturas emitidas sin asiento, 1.1.2 = 0 en el mayor contra un saldo abierto mayor que cero en facturas, todas en USD). La SDD convierte esa consulta del Director en script versionado y probado en Docker local con fixtures: anuladas con asiento vivo y cuántas tienen abonos; facturas por moneda sin tasa; recibos, CxP y pagos sin asiento; **`paid_amount` contra recibos** (falta en la primera corrida); reportes confirmados sin recibo; 1.1.2 contra saldos de facturas; 2.1.1 contra `supplier_bills`; asientos descuadrados; facturas emitidas por año. Se vuelve a correr solo con autorización escrita de Sam, antes de cada migración de reparación. En Git solo van conteos y comparaciones, nunca montos | dimensiona B1-B5, B16 (no cierra nada) | S | no |
| 1.2 | Portal que dice la verdad: anuladas fuera en lista, KPI, saldo, ledger, PDF y comprobante; lectura completa sin el recorte de 100; identidad fiscal del emisor en el PDF del estado de cuenta; aviso al cliente al confirmar o rechazar su reporte de pago | B14 | M | no |
| 1.3 | Saldo único por cliente (función SQL `client_outstanding` usada por Cobranzas, Conversaciones, el job de Kommo y la ficha, por el conjunto de códigos del cliente) y cabecera del perfil versión 1 (saldo, vencido, último pago, embarques en curso); el botón de estado de cuenta respeta roles | B13, B15 | M | sí (solo función) |
| 1.4 | Reportes sin migración: una sola función de ingreso; balance de comprobación; diario completo con CSV; «documentos sin asiento»; «subdiario contra mayor»; «Cashflow» pasa a llamarse «Facturado contra cobrado» | B17 | M | no |
| 1.5 | El borrador de factura conserva el embarque (`shipmentCode` no se pierde al editar) | FAC-08 | S | no |

### Fase 2 — Integridad: que el mayor y el cobro digan la verdad

Cerrar los huecos que producen cifras falsas o permiten alterarlas sin rastro, y
entregar la operación diaria que hoy no se puede registrar. Dos carriles, una
rama y un escritor por SDD: **carril A** (mayor: `lib/studio/accounting`,
`journal_*`) y **carril B** (documentos y cobro: `invoices`, RPC `0467`/`0464`).
Todo se prueba en seco con PGlite y Docker local; las reparaciones históricas
quedan como migraciones idempotentes con ensayo en seco, a la espera de la
radiografía repetida y de tu OK nominal.

**Qué ves al terminar:** cobras en bolívares (o USDT, o Zelle) una factura en
dólares y ves el recibo con su tasa y la diferencia en cambio asentada; aplicas un
recibo a varias facturas o dejas un anticipo; anulas una factura y su reverso
aparece al instante; corriges con una nota de crédito o débito ligada a la
factura; al confirmar un reporte de pago del portal nace el recibo `R-`; una
factura en bolívares asienta su equivalente en dólares y no se puede emitir sin
tasa; la pantalla «Asientos no creados» está vacía o dice qué falló. Por la API ya
no se puede editar un asiento asentado, una factura emitida ni resucitar un recibo
anulado. La contadora recibe el paquete versión 1: libro de ventas en Bs con
anuladas en cero, auxiliar de clientes con antigüedad en USD y Bs, pagos no
aplicados y la conciliación subdiario contra mayor.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 2.1 | Tasa BCV única: tabla `fx_rates` (8 decimales, fuente BCV / manual / operación, fecha de valor, quién) con carga diaria automática y respaldo; conversor canónico `to_usd` que falla cerrado (nunca cero ni el monto tal cual) y reemplaza las seis copias y las constantes; hora de Caracas para fechas de emisión y asiento; política USDT = USD 1:1 con el diferencial a 6.19 | B8 | L | sí |
| 2.2 | Asientos sin fallos silenciosos: tabla de fallos con pantalla «Asientos no creados» y «asentar pendientes»; lock en `next_entry_code`; unicidad por origen (par `source`/`source_id` e índices sobre los `journal_entry_id` de los documentos); guard de período visible en Cobranzas y Tesorería. **Es la que tiene casos reales** (radiografía del 2026-10-18: 5 de 5 facturas emitidas sin asiento): incluye «asentar pendientes» para esas facturas y el recibo cuyo asiento está anulado, con ensayo en seco, nueva radiografía y OK nominal, antes de cargar los consolidados en la base oficial | B3 | M | sí |
| 2.3 | Moneda funcional en el mayor y **bolívares por asiento**: `journal_lines` con moneda, monto original, tasa y monto en Bs; la factura no pasa a emitida sin tasa si no es USD; las dos pruebas que defienden asentar sin tasa se reescriben con su spec; reclasificación de las facturas VES/CNY ya asentadas, que hoy no tiene casos (radiografía del 2026-10-18: todas en USD) y queda solo como control | B2, B8 | L | sí |
| 2.4 | Candado del mayor: policies por rol en `accounts`, `journal_entries`, `journal_lines`; sin UPDATE/DELETE para `authenticated`; trigger Σ debe = Σ haber; asentado inmutable; `journal_lines` en la auditoría; historial de reapertura de período; `deleted_at` en el UPDATE de recibos (hueco de SDD-0494); pruebas en el arnés PGlite que ya corre en CI | B16 | M | sí |
| 2.5 | Reverso al anular factura en la misma transacción (si el período está cerrado, fechado en el primer día del período abierto con memo); no se anula una factura con recibos vivos; reparación de las anuladas históricas: hoy 0 con asiento vivo (radiografía del 2026-10-18), pero hay 1 factura anulada con cobro registrado que se resuelve con 2.6 y 2.8 | B1 | M | sí |
| 2.6 | Cobro en cualquier moneda con tasa del día y diferencia en cambio a 6.19, un recibo contra varias facturas, anticipos de clientes como pasivo con alerta fiscal al cierre si no tienen factura; el asiento del recibo nace **dentro** de la RPC; pago a proveedor con tasa del día | B9, B3 | L | sí |
| 2.7 | Confirmar un reporte de pago crea el recibo y su asiento por la misma RPC que Cobranzas (el Slice C de SDD-0134); backfill de los confirmados sin recibo (hoy 0 reportes, según la radiografía del 2026-10-18); el `payment_status` de la recepción CN se deriva de la factura. **Requisito previo: aplicar la `0422` y después la `0423`**, pendientes desde el 2026-09-13 (B24), cada una con previa de solo lectura, el smoke del bloque 3 del guion L14 y OK nominal; las ejecuta el Director | B4, B24 | M | sí |
| 2.8 | Notas de crédito y débito al cliente (`NC-`, `ND-`) con referencia obligatoria a la factura, motivo, asiento propio, aplicación al saldo y entrada al libro de ventas; **una NC no se anula, se compensa con una ND**; la retención de IVA que un cliente especial le practica a DTD se registra como documento que baja el saldo de la factura; el descuento de referido y la indemnización aterrizan como línea o NC sobre la factura según la decisión 16 | B5, B13, B20 | L | sí |
| 2.9 | Factura emitida inmutable (solo cambian, por RPC, estado, saldo pagado y las columnas de sincronización); el log registra montos; quien anula no es quien emitió o pide segundo OK. **Se integra justo después de 2.8**, nunca antes, para no provocar anulaciones y reemisiones que dejen huecos | B16, B5 | S | sí |
| 2.10 | Paquete del contador versión 1 (libro de ventas en Bs, auxiliar de clientes con antigüedad, pagos no aplicados y anticipos, conciliación subdiario contra mayor), en CSV limpio | B17, B8 | M | no |
| 2.11 | Candado del crédito de referido: las transiciones de `referrals` pasan a la base con un trigger guardián («aplicado» solo sale por la reversión; «acreditado» solo nace de una venta real, por el trigger o por una RPC con motivo); el monto queda inmutable después de acreditar; se quita el UPDATE directo a `authenticated`; al anular la factura del referido, el crédito vuelve a espera si no se aplicó. Riesgo alto: hoy un crédito puede aplicarse dos veces | B20 | M | sí |

Orden de integración a `main`: 2.1, 2.5, 2.2, 2.6, 2.3, 2.7, 2.8, 2.4, 2.9, 2.10. La 2.11 es independiente (toca `fidelizacion` y `referrals`) y puede ir en paralelo desde el principio.

### Fase 3 — Fiscal SENIAT: factura válida, libros en bolívares y Diario/Mayor legales

> **Impuestos en espera desde el 2026-10-19.** Sam decidió arrancar sin IVA ni impuestos. Quedan en
> espera 3.2, la posición de IVA de 3.4 y 3.7. Las otras SDD de la fase siguen (§9, «Decisiones de
> Sam del 2026-10-19»).

Que cada factura, nota y libro cumpla la Providencia 0071/102 y el Reglamento, y
que el ERP produzca de verdad el Diario y el Mayor en bolívares. Del 3.1 al 3.6 no
dependen de si DTD es contribuyente especial (el número de control arranca en
captura manual; el catálogo se construye parametrizado); solo 3.7 espera esa
respuesta.

**Qué ves al terminar:** una factura con número de control, correlativo asignado
al emitir, tasa BCV con fecha y fuente, líneas por servicio con marca (E), base por
alícuota y las dos cantidades (USD y Bs); el libro de ventas y el de compras en
bolívares con las anuladas en cero, exportables en TXT; la posición de IVA con
crédito fiscal, prorrata y retenciones reales; el Diario y el Mayor en bolívares;
el asiento de revaluación de bancos en Bs al cierre. La contadora ya no necesita un
programa fiscal paralelo.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 3.1 | Número de control: columna nueva `invoices.control_number`, lotes «desde-hasta» de la imprenta (física o digital), asignación al emitir con candado (modo manual desde el primer día; modo imprenta digital cuando se contrate); correlativo `F-` al emitir, no al crear (borrador con código provisional); sin reinicio anual si así lo decide la contadora; los huecos históricos se documentan, no se renumeran; `supplier_bills` con número de control y tipo de documento | B5 | M | sí |
| 3.2 | Catálogo de servicios con tratamiento fiscal (gravado 16 % / exento (E) / no sujeto), cuenta de ingreso y nombre del ítem de QuickBooks, parametrizado por fecha de vigencia y validado por la contadora antes de activarse | B6 | M | sí |
| 3.3 | Líneas de factura reales (`invoice_lines` con servicio, embarque, CBM, tratamiento y cuenta), asiento por línea a 4.1.x/4.4 en vez de 4.5, `client_id` con llave foránea | B6, B13 | L | sí |
| 3.4 | Libros fiscales en Bs por fecha de emisión en hora de Caracas; anuladas en cero y NC/ND; libro de compras con base y crédito fiscal y con las DUA; prorrata (LIVA arts. 34-35); retenciones sufridas en la posición de IVA; TXT/XML; `fiscal_settings` como única fuente de alícuotas; pasa por `revisar-datos-ve` (RIF de proveedores) | B8, B7 | L | sí |
| 3.5 | **Diario y Mayor en bolívares** desde el monto en Bs de cada asiento (2.3), con equivalente en USD y bloqueo por período cerrado; paquete del contador versión 2 (libros, TXT, resumen art. 72, auxiliares en USD y Bs, conciliación bancaria por cuenta y moneda) | B17, B8 | M | no |
| 3.6 | Revaluación mensual de saldos en moneda extranjera (bancos en Bs, cuenta en RMB) a tasa BCV de cierre contra 6.19, reversada al mes siguiente. **Trabajo nuevo**: no existe SDD previa | B9 | M | sí |
| 3.7 | IGTF y retenciones de IVA practicadas, solo si DTD es Sujeto Pasivo Especial (se construye apagado, reutilizando las banderas que ya existen en `fiscal_settings`); **retención de ISLR a proveedores sí o sí**, porque no depende de ser especial | B7 | M | sí |
| 3.8 | La nómina mensual entra al libro: asiento al confirmar el corte (gasto contra sueldos por pagar) y al pagarlo, idempotente, con guard de período | B23 | M | sí |
| 3.9 | Arranque contable: carga de saldos iniciales por cuenta, cliente y proveedor contra una cuenta de patrimonio de apertura, fecha de inicio del libro y política de conservación de los libros; es la base de la fecha de corte de 6.5 | B22 | M | sí |

### Fase 4 — Operación: tarifa congelada, factura al llegar y costo por embarque

Aquí entra el **Excel de Yiwu** («CBM a factura», «precio venta CBM») como fuente
auditada y lista de excepciones, no como verdad paralela. Dos carriles: embarques
(4.1 a 4.5) y costing / socio China (4.6, 4.7). Como dije arriba, recomiendo
adelantar 4.1, 4.2 y 4.5 a la fase 2.

**Qué ves al terminar:** cada embarque en China tiene su precio por CBM guardado,
con fuente y fecha, y una lista de los que difieren del Excel para que apruebes o
corrijas; al marcar que un embarque llegó, el cliente recibe el aviso de llegada y
nace la factura fiscal por CBM, aunque no haya orden de venta; al zarpar, el portal
muestra la pre-factura; si el precio no estaba fijado, el sistema avisa en vez de
facturar mal; en Costing el margen por embarque sale de costos reales con sus
provisiones; el socio China tiene un solo saldo y una forma de pagarle; la plata de
la Operadora ya no aparece como ingreso propio.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 4.1 | Tarifa congelada por embarque (`shipment_rate_snapshots`: tarifa, mínimo, fuente estimado / lista del cliente / casa / manual / Excel de Yiwu, fecha, quién, motivo auditado) y cargos del embarque; importador del Excel con reporte «tarifa Excel ≠ tarifa ERP»; fila «CBM real · tarifa · a facturar» y alerta «embarque sin tarifa» en Almacén CN | B12 | L | sí |
| 4.2 | Envío por cliente al consolidar (con `client_id`, CBM y peso sumados) colgado del contenedor de Naviera; se retira el `C-` sin cliente; transiciones del embarque aplicadas en la base; llegada por RPC gobernada | B12 | L | sí |
| 4.3 | Aviso de llegada y **factura fiscal al llegar** desde los cargos confirmados: la RPC `0128` extendida nace en `borrador` con `shipment_id`, prorratea por CBM (no por cajas), base = máx(CBM real × tarifa, mínimo), idempotente; la emisión pasa siempre por `emitInvoice` (gate legal, titular, número de control 3.1, tasa del día); sin tarifa, «llegado, pendiente de precio». Cubre la recepción directa en Yiwu sin orden de venta | B12 | L | sí |
| 4.4 | Pre-factura informativa al zarpar en el portal, factura complementaria por almacenaje o demoras dentro de 30 días, cierre al POD con verificación «sin cargos por facturar», plantillas de aviso por hito | B12 | M | sí |
| 4.5 | Reporte «Embarques sin facturar» y tarjetas en Dirección | B17, B12 | S | no |
| 4.6 | Costo por embarque derivado (cargos del socio con `shipment_id`, cuentas por pagar y gastos, prorrateo del contenedor por CBM), tres estados de costo con alerta de variación > 10 %, provisión mensual por embarque con reverso, devengo de ingreso en tránsito si la contadora lo adopta, margen sin IVA y período bien filtrado | B11 | L | sí |
| 4.7 | Socio China por una sola puerta (según decisión 11) con «Pagar al socio» y tasa obligatoria en RMB; fondos de la Operadora como pasivo «por rendir» con asiento de rendición | B11, B10 | L | sí |
| 4.8 | Compras asistidas y gastos cobrables generan su cargo al cliente: al recibir la compra nace la cuenta por cobrar reembolsable (o la línea en la factura del embarque) en vez de quedar como costo propio; la comisión publicada se factura como ingreso; la cuenta por defecto deja de ser la 5.1 (código explícito según la decisión 17); el puente compra → cuenta por pagar se vuelve atómico; la bandera «cobrable» del gasto produce el cargo | B19 | M | sí |
| 4.9 | Indemnización con recupero y compensación: medio «crédito a la cuenta del cliente» que genera una NC aplicada a una factura abierta; cuenta «Recuperos por cobrar» (seguro o transportista) con su asiento al reconocerlo y al cobrarlo, en tabla aparte para no reabrir el pago inmutable; moneda y tasa en el pago | B20 | M | sí |

### Fase 5 — Perfil 360 del cliente y cierre mensual del ERP

Puede solaparse con la fase 4.

**Qué ves al terminar:** el perfil del cliente abre con identidad fiscal, saldo en
USD y Bs con fecha de tasa, vencido, último pago, embarques en curso y CBM del año,
y desde ahí envía el estado de cuenta en sus tres variantes; la pestaña
Transacciones es gemela de la de QuickBooks con fechas de pago reales; en
Contabilidad hay un cierre mensual de diez pasos con los ocho cuadres en verde o en
rojo con la diferencia explicada.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 5.1 | Datos del cliente para contabilidad y crédito: condición fiscal, términos de pago, método, moneda, tipo, límite de crédito, vendedor, correo de facturas; contactos con roles; notas con fecha y autor; columnas preparadas para QuickBooks; pasa por `revisar-datos-ve` | B13 | M | sí |
| 5.2 | Perfil del cliente completo con la cabecera y las ocho pestañas de la sección 7 (excepto Historial CRM, que llega en la fase 7); abonos por la fecha real del recibo (revierte la decisión del 2026-07-29 con tu OK); permisos por módulo; `/ui-check` | B13 | L | no |
| 5.3 | Reportes del cierre: antigüedad por cliente y proveedor, saldos por cliente, pagos no aplicados, flujo de caja directo desde cuentas de caja y banco, balance a fecha de corte con cierre de ejercicio a 3.4, tablero mensual, checklist de cierre de diez pasos y los ocho cuadres como pantalla | B17 | L | no |
| 5.4 | Permisos de la contadora con separación de funciones: según la decisión 15, abrirle Dirección, Rendiciones y Financiero China en lectura (o entregarle sus cierres), y separar emitir de anular, causar de pagar, y crear proveedor de pagarle; RLS por rol y auditoría en las siete tablas del Socio China (hoy abiertas por la API a cualquier empleado); gastos de operaciones y almacén como borrador que la contadora asienta, si así lo decide la decisión 18; perfil de solo lectura para un contador externo | B21, B16 | M | sí |

### Fase 6 — Conector QuickBooks Online (espejo)

> **Fuera del plan desde el 2026-10-19.** Sam decidió que QuickBooks es temporal y que nada del
> ERP viaja a QuickBooks (§9, «Decisiones de Sam del 2026-10-19»). Esta fase y la 7.1 quedan
> solo como registro.

Documentos verdaderos en una sola dirección, idempotentes, con cola visible y
cuadre mensual automatizado. Primero sandbox Plus Global, después la compañía real.
**6.1 y 6.2 pueden arrancar en sandbox apenas termine la fase 2 y exista el
catálogo de 3.2**, en paralelo con las fases 4 y 5, porque los maestros no llevan
cifras falsas.

**Qué ves al terminar:** una pantalla «QuickBooks» con la conexión viva, la cola y
cero errores; en QuickBooks los mismos clientes, servicios, facturas, notas,
cobros y facturas de proveedor que en el ERP, con el mismo número; reconciliación
de la sincronización en cero; en Dirección el estado de resultados, el balance y
la antigüedad de QuickBooks al lado de los del ERP, iguales.

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 6.1 | Cimientos: app en Intuit Developer nivel Builder; sandbox con verificación de VES/VED y CNY; OAuth 2.0 con tokens en Vault (patrón Kommo) y monitor del refresh token; `qbo_sync_map`; `qbo_outbox` con `requestid` UUID de 36 caracteres, modo seco por tenant, ritmo de la API y bandeja de errores de negocio; pantalla «QuickBooks» en Contabilidad; `revisar-datos-ve` | B18 | L | sí |
| 6.2 | Maestros en sandbox: Customer («Nombre (RIF)», moneda USD fija, inactivar en vez de borrar, fusionados mapeados al superviviente), Vendor, Item desde el catálogo, Account por `qbo_type`, TaxCode «IVA 16 % ventas / compras» y «Exento» | B18, B6 | M | sí |
| 6.3 | Documentos de venta y cobro: Invoice (mismo número, número de control, embarque y tasa en campos personalizados; Bs en nota privada; clase por servicio), CreditMemo, Invoice `ND-`, Payment con cuenta de depósito (anticipos como monto no aplicado), retención recibida; void en espejo para factura y pago; la NC no se anula (2.8). Espera las fases 2 y 3 completas | B18 | L | sí |
| 6.4 | Compras y asientos acotados: Bill, VendorCredit, BillPayment; Journal Entry solo para la lista corta (6.19, IGTF, retenciones practicadas, revaluación, depreciación, nómina, rendición, provisiones y devengo cuando exista la fase 4); sub-cliente opcional por embarque | B18 | L | sí |
| 6.5 | Carga inicial a la fecha de corte: solo saldos de apertura como documentos abiertos, en orden cronológico y lotes de 10; ensayo íntegro en sandbox; lectura de producción con tu autorización y ventana acordada; comparación contra el subdiario antes de declarar la apertura | B18 | M | no |
| 6.6 | Cuadre ERP ↔ QBO: CDC diaria, regla de no conformidad (el ERP gana), reporte de reconciliación, los ocho cuadres contra la Reports API, fecha de cierre de QuickBooks alineada con la `0133`; actualizar `docs/architecture/contabilidad-qbo-online.md` | B18, B17 | M | no |

### Fase 7 — Corte del libro gerencial y conversación comercial en el perfil

| # | SDD propuesta | Cierra | Tamaño | Migración |
|---|---|---|---|---|
| 7.1 | Corte: acta firmada por ti y la contadora tras dos cierres mensuales consecutivos con los ocho cuadres en cero; períodos anteriores cerrados en ambos sistemas; en QuickBooks la contadora concilia y cierra, pero no crea facturas ni pagos; «QBO oficial desde» en `fiscal_settings`; lo gerencial en USD pasa a leerse de QuickBooks y lo fiscal y legal en Bs sigue saliendo del ERP | B18 | S | sí |
| 7.2 | Historial CRM en el perfil: notas y eventos tipificados de Kommo (resumen y enlace, sin copiar el chat salvo que lo autorices), eventos del ERP, nuevas notas y tareas por la cola de Kommo; campaña de vínculo cliente ↔ contacto priorizando clientes con saldo o carga; retomar SDD-0483 con migración nueva | B15, B13 | L | sí |

**Camino corto para que la contadora trabaje en QuickBooks con cifras
confiables:** fase 1, fase 2 completa, 3.1 a 3.6, 3.8, 3.9, 5.4 y fase 6. Lo demás mejora margen,
operación y perfil, pero no es requisito del corte.

**Volumen:** 46 SDD (5 + 11 + 9 + 9 + 4 + 6 + 2), 35 con migración, más la aplicación de las migraciones pendientes `0422` y `0423`. El Director serializa las que tocan
`lib/studio/accounting`, `invoice-posting.ts` y las RPC `0467`/`0468`, y
paraleliza portal, perfil, costing y el carril del embarque.

---

## 9. Decisiones que necesito de ti (y de la contadora)

Ordenadas por lo que más bloquean. En cada una va quién decide, antes de qué y mi
recomendación (⭐).

1. **[Contadora · antes de la fase 2] Moneda funcional del mayor y tratamiento de
   la diferencia al cobrar en bolívares o USDT.** ⭐ USD como moneda funcional del
   mayor, con el equivalente en bolívares guardado por asiento para los libros
   legales; la factura congela la tasa BCV del día de emisión; si el cliente paga
   en Bs a otra tasa, la diferencia va a 6.19 «Diferencia en cambio» (solo si el
   contrato pacta variación por tipo de cambio, nota de débito o crédito según el
   Reglamento art. 51); USDT = USD 1:1 con el descuento al convertir en 6.19.
2. **[Tú con la contadora · antes de la fase 2] Cómo se reparan los datos
   históricos y quién autoriza cada radiografía.** ⭐ Nunca reabrir períodos
   cerrados: reversos y reclasificaciones fechados el primer día del período
   abierto con memo que cita documento y fecha original; una radiografía de solo
   lectura autorizada por ti por escrito en cada ocasión, nombrando la migración
   que dimensiona; la contadora decide si algo amerita declaración sustitutiva.
3. **[Tú con la contadora · antes de 2.6] Dueño único del cobro y qué hace la
   contadora en QuickBooks.** ⭐ El ERP registra y aplica todo cobro y pago
   (incluidos los del portal); en QuickBooks ella concilia bancos, cierra períodos
   y lee reportes, pero no crea facturas, pagos ni asientos (los ajustes de cierre
   se capturan en el ERP y viajan).
4. **[Contadora · antes de 2.6] Anticipos: qué pasa cuando el cliente paga antes de
   la factura.** El pago hace nacer el IVA (LIVA arts. 13.3.e y 55.2). ⭐ Emitir la
   factura dentro del período del cobro cuando el servicio ya está identificado
   (embarque con tarifa congelada); si no, factura de anticipo con su nota de
   crédito al facturar el servicio; el ERP lista al cierre los anticipos sin
   factura, con meta cero.
5. **[Contadora con el RIF · antes de la fase 3] ¿DTD (y cada entidad que factura:
   DTD Services, la Operadora) es Sujeto Pasivo Especial, y qué medios de cobro
   cuentan como «sin mediación del sistema financiero nacional»?** Define el IGTF
   y las retenciones de IVA. ⭐ Confirmarlo en el Portal Fiscal; el módulo se
   construye apagado y se enciende solo si la respuesta es sí, con la lista de
   medios (Zelle, transferencias al exterior, efectivo en divisas, USDT) en
   `fiscal_settings`. La retención de ISLR a proveedores va en cualquier caso.
6. **[Contadora con la imprenta · antes de 3.1 en modo final] ¿De dónde sale el
   número de control?** Forma libre con número preimpreso (Providencia 0071),
   imprenta digital autorizada (Providencia 102), o la factura fiscal se emite
   fuera del ERP. ⭐ Imprenta digital autorizada con número asignado al emitir;
   mientras llega, captura manual del número y bloqueo de emisión sin número
   cuando el módulo esté encendido.
7. **[Contadora, con consulta al SENIAT · antes de activar 3.2] Tratamiento de IVA
   por concepto.** ⭐ Flete internacional exento / no sujeto marcado (E); manejo,
   almacenaje y gestión aduanal 16 %; entrega local exenta; reembolsos por cuenta
   del cliente no sujetos; parametrizado por fecha para cambiarlo sin desarrollo.
8. **[Contadora · antes de 3.1] Correlativo de facturas.** ⭐ Número asignado al
   emitir, con candado y sin reinicio anual (el prefijo del año puede quedar como
   texto); los huecos históricos se documentan, no se renumeran.
9. **[Tú · antes de la fase 4 o del carril adelantado] Qué tarifa por CBM manda,
   cuándo se congela y en qué hito nace la factura fiscal.** ⭐ Tarifa congelada en
   la recepción en Yiwu con el CBM medido allí (500 kg/m³ es la regla; 1.000 la
   excepción); orden: estimado aceptado → lista del cliente o aliado → tarifario
   vigente; el Excel se importa como fuente auditada y sus diferencias se aprueban
   una a una hasta retirarlo; mínimo se cobra; exceso de peso según decidas por
   contenedor; pre-factura informativa al consolidar y factura fiscal al llegar a
   Venezuela con vencimiento inmediato.
10. **[Contadora · antes de 4.6] Reconocimiento de ingreso y costos por
    embarque.** ⭐ Ingreso al emitir la factura en la llegada, más un asiento
    mensual reversable de ingreso devengado por embarques en tránsito si ella lo
    pide; DTD como principal (ingreso bruto) con el flete de la naviera y los
    gastos en China como costo y provisión por embarque.
11. **[Tú con la contadora · antes de 4.7] Socio China por una sola puerta y fondos
    de la Operadora.** ⭐ Cuenta corriente 2.1.7 con el libro doble USD/RMB que ya
    existe, «Pagar al socio» y retiro de los tramos pp/ca para el socio; fondos de
    terceros como pasivo «por rendir a la Operadora» con rendición que asienta la
    transferencia del neto (cambia el ingreso reconocido de DTD Services: es
    decisión contable).
12. **[Tú con la contadora · antes de la fase 6] Libro oficial y fecha de corte.**
    ⭐ ERP = sistema de registro operativo, fiscal y **legal en bolívares** (Diario
    y Mayor desde la fase 3) hoy y siempre; QuickBooks = libro gerencial oficial en
    USD a partir de una fecha de corte firmada tras dos cierres con los ocho cuadres
    en cero; solo se cargan saldos de apertura, nunca la historia.
13. **[Tú con la contadora · antes de 6.1] Edición, plan y estructura de
    QuickBooks.** ⭐ Online Global, Plus, español (LatAm), moneda base USD; una
    compañía por entidad legal (consolidación fuera de QuickBooks); verificar VES y
    CNY en el sandbox; a Intuit solo razón social o nombre, RIF y correo de
    facturación, registrado en `revisar-datos-ve`.
14. **[Tú] Estado de cuenta, permisos y conversaciones.** ⭐ Revertir la decisión
    del 2026-07-29: abonos desde los recibos reales con fecha, número y referencia.
    Saldo abierto y vencido visibles para todo rol con acceso a clientes; detalle de
    facturas y recibos bajo el permiso de facturación. El chat de WhatsApp no se
    copia al ERP (resumen y enlace a Kommo) salvo que lo autorices por escrito con
    retención definida.

15. **[Tú] ¿Qué ve y qué puede hacer la contadora?** Hoy, con rol `accounting`,
    no ve Dirección, Rendiciones ni Financiero China, y puede crear proveedor,
    causar, pagar y anular sola. ⭐ Abrirle esos tres módulos en lectura para que
    pueda cerrar, y exigir segunda aprobación (tuya o de admin) para anular una
    factura emitida y para pagos a proveedor por encima de un monto en USD que tú
    fijes.
16. **[Contadora] Descuento de referido e indemnización por reclamo: ¿contra-ingreso
    o gasto?** Hoy el referido se asienta como gasto de publicidad (6.11) y el
    descuento de USD 60 prometido al referido no aterriza en su factura. ⭐
    Descuento sobre ventas (4.9) que aterriza como línea o nota de crédito en la
    factura del primer embarque (el modelo «Delayed Credit» de QuickBooks: la
    promesa no toca los libros hasta entonces); la indemnización, como nota de
    crédito si se compensa con la factura o como gasto si se paga aparte.

17. **[Tú con la contadora · antes de 4.8] En la compra asistida, ¿DTD es
    principal o agente?** Como principal revende: factura completa con su IVA y
    costo en una cuenta de compra asistida. Como agente compra por cuenta del
    cliente: cuentas de paso (anticipo y por cobrar reembolsable) y factura solo de
    la comisión. ⭐ Agente en la modalidad «compramos por ti» y principal solo si
    DTD revende con su propio proveedor; dejarlo escrito por modalidad en la spec,
    y una sola cuenta para la mercancía por cuenta del cliente en los dos módulos.
18. **[Tú con la contadora · antes de 5.4] Gastos de operaciones y almacén: ¿se
    asientan al cargarlos o entran como borrador que la contadora revisa?** ⭐
    Borrador que la contadora asienta, como la bandeja «For review» de
    QuickBooks, al menos para los gastos por encima de un monto que tú fijes.

### Decisiones de Sam del 2026-10-19

Sam las dio al Director el 2026-10-19 a las 18:02Z, sobre el documento
«Preguntas para la contadora». Las citas son literales.

| Tema | Decisión | Texto de Sam |
|---|---|---|
| Decisión 3: dueño del cobro | **Aceptada**, con un ajuste. El ERP registra y aplica todo cobro y pago. QuickBooks se lleva en paralelo solo mientras el ERP no esté listo, y después se deja. **No hay conector**: nada del ERP viaja a QuickBooks | «me gusta lo recomendado en la parte 3» · «QuickBooks solo está de paso; en cuanto nosotros podamos llevar las cosas bien en el ERP, dejaremos de usarlo» · «Lo demás se va a trabajar todo en el ERP; no nos interesa que viaje a QuickBooks después, ya que QuickBooks lo vamos a llevar de forma simultánea hasta que el ERP esté haciendo bien las cosas» |
| Decisión 4: anticipos | **Aceptada**, la recomendación tal cual | «En el tema del anticipo, donde el cliente paga antes de la facturación, sí aplica lo que me estás recomendando» |
| Impuestos | **Fuera por ahora.** No se aplican IVA, IGTF ni retenciones; se habilitan más adelante | «vamos a empezar todo sin temas de IVA ni nada de impuestos. Más adelante habilitaremos esa función y la arreglaremos en su debido momento, pero por ahora no nos interesa» |
| Período cerrado (sobre la decisión 2) | **Propuesta de Sam:** como en QuickBooks, se puede cambiar un período cerrado tras una advertencia y con una superclave de autorización distinta de la clave del usuario. Queda abierta la opinión de la contadora | «cuando voy a hacer algo en un ciclo cerrado, te dice: "este ciclo ya cerró contablemente; si deseas cambiarlo..." y hace una advertencia» · «tiene una clave aparte de la del usuario que está trabajando: tiene una superclave de autorización» |

**Siguen abiertas:**
- la decisión 1 (moneda funcional), de la contadora;
- la decisión 2 (reparación de históricos), que ahora incluye la propuesta de la superclave.

**Cómo cambia el plan.** Es lectura del Director, revisable por Sam:
- **La fase 6 (conector QuickBooks) y la 7.1 (corte del libro gerencial) salen del plan**, y con ellas las decisiones 12 y 13. El ERP es el único libro.
- **De la fase 3 quedan en espera las partes de impuestos:** el IVA por concepto (3.2 y decisión 7), la posición de IVA de 3.4, el IGTF y las retenciones de 3.7, y la decisión 5. Siguen vigentes, porque no son impuestos:
  - el número de control y el correlativo (3.1, decisiones 6 y 8), salvo que Sam diga otra cosa;
  - el Diario y el Mayor en bolívares (3.5);
  - la revaluación (3.6);
  - la nómina en el libro (3.8);
  - el arranque contable (3.9).
- **Tarea nueva, antes de la 2.11:** el cierre contable con superclave y el reporte «Excepciones al cierre». Hoy la SDD-0080 (migración `0133`) bloquea los asientos con `entry_date <= closing_date`, y para corregir algo hay que mover o quitar la fecha, lo que reabre el período para todos. La referencia es QuickBooks Online: en «Close the books» se elige entre «Allow changes after viewing a warning» o «…and entering password» ([Intuit](https://quickbooks.intuit.com/learn-support/en-us/customer-company-settings/how-to-close-the-books/00/186384)), y cada cambio aparece en el reporte «Exceptions to Closing Date». Lleva migración.

**Radiografía 1.1: ya autorizada y corrida.** Sam la autorizó el 2026-10-18 («autorizo
la radiografía 1.1 con conteos y sumas, sin datos personales») y el Director la
ejecutó ese día (~23:00Z). Cada nueva corrida, antes de una migración de
reparación, necesita otra autorización escrita; cualquier corrección posterior es
una migración con tu OK nominal y la ejecuta el Director.

---

## 10. Qué NO hacer

- No conectar documentos ni asientos a QuickBooks antes de cerrar las fases 2 y 3:
  aunque la factura viaje en USD y la anulación se espeje por documento, los
  cobros del portal sin recibo no tendrían Payment, los cuadres contra el subdiario
  fallarían y el libro legal en Bs que sale del ERP seguiría roto. Los maestros sí
  pueden ensayarse en sandbox antes.
- No llevar la contabilidad legal en QuickBooks en USD: el Código de Comercio la
  exige en bolívares; QuickBooks es el libro gerencial.
- No contratar la edición de Estados Unidos ni Simple Start / Essentials; no
  activar multimoneda sin verificar VES y CNY; no usar VEF como sustituto del
  bolívar; no usar la tasa automática de QuickBooks para nada fiscal.
- No sincronizar asientos resumidos en lugar de documentos; no espejar el diario
  del ERP en QuickBooks.
- No permitir dos dueños del cobro.
- No enviar al cliente el PDF de QuickBooks; no usar «Sales Receipt» (pierde la
  cuenta por cobrar); no crear borradores en QuickBooks (toda Invoice asienta).
- No borrar documentos en QuickBooks: factura y pago se anulan con void; una nota
  de crédito no se anula, se compensa con una nota de débito.
- No emitir la factura fiscal al recibir en China ni al zarpar; no editar facturas
  emitidas: toda corrección va por nota referenciada.
- No activar la inmutabilidad de la factura antes de que existan las notas de
  crédito y débito.
- No dejar anticipos cobrados sin factura al cierre del período.
- No modelar el IGTF como tasa de impuesto sobre la venta: es un pasivo que nace
  con el cobro en divisas, y solo si DTD es especial.
- No construir sobre la API de órdenes de venta, Projects ni Custom Fields de
  Intuit (restringidas o de pago); no mapear la orden de venta `OV-` a QuickBooks.
- No usar una clase por embarque (tope de 40 en Plus): el embarque va en campo
  personalizado, nota privada o sub-cliente.
- No construir un segundo motor de auto-factura: se extiende la RPC `0128`.
- No crear tablas nuevas llamadas `shipment_events` ni `shipment_documents`: ya
  existen con otro propósito.
- No cablear WhatsApp Cloud API en paralelo a Kommo.
- No cargar la historia completa a QuickBooks: saldos de apertura a la fecha de
  corte.
- No dejar que el Excel de Yiwu sea una verdad paralela silenciosa.
- No debilitar el cierre de período `0133` ni las RPC atómicas; no debilitar
  pruebas (las dos que defienden «asentar sin tasa» se reescriben con su spec).
- No leer filas de producción sin autorización; no aplicar backfills sin OK
  nominal; no renumerar migraciones aplicadas; no mergear código que dependa de una
  migración antes de aplicarla.
- No correr dos corridas pesadas a la vez ni dos SDD que toquen los mismos
  archivos de posting en paralelo.

---

## 11. Anexos y evidencia

- **Anexo A** — `2026-10-18-contabilidad-anexo-hallazgos.md`: los 14 informes de
  área con inventario, flujo, controles, hallazgos con `archivo:línea`, veredictos
  de los revisores escépticos y preguntas por área.
- **Anexo B** — `2026-10-18-contabilidad-anexo-investigacion.md`: los 6 informes
  externos con hechos fechados, fuentes, afirmaciones verificadas, tablas de
  objetos de la API de QuickBooks, equivalencias ERP ↔ QBO, límites, impuestos
  venezolanos, reportes y KPI.
- **Anexo C** — `2026-10-18-contabilidad-anexo-planes.md`: los tres planes del
  panel, los nueve juicios con errores de hecho e injertos, y la síntesis.
- Handoff de la sesión: `.agents/handoffs/2026-10-18-contabilidad-diagnostico.md`.

**Estado de las migraciones de las que depende el plan — medido por el Director el
2026-10-18 (~22:40Z)** con una consulta de solo lectura sobre
`supabase_migrations.schema_migrations` en producción (495 filas, sin datos de
negocio). Están aplicadas, con su versión en el ledger:

| Migración | Versión en el ledger |
|---|---|
| `0464` | `20260919010007` |
| `0466` | `20260919030533` |
| `0467` | `20260919021949` |
| `0468` | `20260920000508` |
| `0471` | `20260921170338` |
| `0477` | `20261015141547` |
| `0483` a `0489` | entre `20261015202357` y `20261015202507` |
| `0490` | `20261015225935` |
| `0491` | `20261016081616` |

La cabecera «NO APLICADA A PRODUCCIÓN» de esos archivos es histórica y no se
corrige: editarla rompe la identidad por md5. La siguiente migración libre al
2026-10-18 es la **`0492`**; cada SDD la confirma con el Director antes de usarla,
porque puede haber otra sesión trabajando.

**Pendiente que no se pudo cerrar sin ti:** todo lo etiquetado **NO VERIFICADO**
depende de leer producción con tu autorización. El Excel de Yiwu queda para cuando
lo mandes (entra en 4.1).
