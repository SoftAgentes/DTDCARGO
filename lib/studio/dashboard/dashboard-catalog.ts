/**
 * Catálogo del dashboard configurable (SDD-0114 · Slice A).
 *
 * FUENTE DE VERDAD EN CÓDIGO (no en DB). Hereda el diseño del Norte v4.5
 * (`docs/design/studio/_norte/erp/modules/dashboard.jsx`) y agrega dos campos
 * que el Norte no tenía y que producción necesita:
 *
 *   · `module`  → id de módulo (SDD-0085) para FILTRAR por RBAC: si el usuario no
 *                 ve ese módulo, el KPI/widget no se le ofrece en el editor ni se
 *                 renderiza. `null` = transversal (siempre disponible).
 *   · `source`  → qué bundle de datos server-side alimenta el KPI (para fetchear
 *                 en paralelo solo lo accesible).
 *   · `status`  → 'ready' (tiene query real) | 'wip' (aún sin query → muestra "—").
 *   · `oculto`  → (SDD-0614 S0b) el KPI sigue en el catálogo pero no se ofrece,
 *                 no se pinta ni se pide su fuente. Hoy: el de leads de Kommo.
 *
 * Data PURA: sin React, sin server-only. La importa tanto el server component
 * (page.tsx) como el cliente (editor) — igual que rbac.ts.
 */

export type KpiTone = "wine" | "success" | "warning" | "danger" | "info" | "neutral";

/** De dónde sale el valor del KPI (bundle server-side). */
export type KpiSource =
  | "operational"
  // SDD-0281 · on-time y tránsito real, medidos contra `shipment_events`.
  | "desempeno"
  | "naviera"
  | "finance"
  | "quotes"
  | "clients"
  | "leads"
  | "nomina"
  | "wip";

export type KpiCatalogEntry = {
  id: string;
  label: string;
  /** Clave de `Icon` (app/studio/_components/icons.tsx). */
  icon: string;
  tone: KpiTone;
  cat: "Operación" | "Finanzas" | "Comercial" | "Nómina";
  /** Módulo RBAC (SDD-0085) o null = transversal. */
  module: string | null;
  source: KpiSource;
  status: "ready" | "wip";
  /**
   * SDD-0614 S0b (D-6.6-1): oculto del Studio sin borrarlo. Lo filtran
   * `validateDashboardConfigInput` y `accessibleCatalog`, así que tampoco se pide
   * su fuente de datos.
   */
  oculto?: true;
};

export type ChartPeriod = "1M" | "3M" | "1A" | "YTD";
export const CHART_PERIODS: readonly ChartPeriod[] = ["1M", "3M", "1A", "YTD"];

