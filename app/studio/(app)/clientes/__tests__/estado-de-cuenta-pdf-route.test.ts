// @vitest-environment node
/**
 * SDD-0558 · El PDF del estado de cuenta del Studio, igual que el del portal.
 *
 *  - lleva razón social y RIF del emisor bajo el membrete: la excepción de
 *    marca que Sam extendió al estado de cuenta en PDF el 2026-10-18
 *    (SDD-0556), igual que la de la factura (SDD-0297);
 *  - la anulada con abono llega al ledger: el papel la informa en
 *    `voidedPayments`, como la pantalla y el portal;
 *  - sin el módulo `invoices`, 404 sin leer facturas.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/studio/invoice-types";

const state = vi.hoisted(() => ({
  role: "accounting" as string | null,
  invoices: [] as Partial<Invoice>[],
  listInvoices: vi.fn(),
  rendered: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioAccess: async () => ({ role: state.role, overrides: {} }),
  requireModuleView: async () => undefined,
}));
vi.mock("@/lib/studio/client-queries", () => ({
  getClientByMarkbox: async () => ({ id: "c1", markbox: "DTD-0001", name: "Cliente sintético" }),
}));
vi.mock("@/lib/studio/invoice-queries", () => ({
  listInvoices: (...args: unknown[]) => {
    state.listInvoices(...args);
    return Promise.resolve(state.invoices);
  },
}));
vi.mock("@/lib/studio/company-queries", () => ({
  getCompanyData: async () => ({
    identity: {
      tradeName: "Empresa sintética",
      legalName: "Empresa sintética, C.A.",
      rif: "J-00000000-0",
      commercialEmail: "hola@example.test",
      phone: "0000",
      website: "example.test",
    },
  }),
}));
vi.mock("@/lib/studio/pdf/estado-de-cuenta-pdf", () => ({
  EstadoDeCuentaDocument: () => null,
}));
vi.mock("@/lib/studio/pdf/pdf-response", () => ({
  noEncontrado: () => new Response("no", { status: 404 }),
  nombreSeguro: (s: string) => s,
  respuestaPdf: async (doc: { props: Record<string, unknown> }) => {
    state.rendered.push(doc.props);
    return new Response("%PDF", { status: 200 });
  },
}));

const { GET } = await import("../[markbox]/estado-de-cuenta/pdf/route");

function inv(over: Partial<Invoice>): Partial<Invoice> {
  return {
    id: "i1", invoice_code: "F-1", status: "emitida", currency: "USD",
    total_amount: 1000, paid_amount: 0, issued_at: "2026-08-01", due_date: "2026-08-31",
    shipment_code: null, ...over,
  };
}

const params = { params: Promise.resolve({ markbox: "DTD-0001" }) };

beforeEach(() => {
  state.role = "accounting";
  state.invoices = [];
  state.listInvoices.mockReset();
  state.rendered = [];
});

describe("PDF del estado de cuenta del Studio · SDD-0558", () => {
  it("🔴 pasa razón social y RIF del emisor, como el PDF del portal", async () => {
    const res = await GET(new Request("http://x"), params);
    expect(res.status).toBe(200);
    const emisor = state.rendered[0].emisor as Record<string, unknown>;
    expect(emisor.legalName).toBe("Empresa sintética, C.A.");
    expect(emisor.rif).toBe("J-00000000-0");
  });

  it("la anulada con abono llega al ledger y su pago va aparte, sin descontarse", async () => {
    state.invoices = [
      inv({ id: "a", invoice_code: "F-1" }),
      inv({ id: "b", invoice_code: "F-2", status: "anulada", total_amount: 800, paid_amount: 300 }),
      inv({ id: "c", invoice_code: "F-3", status: "borrador", total_amount: 5000 }),
    ];
    await GET(new Request("http://x"), params);
    const ledger = (state.rendered[0].input as { ledger: Record<string, unknown> }).ledger;
    expect(ledger.balance).toBe(1000);
    expect(ledger.voidedPayments).toEqual([
      { code: "F-2", reference: null, amount: 300, currency: "USD" },
    ]);
  });

  it("sin el módulo invoices responde 404 sin leer facturas", async () => {
    state.role = "commercial";
    const res = await GET(new Request("http://x"), params);
    expect(res.status).toBe(404);
    expect(state.listInvoices).not.toHaveBeenCalled();
  });
});
