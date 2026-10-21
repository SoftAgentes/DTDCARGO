import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { ClientWithTier, TierCount } from "@/lib/studio/fidelizacion/queries";
import { BILLING_UNAVAILABLE } from "@/lib/shared/annual-billing";

const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => io }));
vi.mock("@/lib/studio/rbac-guard", () => ({ requireModuleView: async () => "admin" }));
vi.mock("@/lib/studio/fidelizacion/queries", async (original) => ({
  ...await original<typeof import("@/lib/studio/fidelizacion/queries")>(),
  listReferrals: async () => [],
  programStats: async () => ({ total: 0, activos: 0, acreditados: 0, creditsIssued: 80, convRate: 0 }),
  topReferrers: async () => [],
}));
vi.mock("@/lib/studio/fidelizacion/referral-settings-queries", () => ({ getReferralSettings: async () => ({ referrerRewardUsd: 80, referredRewardUsd: 60 }) }));
vi.mock("@/lib/studio/fidelizacion/referral-credit-queries", () => ({ strandedReferralCredits: async () => ({ credits: [], complete: true }) }));
// Frontera RSC: no simula el agregador. La UI real tiene su prueba propia.
vi.mock("../_components/FidelizacionClient", () => ({ FidelizacionClient: () => null }));
import Page from "../page";

function pageChain(rows: unknown[] | null, error: object | null = null) {
  const q = { select: () => q, is: () => q, order: () => q, range: (start: number) => Promise.resolve({ data: rows?.slice(start, start + 500) ?? null, error }) };
  return q;
}
type Props = { clients: ClientWithTier[]; tierCounts: TierCount[]; portfolioAvailable: boolean; stats: { creditsIssued: number } };
beforeEach(() => {
  vi.clearAllMocks();
  io.from.mockImplementation((name) => {
    expect(name).toBe("clients");
    return pageChain([{ id: "a", markbox: "A", name: "Cliente ficticio" }]);
  });
});
describe("0572-b · Fidelización frontera servidor con lector real", () => {
  it("listado y distribución usan una sola lectura completa, sin convertir parcial en Bronze", async () => {
    io.rpc.mockReturnValue(pageChain([{ client_markbox: "A", subtotal_usd: "100.01", sin_tasa_count: 2, conversion_state: "sin_tasa" }]));
    const page = await Page() as ReactElement<Props>;
    expect(page.props.clients[0]).toMatchObject({ billedUsd: null, tier: null, billing: { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 } });
    expect(page.props.tierCounts.reduce((n, r) => n + r.count, 0)).toBe(0);
    expect(io.rpc).toHaveBeenCalledTimes(2); // Página con fila + vacía; no segunda lectura para counts.
    expect(io.rpc.mock.calls.every(([name]) => name === "studio_client_annual_billing_v2")).toBe(true);
    expect(page.props.stats.creditsIssued).toBe(80);
    expect(JSON.stringify(page.props)).toContain('"subtotalUsd":"100.01"');
  });
  it("RPC ausente conserva cartera y créditos; error del catálogo impide anunciar cartera vacía", async () => {
    io.rpc.mockReturnValue(pageChain(null, { code: "PGRST202", message: "detalle privado" }));
    const page = await Page() as ReactElement<Props>;
    expect(page.props.clients[0].billing).toEqual(BILLING_UNAVAILABLE);
    expect(page.props.portfolioAvailable).toBe(true);
    expect(page.props.stats.creditsIssued).toBe(80);
    expect(JSON.stringify(page.props)).not.toContain("detalle privado");
    io.from.mockReturnValue(pageChain(null, { message: "catálogo caído" }));
    const unavailable = await Page() as ReactElement<Props>;
    expect(unavailable.props.clients).toEqual([]);
    expect(unavailable.props.portfolioAvailable).toBe(false);
  });
  it("cero conocido permite el nivel derivado y llega como decimal serializable", async () => {
    io.rpc.mockReturnValue(pageChain([{ client_markbox: "A", subtotal_usd: "0.00", sin_tasa_count: 0, conversion_state: "completo" }]));
    const page = await Page() as ReactElement<Props>;
    expect(page.props.clients[0]).toMatchObject({ billedUsd: 0, tier: { id: "bronze" }, billing: { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 } });
    expect(page.props.tierCounts.find((row) => row.tier.id === "bronze")?.count).toBe(1);
  });
});
