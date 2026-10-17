// @vitest-environment node
/**
 * SDD-0549 · Proveedores y compras del Portal por principal y tenant.
 *
 * Sesión híbrida con el Shipping Mark DTD-0001 en los tenants A (el del
 * principal) y B. El doble aplica los filtros en lecturas, UPDATE y conteos, y
 * no modela la RLS. Con el código anterior (RPC `get_portal_client_markbox` /
 * `get_portal_client_tenant` y filtros sólo por Shipping Mark), un id o código
 * del tenant B que llegara en el formulario se editaba, se borraba o colgaba
 * compras y servicios; y un proveedor del B bloqueaba el alta por «duplicado».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({ double: null as unknown as PortalDouble }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.double.db }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    throw new Error("sin service_role en la prueba");
  },
}));
vi.mock("@/lib/studio/workflow/workflow-rule-engine", () => ({ fireWorkflowEvent: vi.fn() }));

import {
  createPrealertaAction,
  createSupplierAction,
  deleteSupplierAction,
  requestPrealertaServiceAction,
  updatePrealertaDetalleAction,
  updateSupplierAction,
} from "../actions";

const LEGACY_RPC = {
  get_portal_client_markbox: MARKBOX,
  get_portal_client_tenant: TENANT_A,
  next_supplier_seq: 2,
  next_order_seq: 1,
};

function supplier(id: string, tenantId: string, name: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_seq: 1,
    name,
    city: null,
    wechat: null,
    contact: null,
    notes: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function prealerta(id: string, tenantId: string, supplierId: string, code: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_id: supplierId,
    code,
    description: `Compra ${id}`,
    tracking_cn: null,
    client_note: null,
    boxes: 1,
    est_value_usd: null,
    status: "anunciada",
    received_at: null,
    shipment_id: null,
    share_token: null,
    sales_order_id: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function tables(membership: Row = portalMembership()): Record<string, Row[]> {
  return {
    client_users: [membership],
    suppliers_cn: [
      supplier("sup-a", TENANT_A, "Proveedor A"),
      // Proveedor del tenant A sin compras propias; la única compra que lo nombra
      // es una fila incoherente del tenant B (abajo) y no debe bloquearlo.
      supplier("sup-a-libre", TENANT_A, "Proveedor A libre"),
      supplier("sup-b", TENANT_B, "Proveedor B"),
      supplier("sup-b-libre", TENANT_B, "Proveedor B libre"),
    ],
    prealertas: [
      prealerta("pre-a", TENANT_A, "sup-a", "DTD-0001-1-1"),
      prealerta("pre-b", TENANT_B, "sup-b", "DTD-0001-1-9"),
      prealerta("pre-bx", TENANT_B, "sup-a-libre", "DTD-0001-2-9"),
    ],
    prealerta_service_requests: [],
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const row = (table: string, id: string) => h.double.store[table].find((r) => r.id === id);

beforeEach(() => {
  h.double = portalDouble({ tables: tables(), rpc: LEGACY_RPC });
});

describe("SDD-0549 · proveedores del Portal por principal y tenant", () => {
  it("editar: cambia el proveedor propio y no toca el del mismo Shipping Mark en otro tenant", async () => {
    await expect(updateSupplierAction({}, form({ supplierId: "sup-a", name: "Proveedor A editado" }))).resolves.toEqual({
      ok: true,
      supplierId: "sup-a",
    });
    expect(row("suppliers_cn", "sup-a")?.name).toBe("Proveedor A editado");

    await updateSupplierAction({}, form({ supplierId: "sup-b", name: "Intruso" }));
    expect(row("suppliers_cn", "sup-b")?.name).toBe("Proveedor B");
  });

  it("borrar: no borra un proveedor de otro tenant ni lo bloquean compras de otro tenant", async () => {
    await deleteSupplierAction({}, form({ supplierId: "sup-b-libre" }));
    expect(row("suppliers_cn", "sup-b-libre")?.deleted_at).toBeNull();

    // Su única «compra» es del tenant B: para el principal no tiene compras.
    await expect(deleteSupplierAction({}, form({ supplierId: "sup-a-libre" }))).resolves.toEqual({ ok: true });
    expect(row("suppliers_cn", "sup-a-libre")?.deleted_at).not.toBeNull();

    await expect(deleteSupplierAction({}, form({ supplierId: "sup-a" }))).resolves.toEqual({
      error: "No puedes borrar un proveedor con compras registradas.",
    });
    expect(row("suppliers_cn", "sup-a")?.deleted_at).toBeNull();
  });

  it("crear: el duplicado se mide en el tenant del principal y el alta sella su tenant", async () => {
    await expect(createSupplierAction({}, form({ name: "Proveedor A" }))).resolves.toEqual({
      fieldErrors: { name: "Ya tienes un proveedor con ese nombre." },
    });

    const res = await createSupplierAction({}, form({ name: "Proveedor B" }));
    expect(res).toMatchObject({ ok: true });
    const nuevo = row("suppliers_cn", (res as { supplierId: string }).supplierId);
    expect(nuevo).toMatchObject({ tenant_id: TENANT_A, client_markbox: MARKBOX, supplier_seq: 2, name: "Proveedor B" });
    expect(h.double.rpcCalls.map((c) => c.name)).toEqual(["next_supplier_seq"]);
  });
});

describe("SDD-0549 · compras del Portal por principal y tenant", () => {
  it("una compra sobre el proveedor de otro tenant se rechaza sin escribir", async () => {
    await expect(createPrealertaAction({}, form({ supplierId: "sup-b", wizard: "1" }))).resolves.toEqual({
      fieldErrors: { supplierId: "Ese proveedor no es válido." },
    });
    expect(h.double.on("prealertas").filter((op) => op.kind !== "select")).toEqual([]);
    expect(h.double.rpcCalls).toEqual([]);
  });

  it("una compra sobre el proveedor propio sella el tenant del principal", async () => {
    const res = await createPrealertaAction(
      {},
      form({ supplierId: "sup-a", wizard: "1", supplierWechat: "wx-a", consent: "on", addon: "verificacion" }),
    );
    expect(res).toMatchObject({ ok: true });
    const nueva = h.double.store.prealertas.at(-1);
    expect(nueva).toMatchObject({ tenant_id: TENANT_A, client_markbox: MARKBOX, supplier_id: "sup-a" });
    expect(nueva?.code).toBe((res as { prealertaCode: string }).prealertaCode);
    expect(row("suppliers_cn", "sup-a")?.wechat).toBe("wx-a");
    expect(h.double.rpcCalls.map((c) => c.name)).toEqual(["next_order_seq"]);
    // Los servicios pedidos al registrar la compra se validan contra el catálogo
    // del tenant del principal y se sellan con ese tenant.
    expect(h.double.on("prealerta_addons")[0]?.filters).toContainEqual({ column: "tenant_id", op: "eq", value: TENANT_A });
    expect(h.double.store.prealerta_service_requests).toEqual([
      expect.objectContaining({ tenant_id: TENANT_A, prealerta_id: nueva?.id, client_markbox: MARKBOX, addon_code: "verificacion" }),
    ]);
  });

  it("pedir un servicio sobre la compra de otro tenant se rechaza sin escribir", async () => {
    await expect(
      requestPrealertaServiceAction({}, form({ prealertaCode: "DTD-0001-1-9", addonCode: "verificacion", consent: "on" })),
    ).resolves.toEqual({ error: "Esa compra no es válida." });
    expect(h.double.store.prealerta_service_requests).toEqual([]);
  });

  it("pedir un servicio sobre la compra propia usa el catálogo y el tenant del principal", async () => {
    await expect(
      requestPrealertaServiceAction({}, form({ prealertaCode: "DTD-0001-1-1", addonCode: "verificacion", consent: "on" })),
    ).resolves.toEqual({ ok: true, requestedCount: 1 });
    expect(h.double.store.prealerta_service_requests).toEqual([
      expect.objectContaining({ tenant_id: TENANT_A, prealerta_id: "pre-a", client_markbox: MARKBOX, addon_code: "verificacion" }),
    ]);
    expect(h.double.on("prealerta_addons")[0]?.filters).toContainEqual({ column: "tenant_id", op: "eq", value: TENANT_A });
  });

  it("completar el detalle de la compra de otro tenant se rechaza sin tocarla", async () => {
    await expect(
      updatePrealertaDetalleAction({}, form({ prealertaCode: "DTD-0001-1-9", description: "Intruso", boxes: "3" })),
    ).resolves.toEqual({ error: "Esa compra no es válida." });
    expect(row("prealertas", "pre-b")).toMatchObject({ description: "Compra pre-b", boxes: 1 });

    await expect(
      updatePrealertaDetalleAction({}, form({ prealertaCode: "DTD-0001-1-1", description: "Detalle propio", boxes: "3" })),
    ).resolves.toMatchObject({ ok: true, prealertaCode: "DTD-0001-1-1" });
    expect(row("prealertas", "pre-a")).toMatchObject({ description: "Detalle propio", boxes: 3 });
  });
});

describe("SDD-0549 · sin principal Portal válido", () => {
  it("cada acción corta antes de leer o escribir y sin las RPC legadas", async () => {
    for (const double of [
      portalDouble({ tables: tables(portalMembership({ clientTenant: TENANT_B })), rpc: LEGACY_RPC }),
      portalDouble({ userId: null, tables: tables(), rpc: LEGACY_RPC }),
    ]) {
      h.double = double;
      const expirada = { error: "Tu sesión expiró. Vuelve a entrar." };
      await expect(createSupplierAction({}, form({ name: "Nuevo" }))).resolves.toEqual(expirada);
      await expect(updateSupplierAction({}, form({ supplierId: "sup-a", name: "X" }))).resolves.toEqual(expirada);
      await expect(deleteSupplierAction({}, form({ supplierId: "sup-a-libre" }))).resolves.toEqual(expirada);
      await expect(createPrealertaAction({}, form({ supplierId: "sup-a", wizard: "1" }))).resolves.toEqual(expirada);
      await expect(
        requestPrealertaServiceAction({}, form({ prealertaCode: "DTD-0001-1-1", addonCode: "verificacion", consent: "on" })),
      ).resolves.toEqual(expirada);
      await expect(updatePrealertaDetalleAction({}, form({ prealertaCode: "DTD-0001-1-1" }))).resolves.toEqual(expirada);
      expect(double.operations.filter((op) => op.table !== "client_users")).toEqual([]);
      expect(double.rpcCalls).toEqual([]);
    }
  });
});
