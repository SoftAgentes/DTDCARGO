import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanup, render, screen, within } from "@testing-library/react";
import { BILLING_UNAVAILABLE, type AnnualBillingRead } from "@/lib/shared/annual-billing";
const io = vi.hoisted(() => ({ analytics: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ requireModuleView: async () => "commercial", moduleEditDenial: async () => "solo lectura" }));
// El bloque DTO fija el transporte; el bloque integrado ejecuta el lector real.
vi.mock("@/lib/studio/kommo-analytics", () => ({ getKommoAnalytics: io.analytics }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => vi.fn() }));
vi.mock("../_components/ConvertLeadDrawer", () => ({ ConvertLeadDrawer: () => null }));
vi.mock("../_components/StageControl", () => ({ StageControl: () => null }));
vi.mock("../_components/LeadActionsButton", () => ({ LeadActionsButton: () => null }));
vi.mock("@/lib/studio/kommo-writeback", () => ({
  getPendingOpsByLead: async () => ({}), getPendingOpsForBoard: async () => ({}),
  getStaleOpsByLead: async () => ({}), getStaleOpsForBoard: async () => ({}),
}));
vi.mock("@/lib/studio/kommo-queries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/studio/kommo-queries")>(),
  getKommoOverview: async () => ({ leads: 1, contacts: 0, lastSyncAt: null, connStatus: "active", subdomain: null }),
  listKommoPipelines: async () => [{ id: 1, name: "Ficticio", is_main: true, sort: 0 }],
  listKommoStatuses: async () => [{ id: 142, pipeline_id: 1, name: "Ganado", color: null, sort: 1, type: 0 }],
  listKommoUsers: async () => [],
  listKommoLeads: async () => [{ id: 1, name: "Lead sintético", status_id: 142, pipeline_id: 1, price: 9876 }],
  listKommoBoardLeads: async () => [{ id: 1, name: "Lead sintético", status_id: 142, pipeline_id: 1, price: 9876 }],
  getKommoStatusCounts: async () => ({ 142: 1 }), getLeadContactInfo: async () => ({}),
  parseKommoFiltersFromSearchParams: () => ({}),
}));
// SDD-0614 S0 oculta las pestañas de Kommo: el resolver real ya no las devuelve
// y la página vuelve antes de leer el espejo. El camino de lectura de Kommo se
// conserva en page.tsx hasta 8.7; esta prueba lo sigue ejercitando dejando pasar
// la pestaña pedida. El ocultamiento se prueba en su propio archivo.
vi.mock("../_components/kommo-tabs.shared", async (importOriginal) => {
  const real = await importOriginal<typeof import("../_components/kommo-tabs.shared")>();
  return { ...real, resolveKommoTab: (raw: string | undefined | null) => (real.isKommoTab(raw) ? raw : real.resolveKommoTab(raw)) };
});
vi.mock("../_components/DireccionTab", () => ({ DireccionTab: () => null }));
vi.mock("../_components/RecoveryTab", () => ({ RecoveryTab: () => null }));
import Page from "../page";
type BillingProps = { valueByLead: Record<number, AnnualBillingRead>; billingAvailable: boolean; convertedAvailable: boolean; convertedLeads: Record<number, string>; tablero: ReactElement<BillingProps> };
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
describe("0572-b · CRM conserva DTO en frontera servidor", () => {
  it.each<AnnualBillingRead>([
    { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
    { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
    { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
    { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
    BILLING_UNAVAILABLE,
  ])("asesor/tablero conservan $state sin filtro numérico", async (billing) => {
    const available = billing.state !== "no_disponible";
    io.analytics.mockResolvedValue({ ownership: { owners: [] }, convertedMarkboxByLead: { 1: "A", 2: "B" }, valueByLead: { 1: billing, 2: billing }, billingAvailable: available, convertedAvailable: true });
    const asesor = await Page({ searchParams: Promise.resolve({ tab: "asesor" }) }) as ReactElement<BillingProps>;
    expect(asesor.props.valueByLead).toEqual({ 1: billing });
    expect(asesor.props.convertedLeads).toEqual({ 1: "A" });
    expect(asesor.props.billingAvailable).toBe(available);
    expect(asesor.props.convertedAvailable).toBe(true);
    expect(JSON.parse(JSON.stringify(asesor.props.valueByLead))).toEqual({ 1: billing });
    const board = await Page({ searchParams: Promise.resolve({ tab: "tablero" }) }) as ReactElement<BillingProps>;
    expect(board.props.tablero.props.valueByLead[1]).toEqual(billing);
    expect(board.props.tablero.props.billingAvailable).toBe(available);
    expect(board.props.tablero.props.convertedAvailable).toBe(true);
  });
});

function analyticsSession(converted: "no" | "yes" | "error", annualError: boolean): SupabaseClient {
  return {
    from(table: string) {
      const rows = table === "kommo_leads" ? [{ id: 1, status_id: 142, pipeline_id: 1, price: 9876 }]
        : table === "clients" && converted === "yes" ? [{ kommo_lead_id: 1, markbox: "A" }] : [];
      const q = {
        select: () => q, order: () => q, not: () => q, is: () => q,
        range: (from: number, to: number) => Promise.resolve(table === "clients" && converted === "error"
          ? { data: null, error: { message: "cruce sintético fallido" } }
          : { data: rows.slice(from, to + 1), error: null }),
      };
      return q;
    },
    rpc(name: string, args: { p_as_of: string }) {
      expect(name).toBe("studio_client_annual_billing_v2");
      expect(args).toEqual({ p_as_of: "2026-10-20" });
      const q = { order: () => q, range: () => Promise.resolve(annualError
        ? { data: null, error: { message: "RPC anual sintética fallida" } }
        : { data: [], error: null }) };
      return q;
    },
  } as unknown as SupabaseClient;
}

describe.each(["asesor", "tablero"])("0572-b · lector real → RSC → %s", (tab) => {
  it.each([
    { converted: "no", annualError: true, nominal: true },
    { converted: "yes", annualError: true, nominal: false },
    { converted: "error", annualError: false, nominal: false },
  ] as const)("cruce $converted / error anual $annualError conserva identidad", async ({ converted, annualError, nominal }) => {
    const actual = await vi.importActual<typeof import("@/lib/studio/kommo-analytics")>("@/lib/studio/kommo-analytics");
    io.analytics.mockImplementation(() => actual.getKommoAnalytics(analyticsSession(converted, annualError), new Date("2026-10-20T12:00:00Z")));
    render(await Page({ searchParams: Promise.resolve({ tab }) }));
    expect(screen.getByText("Lead sintético")).toBeInTheDocument();
    if (nominal) {
      expect(screen.getAllByText(/9,876/).length).toBeGreaterThan(0);
      expect(screen.queryByText("Facturación anual no disponible")).not.toBeInTheDocument();
      if (tab === "tablero") {
        expect(within(screen.getByRole("region", { name: "Ganado" })).getByText(/Valor nominal CRM:.*9,876/)).toBeInTheDocument();
      }
    } else {
      expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
      expect(screen.getAllByText("Facturación anual no disponible").length).toBeGreaterThan(0);
    }
    const data = await io.analytics.mock.results[0].value;
    expect(data.convertedAvailable).toBe(converted !== "error");
    expect(data.billingAvailable).toBe(!annualError);
  });
});
