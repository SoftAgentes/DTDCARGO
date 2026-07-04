/**
 * Tests del cron GC de audios huérfanos (/api/cron/bitacora-purge-orphans).
 *
 * Cubre: auth (403 sin Bearer); dry-run POR DEFECTO (no borra aunque haya
 * huérfanos); modo live solo con BITACORA_PURGE_ORPHANS_ENABLED=true; nunca
 * borra un audio referenciado por un borrador, ni uno demasiado nuevo, y —
 * CRÍTICO — nunca borra un ADJUNTO DE TAREA (`bitacora_task/`), que vive en el
 * mismo bucket pero se referencia en `documents`, no en `audio_path`.
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

let meetingRows: { audio_path: string | null }[] = [];
let listEntries: { name: string; id: string | null; created_at: string | null }[] =
  [];

function makeAdmin() {
  return {
    from: () => ({
      select: () => ({
        range: (from: number) => {
          if (from > 0) return Promise.resolve({ data: [], error: null });
          return Promise.resolve({ data: meetingRows, error: null });
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
  return new Request(
    `http://localhost/api/cron/bitacora-purge-orphans${query}`,
    { method: "GET", headers },
  );
}

function seedFixtures() {
  // Un audio referenciado por un borrador vivo.
  meetingRows = [{ audio_path: "T1/bitacora_meeting/M1/keep.webm" }];
  listEntries = [
    { name: "T1/bitacora_meeting/M1/keep.webm", id: "1", created_at: OLD }, // referenciado
    { name: "T1/bitacora_meeting/M2/orphan-old.webm", id: "2", created_at: OLD }, // huérfano viejo → borrar
    { name: "T1/bitacora_meeting/M3/orphan-fresh.webm", id: "3", created_at: FRESH }, // muy nuevo → conservar
    { name: "T1/bitacora_task/K9/proof.jpg", id: "4", created_at: OLD }, // ADJUNTO DE TAREA → intocable
  ];
}

beforeEach(() => {
  ops.reset();
  seedFixtures();
  process.env.CRON_SECRET = "s3cret";
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.BITACORA_PURGE_ORPHANS_ENABLED;
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
  it("detecta 1 huérfano (audio de reunión) pero NO borra nada", async () => {
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      mode: string;
      orphans: number;
      deleted: number;
      scanned: number;
    };
    expect(json.mode).toBe("dry-run");
    // scanned = SOLO los audios de reunión (el adjunto de tarea queda scopeado out)
    expect(json.scanned).toBe(3);
    expect(json.orphans).toBe(1); // orphan-old.webm
    expect(json.deleted).toBe(0);
    expect(ops.removed).toEqual([]);
  });
});

describe("modo live (gate encendido)", () => {
  beforeEach(() => {
    process.env.BITACORA_PURGE_ORPHANS_ENABLED = "true";
  });

  it("borra SOLO el audio huérfano viejo · nunca el referenciado, el fresco ni el ADJUNTO de tarea", async () => {
    const res = await GET(req("", AUTH) as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { mode: string; deleted: number };
    expect(json.mode).toBe("live");
    expect(json.deleted).toBe(1);
    expect(ops.removed).toEqual(["T1/bitacora_meeting/M2/orphan-old.webm"]);
    // NUNCA toca el audio referenciado, el fresco, ni el adjunto de tarea.
    expect(ops.removed).not.toContain("T1/bitacora_meeting/M1/keep.webm");
    expect(ops.removed).not.toContain("T1/bitacora_meeting/M3/orphan-fresh.webm");
    expect(ops.removed).not.toContain("T1/bitacora_task/K9/proof.jpg");
  });

  it("?dryRun=1 fuerza dry-run aunque el gate esté activo", async () => {
    const res = await GET(req("?dryRun=1", AUTH) as never);
    const json = (await res.json()) as { mode: string; deleted: number };
    expect(json.mode).toBe("dry-run");
    expect(json.deleted).toBe(0);
    expect(ops.removed).toEqual([]);
  });
});
