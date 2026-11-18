/**
 * SDD-0573 · El detalle de la factura y «Anular». Con cobros vivos la base no la
 * anula (0497): el botón se ve deshabilitado, con el motivo y dónde resolverlo.
 * Sin cobros, se ofrece, y el diálogo dice que el asiento de venta se revierte.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/studio/invoice-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  createInvoice: vi.fn(async () => ({})),
  updateInvoice: vi.fn(async () => ({})),
  emitInvoice: vi.fn(async () => ({})),
  voidInvoice: vi.fn(async () => ({ ok: true })),
  registerPayment: vi.fn(async () => ({})),
  softDeleteInvoice: vi.fn(async () => ({})),
  duplicateInvoice: vi.fn(async () => ({})),
  lookupShipmentForInvoice: vi.fn(async () => ({ shipment: null })),
  lookupInvoiceBillingOptions: vi.fn(async () => null),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

import { InvoiceDetailClient } from "./InvoiceDetailClient";

const FACTURA: Invoice = {
  id: "inv-0573",
  tenant_id: "t1",
  invoice_code: "F-2026-0573",
  client_markbox: "DTD-1001",
  client_name: "Cliente de prueba",
  client_rif: null,
  client_doc_kind: null,
  shipment_id: null,
  shipment_code: null,
  currency: "USD",
  fx_rate: null,
  iva_rate: 0,
  iva_mode: null,
  base_amount: 300,
  iva_amount: 0,
  total_amount: 300,
  status: "parcial",
  issued_at: "2026-10-01",
  due_date: null,
  paid_amount: 100,
  last_payment_at: null,
  lines: [{ desc: "Flete", qty: 1, unitPrice: 300 }],
  notes: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  deleted_at: null,
};

afterEach(() => cleanup());

describe("InvoiceDetailClient · Anular (SDD-0573)", () => {
  it("con cobros vivos, «Anular» está deshabilitado y dice por qué", () => {
    render(<InvoiceDetailClient invoice={FACTURA} ivaOn={false} cashAccounts={[]} cobrosVivos={1} />);
    const boton = screen.getByRole("button", { name: "Anular" });
    expect(boton).toHaveProperty("disabled", true);
    expect(boton.getAttribute("aria-describedby")).toBe("inv-anular-bloqueo");
    expect(document.getElementById("inv-anular-bloqueo")?.textContent).toBe(
      "Tiene 1 cobro(s) vivo(s): para anularla, anúlalos primero en Cobranzas.",
    );
  });

  it("sin cobros vivos, se ofrece, y el diálogo dice que el asiento se revierte", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceDetailClient invoice={{ ...FACTURA, status: "emitida", paid_amount: 0 }} ivaOn={false} cashAccounts={[]} />,
    );
    const boton = screen.getByRole("button", { name: "Anular" });
    expect(boton).toHaveProperty("disabled", false);
    await user.click(boton);
    expect(
      await screen.findByText(/su asiento de venta se revierte con un contra-asiento en el período abierto/),
    ).toBeTruthy();
  });
});
