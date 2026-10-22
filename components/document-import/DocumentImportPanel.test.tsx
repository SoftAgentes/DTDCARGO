/**
 * SDD-0473 · Contratos que este panel no puede romper.
 *
 * No son pruebas de camino feliz: lo que se fija acá es que el panel nunca
 * aplique una extracción por su cuenta, nunca invente un dato que el documento
 * no traía, y nunca deje al cliente sin la salida manual cuando algo falla.
 */
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emptyDocumentDraft,
  type DocumentDraft,
} from "@/lib/shared/document-import";
import { DocumentImportPanel } from "./DocumentImportPanel";
import {
  DocumentRequestError,
  type DocumentClient,
  type DocumentWorkspace,
} from "./document-client";

afterEach(cleanup);

const WORKSPACE: DocumentWorkspace = {
  id: "00000000-0000-4000-8000-000000000001",
  revision: 3,
  draft: emptyDocumentDraft(),
  confirmedRevision: null,
  expiresAt: null,
};

function archivo(name = "proforma.pdf", size = 1024) {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/** Un draft con dos productos en las MISMAS 5 cajas: peso y CBM van una sola vez. */
function extraido(): DocumentDraft {
  const draft = emptyDocumentDraft();
  draft.products = [
    { id: "p1", name: "Vasos", nameZh: "", code: "VAS-01", brand: "", material: "", quantity: 50, unitPrice: 2, currency: "USD" },
    { id: "p2", name: "Tapas", nameZh: "", code: "TAP-02", brand: "", material: "", quantity: 8, unitPrice: 4, currency: "USD" },
  ];
  draft.groups = [
    {
      id: "g1",
      label: "",
      cartons: 5,
      grossWeightKg: 15,
      cbm: 2.5,
      items: [
        { productId: "p1", quantity: 50 },
        { productId: "p2", quantity: 8 },
      ],
    },
  ];
  return draft;
}

type Guion = {
  jobStatuses?: string[];
  jobResult?: DocumentDraft | null;
  jobErrorCode?: string | null;
  uploadFalla?: DocumentRequestError;
  finishStatus?: string;
  idempotent?: boolean;
};

function cliente(guion: Guion = {}) {
  const statuses = [...(guion.jobStatuses ?? ["ready"])];
  const calls: { action: string; body?: Record<string, unknown> }[] = [];
  const client: DocumentClient = {
    get: vi.fn(async (action: string) => {
      calls.push({ action });
      if (action === "job") {
        const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
        return {
          job: {
            status,
            result: status === "failed" ? null : (guion.jobResult ?? extraido()),
            errorCode: status === "failed" ? (guion.jobErrorCode ?? "unknown") : null,
          },
        } as never;
      }
      // Lo que devuelve el servidor de verdad tras aplicar: el workspace con el
      // borrador ya fusionado. Es la ÚNICA vía para que el editor de arriba vea
      // lo extraído — `apply` sólo devuelve un recibo.
      if (action === "workspace")
        return { workspace: { ...WORKSPACE, revision: 4, draft: guion.jobResult ?? extraido() } } as never;
      throw new Error("acción GET no esperada: " + action);
    }),
    post: vi.fn(async (action: string, body?: Record<string, unknown>) => {
      calls.push({ action, body });
      if (action === "open") return { workspace: WORKSPACE } as never;
      if (action === "upload") {
        if (guion.uploadFalla) throw guion.uploadFalla;
        if (guion.idempotent) return { jobId: "job-1", status: guion.finishStatus ?? "ready" } as never;
        return { jobId: "job-1", status: "uploading", uploadUrl: "https://upload.test/x", contentType: "application/pdf" } as never;
      }
      if (action === "uploaded") return { jobId: "job-1", status: guion.finishStatus??"queued" } as never;
      // El servidor devuelve un RECIBO, no el workspace (`save_document_workspace`
      // en la 0457 hace `return receipt`). El falso anterior devolvía un workspace
      // completo y por eso tapaba el defecto: el panel subía un objeto sin `id`
      // ni `draft` y nadie se enteraba.
      if (action === "apply") return { revision: 4, confirmed: false } as never;
      throw new Error("acción POST no esperada: " + action);
    }),
    upload: vi.fn(async () => undefined),
    download: vi.fn(async () => new Blob()),
    setAnonymousToken: vi.fn(),
    id: () => "11111111-1111-4111-8111-111111111111",
  };
  return { client, calls };
}

function elegir(files: File[]) {
  fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"), {
    target: { files },
  });
  const send = screen.queryByRole("button", { name: "Enviar y leer documentos" });
  if (send) fireEvent.click(send);
}