/** ~18 KPIs heredados del Norte + campos `module`/`source`/`status`. */
export const KPI_CATALOG: readonly KpiCatalogEntry[] = [
  // ─── Operación ───────────────────────────────────────────────
  { id: "shipmentsActive", label: "Embarques activos",      icon: "box",       tone: "wine",    cat: "Operación", module: "tracking", source: "operational", status: "ready" },
  { id: "onTime",          label: "On-time delivery",       icon: "check",     tone: "success", cat: "Operación", module: "tracking", source: "desempeno",   status: "ready" },
  { id: "cbmInTransit",    label: "CBM en tránsito",        icon: "ship",      tone: "neutral", cat: "Operación", module: "naviera",  source: "naviera",     status: "ready" },
  { id: "avgTransit",      label: "Tránsito promedio",      icon: "truck",     tone: "info",    cat: "Operación", module: "tracking", source: "desempeno",   status: "ready" },
  { id: "openIncidents",   label: "Incidencias abiertas",   icon: "warn",      tone: "warning", cat: "Operación", module: "tracking", source: "operational", status: "ready" },
  { id: "cnStock",         label: "Embarques en Almacén CN", icon: "warehouse", tone: "neutral", cat: "Operación", module: "naviera", source: "naviera",     status: "ready" },
  // ─── Finanzas ────────────────────────────────────────────────
  { id: "monthRevenue",    label: "Ingresos del mes",       icon: "chart",     tone: "success", cat: "Finanzas",  module: "invoices", source: "finance",     status: "ready" },
  { id: "invoicesDue",     label: "Facturas vencidas",      icon: "invoice",   tone: "warning", cat: "Finanzas",  module: "invoices", source: "finance",     status: "ready" },
  { id: "marginYTD",       label: "Margen sobre embarques", icon: "chart",     tone: "wine",    cat: "Finanzas",  module: "costing",  source: "finance",     status: "ready" },
  { id: "pendingCollect",  label: "Por cobrar",             icon: "invoice",   tone: "info",    cat: "Finanzas",  module: "invoices", source: "finance",     status: "ready" },
  // ─── Comercial ───────────────────────────────────────────────
  // SDD-0614 S0b: sale del espejo `kommo_leads`; Kommo está oculto del Studio hasta la migración completa.
  { id: "newLeads",        label: "Leads en pipeline",      icon: "spark",     tone: "info",    cat: "Comercial", module: "kommo",    source: "leads",       status: "ready", oculto: true },
  { id: "wonEstimados",    label: "Estimados aceptados (mes)", icon: "check",  tone: "success", cat: "Comercial", module: "quotes",   source: "quotes",      status: "ready" },
  { id: "activeClients",   label: "Clientes",               icon: "users",     tone: "neutral", cat: "Comercial", module: "clients",  source: "clients",     status: "ready" },
  { id: "avgTicket",       label: "Ticket promedio",        icon: "tag",       tone: "wine",    cat: "Comercial", module: "invoices", source: "finance",     status: "ready" },
  // ─── Nómina / RRHH ───────────────────────────────────────────
  { id: "nominaNeto",      label: "Neto del corte",         icon: "invoice",   tone: "success", cat: "Nómina",    module: "nomina",   source: "nomina",      status: "ready" },
  { id: "nominaPrestamos", label: "Saldo de préstamos",     icon: "tag",       tone: "warning", cat: "Nómina",    module: "nomina",   source: "nomina",      status: "ready" },
  { id: "nominaAusencias", label: "Ausencias del mes",      icon: "warn",      tone: "danger",  cat: "Nómina",    module: "nomina",   source: "nomina",      status: "ready" },
  { id: "nominaEmpleados", label: "Empleados activos",      icon: "users",     tone: "info",    cat: "Nómina",    module: "nomina",   source: "nomina",      status: "ready" },
];

export type WidgetSide = "left" | "right";
export type WidgetCatalogEntry = {
  id: string;
  label: string;
  side: WidgetSide;
  desc: string;
  /** Módulo RBAC o null = transversal. */
  module: string | null;
};

/** 8 widgets heredados del Norte. `side` es FIJO por widget (no drag entre columnas). */
export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  { id: "chart",           label: "Volumen embarcado · gráfico", side: "left",  desc: "Barras de CBM recibido por mes",            module: null },
  { id: "activeShipments", label: "Embarques en curso",          side: "left",  desc: "Tabla preview ordenada por creación",       module: "tracking" },
  { id: "alerts",          label: "Atención requerida",          side: "right", desc: "Envíos con alerta y facturas vencidas",     module: null },
  { id: "recentActivity",  label: "Actividad reciente",          side: "right", desc: "Últimos eventos de embarque",               module: null },
  { id: "quickActions",    label: "Acciones rápidas",            side: "right", desc: "Crear estimado, cliente, recepción…",       module: null },
  { id: "upcomingEta",     label: "Próximos por llegar",         side: "right", desc: "Embarques activos más recientes",           module: "tracking" },
  { id: "nominaResumen",   label: "Nómina · resumen",            side: "right", desc: "Neto del corte, préstamos y ausencias",     module: "nomina" },
];

/**
 * Config por defecto (SDD-0114 §2.3). El default EFECTIVO se filtra contra el
 * catálogo accesible (RBAC) antes de renderizar — un usuario que no ve Finanzas
 * no arranca con `monthRevenue`/`invoicesDue`.
 */
export const DEFAULT_CONFIG = {
  kpis: ["shipmentsActive", "onTime", "monthRevenue", "newLeads", "invoicesDue", "cbmInTransit"],
  widgets: ["chart", "activeShipments", "alerts", "recentActivity", "quickActions"],
  chartPeriod: "1A" as ChartPeriod,
};

/** Tope de KPIs visibles (D-3): 12 (3 filas de 4). */
export const MAX_KPIS = 12;

/** Mapa tone → token CSS para el color del valor del KpiCard. */
export const TONE_TO_VALUE_COLOR: Record<KpiTone, string> = {
  wine: "var(--wine-text)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--ink)",
};

const KPI_BY_ID = new Map(KPI_CATALOG.map((k) => [k.id, k]));
const WIDGET_BY_ID = new Map(WIDGET_CATALOG.map((w) => [w.id, w]));

export function kpiById(id: string): KpiCatalogEntry | undefined {
  return KPI_BY_ID.get(id);
}
export function widgetById(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_BY_ID.get(id);
}
