/**
 * SDD-0030 · Tests de la cola offline de fraccionamientos (split-queue).
 *  - enqueue/getPending/remove/count round-trip.
 *  - dedup por packageId (un split pending por paquete).
 *  - cap MAX_QUEUE (se queda con los más recientes).
 *  - makeSplitLocalId estable (sin Math.random) y único por llamada.
 *  - read tolera localStorage corrupto.
 */
import { createElement } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
const runner = vi.hoisted(() => ({ action: vi.fn(), success: vi.fn(), refresh: vi.fn() }));
vi.mock("@/app/m/ve/bodeguero/actions", () => ({ splitPackageP2Action: runner.action }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: runner.refresh }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: runner.success }) }));
import { SplitQueueRetryRunner } from "@/app/m/ve/bodeguero/_components/SplitQueueRetryRunner";
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

/** SDD0578 addendum70: real runner, fictitious local queue only. NOT EXECUTED in P1.
 * Existing storage/dedup/cap/corruption assertions above remain unchanged.
 * The mock proves response presentation, not SQL0184/NOWAIT or persistence.
 */
describe("runner preserves only the new identified retryable denial", () => {
  const conflict = { error: "El despacho está cambiando. No se fraccionó este paquete. Revisa la orden e inténtalo de nuevo.", retryable: true };
  beforeEach(() => {
    vi.clearAllMocks(); runner.action.mockResolvedValue({ ok: true });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("retains every field byte-equivalent and does not count/repeat an atomic conflict", async () => {
    const entry = mk({ localId: "pending-conflict", packageId: "synthetic-pkg-conflict", queuedAt: 5780,
      splitReasonText: "Fracción sintética conservada" });
    enqueueSplit(entry); const before = JSON.stringify(getPendingSplits());
    runner.action.mockResolvedValueOnce(conflict);
    render(createElement(SplitQueueRetryRunner));
    await waitFor(() => expect(runner.action).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(JSON.stringify(getPendingSplits())).toBe(before); expect(pendingSplitCount()).toBe(1);
    expect(runner.success).not.toHaveBeenCalled(); expect(runner.refresh).not.toHaveBeenCalled();
    expect(runner.action).toHaveBeenCalledTimes(1); // No immediate second RPC/loop.
    const submitted = runner.action.mock.calls[0][1];
    expect(submitted).toBeInstanceOf(FormData);
    expect(Object.fromEntries(submitted.entries())).toEqual({ od_id: entry.odId, package_id: entry.packageId,
      boxes_shipped: String(entry.boxesShipped), split_reason: entry.splitReason, split_reason_text: entry.splitReasonText });

    // The EXISTING next-online mechanism retries the same command. It is not
    // automatic success: real0184 must decide under its current authority.
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(pendingSplitCount()).toBe(0));
    expect(runner.action).toHaveBeenCalledTimes(2);
    expect(Object.fromEntries(runner.action.mock.calls[1][1].entries())).toEqual(Object.fromEntries(submitted.entries()));
    expect(runner.success).toHaveBeenCalledTimes(1);
    expect(runner.success).toHaveBeenCalledWith("Fraccionamiento pendiente aplicado ✓");
    expect(runner.refresh).toHaveBeenCalledTimes(1);
  });
  it("a mixed drain counts only its resolved entries and leaves the retryable entry unchanged", async () => {
    const retained = mk({ localId: "keep", packageId: "synthetic-keep", queuedAt: 5701 });
    enqueueSplit(retained); enqueueSplit(mk({ localId: "resolved-a", packageId: "synthetic-a" }));
    enqueueSplit(mk({ localId: "resolved-b", packageId: "synthetic-b" }));
    runner.action.mockResolvedValueOnce(conflict).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });
    render(createElement(SplitQueueRetryRunner));
    await waitFor(() => expect(runner.success).toHaveBeenCalledTimes(1));
    expect(getPendingSplits()).toEqual([retained]); expect(runner.action).toHaveBeenCalledTimes(3);
    expect(runner.success).toHaveBeenCalledWith("2 fraccionamientos pendientes aplicados ✓");
    expect(runner.refresh).toHaveBeenCalledTimes(1);
  });
  it.each(["Este paquete ya fue fraccionado.", "Validación terminal sintética"])("keeps the scoped legacy terminal behavior: %s", async (error) => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    enqueueSplit(mk({ localId: "terminal", packageId: "synthetic-terminal" }));
    runner.action.mockResolvedValueOnce({ error }); render(createElement(SplitQueueRetryRunner));
    await waitFor(() => expect(pendingSplitCount()).toBe(0));
    expect(runner.action).toHaveBeenCalledTimes(1); expect(warning).toHaveBeenCalledTimes(1);
    expect(runner.success).toHaveBeenCalledWith("Fraccionamiento pendiente aplicado ✓");
    expect(runner.refresh).toHaveBeenCalledTimes(1);
  });
  it("a thrown transport error remains queued without pretending an atomic denial", async () => {
    const entry = mk({ localId: "network", packageId: "synthetic-network", queuedAt: 5703 }); enqueueSplit(entry);
    runner.action.mockRejectedValueOnce(new Error("synthetic offline transport"));
    render(createElement(SplitQueueRetryRunner));
    await waitFor(() => expect(runner.action).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(getPendingSplits()).toEqual([entry]); expect(runner.success).not.toHaveBeenCalled(); expect(runner.refresh).not.toHaveBeenCalled();
  });
  it("online while a request is pending never starts a second request in that drain", async () => {
    let finish!: (value: typeof conflict) => void;
    runner.action.mockImplementationOnce(() => new Promise<typeof conflict>((resolve) => { finish = resolve; }));
    const entry = mk({ localId: "in-flight", packageId: "synthetic-in-flight" }); enqueueSplit(entry);
    render(createElement(SplitQueueRetryRunner));
    await waitFor(() => expect(runner.action).toHaveBeenCalledTimes(1));
    await act(async () => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); });
    expect(runner.action).toHaveBeenCalledTimes(1);
    await act(async () => { finish(conflict); });
    expect(getPendingSplits()).toEqual([entry]); expect(runner.action).toHaveBeenCalledTimes(1);
    expect(runner.success).not.toHaveBeenCalled(); expect(runner.refresh).not.toHaveBeenCalled();
  });
});
