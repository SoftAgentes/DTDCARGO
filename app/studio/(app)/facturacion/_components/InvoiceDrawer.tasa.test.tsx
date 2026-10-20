/**
 * SDD-0569 · El drawer de factura muestra la tasa en VES y en CNY (revisión de
 * seguridad, hallazgo 2). En CNY el campo iba oculto: con `fx_rates` vacía, la
 * acción devolvía `fieldErrors.fx_rate` y el usuario no veía ni el error ni
 * dónde escribir la tasa.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/studio/invoice-types";

const FALTA = "Falta la tasa de yuanes para el 2026-10-20: escríbela aquí o cárgala en Admin › Tasas.";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  createInvoice: vi.fn(async () => ({ fieldErrors: { fx_rate: FALTA } })),
  updateInvoice: vi.fn(async () => ({ fieldErrors: { fx_rate: FALTA } })),
  softDeleteInvoice: vi.fn(async () => ({})),
  lookupShipmentForInvoice: vi.fn(async () => ({ shipment: null })),
  lookupInvoiceBillingOptions: vi.fn(async () => null),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { InvoiceDrawer } from "./InvoiceDrawer";

const BORRADOR: Invoice = {
  id: "inv-0569",
  tenant_id: "t1",
  invoice_code: "F-2026-0569",
  client_markbox: "DTD-1001",
  client_name: "Cliente de prueba",
  client_rif: null,
  client_doc_kind: null,
  shipment_id: null,
  shipment_code: null,
  currency: "CNY",
  fx_rate: null,
  iva_rate: 0,
  iva_mode: null,
  base_amount: 718,
  iva_amount: 0,
  total_amount: 718,
  status: "borrador",
  issued_at: null,
  due_date: null,
  paid_amount: 0,
  last_payment_at: null,
  lines: [{ desc: "Flete", qty: 1, unitPrice: 718 }],
  notes: null,
  created_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
  deleted_at: null,
};

afterEach(() => cleanup());

describe("InvoiceDrawer · la tasa en VES y en CNY", () => {
  it.each([["VES", "CNY"], ["CNY", "VES"]] as const)("cambiar %s a %s limpia la tasa y pide catálogo", async (origen, destino) => {
    const user = userEvent.setup();
    render(<InvoiceDrawer mode="edit" invoice={{ ...BORRADOR, currency: origen, fx_rate: 36 }} ivaOn={false} onClose={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Moneda"), destino);
    expect((document.querySelector('[name="fx_rate"]') as HTMLInputElement).value).toBe("");
    expect((document.querySelector('[name="fx_rate_intent"]') as HTMLInputElement)?.value).toBe("catalog");
  });

  it("precargar preserva intención y volver a escribir la misma cifra elige manual", async () => {
    const user = userEvent.setup();
    render(<InvoiceDrawer mode="edit" invoice={{ ...BORRADOR, currency: "VES", fx_rate: 36 }} ivaOn={false} onClose={vi.fn()} />);
    expect((document.querySelector('[name="fx_rate_intent"]') as HTMLInputElement)?.value).toBe("preserve");
    const campo = screen.getByLabelText("Tasa (1 USD = ? VES)");
    await user.clear(campo);
    await user.type(campo, "36");
    expect((document.querySelector('[name="fx_rate_intent"]') as HTMLInputElement)?.value).toBe("manual");
  });

  it("en CNY se ve el campo de la tasa, con su ayuda", () => {
    render(<InvoiceDrawer mode="edit" invoice={BORRADOR} ivaOn={false} onClose={vi.fn()} />);
    const campo = screen.getByLabelText("Tasa (1 USD = ? CNY)");
    // El valor viaja en el input con name="fx_rate" que arma NumericInput.
    expect(document.querySelectorAll('[name="fx_rate"]')).toHaveLength(1);
    expect(campo.getAttribute("aria-describedby")?.split(" ")).toContain("ivd-fx-ayuda");
    expect(document.getElementById("ivd-fx-ayuda")?.textContent).toBe(
      "Si la dejas vacía, se toma la vigente de Admin › Tasas.",
    );
  });

  it("en VES también, y en USD no", () => {
    const { unmount } = render(
      <InvoiceDrawer mode="edit" invoice={{ ...BORRADOR, currency: "VES" }} ivaOn={false} onClose={vi.fn()} />,
    );
    expect(screen.getByLabelText("Tasa (1 USD = ? VES)")).toBeTruthy();
    unmount();
    render(<InvoiceDrawer mode="edit" invoice={{ ...BORRADOR, currency: "USD" }} ivaOn={false} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/^Tasa/)).toBeNull();
  });

  it("el error de la tasa se ve junto al campo", async () => {
    const user = userEvent.setup();
    render(<InvoiceDrawer mode="edit" invoice={BORRADOR} ivaOn={false} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^Guardar/ }));
    expect(await screen.findByText(FALTA)).toBeTruthy();
    expect(screen.getByLabelText("Tasa (1 USD = ? CNY)").getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByLabelText("Moneda") as HTMLSelectElement).value).toBe("CNY");
    expect((document.querySelector('[name="currency"]') as HTMLInputElement).value).toBe("CNY");
  });
});
