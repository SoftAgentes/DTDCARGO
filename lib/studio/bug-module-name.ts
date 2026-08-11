/**
 * Helper para derivar el "módulo" del bug desde el pathname actual.
 * Usado por BugFABButton para auto-detectar módulo sin pedírselo al user.
 *
 * Estrategia: mapea segmento principal de la URL a label legible.
 * Si no matchea, retorna el segmento crudo o "general".
 *
 * i18n (SDD-0038): `moduleLabelFromSlug(slug, locale?)` acepta locale y
 * reusa las keys del sidebar (`chrome.sidebar.*`) para devolver el label
 * traducido. Sin locale, cae al label es-VE legacy (`MODULE_LABELS`).
 *
 * SDD-0036 Fase 2.
 */

import { t, type I18nKey, type Locale } from "@/lib/i18n";

const MODULE_MAP: Record<string, string> = {
  dashboard: "dashboard",
  embarques: "embarques",
  tracking: "tracking",
  calendario: "calendario",
  cn: "almacen-cn",
  ve: "almacen-ve",
  "cola-qr": "cola-qr",
  etiquetas: "etiquetas-cn",
  seniat: "aduana-seniat",
  tms: "tms",
  despacho: "despacho",
  cotizador: "cotizador",
  clientes: "clientes",
  crm: "crm",
  proveedores: "proveedores",
  tarifas: "tarifas",
  facturacion: "facturacion",
  documentos: "documentos",
  reportes: "reportes",
  costing: "costing",
  mailing: "mailing",
  "no-olvidar": "no-olvidar",
  usuarios: "usuarios",
  operarios: "operarios",
  admin: "administracion",
  "mis-bugs": "bug-reporter",
  bugs: "bug-reporter",
};

/**
 * @deprecated Pasá `locale` a `moduleLabelFromSlug` para texto traducido.
 * Este record es solo es-VE (fallback cuando no hay locale).
 */
const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  embarques: "Embarques",
  tracking: "Tracking",
  calendario: "Calendario",
  "almacen-cn": "Almacén CN",
  "almacen-ve": "Almacén VE",
  "cola-qr": "Cola de QR",
  "etiquetas-cn": "Etiquetas CN",
  "aduana-seniat": "Aduana SENIAT",
  tms: "TMS · Transporte",
  despacho: "Despacho",
  cotizador: "Estimados",
  clientes: "Clientes",
  crm: "CRM",
  proveedores: "PreAlertas de servicios",
  tarifas: "Tarifas",
  facturacion: "Facturación",
  documentos: "Documentos",
  reportes: "Reportes",
  costing: "Costing & Margen",
  mailing: "Mailing",
  "no-olvidar": "No-Olvidar",
  usuarios: "Usuarios",
  operarios: "Operarios PWA",
  administracion: "Administración",
  "bug-reporter": "Bug Reporter",
  general: "General",
};

/**
 * module-slug → I18nKey. Reusa las keys del sidebar (mismos módulos) +
 * fallbacks de `chrome.module.*`. Si un slug no está acá, el helper cae
 * al MODULE_LABELS es-VE o al slug crudo.
 */
const MODULE_LABEL_KEYS: Record<string, I18nKey> = {
  dashboard: "chrome.sidebar.dashboard",
  embarques: "chrome.sidebar.shipments",
  tracking: "chrome.sidebar.tracking",
  calendario: "chrome.sidebar.calendar",
  "almacen-cn": "chrome.sidebar.warehouse_cn",
  "almacen-ve": "chrome.sidebar.warehouse_ve",
  "cola-qr": "chrome.sidebar.qr_queue",
  "etiquetas-cn": "chrome.sidebar.labels_cn",
  "aduana-seniat": "chrome.sidebar.customs_seniat",
  tms: "chrome.sidebar.tms",
  despacho: "chrome.sidebar.dispatch",
  cotizador: "chrome.sidebar.quotes",
  clientes: "chrome.sidebar.clients",
  crm: "chrome.sidebar.crm",
  proveedores: "chrome.sidebar.suppliers_cn",
  tarifas: "chrome.sidebar.rates",
  facturacion: "chrome.sidebar.invoices",
  documentos: "chrome.sidebar.documents",
  reportes: "chrome.sidebar.reports",
  costing: "chrome.sidebar.costing",
  mailing: "chrome.sidebar.mailing",
  "no-olvidar": "chrome.sidebar.no_olvidar",
  usuarios: "chrome.sidebar.users",
  operarios: "chrome.sidebar.operarios_pwa",
  administracion: "chrome.sidebar.administration",
  "bug-reporter": "chrome.sidebar.bugs",
  general: "chrome.module.general",
};

/**
 * Pathname → module slug (estable, usado en duplicate_hash + filtros).
 *
 * /studio/clientes        → "clientes"
 * /studio/clientes/DTD-12 → "clientes"
 * /studio/cn/page         → "almacen-cn"
 * /                       → "general"
 */
export function moduleSlugFromPathname(pathname: string): string {
  if (!pathname || pathname === "/" || pathname === "/studio") return "general";
  // Remove leading /studio/ if present
  const trimmed = pathname.replace(/^\/studio\//, "").replace(/^\//, "");
  const first = trimmed.split("/")[0];
  if (!first) return "general";
  return MODULE_MAP[first] ?? first;
}

/**
 * module-slug → label legible. Con `locale`, devuelve el traducido vía
 * catálogo i18n (reusa keys del sidebar). Sin `locale`, cae al es-VE
 * legacy (compat con callers viejos / server sin contexto).
 */
export function moduleLabelFromSlug(slug: string, locale?: Locale): string {
  if (locale) {
    const key = MODULE_LABEL_KEYS[slug];
    if (key) return t(locale, key);
  }
  return MODULE_LABELS[slug] ?? slug;
}

export function moduleLabelFromPathname(
  pathname: string,
  locale?: Locale,
): string {
  return moduleLabelFromSlug(moduleSlugFromPathname(pathname), locale);
}
