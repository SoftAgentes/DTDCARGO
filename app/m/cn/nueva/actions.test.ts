// @vitest-environment node
/**
 * SDD-0524 · la recepción manual del móvil (`/m/cn/nueva`) vincula y avisa igual
 * que el Studio de escritorio.
 *
 * Antes, `createReceiptFromOperarioAction` llamaba al RPC
 * `create_receipt_as_operario` (0045) y terminaba: la recepción quedaba sin
 * compra y el cliente no se enteraba de nada. Es el camino que el equipo de
 * China usa cuando la mercancía no trae la etiqueta DTD-B.
 *
 * La acción corre de verdad: el RPC del doble escribe la recepción en su store,
 * el vínculo es un UPDATE filtrado, y el aviso pasa por el fan-out y el motor
 * reales hasta la cola `client_notification_schedule`, con los índices únicos
 * de la 0389. Sólo se sustituyen la sesión del operario, el nombre del cliente
 * (que no es lo que se mide) y el drain inline (no se manda correo).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dobleLectores,
  type DobleLectores,
  type Fila,
  type Tablas,
} from "@/lib/studio/__tests__/lectores-admin-double";

const h = vi.hoisted(() => ({
  doble: null as unknown as DobleLectores,
  getOperario: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/operario-session", () => ({
  getCurrentOperario: () => h.getOperario(),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => h.doble.client,
}));
vi.mock("@/lib/studio/warehouse-cn-queries", () => ({
  resolveClientNameByMarkbox: vi.fn(async () => null),
}));
vi.mock("@/lib/studio/notifications/drain-client-notifications", () => ({
  drainClientNotifications: vi.fn(async () => ({})),
}));

import { createReceiptFromOperarioAction } from "./actions";

const T = "t1";
const MARK = "DTD-1004";

function compra(id: string, code: string, over: Fila = {}): Fila {
  return {
    id,
    code,
    tenant_id: T,
    client_markbox: MARK,
    status: "anunciada",
    sales_order_id: null,
    invoice_id: null,
    deleted_at: null,
    created_at: "2026-10-10T00:00:00Z",
    ...over,
  };
}

function tablas(over: Partial<Tablas> = {}): Tablas {
  return {
    warehouse_receipts_cn: [],
    warehouse_receipt_events: [],
    prealertas: [],
    shipments: [],
    clients: [{ id: "c-1004", tenant_id: T, markbox: MARK, deleted_at: null }],
    client_notification_rules: [
      {
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
      },
    ],
    client_notification_schedule: [],
    ...over,
  };
}

/** El RPC de la 0045, reducido a lo que importa: inserta y devuelve id + código. */
function rpcCrearRecepcion(args: Record<string, unknown>, store: Tablas) {
  const id = `rec-${store.warehouse_receipts_cn.length + 1}`;
  store.warehouse_receipts_cn.push({
    id,
    tenant_id: T,
    receipt_code: `WR-2026-000${store.warehouse_receipts_cn.length + 1}`,
    client_markbox: args.p_is_orphan ? null : args.p_client_markbox,
    is_orphan: args.p_is_orphan,
    prealerta_id: null,
    sales_order_id: null,
  });
  return { data: [{ receipt_id: id, receipt_code: `WR-2026-0001` }], error: null };
}

function montar(t: Tablas) {
  h.doble = dobleLectores(
    t,
    { create_receipt_as_operario: rpcCrearRecepcion },
    {
      unicos: {
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
      },
    },
  );
  return h.doble;
}

function formulario(over: Record<string, unknown> = {}): FormData {
  const fd = new FormData();
  fd.set(
    "payload",
    JSON.stringify({
      warehouse_id: "wh-yiwu",
      is_orphan: false,
      client_markbox: MARK,
      boxes: 3,
      total_cbm: 0.4,
      total_weight_kg: 52,
      received_at: "2026-10-15",
      items: [],
      incident: false,
      ...over,
    }),
  );
  return fd;
}

const recepcion = (d: DobleLectores) => d.store.warehouse_receipts_cn[0];
const avisos = (d: DobleLectores) => d.store.client_notification_schedule;
const notas = (d: DobleLectores) =>
  d.store.warehouse_receipt_events.filter((e) => e.event_type === "note");

