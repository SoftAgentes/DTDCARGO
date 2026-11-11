/**
 * SDD-0614 · S0 (D-6.6-1): Kommo no se ve en el CRM del Studio.
 *
 * Sam (2026-11-06): «no lo quiero ver por ahora … déjalo externo hasta que
 * hagamos la migración al 100%». La barra deja de mostrar Dirección, Tablero,
 * Asesor y Recuperación; cada `?tab=` viejo abre la pestaña por defecto, que
 * mientras no exista Resumen (S3) es **Embudos**. La página no lee el espejo
 * `kommo_*` para pintarla: cada lectura de Kommo está cambiada aquí por una que
 * lanza, así que si la página la llama, la prueba se pone roja.
 *
 * Ocultar no es borrar (§2.1): el código de las pestañas de Kommo y sus
 * acciones sigue en el repo hasta 8.7, con su OK aparte. El último bloque lo
 * fija para que nadie lo «limpie» dentro de S0.
 */
import type { ReactElement } from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Cada lectura de Kommo que la página podría llamar, cambiada por una que lanza. */
const { prohibidas, prohibir } = vi.hoisted(() => {
  const prohibidas = new Map<string, ReturnType<typeof vi.fn>>();
  const prohibir = (nombre: string) => {
    const fn = vi.fn(() => {
      throw new Error(`S0: la página del CRM leyó Kommo (${nombre})`);
    });
    prohibidas.set(nombre, fn);
    return fn;
  };
  return { prohibidas, prohibir };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => {
      throw new Error("S0: la página del CRM consultó una tabla");
    },
    rpc: () => {
      throw new Error("S0: la página del CRM llamó una RPC");
    },
  })),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: vi.fn(async () => undefined),
  moduleEditDenial: vi.fn(async () => null),
}));
vi.mock("@/lib/studio/kommo-analytics", async (original) => ({
  ...(await original<typeof import("@/lib/studio/kommo-analytics")>()),
  getKommoAnalytics: prohibir("getKommoAnalytics"),
}));
vi.mock("@/lib/studio/kommo-queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/kommo-queries")>()),
  getKommoOverview: prohibir("getKommoOverview"),
  getKommoStatusCounts: prohibir("getKommoStatusCounts"),
  getLeadContactInfo: prohibir("getLeadContactInfo"),
  listKommoBoardLeads: prohibir("listKommoBoardLeads"),
  listKommoContactCustomFields: prohibir("listKommoContactCustomFields"),
  listKommoLeadCustomFields: prohibir("listKommoLeadCustomFields"),
  listKommoLeads: prohibir("listKommoLeads"),
  listKommoPipelines: prohibir("listKommoPipelines"),
  listKommoStatuses: prohibir("listKommoStatuses"),
}));
vi.mock("@/lib/studio/kommo-writeback", async (original) => ({
  ...(await original<typeof import("@/lib/studio/kommo-writeback")>()),
  getKommoMarkboxContactFieldId: prohibir("getKommoMarkboxContactFieldId"),
  getKommoMarkboxFieldId: prohibir("getKommoMarkboxFieldId"),
  getKommoStageMap: prohibir("getKommoStageMap"),
  getWritebackStatus: prohibir("getWritebackStatus"),
  getPendingOpsByLead: prohibir("getPendingOpsByLead"),
  getPendingOpsForBoard: prohibir("getPendingOpsForBoard"),
  getStaleOpsByLead: prohibir("getStaleOpsByLead"),
  getStaleOpsForBoard: prohibir("getStaleOpsForBoard"),
}));
vi.mock("@/lib/studio/kommo-recovery", async (original) => ({
  ...(await original<typeof import("@/lib/studio/kommo-recovery")>()),
  getRecoveryUniverse: prohibir("getRecoveryUniverse"),
}));
// Las vistas de Kommo y Embudos se cambian por dobles: aquí se mira qué monta la
// página, no cómo pinta cada vista (cada una tiene sus pruebas).
vi.mock("../_components/DireccionTab", async () => {
  const { createElement: h } = await import("react");
  return { DireccionTab: () => h("div", null, "vista Dirección de Kommo") };
});
vi.mock("../_components/KommoBoardView", async () => {
  const { createElement: h } = await import("react");
  return { KommoBoardView: () => h("div", null, "vista Tablero de Kommo") };
});
vi.mock("../_components/RecoveryTab", async () => {
  const { createElement: h } = await import("react");
  return { RecoveryTab: () => h("div", null, "vista Recuperación de Kommo") };
});
vi.mock("../_components/CrmEmbudosSlot", async () => {
  const { createElement: h } = await import("react");
  return {
    CrmEmbudosCargando: () => null,
    CrmEmbudosSlot: ({ tableroInicial }: { tableroInicial: string }) =>
      h("div", { "data-testid": "embudos" }, `tablero propio: ${tableroInicial}`),
  };
});
vi.mock("../_components/ConvertLeadDrawer", () => ({ ConvertLeadDrawer: () => null }));
vi.mock("../_components/LeadActionsButton", () => ({ LeadActionsButton: () => null }));
vi.mock("../_components/StageControl", () => ({ StageControl: () => null }));

