// @vitest-environment node
/**
 * Contrato de la única puerta HTTP de la importación documental (SDD-0473).
 *
 * Fija lo que no se puede romper sin producir un dato falso, una fuga entre
 * usuarios o un documento equivocado en manos del proveedor:
 *
 *  · Origen: sólo la allowlist configurada y el propio origen, comparando el
 *    origen COMPLETO. Una escritura sin `Origin` se niega — es la defensa CSRF
 *    del portal, no un detalle de CORS.
 *  · `action=capabilities` es la única operación que vive con el flag apagado
 *    (es como la UI sabe si mostrarse); todo lo demás falla CERRADO cuando el
 *    módulo está apagado, cuando la cuota no se puede verificar o cuando falta
 *    el secreto anti-abuso.
 *  · El cuerpo tiene un techo de 2 MB comprobado dos veces —lo declarado y lo
 *    realmente recibido—, así que un `content-length` mentiroso no lo elude.
 *  · El proveedor comparte el documento, no la identidad ni los archivos del
 *    cliente: sin `action=job`, sin `action=apply` y sin `sources` en el
 *    historial.
 *  · Ningún error inesperado sale con su mensaje interno ni lo deja escrito en
 *    el log, y un JSON inválido es un 400 del cliente, nunca un 503 nuestro.
 *  · Lo que falta, falta: una compra sin taller viaja en null —no en 0 ni en
 *    ""—, y una lectura fallida no se degrada a una lista a medias.
 *  · El xlsx sale sellado como confirmado sólo si la revisión vigente ES la
 *    confirmada, con la marca de su compra real y un nombre de archivo que no
 *    se escapa de la cabecera.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { NextRequest } from "next/server";
import { emptyDocumentDraft, type DocumentDraft } from "@/lib/shared/document-import";

const h = vi.hoisted(() => {
  type Reply = { data?: unknown; error?: unknown };
  const state = {
    admin: {} as Record<string, Reply>,
    session: {} as Record<string, Reply>,
    quota: { data: true, error: null } as Reply,
    calls: [] as string[],
  };
  const CHAIN = ["select", "eq", "neq", "in", "is", "not", "or", "order", "limit", "range", "match", "gte", "lte", "insert", "update", "upsert", "delete"] as const;
  const client = (kind: "admin" | "session") => {
    const from = vi.fn((table: string) => {
      state.calls.push(`${kind}:${table}`);
      const resolve = () => state[kind][table] ?? { data: null, error: { message: `sin respuesta configurada para ${kind}:${table}` } };
      const chain: Record<string, unknown> = {};
      for (const method of CHAIN) chain[method] = () => chain;
      chain.maybeSingle = async () => resolve();
      chain.single = async () => resolve();
      chain.then = (ok: (v: Reply) => unknown, err: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, err);
      return chain;
    });
    const rpc = vi.fn(async (name: string) => { state.calls.push(`${kind}:rpc:${name}`); return state.quota; });
    return { from, rpc };
  };
  return {
    state,
    admin: client("admin"),
    session: client("session"),
    principal: vi.fn(),
    tokenIds: vi.fn(),
    getWorkspace: vi.fn(),
    openWorkspace: vi.fn(),
    reserveUpload: vi.fn(),
    saveWorkspace: vi.fn(),
    finishUpload: vi.fn(),
    processImportJob: vi.fn(),
    getEstimateRates: vi.fn(),
    estimateForRequest: vi.fn(),
    exportDocument: vi.fn(),
  };
});
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.admin }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session }));
vi.mock("@/lib/portal/portal-queries", () => ({ getPortalClientPrincipal: h.principal }));
vi.mock("@/lib/studio/prealertas/queries", () => ({ getPrealertaIdsByToken: h.tokenIds }));
// `projectWorkspace` y `applyImport` quedan REALES: la proyección del proveedor
// y su veto a `apply` son parte del contrato que se cruza por esta puerta.
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  getWorkspace: h.getWorkspace, openWorkspace: h.openWorkspace, reserveUpload: h.reserveUpload, saveWorkspace: h.saveWorkspace,
}));
vi.mock("./jobs", () => ({ finishUpload: h.finishUpload, processImportJob: h.processImportJob }));
vi.mock("./estimate", () => ({ getEstimateRates: h.getEstimateRates, estimateForRequest: h.estimateForRequest }));
// El armado del xlsx se prueba en su propia suite; aquí importa QUÉ sello y qué
// identidad le entrega esta puerta, porque eso es lo que el proveedor lee.
vi.mock("./export", () => ({ exportDocument: h.exportDocument }));

import { documentImportRequest, options } from "./http";
import * as route from "@/app/api/document-import/route";

const SITE = "https://dtdcargo.test";
const API = "https://api.dtdcargo.test";
const PORTAL = "https://portal.dtdcargo.test";
const SELF = "https://app.dtdcargo.test";
const ENDPOINT = `${SELF}/api/document-import`;
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PURCHASE_ID = "22222222-2222-4222-8222-222222222222";
const SHARE_TOKEN = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "44444444-4444-4444-8444-444444444444";
const CLIENT_ID = "55555555-5555-4555-8555-555555555555";
const MARKBOX = "DTD-001";
const ORIGINAL_FILE = "factura-original-del-cliente.pdf";

function draft(fileName = ORIGINAL_FILE): DocumentDraft {
  const d = emptyDocumentDraft();
  d.currency = "USD";
  d.products = [{ id: "p1", name: "Taza", nameZh: "杯子", code: "A1", brand: "", material: "", quantity: 10, unitPrice: 2, currency: "USD", unit: "pcs" }];
  d.sources = [{ id: "s1", fileName, kind: "proforma", locations: [{ path: "products.p1.quantity", sheet: null, cell: null, page: 3 }] }];
  return d;
}
const workspace = (over: Record<string, unknown> = {}) => ({
  id: WORKSPACE_ID, tenant_id: TENANT_ID, client_id: CLIENT_ID, prealerta_id: PURCHASE_ID, anonymous_hash: null,
  expires_at: null, draft: draft(), revision: 3, confirmed_revision: null, confirmed_submission_id: null, ...over,
});
/** Proveedor real: sólo el enlace compartido lo identifica, nunca un campo del cuerpo. */
function asSupplier() {
  h.tokenIds.mockResolvedValue({ prealertaId: PURCHASE_ID, tenantId: TENANT_ID, markbox: MARKBOX, code: "DTD-C-1" });
  h.state.admin.clients = { data: { id: CLIENT_ID }, error: null };
  return { "x-supplier-token": SHARE_TOKEN };
}
/** Cliente real: principal del portal vivo + la compra que le pertenece. */
function asClient() {
  h.principal.mockResolvedValue({ userId: "user-1", tenantId: TENANT_ID, client: { id: CLIENT_ID, markbox: MARKBOX } });
  h.state.session.prealertas = { data: { id: PURCHASE_ID, tenant_id: TENANT_ID, client_markbox: MARKBOX, code: "DTD-C-1", supplier_id: null, status: "pendiente" }, error: null };
  return {};
}

