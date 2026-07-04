/**
 * lib/i18n/es-VE/chrome.ts · Strings comunes del chrome (sidebar,
 * topbar, drawers, badges, acciones genéricas) en español Venezuela.
 *
 * Las keys siguen namespace `chrome.<area>.<concept>`. Cuando agregues
 * una key acá DEBES agregarla también en zh-CN/chrome.ts con la misma
 * key — el tipo I18nKey es derivado del shape de es-VE.
 */

export const chrome = {
  // ── Acciones genéricas (botones, links) ──────────────────
  "chrome.action.cancel": "Cancelar",
  "chrome.action.close": "Cerrar",
  "chrome.action.save": "Guardar",
  "chrome.action.create": "Crear",
  "chrome.action.edit": "Editar",
  "chrome.action.delete": "Eliminar",
  "chrome.action.confirm": "Confirmar",
  "chrome.action.back": "Volver",
  "chrome.action.next": "Siguiente",
  "chrome.action.processing": "Procesando…",
  "chrome.action.saving": "Guardando…",
  "chrome.action.saved": "Guardado",
  "chrome.action.loading": "Cargando…",
  "chrome.action.search": "Buscar",
  "chrome.action.filter": "Filtrar",
  "chrome.action.clear": "Limpiar",
  "chrome.action.export": "Exportar",
  "chrome.action.import": "Importar",
  "chrome.action.upload": "Subir",
  "chrome.action.download": "Descargar",
  "chrome.action.retry": "Reintentar",

  // ── Drawer estándar ──────────────────────────────────────
  "chrome.drawer.cancel": "Cancelar",
  "chrome.drawer.close": "Cerrar",
  "chrome.drawer.aria_close": "Cerrar panel",
  "chrome.drawer.submitting": "Creando…",

  // ── Estados de form ──────────────────────────────────────
  "chrome.form.required": "Este campo es requerido.",
  "chrome.form.invalid": "Valor inválido.",
  "chrome.form.too_long": "Texto demasiado largo.",
  "chrome.form.errors_present": "Hay campos con errores.",

  // ── Sidebar · grupos ─────────────────────────────────────
  "chrome.sidebar.group.operation": "Operación",
  "chrome.sidebar.group.commercial": "Comercial",
  "chrome.sidebar.group.finance": "Finanzas",
  "chrome.sidebar.group.marketing": "Marketing",
  "chrome.sidebar.group.system": "Sistema",
  "chrome.sidebar.collapse": "Colapsar sidebar",
  "chrome.sidebar.expand": "Expandir sidebar",
  // Sub-grupos anidados (clusters dentro de un grupo · patrón Norte)
  "chrome.sidebar.cluster_almacenes": "Almacenes",
  "chrome.sidebar.cluster_despacho": "Despacho",
  "chrome.sidebar.resize": "Arrastra para ajustar el ancho del menú",

  // ── Sidebar · items (todos los módulos del Studio) ───────
  // OPERACIÓN
  "chrome.sidebar.dashboard": "Dashboard",
  "chrome.sidebar.shipments": "Embarques",
  "chrome.sidebar.tracking": "Tracking",
  "chrome.sidebar.calendar": "Calendario",
  "chrome.sidebar.warehouse_cn": "Almacén CN",
  "chrome.sidebar.qr_queue": "Cola de QR",
  "chrome.sidebar.labels_cn": "Etiquetas CN",
  "chrome.sidebar.warehouse_ve": "Almacén VE",
  "chrome.sidebar.customs_seniat": "Aduana SENIAT",
  "chrome.sidebar.tms": "TMS · Transporte",
  "chrome.sidebar.dispatch": "Despacho",
  "chrome.sidebar.dispatch_rules": "Reglas despacho",
  "chrome.sidebar.dispatch_dashboard": "Dashboard despacho",
  "chrome.sidebar.routes_cities": "Rutas y ciudades",
  "chrome.sidebar.consolidation": "Consolidación",
  // COMERCIAL
  "chrome.sidebar.quotes": "Estimados",
  "chrome.sidebar.clients": "Clientes",
  "chrome.sidebar.leads": "CRM · Leads",
  "chrome.sidebar.suppliers_cn": "PreAlertas de servicios",
  "chrome.sidebar.rates": "Tarifas",
  // FINANZAS
  "chrome.sidebar.invoices": "Facturación",
  "chrome.sidebar.documents": "Documentos",
  "chrome.sidebar.reports": "Reportes",
  "chrome.sidebar.costing": "Costing & Margen",
  "chrome.sidebar.expenses": "Gastos",
  // MARKETING
  "chrome.sidebar.noticias_web": "Noticias Web",
  // SISTEMA
  "chrome.sidebar.mailing": "Mailing",
  "chrome.sidebar.seo_generator": "Generador SEO",
  "chrome.sidebar.no_olvidar": "No-Olvidar",
  "chrome.sidebar.users": "Usuarios",
  "chrome.sidebar.operarios_pwa": "Operarios PWA",
  "chrome.sidebar.bugs": "Bug Tracker",
  "chrome.sidebar.my_reports": "Mis reportes",
  "chrome.sidebar.administration": "Administración",
  // Footer
  "chrome.sidebar.collapse_short": "Colapsar",
  // Fallback module labels (pathToModuleLabel)
  "chrome.module.settings": "Ajustes",
  "chrome.module.studio": "DTD Studio",
  "chrome.module.general": "General",

  // ── Topbar ───────────────────────────────────────────────
  "chrome.topbar.module": "Módulo",
  "chrome.topbar.search_placeholder": "Buscar embarques, clientes, Shipping Mark…",
  "chrome.topbar.search_aria": "Buscar en el Studio (atajo: {key}+K)",
  "chrome.topbar.theme_toggle": "Cambiar tema",
  "chrome.topbar.theme_to_light": "Cambiar a modo claro",
  "chrome.topbar.theme_to_dark": "Cambiar a modo oscuro",
  "chrome.topbar.notifications": "Notificaciones",
  "chrome.topbar.user_menu": "Menú de usuario",
  "chrome.topbar.menu_profile": "Mi perfil",
  "chrome.topbar.menu_password": "Cambiar contraseña",
  "chrome.topbar.menu_shortcuts": "Atajos de teclado",
  "chrome.topbar.menu_preferences": "Preferencias",
  "chrome.topbar.menu_report_bug": "Reportar un problema",
  "chrome.topbar.menu_logout": "Cerrar sesión",
  "chrome.topbar.logging_out": "Cerrando sesión…",
  "chrome.topbar.search_modal_placeholder": "Búsqueda global (próximamente)",
  "chrome.topbar.search_modal_title": "Búsqueda global llegará en Sprint 6.4.",
  "chrome.topbar.search_modal_hint":
    "Mientras tanto, navega desde el sidebar para encontrar embarques, clientes, Shipping Mark y demás.",

  // ── Buscador global ⌘K (SDD-0135) ────────────────────────
  "chrome.search.dialog_aria": "Buscador global del Studio",
  "chrome.search.placeholder":
    "Buscar cliente, embarque, estimado, factura, pago…",
  "chrome.search.searching": "Buscando…",
  "chrome.search.scope_all": "Todo",
  "chrome.search.facet.clients": "Clientes",
  "chrome.search.facet.shipments": "Embarques",
  "chrome.search.facet.quotes": "Estimados",
  "chrome.search.facet.invoices": "Facturas",
  "chrome.search.facet.payments": "Pagos",
  "chrome.search.recents": "Búsquedas recientes",
  "chrome.search.empty_hint":
    "Escribe para buscar en todo el Studio: nombre, Shipping Mark, cédula/RIF, código o monto.",
  "chrome.search.no_results": "Sin coincidencias.",
  "chrome.search.locked_title": "Restringido",
  "chrome.search.locked_note":
    "Facturas, pagos y cobranzas las gestiona Contabilidad.",
  "chrome.search.kbd_navigate": "moverse",
  "chrome.search.kbd_select": "abrir",
  "chrome.search.kbd_toggle": "buscar",

  // ── Toasts genéricos ─────────────────────────────────────
  "chrome.toast.success": "Listo",
  "chrome.toast.error": "Algo salió mal",
  "chrome.toast.dismiss": "Cerrar",
  "chrome.toast.region_aria": "Notificaciones del Studio",
  "chrome.toast.dismiss_aria": "Cerrar notificación",

  // ── Badges de status comunes ─────────────────────────────
  "chrome.badge.pending": "Pendiente",
  "chrome.badge.active": "Activo",
  "chrome.badge.inactive": "Inactivo",
  "chrome.badge.archived": "Archivado",

  // ── Empty states ─────────────────────────────────────────
  "chrome.empty.no_results": "Sin resultados",
  "chrome.empty.no_results_hint":
    "Ajusta los filtros o agrega un registro nuevo.",
} as const satisfies Record<string, string>;

/**
 * Tipo del dict: keys del literal `chrome` con valores string libres
 * (no literal-string types). Esto permite que zh-CN provea valores
 * distintos manteniendo coverage de keys.
 */
export type ChromeDict = Record<keyof typeof chrome, string>;
