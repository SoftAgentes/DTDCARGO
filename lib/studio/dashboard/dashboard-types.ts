/**
 * Tipos + validación del dashboard configurable (SDD-0114 · Slice A).
 *
 * La forma del `config` jsonb se valida ACÁ (convención del Studio: validación
 * manual en la action, NO Zod). `validateDashboardConfigInput` es defensiva:
 *   · descarta ids que NO estén en el catálogo (basura / catálogo viejo);
 *   · descarta ids de módulos a los que el usuario no tiene acceso (RBAC);
 *   · descarta los KPIs marcados `oculto` en el catálogo (SDD-0614 S0b);
 *   · deduplica preservando el orden (el orden de `kpis` ES el orden de render);
 *   · limita `kpis` a MAX_KPIS;
 *   · normaliza `chartPeriod` a uno de los 4 valores (default '1A').
 *
 * Todo PURO → testeable sin DB ni React. El gate RBAC entra como PREDICADO
 * (`canAccess`) para no acoplar la validación a rbac.ts (se inyecta desde el
 * caller con `canAccessModule(role, …)`).
 */

import {
  CHART_PERIODS,
  DEFAULT_CONFIG,
  KPI_CATALOG,
  MAX_KPIS,
  WIDGET_CATALOG,
  kpiById,
  widgetById,
  type ChartPeriod,
  type KpiCatalogEntry,
  type WidgetCatalogEntry,
} from "./dashboard-catalog";

export type DashboardConfig = {
  kpis: string[];
  widgets: string[];
  chartPeriod: ChartPeriod;
};

/** Predicado RBAC: ¿el usuario ve este módulo? `null` (transversal) = siempre sí. */
export type ModuleAccessFn = (moduleId: string | null) => boolean;

/** Un predicado que permite TODO (para tests / usuarios admin). */
export const ALLOW_ALL: ModuleAccessFn = () => true;

function isChartPeriod(v: unknown): v is ChartPeriod {
  return typeof v === "string" && (CHART_PERIODS as readonly string[]).includes(v);
}

/** Deduplica preservando el orden de primera aparición. */
function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Normaliza cualquier entrada (jsonb de DB, FormData, LS) a un DashboardConfig
 * válido y filtrado por RBAC. NUNCA lanza: entrada corrupta → cae al default por
 * clave (los ids inválidos se descartan, no rompen el render).
 */
export function validateDashboardConfigInput(
  raw: unknown,
  canAccess: ModuleAccessFn = ALLOW_ALL,
): DashboardConfig {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const kpis = dedupe(asStringArray(obj.kpis))
    .filter((id) => {
      const meta = kpiById(id);
      return !!meta && !meta.oculto && canAccess(meta.module);
    })
    .slice(0, MAX_KPIS);

  const widgets = dedupe(asStringArray(obj.widgets)).filter((id) => {
    const meta = widgetById(id);
    return !!meta && canAccess(meta.module);
  });

  const chartPeriod: ChartPeriod = isChartPeriod(obj.chartPeriod)
    ? obj.chartPeriod
    : DEFAULT_CONFIG.chartPeriod;

  return { kpis, widgets, chartPeriod };
}

/** DEFAULT_CONFIG filtrado por RBAC (para usuarios sin fila / reset). */
export function defaultConfigForAccess(canAccess: ModuleAccessFn = ALLOW_ALL): DashboardConfig {
  return validateDashboardConfigInput(DEFAULT_CONFIG, canAccess);
}

/**
 * ¿La config leída de DB está vacía (o toda descartada por RBAC)? En ese caso el
 * caller usa el default filtrado — así un usuario nuevo ve algo sensato.
 */
export function isEmptyConfig(cfg: DashboardConfig): boolean {
  return cfg.kpis.length === 0 && cfg.widgets.length === 0;
}

/** Catálogo accesible (para poblar el editor sin ofrecer lo que el user no ve). */
export function accessibleCatalog(canAccess: ModuleAccessFn = ALLOW_ALL): {
  kpis: KpiCatalogEntry[];
  widgets: WidgetCatalogEntry[];
} {
  return {
    // SDD-0614 S0b: un KPI oculto no se ofrece en el editor ni se pide su fuente.
    kpis: KPI_CATALOG.filter((k) => !k.oculto && canAccess(k.module)),
    widgets: WIDGET_CATALOG.filter((w) => canAccess(w.module)),
  };
}