type Init = { method?: string; origin?: string; query?: Record<string, string>; headers?: Record<string, string>; body?: string };
function request(init: Init = {}): NextRequest {
  const url = new URL(ENDPOINT);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
  const headers = new Headers(init.headers ?? {});
  if (init.origin) headers.set("origin", init.origin);
  return new NextRequest(url, { method: init.method ?? "GET", headers, body: init.body });
}
const call = (init: Init = {}) => documentImportRequest(request(init));
const post = (body: unknown, init: Init = {}) => call({ method: "POST", origin: SITE, body: JSON.stringify(body), ...init });

let logged: MockInstance<(...args: unknown[]) => void>;
beforeEach(() => {
  vi.clearAllMocks();
  h.state.admin = {}; h.state.session = {}; h.state.quota = { data: true, error: null }; h.state.calls = [];
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  vi.stubEnv("NEXT_PUBLIC_HAILUWAY_API", API);
  vi.stubEnv("DOCUMENT_IMPORT_ALLOWED_ORIGINS", `no-es-una-url, ${PORTAL}`);
  vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
  // Cliente y proveedor viven detrás de la segunda llave: acá, encendida.
  vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "true");
  vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", "s".repeat(48));
  h.getWorkspace.mockResolvedValue(workspace());
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { logged.mockRestore(); vi.unstubAllEnvs(); });

