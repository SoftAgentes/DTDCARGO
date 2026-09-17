// @vitest-environment node
/**
 * SDD-0473 · Contratos del servicio de importación documental.
 *
 * Lo que esta suite deja clavado es lo que, si se rompe, produce un dato FALSO,
 * una fuga de información entre el cliente y su proveedor, o una etiqueta
 * física equivocada:
 *
 *  1. El proveedor ve el documento compartido, nunca DE QUÉ ARCHIVO del cliente
 *     salió cada número, ni la identidad del cliente detrás del enlace.
 *  2. La evidencia de origen (`sources`) es del servidor: ningún payload de
 *     navegador la inventa, la reemplaza, ni borra una marca de revisión.
 *  3. Guardar es comparación-y-cambio con la revisión QUE DECLARA EL CLIENTE, no
 *     con la del servidor. Revisión vieja o cajas ya recibidas → 409, sin pisar.
 *  4. La carga se niega por formato, tamaño, clave de petición y sesión por
 *     vencer ANTES de gastar cuota o firmar una URL; y el mismo `requestKey`
 *     jamás abre un job nuevo ni vuelve a cobrar cuota.
 *  5. Aplicar una extracción es privilegio del lado cliente, sólo sobre jobs
 *     terminados de ESTE workspace, y nunca confirma el despacho por su cuenta.
 *  6. Ante cualquier duda, las etiquetas físicas se NIEGAN (fail-closed).
 *
 * Todos los datos son sintéticos. Ningún dato real de negocio entra acá.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDocumentDraft, type DocumentDraft, type DocumentSource } from "@/lib/shared/document-import";
import type { ImportActor, WorkspaceRow } from "./access";

const mocks = vi.hoisted(() => ({ idsByToken: vi.fn(), portalPrincipal: vi.fn() }));
vi.mock("@/lib/studio/prealertas/queries", () => ({ getPrealertaIdsByToken: mocks.idsByToken }));
vi.mock("@/lib/portal/portal-queries", () => ({ getPortalClientPrincipal: mocks.portalPrincipal }));

import { MAX_IMPORT_BYTES, applyImport, documentLabelGate, getWorkspace, openWorkspace, projectWorkspace, reserveUpload, saveWorkspace } from "./service";

const ID = {
  workspace: "11111111-1111-4111-8111-111111111111",
  tenant: "22222222-2222-4222-8222-222222222222",
  client: "33333333-3333-4333-8333-333333333333",
  prealerta: "44444444-4444-4444-8444-444444444444",
  command: "55555555-5555-4555-8555-555555555555",
  request: "66666666-6666-4666-8666-666666666666",
  job: "77777777-7777-4777-8777-777777777777",
  share: "88888888-8888-4888-8888-888888888888",
};
const SUPPLIER_FILE = "proforma-del-cliente-CI-8842.pdf";
const supplier: ImportActor = { kind: "supplier", id: "supplier:0f1e2d3c4b5a69788796a5b4" };
const clientActor: ImportActor = { kind: "client", id: "user-sintetico" };

/** Documento completo y confirmable: sin él no se puede probar que un gate NIEGUE por otra razón. */
function completeDraft(): DocumentDraft {
  const d = emptyDocumentDraft();
  d.currency = "USD";
  d.supplier.company = "Yiwu Synthetic Trading";
  d.supplier.email = "ventas@sintetico.example";
  d.products = [{ id: "p1", name: "Bolso de cordón", nameZh: "", code: "A1", brand: "", material: "", quantity: 10, unitPrice: 2, currency: "USD", unit: "pcs" }];
  d.groups = [{ id: "g1", label: "Caja 1", cartons: 2, grossWeightKg: 12, cbm: 0.08, items: [{ productId: "p1", quantity: 10 }] }];
  return d;
}
const CLIENT_SOURCE: DocumentSource = { id: "job-1", fileName: SUPPLIER_FILE, kind: "proforma", locations: [{ path: "products.p1.quantity", sheet: null, cell: null, page: 2 }] };
/** Borrador vivo: evidencia de origen + una revisión de IA pendiente. */
function workingDraft(): DocumentDraft {
  const d = completeDraft();
  d.sources = [CLIENT_SOURCE];
  d.issues = [{ id: "ai_review_required:document", code: "ai_review_required", message: "Revisa lo leído por la IA antes de confirmar.", severity: "error", path: "document", blocking: true, resolved: false }];
  return d;
}
const W = (over: Partial<WorkspaceRow> = {}): WorkspaceRow => ({
  id: ID.workspace, tenant_id: ID.tenant, client_id: ID.client, prealerta_id: ID.prealerta,
  anonymous_hash: null, expires_at: null, draft: workingDraft(), revision: 7,
  confirmed_revision: 5, confirmed_submission_id: null, ...over,
});
const body = (over: Record<string, unknown> = {}) => ({ expectedRevision: 7, commandId: ID.command, draft: workingDraft(), ...over });

