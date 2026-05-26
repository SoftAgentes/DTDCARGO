/**
 * Helper para derivar el "módulo" del bug desde el pathname actual.
 * Usado por BugFABButton para auto-detectar módulo sin pedírselo al user.
 *
 * Estrategia: mapea segmento principal de la URL a label legible.
 * Si no matchea, retorna el segmento crudo o "general".
 *
 * SDD-0036 Fase 2.
 */

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
  leads: "crm-leads",
  proveedores: "proveedores",
  tarifas: "tarifas",
  facturacion: "facturacion",
  documentos: "documentos",
  reportes: "reportes",
  costing: "costing",
  mailing: "mailing",
  vault: "vault",
  usuarios: "usuarios",
  operarios: "operarios",
  admin: "administracion",
  "mis-bugs": "bug-reporter",
  bugs: "bug-reporter",
};

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
  cotizador: "Cotizador",
  clientes: "Clientes",
  "crm-leads": "CRM · Leads",
  proveedores: "Proveedores CN",
  tarifas: "Tarifas",
  facturacion: "Facturación",
  documentos: "Documentos",
  reportes: "Reportes",
  costing: "Costing & Margen",
  mailing: "Mailing",
  vault: "Vault",
  usuarios: "Usuarios",
  operarios: "Operarios PWA",
  administracion: "Administración",
  "bug-reporter": "Bug Reporter",
  general: "General",
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

export function moduleLabelFromSlug(slug: string): string {
  return MODULE_LABELS[slug] ?? slug;
}

export function moduleLabelFromPathname(pathname: string): string {
  return moduleLabelFromSlug(moduleSlugFromPathname(pathname));
}
