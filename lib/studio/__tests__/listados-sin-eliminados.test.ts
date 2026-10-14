/**
 * SDD-0509 · Clientes y embarques eliminados fuera de los listados del Studio.
 *
 * Eliminar un cliente (`soft_delete_client_with_audit_reason`, 0455) o un
 * embarque (`deleteShipment`, tracking/[id]/actions.ts) pone `deleted_at`, y la
 * RLS NO esconde esas filas: la 0230 sacó `deleted_at is null` del USING de las
 * policies FOR ALL (bloqueaba el propio soft delete) y la 0456 dejó
 * `"clients by tenant"` como SELECT que solo compara tenant. O sea: el
 * `.is("deleted_at", null)` de la capa de consulta es lo ÚNICO que separa una
 * fila viva de una eliminada en estos lectores.
 *
 * El doble APLICA los filtros (`listados-double.ts`). El fixture es INFELIZ a
 * propósito: la fila eliminada es la más reciente (encabeza todo
 * `order by created_at desc`) y cumple cada uno de los demás filtros de la
 * consulta (mismo estado, mismo Shipping Mark, mismo tier), así que lo único
 * que puede dejarla afuera es el `deleted_at`. Cada bloque lleva su «control
 * del doble»: el MISMO fixture con todo vivo devuelve las dos filas — prueba de
 * que la aserción no pasa por casualidad.
 */

import { describe, expect, it } from "vitest";
import {
  listClients,
  listClientsPage,
  listShipmentsByMarkbox,
} from "../client-queries";
import { listActiveShipments, listShipments } from "../shipment-queries";
import { getClientCount } from "../dashboard-queries";
import { clientsWithTier } from "../fidelizacion/queries";
import { computeVeKpis, listVeReceipts } from "../warehouse-ve-queries";
import { listShipmentsEligibleForFiling } from "../customs-queries";
import { listEligibleShipmentsForRoute } from "../tms-queries";
import { listCalendarEvents } from "../calendar-events-queries";
import { SHIPMENT_TOOLS } from "../agents/tools/shipment-tools";
import type { ToolContext } from "../agents/runtime/types";
import { dobleListados, todoVivo, type Fila } from "./listados-double";

const ELIMINADO_EL = "2026-10-11T12:00:00Z";
const BORRADO = { table: "", op: "is", col: "deleted_at", val: null };
const filtroDeBorrado = (table: string) => ({ ...BORRADO, table });

// ── Fixture: clientes ─────────────────────────────────────────

function cliente(parcial: Fila & { id: string }): Fila {
  return {
    tenant_id: "t1",
    markbox: "DTD-0000",
    name: "Cliente",
    email: "ana@ejemplo.com",
    phone: "04140000000",
    rif: "V12345678",
    tier: "vip",
    registration_channel: "portal",
    doc_verify_status: null,
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...parcial,
  };
}

const CLIENTE_VIVO = cliente({
  id: "c-vivo",
  markbox: "DTD-1001",
  name: "Ana Viva",
});

/** Eliminado: más reciente que el vivo y con el mismo tier/canal/estado. */
const CLIENTE_ELIMINADO = cliente({
  id: "c-eliminado",
  markbox: "DTD-1002",
  name: "Ana Eliminada",
  created_at: "2026-10-10T00:00:00Z",
  deleted_at: ELIMINADO_EL,
});

const CLIENTES = { clients: [CLIENTE_VIVO, CLIENTE_ELIMINADO] };

// ── Fixture: embarques ────────────────────────────────────────

function embarque(parcial: Fila & { id: string }): Fila {
  return {
    tenant_id: "t1",
    code: "DTDU-0000",
    client_name: "Ana Viva",
    client_markbox: "DTD-1001",
    origin: "Guangzhou",
    destination: "Valencia",
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    weight_kg: 10,
    volume_m3: 1,
    arrived_destination_at: null,
    delivered_at: null,
    created_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
    ...parcial,
  };
}

/**
 * Par vivo/eliminado con el MISMO estado y el MISMO Shipping Mark. El eliminado
 * es el más reciente en `created_at` y en `arrived_destination_at`, así que
 * encabeza cualquier orden descendente que use el lector.
 */