type Reply = { data?: unknown; error?: unknown };
type TableQuery = { table: string; select: string | null; filters: [string, unknown][] };
type DbSpec = { tables?: Record<string, Reply | ((q: TableQuery) => Reply)>; rpc?: (name: string, args: Record<string, unknown>) => Reply; insert?: Reply; upload?: Reply };

/** Doble de Supabase que REGISTRA: lo que importa de cada prueba es qué se mandó y qué no se mandó. */
function fakeDb(spec: DbSpec = {}) {
  const queries: TableQuery[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const uploads: { path: string; options: unknown }[] = [];
  const answer = (q: TableQuery): Reply => {
    const entry = spec.tables?.[q.table];
    const value = typeof entry === "function" ? entry(q) : entry;
    return { data: value?.data ?? null, error: value?.error ?? null };
  };
  const chain = (q: TableQuery) => {
    const api: Record<string, unknown> = {
      select: (columns: string) => { q.select = columns; return api; },
      maybeSingle: async () => answer(q),
      single: async () => answer(q),
      insert: async (row: Record<string, unknown>) => { inserts.push({ table: q.table, row }); return { data: null, error: spec.insert?.error ?? null }; },
    };
    for (const op of ["eq", "is", "neq", "in", "gt", "lt"]) api[op] = (column: string, value: unknown) => { q.filters.push([op === "eq" ? column : op + ":" + column, value]); return api; };
    return api;
  };
  const db = {
    from(table: string) { const q: TableQuery = { table, select: null, filters: [] }; queries.push(q); return chain(q); },
    async rpc(name: string, args: Record<string, unknown>) { rpcCalls.push({ name, args }); const r = spec.rpc?.(name, args) ?? {}; return { data: r.data ?? null, error: r.error ?? null }; },
    storage: { from: () => ({ createSignedUploadUrl: async (path: string, options: unknown) => { uploads.push({ path, options }); const r = spec.upload ?? { data: { signedUrl: "https://storage.sintetico/firmada" } }; return { data: r.data ?? null, error: r.error ?? null }; } }) },
  };
  return Object.assign(db as unknown as SupabaseClient, { queries, rpcCalls, inserts, uploads });
}
const uploadDb = (spec: DbSpec = {}) => fakeDb({ rpc: () => ({ data: true }), ...spec });
const lastDraft = (db: ReturnType<typeof fakeDb>) => db.rpcCalls.at(-1)!.args.p_draft as DocumentDraft;

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); mocks.idsByToken.mockReset(); mocks.portalPrincipal.mockReset(); });

describe("Lo que el proveedor puede ver del documento compartido", () => {
  it("nunca revela de qué archivo del cliente salió cada dato", () => {
    const view = projectWorkspace(W(), supplier);
    expect(view.draft.sources).toEqual([]);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(SUPPLIER_FILE);
    expect(serialized).not.toContain("products.p1.quantity");
    // El recorte es sólo la procedencia: el proveedor sigue viendo el documento.
    expect(view.draft.products[0]).toMatchObject({ name: "Bolso de cordón", quantity: 10 });
    expect(view.draft.issues).toHaveLength(1);
  });
  it("nunca revela la identidad del cliente ni el secreto del enlace anónimo", () => {
    const serialized = JSON.stringify(projectWorkspace(W({ anonymous_hash: "ab".repeat(32) }), supplier));
    for (const secret of [ID.client, ID.tenant, ID.prealerta, "ab".repeat(32)]) expect(serialized).not.toContain(secret);
    // La superficie es cerrada: agregar un campo obliga a revisar esta fuga.
    expect(Object.keys(projectWorkspace(W(), supplier)).sort()).toEqual(["confirmedRevision", "draft", "expiresAt", "id", "revision"]);
  });
  it("conserva la evidencia de origen para el lado cliente, que sí es dueño de sus archivos", () => {
    expect(projectWorkspace(W(), clientActor).draft.sources).toEqual([CLIENT_SOURCE]);
    expect(projectWorkspace(W(), { kind: "anonymous", id: ID.workspace }).draft.sources).toEqual([CLIENT_SOURCE]);
  });
});

