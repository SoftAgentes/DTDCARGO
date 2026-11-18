// @vitest-environment node
/**
 * SDD-0552 · Envíos, documentos, activación y próximo arribo del Portal por
 * principal y tenant.
 *
 * Disposición infeliz: una sesión híbrida, cliente Portal del tenant A con el
 * Shipping Mark DTD-0001, cuando el mismo Shipping Mark existe en el tenant B
 * (es único POR tenant, 0006). El doble aplica los filtros y no modela la RLS:
 * devuelve las filas de los DOS tenants que pasen la consulta, como la policy
 * permisiva «by tenant». También hay otro cliente del tenant A (DTD-0002), para
 * que el filtro por Shipping Mark tenga algo que cortar.
 *
 * Con el código anterior (RPC `get_portal_client_markbox` + filtro sólo por
 * Shipping Mark) estas pruebas fallan: la lista mezcla los envíos del tenant B,
 * el detalle con el mismo código en los dos tenants da 404, los documentos del
 * B aparecen, la cuenta se activa por envíos ajenos y el próximo arribo es del B.
 *
 * Las RPC legadas se siembran con el valor que devolvían, para que el código
 * anterior tenga con qué correr: la diferencia la hace el filtro, no la RPC.
 */
import { describe, expect, it } from "vitest";
import {
  getMyShipment,
  getNextArrival,
  getPortalActivation,
  listMyDocuments,
  listMyShipments,
} from "../portal-queries";
import {
  CLIENT_A,
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type PortalDoubleOptions,
  type Row,
} from "./portal-tenant-double";

const OTRO_MARKBOX = "DTD-0002";
const LEGACY_RPC = { get_portal_client_markbox: MARKBOX, get_portal_client_id: CLIENT_A };

function shipment(id: string, tenantId: string, code: string, over: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    code,
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    origin: "Yiwu, China",
    destination: "Valencia, Venezuela",
    volume_m3: 1.5,
    weight_kg: 300,
    arrived_destination_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-10T00:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

function document(id: string, tenantId: string, markbox = MARKBOX): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: markbox,
    doc_type: "bl",
    storage_path: `${tenantId}/${id}.pdf`,
    file_name: `${id}.pdf`,
    content_type: "application/pdf",
    size_bytes: 10,
    created_at: "2026-10-05T00:00:00.000Z",
    shipment_id: id === "doc-a" ? "ship-a1" : id === "doc-b" ? "ship-b-activo" : "ship-a-otro-cliente",
    shipments: { code: `ENVIO-${id}` },
    deleted_at: null,
  };
}

/**
 * Para `getNextArrival` el doble no ordena: el envío activo del tenant B va
 * PRIMERO, así que una consulta sin el tenant lo elige a él.
 */
const SHIPMENTS: Row[] = [
  shipment("ship-b-activo", TENANT_B, "DTD-0001-B9"),
  shipment("ship-a1", TENANT_A, "DTD-0001-01"),
  // El mismo código en el tenant B: el código es único POR tenant (0002).
  shipment("ship-b-mismo-codigo", TENANT_B, "DTD-0001-01"),
  shipment("ship-a-entregado", TENANT_A, "DTD-0001-02", { status: "delivered" }),
  // Otro cliente del mismo tenant A.
  shipment("ship-a-otro-cliente", TENANT_A, "DTD-0002-01", { client_markbox: OTRO_MARKBOX }),
  shipment("ship-a-borrado", TENANT_A, "DTD-0001-03", { deleted_at: "2026-10-02T00:00:00.000Z" }),
];

function tables(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    client_users: [portalMembership()],
    clients: [{ id: CLIENT_A, tenant_id: TENANT_A, markbox: MARKBOX, portal_approved_at: null, deleted_at: null }],
    shipments: SHIPMENTS,
    shipment_documents: [document("doc-a", TENANT_A), document("doc-b", TENANT_B), document("doc-a-otro", TENANT_A, OTRO_MARKBOX)],
    ...over,
  };
}

function arrange(options: PortalDoubleOptions = {}) {
  // Local RPC transport only. The SQL/RLS policy remains a separate oracle.
  const double = portalDouble({ tables: tables(), ...options, rpc: { ...LEGACY_RPC, ...options.rpc,
    client_consolidation_portal_read: () => ({ available: true, complete: true, observedAt: "2026-10-21T12:00:00Z",
      principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: MARKBOX },
      shipments: (double.store.shipments ?? []).filter((row) => row.tenant_id === TENANT_A && row.client_markbox === MARKBOX && row.deleted_at === null)
        .map((row) => ({ ...row, normal: null })) }),
  } });
  return double;
}

