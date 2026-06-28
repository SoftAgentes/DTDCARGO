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
let listEntries: { name: string; id: string | null; created_at: string | null }[] = [];

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
          return Promise.resolve({ error: null });
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
  process.env.CRON_SECRET = "s3cret";
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.PURGE_RECEIPT_ORPHANS_ENABLED;
});

const AUTH = { authorization: "Bearer s3cret" };

describe("auth", () => {
  it("sin Authorization → 403 y NO borra", async () => {
    const res = await GET(req("", {}) as never);
    expect(res.status).toBe(403);
    expect(ops.removed).toEqual([]);
  });

  it("Bearer incorrecto → 403", async () => {
    const res = await GET(req("", { authorization: "Bearer otro" }) as never);
    expect(res.status).toBe(403);
    expect(ops.removed).toEqual([]);
  });
});

describe("dry-run por defecto (gate apagado)", () => {
  it("detecta huérfanos pero NO borra nada", async () => {
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      mode: string;
      orphans: number;
      deleted: number;
    };
    expect(json.mode).toBe("dry-run");
    expect(json.orphans).toBe(1); // orphan-old.jpg
    expect(json.deleted).toBe(0);
    expect(ops.removed).toEqual([]);
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
});
