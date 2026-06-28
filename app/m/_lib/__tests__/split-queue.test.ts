/**
 * SDD-0030 · Tests de la cola offline de fraccionamientos (split-queue).
 *  - enqueue/getPending/remove/count round-trip.
 *  - dedup por packageId (un split pending por paquete).
 *  - cap MAX_QUEUE (se queda con los más recientes).
 *  - makeSplitLocalId estable (sin Math.random) y único por llamada.
 *  - read tolera localStorage corrupto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueSplit,
  getPendingSplits,
  removeSplit,
  pendingSplitCount,
  makeSplitLocalId,
  type PendingSplit,
} from "../split-queue";

function mk(overrides: Partial<PendingSplit> = {}): PendingSplit {
  return {
    localId: makeSplitLocalId(overrides.packageId ?? "pkg-x"),
    odId: "od-1",
    odCode: "OD-2026-0001",
    packageId: "pkg-x",
    markbox: "DTD-0001",
    boxesShipped: 3,
    splitReason: "falta_volumen",
    splitReasonText: null,
    queuedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("enqueue / get / remove / count", () => {
  it("encola y lee de vuelta", () => {
    enqueueSplit(mk({ localId: "a", packageId: "pkg-a" }));
    const pending = getPendingSplits();
    expect(pending).toHaveLength(1);
    expect(pending[0].packageId).toBe("pkg-a");
    expect(pendingSplitCount()).toBe(1);
  });

  it("remove saca solo el localId indicado", () => {
    enqueueSplit(mk({ localId: "a", packageId: "pkg-a" }));
    enqueueSplit(mk({ localId: "b", packageId: "pkg-b" }));
    removeSplit("a");
    const pending = getPendingSplits();
    expect(pending).toHaveLength(1);
    expect(pending[0].localId).toBe("b");
  });

  it("count vacío arranca en 0", () => {
    expect(pendingSplitCount()).toBe(0);
  });
});

describe("dedup por packageId", () => {
  it("encolar el mismo paquete reemplaza, no duplica", () => {
    enqueueSplit(mk({ localId: "a", packageId: "pkg-a", boxesShipped: 3 }));
    enqueueSplit(mk({ localId: "b", packageId: "pkg-a", boxesShipped: 5 }));
    const pending = getPendingSplits();
    expect(pending).toHaveLength(1);
    expect(pending[0].localId).toBe("b");
    expect(pending[0].boxesShipped).toBe(5);
  });

  it("paquetes distintos coexisten", () => {
    enqueueSplit(mk({ localId: "a", packageId: "pkg-a" }));
    enqueueSplit(mk({ localId: "b", packageId: "pkg-b" }));
    expect(getPendingSplits()).toHaveLength(2);
  });
});

describe("cap MAX_QUEUE", () => {
  it("nunca guarda más de 5 y conserva los más recientes", () => {
    for (let i = 0; i < 8; i++) {
      enqueueSplit(mk({ localId: `id-${i}`, packageId: `pkg-${i}` }));
    }
    const pending = getPendingSplits();
    expect(pending).toHaveLength(5);
    // los 5 más recientes son pkg-3..pkg-7
    expect(pending.map((s) => s.packageId)).toEqual([
      "pkg-3",
      "pkg-4",
      "pkg-5",
      "pkg-6",
      "pkg-7",
    ]);
  });
});

describe("makeSplitLocalId", () => {
  it("incluye el packageId y es único entre llamadas (contador de cola)", () => {
    const id1 = makeSplitLocalId("pkg-z");
    enqueueSplit(mk({ localId: id1, packageId: "pkg-z" }));
    const id2 = makeSplitLocalId("pkg-w");
    expect(id1).toContain("pkg-z");
    expect(id2).toContain("pkg-w");
    expect(id1).not.toBe(id2);
  });
});

describe("tolerancia a datos corruptos", () => {
  it("localStorage con JSON inválido → lista vacía, no rompe", () => {
    localStorage.setItem("dtd_split_queue", "{no-json");
    expect(getPendingSplits()).toEqual([]);
    expect(pendingSplitCount()).toBe(0);
  });

  it("localStorage con un objeto no-array → lista vacía", () => {
    localStorage.setItem("dtd_split_queue", JSON.stringify({ foo: 1 }));
    expect(getPendingSplits()).toEqual([]);
  });
});
