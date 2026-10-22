/**
 * SDD-0473 · Lo que esta pantalla no puede romper al guardar.
 *
 * El RPC devuelve un recibo; S2 añade el workspace autoritativo proyectado al RECIBO
 * (`save_document_workspace` en la migración 0457 hace `return receipt`), con
 * revisión, folio y confirmación. La UI adopta receipt.workspace, nunca el recibo entero.
 *
 * Adoptar ese recibo como si fuera el workspace costaba dos fallas que sólo se
 * ven usando la pantalla: el `id` se perdía y el guardado siguiente salía con
 * `workspaceId: undefined` → 404 hasta recargar; y el `draft` se perdía, así
 * que el editor desaparecía justo después de aplicar una extracción.
 *
 * La primera prueba guarda DOS VECES a propósito: con un solo guardado el defecto
 * no aparece, y es la que mata el mutante «adoptar el recibo entero» (cae con
 * `expected undefined to be '0000…0001'`, que es el defecto mismo).
 *
 * La segunda NO discrimina esa mutación —el borrador vive en su propio estado y
 * sobrevive igual— y no se deja acá como si lo hiciera: es guardia de regresión
 * de que un guardado no vacía el editor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { DocumentRequestError, type DocumentClient, type DocumentWorkspace } from "@/components/document-import/document-client";
import { DocumentReviewClient } from "./DocumentReviewClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const EXTRACTION_DISCLOSURE = "Proveedor sintético de la prueba: lectura aislada de PDF, sin servicio externo real.";
const EXTRACTION_CAPABILITIES = {
  available: true, portal: true, extractionDisclosure: EXTRACTION_DISCLOSURE,
  formats: ["xlsx", "csv", "pdf"],
};

const WORKSPACE: DocumentWorkspace = {
  id: "00000000-0000-4000-8000-000000000001",
  revision: 3,
  draft: emptyDocumentDraft(),
  confirmedRevision: null,
  expiresAt: null,
};

/** Responde como el servidor de verdad: `save` devuelve un recibo, no un workspace. */
function cliente() {
  const calls: { action: string; body?: Record<string, unknown> }[] = [];
  let revision = WORKSPACE.revision;
  const client: DocumentClient = {
    get: vi.fn(async (action: string) => {
      calls.push({ action });
      if (action === "capabilities") return EXTRACTION_CAPABILITIES as never;
      if (action === "destinations") return { cities: [] } as never;
      if (action === "workspace")
        return { workspace: { ...WORKSPACE, revision } } as never;
      throw new Error("acción GET no esperada: " + action);
    }),
    post: vi.fn(async (action: string, body?: Record<string, unknown>) => {
      calls.push({ action, body });
      if (action === "open") return { workspace: WORKSPACE } as never;
      if (action === "save") {
        // El servidor rechaza una revisión que no es la que él tiene. Es
        // exactamente lo que pasaría si la pantalla no adoptara la nueva.
        if (body?.expectedRevision !== revision)
          throw new Error(
            `revisión esperada ${revision}, llegó ${String(body?.expectedRevision)}`,
          );
        revision += 1;
        return { revision, confirmed: false, folio: "DOC-1", versionNo: 1, workspace: { ...WORKSPACE, revision, draft: body.draft } } as never;
      }
      throw new Error("acción POST no esperada: " + action);
    }),
    upload: vi.fn(async () => undefined),
    download: vi.fn(async () => new Blob()),
    setAnonymousToken: vi.fn(),
    id: () => "11111111-1111-4111-8111-111111111111",
  };
  return { client, calls };
}

