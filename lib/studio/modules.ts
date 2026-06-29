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
}

/** Group label → I18nKey para localización en sidebar headers. */
export const GROUP_LABEL_KEYS: Record<Group, I18nKey> = {
  "OPERACIÓN": "chrome.sidebar.group.operation",
  "COMERCIAL": "chrome.sidebar.group.commercial",
  "FINANZAS": "chrome.sidebar.group.finance",
  "MARKETING": "chrome.sidebar.group.marketing",
  "SISTEMA": "chrome.sidebar.group.system",
};

export const MODULES: ModuleDef[] = [
  // OPERACIÓN
  { id: "dashboard", group: "OPERACIÓN", label: "Dashboard", labelKey: "chrome.sidebar.dashboard", icon: "dashboard", slug: "/studio/dashboard" },
  { id: "shipments", group: "OPERACIÓN", label: "Embarques", labelKey: "chrome.sidebar.shipments", icon: "box", slug: "/studio/embarques" },
  { id: "tracking", group: "OPERACIÓN", label: "Tracking", labelKey: "chrome.sidebar.tracking", icon: "radar", slug: "/studio/tracking" },
  { id: "calendar", group: "OPERACIÓN", label: "Calendario", labelKey: "chrome.sidebar.calendar", icon: "clock", slug: "/studio/calendario" },
  { id: "cn", group: "OPERACIÓN", label: "Almacén CN", labelKey: "chrome.sidebar.warehouse_cn", icon: "warehouse", slug: "/studio/cn" },
  { id: "qrqueue", group: "OPERACIÓN", label: "Cola de QR", labelKey: "chrome.sidebar.qr_queue", icon: "tag", slug: "/studio/cola-qr" },
  { id: "labels", group: "OPERACIÓN", label: "Etiquetas CN", labelKey: "chrome.sidebar.labels_cn", icon: "tag", slug: "/studio/etiquetas" },
  { id: "ve", group: "OPERACIÓN", label: "Almacén VE", labelKey: "chrome.sidebar.warehouse_ve", icon: "warehouse", slug: "/studio/ve" },
  { id: "inventory", group: "OPERACIÓN", label: "Inventario · WMS", icon: "warehouse", slug: "/studio/inventario" },
  { id: "naviera", group: "OPERACIÓN", label: "Naviera & Consolidación", icon: "ship", slug: "/studio/naviera" },
  { id: "seniat", group: "OPERACIÓN", label: "Aduana SENIAT", labelKey: "chrome.sidebar.customs_seniat", icon: "shield", slug: "/studio/seniat" },
  { id: "tms", group: "OPERACIÓN", label: "TMS · Transporte", labelKey: "chrome.sidebar.tms", icon: "truck", slug: "/studio/tms" },
  { id: "despacho", group: "OPERACIÓN", label: "Despacho", labelKey: "chrome.sidebar.dispatch", icon: "truck", slug: "/studio/despacho" },
  { id: "despacho-rules", group: "OPERACIÓN", label: "Reglas despacho", labelKey: "chrome.sidebar.dispatch_rules", icon: "shield", slug: "/studio/despacho/reglas" },
  { id: "despacho-dashboard", group: "OPERACIÓN", label: "Dashboard despacho", labelKey: "chrome.sidebar.dispatch_dashboard", icon: "chart", slug: "/studio/despacho/dashboard" },
  { id: "admin-rutas", group: "OPERACIÓN", label: "Rutas y ciudades", labelKey: "chrome.sidebar.routes_cities", icon: "radar", slug: "/studio/admin/rutas" },
  { id: "reclamos", group: "OPERACIÓN", label: "Reclamos", icon: "shield", slug: "/studio/reclamos" },
  { id: "inspecciones", group: "OPERACIÓN", label: "Inspecciones", icon: "check", slug: "/studio/inspecciones" },

  // COMERCIAL
  { id: "quotes", group: "COMERCIAL", label: "Estimados", labelKey: "chrome.sidebar.quotes", icon: "calc", slug: "/studio/cotizador" },
  { id: "clients", group: "COMERCIAL", label: "Clientes", labelKey: "chrome.sidebar.clients", icon: "users", slug: "/studio/clientes" },
  { id: "conversaciones", group: "COMERCIAL", label: "Conversaciones", icon: "mail", slug: "/studio/conversaciones" },
  { id: "leads", group: "COMERCIAL", label: "CRM · Leads", labelKey: "chrome.sidebar.leads", icon: "spark", slug: "/studio/leads" },
  { id: "kommo", group: "COMERCIAL", label: "Kommo CRM", icon: "radar", slug: "/studio/kommo" },
  { id: "suppliers", group: "COMERCIAL", label: "Proveedores CN", labelKey: "chrome.sidebar.suppliers_cn", icon: "cn", slug: "/studio/proveedores" },
  { id: "purchase-orders", group: "COMERCIAL", label: "Órdenes de compra", icon: "box", slug: "/studio/ordenes-compra" },
  { id: "sales-orders", group: "COMERCIAL", label: "Órdenes de venta", icon: "invoice", slug: "/studio/ordenes-venta" },
  { id: "service-catalog", group: "COMERCIAL", label: "Servicios", icon: "tag", slug: "/studio/servicios" },
  { id: "rates", group: "COMERCIAL", label: "Tarifas", labelKey: "chrome.sidebar.rates", icon: "tag", slug: "/studio/tarifas" },
  { id: "fidelizacion", group: "COMERCIAL", label: "Fidelización", icon: "star", slug: "/studio/fidelizacion" },
  { id: "academia", group: "COMERCIAL", label: "Academia · Formación", icon: "star", slug: "/studio/academia" },
  { id: "club", group: "COMERCIAL", label: "Club DTD", icon: "users", slug: "/studio/club" },

  // FINANZAS
  { id: "direccion", group: "FINANZAS", label: "Dirección", icon: "chart", slug: "/studio/direccion", adminOnly: true },
  { id: "expenses", group: "FINANZAS", label: "Gastos", labelKey: "chrome.sidebar.expenses", icon: "calc", slug: "/studio/gastos" },
  { id: "invoices", group: "FINANZAS", label: "Facturación", labelKey: "chrome.sidebar.invoices", icon: "invoice", slug: "/studio/facturacion" },
  { id: "accounting", group: "FINANZAS", label: "Contabilidad", icon: "calc", slug: "/studio/contabilidad" },
  { id: "collections", group: "FINANZAS", label: "Cobranzas", icon: "invoice", slug: "/studio/cobranzas" },
  { id: "renditions", group: "FINANZAS", label: "Rendiciones", icon: "doc", slug: "/studio/rendiciones", adminOnly: true },
  { id: "treasury", group: "FINANZAS", label: "Tesorería", icon: "calc", slug: "/studio/tesoreria" },
  { id: "fiscal", group: "FINANZAS", label: "Fiscal · SENIAT", icon: "doc", slug: "/studio/fiscal" },
  { id: "financiero-china", group: "FINANZAS", label: "Financiero China", icon: "cn", slug: "/studio/financiero-china", adminOnly: true },
  { id: "documents", group: "FINANZAS", label: "Documentos", labelKey: "chrome.sidebar.documents", icon: "doc", slug: "/studio/documentos" },
  { id: "reports", group: "FINANZAS", label: "Reportes", labelKey: "chrome.sidebar.reports", icon: "chart", slug: "/studio/reportes" },
  { id: "costing", group: "FINANZAS", label: "Costing & Margen", labelKey: "chrome.sidebar.costing", icon: "star", slug: "/studio/costing" },
  { id: "nomina", group: "FINANZAS", label: "Nómina · RRHH", icon: "users", slug: "/studio/nomina" },

  // MARKETING
  { id: "noticias-web", group: "MARKETING", label: "Noticias Web", labelKey: "chrome.sidebar.noticias_web", icon: "doc", slug: "/studio/marketing/noticias-web" },

  // SISTEMA
  { id: "mentions", group: "SISTEMA", label: "Menciones", icon: "bell", slug: "/studio/menciones" },
  { id: "mailing", group: "SISTEMA", label: "Mailing", labelKey: "chrome.sidebar.mailing", icon: "mail", slug: "/studio/mailing" },
  { id: "no-olvidar", group: "SISTEMA", label: "No-Olvidar", labelKey: "chrome.sidebar.no_olvidar", icon: "lock", slug: "/studio/no-olvidar" },
  { id: "legal", group: "SISTEMA", label: "Legal · T&C", icon: "doc", slug: "/studio/legal", adminOnly: true },
  { id: "users", group: "SISTEMA", label: "Usuarios", labelKey: "chrome.sidebar.users", icon: "shield", slug: "/studio/usuarios" },
  { id: "operarios", group: "SISTEMA", label: "Operarios PWA", labelKey: "chrome.sidebar.operarios_pwa", icon: "users", slug: "/studio/operarios" },
  { id: "bugs", group: "SISTEMA", label: "Bug Tracker", labelKey: "chrome.sidebar.bugs", icon: "shield", slug: "/studio/bugs" },
  { id: "mis-bugs", group: "SISTEMA", label: "Mis reportes", labelKey: "chrome.sidebar.my_reports", icon: "flag", slug: "/studio/mis-bugs" },
  { id: "admin", group: "SISTEMA", label: "Administración", labelKey: "chrome.sidebar.administration", icon: "cog", slug: "/studio/admin" },
];

export const GROUP_ORDER: Group[] = [
  "OPERACIÓN",
  "COMERCIAL",
  "FINANZAS",
  "MARKETING",
  "SISTEMA",
];
