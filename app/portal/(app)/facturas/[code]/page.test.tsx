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
  getPortalClient: async () => h.cliente,
}));
vi.mock("@/lib/portal/pending-acceptance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portal/pending-acceptance")>()),
  loadPendingAcceptanceDetailForClient: async () => h.pendiente,
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
  });
});
