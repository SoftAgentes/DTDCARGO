# Plan de cuentas seed — estándar de industria estilo QuickBooks (Transporte / Freight)

> **Fuente del seed de SDD-0040.** Plan de cuentas **genérico editable** (NO datos reales de
> ninguna empresa). Reconstrucción del estándar que QBO afina para la industria *Transportation*,
> adaptado a un freight forwarder de importación (China→Venezuela). Investigado de fuentes QBO/Intuit
> + plantillas de trucking/freight (qbkaccounting, Vencru, Fastbooks, SaaSAnt, Fast Trac).
>
> **Caveats (documentados):** QBO no publica una lista literal de cuentas por industria; esto es el
> estándar reconstruido. **No mapea al código fiscal venezolano (SENIAT / VEN-NIF)** — si se necesita
> reporte fiscal local, es otro CoA y lo valida un contador VE. El usuario edita/renombra a gusto.
>
> Columnas: `code` (jerárquico, parent = code sin el último segmento) · `name` (ES) · `type`
> (A/P/PT/I/CGS/G) · `postable` (true = hoja donde se asientan movimientos; false = grupo) ·
> `qbo_type` (Account Type nativo de QBO, para el campo de referencia).

| code | name | type | postable | qbo_type |
|---|---|:--:|:--:|---|
| 1 | Activo | A | false | — |
| 1.1 | Activo corriente | A | false | — |
| 1.1.1 | Caja y bancos | A | false | Bank |
| 1.1.1.1 | Caja chica | A | true | Bank |
| 1.1.1.2 | Banco cuenta corriente | A | true | Bank |
| 1.1.1.3 | Banco USD | A | true | Bank |
| 1.1.2 | Cuentas por cobrar clientes | A | true | Accounts receivable (A/R) |
| 1.1.3 | Fondos no depositados | A | true | Other Current Assets |
| 1.1.4 | Anticipos a proveedores / navieras | A | true | Other Current Assets |
| 1.1.5 | Seguros pagados por adelantado | A | true | Other Current Assets |
| 1.1.6 | Aranceles de importación por recuperar | A | true | Other Current Assets |
| 1.1.7 | Inventario de repuestos | A | true | Other Current Assets |
| 1.2 | Activo fijo | A | false | — |
| 1.2.1 | Flota — vehículos / camiones | A | true | Fixed Assets |
| 1.2.2 | Remolques | A | true | Fixed Assets |
| 1.2.3 | Equipos de almacén / montacargas | A | true | Fixed Assets |
| 1.2.4 | Mobiliario y equipo de oficina | A | true | Fixed Assets |
| 1.2.5 | Equipos de cómputo | A | true | Fixed Assets |
| 1.2.9 | Depreciación acumulada de flota (contra) | A | true | Fixed Assets |
| 2 | Pasivo | P | false | — |
| 2.1 | Pasivo corriente | P | false | — |
| 2.1.1 | Cuentas por pagar proveedores | P | true | Accounts payable (A/P) |
| 2.1.2 | Tarjeta de crédito | P | true | Credit Card |
| 2.1.3 | Sueldos por pagar | P | true | Other Current Liabilities |
| 2.1.4 | Impuestos por pagar | P | true | Other Current Liabilities |
| 2.1.5 | IVA / impuesto a las ventas por pagar | P | true | Other Current Liabilities |
| 2.1.6 | Desembolsos a clientes (terceros) | P | true | Other Current Liabilities |
| 2.2 | Pasivo no corriente | P | false | — |
| 2.2.1 | Préstamos por compra de vehículos | P | true | Long Term Liabilities |
| 2.2.2 | Préstamos bancarios largo plazo | P | true | Long Term Liabilities |
| 3 | Patrimonio | PT | false | — |
| 3.1 | Capital social | PT | true | Equity |
| 3.2 | Aportes del propietario | PT | true | Equity |
| 3.3 | Retiros del propietario | PT | true | Equity |
| 3.4 | Utilidades retenidas | PT | true | Equity |
| 3.5 | Utilidad/pérdida del ejercicio (calculada) | PT | true | Equity |
| 4 | Ingresos | I | false | — |
| 4.1 | Ingresos por flete / transporte | I | false | Income |
| 4.1.1 | Flete marítimo — consolidado / LCL | I | true | Income |
| 4.1.2 | Flete marítimo — contenedor / FCL | I | true | Income |
| 4.1.3 | Puerta a puerta DDP | I | true | Income |
| 4.1.4 | Transporte terrestre nacional | I | true | Income |
| 4.2 | Recargo por combustible | I | true | Income |
| 4.3 | Cargos accesorios | I | false | Income |
| 4.3.1 | Demoras / detención | I | true | Income |
| 4.3.2 | Manipuleo / carga-descarga | I | true | Income |
| 4.3.3 | Almacenaje | I | true | Income |
| 4.4 | Gestión aduanera / despacho | I | true | Income |
| 4.5 | Otros ingresos por servicios | I | true | Income |
| 4.9 | Descuentos sobre ventas (contra) | I | true | Income |
| 5 | Costo de ventas | CGS | false | — |
| 5.1 | Flete comprado a navieras / aerolíneas | CGS | true | Cost of Goods Sold |
| 5.2 | Transporte subcontratado / fletes a terceros | CGS | true | Cost of Goods Sold |
| 5.3 | Combustible (costo de venta) | CGS | true | Cost of Goods Sold |
| 5.4 | Aranceles e impuestos de importación | CGS | true | Cost of Goods Sold |
| 5.5 | Honorarios de agente aduanal | CGS | true | Cost of Goods Sold |
| 5.6 | Peajes y pesaje | CGS | true | Cost of Goods Sold |
| 5.7 | Alquiler de equipos para trabajos | CGS | true | Cost of Goods Sold |
| 5.8 | Seguro de la carga | CGS | true | Cost of Goods Sold |
| 5.9 | Manipuleo y almacenaje portuario | CGS | true | Cost of Goods Sold |
| 6 | Gastos operativos | G | false | — |
| 6.1 | Combustible y lubricantes de flota propia | G | true | Expenses |
| 6.2 | Reparación y mantenimiento de vehículos | G | true | Expenses |
| 6.3 | Neumáticos | G | true | Expenses |
| 6.4 | Permisos, licencias y placas | G | true | Expenses |
| 6.5 | Sueldos y salarios | G | false | Expenses |
| 6.5.1 | Sueldos de choferes / operarios | G | true | Expenses |
| 6.5.2 | Sueldos administrativos | G | true | Expenses |
| 6.5.3 | Cargas sociales / impuestos de nómina | G | true | Expenses |
| 6.6 | Seguros | G | false | Expenses |
| 6.6.1 | Seguro de flota / responsabilidad | G | true | Expenses |
| 6.6.2 | Seguro general / RC | G | true | Expenses |
| 6.7 | Alquiler de local / almacén | G | true | Expenses |
| 6.8 | Servicios públicos | G | true | Expenses |
| 6.9 | Honorarios profesionales | G | true | Expenses |
| 6.10 | Comisiones bancarias y de procesador | G | true | Expenses |
| 6.11 | Publicidad y marketing | G | true | Expenses |
| 6.12 | Telecomunicaciones e internet | G | true | Expenses |
| 6.13 | Suministros de oficina | G | true | Expenses |
| 6.14 | Viáticos y viajes | G | true | Expenses |
| 6.15 | Viáticos de chofer / per diem | G | true | Expenses |
| 6.16 | Comisiones a vendedores | G | true | Expenses |
| 6.17 | Depreciación de flota y equipos | G | true | Other Expense |
| 6.18 | Intereses de préstamos | G | true | Other Expense |
| 6.19 | Diferencia en cambio | G | true | Other Expense |
| 6.99 | Gastos varios / no categorizados | G | true | Expenses |

**Total: 86 cuentas** (grupos + hojas). El seed las reproduce 1:1.

## Cuentas clave para el asiento automático (SDD-0040 §5)
- `1.1.2` Cuentas por cobrar clientes → **debe** al emitir factura.
- `4.1` (o hijo) Ingresos por flete → **haber** (base) al emitir factura.
- `2.1.5` IVA por pagar → **haber** (IVA) cuando el toggle IVA está ON.
