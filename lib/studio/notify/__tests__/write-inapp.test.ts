/**
 * SDD-0146 Fase 5 · writeInAppNotification (extraída + generalizada).
 *
 * Criterios: (e) excluye al actor (nadie se auto-notifica); bugId opcional para
 * Bitácora (bug_id null en la fila); dedup reusa la fila reciente (bug: por
 * bug_id · Bitácora: por tag); la fila insertada estampa delivered_inapp_at.
 * NO-REGRESIÓN bugs: con bugId + payload, inserta con bug_id (comportamiento
 * original SDD-0036).
 */
import { describe, it, expect } from "vitest";
import { writeInAppNotification } from "../write-inapp";

interface AdminState {
  dup: { id: string } | null;
}

function makeAdmin(state: AdminState) {
  const rec = { inserted: null as Record<string, unknown> | null };
  const admin = {
    from() {
      let insertPayload: Record<string, unknown> | null = null;
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        insert(p: Record<string, unknown>) {
          insertPayload = p;
          return chain;
        },
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        gte() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: state.dup, error: null });
        },
        single() {
          rec.inserted = insertPayload;
          return Promise.resolve({ data: { id: "new-id" }, error: null });
        },
      };
      return chain;
    },
  } as never;
  return { admin, rec };
}

describe("writeInAppNotification · exclusión del actor", () => {
  it("destinatario === actor → no escribe (devuelve null)", async () => {
    const { admin, rec } = makeAdmin({ dup: null });
    const id = await writeInAppNotification(admin, {
      userId: "u1",
      actorId: "u1",
      type: "bitacora_task",
      payload: { label: "x" },
    });
    expect(id).toBeNull();
    expect(rec.inserted).toBeNull();
  });

  it("destinatario ≠ actor → escribe", async () => {
    const { admin, rec } = makeAdmin({ dup: null });
    const id = await writeInAppNotification(admin, {
      userId: "u2",
      actorId: "u1",
      type: "bitacora_task",
      payload: { label: "x", tag: "task-1" },
    });
    expect(id).toBe("new-id");
    expect(rec.inserted).toMatchObject({ user_id: "u2", type: "bitacora_task" });
  });
});

describe("writeInAppNotification · Bitácora (bugId opcional)", () => {
  it("sin bugId → inserta con bug_id null + delivered_inapp_at", async () => {
    const { admin, rec } = makeAdmin({ dup: null });
    await writeInAppNotification(admin, {
      userId: "u2",
      bugId: null,
      type: "bitacora_digest",
      payload: { label: "resumen", tag: "recordatorio-bitacora-2026-07-04" },
    });
    expect(rec.inserted?.bug_id).toBeNull();
    expect(rec.inserted?.delivered_inapp_at).toBeTruthy();
  });

  it("dedup: fila reciente del mismo tag → reusa su id, no inserta", async () => {
    const { admin, rec } = makeAdmin({ dup: { id: "existing" } });
    const id = await writeInAppNotification(admin, {
      userId: "u2",
      bugId: null,
      type: "bitacora_task",
      payload: { label: "x", tag: "task-1" },
    });
    expect(id).toBe("existing");
    expect(rec.inserted).toBeNull();
  });
});

describe("writeInAppNotification · bugs (no-regresión)", () => {
  it("con bugId → inserta con ese bug_id", async () => {
    const { admin, rec } = makeAdmin({ dup: null });
    await writeInAppNotification(admin, {
      userId: "u2",
      bugId: "bug-9",
      type: "state_change",
      payload: { folio: "BUG-1", label: "cambió" },
    });
    expect(rec.inserted).toMatchObject({ bug_id: "bug-9", type: "state_change" });
  });

  it("dedup por bug reciente → reusa id", async () => {
    const { admin } = makeAdmin({ dup: { id: "dup-bug" } });
    const id = await writeInAppNotification(admin, {
      userId: "u2",
      bugId: "bug-9",
      type: "state_change",
      payload: { folio: "BUG-1" },
    });
    expect(id).toBe("dup-bug");
  });
});

describe("writeInAppNotification · markDelivered false (SDD-0036 P3, ancla de retry)", () => {
  it("channel_inapp OFF → inserta la fila pero SIN delivered_inapp_at", async () => {
    const { admin, rec } = makeAdmin({ dup: null });
    const id = await writeInAppNotification(admin, {
      userId: "u2",
      bugId: "bug-9",
      type: "critical_alert",
      payload: { folio: "BUG-1", label: "crítico" },
      markDelivered: false,
    });
    expect(id).toBe("new-id");
    expect(rec.inserted).toMatchObject({ bug_id: "bug-9", delivered_inapp_at: null });
  });
});
