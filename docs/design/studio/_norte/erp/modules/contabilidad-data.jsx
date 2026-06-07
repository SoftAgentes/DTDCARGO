/* global React */
/* ── DTD ERP · Contabilidad · Datos & helpers · v2.5 ────────── */
/* Plan de cuentas (CoA) freight-forwarder VE + asientos seed.   */
/* Libros en USD · VES de referencia con tasa del día.           */
/* v2.5 · asientos remapeados al plan real · saldos leaf-aware.  */

const CONTABILIDAD_LS_KEY = 'dtd_contab_v1';

// ── Plan de cuentas · 4 niveles ───────────────────────────────
// Estructura típica freight forwarder VE adaptada a DTD-Cargo.
// type: A (Activo) · P (Pasivo) · PT (Patrimonio) · I (Ingreso) · CGS (Costo Directo) · G (Gasto Op.) · OR (Otros Resultados)
const CHART_OF_ACCOUNTS = [
  // ── ACTIVO ──
  { code: '1', name: 'ACTIVO', level: 1, type: 'A', parent: null },
  { code: '1.01', name: 'BOLIVAR', level: 2, type: 'A', parent: '1', detail: 'Banco' },
  { code: '1.01.01', name: 'BANCAMIGA JM 5189', level: 3, type: 'A', parent: '1.01', detail: 'Banco' },
  { code: '1.01.02', name: 'BANESCO JM 8561', level: 3, type: 'A', parent: '1.01', detail: 'Banco' },
  { code: '1.01.03', name: 'BNC JD', level: 3, type: 'A', parent: '1.01', detail: 'Banco' },
  { code: '1.01.04', name: 'BNC JM', level: 3, type: 'A', parent: '1.01', detail: 'Banco' },
  { code: '1.01.05', name: 'VENEZUELA JM', level: 3, type: 'A', parent: '1.01', detail: 'Banco' },
  { code: '1.02', name: 'CASH', level: 2, type: 'A', parent: '1', detail: 'Banco' },
  { code: '1.02.01', name: 'CAJA ABDALA', level: 3, type: 'A', parent: '1.02', detail: 'Efectivo disponible' },
  { code: '1.02.02', name: 'Caja Principal (Yoli)', level: 3, type: 'A', parent: '1.02', detail: 'Efectivo disponible' },
  { code: '1.03', name: 'CHINA', level: 2, type: 'A', parent: '1', detail: 'Efectivo y equivalentes de efectivo' },
  { code: '1.03.01', name: 'ALIPAY SAM', level: 3, type: 'A', parent: '1.03', detail: 'Banco' },
  { code: '1.03.02', name: 'Banco Candy', level: 3, type: 'A', parent: '1.03', detail: 'Banco' },
  { code: '1.03.03', name: 'CAMBISTA AARON CN', level: 3, type: 'A', parent: '1.03', detail: 'Banco' },
  { code: '1.03.04', name: 'CAMBISTA CHINA LEUNG', level: 3, type: 'A', parent: '1.03', detail: 'Banco' },
  { code: '1.04', name: 'USD', level: 2, type: 'A', parent: '1', detail: 'Banco' },
  { code: '1.04.01', name: 'BANESCO PANAMA 56247', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.02', name: 'BINANCE USDT JM 6020', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.03', name: 'CAJA CRUCE DE CTAS', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.04', name: 'CAMBISTA DARWIN', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.05', name: 'MONEY WAYS DOORTUDOOR', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.06', name: 'MONEY WAYS DTD', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.07', name: 'ZINLI JM', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.04.08', name: 'ZINLI YOLI', level: 3, type: 'A', parent: '1.04', detail: 'Banco' },
  { code: '1.05', name: 'CUENTAS POR COBRAR (C/C)', level: 2, type: 'A', parent: '1', detail: 'Cuentas por cobrar (C/C)' },
  { code: '1.05.01', name: 'CLIENTES', level: 3, type: 'A', parent: '1.05', detail: 'Cuentas por cobrar (C/C)' },
  { code: '1.05.02', name: 'EMPLEADOS', level: 3, type: 'A', parent: '1.05', detail: 'Cuentas por cobrar (C/C)' },
  { code: '1.06', name: 'Activo de inventario', level: 2, type: 'A', parent: '1', detail: 'Inventario' },
  { code: '1.07', name: 'Activo sin categorizar', level: 2, type: 'A', parent: '1', detail: 'Otros activos corrientes' },
  { code: '1.08', name: 'Available for sale assets (short-term)', level: 2, type: 'A', parent: '1', detail: 'Activos disponibles para venta' },
  { code: '1.09', name: 'Fondos sin depositar', level: 2, type: 'A', parent: '1', detail: 'Fondos sin depositar' },
  { code: '1.10', name: 'Gastos prepagos por Antelación', level: 2, type: 'A', parent: '1', detail: 'Gastos pagados por anticipado' },
  { code: '1.11', name: 'Accumulated depreciation on property, plant and equipment', level: 2, type: 'A', parent: '1', detail: 'Depreciación acumulada sobre los bienes de uso' },
  { code: '1.12', name: 'Propiedad, planta y equipo', level: 2, type: 'A', parent: '1', detail: 'Terrenos' },
  { code: '1.12.01', name: 'EQUIPO DE COMPUTACION', level: 3, type: 'A', parent: '1.12', detail: 'Maquinaria y equipo' },
  { code: '1.12.02', name: 'Muebles y Equipos', level: 3, type: 'A', parent: '1.12', detail: 'Maquinaria y equipo' },
  { code: '1.12.03', name: 'OTROS', level: 3, type: 'A', parent: '1.12', detail: 'Terrenos' },
  { code: '1.12.04', name: 'Vehículos', level: 3, type: 'A', parent: '1.12', detail: 'Vehículos' },
  { code: '1.13', name: 'Assets held for sale', level: 2, type: 'A', parent: '1', detail: 'Activos retenidos para la venta' },
  { code: '1.14', name: 'Deferred tax assets', level: 2, type: 'A', parent: '1', detail: 'Impuesto diferido' },
  { code: '1.15', name: 'Goodwill', level: 2, type: 'A', parent: '1', detail: 'Fondo de comercio positivo' },
  { code: '1.16', name: 'Intangibles', level: 2, type: 'A', parent: '1', detail: 'Activos intangibles' },
  { code: '1.17', name: 'PROVISION PARA DEUDA INCOBRABLE', level: 2, type: 'A', parent: '1', detail: 'Activos intangibles' },
  { code: '1.18', name: 'IVA CRÉDITO FISCAL', level: 2, type: 'A', parent: '1', detail: 'IVA crédito fiscal' },
  // ── PASIVO ──
  { code: '2', name: 'PASIVO', level: 1, type: 'P', parent: null },
  { code: '2.01', name: 'CUENTAS POR PAGAR (C/P)', level: 2, type: 'P', parent: '2', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.01', name: 'COMISIÓN (C/P)', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.02', name: 'FLETES (C/P)', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.03', name: 'ISLR POR PAGAR', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.04', name: 'OTROS (C/P)', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.05', name: 'PRESTAMO (C/P)', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.06', name: 'PROVEEDORES (C/P)', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.07', name: 'SENIAT AJUSTE POR INFLACION', level: 3, type: 'P', parent: '2.01', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.01.08', name: 'IVA DÉBITO FISCAL', level: 3, type: 'P', parent: '2.01', detail: 'IVA débito fiscal' },
  { code: '2.01.09', name: 'IVA POR PAGAR (SENIAT)', level: 3, type: 'P', parent: '2.01', detail: 'IVA por pagar' },
  { code: '2.01.10', name: 'RETENCIONES POR PAGAR', level: 3, type: 'P', parent: '2.01', detail: 'Retenciones por pagar' },
  { code: '2.02', name: 'SENIAT FONDO DE PENSIONES', level: 2, type: 'P', parent: '2', detail: 'Cuentas por pagar (C/P)' },
  { code: '2.03', name: 'Accrued liabilities', level: 2, type: 'P', parent: '2', detail: 'Deudas acumuladas' },
  { code: '2.04', name: 'DEUDA FINANCIERA', level: 2, type: 'P', parent: '2', detail: 'Préstamo por pagar' },
  { code: '2.05', name: 'Dividends payable', level: 2, type: 'P', parent: '2', detail: 'Dividendos por pagar' },
  { code: '2.06', name: 'Income tax payable', level: 2, type: 'P', parent: '2', detail: 'Impuesto a las ganancias por pagar' },
  { code: '2.07', name: 'Payroll Clearing', level: 2, type: 'P', parent: '2', detail: 'Compensación de nóminas' },
  { code: '2.08', name: 'Payroll liabilities', level: 2, type: 'P', parent: '2', detail: 'Pasivos por impuestos corriente' },
  { code: '2.09', name: 'Short-term debit', level: 2, type: 'P', parent: '2', detail: 'Otros pasivos corrientes' },
  { code: '2.10', name: 'Accrued holiday payable', level: 2, type: 'P', parent: '2', detail: 'Vacaciones acumuladas por pagar' },
  { code: '2.11', name: 'Accrued non-current liabilities', level: 2, type: 'P', parent: '2', detail: 'Pasivos no corrientes acumulados' },
  { code: '2.12', name: 'Liabilities related to assets held for sale', level: 2, type: 'P', parent: '2', detail: 'Deudas relacionadas con los activos retenidos para la venta' },
  { code: '2.13', name: 'Long-term debt', level: 2, type: 'P', parent: '2', detail: 'Deuda a largo plazo' },
  // ── PATRIMONIO ──
  { code: '3', name: 'PATRIMONIO', level: 1, type: 'PT', parent: null },
  { code: '3.01', name: 'Dividend disbursed', level: 2, type: 'PT', parent: '3', detail: 'Dividendo desembolsado' },
  { code: '3.02', name: 'Equity in earnings of subsidiaries', level: 2, type: 'PT', parent: '3', detail: 'Fondos propios de ganancias de filiales' },
  { code: '3.03', name: 'Fondos propios del saldo inicial', level: 2, type: 'PT', parent: '3', detail: 'Fondos propios del saldo inicial' },
  { code: '3.04', name: 'Ganancias Retenidas', level: 2, type: 'PT', parent: '3', detail: 'Ganancias acumuladas' },
  { code: '3.05', name: 'Other comprehensive income', level: 2, type: 'PT', parent: '3', detail: 'Otros ingresos globales' },
  { code: '3.06', name: 'Share capital', level: 2, type: 'PT', parent: '3', detail: 'Capital social' },
  { code: '3.06.01', name: 'APORTE ACTIVOS SAM', level: 3, type: 'PT', parent: '3.06', detail: 'Capital desembolsado o reservas' },
  // ── INGRESOS ──
  { code: '4', name: 'INGRESOS', level: 1, type: 'I', parent: null },
  { code: '4.01', name: 'Billable Expense Income', level: 2, type: 'I', parent: '4', detail: 'Ingresos de tasas/servicios' },
  { code: '4.02', name: 'DESCUENTO EN VENTA', level: 2, type: 'I', parent: '4', detail: 'Descuentos/Reembolsos acordados' },
  { code: '4.03', name: 'Descuentos acordados', level: 2, type: 'I', parent: '4', detail: 'Descuentos/Reembolsos acordados' },
  { code: '4.04', name: 'Ingresos de envío', level: 2, type: 'I', parent: '4', detail: 'Ingresos de tasas/servicios' },
  { code: '4.05', name: 'Ingresos de gastos facturables', level: 2, type: 'I', parent: '4', detail: 'Ingresos de tasas/servicios' },
  { code: '4.06', name: 'Ingresos de pagos en efectivo sin aplicar', level: 2, type: 'I', parent: '4', detail: 'Ingresos de pagos en efectivo sin aplicar' },
  { code: '4.07', name: 'Ingresos de ventas de productos', level: 2, type: 'I', parent: '4', detail: 'Ingresos de ventas de productos' },
  { code: '4.08', name: 'Otros Ingresos sin categorizar', level: 2, type: 'I', parent: '4', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09', name: 'Services', level: 2, type: 'I', parent: '4', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.01', name: 'PESO EXTRA', level: 3, type: 'I', parent: '4.09', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.02', name: 'SERVICIO DE TRANSPORTE', level: 3, type: 'I', parent: '4.09', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.02.01', name: 'Trasporte China', level: 4, type: 'I', parent: '4.09.02', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.02.02', name: 'Trasporte Nacional', level: 4, type: 'I', parent: '4.09.02', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.03', name: 'VENTAS POR ENVIO MARITIMO', level: 3, type: 'I', parent: '4.09', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.03.01', name: 'CBM', level: 4, type: 'I', parent: '4.09.03', detail: 'Ingresos de tasas/servicios' },
  { code: '4.09.03.02', name: 'CONSOLIDADO CHINA', level: 4, type: 'I', parent: '4.09.03', detail: 'Ingresos de tasas/servicios' },
  // ── COSTO DE VENTAS ──
  { code: '5', name: 'COSTO DE VENTAS', level: 1, type: 'CGS', parent: null },
  { code: '5.01', name: 'COMISION ENVIO DINERO', level: 2, type: 'CGS', parent: '5', detail: 'Otros costos de las ventas - CDS' },
  { code: '5.02', name: 'COSTO DE INSPECCION', level: 2, type: 'CGS', parent: '5', detail: 'Costo de mano de obra - CDV' },
  { code: '5.03', name: 'Costo de las ventas', level: 2, type: 'CGS', parent: '5', detail: 'Otros costos de las ventas - CDS' },
  { code: '5.04', name: 'COSTO POR COMPRA  ASISTIDA', level: 2, type: 'CGS', parent: '5', detail: 'Costo de mano de obra - CDV' },
  { code: '5.05', name: 'COSTO REGISTRO DE MARCA', level: 2, type: 'CGS', parent: '5', detail: 'Costo de mano de obra - CDV' },
  { code: '5.06', name: 'COSTO TRAMITE VISA  CHINA', level: 2, type: 'CGS', parent: '5', detail: 'Costo de mano de obra - CDV' },
  { code: '5.07', name: 'COSTOS FLETES', level: 2, type: 'CGS', parent: '5', detail: 'Flete y entrega - CDS' },
  { code: '5.07.01', name: 'Costo de Trasporte China', level: 3, type: 'CGS', parent: '5.07', detail: 'Flete y entrega - CDS' },
  { code: '5.07.02', name: 'Costo Extras en Origen China', level: 3, type: 'CGS', parent: '5.07', detail: 'Flete y entrega - CDS' },
  { code: '5.07.03', name: 'COSTOS POR ENVIO MARITIMOS', level: 3, type: 'CGS', parent: '5.07', detail: 'Flete y entrega - CDS' },
  { code: '5.07.04', name: 'ENCOMINEDA Y DESPACHO - COS', level: 3, type: 'CGS', parent: '5.07', detail: 'Flete y entrega - CDS' },
  { code: '5.08', name: 'Inventory Shrinkage', level: 2, type: 'CGS', parent: '5', detail: 'Suministros y materiales - CDS' },
  { code: '5.09', name: 'Pérdidas de inventario', level: 2, type: 'CGS', parent: '5', detail: 'Suministros y materiales - CDS' },
  { code: '5.10', name: 'VALIDACIÓN DE PROVEEDOR', level: 2, type: 'CGS', parent: '5', detail: 'Costo de mano de obra - CDV' },
  // ── GASTOS ──
  { code: '6', name: 'GASTOS', level: 1, type: 'G', parent: null },
  { code: '6.01', name: 'Alquiler de equipos', level: 2, type: 'G', parent: '6', detail: 'Alquiler de equipo' },
  { code: '6.02', name: 'COMISIONES BANCARIAS', level: 2, type: 'G', parent: '6', detail: 'Gastos bancarios' },
  { code: '6.03', name: 'Deudas incobrables', level: 2, type: 'G', parent: '6', detail: 'Deudas incobrables' },
  { code: '6.04', name: 'DIFERENCIAS CAMBIARIAS', level: 2, type: 'G', parent: '6', detail: 'Pérdida por operaciones interrumpidas (neto de impuestos)' },
  { code: '6.05', name: 'GASOLINA', level: 2, type: 'G', parent: '6', detail: 'Auto' },
  { code: '6.06', name: 'Gasto de amortización', level: 2, type: 'G', parent: '6', detail: 'Gasto de amortización' },
  { code: '6.07', name: 'Gastos a Venta (Comisiones)', level: 2, type: 'G', parent: '6', detail: 'Otros costos de servicios varios' },
  { code: '6.07.01', name: 'Otros gastos de venta', level: 3, type: 'G', parent: '6.07', detail: 'Otros gastos de ventas' },
  { code: '6.08', name: 'Gastos bancarios', level: 2, type: 'G', parent: '6', detail: 'Gastos bancarios' },
  { code: '6.09', name: 'Gastos de Oficina', level: 2, type: 'G', parent: '6', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.09.01', name: 'Compras', level: 3, type: 'G', parent: '6.09', detail: 'Suministros y materiales' },
  { code: '6.09.02', name: 'Cuotas y suscripciones', level: 3, type: 'G', parent: '6.09', detail: 'Cuotas y suscripciones' },
  { code: '6.09.03', name: 'Electricidad', level: 3, type: 'G', parent: '6.09', detail: 'Otros costos de servicios varios' },
  { code: '6.09.04', name: 'Gastos de Nomina', level: 3, type: 'G', parent: '6.09', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.09.04.01', name: 'BONIFICACIONES ESPECIAL', level: 4, type: 'G', parent: '6.09.04', detail: 'Compensación administrativa' },
  { code: '6.09.04.02', name: 'LIQUIDACION Y BONOS', level: 4, type: 'G', parent: '6.09.04', detail: 'Gastos de nóminas' },
  { code: '6.09.05', name: 'Gastos de publicidad.', level: 3, type: 'G', parent: '6.09', detail: 'Publicidad/Promociones' },
  { code: '6.09.06', name: 'Papeleria e imprenta', level: 3, type: 'G', parent: '6.09', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.09.07', name: 'PROGRAMAS Y SISTEMAS', level: 3, type: 'G', parent: '6.09', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.09.08', name: 'Telefónos Corporativos', level: 3, type: 'G', parent: '6.09', detail: 'Otros costos de servicios varios' },
  { code: '6.10', name: 'Gastos de pagos de facturas de proveedores en efectivo sin aplicar', level: 2, type: 'G', parent: '6', detail: 'Gastos de pagos de facturas de proveedores en efectivo sin aplicar' },
  { code: '6.11', name: 'GASTOS DE REPRESENTACION', level: 2, type: 'G', parent: '6', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.12', name: 'Gastos de viaje - gastos generales y administrativos', level: 2, type: 'G', parent: '6', detail: 'Gastos de viajes - Gastos generales y administrativos' },
  { code: '6.13', name: 'Gastos sin categorizar', level: 2, type: 'G', parent: '6', detail: 'Otros costos de servicios varios' },
  { code: '6.14', name: 'Honorarios legales y profesionales.', level: 2, type: 'G', parent: '6', detail: 'Honorarios profesionales y tasas judiciales' },
  { code: '6.14.01', name: 'Entes Publicos', level: 3, type: 'G', parent: '6.14', detail: 'Honorarios profesionales y tasas judiciales' },
  { code: '6.14.02', name: 'Gasto por impuesto a la renta', level: 3, type: 'G', parent: '6.14', detail: 'Gasto de impuesto a las ganancias' },
  { code: '6.14.03', name: 'Gestores', level: 3, type: 'G', parent: '6.14', detail: 'Honorarios profesionales y tasas judiciales' },
  { code: '6.14.04', name: 'IMPUESTO MUNICIPAL Y ACT. ECONOMICAS', level: 3, type: 'G', parent: '6.14', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.14.05', name: 'Pérdida en operaciones discontinuadas, neta de impuestos', level: 3, type: 'G', parent: '6.14', detail: 'Pérdida por operaciones interrumpidas (neto de impuestos)' },
  { code: '6.15', name: 'IMPUESTO DDP', level: 2, type: 'G', parent: '6', detail: 'Impuestos pagados' },
  { code: '6.16', name: 'ISLR', level: 2, type: 'G', parent: '6', detail: 'Impuestos pagados' },
  { code: '6.17', name: 'Recursos Humanos', level: 2, type: 'G', parent: '6', detail: 'Gastos de nóminas' },
  { code: '6.17.01', name: 'COMPRA INSUMOS COCINA', level: 3, type: 'G', parent: '6.17', detail: 'Compensación administrativa' },
  { code: '6.17.02', name: 'Eventos, Comidas y entretenimiento', level: 3, type: 'G', parent: '6.17', detail: 'Comidas y ocio' },
  { code: '6.18', name: 'RENTAS', level: 2, type: 'G', parent: '6', detail: 'Alquiler o arrendamiento de edificios' },
  { code: '6.18.01', name: 'Bodega', level: 3, type: 'G', parent: '6.18', detail: 'Alquiler o arrendamiento de edificios' },
  { code: '6.18.02', name: 'Oficina', level: 3, type: 'G', parent: '6.18', detail: 'Alquiler o arrendamiento de edificios' },
  { code: '6.19', name: 'Reparaciones y Mantenimiento', level: 2, type: 'G', parent: '6', detail: 'Reparación y mantenimiento' },
  { code: '6.19.01', name: 'Camión SILVERADO 350', level: 3, type: 'G', parent: '6.19', detail: 'Auto' },
  { code: '6.19.02', name: 'Oficina Reparaciones', level: 3, type: 'G', parent: '6.19', detail: 'Gastos administrativos generales y de oficina' },
  { code: '6.19.03', name: 'Van KANGO RENAULT', level: 3, type: 'G', parent: '6.19', detail: 'Auto' },
  // ── INGRESOS ──
  { code: '4.10', name: 'Dividend income', level: 2, type: 'I', parent: '4', detail: 'Ingresos de dividendos' },
  { code: '4.11', name: 'Interest income', level: 2, type: 'I', parent: '4', detail: 'Ingresos por intereses' },
  { code: '4.12', name: 'Loss on disposal of assets', level: 2, type: 'I', parent: '4', detail: 'Pérdida por enajenación de activos' },
  { code: '4.13', name: 'Other operating income (expenses)', level: 2, type: 'I', parent: '4', detail: 'Otros ingresos operativos' },
  { code: '4.13.01', name: 'BODEGAJE', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.13.02', name: 'COMISION POR ENVIO DE DINERO', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.13.03', name: 'COMPRA  ASISTIDA', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.13.04', name: 'REGISTRO DE MARCA', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.13.05', name: 'TRAMITE VISA CHINA', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.13.05.01', name: 'ENVIO DE DOCUMENTOS VISA CHINA', level: 4, type: 'I', parent: '4.13.05', detail: 'Otros ingresos operativos' },
  { code: '4.13.06', name: 'VALIDACION DE PROVEEDORES', level: 3, type: 'I', parent: '4.13', detail: 'Otros ingresos operativos' },
  { code: '4.14', name: 'Unrealised loss on securities, net of tax', level: 2, type: 'I', parent: '4', detail: 'Pérdida por valores no efectiva (neto de impuestos)' },
  // ── GASTOS ──
  { code: '6.20', name: 'DONACIONES', level: 2, type: 'G', parent: '6', detail: 'Otros gastos' },
  { code: '6.21', name: 'GASTO EXTRA OFICINA CHINA', level: 2, type: 'G', parent: '6', detail: 'Otros gastos' },
];

// ── Asientos seed (libro diario) ──────────────────────────────
// Cubren ~30 días con mix de facturas, pagos USD, pagos VES con diferencia
// cambiaria, gastos directos, gastos operativos. Todos contabilizados.
const SEED_ENTRIES = [
  // ── Facturas emitidas
  { id: 'AS-2026-0421', date: '2026-05-22', concept: 'Factura emitida · F-2026-0391 · Industrias Polar', ref: 'F-2026-0391', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 14:18',
    lines: [
      { account: '1.05.01', debit: 156800, credit: 0,      memo: 'CxC Industrias Polar' },
      { account: '4.09.03.02', debit: 0,      credit: 135172, memo: 'Flete marítimo MAR' },
      { account: '2.01.08', debit: 0,      credit: 21628,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0420', date: '2026-05-20', concept: 'Factura emitida · F-2026-0398 · Castro Hermanos', ref: 'F-2026-0398', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-20 11:05',
    lines: [
      { account: '1.05.01', debit: 48200, credit: 0,     memo: 'CxC Castro Hermanos' },
      { account: '4.09.02.02', debit: 0,     credit: 41552, memo: 'Servicio DDP Punto Fijo' },
      { account: '2.01.08', debit: 0,     credit: 6648,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0419', date: '2026-05-14', concept: 'Factura emitida · F-2026-0418 · Acindar Comercial', ref: 'F-2026-0418', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 09:32',
    lines: [
      { account: '1.05.01', debit: 84200, credit: 0,     memo: 'CxC Acindar Comercial' },
      { account: '4.09.03.02', debit: 0,     credit: 72586, memo: 'Flete marítimo PBL' },
      { account: '2.01.08', debit: 0,     credit: 11614, memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0423', date: '2026-05-18', concept: 'Factura emitida · F-2026-0402 · Importadora Pereira', ref: 'F-2026-0402', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-18 10:40',
    lines: [
      { account: '1.05.01', debit: 12600, credit: 0,     memo: 'CxC Importadora Pereira' },
      { account: '4.09.03.02', debit: 0,  credit: 10862, memo: 'Flete marítimo consolidado' },
      { account: '2.01.08', debit: 0,     credit: 1738,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0424', date: '2026-05-10', concept: 'Factura emitida · F-2026-0421 · Tech Solutions VE (exento)', ref: 'F-2026-0421', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-10 16:05',
    lines: [
      { account: '1.05.01', debit: 8400, credit: 0,    memo: 'CxC Tech Solutions VE' },
      { account: '4.09.03.02', debit: 0, credit: 8400, memo: 'Flete marítimo internacional (exento)' },
    ],
  },

  // ── Pagos recibidos USD
  { id: 'AS-2026-0418', date: '2026-05-22', concept: 'Pago recibido USD · F-2026-0391 · Polar', ref: 'WIRE-9982', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 15:42',
    lines: [
      { account: '1.04.01', debit: 156800, credit: 0,      memo: 'Banco Mercantil · transferencia' },
      { account: '1.05.01', debit: 0,      credit: 156800, memo: 'Cancelación CxC Polar' },
    ],
  },
  { id: 'AS-2026-0417', date: '2026-05-15', concept: 'Pago recibido USD · F-2026-0398 · Castro Hermanos', ref: 'WIRE-9954', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 10:18',
    lines: [
      { account: '1.04.01', debit: 48200, credit: 0,     memo: 'Banco Mercantil' },
      { account: '1.05.01', debit: 0,     credit: 48200, memo: 'Cancelación CxC Castro' },
    ],
  },

  // ── Pago recibido VES (con conversión a USD a tasa BCV) ─────
  { id: 'AS-2026-0416', date: '2026-05-19', concept: 'Pago recibido VES · F-2026-0382 · Acindar (parcial)', ref: 'TRF-VES-8841', refType: 'payment-ves', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 16:22',
    forex: { originalAmount: 671320, originalCurrency: 'VES', rate: 36.45, rateSource: 'bcv' },
    lines: [
      { account: '1.01.02', debit: 18416, credit: 0,     memo: 'Banesco VES · Bs. 671.320 @ 36,45' },
      { account: '1.05.01', debit: 0,     credit: 18416, memo: 'Cancelación parcial CxC Acindar' },
    ],
  },

  // ── Gastos directos (CGS)
  { id: 'AS-2026-0415', date: '2026-05-22', concept: 'Pago naviera COSCO · DTDU-501228', ref: 'TX-44182', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 17:00',
    lines: [
      { account: '5.07.03', debit: 28400, credit: 0,     memo: 'Flete naviero COSCO' },
      { account: '1.04.01', debit: 0,     credit: 28400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0414', date: '2026-05-19', concept: 'Honorarios Aduanas Carabobo · mayo', ref: 'TX-44158', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 14:08',
    lines: [
      { account: '5.07.04', debit: 4155, credit: 0,    memo: 'Honorarios agente a-001 (base)' },
      { account: '1.18',    debit: 665,  credit: 0,    memo: 'IVA crédito fiscal 16%' },
      { account: '1.04.01', debit: 0,    credit: 4820, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0413', date: '2026-05-10', concept: 'Maersk · freight DTDU-419032', ref: 'TX-44062', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-10 09:14',
    lines: [
      { account: '5.07.03', debit: 41200, credit: 0,     memo: 'Flete naviero Maersk' },
      { account: '1.04.01', debit: 0,     credit: 41200, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Gastos operativos
  { id: 'AS-2026-0412', date: '2026-05-14', concept: 'Salarios quincena · choferes flota', ref: 'TX-44102', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 18:30',
    lines: [
      { account: '5.07.04', debit: 8400, credit: 0,    memo: 'Salarios choferes Q1 mayo' },
      { account: '1.04.01', debit: 0,    credit: 8400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0411', date: '2026-05-17', concept: 'Combustible flota PBL', ref: 'TX-44128', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-17 12:00',
    lines: [
      { account: '5.07.04', debit: 1240, credit: 0,    memo: 'PDV · combustible' },
      { account: '1.04.01', debit: 0,    credit: 1240, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0410', date: '2026-05-15', concept: 'Alquiler oficina Valencia · mayo', ref: 'TX-44099', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 08:00',
    lines: [
      { account: '6.18.02', debit: 1552, credit: 0,    memo: 'Alquiler mayo (base)' },
      { account: '1.18',    debit: 248,  credit: 0,    memo: 'IVA crédito fiscal 16%' },
      { account: '1.04.01', debit: 0,    credit: 1800, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0409', date: '2026-05-12', concept: 'Salarios administrativos · quincena', ref: 'TX-44085', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-12 18:00',
    lines: [
      { account: '6.09.04', debit: 4200, credit: 0,    memo: 'Nómina admin Q1' },
      { account: '1.04.01', debit: 0,    credit: 4200, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0408', date: '2026-05-08', concept: 'Comisiones bancarias · mayo', ref: 'TX-44044', refType: 'expense', status: 'contabilizado',
    user: 'Sistema',  createdAt: '2026-05-08 06:00',
    lines: [
      { account: '6.02', debit: 190, credit: 0,   memo: 'Banco · comisiones (base)' },
      { account: '1.18', debit: 30,  credit: 0,   memo: 'IVA crédito fiscal 16%' },
      { account: '1.04.01', debit: 0,   credit: 220, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0425', date: '2026-05-12', concept: 'Licencias de software · Software & Licencias SRL', ref: 'SFT-2026-031', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-12 11:20',
    lines: [
      { account: '6.09.07', debit: 690, credit: 0,   memo: 'Licencias software (base)' },
      { account: '1.18',    debit: 110, credit: 0,   memo: 'IVA crédito fiscal 16%' },
      { account: '1.04.01', debit: 0,   credit: 800, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Asiento borrador (en proceso de conciliación)
  { id: 'AS-2026-0422', date: '2026-05-12', concept: 'TRX-INET digital · cargo a clasificar', ref: 'TX-44081', refType: 'unclassified', status: 'borrador',
    user: 'Andrés B.', createdAt: '2026-05-24 09:20',
    lines: [
      { account: '6.13', debit: 380, credit: 0,   memo: 'Por clasificar · investigar' },
      { account: '1.04.01', debit: 0,   credit: 380, memo: 'Banco Mercantil USD' },
    ],
    flagged: true,
  },
];

// ── Libro diario · capa editable v2.5 ────────────────────────
// SEED_ENTRIES son los asientos de fábrica; las altas/ediciones/bajas del
// usuario viven en localStorage y se fusionan sobre el seed. JOURNAL_ENTRIES
// es el arreglo "vivo" (se muta in-place para preservar la referencia).
const JOURNAL_LS_KEY = 'dtd_journal_v25';
const JOURNAL_ENTRIES = [];

function _loadJournalOverrides() {
  try { return JSON.parse(localStorage.getItem(JOURNAL_LS_KEY)) || { added: [], edits: {}, deleted: [] }; }
  catch (e) { return { added: [], edits: {}, deleted: [] }; }
}
function _saveJournalOverrides(o) {
  try { localStorage.setItem(JOURNAL_LS_KEY, JSON.stringify(o)); } catch (e) {}
}
function _rebuildJournal() {
  const o = _loadJournalOverrides();
  const apply = (e) => (o.edits && o.edits[e.id] ? { ...e, ...o.edits[e.id] } : e);
  let list = SEED_ENTRIES.filter(e => !(o.deleted || []).includes(e.id)).map(apply);
  list = list.concat((o.added || []).filter(e => !(o.deleted || []).includes(e.id)).map(apply));
  list.sort((a, b) => (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id)));
  JOURNAL_ENTRIES.length = 0;
  list.forEach(e => JOURNAL_ENTRIES.push(e));
}
function nextEntryId() {
  let max = 0;
  const scan = (e) => { const m = /AS-2026-(\d+)/.exec(e.id || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); };
  SEED_ENTRIES.forEach(scan);
  (_loadJournalOverrides().added || []).forEach(scan);
  return 'AS-2026-' + String(max + 1).padStart(4, '0');
}
function _notifyJournal() {
  window.dispatchEvent(new CustomEvent('dtd-journal-changed'));
}
function createEntry(entry) {
  const e = {
    id: entry.id || nextEntryId(),
    date: entry.date,
    concept: entry.concept,
    ref: entry.ref || '—',
    refType: entry.refType || 'manual',
    status: entry.status || 'contabilizado',
    user: entry.user || 'Andrés B. (Contabilidad)',
    createdAt: entry.createdAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
    lines: entry.lines || [],
    ...(entry.forex ? { forex: entry.forex } : {}),
  };
  const o = _loadJournalOverrides();
  o.added = o.added || [];
  o.added.push(e);
  _saveJournalOverrides(o);
  _rebuildJournal();
  _notifyJournal();
  return e;
}
function updateEntry(id, patch) {
  const o = _loadJournalOverrides();
  o.edits = o.edits || {};
  o.edits[id] = { ...(o.edits[id] || {}), ...patch };
  _saveJournalOverrides(o);
  _rebuildJournal();
  _notifyJournal();
}
function deleteEntry(id) {
  const o = _loadJournalOverrides();
  o.added = o.added || [];
  const wasAdded = o.added.some(e => e.id === id);
  o.added = o.added.filter(e => e.id !== id);
  if (o.edits) delete o.edits[id];
  // Solo marcamos como "deleted" los asientos del seed; los agregados
  // simplemente se quitan (así su número puede reutilizarse).
  if (!wasAdded) {
    o.deleted = o.deleted || [];
    if (!o.deleted.includes(id)) o.deleted.push(id);
  }
  _saveJournalOverrides(o);
  _rebuildJournal();
  _notifyJournal();
}
_rebuildJournal();

// ── Helpers ───────────────────────────────────────────────────
function cdGetAccount(code) {
  return CHART_OF_ACCOUNTS.find(a => a.code === code);
}

function getAccountChildren(parentCode) {
  return CHART_OF_ACCOUNTS.filter(a => a.parent === parentCode);
}

// Suma debe/haber por cuenta (incluyendo sub-cuentas si es padre)
function accountMovements(code, entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const result = [];
  list.forEach(e => {
    e.lines.forEach(l => {
      if (l.account === code) {
        result.push({ ...l, entryId: e.id, date: e.date, concept: e.concept, ref: e.ref });
      }
    });
  });
  return result;
}

// v2.5 · una cuenta es "hoja" (posteable) si no tiene hijas en el plan.
function isLeaf(code) {
  return !CHART_OF_ACCOUNTS.some(a => a.parent === code);
}

// Saldo SOLO por los movimientos directos de la cuenta (sin hijas), ya
// con el signo natural según su naturaleza. Base de PL/BS para evitar
// doble conteo al postear en cualquier nivel del plan.
function directBalance(code, entries) {
  const acc = cdGetAccount(code);
  if (!acc) return 0;
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  let d = 0, c = 0;
  list.forEach(e => e.lines.forEach(l => { if (l.account === code) { d += l.debit || 0; c += l.credit || 0; } }));
  if (acc.contra) return c - d;
  if (['A', 'G', 'CGS'].includes(acc.type)) return d - c;
  return c - d;
}

// Saldo de una cuenta incluyendo recursivamente todas sus hijas.
function accountBalance(code, entries) {
  const acc = cdGetAccount(code);
  if (!acc) return 0;
  let bal = directBalance(code, entries);
  CHART_OF_ACCOUNTS.filter(a => a.parent === code).forEach(ch => { bal += accountBalance(ch.code, entries); });
  return bal;
}

// Cuentas de un tipo con movimiento directo en el período (líneas del reporte).
function postedAccounts(type, entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const used = new Set();
  list.forEach(e => e.lines.forEach(l => used.add(l.account)));
  return CHART_OF_ACCOUNTS
    .filter(a => a.type === type && used.has(a.code))
    .map(a => ({ account: a, balance: directBalance(a.code, list) }))
    .sort((x, y) => x.account.code.localeCompare(y.account.code, undefined, { numeric: true }));
}

// Total de un tipo = suma de movimientos directos (sin doble conteo de padres).
function typeTotal(type, entries) {
  return postedAccounts(type, entries).reduce((s, r) => s + r.balance, 0);
}

// Estado de Resultados (P&L) del período · v2.5 (postea a cualquier nivel)
function calculatePL(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const ingresos = postedAccounts('I', list);
  const cgs = postedAccounts('CGS', list);
  const gastos = postedAccounts('G', list);
  const otros = postedAccounts('OR', list);
  const totalIngresos = ingresos.reduce((s, r) => s + r.balance, 0);
  const totalCgs = cgs.reduce((s, r) => s + r.balance, 0);
  const utilidadBruta = totalIngresos - totalCgs;
  const totalGastos = gastos.reduce((s, r) => s + r.balance, 0);
  const utilidadOperativa = utilidadBruta - totalGastos;
  const totalOtros = otros.reduce((s, r) => s + r.balance, 0);
  const utilidadNeta = utilidadOperativa + totalOtros;
  return { ingresos, cgs, gastos, otros, totalIngresos, totalCgs, utilidadBruta, totalGastos, utilidadOperativa, totalOtros, utilidadNeta };
}

// Balance General · v2.5 · agrupado por rubro de nivel 2 del plan real
function calculateBS(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const groupsOf = (rootCode) => CHART_OF_ACCOUNTS
    .filter(a => a.parent === rootCode)
    .map(a => ({ account: a, balance: accountBalance(a.code, list) }))
    .sort((x, y) => x.account.code.localeCompare(y.account.code, undefined, { numeric: true }));
  const activos = groupsOf('1');
  const pasivos = groupsOf('2');
  const patrimonio = groupsOf('3');
  const pl = calculatePL(list);
  // Resultado del ejercicio → patrimonio (cuadra contra utilidad neta)
  patrimonio.push({ account: { code: '3.99', name: 'Resultado del ejercicio (calculado)' }, balance: pl.utilidadNeta, calculated: true });
  const totalActivos = typeTotal('A', list);
  const totalPasivos = typeTotal('P', list);
  const totalPatrimonio = typeTotal('PT', list) + pl.utilidadNeta;
  return { activos, pasivos, patrimonio, totalActivos, totalPasivos, totalPatrimonio };
}

// Lock state / permisos
function readLock() {
  try {
    const raw = localStorage.getItem(CONTABILIDAD_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { locked: true, unlockedBy: null, unlockedUntil: null };
}

function writeLock(state) {
  try { localStorage.setItem(CONTABILIDAD_LS_KEY, JSON.stringify(state)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-contab-lock', { detail: state }));
  return state;
}

function isUnlocked() {
  const s = readLock();
  if (!s.locked) return true;
  if (s.unlockedUntil && new Date(s.unlockedUntil).getTime() > Date.now()) return true;
  return false;
}

// Type display helpers
const TYPE_LABEL = {
  A:   { label: 'Activo',      tone: 'wine' },
  P:   { label: 'Pasivo',      tone: 'warning' },
  PT:  { label: 'Patrimonio',  tone: 'info' },
  I:   { label: 'Ingreso',     tone: 'success' },
  CGS: { label: 'Costo dir.',   tone: 'wine' },
  G:   { label: 'Gasto op.',    tone: 'warning' },
  OR:  { label: 'Otros',       tone: 'neutral' },
};

// ── Métodos de pago (catálogo) · se vinculan a cuentas Banco/Caja ──
// Estilo QuickBooks: cada banco/caja "recibe" ciertos métodos; uno
// queda por defecto y el resto opcionales (se eligen al cobrar/pagar).
const PAYMENT_METHODS = [
  { id: 'wire',     label: 'Transferencia / Wire USD', ccy: 'USD' },
  { id: 'zelle',    label: 'Zelle',                    ccy: 'USD' },
  { id: 'cash_usd', label: 'Efectivo USD',             ccy: 'USD' },
  { id: 'zinli',    label: 'Zinli',                    ccy: 'USD' },
  { id: 'usdt',     label: 'USDT · TRC20',             ccy: 'USDT' },
  { id: 'binance',  label: 'Binance Pay',              ccy: 'USDT' },
  { id: 'trf_ves',  label: 'Transferencia VES',        ccy: 'VES' },
  { id: 'pmovil',   label: 'Pago Móvil',               ccy: 'VES' },
  { id: 'pos_ves',  label: 'Punto de venta',           ccy: 'VES' },
  { id: 'cash_ves', label: 'Efectivo VES',             ccy: 'VES' },
];

// Detalle de cuenta por tipo (QuickBooks "Detail type"). `bank: true`
// habilita moneda + métodos de pago vinculados.
const ACCOUNT_DETAIL_TYPES = {
  A: [
    { id: 'banco',       label: 'Banco', bank: true },
    { id: 'caja',        label: 'Caja / Efectivo', bank: true },
    { id: 'cxc',         label: 'Cuentas por cobrar' },
    { id: 'anticipo_p',  label: 'Anticipos a proveedores' },
    { id: 'iva_credito', label: 'IVA crédito fiscal' },
    { id: 'inventario',  label: 'Inventario / en tránsito' },
    { id: 'activo_fijo', label: 'Activo fijo' },
    { id: 'otro_activo', label: 'Otro activo' },
  ],
  P: [
    { id: 'cxp',         label: 'Cuentas por pagar' },
    { id: 'anticipo_c',  label: 'Anticipos de clientes' },
    { id: 'iva_debito',  label: 'IVA débito fiscal' },
    { id: 'retenciones', label: 'Retenciones por pagar' },
    { id: 'prestamo',    label: 'Préstamo / financiamiento' },
    { id: 'otro_pasivo', label: 'Otro pasivo' },
  ],
  PT:  [{ id: 'capital', label: 'Capital social' }, { id: 'utilidades', label: 'Utilidades retenidas' }, { id: 'otro_pt', label: 'Otra cuenta de patrimonio' }],
  I:   [{ id: 'ing_serv', label: 'Ingreso por servicios' }, { id: 'ing_otro', label: 'Otro ingreso' }],
  CGS: [{ id: 'costo_dir', label: 'Costo directo de servicio' }],
  G:   [{ id: 'gasto_op', label: 'Gasto operativo' }, { id: 'gasto_admin', label: 'Gasto administrativo' }],
};

// Sugiere el próximo código nivel-3 bajo un padre (1.1 → 1.1.21)
function nextAccountCode(parentCode) {
  const kids = CHART_OF_ACCOUNTS.filter(a => a.parent === parentCode && a.level === 3);
  let max = 0;
  kids.forEach(a => { const seg = parseInt(a.code.split('.').pop(), 10); if (!isNaN(seg) && seg > max) max = seg; });
  return parentCode + '.' + String(max + 1).padStart(2, '0');
}

// Cuentas creadas por el usuario · persistidas en localStorage y
// fusionadas en CHART_OF_ACCOUNTS para que aparezcan en todo el módulo.
const COA_CUSTOM_KEY = 'dtd_coa_custom_v1';
function _sortChart() {
  CHART_OF_ACCOUNTS.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
function _loadCustomAccounts() {
  try {
    const raw = localStorage.getItem(COA_CUSTOM_KEY);
    if (!raw) return;
    JSON.parse(raw).forEach(a => { if (!CHART_OF_ACCOUNTS.some(x => x.code === a.code)) CHART_OF_ACCOUNTS.push(a); });
    _sortChart();
  } catch (e) {}
}
function createAccount(acc) {
  const account = { level: 3, custom: true, ...acc };
  CHART_OF_ACCOUNTS.push(account);
  _sortChart();
  try {
    const raw = localStorage.getItem(COA_CUSTOM_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    saved.push(account);
    localStorage.setItem(COA_CUSTOM_KEY, JSON.stringify(saved));
  } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-coa-changed', { detail: account }));
  return account;
}

// ── v2.5 · edición / inactivación de cuentas (overrides) ──────
// Las cuentas del seed no se borran (preservan histórico); se editan
// (nombre/descripción) o se inactivan para impedir nuevos posteos.
const COA_OVERRIDES_KEY = 'dtd_coa_overrides_v25';
function _loadCoaOverrides() {
  try { return JSON.parse(localStorage.getItem(COA_OVERRIDES_KEY)) || { edits: {}, inactive: [] }; }
  catch (e) { return { edits: {}, inactive: [] }; }
}
function _saveCoaOverrides(o) {
  try { localStorage.setItem(COA_OVERRIDES_KEY, JSON.stringify(o)); } catch (e) {}
}
function _applyCoaOverrides() {
  const o = _loadCoaOverrides();
  CHART_OF_ACCOUNTS.forEach(a => {
    if (o.edits && o.edits[a.code]) Object.assign(a, o.edits[a.code]);
    a.inactive = (o.inactive || []).includes(a.code);
  });
}
function updateAccount(code, patch) {
  const o = _loadCoaOverrides();
  o.edits = o.edits || {};
  o.edits[code] = { ...(o.edits[code] || {}), ...patch };
  _saveCoaOverrides(o);
  const a = cdGetAccount(code);
  if (a) Object.assign(a, patch);
  window.dispatchEvent(new CustomEvent('dtd-coa-changed', { detail: { code } }));
}
function setAccountActive(code, active) {
  const o = _loadCoaOverrides();
  o.inactive = o.inactive || [];
  if (active) o.inactive = o.inactive.filter(c => c !== code);
  else if (!o.inactive.includes(code)) o.inactive.push(code);
  _saveCoaOverrides(o);
  const a = cdGetAccount(code);
  if (a) a.inactive = !active;
  window.dispatchEvent(new CustomEvent('dtd-coa-changed', { detail: { code } }));
}
_loadCustomAccounts();
_applyCoaOverrides();

// ── v2.5 · Activos fijos & depreciación ───────────────────────
// Registro de bienes de uso → depreciación lineal mensual.
// acc = cuenta de activo (1.12.x) · accDep = 1.11 (deprec. acumulada)
// gasto = 6.06 (gasto de depreciación/amortización).
const FA_SEED = [
  { id: 'fa-001', name: 'Camión Silverado 350',   acc: '1.12.04', cost: 28000, start: '2024-06-01', months: 60 },
  { id: 'fa-002', name: 'Van Kangoo Renault',     acc: '1.12.04', cost: 16500, start: '2025-01-15', months: 60 },
  { id: 'fa-003', name: 'Equipo de computación',  acc: '1.12.01', cost: 6200,  start: '2025-03-01', months: 36 },
  { id: 'fa-004', name: 'Muebles y equipos',      acc: '1.12.02', cost: 4800,  start: '2024-09-01', months: 120 },
];
const FA_LS_KEY = 'dtd_fixed_assets_v25';
const FIXED_ASSETS = [];
function _rebuildAssets() {
  let added = [];
  try { added = JSON.parse(localStorage.getItem(FA_LS_KEY)) || []; } catch (e) {}
  FIXED_ASSETS.length = 0;
  FA_SEED.concat(added).forEach(a => FIXED_ASSETS.push(a));
}
function _monthsBetween(start, asOf) {
  const a = new Date(start + 'T00:00:00'), b = new Date(asOf + 'T00:00:00');
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function assetDepreciation(asset, asOf) {
  const monthly = asset.months ? asset.cost / asset.months : 0;
  const elapsed = Math.min(_monthsBetween(asset.start, asOf || '2026-05-31'), asset.months);
  const accum = Math.min(Math.round(monthly * elapsed * 100) / 100, asset.cost);
  return { monthly: Math.round(monthly * 100) / 100, elapsed, accum, net: Math.round((asset.cost - accum) * 100) / 100 };
}
function createAsset(a) {
  const asset = { id: 'fa-' + Date.now(), ...a };
  let added = [];
  try { added = JSON.parse(localStorage.getItem(FA_LS_KEY)) || []; } catch (e) {}
  added.push(asset);
  try { localStorage.setItem(FA_LS_KEY, JSON.stringify(added)); } catch (e) {}
  _rebuildAssets();
  window.dispatchEvent(new CustomEvent('dtd-assets-changed'));
  return asset;
}
// Asiento de depreciación del mes: débito 6.06 · crédito 1.11 (por activo aún no totalmente depreciado).
function buildDepreciationEntry(date) {
  const lines = [];
  let total = 0;
  FIXED_ASSETS.forEach(a => {
    const d = assetDepreciation(a, date);
    if (d.elapsed >= a.months) return; // ya totalmente depreciado
    if (d.monthly <= 0) return;
    total += d.monthly;
    lines.push({ account: '6.06', debit: d.monthly, credit: 0, memo: `Depreciación ${a.name}` });
  });
  if (!lines.length) return null;
  total = Math.round(total * 100) / 100;
  lines.push({ account: '1.11', debit: 0, credit: total, memo: 'Depreciación acumulada del mes' });
  return { date, concept: 'Depreciación mensual de bienes de uso', ref: 'DEP-MES', refType: 'manual', lines };
}
_rebuildAssets();

// ── v2.5 · Provisiones fiscales (ISLR · municipal · inflación) ─
const PROVISION_CFG = {
  islr:      { label: 'ISLR', gasto: '6.16',    pasivo: '2.01.03', defRate: 34, baseLabel: 'Utilidad gravable' },
  municipal: { label: 'Impuesto municipal', gasto: '6.14.04', pasivo: '2.01.04', defRate: 1.5, baseLabel: 'Ingresos brutos' },
  inflacion: { label: 'Ajuste por inflación', gasto: '6.14.05', pasivo: '2.01.07', defRate: null, baseLabel: 'Monto de reexpresión' },
};
function buildProvisionEntry(kind, base, rate, date) {
  const cfg = PROVISION_CFG[kind];
  if (!cfg) return null;
  const monto = cfg.defRate === null ? Math.round(Number(base) * 100) / 100 : Math.round(Number(base) * Number(rate) / 100 * 100) / 100;
  if (!monto) return null;
  return {
    date, concept: `Provisión ${cfg.label}`, ref: 'PROV-' + kind.toUpperCase(), refType: 'manual',
    lines: [
      { account: cfg.gasto, debit: monto, credit: 0, memo: `${cfg.label}${cfg.defRate === null ? '' : ` · ${rate}% s/ ${R0(base)}`}` },
      { account: cfg.pasivo, debit: 0, credit: monto, memo: `${cfg.label} por pagar` },
    ],
  };
}
function R0(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

// ── v2.5 · Conciliación bancaria → mayor ──────────────────────
// Liga el movimiento del extracto a su asiento (si existe por ref),
// postea el borrador asociado, o crea el asiento faltante.
function findEntryByRef(ref) {
  if (!ref) return null;
  return JOURNAL_ENTRIES.find(e => e.ref === ref) || null;
}
function reconcileBankMovement(mov, bankCoa) {
  const coa = bankCoa || '1.04.01';
  const existing = findEntryByRef(mov.ref);
  if (existing) {
    if (existing.status === 'borrador') {
      updateEntry(existing.id, { status: 'contabilizado' });
      return { mode: 'posted-draft', entryId: existing.id };
    }
    return { mode: 'linked', entryId: existing.id };
  }
  const usd = Math.round((mov.amount || 0) * 100) / 100;
  if (!usd) return { mode: 'skip' };
  let entry;
  if (mov.kind === 'credit') {
    entry = {
      date: mov.date, concept: `Cobro conciliado · ${mov.desc}`, ref: mov.ref, refType: 'payment',
      lines: [
        { account: coa, debit: usd, credit: 0, memo: mov.desc },
        { account: '1.05.01', debit: 0, credit: usd, memo: mov.suggested ? `Cancelación CxC ${mov.suggested.ref}` : 'Cancelación CxC' },
      ],
    };
  } else {
    entry = {
      date: mov.date, concept: `Egreso conciliado · ${mov.desc}`, ref: mov.ref, refType: 'expense',
      lines: [
        { account: '2.01.06', debit: usd, credit: 0, memo: mov.suggested ? `CxP ${mov.suggested.vendor || ''}`.trim() : 'CxP proveedores' },
        { account: coa, debit: 0, credit: usd, memo: mov.desc },
      ],
    };
  }
  const e = createEntry(entry);
  return { mode: 'created', entryId: e.id };
}

// ── v2.5 · Puente Fiscal → Contabilidad ───────────────────────
function buildRetencionesEntry(date) {
  const F = window.FiscalData; if (!F) return null;
  const rt = F.retencionesTotals();
  const total = Math.round((rt.iva + rt.islr) * 100) / 100;
  if (!total) return null;
  const lines = [{ account: '2.01.06', debit: total, credit: 0, memo: 'Retenciones aplicadas a proveedores' }];
  if (rt.iva)  lines.push({ account: '2.01.10', debit: 0, credit: Math.round(rt.iva * 100) / 100, memo: 'Retención IVA por pagar' });
  if (rt.islr) lines.push({ account: '2.01.03', debit: 0, credit: Math.round(rt.islr * 100) / 100, memo: 'Retención ISLR por pagar' });
  return { date, concept: 'Retenciones del período (IVA + ISLR) a SENIAT', ref: 'RET-SENIAT', refType: 'manual', lines };
}
function buildIvaSettlementEntry(date) {
  const F = window.FiscalData; if (!F) return null;
  const d = F.declaracionIVA();
  const debito = Math.round(d.debito * 100) / 100;
  const credito = Math.round(d.credito * 100) / 100;
  const cuota = Math.round((debito - credito) * 100) / 100;
  if (!debito && !credito) return null;
  const lines = [];
  if (debito) lines.push({ account: '2.01.08', debit: debito, credit: 0, memo: 'Cierre IVA débito fiscal' });
  if (credito) lines.push({ account: '1.18', debit: 0, credit: credito, memo: 'Cierre IVA crédito fiscal' });
  if (cuota >= 0) lines.push({ account: '2.01.09', debit: 0, credit: cuota, memo: 'Cuota tributaria IVA por pagar' });
  else lines.push({ account: '1.18', debit: -cuota, credit: 0, memo: 'Excedente de crédito fiscal a favor' });
  return { date, concept: 'Declaración de IVA · cuota del período', ref: 'IVA-DECL', refType: 'manual', lines };
}

// ── v2.5 · Puente subdiario → mayor (cobros / pagos) ──────────
const SUBLEDGER_KEY = 'dtd_posted_subledger_v25';
function _postedSubledger() { try { return JSON.parse(localStorage.getItem(SUBLEDGER_KEY)) || []; } catch (e) { return []; } }
function isPostedSub(ref) { return _postedSubledger().includes(ref); }
function _markPostedSub(ref) { const a = _postedSubledger(); if (!a.includes(ref)) a.push(ref); try { localStorage.setItem(SUBLEDGER_KEY, JSON.stringify(a)); } catch (e) {} }
function pendingCollections() {
  const T = window.TesoreriaData; if (!T || !T.cashDeposits) return [];
  return T.cashDeposits().filter(d => d.invoice).map(d => ({ ...d, ref: 'col:' + d.id, posted: isPostedSub('col:' + d.id) }));
}
function pendingPayments() {
  const T = window.TesoreriaData; if (!T || !T.PAYMENT_ORDERS) return [];
  return T.PAYMENT_ORDERS.map(po => ({ ...po, ref: 'pay:' + po.id, posted: isPostedSub('pay:' + po.id) }));
}
function _coaOf(accountId) { const T = window.TesoreriaData; const a = T && T.getAccount ? T.getAccount(accountId) : null; return (a && a.coa) || '1.04.01'; }
function postCollection(dep) {
  const usd = Math.round((dep.amountUsd || 0) * 100) / 100; if (!usd) return null;
  const entry = createEntry({
    date: dep.date || '2026-05-24', concept: `Cobro factura ${dep.invoice}`,
    ref: dep.ref.replace('col:', ''), refType: dep.currency && dep.currency !== 'USD' ? 'payment-ves' : 'payment',
    lines: [
      { account: _coaOf(dep.accountId), debit: usd, credit: 0, memo: `Ingreso ${dep.method || ''}`.trim() },
      { account: '1.05.01', debit: 0, credit: usd, memo: `Cancelación CxC ${dep.invoice}` },
    ],
  });
  _markPostedSub(dep.ref);
  return entry;
}
function postPayment(po) {
  const usd = Math.round((po.amountUsd || 0) * 100) / 100; if (!usd) return null;
  const T = window.TesoreriaData;
  const payee = T && T.getPayee ? T.getPayee(po.payee) : null;
  const entry = createEntry({
    date: po.date || '2026-05-24', concept: `Pago ${payee ? payee.name : (po.payable || po.id)}`,
    ref: po.id, refType: 'expense',
    lines: [
      { account: '2.01.06', debit: usd, credit: 0, memo: `Cancelación CxP ${po.payable || ''}`.trim() },
      { account: _coaOf(po.fromAccount), debit: 0, credit: usd, memo: `Egreso ${po.method || ''}`.trim() },
    ],
  });
  _markPostedSub(po.ref);
  return entry;
}

// Posiciones monetarias en moneda extranjera (cuentas de caja VES/CNY
// con notional reconstruido desde el forex de sus movimientos).
function foreignPositions(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const accts = CHART_OF_ACCOUNTS.filter(a => isLeaf(a.code) && /^1\.0[13]\./.test(a.code));
  return accts.map(a => {
    const ccy = /^1\.01\./.test(a.code) ? 'VES' : 'CNY';
    let notional = 0;
    list.forEach(e => { if (!e.forex) return; e.lines.forEach(l => { if (l.account === a.code) { notional += ((l.debit || 0) > 0 ? 1 : -1) * (e.forex.originalAmount || 0); } }); });
    const bookUsd = accountBalance(a.code, list);
    const bookRate = bookUsd ? notional / bookUsd : 0;
    return { code: a.code, name: a.name, ccy, notional, bookUsd, bookRate };
  }).filter(p => Math.abs(p.notional) > 0.0001);
}

// Construye el asiento de diferencia cambiaria al revaluar a tasa de cierre.
// closingRates = { VES: <tasa>, CNY: <tasa> }. Devuelve null si no hay diferencia.
function buildRevaluationEntry(closingRates, date) {
  const positions = foreignPositions();
  const lines = [];
  let net = 0;
  positions.forEach(p => {
    const cr = Number(closingRates[p.ccy]);
    if (!cr) return;
    const revalUsd = p.notional / cr;
    const diff = Math.round((revalUsd - p.bookUsd) * 100) / 100;
    if (diff === 0) return;
    net += diff;
    lines.push({ account: p.code, debit: diff > 0 ? diff : 0, credit: diff < 0 ? -diff : 0, memo: `Reval. ${p.ccy} @ ${cr} (libro ${p.bookRate.toFixed(2)})` });
  });
  if (!lines.length) return null;
  net = Math.round(net * 100) / 100;
  lines.push({ account: '6.04', debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, memo: 'Diferencia cambiaria del cierre' });
  return { date, concept: 'Ajuste por diferencia cambiaria · cierre', ref: 'CIERRE-FX', refType: 'manual', lines };
}

// Construye el asiento de cierre: cancela ingresos/costos/gastos contra
// Ganancias Retenidas (3.04).
function buildClosingEntry(date) {
  const list = JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const lines = [];
  postedAccounts('I', list).forEach(r => { if (r.balance) lines.push({ account: r.account.code, debit: r.balance, credit: 0, memo: 'Cierre de ingresos' }); });
  ['CGS', 'G', 'OR'].forEach(t => postedAccounts(t, list).forEach(r => { if (r.balance) lines.push({ account: r.account.code, debit: 0, credit: r.balance, memo: 'Cierre de costos/gastos' }); }));
  const pl = calculatePL(list);
  const net = Math.round(pl.utilidadNeta * 100) / 100;
  lines.push({ account: '3.04', debit: net < 0 ? -net : 0, credit: net > 0 ? net : 0, memo: 'Resultado del ejercicio a Ganancias Retenidas' });
  return { date, concept: 'Cierre de ejercicio · traspaso a Ganancias Retenidas', ref: 'CIERRE-EJ', refType: 'cierre', lines, utilidad: net };
}

// Marcador de cierre (display + estado) en localStorage.
const PERIOD_CLOSE_KEY = 'dtd_period_close_v25';
function readClose() {
  try { return JSON.parse(localStorage.getItem(PERIOD_CLOSE_KEY)) || null; } catch (e) { return null; }
}
function writeClose(info) {
  try { localStorage.setItem(PERIOD_CLOSE_KEY, JSON.stringify(info)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-journal-changed'));
}

window.ContabilidadData = {
  CHART_OF_ACCOUNTS,
  JOURNAL_ENTRIES,
  getAccount: cdGetAccount, getAccountChildren, accountMovements, accountBalance,
  isLeaf, directBalance, postedAccounts, typeTotal,
  calculatePL, calculateBS,
  SEED_ENTRIES, nextEntryId, createEntry, updateEntry, deleteEntry, JOURNAL_LS_KEY,
  readLock, writeLock, isUnlocked,
  TYPE_LABEL,
  PAYMENT_METHODS, ACCOUNT_DETAIL_TYPES, nextAccountCode, createAccount,
  updateAccount, setAccountActive,
  foreignPositions, buildRevaluationEntry, buildClosingEntry, readClose, writeClose, PERIOD_CLOSE_KEY,
  FIXED_ASSETS, assetDepreciation, createAsset, buildDepreciationEntry,
  PROVISION_CFG, buildProvisionEntry, buildRetencionesEntry, buildIvaSettlementEntry,
  pendingCollections, pendingPayments, postCollection, postPayment, isPostedSub,
  findEntryByRef, reconcileBankMovement,
  CONTABILIDAD_LS_KEY,
};
