/**
 * SDD-0473 · Contratos que este panel no puede romper.
 *
 * No son pruebas de camino feliz: lo que se fija acá es que el panel nunca
 * aplique una extracción por su cuenta, nunca invente un dato que el documento
 * no traía, y nunca deje al cliente sin la salida manual cuando algo falla.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
}

describe("DocumentImportPanel (SDD-0473)", () => {
  it("recupera la propuesta aunque la recepción idempotente ya llegue en ready",async()=>{
    const {client}=cliente({finishStatus:"ready"});
    render(<DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1}/>);
    elegir([archivo()]);
    const preview=await screen.findByText("Ver datos detectados");fireEvent.click(preview);
    expect(screen.getByText("Vasos")).toBeVisible();expect(screen.getByRole("button",{name:"Aplicar al documento"})).toBeEnabled();expect(client.get).toHaveBeenCalledWith("job",{workspaceId:WORKSPACE.id,jobId:"job-1"});expect(client.post).not.toHaveBeenCalledWith("apply",expect.anything());
  });
  it("anuncia los formatos que de verdad acepta y no promete fotos", () => {
    const { client } = cliente();
    render(<DocumentImportPanel workspace={null} onWorkspace={vi.fn()} client={client} />);
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
    render(<DocumentImportPanel workspace={null} onWorkspace={vi.fn()} client={client} />);
    elegir([archivo("enorme.pdf", 16 * 1024 * 1024)]);
    expect(screen.getByRole("alert")).toHaveTextContent("15 MB");
    expect(client.post).not.toHaveBeenCalled();
  });

  it("abre el workspace en la primera carga y lo sube al dueño del estado", async () => {
    const { client, calls } = cliente();
    const onWorkspace = vi.fn();
    render(<DocumentImportPanel workspace={null} onWorkspace={onWorkspace} client={client} />);
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
      <DocumentImportPanel
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
      <DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
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
      <DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
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
      <DocumentImportPanel
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
      <DocumentImportPanel workspace={WORKSPACE} onWorkspace={vi.fn()} client={client} pollMs={1} />,
    );
    elegir([archivo()]);
    await screen.findByText(/No pudimos leer este archivo/i);
    expect(screen.queryByText(/PGRST301/)).not.toBeInTheDocument();
    expect(screen.queryByText(/row-level security/)).not.toBeInTheDocument();
  });

  it("arranca en chino cuando el proveedor abre el enlace", () => {
    const { client } = cliente();
    render(
      <DocumentImportPanel workspace={null} onWorkspace={vi.fn()} client={client} locale="zh" />,
    );
    expect(screen.getByRole("heading", { name: "上传文件，我们来填写" })).toBeVisible();
    expect(screen.getByRole("button", { name: "选择文件" })).toBeVisible();
  });
});
