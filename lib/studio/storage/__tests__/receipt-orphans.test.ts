/**
 * GC receipt-photos · tests del núcleo PURO pickOrphans.
 * Es la pieza de seguridad: NUNCA debe seleccionar un objeto referenciado
 * (POD legal) ni uno demasiado nuevo (upload en vuelo).
 */
import { describe, it, expect } from "vitest";
import { pickOrphans, type StoredObject } from "../receipt-orphans";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;
const OLD = new Date(NOW - 30 * DAY).toISOString();
const FRESH = new Date(NOW - 1 * 60 * 1000).toISOString(); // hace 1 min

function run(objects: StoredObject[], known: string[], cap = 500) {
  return pickOrphans({
    objects,
    known: new Set(known),
    minAgeMs: 7 * DAY,
    nowMs: NOW,
    cap,
  });
}

describe("pickOrphans · seguridad", () => {
  it("NUNCA selecciona un objeto referenciado (aunque sea viejo)", () => {
    const r = run(
      [{ name: "pod/t1/o1/firma.png", createdAt: OLD }],
      ["pod/t1/o1/firma.png"],
    );
    expect(r.orphans).toEqual([]);
    expect(r.referenced).toBe(1);
  });

  it("NO borra objetos demasiado nuevos (upload en vuelo)", () => {
    const r = run([{ name: "t1/r1/0-x.jpg", createdAt: FRESH }], []);
    expect(r.orphans).toEqual([]);
    expect(r.skippedTooNew).toBe(1);
  });

  it("NO borra objetos sin fecha (no se puede verificar edad)", () => {
    const r = run([{ name: "t1/r1/0-x.jpg", createdAt: null }], []);
    expect(r.orphans).toEqual([]);
    expect(r.skippedNoDate).toBe(1);
  });

  it("SÍ selecciona un huérfano viejo no referenciado", () => {
    const r = run([{ name: "t1/r1/9-zombie.jpg", createdAt: OLD }], []);
    expect(r.orphans).toEqual(["t1/r1/9-zombie.jpg"]);
  });
});

describe("pickOrphans · mezcla realista", () => {
  it("separa referenciados, nuevos y huérfanos correctamente", () => {
    const r = run(
      [
        { name: "known-warehouse.jpg", createdAt: OLD },
        { name: "known-pod.jpg", createdAt: OLD },
        { name: "orphan-old-1.jpg", createdAt: OLD },
        { name: "orphan-old-2.jpg", createdAt: OLD },
        { name: "orphan-but-fresh.jpg", createdAt: FRESH },
        { name: "orphan-no-date.jpg", createdAt: null },
      ],
      ["known-warehouse.jpg", "known-pod.jpg"],
    );
    expect(r.scanned).toBe(6);
    expect(r.referenced).toBe(2);
    expect(r.skippedTooNew).toBe(1);
    expect(r.skippedNoDate).toBe(1);
    expect(r.orphans.sort()).toEqual(["orphan-old-1.jpg", "orphan-old-2.jpg"]);
  });

  it("respeta el cap y reporta cappedAt", () => {
    const objs: StoredObject[] = Array.from({ length: 10 }, (_, i) => ({
      name: `orphan-${i}.jpg`,
      createdAt: OLD,
    }));
    const r = run(objs, [], 3);
    expect(r.orphans).toHaveLength(3);
    expect(r.cappedAt).toBe(3);
  });

  it("sin huérfanos → cappedAt null", () => {
    const r = run([{ name: "a.jpg", createdAt: OLD }], ["a.jpg"]);
    expect(r.cappedAt).toBeNull();
  });
});
