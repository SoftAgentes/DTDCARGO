/**
 * SDD-0556 · El comprobante imprimible de una factura anulada.
 *
 * Antes, una anulada con abono parcial salía con el pill «Vencida» o
 * «Pendiente» y su «Saldo pendiente» resaltado: el papel le decía al cliente
 * que debía una factura que ya no existe. Ahora el pill dice «Anulada», no hay
 * saldo y una nota dice qué pasa con lo pagado, con la misma indicación que el
 * resto del portal (`indicacionPagosEnAnuladas`).
 *
 * Se renderiza la página real con sus consultas simuladas. Las funciones puras
 * (`buildComprobante`, `estadoDelComprobante`) ya tienen su prueba; ésta fija
 * que la página las use y pinte lo que dicen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { indicacionPagosEnAnuladas } from "@/lib/portal/saldo-de-cuenta";

const CLIENTE = {
  id: "c1",
  markbox: "DTD-8001",
  name: "Cliente Prueba",
  email: null,
  phone: null,
  address: null,
};

const h = vi.hoisted(() => ({ factura: null as unknown }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getMyInvoice: async () => h.factura,
  getPortalClient: async () => CLIENTE,
}));
vi.mock("@/lib/studio/aliados/brand-resolve", async () => {
  const { DTD_BRAND } = await import("@/lib/shared/brand-context");
  return { resolveBrandForPortal: async () => DTD_BRAND };
});
// El logo no es lo que se prueba (y `next/image` no aporta nada en jsdom).
vi.mock("@/components/BrandMark", () => ({ BrandMark: () => <span>DTD Cargo</span> }));

import PortalComprobantePage from "./page";

/** Detalle de factura como lo devuelve `getMyInvoice`. */
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
    // Lejos en el futuro: el pill de una viva con saldo es «Pendiente».
    dueDate: "2099-12-31",
    lines: [{ desc: "Flete LCL", qty: 1, unitPrice: 1000 }],
    notes: null,
    shipmentId: null,
    shipmentCode: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

const NOTA_ANULADA =
  "Esta factura está anulada: lo que pagaste en ella no se descuenta de tu saldo pendiente. " +
  `${indicacionPagosEnAnuladas({ singular: true, inicioDeFrase: true })}.`;

async function abrir(code = "F-2026-0010") {
  const ui = await PortalComprobantePage({ params: Promise.resolve({ code }) });
  render(ui);
}

afterEach(() => {
  cleanup();
  h.factura = null;
});

describe("/portal/facturas/[code]/comprobante de una anulada (SDD-0556)", () => {
  it("una anulada con abono: pill «Anulada», la nota de lo pagado y ningún saldo pendiente", async () => {
    h.factura = detalle({ status: "anulada" });
    await abrir();
    expect(screen.getByText("Anulada")).toBeInTheDocument();
    expect(screen.queryByText("Pendiente")).toBeNull();
    expect(screen.queryByText("Vencida")).toBeNull();
    expect(screen.getByText(NOTA_ANULADA)).toBeInTheDocument();
    expect(screen.queryByText("Saldo pendiente")).toBeNull();
    expect(screen.queryByText("USD 700.00")).toBeNull();
    // Lo pagado se sigue viendo.
    expect(screen.getByText("Pagado").parentElement).toHaveTextContent("USD 300.00");
  });

  it("una anulada sin pagos no lleva la nota", async () => {
    h.factura = detalle({ status: "anulada", paid: 0 });
    await abrir();
    expect(screen.getByText("Anulada")).toBeInTheDocument();
    expect(screen.queryByText(/lo que pagaste en ella/)).toBeNull();
    expect(screen.queryByText("Saldo pendiente")).toBeNull();
  });

  it("una viva con saldo sigue con «Pendiente» y su saldo, sin la nota de anulada", async () => {
    h.factura = detalle();
    await abrir();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Saldo pendiente").parentElement).toHaveTextContent("USD 700.00");
    expect(screen.queryByText(/lo que pagaste en ella/)).toBeNull();
    expect(screen.queryByText("Anulada")).toBeNull();
  });

  it("sin factura visible responde 404", async () => {
    await expect(abrir("F-NO-EXISTE")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