describe("SDD-0552 · envíos del Portal por principal y tenant", () => {
  it("la lista trae sólo los envíos vivos del tenant y el Shipping Mark del principal", async () => {
    const { db } = arrange();
    const codes = (await listMyShipments(db)).map((s) => s.code).sort();
    expect(codes).toEqual(["DTD-0001-01", "DTD-0001-02"]);
  });

  it("con el mismo código en los dos tenants, el detalle es el del tenant del principal", async () => {
    const { db } = arrange();
    const detail = await getMyShipment(db, "DTD-0001-01");
    expect(detail?.id).toBe("ship-a1");
  });

  it("el detalle de un envío del tenant B con el mismo Shipping Mark responde null", async () => {
    const { db } = arrange();
    expect(await getMyShipment(db, "DTD-0001-B9")).toBeNull();
  });

  it("el detalle de otro cliente del mismo tenant responde null", async () => {
    const { db } = arrange();
    expect(await getMyShipment(db, "DTD-0002-01")).toBeNull();
  });

  it("el próximo arribo es el envío activo del principal, no el del tenant B", async () => {
    const { db } = arrange();
    const next = await getNextArrival(db);
    expect(next?.id).toBe("ship-a1");
  });

  it("el próximo arribo tampoco es el de otro cliente del mismo tenant", async () => {
    // El envío activo del otro cliente del tenant A va PRIMERO: sin el filtro
    // por Shipping Mark, la consulta lo elige a él.
    const { db } = arrange({
      tables: tables({
        shipments: [
          shipment("ship-a-otro-cliente", TENANT_A, "DTD-0002-01", { client_markbox: OTRO_MARKBOX }),
          shipment("ship-a1", TENANT_A, "DTD-0001-01"),
        ],
      }),
      rpc: LEGACY_RPC,
    });
    expect((await getNextArrival(db))?.id).toBe("ship-a1");
  });
});

describe("SDD-0552 · documentos del Portal por principal y tenant", () => {
  it("lista sólo los documentos del tenant y el Shipping Mark del principal", async () => {
    const { db } = arrange();
    expect((await listMyDocuments(db)).map((d) => d.id)).toEqual(["doc-a"]);
  });
});

describe("SDD-0552 · activación del Portal por principal y tenant", () => {
  it("los envíos del tenant B con el mismo Shipping Mark no activan la cuenta", async () => {
    const { db } = arrange({
      tables: tables({
        shipments: [
          shipment("ship-b", TENANT_B, "DTD-0001-B1"),
          shipment("ship-a-otro-cliente", TENANT_A, "DTD-0002-01", { client_markbox: OTRO_MARKBOX }),
        ],
      }),
      rpc: LEGACY_RPC,
    });
    expect(await getPortalActivation(db)).toEqual({ activated: false, reason: null });
  });

  it("un envío propio sí la activa", async () => {
    const { db } = arrange();
    expect(await getPortalActivation(db)).toEqual({ activated: true, reason: "has_shipments" });
  });

  it("la aprobación se lee con el id del cliente del principal", async () => {
    const { db, on } = arrange({
      tables: tables({
        clients: [{ id: CLIENT_A, tenant_id: TENANT_A, markbox: MARKBOX, portal_approved_at: "2026-10-01T00:00:00.000Z", deleted_at: null }],
      }),
      rpc: LEGACY_RPC,
    });
    expect(await getPortalActivation(db)).toEqual({ activated: true, reason: "approved" });
    expect(on("clients").map((op) => op.filters)).toEqual([[{ column: "id", op: "eq", value: CLIENT_A }]]);
    expect(on("shipments")).toEqual([]);
  });
});

const INVALID: Array<[string, PortalDoubleOptions]> = [
  ["sesión anónima", { userId: null }],
  ["sin vínculo", { tables: tables({ client_users: [] }) }],
  ["vínculo de A con cliente de B", { tables: tables({ client_users: [portalMembership({ clientTenant: TENANT_B })] }) }],
  ["cliente retirado", { tables: tables({ client_users: [portalMembership({ deletedAt: "2026-10-01T00:00:00.000Z" })] }) }],
];

describe("SDD-0552 · sin principal válido no hay consultas de dominio ni RPC legadas", () => {
  it.each(INVALID)("%s", async (_label, options) => {
    const double = arrange(options);
    expect(await listMyShipments(double.db)).toEqual([]);
    expect(await getMyShipment(double.db, "DTD-0001-01")).toBeNull();
    expect(await listMyDocuments(double.db)).toEqual([]);
    expect(await getPortalActivation(double.db)).toEqual({ activated: false, reason: null });
    expect(await getNextArrival(double.db)).toBeNull();
    expect(double.operations.filter((op) => op.table !== "client_users")).toEqual([]);
    expect(double.rpcCalls).toEqual([]);
  });
});
