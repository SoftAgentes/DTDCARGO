import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProviderShareClient } from "./ProviderShareClient";
import { resolveBrand } from "@/lib/shared/brand-context";
import { packlistDraftKey, packlistHistoryKey } from "@/lib/studio/prealertas/packlist-draft";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const props = { token: "test-only", code: "DTD-0000-1-1", description: "Prueba", markbox: "DTD-0000", supplierName: "Proveedor", supplierWechat: "wechat", brand: resolveBrand(null), labels: [{code: "DTD-0000-1-1", boxN: 1, totalBoxes: 1, boxCode: "DTD-B-000001"}] };
beforeEach(() => { localStorage.clear(); vi.spyOn(window, "print").mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete document.documentElement.dataset.printSurface; });

describe("supplier workflow", () => {
  it("allows printing an empty document after an informational reminder, without submission", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ProviderShareClient {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Imprimir etiquetas/ })[0]);
    expect(window.print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Continuar e imprimir/ }));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.printSurface).toBe("labels");
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /Imprimir etiquetas/ })[0]);
    expect(window.print).toHaveBeenCalledTimes(2);
  });
  it("prints the packing document separately and offers actual XLSX instead of CSV", () => {
    render(<ProviderShareClient {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Imprimir documento/ }));
    expect(document.documentElement.dataset.printSurface).toBe("packing-list");
    expect(screen.getByRole("link", { name: /Usar Excel/ })).toHaveAttribute("href", "/p/test-only/packlist");
    expect(screen.queryByRole("button", { name: /Excel vacío/ })).not.toBeInTheDocument();
  });
  it("migrates personal fields out of old drafts and preserves the server Shipping Mark", async () => {
    const old = JSON.stringify({ mark: "DTD-FALSE", clientName: "PRIVATE-NAME", clientPhone: "PRIVATE-PHONE", clientEmail: "PRIVATE-EMAIL", company: "Mi proveedor" });
    localStorage.setItem(packlistDraftKey(props.token), old);
    localStorage.setItem(packlistHistoryKey(props.token), JSON.stringify([{t:1,label:"old",data:old}]));
    render(<ProviderShareClient {...props} />);
    await waitFor(() => expect(localStorage.getItem(packlistDraftKey(props.token))).not.toContain("PRIVATE"));
    expect(localStorage.getItem(packlistHistoryKey(props.token))).not.toContain("PRIVATE");
    expect(screen.queryByDisplayValue("DTD-FALSE")).not.toBeInTheDocument();
    expect(screen.getAllByText("DTD-0000").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Teléfono del cliente/)).not.toBeInTheDocument();
  });
  it("does not report successful saving when browser storage is unavailable", async () => {
    render(<ProviderShareClient {...props} />);
    await waitFor(() => expect(screen.getByRole("button", {name:/Guardar borrador/})).toBeInTheDocument());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: /Guardar borrador/ }));
    expect(screen.getByText(/No se pudo guardar el borrador/)).toBeInTheDocument();
  });
});
