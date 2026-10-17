// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVENT_TYPE_META,
  DEFAULT_CALENDAR_TIME_ZONE,
  bitacoraTaskToCalendarEvent,
  calendarEventHref,
  toneBgVar,
  toneVar,
  normalizeCalendarTimeZone,
  timestampToCalendarDay,
  type CalendarEvent,
} from "./calendar-events-types";
import { listCalendarEvents } from "./calendar-events-queries";

const TASK_ID = "11111111-1111-1111-1111-111111111111";

describe("bitacoraTaskToCalendarEvent (SDD-0146 · Fase 6)", () => {
  it("mapea una tarea con vencimiento a un evento tipo 'tarea' que linkea al detalle", () => {
    const ev = bitacoraTaskToCalendarEvent({
      id: TASK_ID,
      titulo: "Enviar packing list",
      due_date: "2026-07-15",
      estado: "pendiente",
    });
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("tarea");
    expect(ev!.date).toBe("2026-07-15");
    expect(ev!.title).toBe("Enviar packing list");
    expect(ev!.href).toBe(`/studio/bitacora?task=${TASK_ID}`);
    expect(ev!.shipmentId).toBe(TASK_ID);
  });

  it("sin due_date → null (no aparece en el calendario)", () => {
    expect(
      bitacoraTaskToCalendarEvent({
        id: TASK_ID,
        titulo: "Sin fecha",
        due_date: null,
        estado: "pendiente",
      }),
    ).toBeNull();
  });

  it("recorta el timestamp a día ISO", () => {
    const ev = bitacoraTaskToCalendarEvent({
      id: TASK_ID,
      titulo: "x",
      due_date: "2026-07-15T00:00:00Z",
      estado: "pendiente",
    });
    expect(ev!.date).toBe("2026-07-15");
  });
});

describe("calendarEventHref", () => {
  const base = {
    id: "e",
    date: "2026-07-15",
    shipmentCode: "S-2026-0001",
    title: "S-2026-0001",
    tone: "info" as const,
    temporalKind: "local-date" as const,
  };

  it("evento de tarea → detalle de la tarea (href propio)", () => {
    const e: CalendarEvent = {
      ...base,
      type: "tarea",
      shipmentId: TASK_ID,
      href: `/studio/bitacora?task=${TASK_ID}`,
    };
    expect(calendarEventHref(e)).toBe(`/studio/bitacora?task=${TASK_ID}`);
  });

  it("evento de embarque (sin href) → tracking del embarque", () => {
    const e: CalendarEvent = { ...base, type: "arribo", shipmentId: "s1" };
    expect(calendarEventHref(e)).toBe("/studio/tracking/s1");
  });
});

describe("timezone de eventos operativos · SDD-0217", () => {
  it("no corta UTC: el mismo instante cae en días distintos en VE y China", () => {
    const instant = "2026-07-01T02:30:00Z";
    expect(timestampToCalendarDay(instant, "America/Caracas")).toBe(
      "2026-06-30",
    );
    expect(timestampToCalendarDay(instant, "Asia/Shanghai")).toBe(
      "2026-07-01",
    );
  });

  it("cruza fin de mes en Asia/Shanghai sin perder el evento", () => {
    expect(
      timestampToCalendarDay("2026-07-31T18:30:00Z", "Asia/Shanghai"),
    ).toBe("2026-08-01");
  });

  it("una zona inválida degrada de forma segura a Caracas", () => {
    expect(normalizeCalendarTimeZone("No/Existe")).toBe(
      DEFAULT_CALENDAR_TIME_ZONE,
    );
    expect(normalizeCalendarTimeZone(null)).toBe(DEFAULT_CALENDAR_TIME_ZONE);
  });
});

describe("metadata / tono del tipo 'tarea'", () => {
  it("EVENT_TYPE_META incluye 'tarea' con tono neutral", () => {
    expect(EVENT_TYPE_META.tarea).toBeDefined();
    expect(EVENT_TYPE_META.tarea.tone).toBe("neutral");
  });
  it("toneVar/toneBgVar resuelven el tono neutral a tokens del sistema", () => {
    expect(toneVar("neutral")).toBe("var(--ink-soft)");
    expect(toneBgVar("neutral")).toBe("var(--neutral-bg)");
  });
});

// ── Integración: listCalendarEvents con un cliente falso ──────────────
// Prueba que las tareas se SUMAN a los hitos de embarques (aditivo) y que
// si bitácora falla el calendario NO se rompe (degrada a los embarques).

type FakeResult = { data: unknown; error: unknown };

function fakeClient(results: Record<string, FakeResult>): SupabaseClient {
  const client = {
    from(table: string) {
      const result = results[table] ?? { data: [], error: null };
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "or", "eq", "is", "gte", "lte", "neq", "limit"]) {
        builder[m] = () => builder;
      }
      builder.then = (resolve: (r: FakeResult) => unknown) => resolve(result);
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

const RANGE = { from: "2026-07-01", to: "2026-07-31" };

describe("listCalendarEvents · tipo 'tarea' aditivo (SDD-0146)", () => {
  it("suma la tarea con due_date a los hitos de embarques", async () => {
    const client = fakeClient({
      shipments: {
        data: [
          {
            id: "s1",
            code: "S-2026-0001",
            client_name: "ACME",
            destination: "Valencia",
            arrived_destination_at: "2026-07-10T00:00:00Z",
            delivered_at: null,
          },
        ],
        error: null,
      },
      shipment_events: { data: [], error: null },
      bitacora_tasks: {
        data: [
          {
            id: TASK_ID,
            titulo: "Enviar packing",
            due_date: "2026-07-15",
            estado: "pendiente",
          },
        ],
        error: null,
      },
    });

    const events = await listCalendarEvents(client, RANGE, {
      timeZone: "America/Caracas",
    });
    const arribo = events.find((e) => e.type === "arribo");
    const tarea = events.find((e) => e.type === "tarea");

    expect(arribo).toBeDefined();
    expect(arribo!.shipmentId).toBe("s1");
    expect(arribo!.temporalKind).toBe("instant");
    expect(arribo!.timeZone).toBe("America/Caracas");
    expect(tarea).toBeDefined();
    expect(tarea!.date).toBe("2026-07-15");
    expect(tarea!.href).toBe(`/studio/bitacora?task=${TASK_ID}`);
  });

  it("si bitácora falla (tabla sin aplicar) → el calendario sigue con los embarques", async () => {
    const client = fakeClient({
      shipments: {
        data: [
          {
            id: "s1",
            code: "S-2026-0001",
            client_name: null,
            destination: null,
            arrived_destination_at: "2026-07-10T00:00:00Z",
            delivered_at: null,
          },
        ],
        error: null,
      },
      shipment_events: { data: [], error: null },
      bitacora_tasks: {
        data: null,
        error: { message: 'relation "bitacora_tasks" does not exist' },
      },
    });

    const events = await listCalendarEvents(client, RANGE);
    expect(events.some((e) => e.type === "arribo")).toBe(true);
    expect(events.some((e) => e.type === "tarea")).toBe(false);
  });
});
