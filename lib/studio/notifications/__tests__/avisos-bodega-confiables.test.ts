// @vitest-environment node
/**
 * SDD-0524 · el aviso «llegó a bodega» no se pierde en silencio.
 *
 * Corre el fan-out REAL (`scheduleReceiptInWarehouse`) sobre el motor REAL
 * (`scheduleClientNotifications`), con un doble de PostgREST que aplica los
 * filtros, devuelve copias y simula los dos índices únicos parciales de la
 * migración 0389. Sólo se sustituye el drain inline (no se manda correo).
 *
 * El fixture es el del cliente recurrente, que es el caso que se perdía: tiene
 * un envío abierto (de una compra anterior, ya en tránsito) que YA tuvo su
 * aviso `status:in_warehouse`. Antes, el aviso de la compra nueva colgaba de
 * ese envío, chocaba con el índice único y desaparecía sin dejar rastro.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dobleLectores,
  type Fila,
  type IndiceUnico,
  type OpcionesDoble,
  type Tablas,
} from "@/lib/studio/__tests__/lectores-admin-double";

vi.mock("../drain-client-notifications", () => ({
  drainClientNotifications: vi.fn(async () => ({
    processed: 0,
    delivered: 0,
    skipped: 0,
    failed: 0,
    canceled: 0,
  })),
}));

import {
  notaSinAviso,
  notaSinAvisoBodega,
  scheduleReceiptInWarehouse,
} from "../schedule-fanout";

const T = "t1";
const MARK = "DTD-1004";
const COMPRA_NUEVA = { id: "p-nueva", code: "DTD-1004-0002" };

/** Los índices de idempotencia de la 0389 (líneas 100-106), uno por ancla. */
const UNICOS_0389: Record<string, IndiceUnico[]> = {
  client_notification_schedule: [
    {
      nombre: "client_notif_sched_idem_envio_uniq",
      cols: ["shipment_id", "trigger_event", "rule_id"],
      where: (r) => r.status !== "canceled" && r.shipment_id != null,
    },
    {
      nombre: "client_notif_sched_idem_compra_uniq",
      cols: ["prealerta_id", "trigger_event", "rule_id"],
      where: (r) => r.status !== "canceled" && r.prealerta_id != null,
    },
  ],
};

function regla(over: Fila = {}): Fila {
  return {
    id: "r-bodega",
    tenant_id: T,
    client_id: null,
    trigger_event: "status:in_warehouse",
    active: true,
    channel: "both",
    anchor: "event",
    offset_minutes: 0,
    template_key: null,
    custom_title: null,
    custom_body: null,
    ...over,
  };
}

/** Un aviso ya programado (y enviado) para el envío viejo del cliente. */
const AVISO_VIEJO_DEL_ENVIO: Fila = {
  id: "sch-viejo",
  tenant_id: T,
  shipment_id: "s-viejo",
  prealerta_id: null,
  client_markbox: MARK,
  rule_id: "r-bodega",
  trigger_event: "status:in_warehouse",
  status: "sent",
};

function tablas(over: Partial<Tablas> = {}): Tablas {
  return {
    clients: [
      { id: "c-1004", tenant_id: T, markbox: MARK, deleted_at: null },
      // Mismo Shipping Mark en otro tenant: no debe usarse.
      { id: "c-otro", tenant_id: "t2", markbox: MARK, deleted_at: null },
    ],
    client_notification_rules: [
      regla(),
      // Regla de otro tenant con el mismo evento: el filtro por tenant la deja fuera.
      regla({ id: "r-otro-tenant", tenant_id: "t2", channel: "email" }),
    ],
    shipments: [
      {
        id: "s-viejo",
        tenant_id: T,
        code: "ENV-7",
        client_markbox: MARK,
        client_name: null,
        status: "in_transit",
        deleted_at: null,
        created_at: "2026-09-01T00:00:00Z",
      },
    ],
    client_notification_schedule: [AVISO_VIEJO_DEL_ENVIO],
    ...over,
  };
}

function doble(t: Tablas, opciones: OpcionesDoble = {}) {
  return dobleLectores(t, {}, { unicos: UNICOS_0389, ...opciones });
}

const nuevos = (store: Tablas) =>
  (store.client_notification_schedule ?? []).filter((r) => r.id !== "sch-viejo" && r.id !== "sch-compra");

beforeEach(() => vi.clearAllMocks());

