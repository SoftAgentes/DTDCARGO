/** SDD-0630 · aviso de reportes del portal sin revisar en el cobro (montos inventados). */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../actions", () => ({ getPendingPaymentReports: mocks.get }));

import { PendingReportsNotice } from "./PendingReportsNotice";

const INVOICE_ID = "11111111-1111-4111-8111-111111111111";
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function mount() {
  return render(<PendingReportsNotice invoiceId={INVOICE_ID} invoiceCode="F-0630-UI" currency="USD" />);
}

describe("PendingReportsNotice", () => {
  it("con reportes pendientes avisa cuántos, por cuánto, y enlaza a la factura", async () => {
    mocks.get.mockResolvedValue({ pending: { count: 2, amount: 150.5 } });
    mount();
    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(/reportó 2 pagos/i);
    expect(note).toHaveTextContent("USD $150.50");
    expect(note).toHaveTextContent(/se contará dos veces/i);
    expect(screen.getByRole("link", { name: /ir a la factura F-0630-UI/i }))
      .toHaveAttribute("href", "/studio/facturacion/F-0630-UI");
    expect(mocks.get).toHaveBeenCalledWith(INVOICE_ID);
  });

  it("un solo reporte usa el singular", async () => {
    mocks.get.mockResolvedValue({ pending: { count: 1, amount: 10 } });
    mount();
    expect(await screen.findByRole("note")).toHaveTextContent(/reportó un pago/i);
  });

  it("sin pendientes no muestra nada", async () => {
    mocks.get.mockResolvedValue({ pending: { count: 0, amount: 0 } });
    const view = mount();
    await vi.waitFor(() => expect(mocks.get).toHaveBeenCalled());
    await Promise.resolve();
    expect(view.container).toBeEmptyDOMElement();
  });

  it.each([
    ["sin permiso", () => mocks.get.mockResolvedValue({ pending: null, error: "Sin acceso" })],
    ["error de lectura", () => mocks.get.mockResolvedValue({ pending: null })],
    ["la acción lanza", () => mocks.get.mockRejectedValue(new Error("red sintética"))],
  ])("%s: dice que no pudo revisar, no calla", async (_label, setup) => {
    setup();
    mount();
    expect(await screen.findByRole("note")).toHaveTextContent(/no pudimos revisar/i);
  });
});
