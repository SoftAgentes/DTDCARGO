import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { BILLING_UNAVAILABLE, type AnnualBillingRead } from "@/lib/shared/annual-billing";
const io = vi.hoisted(() => ({ analytics: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ requireModuleView: async () => "commercial", moduleEditDenial: async () => "solo lectura" }));
// Esta prueba fija únicamente el transporte RSC; agregadores reales y UI se prueban aparte.
vi.mock("@/lib/studio/kommo-analytics", () => ({ getKommoAnalytics: io.analytics }));
vi.mock("@/lib/studio/kommo-writeback", () => ({
  getPendingOpsByLead: async () => ({}), getPendingOpsForBoard: async () => ({}),
  getStaleOpsByLead: async () => ({}), getStaleOpsForBoard: async () => ({}),
}));
vi.mock("@/lib/studio/kommo-queries", () => ({
  getKommoOverview: async () => ({ leads: 1, subdomain: null }),
  listKommoPipelines: async () => [{ id: 1, name: "Ficticio", is_main: true }],
  listKommoStatuses: async () => [{ id: 142, pipeline_id: 1 }],
  listKommoLeads: async () => [{ id: 1 }], listKommoBoardLeads: async () => [{ id: 1 }],
  getKommoStatusCounts: async () => ({ 142: 1 }), getLeadContactInfo: async () => ({}),
  parseKommoFiltersFromSearchParams: () => ({}),
}));
vi.mock("../_components/DireccionTab", () => ({ DireccionTab: () => null }));
vi.mock("../_components/KommoBoardView", () => ({ KommoBoardView: () => null }));
vi.mock("../_components/KommoClient", () => ({ KommoClient: () => null }));
vi.mock("../_components/RecoveryTab", () => ({ RecoveryTab: () => null }));
import Page from "../page";
type BillingProps = { valueByLead: Record<number, AnnualBillingRead>; billingAvailable: boolean; convertedLeads: Record<number, string>; tablero: ReactElement<BillingProps> };
beforeEach(() => vi.clearAllMocks());
describe("0572-b · CRM conserva DTO en frontera servidor", () => {
  it.each<AnnualBillingRead>([
    { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
    { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
    { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
    { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
    BILLING_UNAVAILABLE,
  ])("asesor/tablero conservan $state sin filtro numérico", async (billing) => {
    const available = billing.state !== "no_disponible";
    io.analytics.mockResolvedValue({ ownership: { owners: [] }, convertedMarkboxByLead: { 1: "A", 2: "B" }, valueByLead: { 1: billing, 2: billing }, billingAvailable: available });
    const asesor = await Page({ searchParams: Promise.resolve({ tab: "asesor" }) }) as ReactElement<BillingProps>;
    expect(asesor.props.valueByLead).toEqual({ 1: billing });
    expect(asesor.props.convertedLeads).toEqual({ 1: "A" });
    expect(asesor.props.billingAvailable).toBe(available);
    expect(JSON.parse(JSON.stringify(asesor.props.valueByLead))).toEqual({ 1: billing });
    const board = await Page({ searchParams: Promise.resolve({ tab: "tablero" }) }) as ReactElement<BillingProps>;
    expect(board.props.tablero.props.valueByLead[1]).toEqual(billing);
    expect(board.props.tablero.props.billingAvailable).toBe(available);
  });
});
