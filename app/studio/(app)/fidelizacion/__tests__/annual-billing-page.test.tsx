import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import type { ClientWithTier, TierCount } from "@/lib/studio/fidelizacion/queries";
import { BILLING_UNAVAILABLE, billingStatus } from "@/lib/shared/annual-billing";

const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), referrals: vi.fn(), stats: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => io }));
vi.mock("@/lib/studio/rbac-guard", () => ({ requireModuleView: async () => "admin" }));
vi.mock("@/lib/studio/fidelizacion/queries", async (original) => ({
  ...await original<typeof import("@/lib/studio/fidelizacion/queries")>(),
  listReferrals: io.referrals,
  programStats: io.stats,
  topReferrers: async () => [],
}));
vi.mock("@/lib/studio/fidelizacion/referral-settings-queries", () => ({ getReferralSettings: async () => ({ referrerRewardUsd: 80, referredRewardUsd: 60 }) }));
vi.mock("@/lib/studio/fidelizacion/referral-credit-queries", () => ({ strandedReferralCredits: async () => ({ credits: [], complete: true }) }));
// La frontera de DB se dobla; página, lector, paginador y pestañas son reales.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("../_components/RegisterReferralDrawer", () => ({ RegisterReferralDrawer: () => null }));
vi.mock("../_components/ReferralDrawer", () => ({ ReferralDrawer: () => null }));
vi.mock("../_components/ReferralSettingsDrawer", () => ({ ReferralSettingsDrawer: () => null }));
afterEach(cleanup);
import Page from "../page";

function pageChain(rows: unknown[] | null, error: object | null = null) {
  const q = { select: () => q, is: () => q, order: () => q, range: (start: number) => Promise.resolve({ data: rows?.slice(start, start + 500) ?? null, error }) };
  return q;
}
type Props = { clients: ClientWithTier[]; tierCounts: TierCount[]; portfolioAvailable: boolean; stats: { creditsIssued: number }; referrals: unknown[] };
beforeEach(() => {
  vi.clearAllMocks();
  io.referrals.mockResolvedValue([]);
  io.stats.mockResolvedValue({ total: 0, activos: 0, acreditados: 0, creditsIssued: 80, convRate: 0 });
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

type FictClient = { id: string; markbox: string; name: string; deleted_at: null };
type FictAnnual = { client_markbox: string; subtotal_usd: string; sin_tasa_count: number; conversion_state: string };
type FictError = { code: string; message: string };
const FICT_CLIENTS: FictClient[] = [
  { id: "f3110000-0000-4000-8000-000000000001", markbox: "FICT_ALFA", name: "Cliente ficticio Alfa", deleted_at: null },
  { id: "f3110000-0000-4000-8000-000000000002", markbox: "FICT_BETA", name: "Cliente ficticio Beta", deleted_at: null },
];
const FICT_REFERRAL = {
  id: "f3110000-0000-4000-8000-000000000003", tenant_id: "f3110000-0000-4000-8000-000000000004",
  referral_code: "FICT_REFERRAL", referrer_client_id: FICT_CLIENTS[0].id, referrer_markbox: "FICT_ALFA",
  referred_name: "Persona referida ficticia", referred_company: null, referred_email: null, referred_phone: null,
  referred_client_id: null, status: "acreditado", reward_usd: 80, lead_id: null, notes: null,
  applied_invoice_id: null, applied_entry_id: null, applied_at: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", deleted_at: null,
  accredited_reason: "Motivo ficticio de QA", sale_voided_at: null,
};

// Sólo este grupo usa este transporte. No dobla complete ni el paginador real.
function fictPortfolioTransport({
  clients,
  annual = [],
  clientError = null,
  annualError = null,
  withReferral = false,
}: {
  clients: FictClient[];
  annual?: FictAnnual[];
  clientError?: FictError | null;
  annualError?: FictError | null;
  withReferral?: boolean;
}) {
  const ranges: { source: "clients" | "annual"; from: number; to: number }[] = [];
  const clientRows = clients.filter((row) => row.deleted_at === null).slice().sort((a, b) => a.id.localeCompare(b.id));
  const annualRows = annual.slice().sort((a, b) => a.client_markbox.localeCompare(b.client_markbox));
  io.referrals.mockResolvedValue(withReferral ? [FICT_REFERRAL] : []);
  io.stats.mockResolvedValue({ total: withReferral ? 1 : 0, activos: 0, acreditados: withReferral ? 1 : 0, creditsIssued: 80, convRate: withReferral ? 100 : 0 });

  io.from.mockImplementation((table: string) => {
    if (table !== "clients") throw new Error("FICT: tabla inesperada");
    let selected = false;
    let filtered = false;
    let ordered = false;
    const q = {
      select(columns: string) {
        expect(columns).toBe("id, markbox, name");
        selected = true;
        return q;
      },
      is(column: string, value: unknown) {
        expect([column, value]).toEqual(["deleted_at", null]);
        filtered = true;
        return q;
      },
      order(column: string, options: unknown) {
        expect([column, options]).toEqual(["id", { ascending: true }]);
        ordered = true;
        return q;
      },
      range(from: number, to: number) {
        expect([selected, filtered, ordered]).toEqual([true, true, true]);
        expect(Number.isInteger(from) && from >= 0).toBe(true);
        expect(to).toBe(from + 999);
        ranges.push({ source: "clients", from, to });
        const data = clientRows.slice(from, to + 1).map(({ id, markbox, name }) => ({ id, markbox, name }));
        return Promise.resolve({ data: clientError ? null : data, error: clientError });
      },
    };
    return q;
  });
  io.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
    if (name !== "studio_client_annual_billing_v2") throw new Error("FICT: RPC inesperada");
    expect(Object.keys(args)).toEqual(["p_as_of"]);
    expect(args.p_as_of).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    let ordered = false;
    const q = {
      order(column: string, options: unknown) {
        expect([column, options]).toEqual(["client_markbox", { ascending: true }]);
        ordered = true;
        return q;
      },
      range(from: number, to: number) {
        expect(ordered).toBe(true);
        expect(Number.isInteger(from) && from >= 0).toBe(true);
        expect(to).toBe(from + 999);
        ranges.push({ source: "annual", from, to });
        return Promise.resolve({ data: annualError ? null : annualRows.slice(from, to + 1), error: annualError });
      },
    };
    return q;
  });
  return { ranges };
}