function par(status: string, extra: Fila = {}): Fila[] {
  return [
    embarque({
      id: "s-vivo",
      code: "DTDU-0001",
      status,
      arrived_destination_at: "2026-10-05T00:00:00Z",
      ...extra,
    }),
    embarque({
      id: "s-eliminado",
      code: "DTDU-0002",
      status,
      created_at: "2026-10-10T00:00:00Z",
      arrived_destination_at: "2026-10-09T00:00:00Z",
      deleted_at: ELIMINADO_EL,
      ...extra,
    }),
  ];
}

const codigos = (filas: { code?: unknown }[]) => filas.map((f) => f.code);

// ── Clientes ──────────────────────────────────────────────────

describe("Clientes · un cliente eliminado no se lista ni se cuenta (SDD-0509)", () => {
  it("listClientsPage deja fuera al eliminado y el total no lo cuenta", async () => {
    const { client, filtros } = dobleListados(CLIENTES);
    const pagina = await listClientsPage(client);

    expect(pagina.clients.map((c) => c.markbox)).toEqual(["DTD-1001"]);
    expect(pagina.total).toBe(1);
    expect(filtros).toContainEqual(filtroDeBorrado("clients"));
  });

  it("sin el filtro, el eliminado ENCABEZARÍA el listado y sumaría al total (control del doble)", async () => {
    const { client } = dobleListados(todoVivo(CLIENTES));
    const pagina = await listClientsPage(client);

    expect(pagina.clients.map((c) => c.markbox)).toEqual(["DTD-1002", "DTD-1001"]);
    expect(pagina.total).toBe(2);
  });

  it("con búsqueda, tier y «pendientes de revisar», el eliminado sigue fuera", async () => {
    const { client } = dobleListados(CLIENTES);
    const pagina = await listClientsPage(client, {
      q: "Ana",
      tier: "vip",
      pendingReview: true,
    });

    expect(pagina.clients.map((c) => c.markbox)).toEqual(["DTD-1001"]);
    expect(pagina.total).toBe(1);
  });

  it("listClients (⌘K, combobox de cédula, Bitácora, CN, ERP móvil) tampoco lo devuelve", async () => {
    const { client, filtros } = dobleListados(CLIENTES);
    const hallados = await listClients(client, { q: "Ana" });

    expect(hallados.map((c) => c.markbox)).toEqual(["DTD-1001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("clients"));
  });

  it("getClientCount (tarjeta «Clientes» del dashboard) cuenta solo los vivos", async () => {
    expect(await getClientCount(dobleListados(CLIENTES).client)).toBe(1);
    expect(await getClientCount(dobleListados(todoVivo(CLIENTES)).client)).toBe(2);
  });

  it("clientsWithTier (Fidelización) no reparte niveles a un eliminado", async () => {
    const tablas = { ...CLIENTES, studio_client_annual_billing: [] };
    const conTier = await clientsWithTier(dobleListados(tablas).client);
    expect(conTier.map((c) => c.markbox)).toEqual(["DTD-1001"]);

    const control = await clientsWithTier(dobleListados(todoVivo(tablas)).client);
    expect(control.map((c) => c.markbox).sort()).toEqual(["DTD-1001", "DTD-1002"]);
  });
});

// ── Embarques ─────────────────────────────────────────────────

describe("Embarques · un embarque eliminado no se lista (SDD-0509)", () => {
  const EMBARQUES = { shipments: par("in_transit") };

  it("listShipments (/studio/embarques, ⌘K, ERP móvil) deja fuera al eliminado", async () => {
    const { client, filtros } = dobleListados(EMBARQUES);
    const filas = await listShipments(client);

    expect(codigos(filas)).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
  });

  it("sin el filtro, el eliminado ENCABEZARÍA el listado (control del doble)", async () => {
    const filas = await listShipments(dobleListados(todoVivo(EMBARQUES)).client);
    expect(codigos(filas)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });

  it("con filtros de estado, servicio, búsqueda y rango, el eliminado sigue fuera", async () => {
    const filas = await listShipments(dobleListados(EMBARQUES).client, {
      status: "in_transit",
      service: "consolidado_lcl",
      q: "DTDU",
      createdFrom: "2026-09-01",
      createdTo: "2026-10-31",
    });
    expect(codigos(filas)).toEqual(["DTDU-0001"]);
  });

  it("listActiveShipments (barra lateral de /studio/tracking) deja fuera al eliminado", async () => {
    const { client, filtros } = dobleListados(EMBARQUES);
    expect(codigos(await listActiveShipments(client))).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));

    const control = await listActiveShipments(dobleListados(todoVivo(EMBARQUES)).client);
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });

  it("listShipmentsByMarkbox (historial de la ficha del cliente) deja fuera al eliminado", async () => {
    const { client, filtros } = dobleListados(EMBARQUES);
    expect(codigos(await listShipmentsByMarkbox(client, "DTD-1001"))).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));

    const control = await listShipmentsByMarkbox(
      dobleListados(todoVivo(EMBARQUES)).client,
      "DTD-1001",
    );
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });

  it("la tool search_shipments_by_customer del agente no lo devuelve (su relectura no se salta el filtro)", async () => {
    const tool = SHIPMENT_TOOLS.find((t) => t.key === "search_shipments_by_customer");
    if (!tool) throw new Error("tool no registrada");
    const ctx = (supabase: unknown) =>
      ({ supabase, tenantId: "t1", agentId: "a1", runId: "r1" }) as ToolContext;
    const handler = tool.handler as (
      c: ToolContext,
      i: { markbox: string },
    ) => Promise<{ code: string }[]>;

    const { client, filtros } = dobleListados(EMBARQUES);
    expect(codigos(await handler(ctx(client), { markbox: "DTD-1001" }))).toEqual(["DTDU-0001"]);
    // Las dos lecturas (la de listShipmentsByMarkbox y la relectura) filtran.
    expect(filtros.filter((f) => f.col === "deleted_at")).toHaveLength(2);

    const control = await handler(ctx(dobleListados(todoVivo(EMBARQUES)).client), {
      markbox: "DTD-1001",
    });
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });
});

