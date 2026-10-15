/**
 * SDD-0511 · Envíos y clientes eliminados fuera de los lectores con cliente
 * admin que avisan al cliente o le escriben a Kommo.
 *
 * `deleteShipment` (tracking/[id]/actions.ts) pone `deleted_at`, y nada más.
 * Estos lectores usan el cliente admin, así que la RLS nunca los filtró: el
 * `.is("deleted_at", null)` de la consulta es lo ÚNICO que separa una fila viva
 * de una eliminada.
 *
 * El doble APLICA los filtros (`lectores-admin-double.ts`). El fixture es
 * INFELIZ a propósito: el envío eliminado es el más reciente (encabeza el
 * `order by created_at desc`) y cumple cada uno de los demás filtros (mismo
 * tenant, mismo Shipping Mark, estado no terminal), así que lo único que puede
 * dejarlo afuera es el `deleted_at`. Cada bloque lleva su «control del doble»:
 * el MISMO fixture con todo vivo elige la otra fila — prueba de que la
 * aserción no pasa por casualidad.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleResult } from "../notifications/schedule-client-notifications";

// El tipo de retorno va explícito: sin él, vi.fn lo infiere de la
// implementación y un `mockResolvedValueOnce` con otra forma no compila.
const scheduleMock = vi.fn((...args: unknown[]): Promise<ScheduleResult> => {
  void args;
  return Promise.resolve({ scheduled: 1, skipped: 0 });
});
vi.mock("../notifications/schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => scheduleMock(...a),
}));

const enqueueMock = vi.fn((...args: unknown[]): Promise<string | null> => {
  void args;
  return Promise.resolve("op-1");
});
vi.mock("../kommo-writeback", () => ({
  enqueueKommoContactOp: (...a: unknown[]) => enqueueMock(...a),
}));

// El drain y el motor de reglas importan el mismo `send-email`.
const sendEmailMock = vi.fn(
  (...args: unknown[]): Promise<{ ok: boolean; queued?: boolean }> => {
    void args;
    return Promise.resolve({ ok: true });
  },
);
vi.mock("../mail/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmailMock(...a),
}));
vi.mock("../notify/operario-push-outbox", () => ({
  enqueueUserPush: () => Promise.resolve("evt-1"),
  drainOperarioPushOutbox: () =>
    Promise.resolve({ processed: 0, delivered: 0, failed: 0 }),
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scheduleConsolidationEvent,
  scheduleReceiptInWarehouse,
  scheduleReceiptVeReceived,
} from "../notifications/schedule-fanout";
import { NO, SI, syncKommoContactStatus } from "../kommo-contact-status";
import {
  drainClientNotifications,
  MOTIVO_ENVIO_ELIMINADO,
} from "../notifications/drain-client-notifications";
import { fireMailEvent } from "../mail/mail-rule-engine";
import {
  dobleLectores,
  todoVivo,
  type Fila,
  type Rpc,
} from "./lectores-admin-double";

const ELIMINADO_EL = "2026-10-11T12:00:00Z";
const filtroDeBorrado = (table: string) => ({
  table,
  op: "is",
  col: "deleted_at",
  val: null,
});

beforeEach(() => {
  scheduleMock.mockClear();
  enqueueMock.mockClear();
  sendEmailMock.mockClear();
});

// ── Fixture: envíos ───────────────────────────────────────────

function envio(parcial: Fila & { id: string }): Fila {
  return {
    tenant_id: "t1",
    code: "DTDU-0000",
    client_markbox: "DTD-1001",
    client_name: "Ana",
    status: "in_transit",
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...parcial,
  };
}

const ENVIO_VIVO = envio({ id: "s-vivo", code: "DTDU-0001" });

/** Eliminado: más reciente que el vivo, mismo Shipping Mark, mismo estado. */
const ENVIO_ELIMINADO = envio({
  id: "s-eliminado",
  code: "DTDU-0002",
  created_at: "2026-10-10T00:00:00Z",
  deleted_at: ELIMINADO_EL,
});

