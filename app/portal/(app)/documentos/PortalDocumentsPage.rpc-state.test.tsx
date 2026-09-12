import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0342 · composición de /portal/documentos según lo que devuelva la RPC
 * 0406, ya aplicada en producción. Si la lectura de packing lists falla —ACL
 * revocada, error de PostgREST o transporte caído—, la página conserva los
 * documentos de envío (leídos por RLS y firmados server-only) y sólo omite los
 * packing lists; si además el cliente no tenía documentos de envío, ve el
 * estado vacío con contacto al asesor en vez de una pantalla rota.
 *
 * Los casos llamados «RPC ausente» simulan esa respuesta adversa con un mock;
 * no son el estado de la base. Lo que se afirma en todos es que la página nunca
 * construye service_role para leer packing lists.
 */
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
  getProfileCompleteness: vi.fn(),
  listSignedPortalDocuments: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/portal/documentos" }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/portal-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portal/portal-queries")>()),
  getProfileCompleteness: mocks.getProfileCompleteness,
}));
vi.mock("@/lib/portal/signed-portal-documents", () => ({
  listSignedPortalDocuments: mocks.listSignedPortalDocuments,
}));

import PortalDocumentsPage from "./page";

const bl = {
  document: {
    id: "doc-1",
    docType: "bl" as const,
    storagePath: "tenant-a/ship-1/bl.pdf",
    fileName: "bl.pdf",
    contentType: "application/pdf",
    sizeBytes: 2048,
    createdAt: "2026-09-02T00:00:00Z",
    shipmentCode: "DTDU-0001",
  },
  url: "https://storage.test/bl" as string | null,
};

const RPC_AUSENTE = {
  data: null,
  error: {
    code: "PGRST202",
    message:
      "Could not find the function public.get_portal_packing_list_documents without parameters in the schema cache",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfileCompleteness.mockResolvedValue(null);
});
afterEach(cleanup);

async function renderPage() {
  render(await PortalDocumentsPage());
}

describe("/portal/documentos · estados de la RPC 0406", () => {
  it("RPC ausente: conserva los documentos de envío firmados y omite packing lists", async () => {
    mocks.rpc.mockResolvedValue(RPC_AUSENTE);
    mocks.listSignedPortalDocuments.mockResolvedValue([bl]);

    await renderPage();

    expect(screen.getByText("Envío DTDU-0001")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Descargar .*Envío DTDU-0001/ }),
    ).toHaveAttribute("href", "https://storage.test/bl");
    expect(screen.queryByText(/^Compra /)).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_portal_packing_list_documents");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("RPC ausente y sin documentos de envío: estado vacío con contacto al asesor", async () => {
    mocks.rpc.mockResolvedValue(RPC_AUSENTE);
    mocks.listSignedPortalDocuments.mockResolvedValue([]);

    await renderPage();

    expect(screen.getByText("Todavía no hay documentos.")).toBeInTheDocument();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("RPC presente: el packing list enlaza a su compra dentro del Portal", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "pl-1",
          purchase_code: "PRE-0001",
          folio: "DTD-PL-2026-0001",
          submitted_at: "2026-09-03T00:00:00Z",
          boxes: 4,
        },
      ],
      error: null,
    });
    mocks.listSignedPortalDocuments.mockResolvedValue([bl]);

    await renderPage();

    expect(
      screen.getByRole("link", { name: "Ver Packing list · Compra PRE-0001" }),
    ).toHaveAttribute("href", "/portal/compras/PRE-0001");
    expect(screen.getByText("Envío DTDU-0001")).toBeInTheDocument();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("firma no disponible: el documento sigue listado sin enlace de descarga", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.listSignedPortalDocuments.mockResolvedValue([{ ...bl, url: null }]);

    await renderPage();

    expect(screen.getByText("Enlace no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Descargar/ })).not.toBeInTheDocument();
  });
});
