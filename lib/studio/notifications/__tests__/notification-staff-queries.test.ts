// @vitest-environment node
/**
 * Motor de Crecimiento · F2-T04 — vista staff de la cola de avisos.
 * FUND-S3-02: conteo por estado + avisos recientes del tenant.
 */
import { describe, it, expect } from "vitest";
import {
  tallyStatusCounts,
  emptyStatusCounts,
  getNotificationStatusCounts,
  listRecentStaffNotifications,
} from "../notification-staff-queries";

describe("tallyStatusCounts", () => {
  it("cuenta por estado y ignora desconocidos", () => {
    const counts = tallyStatusCounts([
      { status: "sent" },
      { status: "sent" },
      { status: "skipped" },
      { status: "failed" },
      { status: "scheduled" },
      { status: "canceled" },
      { status: "quien_sabe" }, // desconocido → ignorado
    ]);
    expect(counts).toEqual({
      scheduled: 1,
      sent: 2,
      skipped: 1,
      failed: 1,
      canceled: 1,
    });
  });

  it("sin filas → ceros", () => {
    expect(tallyStatusCounts([])).toEqual(emptyStatusCounts());
  });
});

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

/** Mock de conteos: select→eq→order→range resuelve `{ data, error }`. */
function makeCountsAdmin(rows: Array<{ status: string }>, error: unknown = null) {
  const chain = {
    eq: () => chain,
    order: () => chain,
    // Corta en SERVER_CAP por request igual que PostgREST: un doble más
    // generoso que el servidor deja pasar código que en producción trunca.
    range: (desde: number, hasta: number) => {
      if (error) return Promise.resolve({ data: null, error });
      const pedido = hasta - desde + 1;
      const trozo = rows.slice(desde, desde + Math.min(pedido, SERVER_CAP));
      return Promise.resolve({ data: trozo, error: null });
    },
    limit: () => Promise.resolve({ data: error ? null : rows, error }),
  };
  return { from: () => ({ select: () => chain }) } as never;
}

describe("getNotificationStatusCounts", () => {
  it("tallea la columna status de la cola", async () => {
    const counts = await getNotificationStatusCounts(
      makeCountsAdmin([
        { status: "sent" },
        { status: "skipped" },
        { status: "skipped" },
      ]),
      "t-1",
    );
    expect(counts).toMatchObject({ sent: 1, skipped: 2, failed: 0 });
  });

  it("falla-seguro: ante error → ceros", async () => {
    const counts = await getNotificationStatusCounts(
      makeCountsAdmin([], { message: "boom" }),
      "t-1",
    );
    expect(counts).toEqual(emptyStatusCounts());
  });
});

/** Mock de recientes: select→eq→order→limit resuelve `{ data, error }`. */
function makeRecentAdmin(rows: unknown[], error: unknown = null) {
  const chain = {
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: error ? null : rows, error }),
  };
  return { from: () => ({ select: () => chain }) } as never;
}

describe("listRecentStaffNotifications", () => {
  it("mapea filas a items legibles (label + shipmentCode del payload)", async () => {
    const items = await listRecentStaffNotifications(
      makeRecentAdmin([
        {
          id: "n-1",
          trigger_event: "status:shipped",
          status: "sent",
          channel: "email",
          scheduled_for: "2026-03-01T10:00:00.000Z",
          sent_at: "2026-03-01T10:01:00.000Z",
          error: null,
          client_markbox: "DTD-1001",
          payload: { shipmentCode: "DTD-SH-9" },
        },
      ]),
      "t-1",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "n-1",
      eventLabel: "Embarcado",
      status: "sent",
      shipmentCode: "DTD-SH-9",
      clientMarkbox: "DTD-1001",
    });
  });

  it("estado desconocido cae a 'scheduled'; payload sin código → null", async () => {
    const items = await listRecentStaffNotifications(
      makeRecentAdmin([
        {
          id: "n-2",
          trigger_event: "received_ve",
          status: "raro",
          channel: "push",
          scheduled_for: "2026-03-02T10:00:00.000Z",
          sent_at: null,
          error: null,
          client_markbox: "DTD-1002",
          payload: null,
        },
      ]),
      "t-1",
    );
    expect(items[0]).toMatchObject({
      status: "scheduled",
      shipmentCode: null,
      eventLabel: "Recibido en Venezuela",
    });
  });

  it("falla-seguro: ante error → []", async () => {
    const items = await listRecentStaffNotifications(
      makeRecentAdmin([], { message: "boom" }),
      "t-1",
    );
    expect(items).toEqual([]);
  });
});
