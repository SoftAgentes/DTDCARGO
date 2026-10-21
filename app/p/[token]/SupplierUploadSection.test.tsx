import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupplierUploadSection, SupplierUploadSummary, type SupplierUploadStatus } from "./SupplierUploadSection";

afterEach(cleanup);
const TOKEN = "fixture-token";
const photo = () => new File(["photo"], "producto.jpg", { type: "image/jpeg" });
const excel = () => new File(["sheet"], "packing.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
function receipt(uploaded?: number, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...(uploaded === undefined ? {} : { uploaded }) }), { status });
}
function pick(files: File[], label = "Elegir archivos") {
  fireEvent.change(screen.getByLabelText(label), { target: { files } });
}

describe("SupplierUploadSection", () => {
  it("en documento compartido adjunta Excel como respaldo y no promete rellenar ni confirmar",async()=>{
    const request=vi.fn<typeof fetch>().mockResolvedValue(receipt(1));
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} documentManaged/>);
    expect(screen.getByText(/Este Excel no rellena automáticamente el documento compartido/)).toBeVisible();
    expect(screen.queryByText(/sin llenar el formulario online/)).not.toBeInTheDocument();
    pick([excel()]);fireEvent.click(screen.getByRole("button",{name:"Subir archivos"}));
    await screen.findByText("1 archivo recibido");expect(screen.getByText(/Archivo recibido como respaldo; no rellena automáticamente/)).toBeVisible();
    expect(screen.queryByText(/Si usaste Excel, no necesitas llenarlo de nuevo/)).not.toBeInTheDocument();
  });
  it("el resumen managed distingue archivo recibido de despacho confirmado",()=>{
    const view=render(<SupplierUploadSummary locale="es" status={{kind:"received",uploaded:1,selected:1}} documentManaged/>);
    expect(screen.getByRole("status")).toHaveTextContent("confirma el despacho para obtener las etiquetas");
    view.rerender(<SupplierUploadSummary locale="en" status={{kind:"partial",uploaded:1,selected:2}} documentManaged/>);
    expect(screen.getByRole("status")).toHaveTextContent("Partial upload: 1 of 2 files received");expect(screen.getByRole("status")).not.toHaveTextContent("File received as supporting evidence");
  });
  it("comienza en chino y permite continuar sin adjuntos", () => {
    render(<SupplierUploadSection token={TOKEN} />);
    expect(screen.getByRole("heading", { name: "照片和文件" })).toBeVisible();
    expect(screen.getByText("选填")).toBeVisible();
    expect(screen.getByText("尚未选择文件。可以跳过此步骤。")).toBeVisible();
    expect(screen.queryByRole("button", { name: "上传文件" })).not.toBeInTheDocument();
  });

  it("conserva archivos al cambiar idioma y permite quitar uno", () => {
    const view = render(<SupplierUploadSection token={TOKEN} locale="es" />);
    pick([photo(), excel()]);
    view.rerender(<SupplierUploadSection token={TOKEN} locale="en" />);
    expect(screen.getByText("producto.jpg")).toBeVisible();
    expect(screen.getByText("packing.xlsx")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Remove producto.jpg" }));
    expect(screen.queryByText("producto.jpg")).not.toBeInTheDocument();
    expect(screen.getByText("1 file selected, not uploaded")).toBeVisible();
  });

  it("manda multipart y honeypot al endpoint existente; confirma solo lo recibido", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(receipt(2));
    const onUploadState = vi.fn();
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState} />);
    pick([photo(), excel()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    await screen.findByText("2 archivos recibidos");
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe(`/p/${TOKEN}/upload`);
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body.getAll("files")).toHaveLength(2);
    expect(body.get("empresa_web")).toBe("");
    expect(screen.queryByText("producto.jpg")).not.toBeInTheDocument();
    expect(screen.getByText(/La recepción de archivos es independiente del envío del formulario online/)).toBeVisible();
    expect(onUploadState).toHaveBeenLastCalledWith({ kind: "received", uploaded: 2, selected: 2 });
  });

  it("conserva la selección y muestra recepción parcial sin inventar qué fotos llegaron", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(receipt(1));
    const onUploadState = vi.fn();
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState} />);
    pick([photo(), excel()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    expect(await screen.findByText("Carga parcial: 1 de 2 archivos recibidos")).toBeVisible();
    expect(screen.getByText("producto.jpg")).toBeVisible();
    expect(screen.getByText("packing.xlsx")).toBeVisible();
    expect(screen.getByText(/No tenemos el detalle de cuáles llegaron/)).toBeVisible();
    expect(screen.queryByText("2 archivos recibidos")).not.toBeInTheDocument();
    expect(screen.queryByText(/Los archivos fueron recibidos/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar selección" })).toBeEnabled();
    expect(onUploadState).toHaveBeenLastCalledWith({ kind: "partial", uploaded: 1, selected: 2 });
  });

  it("keeps receipt uncertainty after removing a file from a partial selection", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(receipt(1));
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request}/>);
    pick([photo(), excel()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    await screen.findByText("Carga parcial: 1 de 2 archivos recibidos");
    fireEvent.click(screen.getByRole("button", { name: "Quitar producto.jpg" }));
    expect(screen.getByText("Carga parcial: 1 de 2 archivos recibidos")).toBeVisible();
    expect(screen.getByText(/recepción anterior sin confirmar por archivo/)).toBeVisible();
    expect(screen.queryByText(/sin subir/)).not.toBeInTheDocument();
  });

  it.each([undefined, 0, 3, 1.5])("no infiere éxito si el recibo no es válido: %s", async (uploaded) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(receipt(uploaded));
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} />);
    pick([photo(), excel()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    expect(await screen.findByText(/No pudimos confirmar cuántos archivos/)).toBeVisible();
    expect(screen.getByText("producto.jpg")).toBeVisible();
    expect(screen.queryByText("2 archivos recibidos")).not.toBeInTheDocument();
  });

  it.each([
    { name: "HTML", body: "<html>Accepted</html>", contentType: "text/html" },
    { name: "JSON incompleto", body: '{"ok":true,', contentType: "application/json" },
    { name: "objeto vacío", body: "{}", contentType: "application/json" },
    { name: "null", body: "null", contentType: "application/json" },
  ])("trata HTTP 200 con $name como recepción incierta y no como fallo confirmado", async ({ body, contentType }) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": contentType } }));
    const onUploadState = vi.fn();
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState} />);
    pick([photo()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    expect(await screen.findByText(/No pudimos confirmar cuántos archivos/)).toBeVisible();
    expect(screen.getByText(/confirma con DTD antes de reenviar/)).toBeVisible();
    expect(screen.queryByText(/No pudimos subir tus archivos/)).not.toBeInTheDocument();
    expect(screen.getByText("producto.jpg")).toBeVisible();
    expect(onUploadState).toHaveBeenLastCalledWith({ kind: "error", error: "unconfirmed", uploaded: 0, selected: 1 });
  });

  it("mantiene selección y avisa sobre recepción incierta ante pérdida de red", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    render(<SupplierUploadSection token={TOKEN} locale="en" request={request} />);
    pick([photo()], "Choose files");
    fireEvent.click(screen.getByRole("button", { name: "Upload files" }));
    expect(await screen.findByText(/The connection was interrupted/)).toBeVisible();
    expect(screen.getByText("producto.jpg")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload files" })).toBeEnabled();
  });

  it("bloquea editar la selección mientras la carga está pendiente", async () => {
    let resolve!: (value: Response) => void;
    const request = vi.fn<typeof fetch>().mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} />);
    pick([photo()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    expect(screen.getByRole("button", { name: "Elegir archivos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar producto.jpg" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar todo" })).toBeDisabled();
    resolve(receipt(1));
    await screen.findByText("1 archivo recibido");
  });

  it("no envía una selección de más de 12 archivos que el endpoint truncaría", async () => {
    const request = vi.fn<typeof fetch>();
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} />);
    pick(Array.from({ length: 13 }, (_, i) => new File(["x"], `${i}.pdf`, { type: "application/pdf" })));
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    expect(screen.getByText(/Puedes subir hasta 12 archivos por carga/)).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: /^Quitar \d/ })).toHaveLength(13);
  });

  it("localiza un rechazo del servidor y permite volver a intentar", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("blocked", { status: 429 }));
    render(<SupplierUploadSection token={TOKEN} locale="es" request={request} />);
    pick([photo()]);
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    await waitFor(() => expect(screen.getByText(/Se hicieron demasiadas cargas/)).toBeVisible());
    expect(screen.getByText("producto.jpg")).toBeVisible();
  });
  it.each([
    { status: 503, cause: "failed", expected: "No pudimos subir tus archivos. Revisa su formato y tamaño e intenta de nuevo." },
    { status: 429, cause: "throttled", expected: "Se hicieron demasiadas cargas. Intenta de nuevo más tarde." },
  ])("preserva la causa HTTP $status en el resumen sin inventar recepción incierta", async ({ status, cause, expected }) => {
    const onUploadState = vi.fn();
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("rejected", { status }));
    const view = render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState}/>);
    pick([photo()]); fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    await screen.findByText(expected);
    const receipt = onUploadState.mock.calls.at(-1)![0] as SupplierUploadStatus;
    expect(receipt).toEqual({ kind: "error", error: cause, uploaded: 0, selected: 1 });
    view.unmount(); render(<SupplierUploadSummary locale="es" status={receipt}/>);
    expect(screen.getByRole("status")).toHaveTextContent(expected);
    expect(screen.queryByText(/sin confirmar|inciert/)).not.toBeInTheDocument();
  });
  it("mantiene el límite local en el resumen y nunca lo convierte en recepción incierta", () => {
    const onUploadState = vi.fn(); const request = vi.fn();
    const view = render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState}/>);
    pick(Array.from({ length: 13 }, (_, i) => new File(["x"], i + ".pdf")));
    fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    const receipt = onUploadState.mock.calls.at(-1)![0] as SupplierUploadStatus;
    expect(receipt).toEqual({ kind: "error", error: "limit", uploaded: 0, selected: 13 });
    expect(request).not.toHaveBeenCalled();
    view.unmount(); render(<SupplierUploadSummary locale="es" status={receipt}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Puedes subir hasta 12 archivos por carga");
    expect(screen.queryByText(/sin confirmar|inciert/)).not.toBeInTheDocument();
  });
  it.each(["network", "unconfirmed"] as const)("mantiene el aviso de recepción incierta para %s", async cause => {
    const onUploadState = vi.fn();
    const request = cause === "network" ? vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")) : vi.fn<typeof fetch>().mockResolvedValue(receipt());
    const view = render(<SupplierUploadSection token={TOKEN} locale="es" request={request} onUploadState={onUploadState}/>);
    pick([photo()]); fireEvent.click(screen.getByRole("button", { name: "Subir archivos" }));
    await screen.findByText(cause === "network" ? /La conexión se interrumpió/ : /No pudimos confirmar cuántos archivos/);
    const state = onUploadState.mock.calls.at(-1)![0] as SupplierUploadStatus;
    expect(state.kind === "error" && state.error).toBe(cause);
    view.unmount(); render(<SupplierUploadSummary locale="es" status={state}/>);
    expect(screen.getByRole("status")).toHaveTextContent(/confirmar|confirmación/);
    expect(screen.getByRole("status")).toHaveTextContent(/antes de reenviar/);
  });

});
