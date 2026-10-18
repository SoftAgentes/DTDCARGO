// @vitest-environment node
/**
 * SDD-0552 · `getPrealertaByCode` filtra por el tenant del principal Portal.
 *
 * El código y el Shipping Mark son únicos POR tenant (0105, 0006) y la policy
 * de equipo «by tenant» es permisiva. Disposición infeliz: una sesión híbrida
 * con la misma compra (código y Shipping Mark) en los tenants A y B, otra
 * compra sólo en B y una de otro cliente del tenant A. El doble aplica los
 * filtros y no modela la RLS.
 *
 * Con la consulta anterior (código + Shipping Mark) la compra compartida
 * devuelve dos filas, `maybeSingle` falla y el cliente legítimo recibe null; y
 * la compra que sólo existe en B le llega como propia.
 */
import { describe, expect, it } from "vitest";
import { getPrealertaByCode } from "@/lib/studio/prealertas/queries";
import { MARKBOX, TENANT_A, TENANT_B, portalDouble, type Row } from "./portal-tenant-double";

function prealerta(id: string, tenantId: string, code: string, over: Row = {}): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_id: null,
    code,
    description: `Compra ${id}`,
    tracking_cn: null,
    client_note: null,
    boxes: 4,
    est_value_usd: null,
    status: "anunciada",
    received_at: null,
    shipment_id: null,
    share_token: null,
    sales_order_id: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

const PREALERTAS: Row[] = [
  prealerta("pre-a", TENANT_A, "DTD-0001-1-1"),
  prealerta("pre-b", TENANT_B, "DTD-0001-1-1"),
  prealerta("pre-b-sola", TENANT_B, "DTD-0001-1-2"),
  prealerta("pre-a-otro-cliente", TENANT_A, "DTD-0002-1-1", { client_markbox: "DTD-0002" }),
  prealerta("pre-a-borrada", TENANT_A, "DTD-0001-1-3", { deleted_at: "2026-10-02T00:00:00.000Z" }),
];

function db() {
  return portalDouble({ tables: { prealertas: PREALERTAS } }).db;
}

describe("SDD-0552 · getPrealertaByCode por tenant y Shipping Mark del principal", () => {
  it("con la misma compra en los dos tenants devuelve la del tenant del principal", async () => {
    const pre = await getPrealertaByCode(db(), "DTD-0001-1-1", { markbox: MARKBOX, tenantId: TENANT_A });
    expect(pre?.id).toBe("pre-a");
    expect(pre?.tenant_id).toBe(TENANT_A);
  });

  it("una compra que sólo existe en el tenant B no existe para el principal del A", async () => {
    expect(await getPrealertaByCode(db(), "DTD-0001-1-2", { markbox: MARKBOX, tenantId: TENANT_A })).toBeNull();
  });

  it("la compra de otro cliente del mismo tenant tampoco", async () => {
    expect(await getPrealertaByCode(db(), "DTD-0002-1-1", { markbox: MARKBOX, tenantId: TENANT_A })).toBeNull();
  });

  it("una compra borrada responde null", async () => {
    expect(await getPrealertaByCode(db(), "DTD-0001-1-3", { markbox: MARKBOX, tenantId: TENANT_A })).toBeNull();
  });
});
