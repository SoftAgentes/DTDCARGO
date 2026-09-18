// @vitest-environment node
/**
 * SDD-0473 · La pantalla donde el cliente revisa el documento de su compra no
 * existe sin el interruptor del portal. `DOCUMENT_IMPORT_ENABLED` sola es el
 * cotizador anónimo; esta pantalla es documento de compra, y detrás de ella
 * viene el enlace del proveedor, que todavía no puede confirmar desde el documento.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  createClient: vi.fn(async () => ({})),
  principal: vi.fn(async () => null),
}));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("@/lib/db/server", () => ({ createClient: h.createClient }));
vi.mock("@/lib/portal/portal-queries", () => ({ getPortalClientPrincipal: h.principal }));
vi.mock("@/lib/studio/prealertas/queries", () => ({ getPrealertaByCode: vi.fn() }));
vi.mock("./DocumentReviewClient", () => ({ DocumentReviewClient: () => null }));

import PortalDocumentPage from "./page";

const abrir = () => PortalDocumentPage({ params: Promise.resolve({ code: "SYN-0001" }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("/portal/compras/[code]/documento detrás del portal (SDD-0473)", () => {
  it("con sólo la llave del cotizador es 404, sin abrir sesión ni consultar la compra", async () => {
    for (const portal of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", portal);
      await expect(abrir(), `portal=${JSON.stringify(portal)}`).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(h.createClient).not.toHaveBeenCalled();
  });

  it("con las dos llaves sigue su camino de siempre (sesión primero)", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
    await expect(abrir()).resolves.toBeNull();
    expect(h.createClient).toHaveBeenCalledTimes(1);
    expect(h.notFound).not.toHaveBeenCalled();
  });
});