describe("Puerta HTTP de importación documental", () => {
  it("sólo abre para los orígenes configurados y el propio, comparando el origen completo", async () => {
    for (const origin of [SITE, API, PORTAL, SELF]) {
      const res = await call({ origin, query: { action: "capabilities" } });
      expect([origin, res.status]).toEqual([origin, 200]);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    }
    // Mismo host con otro esquema/puerto, sufijo parecido y el origen opaco de
    // un iframe sandbox: ninguno es el portal, y echarles el ACAO sería regalar
    // las cookies del cliente a un sitio ajeno.
    for (const origin of ["http://dtdcargo.test", "https://dtdcargo.test:8443", "https://dtdcargo.test.evil.test", "https://evil.test", "null"]) {
      const res = await call({ origin, query: { action: "capabilities" } });
      expect([origin, res.status]).toEqual([origin, 403]);
      expect(await res.json()).toMatchObject({ code: "origin_denied" });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("vary")).toBe("Origin");
    }
  });

  it.each(["https://0.0.0.0:3000", "https://[::]:3000"])("la dirección donde escucha el servidor no abre nada: %s (SDD-0602)", async (escucha) => {
    // En el contenedor, `req.nextUrl.origin` es esa dirección. Sumarla le daba
    // las cookies del cliente a un origen que no es el portal.
    const contenedor = (origin: string) =>
      documentImportRequest(new NextRequest(`${escucha}/api/document-import?action=capabilities`, { headers: { origin } }));

    expect((await contenedor(SITE)).headers.get("access-control-allow-origin")).toBe(SITE);
    const denied = await contenedor(escucha);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: "origin_denied" });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("niega toda escritura que llegue sin Origin, antes de tocar la base", async () => {
    const res = await call({ method: "POST", body: JSON.stringify({ action: "save", workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "origin_required" });
    expect(h.state.calls).toEqual([]);
    expect(h.getWorkspace).not.toHaveBeenCalled();
    expect(h.saveWorkspace).not.toHaveBeenCalled();
  });

  it("el preflight rechazado no habilita al origen ajeno", async () => {
    const denied = options(request({ method: "OPTIONS", origin: "https://evil.test" }));
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
    expect(denied.headers.get("access-control-allow-methods")).toBeNull();
    const allowed = options(request({ method: "OPTIONS", origin: PORTAL }));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(PORTAL);
    expect(allowed.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(allowed.headers.get("access-control-allow-headers")).toContain("X-Supplier-Token");
  });

  it("no expone más métodos que GET, POST y OPTIONS, porque exigir Origin sólo cubre POST", () => {
    // La guarda anti-CSRF de http.ts:32 está atada a `method === "POST"`, y el
    // despacho trata como escritura a todo lo que no sea GET. Publicar un PUT o
    // un PATCH en esta ruta apagaría la guarda sin tocar http.ts.
    expect(Object.keys(route).filter((key) => /^[A-Z]+$/.test(key)).sort()).toEqual(["GET", "OPTIONS", "POST"]);
  });

  it("publica capabilities con el flag apagado y sin gastar base ni cuota", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "false");
    vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", "");
    const res = await call({ origin: PORTAL, query: { action: "capabilities" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false, portal: false, formats: ["xlsx", "csv", "pdf"], maxBytes: 15 * 1024 * 1024 });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(h.state.calls).toEqual([]);
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    expect(await (await call({ origin: PORTAL, query: { action: "capabilities" } })).json()).toMatchObject({ available: true, portal: true });
  });

  it("con sólo la llave del cotizador, capabilities lo dice y lo que es de una compra se niega sin tocar sus tablas", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_PORTAL_ENABLED", "false");
    expect(await (await call({ origin: PORTAL, query: { action: "capabilities" } })).json()).toMatchObject({ available: true, portal: false });

    asClient();
    h.state.calls = [];
    const denied = [
      await call({ origin: PORTAL, query: { action: "purchases" } }),
      await call({ origin: PORTAL, query: { action: "workspace", workspaceId: WORKSPACE_ID } }),
      await post({ action: "save", workspaceId: WORKSPACE_ID, expectedRevision: 3, commandId: WORKSPACE_ID, draft: draft() }, { headers: asSupplier() }),
    ];
    for (const res of denied) {
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ code: "portal_not_enabled" });
    }
    expect(h.state.calls.filter((c) => !c.endsWith("rpc:reserve_document_import_limit"))).toEqual([]);
    expect(h.principal).not.toHaveBeenCalled();
    expect(h.tokenIds).not.toHaveBeenCalled();
    expect(h.saveWorkspace).not.toHaveBeenCalled();
  });

  it("con el flag apagado, toda operación real se niega y capabilities no es un portillo", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "false");
    const denied = [
      await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } }),
      await call({ origin: SITE, query: { action: "destinations" } }),
      await post({ action: "save", workspaceId: WORKSPACE_ID }),
      // Un POST con `?action=capabilities` en la query sigue siendo una escritura.
      await post({ action: "save", workspaceId: WORKSPACE_ID }, { query: { action: "capabilities" } }),
    ];
    for (const res of denied) {
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ code: "not_configured" });
    }
    expect(h.getWorkspace).not.toHaveBeenCalled();
    expect(h.getEstimateRates).not.toHaveBeenCalled();
    expect(h.saveWorkspace).not.toHaveBeenCalled();
  });

  it("rechaza un cuerpo declarado grande sin llegar a leerlo", async () => {
    const req = request({ method: "POST", origin: SITE, headers: { "content-length": "2000001" }, body: JSON.stringify({ action: "save" }) });
    const res = await documentImportRequest(req);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "payload_too_large" });
    expect(req.bodyUsed).toBe(false);
    expect(h.getWorkspace).not.toHaveBeenCalled();
  });

  it("un content-length mentiroso no elude el techo de 2 MB", async () => {
    const req = request({
      method: "POST", origin: SITE, headers: { "content-length": "12" },
      body: `{"action":"save","workspaceId":"${WORKSPACE_ID}","relleno":"${"a".repeat(2_000_001)}"}`,
    });
    const res = await documentImportRequest(req);
    // Aquí sí se leyó el cuerpo: lo atajó la segunda comprobación, la de bytes
    // reales, no la barata del encabezado declarado.
    expect(req.bodyUsed).toBe(true);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "payload_too_large" });
    expect(h.getWorkspace).not.toHaveBeenCalled();
    expect(h.saveWorkspace).not.toHaveBeenCalled();
  });

  it("el proveedor no puede pedir el archivo original del cliente", async () => {
    const res = await call({ origin: PORTAL, headers: asSupplier(), query: { action: "job", workspaceId: WORKSPACE_ID, jobId: "66666666-6666-4666-8666-666666666666" } });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_allowed" });
    // Ni siquiera se consulta la tabla: no se confirma que el trabajo exista.
    expect(h.state.calls).not.toContain("admin:document_import_jobs");
  });

  it("el proveedor no puede aplicar una extracción sobre el documento", async () => {
    const res = await post({ action: "apply", workspaceId: WORKSPACE_ID, jobId: "66666666-6666-4666-8666-666666666666" }, { headers: asSupplier() });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_available" });
    expect(h.state.calls).not.toContain("admin:document_import_jobs");
    expect(h.saveWorkspace).not.toHaveBeenCalled();
  });

  it("el proveedor no puede cerrar una carga ajena aunque invente el jobId", async () => {
    const res = await post({ action: "uploaded", workspaceId: WORKSPACE_ID, jobId: "66666666-6666-4666-8666-666666666666" }, { headers: asSupplier() });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_allowed" });
    expect(h.finishUpload).not.toHaveBeenCalled();
    expect(h.processImportJob).not.toHaveBeenCalled();
    // Un cliente legítimo con un jobId que no es UUID tampoco entra al flujo.
    const bad = await post({ action: "uploaded", workspaceId: WORKSPACE_ID, jobId: "../../otro-taller" }, { headers: asClient() });
    expect(bad.status).toBe(403);
    expect(h.finishUpload).not.toHaveBeenCalled();
  });

  it("el historial del proveedor no dice de qué archivo salió cada dato", async () => {
    h.state.admin.document_workspace_versions = {
      data: [
        { revision: 2, draft: draft(), actor_kind: "client", confirmed: false, created_at: "2026-01-02T00:00:00Z" },
        { revision: 1, draft: draft("packing-list-interno.xlsx"), actor_kind: "client", confirmed: false, created_at: "2026-01-01T00:00:00Z" },
      ],
      error: null,
    };
    const query = { action: "history", workspaceId: WORKSPACE_ID };
    const supplier = await (await call({ origin: PORTAL, headers: asSupplier(), query })).json();
    expect(supplier.versions).toHaveLength(2);
    for (const version of supplier.versions) expect(version.draft.sources).toEqual([]);
    expect(JSON.stringify(supplier)).not.toContain("factura-original");
    expect(JSON.stringify(supplier)).not.toContain("packing-list-interno");
    // El mismo historial, para el dueño del documento, conserva la evidencia.
    const client = await (await call({ origin: PORTAL, headers: asClient(), query })).json();
    expect(client.versions[0].draft.sources[0]).toMatchObject({ fileName: ORIGINAL_FILE, kind: "proforma" });
    expect(client.versions[0].draft.sources[0].locations[0]).toMatchObject({ path: "products.p1.quantity", page: 3 });
  });

  it("la vista del documento tampoco le entrega al proveedor la evidencia del cliente", async () => {
    const query = { action: "workspace", workspaceId: WORKSPACE_ID };
    const supplier = await (await call({ origin: PORTAL, headers: asSupplier(), query })).json();
    expect(supplier.workspace.draft.sources).toEqual([]);
    expect(supplier.workspace.draft.products[0]).toMatchObject({ name: "Taza", quantity: 10 });
    const client = await (await call({ origin: PORTAL, headers: asClient(), query })).json();
    expect(client.workspace.draft.sources).toHaveLength(1);
  });

  it("si la cuota no se puede verificar, niega: nunca la convierte en permiso", async () => {
    h.state.quota = { data: null, error: { message: "rpc caída" } };
    const unavailable = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({ code: "quota_unavailable" });

    h.state.quota = { data: false, error: null };
    const exceeded = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(exceeded.status).toBe(429);
    expect(await exceeded.json()).toMatchObject({ code: "quota_exceeded" });

    // Sin secreto anti-abuso no hay límite computable: se apaga, no se abre.
    h.state.quota = { data: true, error: null };
    vi.stubEnv("DOCUMENT_IMPORT_RATE_SECRET", "corto");
    const unsalted = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(unsalted.status).toBe(503);
    expect(await unsalted.json()).toMatchObject({ code: "not_configured" });
    expect(h.getWorkspace).not.toHaveBeenCalled();
  });

  it("un JSON inválido es un 400 del cliente, nunca un 503 nuestro", async () => {
    for (const body of ["{sin comillas}", "", "[{\"action\":\"save\"}]", "null", "\"save\"", "123"]) {
      const res = await call({ method: "POST", origin: SITE, body });
      expect([body, res.status]).toEqual([body, 400]);
      expect(await res.json()).toMatchObject({ code: "invalid_json" });
    }
    expect(logged).not.toHaveBeenCalled();
    expect(h.getWorkspace).not.toHaveBeenCalled();
  });

  it("un documento inválido se distingue del fallo interno y no se confunde con un 503", async () => {
    h.saveWorkspace.mockRejectedValue(new Error("Documento inválido: products.id"));
    const res = await post({ action: "save", workspaceId: WORKSPACE_ID }, { headers: asClient() });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "invalid_document", error: "Documento inválido: products.id" });
    expect(logged).not.toHaveBeenCalled();
  });

  it("un fallo inesperado sale genérico y no deja el mensaje interno en el log", async () => {
    h.getWorkspace.mockRejectedValue(new Error("PostgREST 500 con SUPABASE_SERVICE_ROLE_KEY=sbp_secreto leyendo 'Taza de cerámica 250ml' de factura-original-del-cliente.pdf"));
    const res = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(res.status).toBe(503);
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ code: "unavailable" });
    for (const secret of ["sbp_secreto", "SERVICE_ROLE", "PostgREST", "Taza de cerámica", ORIGINAL_FILE]) expect(body).not.toContain(secret);
    expect(logged.mock.calls).toEqual([["[document-import] request_failed"]]);
    // Hasta el error viaja con las cabeceras de aislamiento y sin caché.
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("vary")).toBe("Origin");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("access-control-allow-origin")).toBe(SITE);
  });

  it("un actor sin credencial no distingue un documento ajeno de uno inexistente", async () => {
    h.principal.mockResolvedValue(null);
    const res = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "login_required" });

    // Principal válido de OTRO cliente: el documento existe, pero no es suyo.
    h.principal.mockResolvedValue({ userId: "user-2", tenantId: TENANT_ID, client: { id: "99999999-9999-4999-8999-999999999999", markbox: "DTD-999" } });
    const foreign = await call({ origin: SITE, query: { action: "workspace", workspaceId: WORKSPACE_ID } });
    expect(foreign.status).toBe(404);
    const body = await foreign.text();
    expect(JSON.parse(body)).toMatchObject({ code: "not_found" });
    // El 404 no filtra nada del documento ajeno que sí existe.
    for (const leak of [MARKBOX, ORIGINAL_FILE, "Taza", CLIENT_ID]) expect(body).not.toContain(leak);
  });

  it("una compra sin documento se reporta vacía, nunca con una revisión inventada", async () => {
    const OTHER_PURCHASE = "77777777-7777-4777-8777-777777777777";
    h.principal.mockResolvedValue({ userId: "user-1", tenantId: TENANT_ID, client: { id: CLIENT_ID, markbox: MARKBOX } });
    h.state.session.prealertas = { data: [{ id: PURCHASE_ID, code: "DTD-C-1" }, { id: OTHER_PURCHASE, code: "DTD-C-2" }], error: null };
    h.state.admin.document_workspaces = {
      data: [{ id: WORKSPACE_ID, prealerta_id: PURCHASE_ID, revision: 3, confirmed_revision: 2, draft: draft() }],
      error: null,
    };
    const { purchases } = await (await call({ origin: PORTAL, query: { action: "purchases" } })).json();
    expect(purchases).toHaveLength(2);
    expect(purchases[0]).toMatchObject({ workspaceId: WORKSPACE_ID, purchaseId: PURCHASE_ID, revision: 3, confirmedRevision: 2 });
    expect(purchases[0].draft.products[0]).toMatchObject({ name: "Taza", quantity: 10 });
    // La segunda compra NO tiene taller: ni revisión 0, ni confirmada 0, ni un
    // workspaceId vacío que la UI creería válido. Lo que falta, falta.
    expect(purchases[1]).toEqual({ workspaceId: null, purchaseId: OTHER_PURCHASE, code: "DTD-C-2", revision: null, confirmedRevision: null, draft: null });
  });

  it("si no se puede leer el estado de los documentos, no entrega una lista a medias", async () => {
    h.principal.mockResolvedValue({ userId: "user-1", tenantId: TENANT_ID, client: { id: CLIENT_ID, markbox: MARKBOX } });
    h.state.session.prealertas = { data: [{ id: PURCHASE_ID, code: "DTD-C-1" }], error: null };
    h.state.admin.document_workspaces = { data: null, error: { message: "PostgREST 500" } };
    const broken = await call({ origin: PORTAL, query: { action: "purchases" } });
    expect(broken.status).toBe(503);
    expect(await broken.json()).toMatchObject({ code: "purchases_unavailable" });

    // Sin compras no hay nada que cruzar: ni se toca la tabla de talleres.
    h.state.session.prealertas = { data: [], error: null };
    h.state.calls = [];
    const empty = await call({ origin: PORTAL, query: { action: "purchases" } });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ purchases: [] });
    expect(h.state.calls).not.toContain("admin:document_workspaces");

    // Y un principal sin sesión viva no ve compras de nadie.
    h.principal.mockResolvedValue(null);
    expect((await call({ origin: PORTAL, query: { action: "purchases" } })).status).toBe(401);
  });

  it("el packing list sólo sale sellado como confirmado cuando la revisión vigente ES la confirmada", async () => {
    h.exportDocument.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
    h.state.admin.prealertas = { data: { code: "DTD-C-1", client_markbox: MARKBOX }, error: null };
    const query = { action: "export", workspaceId: WORKSPACE_ID };

    // Hay ediciones posteriores a la confirmación: el documento es un borrador,
    // y sellarlo como confirmado le diría al proveedor que produzca lo que aún
    // no se aprobó.
    h.getWorkspace.mockResolvedValue(workspace({ revision: 3, confirmed_revision: 2 }));
    const draftRes = await call({ origin: PORTAL, headers: asClient(), query });
    expect(draftRes.status).toBe(200);
    expect(h.exportDocument.mock.calls[0][1]).toMatchObject({ confirmed: false, revision: 3, markbox: MARKBOX, code: "DTD-C-1" });

    h.getWorkspace.mockResolvedValue(workspace({ revision: 2, confirmed_revision: 2 }));
    await call({ origin: PORTAL, headers: asClient(), query });
    expect(h.exportDocument.mock.calls[1][1]).toMatchObject({ confirmed: true, revision: 2 });

    // Un documento que nunca se confirmó tampoco se sella.
    h.getWorkspace.mockResolvedValue(workspace({ revision: 1, confirmed_revision: null }));
    await call({ origin: PORTAL, headers: asClient(), query });
    expect(h.exportDocument.mock.calls[2][1]).toMatchObject({ confirmed: false, revision: 1 });
  });

  it("no exporta un documento cuya compra no se puede leer, ni deja que el código escape a la cabecera", async () => {
    h.exportDocument.mockResolvedValue(new Uint8Array([80, 75, 3, 4]));
    const query = { action: "export", workspaceId: WORKSPACE_ID };

    // Sin la compra no hay marca ni código: exportar igual produciría un packing
    // list sin dueño, que es exactamente el dato inventado que no se permite.
    h.state.admin.prealertas = { data: null, error: null };
    const orphan = await call({ origin: PORTAL, headers: asClient(), query });
    expect(orphan.status).toBe(404);
    expect(await orphan.json()).toMatchObject({ code: "not_found" });
    expect(h.exportDocument).not.toHaveBeenCalled();

    h.state.admin.prealertas = { data: { code: 'DTD"; filename="factura.exe', client_markbox: MARKBOX }, error: null };
    const res = await call({ origin: PORTAL, headers: asClient(), query });
    expect(res.status).toBe(200);
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="PackingList-[A-Za-z0-9_-]+\.xlsx"$/);
    expect(disposition).not.toContain("factura.exe");
    expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
