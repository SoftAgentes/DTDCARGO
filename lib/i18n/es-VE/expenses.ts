/**
 * lib/i18n/es-VE/expenses.ts · Módulo Gastos CN (SDD-0039).
 *
 * Cubre /studio/gastos: page, tabs por scope, KPIs, drawer 2-pasos,
 * categorías (viaje + op_*), fx CNY/USD, export.
 */

export const expenses = {
  // ── Page ─────────────────────────────────────────────────
  "expenses.page.eyebrow": "Finanzas · Gastos",
  "expenses.page.title": "Gastos",
  "expenses.page.subtitle":
    "Gastos por contenedor y overhead operativo. Moneda dual CNY/USD.",
  "expenses.new_btn": "+ Nuevo gasto",
  "expenses.export_btn": "Exportar mes",
  "expenses.exporting": "Exportando…",

  // ── Tabs por scope ───────────────────────────────────────
  "expenses.tab.shipment": "Por contenedor",
  "expenses.tab.external": "Operativos",

  // ── KPIs ─────────────────────────────────────────────────
  "expenses.kpi.month_total_usd": "Total del mes (USD)",
  "expenses.kpi.month_total_sub": "Normalizado a dólar",
  "expenses.kpi.shipment_total": "Por contenedor",
  "expenses.kpi.external_total": "Operativos",
  "expenses.kpi.count": "Gastos cargados",
  "expenses.kpi.pending_alerts": "Contenedores esperando gastos",

  // ── Filtros / tabla ──────────────────────────────────────
  "expenses.filter.search_label": "Buscar",
  "expenses.filter.search_ph": "Código, nota, proveedor…",
  "expenses.filter.month_label": "Mes",
  "expenses.table.col_code": "Código",
  "expenses.table.col_date": "Fecha",
  "expenses.table.col_shipment": "Contenedor",
  "expenses.table.col_category": "Categoría",
  "expenses.table.col_note": "Detalle",
  "expenses.table.col_amount": "Monto",
  "expenses.table.col_amount_usd": "USD",
  "expenses.table.col_method": "Método",
  "expenses.table.col_receipt": "Recibo",
  "expenses.table.col_actions": "Acciones",
  "expenses.table.no_receipt": "—",
  "expenses.table.view_receipt": "Ver recibo",

  // ── Empty states ─────────────────────────────────────────
  "expenses.empty.shipment_title": "Sin gastos de contenedor",
  "expenses.empty.shipment_desc":
    "Cuando se consolide un contenedor, carga acá sus gastos (transporte, aduana, etc.).",
  "expenses.empty.external_title": "Sin gastos operativos",
  "expenses.empty.external_desc":
    "Alquiler, servicios, sueldos y demás overhead de la oficina CN van acá.",
  "expenses.empty.filtered": "No hay gastos que coincidan con el filtro.",

  // ── Drawer · paso 1 scope ────────────────────────────────
  "expenses.drawer.title": "Nuevo gasto",
  "expenses.drawer.edit_title": "Editar gasto",
  "expenses.drawer.step1_legend": "¿Qué tipo de gasto es?",
  "expenses.scope.shipment": "Gasto de contenedor",
  "expenses.scope.shipment_desc":
    "Atribuible a un embarque: transporte local, aduana, etc.",
  "expenses.scope.external": "Gasto operativo",
  "expenses.scope.external_desc":
    "Overhead de oficina/bodega: alquiler, servicios, sueldos.",

  // ── Drawer · campos ──────────────────────────────────────
  "expenses.field.shipment": "Contenedor (embarque)",
  "expenses.field.shipment_ph": "Elige el contenedor…",
  "expenses.field.category": "Categoría",
  "expenses.field.amount": "Monto",
  "expenses.field.currency": "Moneda",
  "expenses.field.method": "Método de pago",
  "expenses.field.note": "Detalle / descripción",
  "expenses.field.note_ph": "Ej: flete local Yiwu → puerto",
  "expenses.field.location": "Ubicación (opcional)",
  "expenses.field.location_ph": "Ej: Yiwu, CN",
  "expenses.field.occurred_at": "Fecha del gasto",
  "expenses.field.receipt": "Adjuntar recibo / foto",
  "expenses.field.receipt_hint":
    "Factura del transporte, foto del recibo del almacén, etc.",
  "expenses.field.billable": "Cobrable al cliente",

  // ── fx CNY/USD ───────────────────────────────────────────
  "expenses.fx.label": "Tipo de cambio ({pair})",
  "expenses.fx.prefill_recent": "Último usado el {date}. ¿Sigue vigente?",
  "expenses.fx.prefill_old": "Tipo de cambio viejo, valida antes de guardar.",
  "expenses.fx.no_history": "Búscalo en xe.com o equivalente.",
  "expenses.fx.preview": "= {usd}",
  "expenses.fx.sanity_warning":
    "Tipo de cambio fuera del rango histórico ({min}–{max}). ¿Es correcto?",

  // ── Drawer · submit ──────────────────────────────────────
  "expenses.drawer.submit": "Guardar gasto",
  "expenses.drawer.saving": "Guardando…",
  "expenses.drawer.saved": "Gasto guardado",

  // ── Row actions ──────────────────────────────────────────
  "expenses.row.edit": "Editar",
  "expenses.row.delete": "Eliminar",
  "expenses.row.delete_confirm": "¿Eliminar este gasto?",
  "expenses.row.deleted": "Gasto {code} eliminado",

  // ── Toasts ───────────────────────────────────────────────
  "expenses.toast.created": "Gasto {code} guardado",
  "expenses.toast.updated": "Gasto {code} actualizado",

  // ── Alertas de consolidado (B.8) ─────────────────────────
  "expenses.alert.banner_title_one": "1 contenedor esperando gastos",
  "expenses.alert.banner_title_many": "{count} contenedores esperando gastos",
  "expenses.alert.banner_sub":
    "Consolidados sin gastos cargados. Carga los gastos o marca cuando termines.",
  "expenses.alert.load_btn": "Cargar gasto",
  "expenses.alert.close_btn": "Marcar cargado",
  "expenses.alert.closing": "Cerrando…",
  "expenses.alert.closed_toast": "Contenedor {code} marcado como cargado",
  "expenses.alert.chip": "Pendiente gastos",
  "expenses.alert.no_destination": "sin destino",

  // ── Categorías · viaje (shipment) ────────────────────────
  "expenses.category.taxi": "Taxi / transfer",
  "expenses.category.comida": "Comida",
  "expenses.category.hotel": "Hotel",
  "expenses.category.vuelo": "Vuelo",
  "expenses.category.peaje": "Peaje",
  "expenses.category.combustible": "Combustible",
  "expenses.category.aduana": "Aduana",
  "expenses.category.cliente": "Visita cliente",
  "expenses.category.otro": "Otro",
  // ── Categorías · operativas (external) ───────────────────
  "expenses.category.op_rent": "Alquiler bodega",
  "expenses.category.op_utilities": "Servicios (luz/agua/internet)",
  "expenses.category.op_salaries": "Sueldos locales",
  "expenses.category.op_supplies": "Suministros / packing",
  "expenses.category.op_equipment": "Equipamiento",
  "expenses.category.op_local_transport": "Transporte local",
  "expenses.category.op_customs_local": "Aduana local CN",

  // ── Métodos de pago ──────────────────────────────────────
  "expenses.method.cash": "Efectivo",
  "expenses.method.card": "Tarjeta",
  "expenses.method.transfer": "Transferencia",
  "expenses.method.usdt": "USDT",
} as const satisfies Record<string, string>;

export type ExpensesDict = Record<keyof typeof expenses, string>;
