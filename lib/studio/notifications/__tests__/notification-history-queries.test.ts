// @vitest-environment node
/**
 * SDD-0156 · Slice C — listShipmentNotificationHistory: historial read-only de
 * avisos ENVIADOS de un envío para el portal.
 */
import { describe, it, expect } from "vitest";
import { listShipmentNotificationHistory } from "../notification-history-queries";

type Row = {
  id: string;
  trigger_event: string;
  channel: string;
  payload: Record<string, unknown> | null;
  sent_at: string | null;
};

/** Admin mock: la cadena select→eq→eq→order→limit resuelve `{ data, error }`. */
function makeAdmin(rows: Row[], error: unknown = null) {
  const chain = {
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: error ? null : rows, error }),
  };
  return {
    from: () => ({ select: () => chain }),
  } as never;
}

describe("listShipmentNotificationHistory", () => {
  it("mapea las filas sent a items amigables (label + canal + copy)", async () => {
    const admin = makeAdmin([
      {
        id: "n-1",
        trigger_event: "status:shipped",
        channel: "both",
        payload: { title: "Tu carga fue embarcada", body: "Zarpó de China." },
        sent_at: "2026-03-01T10:00:00.000Z",
      },
    ]);
    const items = await listShipmentNotificationHistory(admin, "s-1");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "n-1",
      eventLabel: "Embarcado",
      channel: "both",
      title: "Tu carga fue embarcada",
      body: "Zarpó de China.",
      sentAt: "2026-03-01T10:00:00.000Z",
    });
  });

  it("usa copy default cuando el payload no trae title/body", async () => {
    const admin = makeAdmin([
      {
        id: "n-2",
        trigger_event: "received_ve",
        channel: "email",
        payload: null,
        sent_at: null,
      },
    ]);
    const items = await listShipmentNotificationHistory(admin, "s-1");
    expect(items[0].title).toBe("Actualización de tu envío");
    expect(items[0].eventLabel).toBe("Recibido en Venezuela");
  });

  it("sin filas → []", async () => {
    const items = await listShipmentNotificationHistory(makeAdmin([]), "s-1");
    expect(items).toEqual([]);
  });

  it("falla-seguro: ante error → []", async () => {
    const items = await listShipmentNotificationHistory(
      makeAdmin([], { message: "boom" }),
      "s-1",
    );
    expect(items).toEqual([]);
  });
});