function expectUnavailableTabs() {
  fireEvent.click(screen.getByRole("button", { name: "Clientes" }));
  expect(screen.getByText("No se pudo cargar la cartera de clientes.")).toBeInTheDocument();
  expect(screen.getByText("Cartera no disponible")).toBeInTheDocument();
  expect(screen.queryByText("Todavía no hay clientes para clasificar.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Niveles" }));
  expect(screen.getAllByText("Cartera no disponible")).toHaveLength(4);
  expect(screen.queryByText("0 clientes")).not.toBeInTheDocument();
}

function expectReferralAndCredit(page: ReactElement<Props>) {
  expect(page.props.stats.creditsIssued).toBe(80);
  expect(page.props.referrals).toEqual([FICT_REFERRAL]);
  const view = render(page);
  expect(screen.getByText("Créditos emitidos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Referidos/ })).toHaveTextContent("1");
  expect(screen.getByRole("button", { name: "+ Registrar referido" })).toBeEnabled();
  return view;
}

describe("0572 · cartera disponible atraviesa página, lector, paginador y tabs reales", () => {
  it("error de clientes conserva referidos/créditos y no certifica vacío ni ceros", async () => {
    const { ranges } = fictPortfolioTransport({
      clients: FICT_CLIENTS,
      clientError: { code: "FICT_READ_ERROR", message: "Detalle ficticio privado del proveedor" },
      withReferral: true,
    });
    const page = await Page() as ReactElement<Props>;
    expect(page.props.portfolioAvailable).toBe(false);
    expect(ranges).toEqual([
      { source: "annual", from: 0, to: 999 },
      { source: "clients", from: 0, to: 999 },
    ]);
    expect(JSON.stringify(page.props)).not.toContain("Detalle ficticio privado");
    expectReferralAndCredit(page);
    expectUnavailableTabs();
    fireEvent.click(screen.getByRole("button", { name: /^Referidos/ }));
    expect(screen.getByText(/Persona referida ficticia/)).toBeInTheDocument();
  });

  it("agota las 60 páginas reales con identidades únicas y muestra ND en ambas tabs", async () => {
    const clients: FictClient[] = Array.from({ length: 60_000 }, (_, i) => ({
      id: `f3110000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      markbox: `FICT_CAP_${i + 1}`, name: `Cliente ficticio ${i + 1}`, deleted_at: null,
    }));
    expect(new Set(clients.map((row) => row.id)).size).toBe(60_000);
    expect(new Set(clients.map((row) => row.markbox)).size).toBe(60_000);
    const { ranges } = fictPortfolioTransport({ clients, withReferral: true });
    const page = await Page() as ReactElement<Props>;
    const clientRanges = ranges.filter((row) => row.source === "clients");
    expect(clientRanges).toHaveLength(60);
    expect(clientRanges[0]).toEqual({ source: "clients", from: 0, to: 999 });
    expect(clientRanges[59]).toEqual({ source: "clients", from: 59_000, to: 59_999 });
    expect(io.from).toHaveBeenCalledTimes(60);
    expect(page.props.portfolioAvailable).toBe(false);
    expect(page.props.clients).toEqual([]);
    expectReferralAndCredit(page);
    expectUnavailableTabs();
    fireEvent.click(screen.getByRole("button", { name: /^Referidos/ }));
    expect(screen.getByText(/Persona referida ficticia/)).toBeInTheDocument();
  });

  it("cartera y anual verdaderamente vacías mantienen Sin clientes y los ceros conocidos", async () => {
    const { ranges } = fictPortfolioTransport({ clients: [] });
    const page = await Page() as ReactElement<Props>;
    expect(page.props.portfolioAvailable).toBe(true);
    expect(ranges).toEqual([
      { source: "annual", from: 0, to: 999 },
      { source: "clients", from: 0, to: 999 },
    ]);
    render(page);
    expect(screen.getByText("Créditos emitidos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clientes" }));
    expect(screen.getByText("Sin clientes")).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay clientes para clasificar.")).toBeInTheDocument();
    expect(screen.queryByText("Cartera no disponible")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Niveles" }));
    expect(screen.getAllByText("0 clientes")).toHaveLength(4);
    expect(screen.queryByText("Cartera no disponible")).not.toBeInTheDocument();
  });

  it("fallo sólo anual conserva cartera, filtros, Por revisar, referidos y créditos", async () => {
    const { ranges } = fictPortfolioTransport({
      clients: FICT_CLIENTS,
      annualError: { code: "FICT_ANNUAL_ERROR", message: "Detalle ficticio anual privado" },
      withReferral: true,
    });
    const page = await Page() as ReactElement<Props>;
    expect(page.props.portfolioAvailable).toBe(true);
    expect(page.props.clients).toHaveLength(2);
    expect(page.props.clients.every((row) => row.billing.state === "no_disponible" && row.tier === null)).toBe(true);
    expect(ranges.filter((row) => row.source === "clients")).toEqual([
      { source: "clients", from: 0, to: 999 },
      { source: "clients", from: 2, to: 1001 },
    ]);
    const view = expectReferralAndCredit(page);
    fireEvent.click(screen.getByRole("button", { name: "Clientes" }));
    expect(screen.getByText("Cliente ficticio Alfa")).toBeInTheDocument();
    expect(screen.getByText("Cliente ficticio Beta")).toBeInTheDocument();
    expect(screen.getAllByText("Por revisar").length).toBeGreaterThan(0);
    expect(screen.getAllByText(billingStatus(BILLING_UNAVAILABLE))).toHaveLength(2);
    expect(screen.queryByText("Cartera no disponible")).not.toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Buscar cliente o Shipping Mark" });
    search.focus();
    fireEvent.change(search, { target: { value: "Beta" } });
    expect(search).toHaveFocus();
    expect(screen.queryByText("Cliente ficticio Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Cliente ficticio Beta")).toBeInTheDocument();

    const tab = screen.getByRole("button", { name: "Clientes" });
    tab.focus();
    fictPortfolioTransport({
      clients: FICT_CLIENTS,
      clientError: { code: "FICT_CLIENTS_DOWN", message: "Fallo ficticio de cartera" },
      annualError: { code: "FICT_ANNUAL_ERROR", message: "Detalle ficticio anual privado" },
      withReferral: true,
    });
    view.rerender(await Page());
    expect(tab).toHaveFocus();
    expect(screen.getByText("No se pudo cargar la cartera de clientes.")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay clientes para clasificar.")).not.toBeInTheDocument();

    fictPortfolioTransport({
      clients: FICT_CLIENTS,
      annualError: { code: "FICT_ANNUAL_ERROR", message: "Detalle ficticio anual privado" },
      withReferral: true,
    });
    view.rerender(await Page());
    expect(tab).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Buscar cliente o Shipping Mark" })).toHaveValue("Beta");
    expect(screen.queryByText("Cliente ficticio Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Cliente ficticio Beta")).toBeInTheDocument();
    expect(screen.queryByText("Cartera no disponible")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Referidos/ }));
    expect(screen.getByText(/Persona referida ficticia/)).toBeInTheDocument();
  });
});
