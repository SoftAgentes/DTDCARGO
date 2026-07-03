/**
 * Registro canónico de módulos del Studio.
 *
 * Fuente única de verdad de {id, slug, group, label, icon} para:
 *   - StudioSidebar (navegación + active state + pathToModuleLabel)
 *   - lib/studio/rbac.ts (matriz de acceso por rol — SDD-0085)
 *
 * Es DATA PURA (sin React, sin server-only) → importable desde client y server.
 * Los `icon` son nombres (string literal), no componentes; el render los
 * resuelve vía el objeto `Icon`. Los `labelKey` son claves del catálogo i18n.
 *
 * Slugs definidos en SDD-0007 §4.1. Extraído de StudioSidebar.tsx en SDD-0085
 * para romper el ciclo "registro de módulos ↔ matriz RBAC" sin arrastrar el
 * componente client a los helpers de rol.
 */

import type { IconName } from "@/app/studio/_components/icons";
import type { I18nKey } from "@/lib/i18n";

export type Group =
  | "OPERACIÓN"
  | "COMERCIAL"
  | "FINANZAS"
  | "MARKETING"
  | "SISTEMA";

export interface ModuleDef {
  id: string;
  group: Group;
  /** Label en es-VE · fallback si no hay labelKey o si la key no traduce. */
  label: string;
  /** Key del catálogo i18n. Cuando exista, el render usa `t(labelKey)`. */
  labelKey?: I18nKey;
  icon: IconName;
  slug: string; // ruta bajo /studio
  badge?: string; // Pendiente de cablear contra data real — ver SDD-0014/dashboard-queries
  /** Solo admin (la matriz RBAC también lo gatea con []). Ej: Dirección (SDD-0048). */
  adminOnly?: boolean;
  /**
   * Sub-grupo anidado (cluster) dentro de su `group`. Clave de `PARENTS`. NO
   * cambia routing ni RBAC — solo la presentación: el sidebar agrupa estos
   * módulos bajo un header colapsable indentado (patrón Norte). Los hijos siguen
   * siendo módulos normales. Vacío = ítem suelto (hoja).
   */
  parent?: string;
}

/** Group label → I18nKey para localización en sidebar headers. */
export const GROUP_LABEL_KEYS: Record<Group, I18nKey> = {
  "OPERACIÓN": "chrome.sidebar.group.operation",
  "COMERCIAL": "chrome.sidebar.group.commercial",
  "FINANZAS": "chrome.sidebar.group.finance",
  "MARKETING": "chrome.sidebar.group.marketing",
  "SISTEMA": "chrome.sidebar.group.system",
};

/**
 * Sub-grupos anidados (parents) dentro de un `group`. Portado del Norte vigente
 * (`docs/design/studio/_norte/erp/shell.jsx`, registro `PARENTS`). El header es
 * un toggle no-navegable que colapsa/expande a sus hijos; no toca routing.
 */
export interface ParentDef {
  id: string;
  label: string;
  labelKey?: I18nKey;
  icon: IconName;
}

export const PARENTS: Record<string, ParentDef> = {
  almacenes: {
    id: "almacenes",
    label: "Almacenes",
    labelKey: "chrome.sidebar.cluster_almacenes",
    icon: "warehouse",
  },
  despachogrp: {
    id: "despachogrp",
    label: "Despacho",
    labelKey: "chrome.sidebar.cluster_despacho",
    icon: "truck",
  },
};