const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
/** Ensuciar el borrador: agregar un producto dispara `onChange` del editor. */
const ensuciar = () =>
  fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocumentReviewClient · guardar dos veces (SDD-0473)", () => {
  it("muestra el valor autoritativo del recibo, aunque difiera del valor enviado", async () => {
    const { client } = cliente(); const normalPost = vi.mocked(client.post).getMockImplementation()!;
    vi.mocked(client.post).mockImplementation(async (action, body) => {
      if (action !== "save") return normalPost(action, body) as never;
      const saved = { ...emptyDocumentDraft(), supplier: { ...emptyDocumentDraft().supplier, company: "Empresa normalizada en servidor" } };
      return { revision: 4, confirmed: false, workspace: { ...WORKSPACE, revision: 4, draft: saved } } as never;
    });
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client}/>);
    await screen.findByRole("button", { name: "Guardar borrador" });
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Clon enviado" } }); guardar();
    expect(await screen.findByDisplayValue("Empresa normalizada en servidor")).toBeVisible();
    expect(screen.queryByDisplayValue("Clon enviado")).not.toBeInTheDocument();
  });
  it("un recibo incompleto conserva cambios y no habilita una descarga como guardada", async () => {
    const { client } = cliente(); const normalPost = vi.mocked(client.post).getMockImplementation()!;
    vi.mocked(client.post).mockImplementation(async (action, body) => action === "save" ? { revision: 4, confirmed: false } as never : normalPost(action, body) as never);
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client}/>);
    await screen.findByRole("button", { name: "Guardar borrador" });
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Conservar este cambio" } }); guardar();
    await screen.findByText(/No pudimos confirmar el guardado/);
    expect(screen.getByDisplayValue("Conservar este cambio")).toBeVisible();
    expect(screen.getByRole("button", { name: "Descargar Excel guardado" })).toBeDisabled();
  });
  it("espera también la capacidad del portal antes de abrir un documento compartido", async () => {
    const { client } = cliente();
    vi.mocked(client.get).mockResolvedValue({ available: true, portal: false });
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client} />);
    await screen.findByText(/el documento compartido todavía no está disponible/i);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("cambiar de compra desmonta los datos anteriores antes de cargar el documento nuevo", async () => {
    const { client, calls } = cliente();
    let abrirOtra!: (value: unknown) => void;
    const otraRespuesta = new Promise<unknown>((resolve) => { abrirOtra = resolve; });
    const guardarNormal = vi.mocked(client.post).getMockImplementation()!;
    vi.mocked(client.post).mockImplementation(async (action, body) => {
      if (action === "open" && body?.purchaseCode === "DTD-0002-1") return await otraRespuesta as never;
      return guardarNormal(action, body);
    });
    const { rerender } = render(<DocumentReviewClient code="DTD-0001-1" shareToken="proveedor-a" client={client} />);
    await screen.findByRole("button", { name: "Guardar borrador" });
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Edición exclusiva de compra A" } });
    rerender(<DocumentReviewClient code="DTD-0002-1" shareToken="proveedor-b" client={client} />);
    expect(screen.queryByDisplayValue("Edición exclusiva de compra A")).not.toBeInTheDocument();
    expect(screen.getByText(/abriendo el documento de tu compra/i)).toBeInTheDocument();
    expect(calls.filter((call) => call.action === "save")).toHaveLength(0);
    const otra = { ...WORKSPACE, id: "00000000-0000-4000-8000-000000000002", draft: { ...emptyDocumentDraft(), supplier: { ...emptyDocumentDraft().supplier, company: "Proveedor B" } } };
    await act(async () => { abrirOtra({ workspace: otra }); });
    expect(await screen.findByDisplayValue("Proveedor B")).toBeInTheDocument();
  });

  it("comparte solo la revisión guardada y conserva el editor tras el recibo", async () => {
    const { client } = cliente();
    render(<DocumentReviewClient code="DTD-0001-1" shareToken="proveedor-demo" client={client} />);
    await screen.findByRole("button", { name: "Copiar enlace" });
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Proveedor corregido" } });
    expect(screen.queryByRole("button", { name: "Copiar enlace" })).not.toBeInTheDocument();
    expect(screen.getByText(/guarda antes de compartir/i)).toBeInTheDocument();
    guardar();
    await screen.findByText(/Guardado\./);
    expect(screen.getByRole("button", { name: "Copiar enlace" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Proveedor corregido")).toBeInTheDocument();
  });

  it("un conflicto conserva la edición; comparar no adopta datos sin pedirlo", async () => {
    const { client } = cliente();
    const remoto = { ...WORKSPACE, revision: 4, draft: { ...emptyDocumentDraft(), supplier: { ...emptyDocumentDraft().supplier, company: "Proveedor en otra revisión" } } };
    vi.mocked(client.post).mockImplementation(async (action) => {
      if (action === "open") return { workspace: WORKSPACE } as never;
      if (action === "save") throw new DocumentRequestError(409, "revision_conflict", "conflicto");
      throw new Error("acción inesperada");
    });
    vi.mocked(client.get).mockImplementation(async (action) => {
      if (action === "capabilities") return EXTRACTION_CAPABILITIES as never;
      if (action === "destinations") return { cities: [] } as never;
      if (action === "workspace") return { workspace: remoto } as never;
      throw new Error("acción inesperada");
    });
    render(<DocumentReviewClient code="DTD-0001-1" shareToken="proveedor-demo" client={client} />);
    await screen.findByRole("button", { name: "Guardar borrador" });
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Mi corrección local" } });
    guardar();
    await screen.findByText(/Otra persona guardó una revisión/i);
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByDisplayValue("Mi corrección local")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Comparar con la versión compartida" }));
    await screen.findByRole("heading", { name: /compara antes de reemplazar/i });
    expect(screen.getByDisplayValue("Mi corrección local")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.getByRole("button", { name: "Comparar con la versión compartida" })).toHaveFocus();
    expect(screen.getByDisplayValue("Mi corrección local")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar enlace" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Comparar con la versión compartida" }));
    await screen.findByRole("heading", { name: /compara antes de reemplazar/i });
    fireEvent.click(screen.getByRole("button", { name: "Descartar mis cambios y usar revisión 4" }));
    expect(screen.queryByDisplayValue("Mi corrección local")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Proveedor en otra revisión")).toBeInTheDocument();
  });

  it("bloquea otra carga mientras hay correcciones sin guardar", async () => {
    const { client } = cliente();
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client} />);
    const input = await screen.findByLabelText("Elige tus archivos o suéltalos aquí");
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Corrección local" } });
    expect(input).toBeDisabled();
    expect(screen.getByText(/guarda tus cambios antes de agregar otro documento/i)).toBeInTheDocument();
    fireEvent.drop(input.closest("fieldset")!, { dataTransfer: { files: [new File(["x"], "nuevo.pdf", { type: "application/pdf" })] } });
    expect(vi.mocked(client.post).mock.calls.map(([action]) => action)).not.toContain("upload");
  });

  it("una importación que termina durante la edición conserva las correcciones locales", async () => {
    const { client } = cliente();
    let aplicar!: (value: unknown) => void;
    const applied = new Promise<unknown>((resolve) => { aplicar = resolve; });
    const imported = { ...WORKSPACE, revision: 4, draft: { ...emptyDocumentDraft(), supplier: { ...emptyDocumentDraft().supplier, company: "Proveedor importado" } } };
    vi.mocked(client.get).mockImplementation(async (action) => {
      if (action === "capabilities") return EXTRACTION_CAPABILITIES as never;
      if (action === "destinations") return { cities: [] } as never;
      if (action === "job") return { job: { status: "ready", result: emptyDocumentDraft(), errorCode: null } } as never;
      if (action === "workspace") return { workspace: imported } as never;
      throw new Error("acción GET inesperada");
    });
    vi.mocked(client.post).mockImplementation(async (action) => {
      if (action === "open") return { workspace: WORKSPACE } as never;
      if (action === "upload") return { jobId: "job-demo", status: "uploading", uploadUrl: "https://upload.test/demo", contentType: "application/pdf" } as never;
      if (action === "uploaded") return { jobId: "job-demo", status: "queued" } as never;
      if (action === "apply") return await applied as never;
      throw new Error("acción POST inesperada");
    });
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client} />);
    const input = await screen.findByLabelText("Elige tus archivos o suéltalos aquí");
    const archivo = new File(["contenido"], "proforma.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [archivo] } });
    expect(client.upload).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalledWith("upload", expect.anything());
    expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de documento" }), {
      target: { value: "proforma" },
    });
    expect(client.upload).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalledWith("upload", expect.anything());
    expect(client.post).not.toHaveBeenCalledWith("apply", expect.anything());
    expect(await screen.findByText(EXTRACTION_DISCLOSURE, { exact: false })).toBeVisible();
    const enviar = screen.getByRole("button", { name: "Enviar y leer documentos" });
    await waitFor(() => expect(enviar).toBeEnabled());
    fireEvent.click(enviar);
    await waitFor(() => expect(client.post).toHaveBeenCalledWith("upload", expect.objectContaining({ kind: "proforma" })));
    const aplicarBoton = await screen.findByRole("button", { name: "Aplicar al documento" }, { timeout: 6000 });
    fireEvent.click(aplicarBoton);
    fireEvent.change(screen.getByRole("textbox", { name: "Empresa" }), { target: { value: "Mi cambio mientras se aplicaba" } });
    await act(async () => { aplicar({ revision: 4, confirmed: false }); });
    await screen.findByText(/el documento importado llegó mientras editabas/i);
    expect(screen.getByDisplayValue("Mi cambio mientras se aplicaba")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /compara antes de reemplazar/i })).toBeInTheDocument();
  });

  it("el segundo guardado sigue llevando el id del documento", async () => {
    const { client, calls } = cliente();
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client} />);
    await screen.findByRole("button", { name: "Guardar borrador" });

    ensuciar();
    guardar();
    await waitFor(() => expect(screen.getByText(/Guardado\./)).toBeInTheDocument());

    // Ensuciar otra vez: el botón de agregar queda bloqueado mientras hay un
    // producto abierto, así que se corrige el que ya está.
    fireEvent.change(screen.getByRole("textbox", { name: "Producto" }), {
      target: { value: "Vasos" },
    });
    guardar();
    await waitFor(() => expect(calls.filter((c) => c.action === "save")).toHaveLength(2));

    // Sin el arreglo, el recibo pisaba el workspace y acá llegaba `undefined`.
    const segundo = calls.filter((c) => c.action === "save")[1]!.body!;
    expect(segundo.workspaceId).toBe(WORKSPACE.id);
    // Y la revisión tiene que haber avanzado: el falso lanza si no coincide.
    expect(segundo.expectedRevision).toBe(4);
  });

  it("el editor sigue en pantalla después de guardar, con lo que el cliente escribió", async () => {
    const { client } = cliente();
    render(<DocumentReviewClient code="DTD-0001-1" shareToken={null} client={client} />);
    await screen.findByRole("button", { name: "Guardar borrador" });

    ensuciar();
    fireEvent.change(screen.getByRole("textbox", { name: "Producto" }), {
      target: { value: "Vasos de vidrio" },
    });
    guardar();
    await waitFor(() => expect(screen.getByText(/Guardado\./)).toBeInTheDocument());

    // El borrador es el que acabamos de mandar: adoptar el recibo lo borraba.
    expect(screen.getByDisplayValue("Vasos de vidrio")).toBeInTheDocument();
  });
});
