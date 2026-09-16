import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("uses translated placeholders without putting examples in review or the wire payload", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Revisa", fieldErrors: { contacto: "Falta contacto" } }), { status: 400 }));
    render(<ProviderShareClient {...props} supplierName="" supplierWechat="" request={request}/>);
    expect(screen.getByRole("textbox", { name: "公司 / 姓名" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "公司 / 姓名" })).toHaveAttribute("placeholder", "例如：深圳 ABC 贸易公司");
    language("en"); expect(screen.getByRole("textbox", { name: "WeChat / Phone" })).toHaveAttribute("placeholder", "e.g. wechat_id or +86…");
    language("es"); expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveAttribute("placeholder", "Ej. Shenzhen ABC Trading");
    expect(screen.queryByText("Prellenado; puedes corregirlo")).not.toBeInTheDocument();
    step(4);
    const editor = screen.getByRole("region", { name: "Factura y packing list" });
    expect(within(editor).queryByText(/Shenzhen ABC|demo-wechat|wechat_id/)).not.toBeInTheDocument();
    fireEvent.click(button("Enviar documento a DTD")); await waitFor(() => expect(request).toHaveBeenCalledOnce());
    const payload = JSON.parse(request.mock.calls[0][1].body);
    expect(payload.supplierCompany).toBe(""); expect(payload.supplierWechat).toBe("");
    expect(JSON.stringify(payload)).not.toMatch(/Shenzhen ABC|demo-wechat|wechat_id|fieldOrigins|draftRestored/);
  });
  it("identifies real prefilled contacts accessibly and keeps them in review", async () => {
    await start();
    const company = screen.getByRole("textbox", { name: "Empresa / Persona" });
    expect(company).toHaveValue("Proveedor");
    expect(company).toHaveAccessibleDescription("Prellenado; puedes corregirlo");
    expect(screen.getByRole("textbox", { name: "WeChat / Teléfono" })).toHaveAccessibleDescription("Prellenado; puedes corregirlo");
    fireEvent.change(company, { target: { value: "Proveedor corregido" } });
    expect(company).toHaveAccessibleDescription("Editado en este borrador");
    step(4); expect(screen.getByText("Proveedor corregido")).toBeVisible();
  });
  it("keeps essential draft status outside tools and distinguishes restored values from prefill", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft());
    await start();
    const company = screen.getByRole("textbox", { name: "Empresa / Persona" });
    await waitFor(() => expect(company).toHaveValue("Proveedor guardado"));
    expect(company).toHaveAccessibleDescription("Restaurado del borrador de este dispositivo");
    const state = screen.getByText("Borrador local restaurado · aún no enviado");
    expect(state).toBeVisible(); expect(state.closest("details")).toBeNull();
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Factura y packing list" })).getByText(/Borrador guardado en este dispositivo/).closest("details")).toBeNull());
  });
  it("does not call a newly edited and autosaved session restored", async () => {
    render(<ProviderShareClient {...props} supplierName="" supplierWechat=""/>); language("es");
    const company = screen.getByRole("textbox", { name: "Empresa / Persona" });
    await waitFor(() => expect(company).toHaveValue(""));
    fireEvent.change(company, { target: { value: "Sesión nueva" } });
    fireEvent.change(screen.getByRole("textbox", { name: "WeChat / Teléfono" }), { target: { value: "nuevo-contacto" } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem(packlistDraftKey(props.token)) || "{}").company).toBe("Sesión nueva"));
    expect(screen.getByText("Borrador local · aún no enviado")).toBeVisible();
    expect(screen.queryByText("Borrador local restaurado · aún no enviado")).not.toBeInTheDocument();
    language("en"); step(2); step(1);
    expect(screen.getByText("Local draft · not sent yet")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Company / Person" })).toHaveAccessibleDescription("Edited in this draft");
  });
  it("does not label empty restored contact fields as filled data", async () => {
    localStorage.setItem(packlistDraftKey(props.token), draft({ company: "", wechat: "" }));
    await start();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).toHaveValue(""));
    expect(screen.getByRole("textbox", { name: "Empresa / Persona" })).not.toHaveAccessibleDescription();
    expect(screen.getByRole("textbox", { name: "WeChat / Teléfono" })).not.toHaveAccessibleDescription();
    expect(screen.getByText("Borrador local restaurado · aún no enviado")).toBeVisible();
  });
  it("keeps debounced and interval autosave silent while announcing a manual save", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    try {
      render(<ProviderShareClient {...props}/>);
      await act(async () => {});
      language("es");
      const notice = screen.getByRole("status", { name: "Avisos del borrador" });
      expect(notice).toBeEmptyDOMElement();
      fireEvent.change(screen.getByRole("textbox", { name: "Empresa / Persona" }), { target: { value: "Empresa editada" } });
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      const visibleState = within(screen.getByRole("region", { name: "Factura y packing list" })).getByText(/Borrador guardado en este dispositivo/);
      expect(visibleState.closest('[role="status"], [aria-live]')).toBeNull();
      expect(notice).toBeEmptyDOMElement();
      await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
      expect(notice).toBeEmptyDOMElement();
      fireEvent.click(button("Guardar borrador"));
      expect(notice).toHaveTextContent("Borrador guardado en este dispositivo");
      await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
      expect(notice).toBeEmptyDOMElement();
    } finally { cleanup(); vi.useRealTimers(); }
  });
  it("exposes four numbered step targets with full names and the current step", async () => {
    await start();
    const navigation = screen.getByRole("navigation", { name: "Pasos del documento" });
    const targets = within(navigation).getAllByRole("button");
    expect(targets).toHaveLength(4);
    expect(targets[0]).toHaveAccessibleName("1 Datos del proveedor");
    expect(targets[0]).toHaveAttribute("aria-current", "step");
    fireEvent.click(targets[2]);
    expect(targets[2]).toHaveAccessibleName("3 Fotos y archivos");
    expect(targets[2]).toHaveAttribute("aria-current", "step");
    expect(targets[0]).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "Fotos y archivos · Opcional" })).toBeVisible();
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
    fireEvent.click(button("Editar Tapas"));
    expect(screen.getByRole("textbox", { name: /Unidades del grupo · 2/ })).toHaveValue("8");
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
  it("shows a compact attachment review while preserving the actual Files through steps and Excel", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, uploaded: 1 })));
    await start(request); step(3);
    expect(screen.getAllByRole("heading", { name: "Fotos y archivos · Opcional" })).toHaveLength(1);
    const file = new File(["photo"], "product.png", { type: "image/png" });
    const chooser = screen.getByLabelText("Elegir archivos");
    fireEvent.change(chooser, { target: { files: [file] } });
    step(4);
    expect(screen.queryByRole("button", { name: "Elegir archivos" })).not.toBeInTheDocument();
    expect(screen.getByText("product.png")).not.toBeVisible();
    language("zh");
    expect(button("4 核对并提交")).toHaveAttribute("aria-current", "step");
    expect(within(screen.getByRole("region", { name: "照片与附件" })).getByText("已选择 1 个文件，尚未上传")).toBeVisible();
    expect(screen.getByText("本地草稿 · 尚未提交")).toBeVisible();
    language("en");
    expect(button("4 Review and send")).toHaveAttribute("aria-current", "step");
    expect(within(screen.getByRole("region", { name: "Photos and files" })).getByText("1 file selected, not uploaded")).toBeVisible();
    language("es");
    const review = screen.getByRole("region", { name: "Fotos y archivos" });
    expect(within(review).getByText("1 archivo seleccionado, sin subir")).toBeVisible();
    fireEvent.click(within(review).getByRole("button", { name: "Revisar" }));
    expect(screen.getByText("product.png")).toBeVisible();
    expect(screen.getByLabelText("Elegir archivos")).toBe(chooser);
    fireEvent.click(button("Usar Excel")); expect(screen.getByText("product.png")).toBeVisible();
    fireEvent.click(button("Volver al formulario"));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(button("Subir archivos"));
    await screen.findByText("1 archivo recibido");
    expect((request.mock.calls[0][1].body as FormData).getAll("files")).toEqual([file]);
    step(4);
    expect(within(screen.getByRole("region", { name: "Fotos y archivos" })).getByText("1 archivo recibido")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Elegir archivos" })).not.toBeInTheDocument();
  });
  it("localizes throttling in Chinese and never presents an unconfirmed send as success", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Demasiados intentos" }), { status: 429 }));
    render(<ProviderShareClient {...props} request={request}/>); step(4); fireEvent.click(button("提交文件给 DTD"));
    expect(await within(screen.getByRole("region", { name: "装箱单与发票" })).findByText("提交次数过多，请稍后重试。")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "文件已提交" })).not.toBeInTheDocument();
  });
});
