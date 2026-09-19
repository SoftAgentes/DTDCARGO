// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { AttachmentQueueRecord } from "../attachment-queue";

const rows = new Map<string, AttachmentQueueRecord>();

function request<T>(value: T) {
  const result = { result: value, error: null, onsuccess: null as null | (() => void), onerror: null };
  queueMicrotask(() => result.onsuccess?.());
  return result;
}

beforeEach(() => {
  rows.clear();
  const store = {
    createIndex: () => undefined,
    put: (value: AttachmentQueueRecord) => { rows.set(value.id, value); return request(value.id); },
    get: (id: string) => request(rows.get(id)),
    delete: (id: string) => { rows.delete(id); return request(undefined); },
    index: () => ({ getAll: (owner: string) => request([...rows.values()].filter((row) => row.ownerKey === owner)) }),
  };
  const db = {
    objectStoreNames: { contains: () => false },
    createObjectStore: () => store,
    transaction: () => ({ objectStore: () => store, onabort: null, error: null }),
    close: () => undefined,
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: { open: () => {
      const open = { result: db, error: null, onupgradeneeded: null as null | (() => void), onsuccess: null as null | (() => void), onerror: null };
      queueMicrotask(() => { open.onupgradeneeded?.(); open.onsuccess?.(); });
      return open;
    } },
  });
});

describe("cola durable", () => {
  it("separa registros por identidad", async () => {
    const queue = await import("../attachment-queue");
    const base = { id: "1", ownerKey: "tenant:user", entityId: "e", file: new Blob(["x"]), fileName: "x.pdf", mime: "application/pdf", size: 1, status: "queued", createdAt: "2026-01-01", updatedAt: "2026-01-01" } satisfies AttachmentQueueRecord;
    await queue.putQueuedAttachment(base);
    await queue.putQueuedAttachment({ ...base, id: "2", ownerKey: "otro:user" });
    expect(await queue.listQueuedAttachments("tenant:user")).toHaveLength(1);
  });
  it("nunca descarta una copia no completada", async () => {
    const queue = await import("../attachment-queue");
    const record = { id: "1", ownerKey: "t:u", entityId: "e", file: new Blob(["x"]), fileName: "x.pdf", mime: "application/pdf", size: 1, status: "failed", createdAt: "2026", updatedAt: "2026" } satisfies AttachmentQueueRecord;
    await queue.putQueuedAttachment(record);
    await expect(queue.removeCompletedAttachment("1")).rejects.toThrow("Solo se puede");
  });
  it("convierte operaciones interrumpidas en reintentables", async () => {
    const queue = await import("../attachment-queue");
    const record = { id: "1", ownerKey: "t:u", entityId: "e", file: new Blob(["x"]), fileName: "x.pdf", mime: "application/pdf", size: 1, status: "uploading", createdAt: "2026", updatedAt: "2026" } satisfies AttachmentQueueRecord;
    await queue.putQueuedAttachment(record);
    const [reconciled] = await queue.reconcileInterruptedAttachments("t:u");
    expect(reconciled.status).toBe("failed");
    expect(reconciled.error).toContain("interrumpida");
  });
});
