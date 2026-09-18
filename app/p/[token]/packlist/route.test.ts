// @vitest-environment node
/**
 * SDD-0473 · El formulario del proveedor, con el cotizador encendido y el portal no.
 *
 * `DOCUMENT_IMPORT_ENABLED` sola enciende el cotizador anónimo. Los documentos
 * ligados a una compra —los únicos que le cierran al proveedor este formulario—
 * nacen sólo con `DOCUMENT_IMPORT_PORTAL_ENABLED`. Así que con el portal apagado
 * una lectura caída de `document_workspaces` no puede frenar al proveedor: no hay
 * documento que esperar. Con el portal encendido, sí: falla cerrado.
 *
 * Lo que no cambia con ninguna bandera: si la compra YA tiene documento
 * compartido, el formulario viejo responde 409 (control del Director en 0473).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Reply = { data?: unknown; error?: unknown; count?: number };
const h = vi.hoisted(() => {
  const state = { workspace: {} as Reply, rpc: vi.fn() };
  const chain = (table: string) => {
    const reply = (): Reply =>
      table === "document_workspaces" ? state.workspace : table === "prealertas" ? { data: { boxes: 2 }, error: null } : { data: null, error: null, count: 0 };
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "insert"]) c[m] = () => c;
    c.maybeSingle = async () => reply();
    c.then = (ok: (v: Reply) => unknown, err: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, err);
    return c;
  };
  return {
    state,
    admin: { from: vi.fn((table: string) => chain(table)), rpc: state.rpc },
    ids: vi.fn(),
    share: vi.fn(),
    notify: vi.fn(),
  };
});
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/studio/prealertas/queries", () => ({ getPrealertaIdsByToken: h.ids, getProviderShareByToken: h.share }));
vi.mock("@/lib/studio/packing-list-notify", () => ({ notifyPackingListToAdmin: h.notify }));
vi.mock("@/lib/studio/prealertas/packlist-form", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/prealertas/packlist-form")>()),
  validatePackingListInput: () => ({
    input: {
      currency: "USD", docDate: null, supplierCompany: "Proveedor sintético", supplierContact: "", supplierEmail: "",
      supplierWechat: "wx-sintetico", supplierPhone: "", supplierAddress: "", supplierCity: "", supplierNote: "",
      rows: [], totals: { ctns: 2, qty: 10, amount: 20, weight: 30, cbm: 0.4 },
    },
    fieldErrors: {},
  }),
}));

import { GET, POST } from "./route";

const TOKEN = "33333333-3333-4333-8333-333333333333";
const params = { params: Promise.resolve({ token: TOKEN }) };
const LECTURA_CAIDA = { data: null, error: { code: "57014", message: "timeout" } };
const enviar = () =>
  POST(new NextRequest(`https://dtdcargo.test/p/${TOKEN}/packlist`, { method: "POST", body: JSON.stringify({ rows: [] }) }), params);
const descargar = () => GET(new NextRequest(`https://dtdcargo.test/p/${TOKEN}/packlist`), params);

beforeEach(() => {
  vi.clearAllMocks();
  h.ids.mockResolvedValue({ prealertaId: "p-1", tenantId: "t-1", markbox: "SYN-001", code: "SYN-0001" });
  h.share.mockResolvedValue({ code: "SYN-0001", markbox: "SYN-001" });
  h.state.rpc.mockResolvedValue({ data: { folio: "PL-1", version_no: 1 }, error: null });
  // Sin plantilla: la descarga que sigue de largo termina en 502, no en el 503 del documento.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
  vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST del proveedor con el cotizador encendido (SDD-0473)", () => {
  it("sin el portal, una lectura caída del documento compartido no le cierra el envío", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    h.state.workspace = LECTURA_CAIDA;
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, folio: "PL-1" });
    expect(h.state.rpc).toHaveBeenCalledWith("submit_packing_list", expect.objectContaining({ p_prealerta_id: "p-1" }));
  });

  it("con el portal, esa misma lectura caída falla cerrado y no registra nada", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
    h.state.workspace = LECTURA_CAIDA;
    const res = await enviar();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "shared_document_required" });
    expect(h.state.rpc).not.toHaveBeenCalled();
  });

  it("si la compra ya tiene documento compartido, 409 con cualquier bandera", async () => {
    h.state.workspace = { data: { id: "w-1" }, error: null };
    for (const portal of ["false", "true"]) {
      vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", portal);
      const res = await enviar();
      expect(res.status, `portal=${portal}`).toBe(409);
    }
    expect(h.state.rpc).not.toHaveBeenCalled();
  });
});

describe("GET del proveedor con el cotizador encendido (SDD-0473)", () => {
  it("sin el portal, una lectura caída no bloquea la plantilla; con el portal, sí", async () => {
    h.state.workspace = LECTURA_CAIDA;
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    expect((await descargar()).status).toBe(502);
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
    expect((await descargar()).status).toBe(503);
  });
});
