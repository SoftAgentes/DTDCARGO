// @vitest-environment node
/**
 * Handler REAL de kommo-webhook: sin servidor Deno, red, Vault ni DB reales.
 * Sólo se sustituyen fronteras I/O; parser, mapping y router son producción.
 * La carrera evalúa filtros contra el estado actual, no contra el snapshot.
 * No promete cancelar retroactivamente trabajo de un request ya en curso.
 */
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as mapping from "../kommo-mapping";
import * as parsing from "../kommo-webhook-parse";
import * as routing from "../kommo-router";

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { message: string } | null };
type Operation = { kind: string; target: string; payload?: unknown; affected?: number };
type Handler = (request: Request) => Promise<Response>;
type Options = {
  status?: unknown;
  noConnection?: boolean;
  lookupError?: boolean;
  token?: string | null;
  tokenError?: boolean;
  missingSecret?: boolean;
  missingServiceRole?: boolean;
  disableDuringProcessing?: boolean;
  fetchFailure?: boolean;
};

const TENANT = "10000000-0000-4000-8000-000000000001";
const CONNECTION = "20000000-0000-4000-8000-000000000001";
const CLIENT = "30000000-0000-4000-8000-000000000001";
const SECRET = "synthetic-webhook-secret";
const PAUSED_REASON = "Deshabilitada manualmente durante el request sintético";
const clone = <T>(value: T): T => structuredClone(value);
const handlerSource = readFileSync(new URL("../../kommo-webhook/index.ts", import.meta.url), "utf8");
const handlerCode = ts.transpileModule(handlerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const MESSAGE = {
  "message[add][0][id]": "synthetic-message",
  "message[add][0][entity_type]": "lead",
  "message[add][0][entity_id]": "101",
  "message[add][0][created_at]": "1700000000",
  "message[add][0][type]": "incoming",
  "message[add][0][origin]": "whatsapp",
  "message[add][0][author][type]": "external",
};
const MIXED = new URLSearchParams({
  "account[subdomain]": "synthetic-account",
  "leads[add][0][id]": "101",
  "contacts[update][0][id]": "201",
  ...MESSAGE,
}).toString();
const MESSAGE_ONLY = new URLSearchParams({ "account[subdomain]": "synthetic-account", ...MESSAGE }).toString();

function fixture(options: Options = {}) {
  const state = {
    tables: {
      kommo_connections: options.noConnection ? [] : [{
        id: CONNECTION, tenant_id: TENANT, subdomain: "synthetic-account", domain: "example.invalid",
        status: Object.hasOwn(options, "status") ? options.status : "active",
        last_error: "Error anterior sintético", updated_at: "2026-01-01T00:00:00.000Z",
        stage_map: { recontacto: { pipeline_id: 8, status_id: 9 } },
        markbox_field_id: 41, markbox_contact_field_id: 42,
      }],
      clients: [{ id: CLIENT, tenant_id: TENANT, markbox: "DTD-SYNTHETIC", kommo_contact_id: 201, phone: null, deleted_at: null }],
      kommo_leads: [{ id: 909, tenant_id: TENANT, name: "Lead sintético existente" }],
      kommo_contacts: [{ id: 919, tenant_id: TENANT, name: "Contacto sintético existente" }],
      sync_logs: [],
    } as Record<string, Row[]>,
    messages: [] as Row[], links: [] as Row[], outbox: [] as Row[],
  };
  const operations: Operation[] = [];
  const consoleEntries: unknown[][] = [];
  let handler: Handler | undefined;
  let raced = false;

  function query(table: string) {
    if (!Object.hasOwn(state.tables, table)) throw new Error(`Tabla no prevista: ${table}`);
    let kind = "select";
    let payload: Row = {};
    const filters: ((row: Row) => boolean)[] = [];
    const execute = (single = false): DbResult => {
      const rows = state.tables[table];
      const matches = rows.filter((row) => filters.every((filter) => filter(row)));
      operations.push({ kind, target: table, ...(kind !== "select" ? { payload: clone(payload), affected: kind === "insert" ? 1 : matches.length } : {}) });
      if (table === "kommo_connections" && kind === "select" && options.lookupError) {
        return { data: null, error: { message: "lookup sintético fallido" } };
      }
      if (kind === "update") for (const row of matches) Object.assign(row, clone(payload));
      else if (kind === "delete") state.tables[table] = rows.filter((row) => !matches.includes(row));
      else if (kind === "insert") rows.push(clone(payload));
      return { data: clone(single ? matches[0] ?? null : matches), error: null };
    };
    const builder = {
      select: () => builder,
      eq: (field: string, value: unknown) => { filters.push((row) => row[field] === value); return builder; },
      is: (field: string, value: unknown) => { filters.push((row) => row[field] === value); return builder; },
      in: (field: string, values: unknown[]) => { filters.push((row) => values.includes(row[field])); return builder; },
      update: (value: Row) => { kind = "update"; payload = value; return builder; },
      insert: (value: Row) => { kind = "insert"; payload = value; return builder; },
      delete: () => { kind = "delete"; return builder; },
      maybeSingle: async () => execute(true),
      then: (resolve: (result: DbResult) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve().then(() => execute()).then(resolve, reject),
    };
    return builder;
  }

  const supabase = {
    from: query,
    async rpc(name: string, args: Row): Promise<DbResult> {
      operations.push({ kind: "rpc", target: name, payload: clone(args) });
      if (name === "kommo_get_token") return {
        data: Object.hasOwn(options, "token") ? options.token : "synthetic-kommo-token",
        error: options.tokenError ? { message: "Vault sintético fallido" } : null,
      };
      if (name === "kommo_replace_lead_contacts") state.links.push(clone(args));
      else if (name === "kommo_touch_lead_message") {
        if (!state.tables.kommo_leads.some((row) => row.id === args.p_lead_id && row.tenant_id === args.p_tenant_id)) {
          return { data: null, error: null };
        }
        state.messages.push(clone(args));
      } else if (name === "enqueue_kommo_writeback" || name === "enqueue_kommo_contact_writeback") {
        state.outbox.push({ rpc: name, ...clone(args) });
      } else throw new Error(`RPC no prevista: ${name}`);
      return { data: true, error: null };
    },
  };
  async function kommoFetch(_baseUrl: string, _token: string, path: string) {
    operations.push({ kind: "fetch", target: path });
    if (options.disableDuringProcessing && !raced) {
      // Ocurre DESPUÉS del snapshot de conexión y ANTES de su UPDATE final.
      Object.assign(state.tables.kommo_connections[0], { status: "disabled", last_error: PAUSED_REASON });
      raced = true;
    }
    if (options.fetchFailure) throw new Error("Fallo externo sintético");
    if (path === "/api/v4/leads/101?with=contacts") return {
      id: 101, name: "Lead sintético nuevo", price: 120, pipeline_id: 3, status_id: 4,
      created_at: 1699999000, updated_at: 1700000000, _embedded: { contacts: [{ id: 201, is_main: true }] },
    };
    if (path === "/api/v4/contacts/201") return {
      id: 201, name: "Contacto sintético nuevo", created_at: 1699999000, updated_at: 1700000000,
      custom_fields_values: [{ field_code: "EMAIL", values: [{ value: "synthetic@example.invalid" }] }],
    };
    throw new Error(`Fetch no previsto: ${path}`);
  }
  async function upsertRows(_client: unknown, table: string, rows: Row[]) {
    operations.push({ kind: "upsert", target: table, payload: clone(rows) });
    for (const row of rows) {
      const existing = state.tables[table].find((old) => old.id === row.id && old.tenant_id === row.tenant_id);
      if (existing) Object.assign(existing, clone(row));
      else state.tables[table].push(clone(row));
    }
    return rows.length;
  }
  const modules: Record<string, unknown> = {
    "jsr:@supabase/supabase-js@2": { createClient: () => supabase },
    "../kommo-sync/kommo-client.ts": { kommoFetch },
    "../kommo-sync/sync.ts": { upsertRows },
    "../_shared/kommo-mapping.ts": mapping,
    "../_shared/kommo-webhook-parse.ts": parsing,
    "../_shared/kommo-router.ts": routing,
  };
  const env: Record<string, string | undefined> = {
    KOMMO_WEBHOOK_SECRET: options.missingSecret ? undefined : SECRET,
    SUPABASE_URL: "https://synthetic.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: options.missingServiceRole ? undefined : "synthetic-service-role",
  };
  new Script(handlerCode, { filename: "kommo-webhook/index.ts" }).runInNewContext({
    exports: {}, Request, Response, URL, URLSearchParams, Date, Error,
    console: { log: (...args: unknown[]) => consoleEntries.push(args), error: (...args: unknown[]) => consoleEntries.push(args) },
    Deno: { env: { get: (key: string) => env[key] }, serve: (callback: Handler) => { handler = callback; } },
    require: (specifier: string) => {
      if (!Object.hasOwn(modules, specifier)) throw new Error(`Import no previsto: ${specifier}`);
      return modules[specifier];
    },
    // Sin fetch, process ni loader genérico: un I/O nuevo no sale a la red.
  });
  if (!handler) throw new Error("El módulo real no registró Deno.serve");
  const capturedHandler = handler;
  return {
    state, operations, consoleEntries,
    async invoke(body = MIXED, method = "POST", secret: string | null = SECRET) {
      const request = new Request(`https://local.example.invalid/webhook${secret === null ? "" : `?secret=${encodeURIComponent(secret)}`}`, {
        method, ...(method === "GET" || method === "HEAD" ? {} : { body }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const response = await capturedHandler(request);
      return { response, body: await response.json() as Row };
    },
  };
}

const protectedOperations = (operations: Operation[]) => operations.filter((op) => op.kind !== "select");

describe("kommo-webhook real — estado de conexión", () => {
  it.each(["disabled", null, "paused", "ACTIVE", "", undefined])("ignora estado %s sin Vault ni efectos persistentes", async (status) => {
    const f = fixture({ status });
    const before = clone(f.state);
    const result = await f.invoke();
    expect.soft(result.response.status).toBe(200);
    expect.soft(result.body).toMatchObject({ ok: true, ignored: expect.any(String) });
    expect.soft(protectedOperations(f.operations)).toEqual([]);
    expect(f.state).toEqual(before);
  });

  it("disabled tampoco elimina entidades del espejo", async () => {
    const f = fixture({ status: "disabled" });
    const before = clone(f.state);
    await f.invoke("account[subdomain]=synthetic-account&leads[delete][0][id]=909&contacts[delete][0][id]=919");
    expect.soft(protectedOperations(f.operations)).toEqual([]);
    expect(f.state).toEqual(before);
  });

  it.each(["active", "error"])("%s procesa entidades, mensaje y router reales y recupera active", async (status) => {
    const f = fixture({ status });
    const result = await f.invoke();
    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, events: 2, summary: {
      lead: { fetched: 1, upserted: 1, deleted: 0 }, contact: { fetched: 1, upserted: 1, deleted: 0 },
      mensajes: { recibidos: 1, estampados: 1, sinEspejar: 0 }, router: { checked: 1, routed: 1, healed: 0, unknown: 0 },
    } });
    expect(f.state.tables.kommo_leads).toContainEqual(expect.objectContaining({ id: 101, tenant_id: TENANT, name: "Lead sintético nuevo", price: 120 }));
    expect(f.state.tables.kommo_contacts).toContainEqual(expect.objectContaining({ id: 201, tenant_id: TENANT, email: "synthetic@example.invalid" }));
    expect(f.state.messages).toEqual([{ p_tenant_id: TENANT, p_lead_id: 101, p_at: "2023-11-14T22:13:20.000Z", p_entrante: true, p_origin: "whatsapp" }]);
    expect(f.state.links).toEqual([{ p_tenant_id: TENANT, p_lead_id: 101, p_links: [{ id: 201, is_main: true }], p_lead_updated_at: "2023-11-14T22:13:20.000Z" }]);
    expect(f.state.outbox).toHaveLength(3);
    expect(f.state.outbox).toEqual(expect.arrayContaining([
      expect.objectContaining({ p_tenant_id: TENANT, p_op: "patch_stage", p_payload: { status_id: 9, pipeline_id: 8 } }),
      expect.objectContaining({ p_tenant_id: TENANT, p_op: "patch_lead" }),
      expect.objectContaining({ p_tenant_id: TENANT, p_op: "patch_contact" }),
    ]));
    expect(f.state.tables.sync_logs).toHaveLength(2);
    expect(f.state.tables.kommo_connections[0]).toMatchObject({ status: "active", last_error: null });
  });

  it("un webhook sólo de mensaje estampa el lead ya espejado", async () => {
    const f = fixture();
    f.state.tables.kommo_leads.push({ id: 101, tenant_id: TENANT });
    const result = await f.invoke(MESSAGE_ONLY);
    expect(result.body).toMatchObject({ ok: true, events: 0, summary: { mensajes: { estampados: 1 } } });
    expect(f.state.messages).toHaveLength(1);
    expect(f.state.outbox).toEqual([]);
    expect(f.operations.filter((op) => op.kind === "fetch" || op.kind === "upsert")).toEqual([]);
  });

  it.each(["active", "error"])("carrera %s → disabled no reactiva ni borra last_error", async (status) => {
    const f = fixture({ status, disableDuringProcessing: true });
    const result = await f.invoke();
    expect(result.response.status).toBe(200);
    // Puede completar I/O ya iniciado; no afirmamos cancelación retroactiva.
    expect(f.state.tables.kommo_leads).toContainEqual(expect.objectContaining({ id: 101 }));
    expect.soft(f.state.tables.kommo_connections[0]).toMatchObject({ status: "disabled", last_error: PAUSED_REASON });
    expect(f.operations.filter((op) => op.kind === "update" && op.target === "kommo_connections").every((op) => op.affected === 0)).toBe(true);
  });
});

describe("kommo-webhook real — contratos previos", () => {
  it.each(["GET", "PUT", "DELETE"])("mantiene405 para %s sin DB", async (method) => {
    const f = fixture();
    expect((await f.invoke(MIXED, method)).response.status).toBe(405);
    expect(f.operations).toEqual([]);
  });
  it.each([null, "secret-incorrecto"])("mantiene403 sin secret válido (%s)", async (secret) => {
    const f = fixture();
    expect((await f.invoke(MIXED, "POST", secret)).response.status).toBe(403);
    expect(f.operations).toEqual([]);
  });
  it.each([{ missingSecret: true }, { missingServiceRole: true }])("configuración ausente falla sin DB (%j)", async (options) => {
    const f = fixture(options);
    expect((await f.invoke()).response.status).toBe(500);
    expect(f.operations).toEqual([]);
  });
  it("lookup fallido conserva500 y no consulta Vault", async () => {
    const f = fixture({ lookupError: true });
    expect((await f.invoke()).response.status).toBe(500);
    expect(protectedOperations(f.operations)).toEqual([]);
  });
  it("sin conexión devuelve200 ignored sin Vault", async () => {
    const f = fixture({ noConnection: true });
    const result = await f.invoke();
    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, ignored: expect.any(String) });
    expect(protectedOperations(f.operations)).toEqual([]);
  });
  it("sin token devuelve200 ignored sin escribir", async () => {
    const f = fixture({ token: null });
    const before = clone(f.state);
    const result = await f.invoke();
    expect(result.response.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, ignored: expect.any(String) });
    expect(protectedOperations(f.operations)).toEqual([{ kind: "rpc", target: "kommo_get_token", payload: { p_connection_id: CONNECTION } }]);
    expect(f.state).toEqual(before);
  });
  it("fallo de Vault conserva500 sin escritura", async () => {
    const f = fixture({ tokenError: true });
    const before = clone(f.state);
    expect((await f.invoke()).response.status).toBe(500);
    expect(f.state).toEqual(before);
  });
  it("body sin eventos y evento sin subdomain se ignoran sin DB", async () => {
    for (const body of ["ruido=sintetico", "leads[add][0][id]=101"]) {
      const f = fixture();
      expect((await f.invoke(body)).response.status).toBe(200);
      expect(f.operations).toEqual([]);
    }
  });
  it("fallo externo conserva500 y sync_log de error sin reactivar", async () => {
    const f = fixture({ status: "error", fetchFailure: true });
    expect((await f.invoke()).response.status).toBe(500);
    expect(f.state.tables.sync_logs).toEqual([expect.objectContaining({ entity: "webhook", status: "error", tenant_id: TENANT })]);
    expect(f.state.tables.kommo_connections[0]).toMatchObject({ status: "error", last_error: "Error anterior sintético" });
  });
});
