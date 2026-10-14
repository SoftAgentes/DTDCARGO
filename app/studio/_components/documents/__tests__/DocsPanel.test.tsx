import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Tests del wiring CLIENT de la subida de versión en <DocsPanel> (SDD-0060
 * Slice B · fix UX pre-commit).
 *
 * Foco: el bug del finding INFO del review. addDocumentVersion puede resolver a
 * `{ fieldErrors }` (rechazo de mime/size/nombre) SIN `error`. <ActionButton>
 * solo inspecciona `result.error`, así que un fieldError-only se trataría como
 * ÉXITO → toast "subida" falso-positivo + cierre del form. El fix colapsa
 * `{ fieldErrors }` → `{ error }` (versionResultToActionResult) para que dispare
 * onError (banner) y NO el flash/cierre de éxito.
 *
 * Cubre:
 *  - el helper puro versionResultToActionResult (las 3 ramas)
 *  - flujo de UI: rechazo de validación → banner de error, sin toast.success,
 *    el form NO se cierra
 *  - flujo de UI happy: { ok: true } → toast.success + form se cierra
 */

// ─── Mocks ───────────────────────────────────────────────────
const mockAddDocumentVersion = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("@/app/studio/(app)/documentos/actions", () => ({
  uploadDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => ({})),
  addDocumentVersion: (...a: unknown[]) => mockAddDocumentVersion(...a),
  listDocumentVersionsAction: vi.fn(async () => []),
  signDocumentUrl: vi.fn(async () => null),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({
    success: (...a: unknown[]) => mockToastSuccess(...a),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// useT lo usa <ActionButton> para el label de loading; identity basta.
vi.mock("@/lib/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { DocsPanel, versionResultToActionResult } from "../DocsPanel";
import type { DocumentRow } from "@/lib/studio/documents/types";

function makeDoc(over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "doc-1",
    tenant_id: "t1",
    entity_type: "shipment",
    entity_id: "ship-1",
    folder: "operativos/transporte",
    doc_type: "BL",
    name: "BL COSCO",
    storage_path: "t1/shipment/ship-1/aaa.pdf",
    bucket_id: "documents",
    content_type: "application/pdf",
    size_bytes: 1024,
    status: "vigente",
    valid_until: null,
    uploaded_by: "u1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    root_id: "11111111-1111-4111-8111-111111111111",
    version_no: 1,
    supersedes_id: null,
    is_current: true,
    version_note: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("versionResultToActionResult", () => {
  it("colapsa { fieldErrors } (sin error) al primer mensaje de campo", () => {
    const out = versionResultToActionResult({
      fieldErrors: { file: "Formato no permitido.", name: "Nombre largo." },
    });
    expect(out).toEqual({ error: "Formato no permitido." });
  });

  it("deja pasar { error } tal cual", () => {
    const out = versionResultToActionResult({ error: "Boom." });
    expect(out).toEqual({ error: "Boom." });
  });

  it("deja pasar { ok: true } tal cual (no inventa error)", () => {
    const out = versionResultToActionResult({ ok: true });
    expect(out).toEqual({ ok: true });
  });
});

describe("DocsPanel · subir nueva versión", () => {
  /** El input file de la VERSIÓN no tiene `name` (el de alta-nueva sí: name="file"). */
  function versionFileInput(): HTMLInputElement {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]:not([name])',
    );
    if (!input) throw new Error("no se encontró el input file de la versión");
    return input;
  }

  async function openVersionForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /Subir nueva versión/ }));
    // El input file aparece dentro del form de versión expandido.
    return screen.getByRole("button", { name: /Subir versión/ });
  }

  it("rechazo de validación ({ fieldErrors }) → muestra banner de error, NO dispara toast de éxito ni cierra el form", async () => {
    // El server rechaza con fieldErrors (mime/size/nombre); subimos un PDF válido
    // para pasar el guard local "Elige un archivo" y llegar a addDocumentVersion.
    mockAddDocumentVersion.mockResolvedValue({
      fieldErrors: { file: "Formato no permitido (PDF, imagen, xlsx, docx o zip)." },
    });
    const user = userEvent.setup();
    render(
      <DocsPanel entityType="shipment" entityId="ship-1" documents={[makeDoc()]} />,
    );

    const submit = await openVersionForm(user);
    await user.upload(
      versionFileInput(),
      new File([new Uint8Array(8)], "bl-v2.pdf", { type: "application/pdf" }),
    );
    await user.click(submit);

    // Llegó al server y el banner de error muestra el mensaje del fieldError.
    await waitFor(() => expect(mockAddDocumentVersion).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Formato no permitido/)).toBeInTheDocument(),
    );
    // NO se disparó el toast de éxito (sería el falso-positivo del bug).
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // El form de versión NO se cerró: el botón "Subir versión" sigue presente.
    expect(
      screen.getByRole("button", { name: /Subir versión/ }),
    ).toBeInTheDocument();
  });

  it("happy path ({ ok: true }) → dispara toast.success y cierra el form", async () => {
    mockAddDocumentVersion.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <DocsPanel entityType="shipment" entityId="ship-1" documents={[makeDoc()]} />,
    );

    const submit = await openVersionForm(user);
    await user.upload(
      versionFileInput(),
      new File([new Uint8Array(8)], "bl-v2.pdf", { type: "application/pdf" }),
    );
    await user.click(submit);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledTimes(1));
    // El form se cerró: vuelve el botón "+ Subir nueva versión".
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Subir nueva versión/ }),
      ).toBeInTheDocument(),
    );
  });
});
