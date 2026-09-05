import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecibirClient } from "./_components/RecibirClient";
import { receivePrealertaAction, type ReceptionLookup } from "./actions";
vi.mock("./actions", () => ({ lookupForReceptionAction: vi.fn(), receivePrealertaAction: vi.fn().mockResolvedValue({ok:true,received:1,remaining:22}) }));
vi.mock("@/app/m/_components/QrScanner", () => ({ QrScanner: () => null }));
const lookup: ReceptionLookup = {
  found: true, alreadyReceived: false, boxCode: "DTD-B-000003", prealertaCode: "DTD-0000-1-1",
  clientMarkbox: "DTD-0000", clientName: null, supplierName: "Proveedor", expected: 23,
  pendingCodes: Array.from({length:23}, (_, i) => `DTD-B-${String(i+1).padStart(6,"0")}`),
  services: [{code:"verificacion",status:"solicitada"}],
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("CN reception choices", () => {
  it("defaults to all 23 pending boxes and shows the requested services before confirmation", () => {
    render(<RecibirClient initialLang="es" initialLookup={lookup} />);
    expect(screen.getByRole("radio", {name:/Lote completo/})).toBeChecked();
    expect(screen.getByRole("button", {name:/Confirmar recepción de 23 cajas/})).toBeInTheDocument();
    expect(screen.getByText("Verificación al recibir")).toBeInTheDocument();
    expect(receivePrealertaAction).not.toHaveBeenCalled();
  });
  it("receives the actual scanned box, not the first box of the lot", async () => {
    render(<RecibirClient initialLang="es" initialLookup={lookup} />);
    fireEvent.click(screen.getByRole("radio", {name:/Solo esta caja/}));
    expect(screen.getByRole("checkbox", {name:"DTD-B-000003"})).toBeChecked();
    expect(screen.getByRole("checkbox", {name:"DTD-B-000001"})).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", {name:/Confirmar recepción de 1 caja/}));
    await waitFor(() => expect(receivePrealertaAction).toHaveBeenCalledWith("DTD-B-000003", ["DTD-B-000003"]));
  });
});