export const MODULES: ModuleDef[] = [
  // ─── OPERACIÓN · sigue el viaje de la carga ──────────────────
  // Cockpit (visión diaria): resumen + embarques + tracking + agenda
  { id: "dashboard", group: "OPERACIÓN", label: "Dashboard", labelKey: "chrome.sidebar.dashboard", icon: "dashboard", slug: "/studio/dashboard" },
  { id: "shipments", group: "OPERACIÓN", label: "Embarques", labelKey: "chrome.sidebar.shipments", icon: "box", slug: "/studio/embarques" },
  { id: "tracking", group: "OPERACIÓN", label: "Tracking", labelKey: "chrome.sidebar.tracking", icon: "radar", slug: "/studio/tracking" },
  { id: "calendar", group: "OPERACIÓN", label: "Calendario", labelKey: "chrome.sidebar.calendar", icon: "clock", slug: "/studio/calendario" },
  // Almacenes (cluster anidado): CN → etiquetado → VE
  { id: "cn", group: "OPERACIÓN", label: "Almacén CN", labelKey: "chrome.sidebar.warehouse_cn", icon: "warehouse", slug: "/studio/cn", parent: "almacenes" },
  { id: "qrqueue", group: "OPERACIÓN", label: "Cola de QR", labelKey: "chrome.sidebar.qr_queue", icon: "tag", slug: "/studio/cola-qr", parent: "almacenes" },
  { id: "labels", group: "OPERACIÓN", label: "Etiquetas CN", labelKey: "chrome.sidebar.labels_cn", icon: "tag", slug: "/studio/etiquetas", parent: "almacenes" },
  { id: "ve", group: "OPERACIÓN", label: "Almacén VE", labelKey: "chrome.sidebar.warehouse_ve", icon: "warehouse", slug: "/studio/ve", parent: "almacenes" },
  // Tránsito: naviera/consolidación → aduana
  { id: "naviera", group: "OPERACIÓN", label: "Naviera & Consolidación", icon: "ship", slug: "/studio/naviera" },
  { id: "seniat", group: "OPERACIÓN", label: "Aduana SENIAT", labelKey: "chrome.sidebar.customs_seniat", icon: "shield", slug: "/studio/seniat" },
  // Última milla: transporte + despacho (cluster anidado: despacho + sub-páginas) + rutas
  { id: "tms", group: "OPERACIÓN", label: "TMS · Transporte", labelKey: "chrome.sidebar.tms", icon: "truck", slug: "/studio/tms" },
  { id: "despacho", group: "OPERACIÓN", label: "Despacho", labelKey: "chrome.sidebar.dispatch", icon: "truck", slug: "/studio/despacho", parent: "despachogrp" },
  { id: "despacho-rules", group: "OPERACIÓN", label: "Reglas despacho", labelKey: "chrome.sidebar.dispatch_rules", icon: "shield", slug: "/studio/despacho/reglas", parent: "despachogrp" },
  { id: "despacho-dashboard", group: "OPERACIÓN", label: "Dashboard despacho", labelKey: "chrome.sidebar.dispatch_dashboard", icon: "chart", slug: "/studio/despacho/dashboard", parent: "despachogrp" },
  { id: "admin-rutas", group: "OPERACIÓN", label: "Rutas y ciudades", labelKey: "chrome.sidebar.routes_cities", icon: "radar", slug: "/studio/admin/rutas" },
  // Stock + post-venta
  { id: "inventory", group: "OPERACIÓN", label: "Inventario · WMS", icon: "warehouse", slug: "/studio/inventario" },
  { id: "reclamos", group: "OPERACIÓN", label: "Reclamos", icon: "shield", slug: "/studio/reclamos" },
  { id: "inspecciones", group: "OPERACIÓN", label: "Inspecciones", icon: "check", slug: "/studio/inspecciones" },

  // ─── COMERCIAL · cliente → CRM → órdenes → catálogo → lealtad ─
  { id: "quotes", group: "COMERCIAL", label: "Estimados", labelKey: "chrome.sidebar.quotes", icon: "calc", slug: "/studio/cotizador" },
  { id: "clients", group: "COMERCIAL", label: "Clientes", labelKey: "chrome.sidebar.clients", icon: "users", slug: "/studio/clientes" },
  // CRM / relación
  { id: "conversaciones", group: "COMERCIAL", label: "Conversaciones", icon: "mail", slug: "/studio/conversaciones" },
  { id: "leads", group: "COMERCIAL", label: "CRM · Leads", labelKey: "chrome.sidebar.leads", icon: "spark", slug: "/studio/leads" },
  { id: "kommo", group: "COMERCIAL", label: "Kommo CRM", icon: "radar", slug: "/studio/kommo" },
  // Órdenes: venta al cliente → sourcing (proveedores → compra)
  { id: "sales-orders", group: "COMERCIAL", label: "Órdenes de venta", icon: "invoice", slug: "/studio/ordenes-venta" },
  // Renombre founder 2026-07-03: son solicitudes de servicio (prealertas), no
  // un catálogo de proveedores. id/slug NO cambian (contrato interno).
  { id: "suppliers", group: "COMERCIAL", label: "PreAlertas de servicios", labelKey: "chrome.sidebar.suppliers_cn", icon: "cn", slug: "/studio/proveedores" },
  { id: "purchase-orders", group: "COMERCIAL", label: "Órdenes de compra", icon: "box", slug: "/studio/ordenes-compra" },
  // Catálogo + precios
  { id: "service-catalog", group: "COMERCIAL", label: "Servicios", icon: "tag", slug: "/studio/servicios" },
  { id: "rates", group: "COMERCIAL", label: "Tarifas", labelKey: "chrome.sidebar.rates", icon: "tag", slug: "/studio/tarifas" },
  // Lealtad / formación
  { id: "fidelizacion", group: "COMERCIAL", label: "Fidelización", icon: "star", slug: "/studio/fidelizacion" },
  { id: "club", group: "COMERCIAL", label: "Club DTD", icon: "users", slug: "/studio/club" },
  { id: "academia", group: "COMERCIAL", label: "Academia · Formación", icon: "star", slug: "/studio/academia" },

  // ─── FINANZAS · dashboard → dinero diario → libros → análisis → admin ─
  { id: "direccion", group: "FINANZAS", label: "Dirección", icon: "chart", slug: "/studio/direccion", adminOnly: true },
  // Dinero diario (AR/AP/caja)
  { id: "invoices", group: "FINANZAS", label: "Facturación", labelKey: "chrome.sidebar.invoices", icon: "invoice", slug: "/studio/facturacion" },
  { id: "collections", group: "FINANZAS", label: "Cobranzas", icon: "invoice", slug: "/studio/cobranzas" },
  { id: "expenses", group: "FINANZAS", label: "Gastos", labelKey: "chrome.sidebar.expenses", icon: "calc", slug: "/studio/gastos" },
  { id: "treasury", group: "FINANZAS", label: "Tesorería", icon: "calc", slug: "/studio/tesoreria" },
  // Libros / fiscal
  { id: "accounting", group: "FINANZAS", label: "Contabilidad", icon: "calc", slug: "/studio/contabilidad" },
  { id: "fiscal", group: "FINANZAS", label: "Fiscal · SENIAT", icon: "doc", slug: "/studio/fiscal" },
  // Análisis
  { id: "costing", group: "FINANZAS", label: "Costing & Margen", labelKey: "chrome.sidebar.costing", icon: "star", slug: "/studio/costing" },
  { id: "reports", group: "FINANZAS", label: "Reportes", labelKey: "chrome.sidebar.reports", icon: "chart", slug: "/studio/reportes" },
  // Personas + admin-only (menos frecuente / sensible)
  { id: "nomina", group: "FINANZAS", label: "Nómina · RRHH", icon: "users", slug: "/studio/nomina" },
  { id: "renditions", group: "FINANZAS", label: "Rendiciones", icon: "doc", slug: "/studio/rendiciones", adminOnly: true },
  { id: "financiero-china", group: "FINANZAS", label: "Financiero China", icon: "cn", slug: "/studio/financiero-china", adminOnly: true },

  // ─── MARKETING ───────────────────────────────────────────────
  { id: "marketing", group: "MARKETING", label: "Marketing", icon: "spark", slug: "/studio/marketing" },
  { id: "noticias-web", group: "MARKETING", label: "Noticias Web", labelKey: "chrome.sidebar.noticias_web", icon: "doc", slug: "/studio/marketing/noticias-web" },

  // ─── SISTEMA · utilidades (todos) primero, config/admin al final ─
  { id: "mentions", group: "SISTEMA", label: "Menciones", icon: "bell", slug: "/studio/menciones" },
  // Documentos: hub polimórfico de todas las áreas (RBAC = todos los roles),
  // no es módulo de dinero → vive con las utilidades transversales, no en FINANZAS.
  { id: "documents", group: "SISTEMA", label: "Documentos", labelKey: "chrome.sidebar.documents", icon: "doc", slug: "/studio/documentos" },
  { id: "mis-bugs", group: "SISTEMA", label: "Mis reportes", labelKey: "chrome.sidebar.my_reports", icon: "flag", slug: "/studio/mis-bugs" },
  { id: "bugs", group: "SISTEMA", label: "Bug Tracker", labelKey: "chrome.sidebar.bugs", icon: "shield", slug: "/studio/bugs" },
  // Config / administración
  { id: "operarios", group: "SISTEMA", label: "Operarios PWA", labelKey: "chrome.sidebar.operarios_pwa", icon: "users", slug: "/studio/operarios" },
  { id: "users", group: "SISTEMA", label: "Usuarios", labelKey: "chrome.sidebar.users", icon: "shield", slug: "/studio/usuarios" },
  { id: "admin", group: "SISTEMA", label: "Administración", labelKey: "chrome.sidebar.administration", icon: "cog", slug: "/studio/admin" },
  { id: "mailing", group: "SISTEMA", label: "Mailing", labelKey: "chrome.sidebar.mailing", icon: "mail", slug: "/studio/mailing" },
  { id: "legal", group: "SISTEMA", label: "Legal · T&C", icon: "doc", slug: "/studio/legal", adminOnly: true },
  { id: "no-olvidar", group: "SISTEMA", label: "No-Olvidar", labelKey: "chrome.sidebar.no_olvidar", icon: "lock", slug: "/studio/no-olvidar" },
];

export const GROUP_ORDER: Group[] = [
  "OPERACIÓN",
  "COMERCIAL",
  "FINANZAS",
  "MARKETING",
  "SISTEMA",
];
