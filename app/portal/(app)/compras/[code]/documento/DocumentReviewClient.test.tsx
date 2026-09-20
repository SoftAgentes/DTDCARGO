/**
 * SDD-0473 · Lo que esta pantalla no puede romper al guardar.
 *
 * `save` y `apply` NO devuelven el workspace: devuelven un RECIBO
 * (`save_document_workspace` en la migración 0457 hace `return receipt`), con
 * revisión, folio y confirmación — sin `id` y sin `draft`.
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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { emptyDocumentDraft } from "@/lib/shared/document-import";
import { type DocumentClient, type DocumentWorkspace } from "@/components/document-import/document-client";
import { DocumentReviewClient } from "./DocumentReviewClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
      if (action === "capabilities") return { available: true } as never;
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
        return { revision, confirmed: false, folio: "DOC-1", versionNo: 1 } as never;
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
