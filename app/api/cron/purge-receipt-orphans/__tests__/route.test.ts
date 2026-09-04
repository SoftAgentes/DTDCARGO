/**
 * Tests del cron GC de huérfanos (/api/cron/purge-receipt-orphans).
 *
 * Cubre: auth (403 sin Bearer); dry-run POR DEFECTO (no borra aunque haya
 * huérfanos); modo live solo con PURGE_RECEIPT_ORPHANS_ENABLED=true; nunca
 * borra objetos referenciados (POD) ni demasiado nuevos; ?dryRun=1 fuerza
 * dry-run aunque esté activo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const DAY = 24 * 60 * 60 * 1000;
const OLD = new Date(Date.now() - 30 * DAY).toISOString();
const FRESH = new Date(Date.now() - 60 * 1000).toISOString();

const ops = {
  removed: [] as string[],
  reset() {
    this.removed = [];
  },
};

let warehouseRows: { storage_path: string | null }[] = [];
let podRows: { photo_path: string | null; signature_path: string | null }[] = [];
let bugRows: { storage_path: string | null }[] = [];
let listEntries: {
  name: string;
  id: string | null;
  created_at: string | null;
}[] = [];
let removeError: { code: string; message: string } | null = null;

function makeAdmin() {
  return {
    from: (table: string) => ({
      select: () => ({
        range: (from: number) => {
          if (from > 0) return Promise.resolve({ data: [], error: null });
          const data =
            table === "warehouse_receipt_photos"
              ? warehouseRows
              : table === "dispatch_pods"
                ? podRows
                : table === "bug_attachments"
                  ? bugRows
                  : [];
          return Promise.resolve({ data, error: null });
        },
      }),
    }),
    storage: {
      from: () => ({
        list: (prefix: string, opts: { offset?: number }) => {
          if (prefix !== "" || (opts?.offset ?? 0) > 0) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: listEntries, error: null });
        },
        remove: (paths: string[]) => {
          ops.removed.push(...paths);
          return Promise.resolve({ error: removeError });
        },
      }),
    },
  };
}

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => makeAdmin() }));

import { GET } from "../route";

function req(query = "", headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/cron/purge-receipt-orphans${query}`, {
    method: "GET",
    headers,
  });
}

function seedFixtures() {
  warehouseRows = [{ storage_path: "known-w.jpg" }];
  podRows = [{ photo_path: "pod.jpg", signature_path: "firma.png" }];
  bugRows = [{ storage_path: "bug/t1/b1/shot.jpg" }];
  listEntries = [
    { name: "known-w.jpg", id: "1", created_at: OLD },
    { name: "pod.jpg", id: "2", created_at: OLD },
    { name: "firma.png", id: "3", created_at: OLD },
    { name: "bug/t1/b1/shot.jpg", id: "6", created_at: OLD }, // bug adjunto · referenciado
    { name: "orphan-old.jpg", id: "4", created_at: OLD },
    { name: "orphan-fresh.jpg", id: "5", created_at: FRESH },
  ];
}

beforeEach(() => {
  ops.reset();
  seedFixtures();
  removeError = null;
  process.env.CRON_SECRET = "s3cret";
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.PURGE_RECEIPT_ORPHANS_ENABLED;
});

const AUTH = { authorization: "Bearer s3cret" };

describe("auth", () => {
  it("sin Authorization → 403 y NO borra", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await GET(
      req("", { "x-request-id": "receipt-deny-001" }) as never,
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("x-request-id")).toBe("receipt-deny-001");
    expect(ops.removed).toEqual([]);
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.authorization_denied",
      component: "cron.purge-receipt-orphans",
      requestId: "receipt-deny-001",
    });
  });

  it("Bearer incorrecto → 403", async () => {
    const res = await GET(req("", { authorization: "Bearer otro" }) as never);
    expect(res.status).toBe(403);
    expect(ops.removed).toEqual([]);
  });
});

describe("dry-run por defecto (gate apagado)", () => {
  it("detecta huérfanos pero NO borra nada", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await GET(
      req("", { ...AUTH, "x-request-id": "receipt-run-001" }) as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("receipt-run-001");
    const json = (await res.json()) as {
      mode: string;
      orphans: number;
      deleted: number;
    };
    expect(json.mode).toBe("dry-run");
    expect(json.orphans).toBe(1); // orphan-old.jpg
    expect(json.deleted).toBe(0);
    expect(ops.removed).toEqual([]);
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.completed",
      component: "cron.purge-receipt-orphans",
      requestId: "receipt-run-001",
      mode: "dry-run",
      orphans: 1,
      deleted: 0,
    });
  });
});

describe("modo live (gate encendido)", () => {
  beforeEach(() => {
    process.env.PURGE_RECEIPT_ORPHANS_ENABLED = "true";
  });

  it("borra SOLO el huérfano viejo · nunca el POD ni el fresco", async () => {
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { mode: string; deleted: number };
    expect(json.mode).toBe("live");
    expect(json.deleted).toBe(1);
    expect(ops.removed).toEqual(["orphan-old.jpg"]);
    // nunca toca lo referenciado (POD legal + adjunto de bug) ni lo fresco
    expect(ops.removed).not.toContain("pod.jpg");
    expect(ops.removed).not.toContain("firma.png");
    expect(ops.removed).not.toContain("known-w.jpg");
    expect(ops.removed).not.toContain("bug/t1/b1/shot.jpg");
    expect(ops.removed).not.toContain("orphan-fresh.jpg");
  });

  it("?dryRun=1 fuerza dry-run aunque el gate esté activo", async () => {
    const res = await GET(req("?dryRun=1", AUTH) as never);
    const json = (await res.json()) as { mode: string; deleted: number };
    expect(json.mode).toBe("dry-run");
    expect(json.deleted).toBe(0);
    expect(ops.removed).toEqual([]);
  });

  it("correlaciona un fallo de borrado sin registrar rutas ni mensaje crudo", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    removeError = {
      code: "STORAGE500",
      message: "owner@example.com Bearer s3cret orphan-old.jpg",
    };

    const res = await GET(
      req("", { ...AUTH, "x-request-id": "receipt-fail-001" }) as never,
    );

    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("receipt-fail-001");
    expect(JSON.stringify(await res.json())).not.toContain("owner@example.com");
    const line = errorSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: "cron.delete_failed",
      component: "cron.purge-receipt-orphans",
      requestId: "receipt-fail-001",
      mode: "live",
      stage: "storage_remove",
      deletedBeforeFailure: 0,
      batchSize: 1,
      error: { name: "Object", code: "STORAGE500" },
    });
    expect(line).not.toContain("owner@example.com");
    expect(line).not.toContain("s3cret");
    expect(line).not.toContain("orphan-old.jpg");
  });
});
