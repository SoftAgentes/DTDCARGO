/**
 * SDD-0543 · El detalle de una factura del Portal: un borrador SUYO que espera
 * la aceptación de T&C abre la puerta (monto y embarques, sin conceptos) en vez
 * del 404; sin factura visible ni borrador pendiente, sigue siendo un 404.
 *
 * Se renderiza la página real con sus consultas simuladas. `notFound()` de Next
 * lanza; acá se simula con un error reconocible.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const CLIENTE = { id: "c1", markbox: "DTD-8001", name: "Cliente Prueba", email: null, phone: null, address: null };

const h = vi.hoisted(() => ({
  factura: null as unknown,
  pendiente: null as unknown,
  cliente: null as unknown,
  consultas: [] as unknown[][],
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getMyInvoice: async () => h.factura,
  // SDD-0549: el borrador se busca con el principal de sesión. `getPortalClient`
  // se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClientPrincipal: async () => (h.cliente ? { userId: "u1", tenantId: "t1", client: h.cliente } : null),
  getPortalClient: async () => h.cliente,
}));
vi.mock("@/lib/portal/pending-acceptance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portal/pending-acceptance")>()),
  loadPendingAcceptanceDetailForClient: async (...args: unknown[]) => {
    h.consultas.push(args);
    return h.pendiente;
  },
}));
vi.mock("@/lib/portal/payment-report-queries", () => ({ listMyInvoiceReports: async () => [] }));

import PortalInvoiceDetailPage from "./page";

const PENDIENTE = {
  code: "F-2026-0007",
  baseAmount: 876.78,
  totalAmount: 876.78,
  currency: "USD",
  shipmentCode: "DTD-A116-06",
  cbm: 1.022,
  weightKg: 408.55,
  invoiceId: "i1",
  shipmentId: "s1",
  clientName: "Cliente Prueba",
  ivaRate: 0,
  ivaAmount: 0,
  fxRate: null,
  lines: [{ desc: "Flete DDP · DTD-A116-06 · 1.022 m³ × $750", qty: 1.022, unitPrice: 750, shipmentCode: "DTD-A116-06" }],
  notes: null,
  embarques: [{ code: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 }],
};

async function abrir(code = "F-2026-0007") {
  const ui = await PortalInvoiceDetailPage({ params: Promise.resolve({ code }) });
  render(ui);
}

afterEach(() => {
  cleanup();
  h.factura = null;
  h.pendiente = null;
  h.cliente = null;
  h.consultas = [];
});

describe("/portal/facturas/[code] con un borrador por aceptar (SDD-0543)", () => {
  it("un borrador suyo que espera los T&C abre la puerta: monto y embarque a la vista, sin conceptos", async () => {
    h.cliente = CLIENTE;
    h.pendiente = PENDIENTE;
    await abrir();
    expect(screen.getByText("F-2026-0007")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /aceptar los T&C del portal para ver el detalle/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Revisar y aceptar/ })).toHaveAttribute(
      "href",
      "/portal/facturas/F-2026-0007/aceptar",
    );
    expect(screen.getByText("DTD-A116-06")).toBeInTheDocument();
    expect(screen.queryByText(/Flete DDP/)).toBeNull();
    expect(screen.queryByRole("heading", { name: /Conceptos/ })).toBeNull();
  });

  it("sin factura visible ni borrador pendiente sigue siendo un 404", async () => {
    h.cliente = CLIENTE;
    await expect(abrir("F-2026-0099")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sin cliente en sesión no consulta borradores: 404", async () => {
    h.pendiente = PENDIENTE;
    await expect(abrir()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.consultas).toEqual([]);
  });

  it("busca el borrador con el tenant y el Shipping Mark del principal de sesión (SDD-0549)", async () => {
    h.cliente = CLIENTE;
    h.pendiente = PENDIENTE;
    await abrir();
    expect(h.consultas).toHaveLength(1);
    const [principal, code] = h.consultas[0];
    expect(principal).toMatchObject({ tenantId: "t1", client: { markbox: "DTD-8001" } });
    expect(code).toBe("F-2026-0007");
  });
});

/** Detalle de una factura emitida, como lo devuelve `getMyInvoice`. */
function detalle(over: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    tenantId: "t1",
    clientRif: null,
    clientDocKind: null,
    code: "F-2026-0010",
    clientName: "Cliente Prueba",
    status: "emitida",
    currency: "USD",
    fxRate: null,
    ivaRate: 0,
    base: 1000,
    ivaAmount: 0,
    total: 1000,
    paid: 300,
    issuedAt: "2026-09-01",
    dueDate: "2026-09-30",
    lines: [{ desc: "Flete LCL", qty: 1, unitPrice: 1000 }],
    notes: null,
    shipmentId: null,
    shipmentCode: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

describe("/portal/facturas/[code] de una factura anulada (SDD-0556)", () => {
  it("una anulada con abono no muestra «Saldo pendiente» y dice que no hay nada que pagar", async () => {
    // Antes: «Saldo pendiente USD 700.00» resaltado en una factura anulada.
    h.cliente = CLIENTE;
    h.factura = detalle({ status: "anulada" });
    await abrir("F-2026-0010");
    expect(screen.queryByText("Saldo pendiente")).toBeNull();
    expect(screen.queryByText("USD 700.00")).toBeNull();
    expect(
      screen.getByText(/Esta factura está anulada: no tienes nada que pagar por ella\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Recibimos USD 300\.00 en pagos de esta factura\. Escríbele a tu asesor para aplicarlos a otra factura o pedir su devolución\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reportar pago" })).toBeNull();
  });

  it("una anulada sin pagos no habla de pagos recibidos", async () => {
    h.cliente = CLIENTE;
    h.factura = detalle({ status: "anulada", paid: 0 });
    await abrir("F-2026-0010");
    expect(screen.getByText(/Esta factura está anulada/)).toBeInTheDocument();
    expect(screen.queryByText(/Recibimos/)).toBeNull();
  });

  it("una viva con saldo sigue mostrando «Saldo pendiente» y sin el aviso de anulada", async () => {
    h.cliente = CLIENTE;
    h.factura = detalle();
    await abrir("F-2026-0010");
    expect(screen.getByText("Saldo pendiente")).toBeInTheDocument();
    expect(screen.getByText("USD 700.00")).toBeInTheDocument();
    expect(screen.queryByText(/Esta factura está anulada/)).toBeNull();
  });
});