import KommoPage from "../page";
import { KOMMO_TABS, resolveKommoTab } from "../_components/kommo-tabs.shared";

afterEach(() => {
  cleanup();
  for (const fn of prohibidas.values()) fn.mockClear();
});

const PESTANAS_KOMMO = ["direccion", "tablero", "asesor", "recuperacion"] as const;

/** Sin `?tab=`, cada pestaña oculta y la propia. */
const CASOS_DE_URL: ReadonlyArray<Record<string, string>> = [
  {},
  ...PESTANAS_KOMMO.map((tab) => ({ tab })),
  { tab: "embudos" },
];

async function abrir(searchParams: Record<string, string>): Promise<ReactElement> {
  return (await KommoPage({ searchParams: Promise.resolve(searchParams) })) as ReactElement;
}

describe("la barra del CRM no muestra pestañas de Kommo (SDD-0614 S0)", () => {
  it("la única pestaña visible es Embudos", () => {
    expect(KOMMO_TABS.map((t) => t.label)).toEqual(["Embudos"]);
  });

  it.each([...PESTANAS_KOMMO, "embudos", "otra", "", undefined])(
    "?tab=%j abre Embudos",
    (raw) => {
      expect(resolveKommoTab(raw)).toBe("embudos");
    },
  );
});

describe("la página del CRM no lee Kommo (SDD-0614 S0)", () => {
  it.each(CASOS_DE_URL)(
    "con %j pinta Embudos y no llama ninguna lectura de Kommo",
    async (params) => {
      const pagina = await abrir(params);
      for (const [nombre, fn] of prohibidas) {
        expect(fn, nombre).not.toHaveBeenCalled();
      }

      render(pagina);
      const pestanas = screen.getAllByRole("tab");
      expect(pestanas.map((b) => b.textContent)).toEqual(["Embudos"]);
      expect(pestanas[0]).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("embudos")).toHaveTextContent("tablero propio: leads");
      expect(document.body.textContent).not.toMatch(/de Kommo/);
    },
  );

  it("?embudo=clientes sigue abriendo el tablero de Clientes", async () => {
    render(await abrir({ embudo: "clientes" }));
    expect(screen.getByTestId("embudos")).toHaveTextContent("tablero propio: clientes");
  });
});

describe("el encabezado del CRM no habla de Kommo (SDD-0614 S0)", () => {
  it("sin estado de conexión ni último sync del espejo", async () => {
    render(await abrir({}));
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/Último sync/);
    expect(texto).not.toMatch(/Conectado|Sin conexión|Error de sync|Desactivado/);
  });

  it("no nombra las pestañas ocultas ni la sincronización diaria", async () => {
    render(await abrir({}));
    const texto = document.body.textContent ?? "";
    expect(texto).not.toMatch(/Dirección|Asesor|Recuperación/);
    expect(texto).not.toMatch(/sincroniza/);
    expect(texto).toContain("En Embudos, lo que mueves o guardas queda en Studio.");
  });
});

describe("ocultar no es borrar (SDD-0614 §2.1): el código de Kommo sigue en el repo", () => {
  const DIR = "app/studio/(app)/crm";
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it.each([
    `${DIR}/_components/DireccionTab.tsx`,
    `${DIR}/_components/KommoBoardView.tsx`,
    `${DIR}/_components/RecoveryTab.tsx`,
    `${DIR}/_components/ConvertLeadDrawer.tsx`,
    `${DIR}/_components/StageMapConfig.tsx`,
    `${DIR}/_components/MarkboxFieldConfig.tsx`,
    "lib/studio/kommo-recovery.ts",
    "lib/studio/kommo-analytics.ts",
  ])("%s sigue existiendo", (path) => {
    expect(existsSync(join(process.cwd(), path))).toBe(true);
  });

  it("las acciones de Kommo del CRM siguen exportadas", () => {
    const actions = read(`${DIR}/actions.ts`);
    for (const fn of [
      "convertLeadToClientAction",
      "exportRecoverySmsCsvAction",
      "saveKommoStageMapAction",
      "saveKommoMarkboxFieldAction",
    ]) {
      expect(actions).toContain(`export async function ${fn}(`);
    }
  });

  it("la lista de pestañas de Kommo se conserva, oculta, en el resolver", () => {
    const shared = read(`${DIR}/_components/kommo-tabs.shared.ts`);
    for (const key of PESTANAS_KOMMO) expect(shared).toContain(`"${key}"`);
  });
});