/** El envío al que quedó colgado el aviso programado. */
const anclaDelAviso = (llamada: number) =>
  (scheduleMock.mock.calls[llamada]?.[2] as { ancla: Record<string, unknown> })
    .ancla;

// ── Arribo a Venezuela ────────────────────────────────────────

describe("scheduleReceiptVeReceived · el aviso no cuelga de un envío eliminado (SDD-0511)", () => {
  it("con un vivo y un eliminado más reciente, el aviso va al vivo", async () => {
    const { client, filtros } = dobleLectores({
      shipments: [ENVIO_VIVO, ENVIO_ELIMINADO],
    });
    const r = await scheduleReceiptVeReceived(client, "t1", ["DTD-1001"]);

    expect(r).toEqual({ scheduled: 1, sinDestino: [] });
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(anclaDelAviso(0)).toEqual({
      kind: "shipment",
      shipmentId: "s-vivo",
      shipmentCode: "DTDU-0001",
    });
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
  });

  it("sin el filtro, el eliminado GANARÍA por ser el más reciente (control del doble)", async () => {
    const { client } = dobleLectores(
      todoVivo({ shipments: [ENVIO_VIVO, ENVIO_ELIMINADO] }),
    );
    await scheduleReceiptVeReceived(client, "t1", ["DTD-1001"]);

    expect(anclaDelAviso(0)).toMatchObject({ shipmentId: "s-eliminado" });
  });

  it("si el único envío abierto está eliminado, el cliente queda en sinDestino", async () => {
    const { client } = dobleLectores({ shipments: [ENVIO_ELIMINADO] });
    const r = await scheduleReceiptVeReceived(client, "t1", ["DTD-1001"]);

    expect(r).toEqual({ scheduled: 0, sinDestino: ["DTD-1001"] });
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("ese mismo envío, vivo, sí recibe el aviso (control del doble)", async () => {
    const { client } = dobleLectores(todoVivo({ shipments: [ENVIO_ELIMINADO] }));
    const r = await scheduleReceiptVeReceived(client, "t1", ["DTD-1001"]);

    expect(r).toEqual({ scheduled: 1, sinDestino: [] });
  });
});

// ── Recepción en Yiwu ─────────────────────────────────────────

describe("scheduleReceiptInWarehouse · el aviso no cuelga de un envío eliminado (SDD-0511)", () => {
  it("con un vivo y un eliminado más reciente, el aviso va al vivo", async () => {
    const { client, filtros } = dobleLectores({
      shipments: [ENVIO_VIVO, ENVIO_ELIMINADO],
    });
    const r = await scheduleReceiptInWarehouse(client, "t1", [
      { markbox: "DTD-1001" },
    ]);

    expect(r).toEqual({ scheduled: 1, sinDestino: [], detalle: [] });
    expect(anclaDelAviso(0)).toEqual({
      kind: "shipment",
      shipmentId: "s-vivo",
      shipmentCode: "DTDU-0001",
    });
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
  });

  it("sin el filtro, el eliminado GANARÍA por ser el más reciente (control del doble)", async () => {
    const { client } = dobleLectores(
      todoVivo({ shipments: [ENVIO_VIVO, ENVIO_ELIMINADO] }),
    );
    await scheduleReceiptInWarehouse(client, "t1", [{ markbox: "DTD-1001" }]);

    expect(anclaDelAviso(0)).toMatchObject({ shipmentId: "s-eliminado" });
  });

  it("si el único envío abierto está eliminado, el aviso cuelga de la compra (SDD-0283)", async () => {
    const { client } = dobleLectores({ shipments: [ENVIO_ELIMINADO] });
    const r = await scheduleReceiptInWarehouse(client, "t1", [
      { markbox: "DTD-1001", prealertaId: "pa-1", prealertaCode: "PA-0001" },
    ]);

    expect(r).toEqual({ scheduled: 1, sinDestino: [], detalle: [] });
    expect(anclaDelAviso(0)).toEqual({
      kind: "prealerta",
      prealertaId: "pa-1",
      prealertaCode: "PA-0001",
    });
  });

  // SDD-0524 invirtió la precedencia: con la compra conocida, el aviso cuelga
  // de ELLA aunque haya un envío abierto (antes el envío mandaba y, con un
  // cliente recurrente, el índice único de la 0389 descartaba el aviso). Por
  // eso este control ya no puede decir «el envío vivo se lo lleva»: lo que
  // separa vivo de eliminado lo cubren el par de arriba (sin compra) y el caso
  // de abajo. Aquí queda la regla nueva, con el mismo fixture.
  it("ese mismo envío, vivo, tampoco se lleva el aviso: con compra conocida manda la compra (SDD-0524)", async () => {
    const { client } = dobleLectores(todoVivo({ shipments: [ENVIO_ELIMINADO] }));
    await scheduleReceiptInWarehouse(client, "t1", [
      { markbox: "DTD-1001", prealertaId: "pa-1", prealertaCode: "PA-0001" },
    ]);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(anclaDelAviso(0)).toEqual({
      kind: "prealerta",
      prealertaId: "pa-1",
      prealertaCode: "PA-0001",
    });
  });

  it("sin envío vivo ni compra, el cliente queda en sinDestino", async () => {
    const { client } = dobleLectores({ shipments: [ENVIO_ELIMINADO] });
    const r = await scheduleReceiptInWarehouse(client, "t1", [
      { markbox: "DTD-1001" },
    ]);

    expect(r).toEqual({
      scheduled: 0,
      sinDestino: ["DTD-1001"],
      detalle: [{ markbox: "DTD-1001", motivo: "sin_destino", ancla: null }],
    });
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

// ── Consolidación (y, por ella, el ETA de la naviera) ─────────

const ITEMS = [
  {
    tenant_id: "t1",
    consolidation_id: "con-1",
    shipment_id: "s-vivo",
    client_markbox: "DTD-1001",
    client_name: "Ana",
  },
  {
    tenant_id: "t1",
    consolidation_id: "con-1",
    shipment_id: "s-eliminado",
    client_markbox: "DTD-1002",
    client_name: "Beto",
  },
];

const ENVIOS_CONSOLIDADOS = [
  ENVIO_VIVO,
  { ...ENVIO_ELIMINADO, client_markbox: "DTD-1002", client_name: "Beto" },
];

describe("scheduleConsolidationEvent · un envío eliminado no recibe el aviso del contenedor (SDD-0511)", () => {
  it("solo se avisa al envío vivo de la consolidación", async () => {
    const { client, filtros } = dobleLectores({
      consolidation_items: ITEMS,
      shipments: ENVIOS_CONSOLIDADOS,
    });
    const n = await scheduleConsolidationEvent(client, "t1", "con-1", "consolidated");

    expect(n).toBe(1);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(anclaDelAviso(0)).toEqual({
      kind: "shipment",
      shipmentId: "s-vivo",
      shipmentCode: "DTDU-0001",
    });
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
  });

  it("sin el filtro, los dos envíos reciben el aviso (control del doble)", async () => {
    const { client } = dobleLectores(
      todoVivo({ consolidation_items: ITEMS, shipments: ENVIOS_CONSOLIDADOS }),
    );
    const n = await scheduleConsolidationEvent(client, "t1", "con-1", "consolidated");

    expect(n).toBe(2);
    expect(scheduleMock.mock.calls.map((c) => (c[2] as { ancla: { shipmentId: string } }).ancla.shipmentId)).toEqual([
      "s-vivo",
      "s-eliminado",
    ]);
  });

  it("si no se pueden leer los envíos, no avisa a ciegas y lo deja en el log", async () => {
    const { client } = dobleLectores({ consolidation_items: ITEMS });
    const conFalla = conLecturaFallida(client, "shipments");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const n = await scheduleConsolidationEvent(conFalla, "t1", "con-1", "consolidated");

      expect(n).toBe(0);
      expect(scheduleMock).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("no pudo leer los envíos"),
        "caída simulada",
      );
    } finally {
      log.mockRestore();
    }
  });
});

/**
 * El mismo cliente, pero la lectura de `table` falla como falla PostgREST:
 * `{ data: null, error }`, sin lanzar.
 */
function conLecturaFallida(client: SupabaseClient, table: string): SupabaseClient {
  const fallida = { data: null, error: { code: "57P01", message: "caída simulada" } };
  const cadena: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(fallida).then(resolve),
  };
  for (const m of ["select", "eq", "is", "in", "not", "order", "limit"]) {
    cadena[m] = () => cadena;
  }
  return {
    from: (t: string) => (t === table ? cadena : client.from(t)),
    rpc: client.rpc,
  } as unknown as SupabaseClient;
}

// ── Estado comercial en Kommo ─────────────────────────────────

const KOMMO_BASE = {
  kommo_connections: [
    { tenant_id: "t1", contact_saldo_field_id: 11, contact_transito_field_id: 22 },
  ],
  clients: [
    { tenant_id: "t1", markbox: "DTD-1001", kommo_contact_id: 501, deleted_at: null },
  ],
};

/** El campo que se le escribiría al contacto, por id de campo. */
function camposEncolados(): Record<number, string> {
  const args = enqueueMock.mock.calls[0]?.[2] as {
    payload: { custom_fields_values: { field_id: number; values: { value: string }[] }[] };
  };
  return Object.fromEntries(
    args.payload.custom_fields_values.map((c) => [c.field_id, c.values[0].value]),
  );
}

describe("syncKommoContactStatus · un envío eliminado no es carga en tránsito (SDD-0511)", () => {
  // El cliente tiene un envío vivo ya entregado y uno eliminado en tránsito.
  const tablas = {
    ...KOMMO_BASE,
    shipments: [
      envio({ id: "s-entregado", status: "delivered" }),
      ENVIO_ELIMINADO,
    ],
    invoices: [],
  };

  it("«Carga en tránsito» dice No", async () => {
    const { client, filtros } = dobleLectores(tablas);
    const r = await syncKommoContactStatus(client, "t1");

    expect(r.conTransito).toBe(0);
    expect(camposEncolados()[22]).toBe(NO);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
  });

  it("sin el filtro diría Sí (control del doble)", async () => {
    const { client } = dobleLectores(todoVivo(tablas));
    const r = await syncKommoContactStatus(client, "t1");

    expect(r.conTransito).toBe(1);
    expect(camposEncolados()[22]).toBe(SI);
  });
});

describe("syncKommoContactStatus · una factura eliminada no es saldo (SDD-0511)", () => {
  // Desde SDD-0465 solo se borran borradores, que ya no cuentan. Esta es la
  // factura EMITIDA borrada antes de eso: sin el filtro, sería deuda.
  const tablas = {
    ...KOMMO_BASE,
    shipments: [],
    invoices: [
      {
        tenant_id: "t1",
        client_markbox: "DTD-1001",
        status: "emitida",
        total_amount: 100,
        paid_amount: 0,
        deleted_at: ELIMINADO_EL,
      },
    ],
  };

  it("«Tiene saldo pendiente» dice No", async () => {
    const { client, filtros } = dobleLectores(tablas);
    const r = await syncKommoContactStatus(client, "t1");

    expect(r.conSaldo).toBe(0);
    expect(camposEncolados()[11]).toBe(NO);
    expect(filtros).toContainEqual(filtroDeBorrado("invoices"));
  });

  it("sin el filtro diría Sí (control del doble)", async () => {
    const { client } = dobleLectores(todoVivo(tablas));
    const r = await syncKommoContactStatus(client, "t1");

    expect(r.conSaldo).toBe(1);
    expect(camposEncolados()[11]).toBe(SI);
  });
});

// ── Despacho de avisos ya programados ─────────────────────────

/** Una fila vencida de la agenda, lista para despachar. */
function aviso(parcial: Fila & { id: string }): Fila {
  return {
    tenant_id: "t1",
    shipment_id: null,
    prealerta_id: null,
    client_markbox: "DTD-1001",
    rule_id: "r1",
    trigger_event: "eta_set",
    channel: "email",
    template_key: null,
    custom_title: null,
    custom_body: null,
    scheduled_for: "2026-10-12T00:00:00Z",
    payload: { title: "Tu envío tiene fecha", body: "ETA confirmado", clientName: "Ana" },
    status: "scheduled",
    sent_at: null,
    attempts: 0,
    error: null,
    created_at: "2026-10-09T00:00:00Z",
    ...parcial,
  };
}

/**
 * El aviso del envío eliminado vence PRIMERO y su cliente está vivo y con
 * correo: si sale o no depende solo de mirar el envío.
 */
const AGENDA = {
  client_notification_schedule: [
    aviso({
      id: "av-eliminado",
      shipment_id: "s-eliminado",
      scheduled_for: "2026-10-11T00:00:00Z",
      payload: { title: "T", body: "B", shipmentCode: "DTDU-0002" },
    }),
    aviso({
      id: "av-vivo",
      shipment_id: "s-vivo",
      payload: { title: "T", body: "B", shipmentCode: "DTDU-0001" },
    }),
  ],
  shipments: [ENVIO_VIVO, ENVIO_ELIMINADO],
  clients: [
    {
      tenant_id: "t1",
      markbox: "DTD-1001",
      email: "ana@ejemplo.com",
      name: "Ana",
      deleted_at: null,
    },
  ],
};

const asuntos = () =>
  sendEmailMock.mock.calls.map((c) => (c[2] as { subject: string }).subject);

const fila = (store: Record<string, Fila[]>, id: string) =>
  store.client_notification_schedule.find((r) => r.id === id);

describe("drainClientNotifications · un aviso ya programado no sale si su envío se eliminó (SDD-0511)", () => {
  it("cancela el del envío eliminado con su motivo y despacha el del vivo", async () => {
    const { client, store, filtros, updates } = dobleLectores(AGENDA);
    const r = await drainClientNotifications(client);

    expect(r).toEqual({ processed: 2, delivered: 1, skipped: 0, failed: 0, canceled: 1 });
    expect(asuntos()).toEqual(["T · DTDU-0001"]);
    expect(fila(store, "av-eliminado")).toMatchObject({
      status: "canceled",
      error: MOTIVO_ENVIO_ELIMINADO,
      sent_at: null,
    });
    expect(fila(store, "av-vivo")).toMatchObject({ status: "sent" });
    expect(filtros).toContainEqual({
      table: "shipments",
      op: "not.is",
      col: "deleted_at",
      val: null,
    });
    // Se cancela y se sigue: ni siquiera se intenta el claim.
    const tocaron = updates.filter((u) =>
      u.filtros.some((f) => f.col === "id" && f.val === "av-eliminado"),
    );
    expect(tocaron.map((u) => u.values.status)).toEqual(["canceled"]);
  });

  it("sin el filtro saldrían los dos (control del doble)", async () => {
    const { client, store } = dobleLectores(todoVivo(AGENDA));
    const r = await drainClientNotifications(client);

    expect(r.delivered).toBe(2);
    expect(asuntos()).toEqual(["T · DTDU-0002", "T · DTDU-0001"]);
    expect(fila(store, "av-eliminado")).toMatchObject({ status: "sent" });
  });

  it("si otro worker ya tomó la fila, no la pisa ni la cuenta", async () => {
    const tomada = {
      ...AGENDA,
      client_notification_schedule: AGENDA.client_notification_schedule.map((r) =>
        r.id === "av-eliminado" ? { ...r, status: "sent" } : r,
      ),
    };
    const { client, store } = dobleLectores(tomada);
    // El lote se leyó cuando todavía estaba 'scheduled': se simula leyéndolo
    // del fixture original y respondiendo el UPDATE sobre el store ya tomado.
    const conLoteViejo = {
      from: (t: string) =>
        t === "client_notification_schedule"
          ? {
              ...client.from(t),
              select: () => dobleLectores(AGENDA).client.from(t).select(),
            }
          : client.from(t),
    } as unknown as SupabaseClient;

    const r = await drainClientNotifications(conLoteViejo);

    // Sigue como la dejó el otro worker: el cancel es condicional, como el claim.
    expect(fila(store, "av-eliminado")).toMatchObject({ status: "sent", error: null });
    expect(r.canceled ?? 0).toBe(0);
    expect(asuntos()).toEqual(["T · DTDU-0001"]);
  });

  it("un aviso que cuelga de una compra sale sin leer envíos", async () => {
    const { client, filtros } = dobleLectores({
      client_notification_schedule: [
        aviso({
          id: "av-compra",
          prealerta_id: "pa-1",
          trigger_event: "status:in_warehouse",
          payload: { title: "T", body: "B", anchorCode: "PA-0001" },
        }),
      ],
      clients: AGENDA.clients,
    });
    const r = await drainClientNotifications(client);

    expect(r.delivered).toBe(1);
    expect(asuntos()).toEqual(["T · PA-0001"]);
    expect(filtros.filter((f) => f.table === "shipments")).toEqual([]);
  });

  it("si no se puede saber qué envíos siguen vivos, no despacha nada", async () => {
    const { client, store } = dobleLectores(AGENDA);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await drainClientNotifications(conLecturaFallida(client, "shipments"));

      expect(r).toEqual({ processed: 0, delivered: 0, skipped: 0, failed: 0, canceled: 0 });
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(
        store.client_notification_schedule.map((f) => f.status),
      ).toEqual(["scheduled", "scheduled"]);
    } finally {
      log.mockRestore();
    }
  });
});

// ── Motor de reglas de correo ─────────────────────────────────

const REGLAS = {
  mail_rules: [
    {
      id: "r-cliente",
      tenant_id: "t1",
      event: "invoice_overdue",
      active: true,
      template_id: "tpl-1",
      recipient_kind: "client",
      recipient_value: null,
      trigger_count: 0,
    },
  ],
  mail_templates: [
    { id: "tpl-1", tenant_id: "t1", slug: "cobro-vencido", active: true },
  ],
};

function ficha(parcial: Fila & { id: string; markbox: string }): Fila {
  return {
    tenant_id: "t1",
    email: `${parcial.id}@ejemplo.com`,
    deleted_at: null,
    merged_into_client_id: null,
    ...parcial,
  };
}

const VIGENTE = ficha({ id: "vigente", markbox: "DTD-2001" });
/** Eliminado sin fusión, con correo válido y el Shipping Mark exacto. */
const ELIMINADO = ficha({ id: "eliminado", markbox: "DTD-1002", deleted_at: ELIMINADO_EL });
/** Fusionado en VIGENTE: conserva su Shipping Mark como alias (0341). */
const FUSIONADO = ficha({
  id: "fusionado",
  markbox: "DTD-1003",
  deleted_at: ELIMINADO_EL,
  merged_into_client_id: "vigente",
});

/**
 * `resolve_markbox` (0341/0367) sobre el store: sigue `merged_into_client_id`
 * hasta 10 saltos y devuelve el final de la cadena AUNQUE esté eliminado, como
 * la función real. Sin historial de renombrados: estos fixtures no lo usan.
 */
const resolveMarkbox: Rpc = (args, store) => {
  const clientes = store.clients ?? [];
  let actual = clientes.find(
    (c) => c.tenant_id === args.p_tenant_id && c.markbox === args.p_markbox,
  );
  if (!actual) return { data: [], error: null };
  let redirigido = false;
  for (let saltos = 0; actual.merged_into_client_id && saltos < 10; saltos++) {
    const siguiente = clientes.find((c) => c.id === actual?.merged_into_client_id);
    if (!siguiente) break;
    actual = siguiente;
    redirigido = true;
  }
  return {
    data: [{ client_id: actual.id, canonical_markbox: actual.markbox, was_redirected: redirigido }],
    error: null,
  };
};

const cobroVencido = (clientMarkbox: string) => ({
  event: "invoice_overdue" as const,
  vars: { invoice_code: "FAC-0001" },
  clientMarkbox,
});

const destinatarios = () =>
  sendEmailMock.mock.calls.map((c) => (c[2] as { to: string }).to);

describe("fireMailEvent · el correo no le llega a un cliente eliminado (SDD-0511)", () => {
  const clientes = { ...REGLAS, clients: [VIGENTE, ELIMINADO, FUSIONADO] };

  it("cliente vivo: le llega, como siempre", async () => {
    const { client } = dobleLectores(clientes, { resolve_markbox: resolveMarkbox });
    await fireMailEvent(client, "t1", cobroVencido("DTD-2001"));

    expect(destinatarios()).toEqual(["vigente@ejemplo.com"]);
  });

  it("eliminado sin fusión: no le llega", async () => {
    const { client } = dobleLectores(clientes, { resolve_markbox: resolveMarkbox });
    await fireMailEvent(client, "t1", cobroVencido("DTD-1002"));

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("ese mismo cliente, vivo, sí lo recibiría (control del doble)", async () => {
    const { client } = dobleLectores(todoVivo(clientes), {
      resolve_markbox: resolveMarkbox,
    });
    await fireMailEvent(client, "t1", cobroVencido("DTD-1002"));

    expect(destinatarios()).toEqual(["eliminado@ejemplo.com"]);
  });

  it("fusionado: le llega al cliente que lo absorbió, no a la ficha vieja", async () => {
    const { client } = dobleLectores(clientes, { resolve_markbox: resolveMarkbox });
    await fireMailEvent(client, "t1", cobroVencido("DTD-1003"));

    expect(destinatarios()).toEqual(["vigente@ejemplo.com"]);
  });

  it("sin el filtro le llegaría a la ficha vieja (control del doble)", async () => {
    const { client } = dobleLectores(todoVivo(clientes), {
      resolve_markbox: resolveMarkbox,
    });
    await fireMailEvent(client, "t1", cobroVencido("DTD-1003"));

    expect(destinatarios()).toEqual(["fusionado@ejemplo.com"]);
  });

  it("fusionado en un cliente que después se eliminó: no le llega a nadie", async () => {
    const { client } = dobleLectores(
      {
        ...REGLAS,
        clients: [{ ...VIGENTE, deleted_at: ELIMINADO_EL }, FUSIONADO],
      },
      { resolve_markbox: resolveMarkbox },
    );
    await fireMailEvent(client, "t1", cobroVencido("DTD-1003"));

    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  // Una segunda regla del mismo evento, con destinatario fijo: si la
  // resolución del cliente lanzara, el `catch` general de `fireMailEvent` se
  // tragaría también ésta.
  const conCopia = {
    ...clientes,
    mail_rules: [
      ...REGLAS.mail_rules,
      {
        id: "r-copia",
        tenant_id: "t1",
        event: "invoice_overdue",
        active: true,
        template_id: "tpl-1",
        recipient_kind: "custom",
        recipient_value: "cobranza@dtdcargo.com",
        trigger_count: 0,
      },
    ],
  };

  it("si la RPC falla, al cliente no le llega y las demás reglas siguen", async () => {
    const { client } = dobleLectores(conCopia); // sin resolve_markbox → PGRST202
    await fireMailEvent(client, "t1", cobroVencido("DTD-1003"));

    expect(destinatarios()).toEqual(["cobranza@dtdcargo.com"]);
  });

  it("un Shipping Mark sin ficha no rompe las demás reglas del evento", async () => {
    const { client } = dobleLectores(conCopia, { resolve_markbox: resolveMarkbox });
    await fireMailEvent(client, "t1", cobroVencido("DTD-9999"));

    expect(destinatarios()).toEqual(["cobranza@dtdcargo.com"]);
  });
});