describe("Guardar sin pisar el trabajo de la otra parte", () => {
  it("manda a la base la revisión que declara el cliente, no la que ya tiene el servidor", async () => {
    const db = fakeDb({ rpc: () => ({ data: { revision: 8 } }) });
    await saveWorkspace(db, W({ revision: 7 }), clientActor, body({ expectedRevision: 3 }));
    // Si acá viajara `w.revision`, el CAS siempre acertaría y el guardado pisaría.
    expect(db.rpcCalls[0]).toMatchObject({ name: "save_document_workspace", args: { p_workspace_id: ID.workspace, p_expected_revision: 3, p_command_id: ID.command, p_actor_kind: "client" } });
  });
  it("devuelve 409 revision_conflict ante una revisión vieja y no reintenta el guardado", async () => {
    const db = fakeDb({ rpc: () => ({ error: { code: "40001", message: "revision_conflict" } }) });
    await expect(saveWorkspace(db, W(), clientActor, body())).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
    expect(db.rpcCalls).toHaveLength(1);
  });
  it("devuelve 409 received_boxes cuando ya hay cajas recibidas", async () => {
    const db = fakeDb({ rpc: () => ({ error: { code: "22023", message: "received_boxes_require_operations" } }) });
    await expect(saveWorkspace(db, W(), clientActor, body())).rejects.toMatchObject({ status: 409, code: "received_boxes" });
  });
  it("nunca convierte un fallo de la base en guardado exitoso", async () => {
    const db = fakeDb({ rpc: () => ({ error: { code: "42501", message: "purchase_owner_changed" } }) });
    await expect(saveWorkspace(db, W(), clientActor, body())).rejects.toMatchObject({ status: 503, code: "save_failed" });
  });
  it.each([
    ["sin revisión", { expectedRevision: undefined }],
    ["revisión de texto", { expectedRevision: "7" }],
    ["revisión fraccionaria", { expectedRevision: 7.5 }],
    ["sin comando", { commandId: undefined }],
    ["comando que no es UUID", { commandId: "12345" }],
  ])("rechaza un guardado %s antes de tocar la base", async (_caso, over) => {
    const db = fakeDb({ rpc: () => ({ data: {} }) });
    await expect(saveWorkspace(db, W(), clientActor, body(over))).rejects.toMatchObject({ status: 400, code: "invalid_revision" });
    expect(db.rpcCalls).toHaveLength(0);
  });
  it("la evidencia de origen es del servidor: el payload no la inventa ni la reemplaza", async () => {
    const db = fakeDb({ rpc: () => ({ data: {} }) });
    const forged = workingDraft();
    forged.sources = [{ id: "inventado", fileName: "factura-que-nunca-existio.pdf", kind: "invoice", locations: [{ path: "products.p1.unitPrice", sheet: null, cell: "Z9", page: null }] }];
    await saveWorkspace(db, W(), supplier, body({ draft: forged }));
    expect(lastDraft(db).sources).toEqual([CLIENT_SOURCE]);
  });
  it("el proveedor no borra la revisión pendiente mandando un documento sin incidencias", async () => {
    const db = fakeDb({ rpc: () => ({ data: {} }) });
    const silent = workingDraft();
    silent.issues = [];
    await saveWorkspace(db, W(), supplier, body({ draft: silent }));
    expect(lastDraft(db).issues).toContainEqual(expect.objectContaining({ id: "ai_review_required:document", blocking: true, resolved: false }));
  });
  it("no confirma un despacho con datos faltantes: corta antes de llamar a la base", async () => {
    const db = fakeDb({ rpc: () => ({ data: {} }) });
    const incomplete = workingDraft();
    incomplete.groups = [];
    await expect(saveWorkspace(db, W(), supplier, body({ draft: incomplete }), true)).rejects.toMatchObject({ status: 422, code: "missing_logistics" });
    expect(db.rpcCalls).toHaveLength(0);
  });
  it("sólo el proveedor confirma, y sólo sobre una compra real", async () => {
    const db = fakeDb({ rpc: () => ({ data: {} }) });
    await expect(saveWorkspace(db, W(), clientActor, body(), true)).rejects.toMatchObject({ status: 403, code: "supplier_required" });
    await expect(saveWorkspace(db, W({ prealerta_id: null }), supplier, body(), true)).rejects.toMatchObject({ status: 403, code: "supplier_required" });
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("Reservar una carga", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z")); });
  const at = (minutes: number) => new Date(Date.now() + minutes * 60000).toISOString();
  const upload = (over: Record<string, unknown> = {}) => ({ fileName: "packing.pdf", sizeBytes: 1024, requestKey: ID.request, kind: "packing_list", ...over });

  it("el proveedor no carga archivos del cliente: ni siquiera consulta", async () => {
    const db = uploadDb();
    await expect(reserveUpload(db, W(), supplier, upload())).rejects.toMatchObject({ status: 403, code: "not_available" });
    expect(db.queries).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });
  it("niega la carga si a la sesión le quedan menos de 2h05 de vida útil", async () => {
    const db = uploadDb();
    // Control del Director: una extracción que arranca tarde no termina dentro
    // de la sesión y dejaría un archivo cargado sin nadie que pueda leerlo.
    await expect(reserveUpload(db, W({ expires_at: at(124) }), clientActor, upload())).rejects.toMatchObject({ status: 410, code: "upload_session_expiring" });
    expect(db.queries).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
    expect(db.uploads).toHaveLength(0);
    // El umbral exacto (125 min) todavía admite carga.
    await expect(reserveUpload(uploadDb(), W({ expires_at: at(125) }), clientActor, upload())).resolves.toMatchObject({ status: "uploading" });
    await expect(reserveUpload(uploadDb(), W({ expires_at: null }), clientActor, upload())).resolves.toMatchObject({ status: "uploading" });
  });
  it.each([
    ["listado.xls", /XLS a XLSX/i],
    ["foto.png", /XLSX, CSV o PDF/],
    ["contrato.docx", /XLSX, CSV o PDF/],
    ["sinextension", /XLSX, CSV o PDF/],
    ["packing.pdf.exe", /XLSX, CSV o PDF/],
  ])("rechaza %s con el mensaje que corresponde y sin reservar nada", async (fileName, message) => {
    const db = uploadDb();
    await expect(reserveUpload(db, W(), clientActor, upload({ fileName }))).rejects.toMatchObject({ status: 415, code: "unsupported_format", message: expect.stringMatching(message) });
    expect(db.inserts).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.uploads).toHaveLength(0);
  });
  it.each([[0], [-1], [1.5], ["1024"], [null], [undefined], [MAX_IMPORT_BYTES + 1], [Number.NaN], [Number.MAX_SAFE_INTEGER]])(
    "rechaza un tamaño declarado inválido (%s) sin reservar nada", async (sizeBytes) => {
      const db = uploadDb();
      await expect(reserveUpload(db, W(), clientActor, upload({ sizeBytes }))).rejects.toMatchObject({ status: 413, code: "file_too_large" });
      expect(db.inserts).toHaveLength(0);
      expect(db.uploads).toHaveLength(0);
    });
  it("acepta exactamente 15 MB, que es el techo del bucket", async () => {
    await expect(reserveUpload(uploadDb(), W(), clientActor, upload({ sizeBytes: MAX_IMPORT_BYTES }))).resolves.toMatchObject({ status: "uploading" });
  });
  it.each([[""], ["no-es-uuid"], ["00000000-0000-0000-0000-000000000000"], ["11111111-1111-4111-c111-111111111111"], [` ${ID.request} `], [`${ID.request}\n`]])(
    "rechaza un requestKey que no es UUID (%s): sin él la idempotencia no existe", async (requestKey) => {
      const db = uploadDb();
      await expect(reserveUpload(db, W(), clientActor, upload({ requestKey }))).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      expect(db.inserts).toHaveLength(0);
      expect(db.uploads).toHaveLength(0);
    });
  it("reintentar el mismo archivo devuelve el job existente: no crea otro ni vuelve a cobrar cuota", async () => {
    const previous = { id: ID.job, storage_path: `${ID.tenant}/${ID.workspace}/${ID.job}.pdf`, status: "ready" };
    const db = uploadDb({ tables: { document_import_jobs: { data: previous } } });
    await expect(reserveUpload(db, W(), clientActor, upload())).resolves.toEqual({ jobId: ID.job, status: "ready" });
    expect(db.inserts).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.uploads).toHaveLength(0);
    expect(db.queries[0].filters).toEqual([["workspace_id", ID.workspace], ["request_key", ID.request]]);
  });
  it("una carga interrumpida se reanuda sobre el mismo job y la misma ruta", async () => {
    const previous = { id: ID.job, storage_path: `${ID.tenant}/${ID.workspace}/${ID.job}.pdf`, status: "uploading" };
    const db = uploadDb({ tables: { document_import_jobs: { data: previous } } });
    await expect(reserveUpload(db, W(), clientActor, upload())).resolves.toMatchObject({ jobId: ID.job, status: "uploading" });
    expect(db.inserts).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.uploads[0].path).toBe(previous.storage_path);
  });
  it("la ruta de almacenamiento la arma el servidor: un nombre con rutas no se escapa del tenant", async () => {
    const db = uploadDb();
    const reserved = await reserveUpload(db, W(), clientActor, upload({ fileName: "../../otro-tenant/robo.pdf", kind: "inventado", contentType: "text/html" }));
    expect(db.uploads[0].path).toBe(`${ID.tenant}/${ID.workspace}/${reserved.jobId}.pdf`);
    expect(db.uploads[0].options).toEqual({ upsert: false });
    const row = db.inserts[0].row;
    expect(String(row.file_name)).not.toMatch(/[\\/]/);
    // El tipo y la clase los decide el servidor, no el navegador.
    expect(row).toMatchObject({ content_type: "application/pdf", file_kind: "unknown", workspace_id: ID.workspace, request_key: ID.request });
    expect(reserved).toMatchObject({ contentType: "application/pdf", uploadUrl: "https://storage.sintetico/firmada" });
  });
  it("un workspace anónimo no escribe 'undefined' en la ruta", async () => {
    const db = uploadDb();
    const reserved = await reserveUpload(db, W({ tenant_id: null, client_id: null }), { kind: "anonymous", id: ID.workspace }, upload());
    expect(db.uploads[0].path).toBe(`anonymous/${ID.workspace}/${reserved.jobId}.pdf`);
  });
  it("si la cuota se agotó o no se pudo verificar, no se inserta job ni se firma URL", async () => {
    const agotada = uploadDb({ rpc: () => ({ data: false }) });
    await expect(reserveUpload(agotada, W(), clientActor, upload())).rejects.toMatchObject({ status: 429, code: "quota_exceeded" });
    expect(agotada.inserts).toHaveLength(0);
    expect(agotada.uploads).toHaveLength(0);
    const caida = uploadDb({ rpc: () => ({ error: { code: "57014", message: "timeout" } }) });
    await expect(reserveUpload(caida, W(), clientActor, upload())).rejects.toMatchObject({ status: 503, code: "quota_unavailable" });
    expect(caida.inserts).toHaveLength(0);
    expect(caida.uploads).toHaveLength(0);
  });
  it("si la URL firmada falla, la carga se niega en vez de devolver una promesa vacía", async () => {
    const db = uploadDb({ upload: { error: { message: "storage down" } } });
    await expect(reserveUpload(db, W(), clientActor, upload())).rejects.toMatchObject({ status: 503, code: "upload_unavailable" });
  });
});

