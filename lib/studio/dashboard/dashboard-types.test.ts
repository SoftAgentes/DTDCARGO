import { describe, it, expect } from "vitest";
import {
  accessibleCatalog,
  defaultConfigForAccess,
  isEmptyConfig,
  validateDashboardConfigInput,
  type ModuleAccessFn,
} from "./dashboard-types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG, KPI_CATALOG, MAX_KPIS, WIDGET_CATALOG, kpiById } from "./dashboard-catalog";
import { money } from "./dashboard-kpi-queries";

/** KPIs que el Dashboard muestra: el catálogo sin los ocultos (SDD-0614 S0b). */
const KPIS_VISIBLES = KPI_CATALOG.filter((k) => !k.oculto);

/** Predicado que bloquea un set de módulos (simula un rol sin acceso). */
function denyModules(...blocked: string[]): ModuleAccessFn {
  const set = new Set(blocked);
  return (m) => (m === null ? true : !set.has(m));
}

describe("validateDashboardConfigInput", () => {
  it("descarta ids de KPI que no están en el catálogo", () => {
    const cfg = validateDashboardConfigInput({
      kpis: ["shipmentsActive", "kpi_inventado_123", "monthRevenue"],
      widgets: [],
      chartPeriod: "1A",
    });
    expect(cfg.kpis).toEqual(["shipmentsActive", "monthRevenue"]);
  });

  it("descarta widgets fuera del catálogo", () => {
    const cfg = validateDashboardConfigInput({ kpis: [], widgets: ["chart", "no_existe"], chartPeriod: "1A" });
    expect(cfg.widgets).toEqual(["chart"]);
  });

  it("descarta KPIs/widgets de módulos NO accesibles (RBAC)", () => {
    const noNomina = denyModules("nomina");
    const cfg = validateDashboardConfigInput(
      { kpis: ["shipmentsActive", "nominaNeto"], widgets: ["nominaResumen", "chart"], chartPeriod: "1A" },
      noNomina,
    );
    expect(cfg.kpis).toEqual(["shipmentsActive"]);
    expect(cfg.widgets).toEqual(["chart"]);
  });

  it("respeta el tope de MAX_KPIS", () => {
    const many = KPI_CATALOG.map((k) => k.id);
    const cfg = validateDashboardConfigInput({ kpis: many, widgets: [], chartPeriod: "1A" });
    expect(cfg.kpis.length).toBe(MAX_KPIS);
  });

  it("deduplica preservando el orden de primera aparición", () => {
    const cfg = validateDashboardConfigInput({
      kpis: ["monthRevenue", "shipmentsActive", "monthRevenue"],
      widgets: ["chart", "chart"],
      chartPeriod: "1A",
    });
    expect(cfg.kpis).toEqual(["monthRevenue", "shipmentsActive"]);
    expect(cfg.widgets).toEqual(["chart"]);
  });

  it("normaliza chartPeriod inválido al default", () => {
    expect(validateDashboardConfigInput({ kpis: [], widgets: [], chartPeriod: "5X" }).chartPeriod).toBe(
      DEFAULT_CONFIG.chartPeriod,
    );
    expect(validateDashboardConfigInput({ kpis: [], widgets: [], chartPeriod: "3M" }).chartPeriod).toBe("3M");
  });

  it("no rompe ante entrada corrupta (null / no-objeto / tipos malos)", () => {
    expect(validateDashboardConfigInput(null)).toEqual({ kpis: [], widgets: [], chartPeriod: DEFAULT_CONFIG.chartPeriod });
    expect(validateDashboardConfigInput(42)).toEqual({ kpis: [], widgets: [], chartPeriod: DEFAULT_CONFIG.chartPeriod });
    expect(validateDashboardConfigInput({ kpis: "no-array", widgets: 7, chartPeriod: {} })).toEqual({
      kpis: [],
      widgets: [],
      chartPeriod: DEFAULT_CONFIG.chartPeriod,
    });
    expect(validateDashboardConfigInput({ kpis: [1, 2, "shipmentsActive"] }).kpis).toEqual(["shipmentsActive"]);
  });

  it("solo ids viejos (fuera del catálogo) → arrays vacíos, sin romper", () => {
    const cfg = validateDashboardConfigInput({
      kpis: ["viejo1", "kpi_removido"],
      widgets: ["widget_obsoleto"],
      chartPeriod: "1A",
    });
    expect(cfg.kpis).toEqual([]);
    expect(cfg.widgets).toEqual([]);
  });

  it("ignora entradas no-string en AMBOS arrays (null, número, objeto, boolean)", () => {
    const cfg = validateDashboardConfigInput({
      kpis: ["shipmentsActive", 123, null, { x: 1 }],
      widgets: [true, "chart", 0],
      chartPeriod: "1A",
    });
    expect(cfg.kpis).toEqual(["shipmentsActive"]);
    expect(cfg.widgets).toEqual(["chart"]);
  });

  it("clave ausente degrada a [] para esa clave sin afectar a la presente", () => {
    // widgets y chartPeriod ausentes → default por clave; kpis presente se respeta.
    const cfg = validateDashboardConfigInput({ kpis: ["shipmentsActive"] });
    expect(cfg.kpis).toEqual(["shipmentsActive"]);
    expect(cfg.widgets).toEqual([]);
    expect(cfg.chartPeriod).toBe(DEFAULT_CONFIG.chartPeriod);
  });
});

