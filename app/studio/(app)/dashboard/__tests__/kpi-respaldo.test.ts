// @vitest-environment node
/**
 * SDD-0614 · S0b-bis: el Dashboard no abre sin KPI por culpa de un KPI oculto.
 *
 * S0b ocultó «Leads en pipeline» (`newLeads`, Kommo). Una config guardada con
 * ese KPI como único KPI y algún widget quedaba sin KPI después del filtro, y
 * como tenía widgets no caía al default (`isEmptyConfig` pide las dos cosas
 * vacías): el Dashboard abría sin ningún KPI. Decisión del Director General
 * (opción 2): si después de quitar lo oculto no queda ningún KPI, se usan los
 * KPI del default **de ese rol**, conservando los widgets y el período.
 *
 * La prueba llama a la página de verdad, con los datos simulados, y mira la
 * config que le pasa a `DashboardClient`. No escribe nada: la fila de
 * `user_dashboard_prefs` no se toca (el cliente solo autosalva cuando el
 * usuario cambia algo, `DashboardClient.tsx`).
 */
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  rol: "admin" as string,
  guardada: null as unknown,
}));

vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "usuario-prueba", email: "ana@example.test", user_metadata: {} } },
      }),
    },
    from: () => ({
      select: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: { role: estado.rol, tenants: { display_name: "DTD Cargo", base_currency: "USD" } },
          }),
      }),
    }),
  })),
}));
vi.mock("@/lib/studio/dashboard/dashboard-prefs-queries", () => ({
  getDashboardConfig: vi.fn(async () => estado.guardada),
}));
vi.mock("@/lib/studio/dashboard-queries", () => ({
  getClientCount: vi.fn(async () => null),
  getOperationalCounts: vi.fn(async () => null),
  getQuoteStatsThisMonth: vi.fn(async () => null),
  getRecentActivity: vi.fn(async () => []),
  navieraKpis: vi.fn(async () => null),
}));
vi.mock("@/lib/studio/dashboard/operational-performance", () => ({
  getDesempenoOperativo: vi.fn(async () => null),
  kpiDesempeno: vi.fn(),
}));
vi.mock("@/lib/studio/dashboard/dashboard-kpi-queries", () => ({
  financeInvoiceKpis: vi.fn(async () => null),
  marginKpi: vi.fn(async () => null),
  nominaKpis: vi.fn(async () => null),
  // El KPI de Kommo está oculto desde S0b: la página no lo pide.
  leadsKpi: vi.fn(() => {
    throw new Error("S0b-bis: la página pidió leadsKpi");
  }),
}));
vi.mock("@/lib/studio/dashboard/dashboard-widget-queries", () => ({
  getActiveShipmentsPreview: vi.fn(async () => []),
  getMonthlyVolume: vi.fn(async () => []),
}));
vi.mock("../_components/DashboardClient", () => ({ DashboardClient: () => null }));

import DashboardPage from "../page";
import { DashboardClient } from "../_components/DashboardClient";
import { canAccessModule } from "@/lib/studio/rbac";
import { defaultConfigForAccess, type DashboardConfig } from "@/lib/studio/dashboard/dashboard-types";
import type { StudioUserRole } from "@/lib/studio/user-types";

afterEach(() => {
  estado.rol = "admin";
  estado.guardada = null;
});

/** Busca en el árbol que devuelve la página el elemento `DashboardClient`. */
function buscarCliente(nodo: ReactNode): ReactElement<{ initialConfig: DashboardConfig; defaultConfig: DashboardConfig }> | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const hallado = buscarCliente(hijo);
      if (hallado) return hallado;
    }
    return null;
  }
  if (!isValidElement(nodo)) return null;
  if (nodo.type === DashboardClient) {
    return nodo as ReactElement<{ initialConfig: DashboardConfig; defaultConfig: DashboardConfig }>;
  }
  return buscarCliente((nodo.props as { children?: ReactNode }).children);
}

async function configQueAbre(rol: StudioUserRole, guardada: unknown): Promise<{ inicial: DashboardConfig; defecto: DashboardConfig }> {
  estado.rol = rol;
  estado.guardada = guardada;
  const cliente = buscarCliente(await DashboardPage());
  if (!cliente) throw new Error("la página no montó DashboardClient");
  return { inicial: cliente.props.initialConfig, defecto: cliente.props.defaultConfig };
}

const kpisDelDefault = (rol: StudioUserRole) =>
  defaultConfigForAccess((m) => (m === null ? true : canAccessModule(rol, m))).kpis;

describe("Dashboard con una config guardada que solo traía el KPI oculto (SDD-0614 S0b-bis)", () => {
  it.each(["admin", "commercial"] as const)(
    "%s: abre con los KPI del default de su rol y conserva widgets y período",
    async (rol) => {
      const esperados = kpisDelDefault(rol);
      // Piso: si el default del rol queda vacío, la prueba no puede mirar nada.
      expect(esperados.length).toBeGreaterThan(0);
      expect(esperados).not.toContain("newLeads");

      const { inicial } = await configQueAbre(rol, {
        kpis: ["newLeads"],
        widgets: ["chart", "recentActivity"],
        chartPeriod: "3M",
      });
      expect(inicial.kpis).toEqual(esperados);
      expect(inicial.widgets).toEqual(["chart", "recentActivity"]);
      expect(inicial.chartPeriod).toBe("3M");
    },
  );

  it("el default de commercial no es el de admin: cada rol recibe el suyo", () => {
    expect(kpisDelDefault("commercial")).not.toEqual(kpisDelDefault("admin"));
  });

  it("control: con otro KPI visible además del oculto, se queda con ese y no usa el respaldo", async () => {
    const { inicial } = await configQueAbre("admin", {
      kpis: ["newLeads", "activeClients"],
      widgets: ["chart"],
      chartPeriod: "1A",
    });
    expect(inicial.kpis).toEqual(["activeClients"]);
  });

  it("control: quien guardó cero KPI a propósito sigue con cero (el respaldo es solo por lo oculto)", async () => {
    const { inicial } = await configQueAbre("admin", { kpis: [], widgets: ["chart"], chartPeriod: "1A" });
    expect(inicial.kpis).toEqual([]);
    expect(inicial.widgets).toEqual(["chart"]);
  });

  it("control: sin config guardada, el default del rol, como antes", async () => {
    const { inicial, defecto } = await configQueAbre("commercial", null);
    expect(inicial).toEqual(defecto);
    expect(inicial.kpis).toEqual(kpisDelDefault("commercial"));
  });
});