// ── Bodega VE ─────────────────────────────────────────────────

describe("Bodega VE · un embarque eliminado no se lista ni se cuenta (SDD-0509)", () => {
  it("listVeReceipts deja fuera al eliminado, también con búsqueda y puerto", async () => {
    const tablas = { shipments: par("arrived_destination") };
    const { client, filtros } = dobleListados(tablas);

    expect(codigos(await listVeReceipts(client))).toEqual(["DTDU-0001"]);
    expect(
      codigos(await listVeReceipts(client, { q: "DTDU", port: "Valencia", status: "arrived_destination" })),
    ).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));

    const control = await listVeReceipts(dobleListados(todoVivo(tablas)).client);
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });

  it("computeVeKpis no cuenta eliminados en ninguno de los cuatro contadores", async () => {
    const entregadoHoy = { delivered_at: new Date().toISOString() };
    const tablas = {
      shipments: [
        ...par("in_customs"),
        ...par("arrived_destination"),
        ...par("out_for_delivery"),
        ...par("delivered", entregadoHoy),
      ],
    };

    expect(await computeVeKpis(dobleListados(tablas).client)).toEqual({
      inCustoms: 1,
      readyForPickup: 1,
      outForDelivery: 1,
      deliveredThisMonth: 1,
    });
    expect(await computeVeKpis(dobleListados(todoVivo(tablas)).client)).toEqual({
      inCustoms: 2,
      readyForPickup: 2,
      outForDelivery: 2,
      deliveredThisMonth: 2,
    });
  });
});

// ── Selectores que crean registros ────────────────────────────

