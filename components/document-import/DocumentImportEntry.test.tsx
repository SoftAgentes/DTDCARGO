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
import { DocumentImportEntry } from "./DocumentImportEntry";
import { DocumentRequestError, type DocumentClient } from "./document-client";

afterEach(cleanup);

function cliente(capabilities: unknown, falla?: Error) {
  const get = vi.fn(async () => {
    if (falla) throw falla;
    return capabilities as never;
  });
  const post = vi.fn(async () => ({}) as never);
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
      const { client, get } = cliente({ available: valor, formats: [], maxBytes: 0 });
      const { container, unmount } = render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
      await waitFor(() => expect(get).toHaveBeenCalled());
      expect(container, `available=${JSON.stringify(valor)} no debería ofrecerla`).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("muestra el panel cuando está habilitada", async () => {
    const { client } = cliente({ available: true, formats: ["xlsx", "csv", "pdf"], maxBytes: 15728640 });
    render(<DocumentImportEntry purchaseCode="DTD-0000-1-1" client={client} />);
    expect(await screen.findByRole("heading", { name: titulo })).toBeVisible();
  });

  it("abre el documento contra la compra, no como anónimo que expira en 24 h", async () => {
    const { client, post } = cliente({ available: true, formats: [], maxBytes: 15728640 });
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
});