describe("controles del doble (si fallan, el resto de este archivo miente)", () => {
  it("un INSERT que viola el índice parcial devuelve 23505 y no escribe", async () => {
    const d = doble(tablas());
    const { error } = await d.client.from("client_notification_schedule").insert({
      tenant_id: T,
      shipment_id: "s-viejo",
      trigger_event: "status:in_warehouse",
      rule_id: "r-bodega",
      status: "scheduled",
    });
    expect(error?.code).toBe("23505");
    expect(d.store.client_notification_schedule).toHaveLength(1);
  });

  it("una fila cancelada no ocupa el índice (where status <> 'canceled')", async () => {
    const d = doble(
      tablas({ client_notification_schedule: [{ ...AVISO_VIEJO_DEL_ENVIO, status: "canceled" }] }),
    );
    const { error } = await d.client.from("client_notification_schedule").insert({
      tenant_id: T,
      shipment_id: "s-viejo",
      trigger_event: "status:in_warehouse",
      rule_id: "r-bodega",
      status: "scheduled",
    });
    expect(error).toBeNull();
    expect(d.store.client_notification_schedule).toHaveLength(2);
  });

  it("devuelve copias: tocar lo leído no cambia el store", async () => {
    const d = doble(tablas());
    const { data } = await d.client.from("shipments").select("*").eq("tenant_id", T);
    (data as Fila[])[0].status = "delivered";
    expect(d.store.shipments[0].status).toBe("in_transit");
  });
});

describe("SDD-0524 · con la compra conocida, el aviso cuelga de la COMPRA", () => {
  it("🔴 cliente recurrente con envío abierto ya avisado: el aviso nuevo SALE, anclado a la compra", async () => {
    const d = doble(tablas());
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);

    expect(r.scheduled).toBe(1);
    expect(r.sinDestino).toEqual([]);
    const filas = nuevos(d.store);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      tenant_id: T,
      prealerta_id: COMPRA_NUEVA.id,
      trigger_event: "status:in_warehouse",
      rule_id: "r-bodega",
      channel: "both",
      status: "scheduled",
    });
    // Exactamente una ancla (CHECK client_notif_sched_una_ancla de la 0389).
    expect(filas[0].shipment_id ?? null).toBeNull();
    // El correo lleva al detalle de ESA compra, no al envío viejo.
    expect(filas[0].payload).toMatchObject({
      anchorKind: "prealerta",
      anchorCode: COMPRA_NUEVA.code,
      anchorLabel: "Compra",
      portalPath: `/portal/compras/${COMPRA_NUEVA.code}`,
    });
  });

  it("primera compra, sin envío abierto: también cuelga de la compra (no regresión)", async () => {
    const d = doble(tablas({ shipments: [], client_notification_schedule: [] }));
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);
    expect(r).toMatchObject({ scheduled: 1, sinDestino: [] });
    expect(nuevos(d.store)[0]).toMatchObject({ prealerta_id: COMPRA_NUEVA.id });
  });

  it("si falta la 0389 (42703 al insertar por compra), cae al envío como antes", async () => {
    const d = doble(
      tablas({
        shipments: [
          {
            id: "s-nuevo",
            tenant_id: T,
            code: "ENV-9",
            client_markbox: MARK,
            client_name: null,
            status: "in_warehouse",
            deleted_at: null,
            created_at: "2026-10-10T00:00:00Z",
          },
        ],
        client_notification_schedule: [],
      }),
      {
        rechazarInsert: (table, fila) =>
          table === "client_notification_schedule" && fila.prealerta_id != null
            ? { code: "42703", message: 'column "prealerta_id" does not exist' }
            : null,
      },
    );
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);
    expect(r).toMatchObject({ scheduled: 1, sinDestino: [] });
    expect(nuevos(d.store)).toHaveLength(1);
    expect(nuevos(d.store)[0]).toMatchObject({ shipment_id: "s-nuevo" });
  });
});

