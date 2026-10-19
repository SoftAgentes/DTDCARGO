/**
 * SDD-0555 · El drawer montado conserva el embarque de cada línea.
 *
 * El defecto FAC-08 estaba también aquí: el drawer rearmaba las líneas solo con
 * descripción, cantidad y precio, y el input oculto `lines` (lo que recibe
 * `updateInvoice`) salía sin `shipmentCode`. Esta prueba monta el drawer real en
 * modo edición con un borrador del cargador de consolidados, cambia un precio
 * como lo haría el operador y lee el input oculto.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice, InvoiceLine } from "@/lib/studio/invoice-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../actions", () => ({
  createInvoice: vi.fn(async () => ({})),
  updateInvoice: vi.fn(async () => ({})),
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

/** Dos embarques y un exceso del primero, como los escribe el cargador. */
const LINEAS: InvoiceLine[] = [
  { desc: "Flete DDP · ENV-PRUEBA-01 · 1.5 m³ × $100", qty: 1.5, unitPrice: 100, shipmentCode: "ENV-PRUEBA-01" },
  { desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100", qty: 2, unitPrice: 100, shipmentCode: "ENV-PRUEBA-02" },
  { desc: "Exceso de peso · ENV-PRUEBA-01 · cajas · 30 kg × $1", qty: 30, unitPrice: 1, shipmentCode: "ENV-PRUEBA-01" },
];

const BORRADOR: Invoice = {
  id: "inv-0555",
  tenant_id: "t1",
  invoice_code: "F-2026-0555",
  client_markbox: "DTD-1001",
  client_name: "Cliente de prueba",
  client_rif: null,
  client_doc_kind: null,
  shipment_id: null,
  shipment_code: "ENV-PRUEBA-01",
  currency: "USD",
  fx_rate: null,
  iva_rate: 0,
  iva_mode: null,
  base_amount: 380,
  iva_amount: 0,
  total_amount: 380,
  status: "borrador",
  issued_at: null,
  due_date: null,
  paid_amount: 0,
  last_payment_at: null,
  lines: LINEAS,
  notes: null,
  created_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
  deleted_at: null,
};

/** Lo que el form manda en `lines`, ya parseado. */
function lineasDelForm(): InvoiceLine[] {
  const input = document.querySelector<HTMLInputElement>('input[type="hidden"][name="lines"]');
  if (!input) throw new Error("no está el input oculto `lines`");
  return JSON.parse(input.value) as InvoiceLine[];
}

afterEach(() => cleanup());

describe("InvoiceDrawer · edición de un borrador de varios embarques", () => {
  it("al abrir, el input oculto `lines` ya lleva el código de cada línea", () => {
    render(<InvoiceDrawer mode="edit" invoice={BORRADOR} ivaOn={false} onClose={vi.fn()} />);
    expect(lineasDelForm().map((l) => l.shipmentCode)).toEqual([
      "ENV-PRUEBA-01",
      "ENV-PRUEBA-02",
      "ENV-PRUEBA-01",
    ]);
  });

  it("corregir un precio no suelta el código; una línea agregada nace sin él", async () => {
    const user = userEvent.setup();
    render(<InvoiceDrawer mode="edit" invoice={BORRADOR} ivaOn={false} onClose={vi.fn()} />);

    const precio = screen.getByLabelText("Precio unitario línea 2");
    await user.clear(precio);
    await user.type(precio, "95");

    await user.click(screen.getByRole("button", { name: "+ Agregar línea" }));
    await user.type(screen.getByLabelText("Descripción línea 4"), "Seguro");
    const precioNuevo = screen.getByLabelText("Precio unitario línea 4");
    await user.type(precioNuevo, "12");

    await waitFor(() => expect(lineasDelForm()[1].unitPrice).toBe(95));
    const lines = lineasDelForm();
    expect(lines[1]).toEqual({
      desc: "Flete DDP · ENV-PRUEBA-02 · 2 m³ × $100",
      qty: 2,
      unitPrice: 95,
      shipmentCode: "ENV-PRUEBA-02",
    });
    expect(lines.map((l) => l.shipmentCode)).toEqual([
      "ENV-PRUEBA-01",
      "ENV-PRUEBA-02",
      "ENV-PRUEBA-01",
      undefined,
    ]);
    expect(lines[3]).toEqual({ desc: "Seguro", qty: 1, unitPrice: 12 });
    expect(lines[3]).not.toHaveProperty("shipmentCode");
  });
});