function pendiente<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

type Propuesta = { job: { status: string; result: DocumentDraft | null; errorCode: string | null } };

describe("DocumentImportPanel (SDD-0473)", () => {
  it("prepara el tipo antes de transferir bytes y sólo envía tras el clic explícito",async()=>{
    const {client}=cliente();render(<DocumentImportPanel extractionDisclosure="GLM · Z.AI Standard; Excel nativo sin IA" workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1}/>);
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"),{target:{files:[archivo()]}});
    expect(client.post).not.toHaveBeenCalled();expect(client.upload).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Tipo de documento"),{target:{value:"proforma"}});
    fireEvent.click(screen.getByRole("button",{name:"Enviar y leer documentos"}));
    await waitFor(()=>expect(client.post).toHaveBeenCalledWith("upload",expect.objectContaining({kind:"proforma"})));
    expect(client.upload).toHaveBeenCalledTimes(1);expect(client.post).not.toHaveBeenCalledWith("apply",expect.anything());
  });
  it("sin aviso efectivo del servidor conserva la preparación y la salida manual sin enviar",async()=>{
    const {client}=cliente();render(<DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} onManual={vi.fn()} client={client}/>);
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"),{target:{files:[archivo()]}});
    await waitFor(()=>expect(client.get).toHaveBeenCalledWith("capabilities"));
    expect(screen.getByRole("button",{name:"Enviar y leer documentos"})).toBeDisabled();
    expect(screen.getByRole("button",{name:"Prefiero llenarlo a mano"})).toBeEnabled();expect(client.upload).not.toHaveBeenCalled();
  });
  it("muestra el proveedor efectivo del servidor antes de habilitar el envío",async()=>{
    const {client}=cliente();vi.mocked(client.get).mockImplementationOnce(async()=>({extractionDisclosure:"PDF a GLM · Z.AI Standard; Excel nativo sin IA"}) as never);
    render(<DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1}/>);
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"),{target:{files:[archivo()]}});
    await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar y leer documentos"})).toBeEnabled());
    expect(screen.getByText(/PDF a GLM/)).toBeVisible();expect(client.upload).not.toHaveBeenCalled();
  });
  it("recupera la propuesta aunque la recepción idempotente ya llegue en ready",async()=>{
    const {client}=cliente({finishStatus:"ready"});
    render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1}/>);
    elegir([archivo()]);
    const preview=await screen.findByText("Ver datos detectados");fireEvent.click(preview);
    expect(screen.getByText("Vasos")).toBeVisible();expect(screen.getByRole("button",{name:"Aplicar al documento"})).toBeEnabled();expect(client.get).toHaveBeenCalledWith("job",{workspaceId:WORKSPACE.id,jobId:"job-1"});expect(client.post).not.toHaveBeenCalledWith("apply",expect.anything());
  });
  it("anuncia los formatos que de verdad acepta y no promete fotos", () => {
    const { client } = cliente();
    render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={null} onWorkspace={vi.fn()} client={client} />);
    for (const chip of ["XLSX", "CSV", "PDF", "15 MB"]) {
      expect(screen.getByText(chip)).toBeVisible();
    }
    expect(screen.queryByText("JPG")).not.toBeInTheDocument();
    expect(
      screen.getByText(/conviértelas a PDF antes de subirlas/i),
    ).toBeVisible();
  });

  it("rechaza en el navegador un archivo de más de 15 MB, sin gastar una llamada", () => {
    const { client } = cliente();
    render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={null} onWorkspace={vi.fn()} client={client} />);
    elegir([archivo("enorme.pdf", 16 * 1024 * 1024)]);
    expect(screen.getByRole("alert")).toHaveTextContent("15 MB");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("abre el workspace en la primera carga y lo sube al dueño del estado", async () => {
    const { client, calls } = cliente();
    const onWorkspace = vi.fn();
    render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={null} onWorkspace={onWorkspace} client={client} />);
    elegir([archivo()]);
    await waitFor(() => expect(onWorkspace).toHaveBeenCalledWith(WORKSPACE));
    expect(calls.map((c) => c.action)).toEqual(["open", "upload", "uploaded"]);
    expect(client.upload).toHaveBeenCalledWith(
      "https://upload.test/x",
      expect.any(File),
      "application/pdf",
    );
  });

  it("NO aplica la extracción por su cuenta: espera el clic del cliente", async () => {
    const { client } = cliente();
    const onWorkspace = vi.fn();
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba"
        workspace={WORKSPACE}
        onWorkspace={onWorkspace}
        client={client}
        pollMs={1}
      />,
    );
    elegir([archivo()]);
    await screen.findByRole("button", { name: "Aplicar al documento" });

    expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    expect(
      screen.getByText(/no se escribe en tu documento hasta que lo apliques/i),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Aplicar al documento" }));
    await waitFor(() =>
      expect(client.post).toHaveBeenCalledWith(
        "apply",
        expect.objectContaining({ jobId: "job-1", expectedRevision: 3 }),
      ),
    );
    // Lo que sube tiene que ser un WORKSPACE USABLE, no el recibo de `apply`.
    // Sin `id` el guardado siguiente sale con `workspaceId: undefined` → 404;
    // sin `draft` el editor de arriba se queda vacío justo después de aplicar.
    await waitFor(() => expect(onWorkspace).toHaveBeenCalled());
    const subido = onWorkspace.mock.calls.at(-1)![0] as DocumentWorkspace;
    expect(subido.id).toBe(WORKSPACE.id);
    expect(subido.revision).toBe(4);
    expect(subido.draft.products.map((p) => p.name)).toEqual(["Vasos", "Tapas"]);
  });

  it("cuenta las cajas una sola vez aunque dos productos compartan el grupo", async () => {
    const { client } = cliente();
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
    );
    elegir([archivo()]);
    // 2 productos, 5 cajas (no 10), 15 kg y 2,5 m³ contados una vez.
    await screen.findByText("2 productos · 5 cajas · 15 kg · 2.5 m³");
  });

  it("muestra 'pendiente' en vez de inventar un cero cuando falta el peso", async () => {
    const draft = extraido();
    draft.groups[0].grossWeightKg = null;
    const { client } = cliente({ jobResult: draft });
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
    );
    elegir([archivo()]);
    const resumen = await screen.findByText(/2 productos/);
    expect(resumen).toHaveTextContent("pendiente kg");
    expect(resumen).not.toHaveTextContent("0 kg");
  });

  it("traduce el fallo por código y deja abierta la salida manual", async () => {
    const { client } = cliente({ jobStatuses: ["failed"], jobErrorCode: "legacy_xls" });
    const onManual = vi.fn();
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba"
        workspace={WORKSPACE}
        onWorkspace={vi.fn()}
        onManual={onManual}
        client={client}
        pollMs={1}
      />,
    );
    elegir([archivo("viejo.xls")]);
    await screen.findByText(/Guarda el XLS como XLSX o PDF/i);
    expect(screen.queryByRole("button", { name: "Aplicar al documento" })).not.toBeInTheDocument();

    const manual = screen.getByRole("button", { name: "Prefiero llenarlo a mano" });
    expect(manual).toBeEnabled();
    fireEvent.click(manual);
    expect(onManual).toHaveBeenCalled();
  });

  it("nunca filtra el mensaje crudo del servidor al cliente", async () => {
    const { client } = cliente({
      uploadFalla: new DocumentRequestError(
        503,
        "upload_unavailable",
        "PGRST301 storage.objects row-level security violation",
      ),
    });
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
    );
    elegir([archivo()]);
    await screen.findByText(/No pudimos leer este archivo/i);
    expect(screen.queryByText(/PGRST301/)).not.toBeInTheDocument();
    expect(screen.queryByText(/row-level security/)).not.toBeInTheDocument();
  });

  it("arranca en chino cuando el proveedor abre el enlace", () => {
    const { client } = cliente();
    render(
      <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={null} onWorkspace={vi.fn()} client={client} locale="zh" />,
    );
    expect(screen.getByRole("heading", { name: "上传文件，我们来填写" })).toBeVisible();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeVisible();
  });

  describe("recuperación del sondeo e identidad de la compra", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    it.each(["ready", "partial"])("recupera %s después de un GET fallido y espera Aplicar, sin volver a subir", async (status) => {
      const { client } = cliente({ finishStatus: status, jobStatuses: [status], idempotent: true });
      const onWorkspace = vi.fn();
      vi.mocked(client.get).mockRejectedValueOnce(new DocumentRequestError(0, "network", ""));
      render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={onWorkspace} onReview={vi.fn()} client={client} pollMs={10} />);

      await act(async () => { elegir([archivo()]); });
      expect(screen.getByRole("button", { name: "Aplicar al documento" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Revisar documento" })).toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(client.get).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Ver datos detectados")).not.toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(client.get).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByText("Ver datos detectados"));
      expect(screen.getByText("Vasos")).toBeVisible();
      expect(screen.getByRole("button", { name: "Aplicar al documento" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Revisar documento" })).toBeEnabled();
      expect(client.upload).not.toHaveBeenCalled();
      expect(vi.mocked(client.post).mock.calls.filter(([action]) => action === "upload")).toHaveLength(1);
      expect(vi.mocked(client.post).mock.calls.filter(([action]) => action === "uploaded")).toHaveLength(1);
      expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
      expect(onWorkspace).not.toHaveBeenCalled();

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Aplicar al documento" })); });
      expect(client.post).toHaveBeenCalledWith("apply", expect.objectContaining({ workspaceId: WORKSPACE.id, jobId: "job-1", expectedRevision: 3 }));
      expect(onWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: WORKSPACE.id, revision: 4 }));
    });

    it("cancela el próximo sondeo al desmontar después de un GET fallido", async () => {
      const { client } = cliente({ finishStatus: "ready", idempotent: true });
      const onWorkspace = vi.fn();
      vi.mocked(client.get).mockRejectedValueOnce(new DocumentRequestError(0, "network", ""));
      const view = render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      await act(async () => { elegir([archivo()]); });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(client.get).toHaveBeenCalledTimes(1);
      view.unmount();
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      expect(client.get).toHaveBeenCalledTimes(1);
      expect(onWorkspace).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    });

    it("ignora una propuesta que llega después del desmontaje sin iniciar otro tick", async () => {
      const { client } = cliente({ finishStatus: "ready", idempotent: true });
      const response = pendiente<Propuesta>();
      const onWorkspace = vi.fn();
      vi.mocked(client.get).mockImplementationOnce(() => response.promise as never);
      const view = render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      await act(async () => { elegir([archivo()]); });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(client.get).toHaveBeenCalledTimes(1);
      view.unmount();
      await act(async () => {
        response.resolve({ job: { status: "ready", result: extraido(), errorCode: null } });
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(client.get).toHaveBeenCalledTimes(1);
      expect(onWorkspace).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    });

    it("cambiar de compra elimina sus archivos e ignora el GET anterior todavía pendiente", async () => {
      const other: DocumentWorkspace = { ...WORKSPACE, id: "00000000-0000-4000-8000-000000000002" };
      const oldResponse = pendiente<Propuesta>();
      const currentDraft = extraido();
      currentDraft.products[0].name = "Producto de compra B";
      const oldDraft = extraido();
      oldDraft.products[0].name = "Producto obsoleto de compra A";
      const { client } = cliente();
      const onWorkspace = vi.fn();
      vi.mocked(client.post).mockImplementation(async (action, body) => {
        if (action === "upload") return { jobId: body?.workspaceId === WORKSPACE.id ? "job-A" : "job-B", status: "ready" } as never;
        if (action === "uploaded") return { jobId: body?.jobId, status: "ready" } as never;
        throw new Error("POST no esperado: " + action);
      });
      vi.mocked(client.get).mockImplementation((action, params) => {
        if (action !== "job") throw new Error("GET no esperado: " + action);
        if (params?.workspaceId === WORKSPACE.id && params.jobId === "job-A") return oldResponse.promise as never;
        if (params?.workspaceId === other.id && params.jobId === "job-B") return Promise.resolve({ job: { status: "ready", result: currentDraft, errorCode: null } }) as never;
        throw new Error("El trabajo no pertenece a esta compra");
      });
      const view = render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={WORKSPACE} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      await act(async () => { elegir([archivo("compra-A.pdf")]); });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      expect(client.get).toHaveBeenCalledWith("job", { workspaceId: WORKSPACE.id, jobId: "job-A" });

      view.rerender(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={other} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      expect(screen.queryByText("compra-A.pdf")).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      expect(client.get).toHaveBeenCalledTimes(1);
      expect(client.get).not.toHaveBeenCalledWith("job", { workspaceId: other.id, jobId: "job-A" });

      await act(async () => { elegir([archivo("compra-B.pdf")]); });
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      fireEvent.click(screen.getByText("Ver datos detectados"));
      expect(screen.getByText("Producto de compra B")).toBeVisible();
      await act(async () => {
        oldResponse.resolve({ job: { status: "ready", result: oldDraft, errorCode: null } });
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(client.get).toHaveBeenCalledTimes(2);
      expect(client.get).toHaveBeenCalledWith("job", { workspaceId: other.id, jobId: "job-B" });
      expect(screen.getByText("Producto de compra B")).toBeVisible();
      expect(screen.queryByText("Producto obsoleto de compra A")).not.toBeInTheDocument();
      expect(onWorkspace).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    });

    it("conserva la carga cuando el padre adopta el workspace abierto desde null", async () => {
      const { client } = cliente({ finishStatus: "ready" });
      const published = vi.fn();
      function Parent() {
        const [workspace, setWorkspace] = useState<DocumentWorkspace | null>(null);
        return <DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={workspace} onWorkspace={(next) => { published(next); setWorkspace(next); }} client={client} pollMs={10} />;
      }
      render(<Parent />);
      await act(async () => { elegir([archivo("primera-carga.pdf")]); });
      expect(published).toHaveBeenCalledOnce();
      expect(published).toHaveBeenCalledWith(WORKSPACE);
      expect(screen.getByText("primera-carga.pdf")).toBeVisible();
      expect(client.upload).toHaveBeenCalledOnce();
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      fireEvent.click(screen.getByText("Ver datos detectados"));
      expect(screen.getByText("Vasos")).toBeVisible();
      expect(screen.getByRole("button", { name: "Aplicar al documento" })).toBeEnabled();
      expect(client.get).toHaveBeenCalledWith("job", { workspaceId: WORKSPACE.id, jobId: "job-1" });
      expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    });

    it("una apertura tardía no publica ni inicia cargas sobre la compra anterior", async () => {
      const { client } = cliente();
      const response = pendiente<{ workspace: DocumentWorkspace }>();
      const other: DocumentWorkspace = { ...WORKSPACE, id: "00000000-0000-4000-8000-000000000002" };
      const onWorkspace = vi.fn();
      vi.mocked(client.post).mockImplementationOnce(() => response.promise as never);
      const view = render(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={null} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      await act(async () => { elegir([archivo("apertura-anterior.pdf")]); });
      expect(client.post).toHaveBeenCalledWith("open", {});
      view.rerender(<DocumentImportPanel extractionDisclosure="Proveedor sintético de prueba" workspace={other} onWorkspace={onWorkspace} client={client} pollMs={10} />);
      await act(async () => {
        response.resolve({ workspace: WORKSPACE });
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.queryByText("apertura-anterior.pdf")).not.toBeInTheDocument();
      expect(onWorkspace).not.toHaveBeenCalled();
      expect(client.post).toHaveBeenCalledTimes(1);
      expect(client.upload).not.toHaveBeenCalled();
      expect(client.get).not.toHaveBeenCalled();
    });
  });
});
