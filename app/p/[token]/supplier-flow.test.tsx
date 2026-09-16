import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProviderShareClient } from "./ProviderShareClient";
import { resolveBrand } from "@/lib/shared/brand-context";
import { computeTotals } from "@/lib/studio/prealertas/packlist-form";
import { packlistDraftKey, packlistHistoryKey } from "@/lib/studio/prealertas/packlist-draft";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const props = { token: "test-only", code: "DTD-0000-1-1", markbox: "DTD-0000", supplierName: "Proveedor", supplierWechat: "wechat", brand: resolveBrand(null), labels: [{ code: "DTD-0000-1-1", boxN: 1, totalBoxes: 1, boxCode: "DTD-B-000001" }] };
const mixed = [
  { zh: "杯子", es: "Vasos", ctns: "5", perctn: "10", unit: "2", wkg: "3", cbm: "0.5" },
  { zh: "盖子", es: "Tapas", same: true, qtyDirect: "8", unit: "4" },
];
const language = (value: string) => fireEvent.change(screen.getByRole("combobox", { name: "语言 / Idioma / Language" }), { target: { value } });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const step = (n: number) => fireEvent.click(button(new RegExp(`^${n} `)));
function draft(extra = {}) { return JSON.stringify({ company: "Proveedor guardado", wechat: "saved-contact", currency: "RMB", rows: mixed, lang: "en", docDate: "2026-09-16", note: "Revisar muestra", ...extra }); }
async function start(request?: typeof fetch) {
  render(<ProviderShareClient {...props} request={request}/>);
  language("es");
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toBeInTheDocument());
}
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "print").mockImplementation(() => {});
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete document.documentElement.dataset.printSurface; });