beforeEach(() => {
  vi.clearAllMocks();
  h.getOperario.mockResolvedValue({
    operario_id: "op-cn",
    tenant_id: T,
    region: "cn",
    warehouse_id: "wh-yiwu",
  });
});

describe("SDD-0524 · /m/cn/nueva vincula y avisa", () => {
  it("🔴 con UNA compra abierta: queda vinculada y el aviso cuelga de esa compra", async () => {
    const d = montar(
      tablas({
        prealertas: [
          compra("p-1", "DTD-1004-0002"),
          // No cuentan: recibida, cancelada, eliminada, de otro tenant, de otro cliente.
          compra("p-rec", "DTD-1004-0001", { status: "recibida" }),
          compra("p-can", "DTD-1004-0003", { status: "cancelada" }),
          compra("p-del", "DTD-1004-0004", { deleted_at: "2026-10-01T00:00:00Z" }),
          compra("p-t2", "DTD-1004-0005", { tenant_id: "t2" }),
          compra("p-otro", "DTD-2000-0001", { client_markbox: "DTD-2000" }),
        ],
      }),
    );

    const res = await createReceiptFromOperarioAction({}, formulario());

    expect(res).toMatchObject({ ok: true, receiptId: "rec-1" });
    expect(recepcion(d).prealerta_id).toBe("p-1");
    // Sin orden de venta, el vínculo financiero no se toca.
    expect(recepcion(d).sales_order_id).toBeNull();
    expect(avisos(d)).toHaveLength(1);
    expect(avisos(d)[0]).toMatchObject({
      prealerta_id: "p-1",
      trigger_event: "status:in_warehouse",
      channel: "both",
      status: "scheduled",
    });
    expect(avisos(d)[0].payload).toMatchObject({
      portalPath: "/portal/compras/DTD-1004-0002",
    });
    expect(notas(d)).toEqual([]);
  });

  it("🔴 con dos compras abiertas no elige: sin vínculo, aviso por el envío abierto", async () => {
    const d = montar(
      tablas({
        prealertas: [
          compra("p-1", "DTD-1004-0002"),
          compra("p-2", "DTD-1004-0003", { status: "en_camino" }),
        ],
        shipments: [
          {
            id: "s-1",
            tenant_id: T,
            code: "ENV-12",
            client_markbox: MARK,
            client_name: null,
            status: "in_warehouse",
            deleted_at: null,
            created_at: "2026-10-01T00:00:00Z",
          },
        ],
      }),
    );

    await createReceiptFromOperarioAction({}, formulario());

    expect(recepcion(d).prealerta_id).toBeNull();
    expect(avisos(d)).toHaveLength(1);
    expect(avisos(d)[0]).toMatchObject({ shipment_id: "s-1" });
    expect(avisos(d)[0].prealerta_id ?? null).toBeNull();
  });

  it("🔴 sin compra ni envío: sin vínculo, sin aviso, y la nota queda en la bitácora", async () => {
    const d = montar(tablas());

    await createReceiptFromOperarioAction({}, formulario());

    expect(recepcion(d).prealerta_id).toBeNull();
    expect(avisos(d)).toEqual([]);
    expect(notas(d)).toHaveLength(1);
    expect(notas(d)[0]).toMatchObject({ tenant_id: T, receipt_id: "rec-1" });
    expect(String(notas(d)[0].description)).toContain(MARK);
    expect(String(notas(d)[0].description)).toContain("escríbele");
  });

  it("🔴 cliente recurrente: con dos compras abiertas y el envío ya avisado, la nota lo dice", async () => {
    const d = montar(
      tablas({
        prealertas: [compra("p-1", "DTD-1004-0002"), compra("p-2", "DTD-1004-0003")],
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
        client_notification_schedule: [
          {
            id: "sch-viejo",
            tenant_id: T,
            shipment_id: "s-viejo",
            prealerta_id: null,
            client_markbox: MARK,
            rule_id: "r-bodega",
            trigger_event: "status:in_warehouse",
            status: "sent",
          },
        ],
      }),
    );

    await createReceiptFromOperarioAction({}, formulario());

    expect(avisos(d)).toHaveLength(1); // sólo el viejo
    expect(notas(d)).toHaveLength(1);
    expect(String(notas(d)[0].description)).toContain("ENV-7");
  });

  it("vínculo financiero con la regla estricta: OV sin facturar sí, OV facturada no", async () => {
    const conOv = montar(
      tablas({ prealertas: [compra("p-1", "DTD-1004-0002", { sales_order_id: "ov-1" })] }),
    );
    await createReceiptFromOperarioAction({}, formulario());
    expect(recepcion(conOv)).toMatchObject({ prealerta_id: "p-1", sales_order_id: "ov-1" });

    const facturada = montar(
      tablas({
        prealertas: [
          compra("p-1", "DTD-1004-0002", { sales_order_id: "ov-1", invoice_id: "f-1" }),
        ],
      }),
    );
    await createReceiptFromOperarioAction({}, formulario());
    expect(recepcion(facturada)).toMatchObject({ prealerta_id: "p-1", sales_order_id: null });
  });

  it("si el vínculo no se escribe, el aviso NO cuelga de la compra (sólo cuenta la recepción vinculada)", async () => {
    // El RPC devuelve un id que no está en la tabla: el UPDATE no toca filas.
    h.doble = dobleLectores(tablas({ prealertas: [compra("p-1", "DTD-1004-0002")] }), {
      create_receipt_as_operario: () => ({
        data: [{ receipt_id: "rec-fantasma", receipt_code: "WR-2026-0099" }],
        error: null,
      }),
    });

    await createReceiptFromOperarioAction({}, formulario());

    expect(h.doble.updates).toHaveLength(1);
    expect(h.doble.store.client_notification_schedule).toEqual([]);
    const nota = h.doble.store.warehouse_receipt_events.find((e) => e.event_type === "note");
    expect(nota).toMatchObject({ receipt_id: "rec-fantasma" });
    expect(String(nota?.description)).toContain("ni una compra vinculada");
  });

  it("el vínculo nunca escribe una recepción de otro tenant, aunque el id venga mal", async () => {
    // Defensa en profundidad: el cliente admin no tiene RLS, así que el
    // `eq tenant_id` del UPDATE es lo único que lo impide.
    h.doble = dobleLectores(
      tablas({
        prealertas: [compra("p-1", "DTD-1004-0002")],
        warehouse_receipts_cn: [
          { id: "rec-ajena", tenant_id: "t2", client_markbox: MARK, prealerta_id: null },
        ],
      }),
      {
        create_receipt_as_operario: () => ({
          data: [{ receipt_id: "rec-ajena", receipt_code: "WR-2026-0100" }],
          error: null,
        }),
      },
    );

    await createReceiptFromOperarioAction({}, formulario());

    expect(h.doble.store.warehouse_receipts_cn[0].prealerta_id).toBeNull();
    // Y como no quedó vinculada, el aviso no cuelga de la compra.
    expect(
      h.doble.store.client_notification_schedule.filter((r) => r.prealerta_id != null),
    ).toEqual([]);
  });

  it("huérfana: ni vínculo ni aviso ni nota (todavía no se sabe de quién es)", async () => {
    const d = montar(tablas({ prealertas: [compra("p-1", "DTD-1004-0002")] }));

    const res = await createReceiptFromOperarioAction(
      {},
      formulario({ is_orphan: true, client_markbox: null, orphan_marks: "caja azul" }),
    );

    expect(res.ok).toBe(true);
    expect(recepcion(d).prealerta_id).toBeNull();
    expect(avisos(d)).toEqual([]);
    expect(notas(d)).toEqual([]);
  });

  it("si el RPC falla, no se vincula ni se avisa nada", async () => {
    h.doble = dobleLectores(tablas({ prealertas: [compra("p-1", "DTD-1004-0002")] }), {
      create_receipt_as_operario: () => ({
        data: null,
        error: { code: "P0002", message: "Operario inactivo" },
      }),
    });

    const res = await createReceiptFromOperarioAction({}, formulario());

    expect(res.error).toContain("Operario inactivo");
    expect(h.doble.updates).toEqual([]);
    expect(h.doble.store.client_notification_schedule).toEqual([]);
  });
});
