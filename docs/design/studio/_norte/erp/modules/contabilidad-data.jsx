/* global React */
/* ── DTD ERP · Contabilidad · Datos & helpers ───────────────── */
/* Plan de cuentas (CoA) freight-forwarder VE + asientos seed.   */
/* Libros en USD · VES de referencia con tasa del día.           */

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
const JOURNAL_ENTRIES = [
  // ── Facturas emitidas
  { id: 'AS-2026-0421', date: '2026-05-22', concept: 'Factura emitida · F-2026-0391 · Industrias Polar', ref: 'F-2026-0391', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 14:18',
    lines: [
      { account: '1.1.10', debit: 156800, credit: 0,      memo: 'CxC Industrias Polar' },
      { account: '4.1.01', debit: 0,      credit: 135172, memo: 'Flete marítimo MAR' },
      { account: '2.1.10', debit: 0,      credit: 21628,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0420', date: '2026-05-20', concept: 'Factura emitida · F-2026-0398 · Castro Hermanos', ref: 'F-2026-0398', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-20 11:05',
    lines: [
      { account: '1.1.10', debit: 48200, credit: 0,     memo: 'CxC Castro Hermanos' },
      { account: '4.1.03', debit: 0,     credit: 41552, memo: 'Servicio DDP Punto Fijo' },
      { account: '2.1.10', debit: 0,     credit: 6648,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0419', date: '2026-05-14', concept: 'Factura emitida · F-2026-0418 · Acindar Comercial', ref: 'F-2026-0418', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 09:32',
    lines: [
      { account: '1.1.10', debit: 84200, credit: 0,     memo: 'CxC Acindar Comercial' },
      { account: '4.1.01', debit: 0,     credit: 72586, memo: 'Flete marítimo PBL' },
      { account: '2.1.10', debit: 0,     credit: 11614, memo: 'IVA Débito Fiscal 16%' },
    ],
  },

  // ── Pagos recibidos USD
  { id: 'AS-2026-0418', date: '2026-05-22', concept: 'Pago recibido USD · F-2026-0391 · Polar', ref: 'WIRE-9982', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 15:42',
    lines: [
      { account: '1.1.01', debit: 156800, credit: 0,      memo: 'Banco Mercantil · transferencia' },
      { account: '1.1.10', debit: 0,      credit: 156800, memo: 'Cancelación CxC Polar' },
    ],
  },
  { id: 'AS-2026-0417', date: '2026-05-15', concept: 'Pago recibido USD · F-2026-0398 · Castro Hermanos', ref: 'WIRE-9954', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 10:18',
    lines: [
      { account: '1.1.01', debit: 48200, credit: 0,     memo: 'Banco Mercantil' },
      { account: '1.1.10', debit: 0,     credit: 48200, memo: 'Cancelación CxC Castro' },
    ],
  },

  // ── Pago recibido VES (con conversión a USD a tasa BCV) ─────
  { id: 'AS-2026-0416', date: '2026-05-19', concept: 'Pago recibido VES · F-2026-0382 · Acindar (parcial)', ref: 'TRF-VES-8841', refType: 'payment-ves', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 16:22',
    forex: { originalAmount: 671320, originalCurrency: 'VES', rate: 36.45, rateSource: 'bcv' },
    lines: [
      { account: '1.1.02', debit: 18416, credit: 0,     memo: 'Banesco VES · Bs. 671.320 @ 36,45' },
      { account: '1.1.10', debit: 0,     credit: 18416, memo: 'Cancelación parcial CxC Acindar' },
    ],
  },

  // ── Gastos directos (CGS)
  { id: 'AS-2026-0415', date: '2026-05-22', concept: 'Pago naviera COSCO · DTDU-501228', ref: 'TX-44182', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 17:00',
    lines: [
      { account: '5.1.01', debit: 28400, credit: 0,     memo: 'Flete naviero COSCO' },
      { account: '1.1.01', debit: 0,     credit: 28400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0414', date: '2026-05-19', concept: 'Honorarios Aduanas Carabobo · mayo', ref: 'TX-44158', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 14:08',
    lines: [
      { account: '5.1.05', debit: 4820, credit: 0,    memo: 'Honorarios agente a-001' },
      { account: '1.1.01', debit: 0,    credit: 4820, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0413', date: '2026-05-10', concept: 'Maersk · freight DTDU-419032', ref: 'TX-44062', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-10 09:14',
    lines: [
      { account: '5.1.01', debit: 41200, credit: 0,     memo: 'Flete naviero Maersk' },
      { account: '1.1.01', debit: 0,     credit: 41200, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Gastos operativos
  { id: 'AS-2026-0412', date: '2026-05-14', concept: 'Salarios quincena · choferes flota', ref: 'TX-44102', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 18:30',
    lines: [
      { account: '5.1.25', debit: 8400, credit: 0,    memo: 'Salarios choferes Q1 mayo' },
      { account: '1.1.01', debit: 0,    credit: 8400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0411', date: '2026-05-17', concept: 'Combustible flota PBL', ref: 'TX-44128', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-17 12:00',
    lines: [
      { account: '5.1.20', debit: 1240, credit: 0,    memo: 'PDV · combustible' },
      { account: '1.1.01', debit: 0,    credit: 1240, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0410', date: '2026-05-15', concept: 'Alquiler oficina Valencia · mayo', ref: 'TX-44099', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 08:00',
    lines: [
      { account: '6.1.02', debit: 1800, credit: 0,    memo: 'Alquiler mayo' },
      { account: '1.1.01', debit: 0,    credit: 1800, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0409', date: '2026-05-12', concept: 'Salarios administrativos · quincena', ref: 'TX-44085', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-12 18:00',
    lines: [
      { account: '6.1.01', debit: 4200, credit: 0,    memo: 'Nómina admin Q1' },
      { account: '1.1.01', debit: 0,    credit: 4200, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0408', date: '2026-05-08', concept: 'Comisiones bancarias · mayo', ref: 'TX-44044', refType: 'expense', status: 'contabilizado',
    user: 'Sistema',  createdAt: '2026-05-08 06:00',
    lines: [
      { account: '6.1.15', debit: 220, credit: 0,   memo: 'Banco · comisiones' },
      { account: '1.1.01', debit: 0,   credit: 220, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Asiento borrador (en proceso de conciliación)
  { id: 'AS-2026-0422', date: '2026-05-12', concept: 'TRX-INET digital · cargo a clasificar', ref: 'TX-44081', refType: 'unclassified', status: 'borrador',
    user: 'Andrés B.', createdAt: '2026-05-24 09:20',
    lines: [
      { account: '6.1.30', debit: 380, credit: 0,   memo: 'Por clasificar · investigar' },
      { account: '1.1.01', debit: 0,   credit: 380, memo: 'Banco Mercantil USD' },
    ],
    flagged: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────
function getAccount(code) {
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

function accountBalance(code, entries) {
  const acc = getAccount(code);
  if (!acc) return 0;
  // Si es agregada (level 1 o 2), suma children recursivo
  const isAggregate = acc.level <= 2;
  if (isAggregate) {
    const children = CHART_OF_ACCOUNTS.filter(a => a.parent === code || (a.parent && getAccount(a.parent)?.parent === code));
    return children.filter(c => c.level === 3).reduce((s, c) => s + accountBalance(c.code, entries), 0);
  }
  const movs = accountMovements(code, entries);
  const debits = movs.reduce((s, m) => s + (m.debit || 0), 0);
  const credits = movs.reduce((s, m) => s + (m.credit || 0), 0);
  // Activos/Gastos/CGS: saldo deudor (D - C); Pasivos/Patrimonio/Ingresos: saldo acreedor (C - D)
  if (acc.contra) return credits - debits;
  if (['A', 'G', 'CGS'].includes(acc.type)) return debits - credits;
  return credits - debits;
}

// Estado de Resultados (P&L) del período
function calculatePL(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const ingresos = CHART_OF_ACCOUNTS.filter(a => a.type === 'I' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const cgs = CHART_OF_ACCOUNTS.filter(a => a.type === 'CGS' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const gastos = CHART_OF_ACCOUNTS.filter(a => a.type === 'G' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const otros = CHART_OF_ACCOUNTS.filter(a => a.type === 'OR' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const totalIngresos = ingresos.reduce((s, r) => s + r.balance, 0);
  const totalCgs = cgs.reduce((s, r) => s + r.balance, 0);
  const utilidadBruta = totalIngresos - totalCgs;
  const totalGastos = gastos.reduce((s, r) => s + r.balance, 0);
  const utilidadOperativa = utilidadBruta - totalGastos;
  const totalOtros = otros.reduce((s, r) => s + r.balance, 0);
  const utilidadNeta = utilidadOperativa + totalOtros;
  return { ingresos, cgs, gastos, otros, totalIngresos, totalCgs, utilidadBruta, totalGastos, utilidadOperativa, totalOtros, utilidadNeta };
}

// Balance General
function calculateBS(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const activosC = CHART_OF_ACCOUNTS.filter(a => a.parent === '1.1').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const activosNC = CHART_OF_ACCOUNTS.filter(a => a.parent === '1.2').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pasivosC = CHART_OF_ACCOUNTS.filter(a => a.parent === '2.1').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pasivosNC = CHART_OF_ACCOUNTS.filter(a => a.parent === '2.2').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const patrimonio = CHART_OF_ACCOUNTS.filter(a => a.type === 'PT' && a.level === 3).map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pl = calculatePL(list);
  // Inyectar utilidad del ejercicio
  patrimonio.push({ account: { code: '3.1.20', name: 'Resultado del ejercicio (calculado)' }, balance: pl.utilidadNeta, calculated: true });
  const totalActivosC = activosC.reduce((s, r) => s + r.balance, 0);
  const totalActivosNC = activosNC.reduce((s, r) => s + r.balance, 0);
  const totalActivos = totalActivosC + totalActivosNC;
  const totalPasivosC = pasivosC.reduce((s, r) => s + r.balance, 0);
  const totalPasivosNC = pasivosNC.reduce((s, r) => s + r.balance, 0);
  const totalPasivos = totalPasivosC + totalPasivosNC;
  const totalPatrimonio = patrimonio.reduce((s, r) => s + r.balance, 0);
  return { activosC, activosNC, pasivosC, pasivosNC, patrimonio, totalActivosC, totalActivosNC, totalActivos, totalPasivosC, totalPasivosNC, totalPasivos, totalPatrimonio };
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
_loadCustomAccounts();

window.ContabilidadData = {
  CHART_OF_ACCOUNTS,
  JOURNAL_ENTRIES,
  getAccount, getAccountChildren, accountMovements, accountBalance,
  calculatePL, calculateBS,
  readLock, writeLock, isUnlocked,
  TYPE_LABEL,
  PAYMENT_METHODS, ACCOUNT_DETAIL_TYPES, nextAccountCode, createAccount,
  CONTABILIDAD_LS_KEY,
};
