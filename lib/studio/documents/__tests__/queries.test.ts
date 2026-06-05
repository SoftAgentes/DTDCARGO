/**
 * Tests de las queries del Hub de Documentos (SDD-0049 Slice A) con un stub de
 * SupabaseClient. Cubre Acceptance §5 Slice A (parte queries):
 *  - listDocumentsByEntity / listAllDocuments (folder + q) / folderCounts /
 *    expiringDocuments / pendingDocuments / unlinkedDocuments
 *
 * El stub registra los filtros aplicados (eq/in/is/or/not/lte/order) para poder
 * asertar QUÉ se consultó, y resuelve a las filas configuradas por tabla.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listDocumentsByEntity,
  listAllDocuments,
  folderCounts,
  expiringDocuments,
  pendingDocuments,
  unlinkedDocuments,
  listDocumentVersions,
} from "../queries";
import type { DocumentRow } from "../types";

type Call = { method: string; args: unknown[] };

function makeClient(rows: Record<string, unknown[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const data = rows[table] ?? [];
      const chain: Record<string, unknown> = {};
      const record = (method: string) =>
        (...args: unknown[]) => {
          calls.push({ method, args });
          return chain;
        };
      for (const m of ["select", "eq", "in", "is", "or", "not", "lte", "gte"]) {
        chain[m] = record(m);
      }
      // order resuelve la cadena (es el último eslabón en las queries reales)
      chain.order = (...args: unknown[]) => {
        calls.push({ method: "order", args });
        return Promise.resolve({ data, error: null });
      };
      // thenable para las queries que NO terminan en order (folderCounts)
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

function rowsCalled(calls: Call[], method: string): Call[] {
  return calls.filter((c) => c.method === method);
}

const DOC = (over: Partial<DocumentRow>): DocumentRow => ({
  id: "d1",
  tenant_id: "t1",
  entity_type: "shipment",
  entity_id: "s1",
  folder: "log-bl",
  doc_type: "BL",
  name: "doc",
  storage_path: "t1/shipment/s1/u.pdf",
  content_type: "application/pdf",
  size_bytes: 100,
  status: "firmado",
  valid_until: null,
  uploaded_by: null,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  deleted_at: null,
  root_id: "d1",
  version_no: 1,
  supersedes_id: null,
  is_current: true,
  version_note: null,
  ...over,
});

describe("listDocumentsByEntity", () => {
  it("filtra por entity_type + entity_id + no borradas y devuelve las filas", async () => {
    const { client, calls } = makeClient({
      documents: [DOC({ id: "a" }), DOC({ id: "b" })],
    });
    const res = await listDocumentsByEntity(client, "shipment", "s1");
    expect(res).toHaveLength(2);

    const eqs = rowsCalled(calls, "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["entity_type", "shipment"]);
    expect(eqs).toContainEqual(["entity_id", "s1"]);
    // SDD-0060: solo la versión vigente de la cadena
    expect(eqs).toContainEqual(["is_current", true]);
    expect(rowsCalled(calls, "is")[0].args).toEqual(["deleted_at", null]);
  });

  it("devuelve [] sin filas", async () => {
    const { client } = makeClient({ documents: [] });
    expect(await listDocumentsByEntity(client, "client", "c1")).toEqual([]);
  });
});

describe("listAllDocuments", () => {
  it("sin opciones: filtra no-borradas + solo vigentes (SDD-0060)", async () => {
    const { client, calls } = makeClient({ documents: [DOC({})] });
    const res = await listAllDocuments(client);
    expect(res).toHaveLength(1);
    expect(rowsCalled(calls, "is")[0].args).toEqual(["deleted_at", null]);
    // el único eq es is_current=true (sin filtro de carpeta/q)
    expect(rowsCalled(calls, "eq").map((c) => c.args)).toEqual([
      ["is_current", true],
    ]);
    expect(rowsCalled(calls, "in")).toHaveLength(0);
    expect(rowsCalled(calls, "or")).toHaveLength(0);
  });

  it("folder = grupo top-level → expande a sus subcarpetas via .in()", async () => {
    const { client, calls } = makeClient({ documents: [] });
    await listAllDocuments(client, { folder: "log" });
    const inCall = rowsCalled(calls, "in")[0];
    expect(inCall.args[0]).toBe("folder");
    expect(inCall.args[1]).toEqual([
      "log-bl",
      "log-packing",
      "log-origen",
      "log-fotos",
    ]);
  });

  it("folder = subcarpeta → match exacto via .eq()", async () => {
    const { client, calls } = makeClient({ documents: [] });
    await listAllDocuments(client, { folder: "log-bl" });
    const eqs = rowsCalled(calls, "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["folder", "log-bl"]);
    expect(eqs).toContainEqual(["is_current", true]);
    expect(rowsCalled(calls, "in")).toHaveLength(0);
  });

  it("folder = 'all' no aplica filtro de carpeta (solo is_current)", async () => {
    const { client, calls } = makeClient({ documents: [] });
    await listAllDocuments(client, { folder: "all" });
    // ningún eq de carpeta; el único eq es is_current=true
    expect(rowsCalled(calls, "eq").map((c) => c.args)).toEqual([
      ["is_current", true],
    ]);
    expect(rowsCalled(calls, "in")).toHaveLength(0);
  });

  it("q → busca en name+doc_type via .or() y sanitiza caracteres peligrosos", async () => {
    const { client, calls } = makeClient({ documents: [] });
    await listAllDocuments(client, { q: "BL (cosco),%" });
    const orCall = rowsCalled(calls, "or")[0];
    const expr = orCall.args[0] as string;
    expect(expr).toContain("name.ilike.");
    expect(expr).toContain("doc_type.ilike.");
    // los caracteres %,() se reemplazaron por espacio
    expect(expr).not.toContain("(");
    expect(expr).not.toContain(")");
    expect(expr).not.toContain(",%");
  });
});

describe("folderCounts", () => {
  it("cuenta por carpeta + total all", async () => {
    const { client } = makeClient({
      documents: [
        { folder: "log-bl" },
        { folder: "log-bl" },
        { folder: "op-kyc" },
      ],
    });
    const counts = await folderCounts(client);
    expect(counts.all).toBe(3);
    expect(counts["log-bl"]).toBe(2);
    expect(counts["op-kyc"]).toBe(1);
  });

  it("documents vacío → { all: 0 }", async () => {
    const { client } = makeClient({ documents: [] });
    expect(await folderCounts(client)).toEqual({ all: 0 });
  });
});

describe("expiringDocuments", () => {
  it("acota a valid_until no nulo y <= hoy+ventana", async () => {
    const { client, calls } = makeClient({
      documents: [DOC({ valid_until: "2026-06-10" })],
    });
    const res = await expiringDocuments(client, "2026-06-03", 30);
    expect(res).toHaveLength(1);

    expect(rowsCalled(calls, "not")[0].args).toEqual([
      "valid_until",
      "is",
      null,
    ]);
    // hoy 2026-06-03 + 30d = 2026-07-03
    expect(rowsCalled(calls, "lte")[0].args).toEqual([
      "valid_until",
      "2026-07-03",
    ]);
    expect(rowsCalled(calls, "order")[0].args[0]).toBe("valid_until");
  });

  it("ventana custom corre el límite superior", async () => {
    const { client, calls } = makeClient({ documents: [] });
    await expiringDocuments(client, "2026-06-03", 7);
    expect(rowsCalled(calls, "lte")[0].args).toEqual([
      "valid_until",
      "2026-06-10",
    ]);
  });
});

describe("pendingDocuments", () => {
  it("filtra status=pendiente + no borradas", async () => {
    const { client, calls } = makeClient({
      documents: [DOC({ status: "pendiente" })],
    });
    const res = await pendingDocuments(client);
    expect(res).toHaveLength(1);
    const eqs = rowsCalled(calls, "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["status", "pendiente"]);
    expect(eqs).toContainEqual(["is_current", true]);
  });
});

describe("unlinkedDocuments", () => {
  it("filtra entity_type=none + no borradas", async () => {
    const { client, calls } = makeClient({
      documents: [DOC({ entity_type: "none", entity_id: null })],
    });
    const res = await unlinkedDocuments(client);
    expect(res).toHaveLength(1);
    const eqs = rowsCalled(calls, "eq").map((c) => c.args);
    expect(eqs).toContainEqual(["entity_type", "none"]);
    expect(eqs).toContainEqual(["is_current", true]);
  });
});

// ── Versionado (SDD-0060) ──────────────────────────────────────────

describe("listAllDocuments oculta versiones no-current", () => {
  it("aplica el filtro is_current=true (las históricas no aparecen sueltas)", async () => {
    // El stub no implementa el filtro real, pero asertamos que la query lo pide:
    // en runtime, RLS/PostgREST devuelven solo is_current=true.
    const { client, calls } = makeClient({ documents: [DOC({})] });
    await listAllDocuments(client);
    expect(rowsCalled(calls, "eq").map((c) => c.args)).toContainEqual([
      "is_current",
      true,
    ]);
  });
});

describe("listDocumentVersions (historial de la cadena)", () => {
  it("filtra por root_id + no borradas y ordena version_no desc (NO filtra is_current)", async () => {
    const { client, calls } = makeClient({
      documents: [
        {
          id: "v3",
          version_no: 3,
          name: "BL v3",
          size_bytes: 300,
          content_type: "application/pdf",
          status: "firmado",
          version_note: "corregido aduana",
          uploaded_by: "u1",
          created_at: "2026-06-03T00:00:00Z",
          storage_path: "t1/shipment/s1/c.pdf",
          is_current: true,
        },
        {
          id: "v2",
          version_no: 2,
          name: "BL v2",
          size_bytes: 200,
          content_type: "application/pdf",
          status: "vigente",
          version_note: "corregido monto",
          uploaded_by: "u1",
          created_at: "2026-06-02T00:00:00Z",
          storage_path: "t1/shipment/s1/b.pdf",
          is_current: false,
        },
        {
          id: "v1",
          version_no: 1,
          name: "BL v1",
          size_bytes: 100,
          content_type: "application/pdf",
          status: "vigente",
          version_note: null,
          uploaded_by: "u1",
          created_at: "2026-06-01T00:00:00Z",
          storage_path: "t1/shipment/s1/a.pdf",
          is_current: false,
        },
      ],
    });

    const res = await listDocumentVersions(client, "root-1");
    // devuelve la cadena completa (vigente + históricas)
    expect(res.map((v) => v.version_no)).toEqual([3, 2, 1]);

    // filtra por la cadena, no por estado vigente
    expect(rowsCalled(calls, "eq")[0].args).toEqual(["root_id", "root-1"]);
    expect(rowsCalled(calls, "eq").map((c) => c.args)).not.toContainEqual([
      "is_current",
      true,
    ]);
    expect(rowsCalled(calls, "is")[0].args).toEqual(["deleted_at", null]);

    // orden más nueva → más vieja
    expect(rowsCalled(calls, "order")[0].args).toEqual([
      "version_no",
      { ascending: false },
    ]);
  });

  it("cadena de 1 (sin versionar) devuelve solo la v1", async () => {
    const { client } = makeClient({
      documents: [
        {
          id: "only",
          version_no: 1,
          name: "doc",
          size_bytes: 10,
          content_type: "application/pdf",
          status: "vigente",
          version_note: null,
          uploaded_by: null,
          created_at: "2026-06-01T00:00:00Z",
          storage_path: "t1/none/none/x.pdf",
          is_current: true,
        },
      ],
    });
    const res = await listDocumentVersions(client, "only");
    expect(res).toHaveLength(1);
    expect(res[0].version_no).toBe(1);
    expect(res[0].is_current).toBe(true);
  });

  it("cadena inexistente / vacía → []", async () => {
    const { client } = makeClient({ documents: [] });
    expect(await listDocumentVersions(client, "nope")).toEqual([]);
  });

  it("invariante: a lo sumo una versión vigente en la cadena", async () => {
    // La invariante real la fuerza el índice único parcial one_current_per_root
    // (migración 0111). Acá verificamos que el historial reportado sea coherente
    // con esa invariante: exactamente una fila is_current=true.
    const { client } = makeClient({
      documents: [
        { id: "v2", version_no: 2, is_current: true, name: "v2", size_bytes: 2, content_type: null, status: "vigente", version_note: null, uploaded_by: null, created_at: "2026-06-02T00:00:00Z", storage_path: "p2" },
        { id: "v1", version_no: 1, is_current: false, name: "v1", size_bytes: 1, content_type: null, status: "vigente", version_note: null, uploaded_by: null, created_at: "2026-06-01T00:00:00Z", storage_path: "p1" },
      ],
    });
    const res = await listDocumentVersions(client, "root");
    expect(res.filter((v) => v.is_current)).toHaveLength(1);
    expect(res.find((v) => v.is_current)?.version_no).toBe(2);
  });
});