describe("Aplicar una extracción al documento", () => {
  const extracted = () => {
    const d = emptyDocumentDraft();
    d.products = [{ id: "j2-p1", name: "Termo de acero", nameZh: "", code: "T9", brand: "", material: "", quantity: 4, unitPrice: 1.5, currency: "USD", unit: "pcs" }];
    d.sources = [{ id: "job-2", fileName: "packing-list.xlsx", kind: "packing_list", locations: [{ path: "products.j2-p1.quantity", sheet: "Sheet1", cell: "B2", page: null }] }];
    return d;
  };
  const jobsTable = (job: Record<string, unknown> | null) => ({
    document_import_jobs: (q: TableQuery) => ({ data: q.filters.some(([c, v]) => c === "workspace_id" && v === ID.workspace) ? job : null }),
  });

  it("el proveedor nunca aplica una extracción: ni consulta el job", async () => {
    const db = fakeDb({ tables: jobsTable({ status: "ready", result: extracted() }) });
    await expect(applyImport(db, W(), supplier, { ...body(), jobId: ID.job })).rejects.toMatchObject({ status: 403, code: "not_available" });
    expect(db.queries).toHaveLength(0);
  });
  it("un job de otro workspace no existe para este documento", async () => {
    const db = fakeDb({ tables: jobsTable({ status: "ready", result: extracted() }) });
    await expect(applyImport(db, W({ id: "99999999-9999-4999-8999-999999999999" }), clientActor, { ...body(), jobId: ID.job })).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(db.queries[0].filters).toEqual([["id", ID.job], ["workspace_id", "99999999-9999-4999-8999-999999999999"]]);
    expect(db.rpcCalls).toHaveLength(0);
  });
  it.each([["uploading"], ["pending"], ["running"], ["failed"], ["cancelled"]])(
    "no aplica un job en estado %s", async (status) => {
      const db = fakeDb({ tables: jobsTable({ status, result: extracted() }) });
      await expect(applyImport(db, W(), clientActor, { ...body(), jobId: ID.job })).rejects.toMatchObject({ status: 404 });
      expect(db.rpcCalls).toHaveLength(0);
    });
  it("no aplica un job marcado listo que no trae resultado", async () => {
    const db = fakeDb({ tables: jobsTable({ status: "ready", result: null }) });
    await expect(applyImport(db, W(), clientActor, { ...body(), jobId: ID.job })).rejects.toMatchObject({ status: 404 });
    expect(db.rpcCalls).toHaveLength(0);
  });
  it.each([["ready"], ["partial"]])("aplica un job %s conservando la evidencia de ambos documentos y sin confirmar", async (status) => {
    const db = fakeDb({ tables: jobsTable({ status, result: extracted() }), rpc: () => ({ data: { revision: 8 } }) });
    await applyImport(db, W(), clientActor, { ...body(), jobId: ID.job });
    const draft = lastDraft(db);
    expect(draft.products.map((p) => p.id).sort()).toEqual(["j2-p1", "p1"]);
    expect(draft.sources.map((s) => s.id).sort()).toEqual(["job-1", "job-2"]);
    // Aplicar propone: jamás confirma el despacho ni pierde el CAS.
    expect(db.rpcCalls[0].args).toMatchObject({ p_confirmation: null, p_expected_revision: 7, p_actor_kind: "client" });
  });
  it("si el guardado choca con otra sesión, la aplicación falla en vez de pisar", async () => {
    const db = fakeDb({ tables: jobsTable({ status: "ready", result: extracted() }), rpc: () => ({ error: { code: "40001", message: "revision_conflict" } }) });
    await expect(applyImport(db, W(), clientActor, { ...body(), jobId: ID.job })).rejects.toMatchObject({ status: 409, code: "revision_conflict" });
  });
});

