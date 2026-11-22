/**
 * SDD-0660 (tercera revisión de #668): el selector de mes de Retenciones no vive en
 * un <form>. Con el mes a medio escribir o imposible, `period` se queda en el último
 * mes válido; «Nuevo comprobante» mandaría ese período en un oculto que el drawer no
 * muestra. Exportar y «Nuevo comprobante» esperan a que lo escrito sea un mes válido.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaxWithholding } from "@/lib/studio/fiscal/withholding-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("../actions", () => ({ voidWithholdingAction: vi.fn() }));
vi.mock("./WithholdingDrawer", () => ({ WithholdingDrawer: () => <div role="dialog">Drawer</div> }));

import { WithholdingsView } from "./WithholdingsView";

afterEach(cleanup);

const COMPROBANTE: TaxWithholding = {
  id: "w1", withholdingType: "iva", voucherNumber: "20261000000001", period: "2026-10", opDate: "2026-10-05",
  supplierId: null, supplierName: "Proveedor sintético", rif: null, sourceBillId: null, sourceDoc: null,
  base: 100, pct: 75, amount: 12, currency: "USD", status: "emitido", notes: null, createdAt: "2026-10-05T12:00:00Z",
};

function montar(rows: TaxWithholding[]) {
  const onPeriod = vi.fn();
  render(<WithholdingsView period="2026-10" rows={rows} canPost onPeriod={onPeriod} />);
  return { mes: screen.getByLabelText("Período fiscal") as HTMLInputElement, onPeriod, user: userEvent.setup() };
}

const botones = () => [
  screen.getByRole("button", { name: /Exportar CSV/ }),
  screen.getByRole("button", { name: "Exportar PDF" }),
  ...screen.getAllByRole("button", { name: /Nuevo comprobante/ }),
];

describe("Retenciones · mes a medio escribir o imposible", () => {
  it("con el mes completo, exportar y «Nuevo comprobante» están disponibles", () => {
    montar([COMPROBANTE]);
    for (const b of botones()) expect(b).toBeEnabled();
  });

  it("a medio escribir (10/202) se deshabilitan y no navega", async () => {
    const { mes, onPeriod, user } = montar([COMPROBANTE]);
    await user.type(mes, "{Backspace}");
    expect(mes).toHaveValue("10/202");
    for (const b of botones()) expect(b).toBeDisabled();
    expect(onPeriod).not.toHaveBeenCalled();
  });

  it("con un mes imposible (13/2026) también", async () => {
    const { mes, onPeriod, user } = montar([COMPROBANTE]);
    await user.clear(mes);
    await user.type(mes, "132026");
    expect(mes).toHaveValue("13/2026");
    for (const b of botones()) expect(b).toBeDisabled();
    expect(onPeriod).not.toHaveBeenCalled();
  });

  it("sin comprobantes, el «Nuevo comprobante» del estado vacío también espera", async () => {
    const { mes, user } = montar([]);
    const nuevos = screen.getAllByRole("button", { name: /Nuevo comprobante/ });
    expect(nuevos).toHaveLength(2);
    await user.type(mes, "{Backspace}");
    for (const b of nuevos) expect(b).toBeDisabled();
  });
});