describe("defaultConfigForAccess", () => {
  it("con acceso total devuelve el DEFAULT_CONFIG normalizado, sin los KPIs ocultos", () => {
    const cfg = defaultConfigForAccess();
    expect(cfg.kpis).toEqual(DEFAULT_CONFIG.kpis.filter((id) => !kpiById(id)?.oculto));
    expect(cfg.widgets).toEqual(DEFAULT_CONFIG.widgets);
    expect(cfg.chartPeriod).toBe(DEFAULT_CONFIG.chartPeriod);
  });

  it("filtra del default los KPIs de módulos no accesibles", () => {
    // monthRevenue (invoices) e invoicesDue (invoices) salen si no ve Finanzas.
    const cfg = defaultConfigForAccess(denyModules("invoices"));
    expect(cfg.kpis).not.toContain("monthRevenue");
    expect(cfg.kpis).not.toContain("invoicesDue");
    expect(cfg.kpis).toContain("shipmentsActive");
  });
});

describe("accessibleCatalog", () => {
  it("con acceso total ofrece todo el catálogo visible (sin los KPIs ocultos)", () => {
    const { kpis, widgets } = accessibleCatalog();
    expect(kpis.length).toBe(KPIS_VISIBLES.length);
    expect(widgets.length).toBe(WIDGET_CATALOG.length);
  });

  it("oculta los KPIs/widgets de nómina a quien no ve nómina", () => {
    const { kpis, widgets } = accessibleCatalog(denyModules("nomina"));
    expect(kpis.some((k) => k.module === "nomina")).toBe(false);
    expect(widgets.some((w) => w.module === "nomina")).toBe(false);
  });

  it("un rol tipo comercial (sin Finanzas ni Nómina) pierde esos KPIs pero conserva operación/comercial", () => {
    const comercial = denyModules("invoices", "costing", "nomina");
    const { kpis } = accessibleCatalog(comercial);
    const ids = kpis.map((k) => k.id);
    expect(ids).not.toContain("monthRevenue"); // invoices
    expect(ids).not.toContain("marginYTD"); // costing
    expect(ids).not.toContain("nominaNeto"); // nomina
    expect(ids).toContain("shipmentsActive"); // operación (tracking)
    expect(ids).toContain("wonEstimados"); // comercial (quotes)
    expect(ids).not.toContain("newLeads"); // comercial (kommo): oculto desde SDD-0614 S0b
  });
});

/**
 * SDD-0614 · S0b (D-6.6-1): el KPI «Leads en pipeline» salía del espejo
 * `kommo_leads` (`leadsKpi`). Se oculta desde el catálogo: no se ofrece en el
 * editor, una config guardada no lo pinta, el default no lo trae y, como la
 * página solo pide las fuentes de los KPIs accesibles, `leadsKpi` no se llama.
 * Ocultar no es borrar: la entrada sigue en el catálogo, marcada.
 */
describe("el KPI de leads de Kommo está oculto (SDD-0614 S0b)", () => {
  it("sigue en el catálogo, marcado como oculto", () => {
    const meta = kpiById("newLeads");
    expect(meta?.oculto).toBe(true);
    expect(meta?.source).toBe("leads");
    expect(meta?.module).toBe("kommo");
  });

  it("una config guardada con el KPI no lo pinta", () => {
    const cfg = validateDashboardConfigInput({
      kpis: ["shipmentsActive", "newLeads", "monthRevenue"],
      widgets: [],
      chartPeriod: "1A",
    });
    expect(cfg.kpis).toEqual(["shipmentsActive", "monthRevenue"]);
  });

  it("el default del Dashboard no lo trae", () => {
    expect(defaultConfigForAccess().kpis).not.toContain("newLeads");
  });

  it("ningún KPI accesible usa la fuente «leads», así que la página no llama a leadsKpi", () => {
    expect(accessibleCatalog().kpis.some((k) => k.source === "leads")).toBe(false);
    // La página pide `leadsKpi` solo si alguna fuente accesible es «leads».
    const pagina = readFileSync(join(process.cwd(), "app/studio/(app)/dashboard/page.tsx"), "utf8");
    expect(pagina).toContain('const needLeads = accessibleSources.has("leads");');
    expect(pagina).toContain("needLeads ? leadsKpi(supabase) : Promise.resolve(null)");
  });

  it("solo el KPI de Kommo está oculto: los demás siguen visibles", () => {
    expect(KPI_CATALOG.filter((k) => k.oculto).map((k) => k.id)).toEqual(["newLeads"]);
  });
});

describe("isEmptyConfig", () => {
  it("true solo si no hay kpis ni widgets", () => {
    expect(isEmptyConfig({ kpis: [], widgets: [], chartPeriod: "1A" })).toBe(true);
    expect(isEmptyConfig({ kpis: ["x"], widgets: [], chartPeriod: "1A" })).toBe(false);
  });
});

describe("money", () => {
  it("compacta miles y redondea chico", () => {
    expect(money(0)).toBe("$0");
    expect(money(840)).toBe("$840");
    expect(money(12345)).toBe("$12.3K");
    expect(money(-2000)).toBe("$-2.0K");
  });
});