describe("Etiquetas físicas: fail-closed", () => {
  const gateDb = (reply: Reply) => fakeDb({ tables: { document_workspaces: reply } });
  it("con la función encendida y la tabla ausente, NIEGA las etiquetas", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    await expect(documentLabelGate(gateDb({ error: { code: "42P01", message: "relation does not exist" } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
  });
  it("con la función apagada y la tabla ausente, el flujo viejo sigue imprimiendo", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "false");
    await expect(documentLabelGate(gateDb({ error: { code: "42P01", message: "relation does not exist" } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: false, allowed: true });
  });
  it("cualquier otro error de lectura niega, nunca permite", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    for (const code of ["57014", "42501", "08006"]) {
      await expect(documentLabelGate(gateDb({ error: { code, message: code } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
    }
  });
  it("consulta siempre acotada al tenant dueño de la compra", async () => {
    const db = gateDb({ data: null });
    await documentLabelGate(db, ID.prealerta, ID.tenant);
    expect(db.queries[0].filters).toEqual([["prealerta_id", ID.prealerta], ["tenant_id", ID.tenant]]);
  });
  it("una compra sin documento compartido no queda gobernada por este módulo", async () => {
    await expect(documentLabelGate(gateDb({ data: null }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: false, allowed: true });
  });
  it("niega mientras haya cambios guardados mas no confirmados", async () => {
    await expect(documentLabelGate(gateDb({ data: { draft: completeDraft(), revision: 8, confirmed_revision: 7 } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
    await expect(documentLabelGate(gateDb({ data: { draft: completeDraft(), revision: 8, confirmed_revision: null } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
  });
  it("niega si el documento confirmado todavía tiene un bloqueo sin resolver", async () => {
    const pending = completeDraft();
    pending.groups = [];
    await expect(documentLabelGate(gateDb({ data: { draft: pending, revision: 8, confirmed_revision: 8 } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
  });
  it("niega si el documento guardado no se puede ni interpretar", async () => {
    await expect(documentLabelGate(gateDb({ data: { draft: { schemaVersion: 99 }, revision: 8, confirmed_revision: 8 } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
    await expect(documentLabelGate(gateDb({ data: { draft: null, revision: 8, confirmed_revision: 8 } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
  });
  it("permite sólo cuando la revisión confirmada es la vigente y no quedan bloqueos", async () => {
    await expect(documentLabelGate(gateDb({ data: { draft: completeDraft(), revision: 8, confirmed_revision: 8 } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: true });
  });
  it("una revisión que no llega como número no cuenta como confirmada", async () => {
    // La igualdad es estricta a propósito: si la fila trae "8" (texto) en vez de 8,
    // algo no cuadra con la revisión vigente y la caja NO sale etiquetada.
    for (const [revision, confirmed_revision] of [[8, "8"], [1, true], [0, ""], [0, null]] as [number, unknown][]) {
      await expect(documentLabelGate(gateDb({ data: { draft: completeDraft(), revision, confirmed_revision } }), ID.prealerta, ID.tenant)).resolves.toEqual({ managed: true, allowed: false });
    }
  });
});

describe("Abrir el documento compartido", () => {
  const headers = () => new Headers({ "x-supplier-token": ID.share });
  /** Carrera real: la fila existe con OTRO client_id, así que el SELECT (que filtra
   * por client_id) nunca la ve y el INSERT choca contra `prealerta_id unique` siempre. */
  function raceDb(onRpc: (attempt: number) => Reply) {
    let attempts = 0;
    const db = fakeDb({
      tables: { clients: { data: { id: ID.client } }, document_workspaces: { data: null }, prealertas: { data: null }, packing_list_submissions: { data: null } },
      rpc: () => onRpc(++attempts),
    });
    return { db, attempts: () => attempts };
  }
  beforeEach(() => { mocks.idsByToken.mockResolvedValue({ prealertaId: ID.prealerta, tenantId: ID.tenant, markbox: "SYN-001", code: "SYN-0001" }); });

  it("un enlace de proveedor que no es UUID no consulta nada", async () => {
    const db = fakeDb();
    await expect(openWorkspace(db, db, {}, new Headers({ "x-supplier-token": "robado" }))).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(mocks.idsByToken).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(0);
  });
  it("un enlace de proveedor sin cliente dueño vivo no abre nada", async () => {
    // Markbox reasignado o cliente borrado: el token ya no representa a nadie.
    const db = fakeDb({ tables: { clients: { data: null } }, rpc: () => ({ data: W() }) });
    await expect(openWorkspace(db, db, {}, headers())).rejects.toMatchObject({ status: 404, code: "not_found" });
    // Sin dueño comprobado no se abre un documento "anónimo" sobre una compra real.
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.queries.map((q) => q.table)).toEqual(["clients"]);
  });
  it("si no se puede leer el documento compartido que ya existe, no se crea otro encima", async () => {
    const db = fakeDb({
      tables: { clients: { data: { id: ID.client } }, document_workspaces: { error: { code: "57014", message: "timeout" } } },
      rpc: () => ({ data: W() }),
    });
    await expect(openWorkspace(db, db, {}, headers())).rejects.toMatchObject({ status: 503, code: "workspace_unavailable" });
    // Un segundo workspace para la misma compra parte en dos el documento que
    // cliente y proveedor creen estar editando juntos.
    expect(db.rpcCalls).toHaveLength(0);
  });
  it("si no se puede recuperar el packing list anterior, falla en vez de abrir un documento en blanco", async () => {
    const db = fakeDb({
      tables: {
        clients: { data: { id: ID.client } }, document_workspaces: { data: null }, prealertas: { data: null },
        packing_list_submissions: { error: { code: "57014", message: "timeout" } },
      },
      rpc: () => ({ data: W() }),
    });
    await expect(openWorkspace(db, db, {}, headers())).rejects.toMatchObject({ status: 503, code: "workspace_unavailable" });
    // Abrir vacío acá le borraría al proveedor lo que ya había enviado: dato faltante
    // NO es dato en cero.
    expect(db.rpcCalls).toHaveLength(0);
  });
  it("abrir por código de compra sólo alcanza compras del cliente que inició sesión", async () => {
    mocks.portalPrincipal.mockResolvedValue({ userId: "user-sintetico", tenantId: ID.tenant, client: { id: ID.client, markbox: "SYN-001" } });
    const db = fakeDb({ tables: { prealertas: { data: { id: ID.prealerta } }, document_workspaces: { data: W() } } });
    await openWorkspace(db, db, { purchaseCode: "X".repeat(150) }, new Headers());
    expect(db.queries[0].table).toBe("prealertas");
    // Sin el markbox del principal, un código ajeno del mismo tenant abriría el
    // documento de otro cliente; y el código se recorta antes de consultar.
    expect(db.queries[0].filters).toEqual([["code", "X".repeat(100)], ["tenant_id", ID.tenant], ["client_markbox", "SYN-001"], ["is:deleted_at", null], ["neq:status", "cancelada"]]);
    expect(db.queries[1].filters).toEqual([["prealerta_id", ID.prealerta], ["tenant_id", ID.tenant], ["client_id", ID.client]]);
  });
  it("no inventa un workspace cuando la creación falla", async () => {
    const { db, attempts } = raceDb(() => ({ error: { code: "XX000", message: "boom" } }));
    await expect(openWorkspace(db, db, {}, headers())).rejects.toMatchObject({ status: 503, code: "workspace_unavailable" });
    expect(attempts()).toBe(1);
  });
  it.fails("DEFECTO CONOCIDO (service.ts:74): reintenta sin tope si la carrera 23505 no se resuelve", async () => {
    const cap = 200;
    const { db, attempts } = raceDb((n) => ({ error: n < cap ? { code: "23505", message: "duplicate key value violates unique constraint" } : { code: "XX000", message: "corte de la prueba" } }));
    await expect(openWorkspace(db, db, {}, headers())).rejects.toMatchObject({ status: 503, code: "workspace_unavailable" });
    // Hoy consume las 200 llamadas que le permite el doble; en producción no hay
    // corte: `openWorkspace` se llama a sí misma sin guarda de profundidad.
    expect(attempts()).toBeLessThanOrEqual(3);
  });
});

describe("Leer un workspace por id", () => {
  it("un id que no es UUID se responde 404 sin consultar la base", async () => {
    const db = fakeDb({ tables: { document_workspaces: { data: W() } } });
    await expect(getWorkspace(db, "' or 1=1 --")).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(db.queries).toHaveLength(0);
  });
  it("un error de lectura no se distingue de un documento inexistente", async () => {
    await expect(getWorkspace(fakeDb({ tables: { document_workspaces: { error: { code: "57014", message: "timeout" } } } }), ID.workspace)).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});