describe("supplier guided workflow", () => {
  it("starts in simplified Chinese with one group and supports language changes without translating data", async () => {
    render(<ProviderShareClient {...props}/>);
    expect(screen.getByRole("heading", { level: 1, name: "装箱单与商业发票" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "公司 / 姓名" }), { target: { value: "我的公司" } });
    language("en");
    expect(screen.getByRole("textbox", { name: "Company / Person" })).toHaveValue("我的公司");
    step(2);
    expect(screen.getAllByRole("region", { name: /Carton group/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole("textbox", { name: /Product name · 1/ }), { target: { value: "Cups" } });
    language("zh");
    expect(screen.getByRole("textbox", { name: /中文品名 · 1/ })).toHaveValue("");
    fireEvent.click(screen.getByText("品牌、货号及其他资料"));
    expect(screen.getByRole("textbox", { name: /西文品名（选填） · 1/ })).toHaveValue("Cups");
  });
  it("allows printing empty labels after an informational reminder without submitting", async () => {
    const request = vi.fn(); await start(request);
    fireEvent.click(button("Imprimir etiquetas")); expect(window.print).not.toHaveBeenCalled();
    fireEvent.click(button("Continuar e imprimir"));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.printSurface).toBe("labels");
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(button("Imprimir etiquetas")); expect(window.print).toHaveBeenCalledTimes(2);
  });
  it("provides a read-only document view and separates printing from submission", async () => {
    const request = vi.fn(); await start(request);
    fireEvent.click(button("Ver documento"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Imprimir / PDF" }));
    expect(document.documentElement.dataset.printSurface).toBe("packing-list");
    expect(request).not.toHaveBeenCalled();
  });
  it("preserves fractional unit prices in the read-only document", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft({ rows: [{ zh: "零件", unit: "0.004", ctns: 100, perctn: 100 }] }));
    await start(); await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado"));
    fireEvent.click(button("Ver documento"));
    expect(within(screen.getByRole("dialog")).getByRole("cell", { name: "0.004" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByRole("cell", { name: "40.00" })).toHaveLength(2);
  });
  it("migrates personal fields out of old drafts and preserves the protected Shipping Mark", async () => {
    const old = draft({ mark: "DTD-FALSE", clientName: "PRIVATE-NAME", clientPhone: "PRIVATE-PHONE", clientEmail: "PRIVATE-EMAIL" });
    localStorage.setItem(packlistDraftKey(props.token), old);
    localStorage.setItem(packlistHistoryKey(props.token), JSON.stringify([{ t: 1, label: "old", data: old }]));
    await start();
    await waitFor(() => expect(localStorage.getItem(packlistDraftKey(props.token))).not.toContain("PRIVATE"));
    expect(localStorage.getItem(packlistHistoryKey(props.token))).not.toContain("PRIVATE");
    expect(screen.queryByDisplayValue("DTD-FALSE")).not.toBeInTheDocument();
    expect(screen.getAllByText("DTD-0000").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Teléfono del cliente/)).not.toBeInTheDocument();
  });
  it("does not report saved drafts when browser storage is unavailable", async () => {
    await start();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(button("Guardar borrador"));
    expect(screen.getByRole("alert")).toHaveTextContent(/No se pudo guardar el borrador/);
    expect(screen.getByRole("alert").closest("details")).toBeNull();
  });
  it("preserves legacy mixed-carton totals, fields and payload through steps, languages and Excel", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft());
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, folio: "PL-1", versionNo: 2 })));
    await start(request);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado"));
    step(2);
    expect(screen.getByRole("textbox", { name: /Unidades de este producto en todo el grupo · 2/ })).toHaveValue("8");
    fireEvent.click(button("Usar Excel"));
    expect(screen.getByRole("link", { name: "Descargar Excel" })).toHaveAttribute("href", "/p/test-only/packlist");
    fireEvent.click(button("Volver al formulario"));
    step(4); fireEvent.click(button("Enviar documento a DTD"));
    await screen.findByRole("heading", { name: "Documento enviado" });
    const body = JSON.parse(request.mock.calls[0][1].body);
    expect(request.mock.calls[0][0]).toBe("/p/test-only/packlist");
    expect(Object.keys(body).sort()).toEqual(["supplierCompany", "supplierContact", "supplierEmail", "supplierWechat", "supplierPhone", "supplierAddress", "supplierCity", "currency", "docDate", "supplierNote", "rows", "empresa_web"].sort());
    expect(body.rows).toEqual(mixed); expect(body.currency).toBe("RMB"); expect(body.supplierNote).toBe("Revisar muestra");
    expect(computeTotals(body.rows).totals).toEqual({ ctns: 5, qty: 58, amount: 132, weight: 15, cbm: 2.5 });
    expect(screen.getByText(/PL-1.*Versión.*2/)).toBeInTheDocument();
    // Printable legacy surface contains every mixed row even outside the active capture step.
    expect(document.querySelectorAll('.pl-print-only input[value="盖子"]').length).toBe(1);
  });
  it("deletes a whole group without reassigning its children to the preceding group", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft({ rows: [{ zh: "Previous", ctns: 1, perctn: 1 }, ...mixed] }));
    await start(); await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado"));
    step(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Eliminar grupo" })[1]);
    fireEvent.click(button("Eliminar grupo completo"));
    expect(screen.getAllByRole("region", { name: /Grupo de cajas/ })).toHaveLength(1);
    fireEvent.click(button("Guardar borrador"));
    expect(JSON.parse(localStorage.getItem(packlistDraftKey(props.token))!).rows).toEqual([{ zh: "Previous", ctns: 1, perctn: 1 }]);
    fireEvent.click(button("Eliminar grupo")); fireEvent.click(button("Eliminar grupo completo"));
    expect(screen.getAllByRole("region", { name: /Grupo de cajas/ })).toHaveLength(1);
  });
  it("routes localized server field errors to the relevant step and preserves entries", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Error español", fieldErrors: { contacto: "ES", rows: "ES" } }), { status: 400 }));
    await start(request); step(4); fireEvent.click(button("Enviar documento a DTD"));
    await within(screen.getByRole("region", { name: "Factura y packing list" })).findByText("Deja un contacto: WeChat, teléfono o email.");
    expect(await screen.findByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Datos del proveedor" })));
  });
  it("supports correction and append-only resubmission without clearing the form", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft());
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, folio: "PL-1", versionNo: 1, labelsNeedReview: true }))).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, folio: "PL-1", versionNo: 2 })));
    await start(request); await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado"));
    step(4); fireEvent.click(button("Enviar documento a DTD")); await screen.findByRole("heading", { name: "Documento enviado" });
    expect(screen.getByText(/Las cajas no coinciden/)).toBeInTheDocument();
    fireEvent.click(button("Corregir y reenviar"));
    expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado");
    step(4); fireEvent.click(button("Enviar documento a DTD")); await screen.findByText(/PL-1.*Versión.*2/);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("restoring history after submission returns to editing and invalidates the receipt", async () => {
    localStorage.setItem(packlistHistoryKey(props.token), JSON.stringify([{ t: 1, label: "older", data: draft() }]));
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, folio: "PL-1", versionNo: 1 })));
    await start(request); step(4); fireEvent.click(button("Enviar documento a DTD")); await screen.findByRole("heading", { name: "Documento enviado" });
    fireEvent.click(button("Historial")); fireEvent.click(button("Restaurar"));
    expect(screen.queryByRole("heading", { name: "Documento enviado" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue("Proveedor guardado");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("blocks history restoration and row mutation while a submission is in flight", async () => {
    localStorage.setItem(packlistHistoryKey(props.token), JSON.stringify([{ t: 1, label: "older", data: draft() }]));
    const request = vi.fn().mockReturnValue(new Promise(() => {}));
    await start(request); fireEvent.click(button("Historial")); step(4); fireEvent.click(button("Enviar documento a DTD"));
    expect(button("Restaurar")).toBeDisabled(); expect(button("Historial")).toBeDisabled(); expect(button("Guardar borrador")).toBeDisabled();
    expect(button("Editar productos")).toBeDisabled();
  });
  it("preserves selected attachments across steps and Excel without uploading implicitly", async () => {
    const request = vi.fn(); await start(request); step(3);
    fireEvent.change(screen.getByLabelText("Elegir archivos"), { target: { files: [new File(["photo"], "product.png", { type: "image/png" })] } });
    step(1); step(3); expect(screen.getByText("product.png")).toBeInTheDocument();
    fireEvent.click(button("Usar Excel")); expect(screen.getByText("product.png")).toBeInTheDocument(); expect(request).not.toHaveBeenCalled();
  });
  it("localizes throttling in Chinese and never presents an unconfirmed send as success", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Demasiados intentos" }), { status: 429 }));
    render(<ProviderShareClient {...props} request={request}/>); step(4); fireEvent.click(button("提交文件给 DTD"));
    expect(await within(screen.getByRole("region", { name: "装箱单与发票" })).findByText("提交次数过多，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "文件已提交" })).not.toBeInTheDocument();
  });
});
