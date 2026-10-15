/**
 * lib/i18n/es-VE/warehouse.ts · Strings del módulo Almacén CN.
 *
 * Cubre page header, KPIs, tabla, filtros, status badges, drawer
 * "Nueva recepción", bulk actions y mensajes de empty state.
 *
 * Las keys siguen el namespace `warehouse_cn.<area>.<concept>`.
 */

export const warehouse = {
  // ── Page header ──────────────────────────────────────────
  "warehouse_cn.page.eyebrow": "Operación · Almacén",
  "warehouse_cn.page.title_prefix": "Almacén CN",
  "warehouse_cn.page.description_template":
    "Recepción de mercadería en hubs {hubs}. Consolidación previa a zarpe.",
  "warehouse_cn.page.hubs_label": "Yiwu · Guangzhou · Shenzhen · Shanghai",

  // ── Header actions ───────────────────────────────────────
  "warehouse_cn.header.new_receipt": "+ Nueva recepción",
  "warehouse_cn.header.lang_toggle_aria": "Idioma de display",
  "warehouse_cn.header.lang_original": "Original",
  "warehouse_cn.header.lang_cn": "中文",
  "warehouse_cn.header.lang_es": "Español",

  // ── KPIs (4 cards horizontales) ──────────────────────────
  "warehouse_cn.kpi.receipts_this_month": "Recepciones del mes",
  "warehouse_cn.kpi.receipts_this_month_sub":
    "Cajas registradas desde el 1 del mes",
  "warehouse_cn.kpi.pending_consolidation": "Pendientes consolidar",
  "warehouse_cn.kpi.pending_consolidation_sub_some": "Esperando container",
  "warehouse_cn.kpi.pending_consolidation_sub_none": "Sin pendientes",
  "warehouse_cn.kpi.cbm_in_warehouse": "CBM en bodega",
  "warehouse_cn.kpi.cbm_in_warehouse_sub": "Suma de pendientes (m³)",
  "warehouse_cn.kpi.incidents": "Incidencias",
  "warehouse_cn.kpi.incidents_sub_some": "Requieren atención",
  "warehouse_cn.kpi.incidents_sub_none": "Sin incidencias activas",

  // ── Filtros / Toolbar ────────────────────────────────────
  "warehouse_cn.filter.search_label": "Buscar",
  "warehouse_cn.filter.search_placeholder":
    "Recibo, cliente, Shipping Mark, supplier…",
  "warehouse_cn.filter.hub_label": "Hub",
  "warehouse_cn.filter.hub_all": "Todos los hubs",
  "warehouse_cn.filter.status_label": "Estado",
  "warehouse_cn.filter.status_all": "Todos los estados",
  "warehouse_cn.filter.show_names": "Mostrar nombres",
  "warehouse_cn.filter.hide_names": "Ocultar nombres",
  "warehouse_cn.filter.clear": "Limpiar",

  // ── Status badges (matchea WarehouseReceiptStatus) ───────
  "warehouse_cn.status.pending_consolidation": "Pendiente consolidar",
  "warehouse_cn.status.consolidated": "Consolidado",
  "warehouse_cn.status.incident": "Incidencia",

  // ── Payment status (matchea PaymentStatus) ───────────────
  "warehouse_cn.payment.paid": "Pagado",
  "warehouse_cn.payment.partial": "Abono parcial",
  "warehouse_cn.payment.pending": "Pendiente",

  // ── Tabla · columnas ─────────────────────────────────────
  "warehouse_cn.table.col_receipt": "Recepción",
  "warehouse_cn.table.col_client": "Cliente",
  "warehouse_cn.table.col_supplier": "Proveedor CN",
  "warehouse_cn.table.col_hub": "Hub",
  "warehouse_cn.table.col_boxes": "Cajas",
  "warehouse_cn.table.col_cbm": "CBM",
  "warehouse_cn.table.col_weight": "Peso",
  "warehouse_cn.table.col_products": "Productos",
  "warehouse_cn.table.col_status": "Estado",
  "warehouse_cn.table.col_actions": "Acciones",
  "warehouse_cn.table.more_items": "+{count} más",
  "warehouse_cn.table.orphan": "Huérfana",

  // ── Empty state ──────────────────────────────────────────
  "warehouse_cn.empty.title": "Sin recepciones todavía",
  "warehouse_cn.empty.description":
    "Cuando llegue mercadería a un hub CN, regístrala con + Nueva recepción.",
  "warehouse_cn.empty.filtered_title": "No hay recepciones que coincidan",
  "warehouse_cn.empty.filtered_description":
    "Ajusta los filtros o limpia la búsqueda para ver todo.",

  // ── Row actions menu ─────────────────────────────────────
  "warehouse_cn.row.action_change_status": "Cambiar estado",
  "warehouse_cn.row.action_change_payment": "Cambiar pago",
  "warehouse_cn.row.action_consolidate": "Consolidar · destino",
  "warehouse_cn.row.action_invoicing": "Facturación",
  "warehouse_cn.row.action_verify_invoice": "Verificar para facturar",
  "warehouse_cn.row.action_unverify_invoice": "Quitar verificación",
  "warehouse_cn.row.verifying": "Guardando…",
  "warehouse_cn.row.invoice_verified_state": "Verificada para facturar",
  "warehouse_cn.row.action_view": "Ver detalle",
  "warehouse_cn.row.action_edit": "Editar",
  "warehouse_cn.row.action_delete": "Eliminar",
  "warehouse_cn.row.destination_required":
    "Ciudad destino es obligatoria para consolidar.",
  "warehouse_cn.row.destination_choose": "Elige ciudad",
  "warehouse_cn.row.consolidating": "Consolidando…",
  "warehouse_cn.row.empty_catalog":
    "Catálogo del tenant vacío — agrega ciudades primero.",
  "warehouse_cn.row.aria_actions": "Acciones de la recepción",
  "warehouse_cn.row.back": "← Volver",
  "warehouse_cn.row.destination_city_label": "Ciudad destino",
  "warehouse_cn.row.destination_choose_option": "— Elige ciudad —",
  "warehouse_cn.row.city_placeholder": "ej: Valencia",
  "warehouse_cn.row.consolidate_submit": "Consolidar",
  "warehouse_cn.row.empty_catalog_hint":
    "Catálogo del tenant vacío. Seedéalo desde /studio/admin/rutas tab Ciudades para elegir de una lista.",

  // ── Bulk actions bar ─────────────────────────────────────
  "warehouse_cn.bulk.selected_count": "{count} seleccionadas",
  "warehouse_cn.bulk.selected_count_singular": "{count} seleccionada",
  "warehouse_cn.bulk.aria_region": "Acciones masivas · {count} seleccionadas",
  "warehouse_cn.bulk.clear_selection": "Limpiar selección",
  "warehouse_cn.bulk.change_status": "Cambiar estado",
  "warehouse_cn.bulk.change_payment": "Cambiar pago",
  "warehouse_cn.bulk.processing": "Procesando…",
  "warehouse_cn.bulk.max_exceeded": "Máximo 100 recepciones por bulk.",
  "warehouse_cn.bulk.pay_paid": "Marcar pagados",
  "warehouse_cn.bulk.pay_partial": "Marcar pago parcial",
  "warehouse_cn.bulk.pay_pending": "Marcar pago pendiente",
  "warehouse_cn.bulk.status_pending": "Volver a pendiente",
  "warehouse_cn.bulk.status_incident": "Marcar incidencia",
  "warehouse_cn.bulk.cancel_btn": "Cancelar",
  "warehouse_cn.bulk.confirm_question":
    "¿Aplicar {action} a {count} recepciones?",
  "warehouse_cn.bulk.confirm_yes": "Sí, aplicar",
  "warehouse_cn.bulk.applying": "Aplicando…",
  "warehouse_cn.bulk.confirm_no": "No",
  "warehouse_cn.bulk.feedback_ok": "{count} actualizadas.",
  "warehouse_cn.bulk.feedback_error_generic": "Error",

  // ── Eliminar recepciones (SDD-0522) ──────────────────────
  "warehouse_cn.bulk.delete": "Eliminar…",
  "warehouse_cn.delete.title_one": "Eliminar 1 recepción",
  "warehouse_cn.delete.title_many": "Eliminar {count} recepciones",
  "warehouse_cn.delete.message":
    "Vas a eliminar: {codes}. Desaparecen del Almacén CN y de sus indicadores, y sus cajas se retiran: ya no se pueden estibar ni imprimir. Los códigos no se vuelven a usar. Solo se recuperan desde la base de datos.",
  "warehouse_cn.delete.warning_boxes_one": "Se retira 1 caja.",
  "warehouse_cn.delete.warning_boxes_many": "Se retiran {count} cajas.",
  "warehouse_cn.delete.reason_label": "Motivo (obligatorio, sin datos personales)",
  "warehouse_cn.delete.reason_placeholder": "p. ej. Recepciones de prueba",
  "warehouse_cn.delete.confirm_one": "Eliminar recepción",
  "warehouse_cn.delete.confirm_many": "Eliminar recepciones",
  "warehouse_cn.delete.cancel": "Cancelar",
  "warehouse_cn.delete.success_one": "1 recepción eliminada. Ya no aparece en el Almacén CN.",
  "warehouse_cn.delete.success_many":
    "{count} recepciones eliminadas. Ya no aparecen en el Almacén CN.",
  "warehouse_cn.delete.blocked_intro":
    "No puedes eliminar esta selección: {count} no se pueden eliminar.",
  "warehouse_cn.delete.blocked_row": "{code}: {reasons}.",
  "warehouse_cn.delete.blocked_more": "Y {count} más.",
  "warehouse_cn.delete.unavailable":
    "No se pudo comprobar qué recepciones se pueden eliminar. Recarga la página.",
  "warehouse_cn.delete.blocker.already_deleted": "ya estaba eliminada",
  "warehouse_cn.delete.blocker.consolidated":
    "está consolidada en un embarque (sácala del contenedor primero)",
  "warehouse_cn.delete.blocker.dispatch_orders": "está en una orden de despacho",
  "warehouse_cn.delete.blocker.purchase": "está unida a una compra",
  "warehouse_cn.delete.blocker.sales_order": "está unida a una orden de venta",
  "warehouse_cn.delete.blocker.ve_receipts": "ya se recibió en Venezuela",
  "warehouse_cn.delete.blocker.stowed_boxes": "tiene cajas estibadas en un contenedor",
  "warehouse_cn.delete.blocker.otro": "tiene otra dependencia",
  "warehouse_cn.delete.blocker.sin_datos": "no se pudo comprobar qué depende de ella",

  // ── New Receipt Drawer ───────────────────────────────────
  "warehouse_cn.drawer.title": "Nueva recepción",
  "warehouse_cn.drawer.subtitle":
    "Carga mercadería que llegó a un hub CN. El código se asigna automático.",
  "warehouse_cn.drawer.submit_close": "Registrar y cerrar",
  "warehouse_cn.drawer.submit_open": "Registrar y abrir recibo",
  "warehouse_cn.drawer.submit_next": "Registrar y siguiente paquete",
  "warehouse_cn.drawer.submitting": "Registrando…",
  "warehouse_cn.drawer.success_close": "Recepción registrada",
  "warehouse_cn.drawer.success_open": "Abriendo recibo",
  "warehouse_cn.drawer.success_next": "Listo el siguiente",
  "warehouse_cn.drawer.submit_close_desc":
    "Registra el recibo y vuelve al listado con el nuevo resaltado.",
  "warehouse_cn.drawer.submit_open_desc":
    "Registra y abre el detalle del recibo para imprimir / verificar.",
  "warehouse_cn.drawer.submit_next_desc":
    "Registra el recibo, limpia los campos (mantiene el almacén) y deja el drawer abierto para el próximo paquete del lote.",
  "warehouse_cn.drawer.item_label": "Item {index}",
  "warehouse_cn.drawer.item_remove_aria": "Quitar item {index}",
  "warehouse_cn.drawer.item_desc_label": "Descripción",
  "warehouse_cn.drawer.item_desc_placeholder": "Cargadores USB-C · 充电器",
  "warehouse_cn.drawer.item_hs_label": "HS code",
  "warehouse_cn.drawer.item_qty_label": "Cantidad",
  "warehouse_cn.drawer.item_val_label": "Valor unit. USD",
  "warehouse_cn.drawer.section_warehouse": "Almacén",
  "warehouse_cn.drawer.section_client": "Cliente",
  "warehouse_cn.drawer.section_supplier": "¿Quién la trajo?",
  "warehouse_cn.drawer.section_items": "Items en la caja",
  "warehouse_cn.drawer.section_totals": "Totales",
  "warehouse_cn.drawer.section_notes": "Notas internas",
  "warehouse_cn.drawer.section_status": "Estado de la mercadería",
  "warehouse_cn.drawer.warehouse_placeholder": "Selecciona el hub que recibió la caja…",
  "warehouse_cn.drawer.client_placeholder": "Selecciona cliente…",
  "warehouse_cn.drawer.client_label": "Cliente · Shipping Mark",
  "warehouse_cn.drawer.orphan_toggle_on": "Marcar como huérfana (sin Shipping Mark)",
  "warehouse_cn.drawer.orphan_toggle_off": "Volver a cliente conocido",
  "warehouse_cn.drawer.supplier_placeholder":
    "Nombre del proveedor o quién la trajo…",
  "warehouse_cn.drawer.orphan_label": "Huérfana (sin cliente)",
  "warehouse_cn.drawer.orphan_marks": "Marcas / identificación",
  "warehouse_cn.drawer.orphan_brought_by": "¿Quién la trajo?",
  "warehouse_cn.drawer.orphan_suspected": "Cliente sospechado (opcional)",
  "warehouse_cn.drawer.boxes_label": "Cajas",
  "warehouse_cn.drawer.cbm_label": "CBM (m³)",
  "warehouse_cn.drawer.weight_label": "Peso (kg)",
  "warehouse_cn.drawer.items_add": "Agregar item",
  "warehouse_cn.drawer.items_multi_hs": "Multi-HS soportado",
  "warehouse_cn.drawer.notes_placeholder": "Notas internas (opcional)",
  "warehouse_cn.drawer.supplier_label_bi": "Proveedor (CN o ES)",
  "warehouse_cn.drawer.supplier_translate": "Traducir CN → ES / ES → CN",
  "warehouse_cn.drawer.supplier_paste_translation": "Pega la traducción…",
  "warehouse_cn.supplier.placeholder": "Nombre del supplier · 中文 o español",
  "warehouse_cn.supplier.translate_btn": "Traducir {direction}",
  "warehouse_cn.supplier.translate_title": "Cargar traducción {direction}",
  "warehouse_cn.supplier.translation_label": "Traducción {direction}",
  "warehouse_cn.supplier.translation_label_optional": "Traducción (opcional)",
  "warehouse_cn.supplier.remove_translation": "Quitar traducción",
  "warehouse_cn.supplier.paste_placeholder": "Pega la traducción en {lang}…",
  "warehouse_cn.supplier.translation_note":
    "V1: pega la traducción manualmente (de WeChat, Alibaba, tu contacto). Auto-traducción IA viene en SDD futuro.",
  "warehouse_cn.supplier.bilingual_hint":
    "Puedes escribir en chino o español · te ofrecemos cargar la traducción al otro idioma.",
  "warehouse_cn.supplier.lang_es": "español",
  "warehouse_cn.supplier.lang_cn": "中文",

  // ── Drawer · Orphan section ──────────────────────────────
  "warehouse_cn.drawer.orphan_toggle":
    "¿Sin código Shipping Mark? · marcar como caja huérfana",
  "warehouse_cn.drawer.orphan_badge": "Caja huérfana",
  "warehouse_cn.drawer.orphan_code_note": "· se asignará",
  "warehouse_cn.drawer.orphan_disable": "Desactivar",
  "warehouse_cn.drawer.orphan_marks_label": "Marcas / identificación visible",
  "warehouse_cn.drawer.orphan_marks_placeholder":
    "Ej: ACINDAR-VLN-04 · ⌂ rojo · etiqueta china",
  "warehouse_cn.drawer.orphan_marks_hint":
    "Cualquier texto, color, símbolo o marca visible. Sirve para que el cliente reclame la caja después.",
  "warehouse_cn.drawer.orphan_brought_label": "¿Quién la trajo?",
  "warehouse_cn.drawer.orphan_brought_placeholder": "Chofer / transportista",
  "warehouse_cn.drawer.orphan_suspected_label": "Posible cliente (sospecha)",
  "warehouse_cn.drawer.orphan_suspected_placeholder": "Si tienes idea…",

  // ── Drawer · Items / Totales / Notas ─────────────────────
  "warehouse_cn.drawer.items_title": "Items en la caja",
  "warehouse_cn.drawer.items_hint": "Multi-HS soportado · entre 1 y {max} items.",
  "warehouse_cn.drawer.items_add_btn": "Agregar item",
  "warehouse_cn.drawer.totals_title": "Totales de la caja",
  "warehouse_cn.drawer.boxes_field_label": "Cajas",
  "warehouse_cn.drawer.boxes_unit": "cajas",
  "warehouse_cn.drawer.cbm_field_label": "CBM",
  "warehouse_cn.drawer.weight_field_label": "Peso",
  "warehouse_cn.drawer.received_label": "Recibido",
  "warehouse_cn.drawer.notes_label": "Notas internas",
  "warehouse_cn.drawer.notes_placeholder_long":
    "Estado de la mercadería, observaciones, daños visibles…",

  // ── Errores server ───────────────────────────────────────
  "warehouse_cn.error.tenant_unresolved": "No se pudo resolver el tenant.",
  "warehouse_cn.error.code_generation": "No se pudo generar el código.",
  "warehouse_cn.error.required_fields": "Hay campos requeridos sin completar.",
  "warehouse_cn.error.create_failed": "No se pudo registrar la recepción.",
  "warehouse_cn.error.not_found": "Recepción no encontrada.",
  "warehouse_cn.error.invalid_payment": "Estado de pago inválido.",
} as const satisfies Record<string, string>;

export type WarehouseDict = Record<keyof typeof warehouse, string>;