describe("Selectores · no se puede elegir un embarque eliminado (SDD-0509)", () => {
  it("Aduana: listShipmentsEligibleForFiling no lo ofrece para abrir un expediente", async () => {
    const tablas = { shipments: par("in_customs"), customs_filings: [] };
    const { client, filtros } = dobleListados(tablas);

    expect(codigos(await listShipmentsEligibleForFiling(client))).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));

    const control = await listShipmentsEligibleForFiling(dobleListados(todoVivo(tablas)).client);
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });

  it("TMS: listEligibleShipmentsForRoute no lo ofrece para planificar una ruta", async () => {
    const tablas = { shipments: par("arrived_destination"), tms_routes: [] };
    const { client, filtros } = dobleListados(tablas);

    expect(codigos(await listEligibleShipmentsForRoute(client))).toEqual(["DTDU-0001"]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));

    const control = await listEligibleShipmentsForRoute(dobleListados(todoVivo(tablas)).client);
    expect(codigos(control)).toEqual(["DTDU-0002", "DTDU-0001"]);
  });
});

// ── Calendario ────────────────────────────────────────────────

describe("Calendario · un embarque eliminado no deja hitos (SDD-0509)", () => {
  const RANGO = { from: "2026-10-01", to: "2026-10-31" };
  const opciones = { timeZone: "America/Caracas" };

  const embebido = (id: string, code: string, deleted_at: string | null) => ({
    id,
    code,
    client_name: "Ana Viva",
    destination: "Valencia",
    deleted_at,
  });

  /** Zarpe del vivo. */
  const ZARPE_VIVO = {
    id: "ev-vivo",
    status: "shipped",
    occurred_at: "2026-10-03T15:00:00Z",
    deleted_at: null,
    shipment: embebido("s-vivo", "DTDU-0001", null),
  };

  /** Zarpe del eliminado: la cascada (0003) le puso deleted_at al evento. */
  const ZARPE_CASCADA = {
    id: "ev-cascada",
    status: "shipped",
    occurred_at: "2026-10-04T15:00:00Z",
    deleted_at: ELIMINADO_EL,
    shipment: embebido("s-eliminado", "DTDU-0002", ELIMINADO_EL),
  };

  /**
   * Evento VIVO de un embarque eliminado: la cascada solo marca los eventos
   * que existían al eliminar; uno insertado después queda vivo. Lo único que
   * lo delata es el `deleted_at` del embarque embebido.
   */
  const ZARPE_TARDIO = {
    id: "ev-tardio",
    status: "shipped",
    occurred_at: "2026-10-12T15:00:00Z",
    deleted_at: null,
    shipment: embebido("s-eliminado", "DTDU-0002", ELIMINADO_EL),
  };

  const TABLAS = {
    shipments: par("arrived_destination"),
    shipment_events: [ZARPE_VIVO, ZARPE_CASCADA, ZARPE_TARDIO],
    bitacora_tasks: [],
  };

  it("ni el arribo ni el zarpe de un embarque eliminado llegan al calendario", async () => {
    const { client, filtros } = dobleListados(TABLAS);
    const eventos = await listCalendarEvents(client, RANGO, opciones);

    expect(eventos.map((e) => `${e.type}:${e.shipmentCode}`).sort()).toEqual([
      "arribo:DTDU-0001",
      "zarpe:DTDU-0001",
    ]);
    expect(filtros).toContainEqual(filtroDeBorrado("shipments"));
    expect(filtros).toContainEqual(filtroDeBorrado("shipment_events"));
  });

  it("sin filtros, el eliminado pondría su arribo y sus dos zarpes (control del doble)", async () => {
    const control = {
      shipments: todoVivo({ s: TABLAS.shipments }).s,
      shipment_events: TABLAS.shipment_events.map((e) => ({
        ...e,
        deleted_at: null,
        shipment: { ...e.shipment, deleted_at: null },
      })),
      bitacora_tasks: [],
    };
    const eventos = await listCalendarEvents(dobleListados(control).client, RANGO, opciones);

    expect(eventos.map((e) => `${e.type}:${e.shipmentCode}`).sort()).toEqual([
      "arribo:DTDU-0001",
      "arribo:DTDU-0002",
      "zarpe:DTDU-0001",
      "zarpe:DTDU-0002",
      "zarpe:DTDU-0002",
    ]);
  });
});