describe("SDD-0524 · un descarte por duplicado nunca es silencioso", () => {
  it("🔴 sin compra conocida, el choque con el aviso del envío queda en sinDestino y en el detalle", async () => {
    const d = doble(tablas());
    const r = await scheduleReceiptInWarehouse(d.client, T, [{ markbox: MARK }]);

    expect(r.scheduled).toBe(0);
    expect(r.sinDestino).toEqual([MARK]);
    expect(r.detalle).toEqual([{ markbox: MARK, motivo: "ya_avisado", ancla: "ENV-7" }]);
    expect(nuevos(d.store)).toHaveLength(0);

    const nota = notaSinAvisoBodega(r);
    expect(nota).toContain(MARK);
    expect(nota).toContain("ENV-7");
    expect(nota).toContain("escríbele");
    // No repite la explicación de «sin envío»: sería falsa, el envío existe.
    expect(nota).not.toContain("no tiene un envío abierto");
  });

  it("🔴 segunda recepción de la misma compra: queda anotada, con el código de la compra", async () => {
    const d = doble(
      tablas({
        client_notification_schedule: [
          AVISO_VIEJO_DEL_ENVIO,
          {
            id: "sch-compra",
            tenant_id: T,
            shipment_id: null,
            prealerta_id: COMPRA_NUEVA.id,
            client_markbox: MARK,
            rule_id: "r-bodega",
            trigger_event: "status:in_warehouse",
            status: "sent",
          },
        ],
      }),
    );
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);

    expect(r.scheduled).toBe(0);
    expect(r.sinDestino).toEqual([MARK]);
    expect(r.detalle).toEqual([
      { markbox: MARK, motivo: "ya_avisado", ancla: COMPRA_NUEVA.code },
    ]);
    // Tampoco se «compensa» por el envío: eso sería un segundo correo por la
    // misma llegada.
    expect(nuevos(d.store)).toHaveLength(0);
  });

  it("sin envío ni compra: sinDestino con su motivo (no se inventa a quién avisar)", async () => {
    const d = doble(tablas({ shipments: [], client_notification_schedule: [] }));
    const r = await scheduleReceiptInWarehouse(d.client, T, [{ markbox: MARK }]);
    expect(r).toEqual({
      scheduled: 0,
      sinDestino: [MARK],
      detalle: [{ markbox: MARK, motivo: "sin_destino", ancla: null }],
    });
    expect(notaSinAvisoBodega(r)).toContain("no tiene un envío abierto ni una compra");
  });

  it("regla anclada a ETA: una compra no tiene esa fecha, y se anota en vez de callarse", async () => {
    const d = doble(
      tablas({
        client_notification_rules: [regla({ anchor: "eta" })],
        shipments: [],
        client_notification_schedule: [],
      }),
    );
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);
    expect(r.sinDestino).toEqual([MARK]);
    expect(r.detalle).toEqual([
      { markbox: MARK, motivo: "regla_sin_fecha", ancla: COMPRA_NUEVA.code },
    ]);
    expect(notaSinAvisoBodega(r)).toContain("Notificaciones");
  });

  it("si no se puede leer el envío, es «fallo», no «sin envío» (no se afirma lo que no se sabe)", async () => {
    const d = doble(tablas(), {
      fallarSelect: (t) => (t === "shipments" ? { code: "PGRST000", message: "caída" } : null),
    });
    const r = await scheduleReceiptInWarehouse(d.client, T, [{ markbox: MARK }]);
    expect(r.detalle).toEqual([{ markbox: MARK, motivo: "fallo", ancla: null }]);
    expect(notaSinAvisoBodega(r)).not.toContain("no tiene un envío abierto");
  });

  it("un fallo inesperado con un cliente no calla a los demás, ni a él", async () => {
    const d = doble(
      tablas({
        clients: [
          { id: "c-1004", tenant_id: T, markbox: MARK, deleted_at: null },
          { id: "c-2000", tenant_id: T, markbox: "DTD-2000", deleted_at: null },
        ],
        shipments: [
          {
            id: "s-2000",
            tenant_id: T,
            code: "ENV-20",
            client_markbox: "DTD-2000",
            client_name: null,
            status: "in_warehouse",
            deleted_at: null,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
      }),
    );
    // La primera lectura de envíos (la de DTD-1004) revienta; la segunda no.
    let lecturas = 0;
    const cliente = {
      from: (t: string) => {
        if (t === "shipments" && ++lecturas === 1) throw new Error("se cayó la conexión");
        return d.client.from(t);
      },
      rpc: d.client.rpc,
    } as unknown as typeof d.client;

    const r = await scheduleReceiptInWarehouse(cliente, T, [
      { markbox: MARK },
      { markbox: "DTD-2000" },
    ]);
    expect(r.scheduled).toBe(1);
    expect(r.detalle).toEqual([{ markbox: MARK, motivo: "fallo", ancla: null }]);
    expect(nuevos(d.store)[0]).toMatchObject({ shipment_id: "s-2000" });
  });

  it("regla apagada (canal «none»): es decisión del tenant, no un olvido; no se anota", async () => {
    const d = doble(tablas({ client_notification_rules: [regla({ channel: "none" })] }));
    const r = await scheduleReceiptInWarehouse(d.client, T, [
      { markbox: MARK, prealertaId: COMPRA_NUEVA.id, prealertaCode: COMPRA_NUEVA.code },
    ]);
    expect(r).toEqual({ scheduled: 0, sinDestino: [], detalle: [] });
    expect(notaSinAvisoBodega(r)).toBeNull();
    expect(nuevos(d.store)).toHaveLength(0);
  });
});

describe("notaSinAvisoBodega", () => {
  it("null cuando nadie se quedó sin aviso", () => {
    expect(notaSinAvisoBodega({ detalle: [] })).toBeNull();
  });

  it("un fallo al programar también se dice, y pide escribirle", () => {
    const nota = notaSinAvisoBodega({
      detalle: [{ markbox: MARK, motivo: "fallo", ancla: null }],
    });
    expect(nota).toContain(MARK);
    expect(nota).toContain("escríbele");
  });

  it("la nota vieja sigue intacta para el arribo a Venezuela (VE no cambia)", () => {
    expect(notaSinAviso(["DTD-404"])).toContain("no tiene un envío abierto");
  });
});
