/**
 * SDD-0473 · El contrato que hace seguro cablear esto en producción.
 *
 * Mientras la lectura de documentos no esté habilitada, el cliente no puede ver
 * ni un rastro de ella: el formulario manual tiene que quedar idéntico. Y si la
 * consulta falla, tampoco se ofrece — un error de red no puede prometer una
 * función que quizá no exista del otro lado.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { DocumentImportEntry } from "./DocumentImportEntry";
import { DocumentRequestError, type DocumentClient } from "./document-client";
import { emptyDocumentDraft } from "@/lib/shared/document-import";

afterEach(() => {
  cleanup();
  mocks.push.mockClear();
});
function cliente(capabilities: unknown, falla?: Error) {
  let revision = 0;
  const workspace = { id: "00000000-0000-4000-8000-000000000001", revision, draft: emptyDocumentDraft(), confirmedRevision: null, expiresAt: null };
  const get = vi.fn(async (action: string) => {
    if (action === "job") {
      // Sin esto el archivo queda "en cola" para siempre y nada se habilita.
      return { job: { status: "ready", result: emptyDocumentDraft(), errorCode: null } } as never;
    }
    if (action === "workspace") return { workspace: { ...workspace, revision } } as never;
    if (falla) throw falla;
    return capabilities as never;
  });
  const post = vi.fn(async (action: string) => {
    if (action === "open") {
      return { workspace } as never;
    }
    if (action === "upload") {
      return { jobId: "job-1", status: "uploading", uploadUrl: "https://upload.test/x", contentType: "application/pdf" } as never;
    }
    if (action === "uploaded") return { jobId: "job-1", status: "queued" } as never;
    if (action === "apply") { revision += 1; return { revision, confirmed: false } as never; }
    return {} as never;
  });
  const client: DocumentClient = {
    get,
    post,
    upload: vi.fn(async () => undefined),
    download: vi.fn(async () => new Blob()),
    setAnonymousToken: vi.fn(),
    id: () => "11111111-1111-4111-8111-111111111111",
  };
  return { client, get, post };
}

const titulo = "Carga tus documentos y los llenamos";

describe("DocumentImportEntry (SDD-0473)", () => {
  it("informa disponibilidad para ofrecer una sola carga en la compra", async () => {
    const { client } = cliente({ available: true, portal: true, formats: ["pdf"], maxBytes: 15728640 });
    const onAvailability = vi.fn();
    render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} onAvailability={onAvailability} />);
    await screen.findByRole("heading", { name: titulo });
    expect(onAvailability).toHaveBeenCalledWith(true);
  });

  it("el resumen permite abrir el documento sin subirlo otra vez ni crear uno al visitar la compra", async () => {
    const { client, post } = cliente({ available: true, portal: true, formats: ["xlsx"], maxBytes: 15728640 });
    render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" reviewHref="/portal/compras/DTD-0000-1-1/documento" presentation="overview" client={client} />);
    const abrir = await screen.findByRole("link", { name: "Abrir Packing List + Factura" });
    expect(abrir).toHaveAttribute("href", "/portal/compras/DTD-0000-1-1/documento");
    expect(screen.queryByLabelText("Elige tus archivos o suéltalos aquí")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("no renderiza nada mientras la función no está habilitada", async () => {
    const { client, get } = cliente({ available: false, formats: [], maxBytes: 0 });
    const { container } = render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("capabilities"));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(titulo)).not.toBeInTheDocument();
  });

  it("tampoco renderiza nada si no se pudo preguntar", async () => {
    const { client, get } = cliente(null, new DocumentRequestError(503, "unavailable", "sin servicio"));
    const { container } = render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("no ofrece la carga por un `available` que no sea exactamente true", async () => {
    for (const valor of ["true", 1, {}, null, undefined]) {
      const { client, get } = cliente({ available: valor, portal: true, formats: [], maxBytes: 0 });
      const { container, unmount } = render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
      await waitFor(() => expect(get).toHaveBeenCalled());
      expect(container, `available=${JSON.stringify(valor)} no debería ofrecerla`).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("con sólo la primera llave (el cotizador) la compra no ofrece cargar documentos", async () => {
    // DOCUMENT_IMPORT_ENABLED sola enciende el cotizador anónimo. Una compra con
    // documento compartido le cierra al proveedor el formulario de siempre (409),
    // y la pantalla donde confirmaría desde el documento todavía no existe.
    for (const portal of [false, undefined, "true", 1]) {
      const { client, get, post } = cliente({ available: true, portal, formats: ["xlsx"], maxBytes: 15728640 });
      const { container, unmount } = render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
      await waitFor(() => expect(get).toHaveBeenCalledWith("capabilities"));
      expect(container, `portal=${JSON.stringify(portal)} no debería ofrecerla`).toBeEmptyDOMElement();
      expect(post).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("muestra el panel cuando está habilitada", async () => {
    const { client } = cliente({ available: true, portal: true, formats: ["xlsx", "csv", "pdf"], maxBytes: 15728640 });
    render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
    expect(await screen.findByRole("heading", { name: titulo })).toBeVisible();
  });

  it("no ofrece revisar un documento que todavía no existe", async () => {
    const { client } = cliente({ available: true, portal: true, formats: [], maxBytes: 15728640 });
    render(
      <DocumentImportEntry
        purchaseCode="DTD-0000-1-1"
        reviewHref="/portal/compras/DTD-0000-1-1/documento"
        client={client}
      />,
    );
    await screen.findByRole("heading", { name: titulo });
    expect(screen.getByRole("button", { name: "Revisar documento" })).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("«Revisar documento» lleva a la compra, no a una pantalla anónima", async () => {
    const { client, post } = cliente({ available: true, portal: true, formats: [], maxBytes: 15728640 });
    render(
      <DocumentImportEntry
        purchaseCode="DTD-0000-1-1"
        reviewHref="/portal/compras/DTD-0000-1-1/documento"
        client={client}
      />,
    );
    await screen.findByRole("heading", { name: titulo });

    const { fireEvent } = await import("@testing-library/react");
    const archivo = new File(["x"], "proforma.pdf", { type: "application/pdf" });
    Object.defineProperty(archivo, "size", { value: 1024 });
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"), {
      target: { files: [archivo] },
    });

    const revisar = await screen.findByRole("button", { name: "Revisar documento" });
    const aplicar = await screen.findByRole("button", { name: "Aplicar al documento" }, { timeout: 6000 });
    expect(revisar).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(aplicar);
    await waitFor(() => expect(revisar).toBeEnabled());
    expect(post).toHaveBeenCalledWith("apply", expect.objectContaining({ expectedRevision: 0, workspaceId: "00000000-0000-4000-8000-000000000001" }));
    fireEvent.click(revisar);
    expect(mocks.push).toHaveBeenCalledWith("/portal/compras/DTD-0000-1-1/documento");
  });

  it("abre el documento contra la compra, no como anónimo que expira en 24 h", async () => {
    const { client, post } = cliente({ available: true, portal: true, formats: [], maxBytes: 15728640 });
    render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
    await screen.findByRole("heading", { name: titulo });

    const archivo = new File(["x"], "proforma.pdf", { type: "application/pdf" });
    Object.defineProperty(archivo, "size", { value: 1024 });
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"), {
      target: { files: [archivo] },
    });

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("open", { purchaseCode: "DTD-0000-1-1" }),
    );
  });

  it("al cambiar de compra reinicia los archivos y abre el nuevo documento en su propio ámbito", async () => {
    const { client, post } = cliente({ available: true, portal: true, formats: ["pdf"], maxBytes: 15728640 });
    const { rerender } = render(<DocumentImportEntry purchaseCode="DTD-0001-1" client={client} />);
    const input = await screen.findByLabelText("Elige tus archivos o suéltalos aquí");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(input, { target: { files: [new File(["compra-a"], "compra-a.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(post).toHaveBeenCalledWith("open", { purchaseCode: "DTD-0001-1" }));
    rerender(<DocumentImportEntry purchaseCode="DTD-0002-1" client={client} />);
    expect(screen.queryByText("compra-a.pdf")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Elige tus archivos o suéltalos aquí"), { target: { files: [new File(["compra-b"], "compra-b.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(post).toHaveBeenCalledWith("open", { purchaseCode: "DTD-0002-1" }));
  });
});
