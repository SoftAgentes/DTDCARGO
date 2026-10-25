/**
 * SDD-0554 · «Tus proveedores» lee proveedores y compras con el tenant y el
 * Shipping Mark del principal de sesión.
 *
 * La sesión es un doble que aplica los filtros y no modela la RLS (sesión
 * híbrida): el mismo Shipping Mark tiene un proveedor con dos compras en el
 * tenant A y otro proveedor, con el mismo número, en el tenant B. Las lecturas
 * de `lib/studio/prealertas/queries` son las reales.
 *
 * Con el código anterior (sólo Shipping Mark), la pantalla mostraba el proveedor
 * del tenant B como propio, con su propio próximo código de compra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  CLIENT_A,
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({
  session: null as unknown as PortalDouble,
  principal: null as unknown,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
}));
vi.mock("@/app/portal/_components/PortalHubTabs", () => ({ EnviosHubTabs: () => null }));
vi.mock("@/app/portal/(app)/proveedores/SuppliersClient", () => ({
  SuppliersClient: (p: { suppliers: { id: string; name: string; orderCount: number; nextCode: string }[] }) => (
    <ul aria-label="Tus proveedores">
      {p.suppliers.map((s) => (
        <li key={s.id}>{`${s.name} · ${s.orderCount} compras · ${s.nextCode}`}</li>
      ))}
    </ul>
  ),
}));

import PortalSuppliersPage from "../page";

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
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function prealerta(id: string, tenantId: string, supplierId: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_id: supplierId,
    code: `DTD-0001-1-${id}`,
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
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  h.principal = {
    userId: "u1",
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A" },
  };
  h.session = portalDouble({
    tables: {
      suppliers_cn: [supplier("sup-a", TENANT_A, "Proveedor de A"), supplier("sup-b", TENANT_B, "Proveedor de B")],
      prealertas: [
        prealerta("1", TENANT_A, "sup-a"),
        prealerta("2", TENANT_A, "sup-a"),
        prealerta("9", TENANT_B, "sup-b"),
      ],
    },
  });
});
afterEach(cleanup);

describe("/portal/proveedores con el principal de sesión (SDD-0554)", () => {
  it("muestra sólo los proveedores del tenant del principal, con sus compras", async () => {
    render((await PortalSuppliersPage())!);
    const lista = screen.getByRole("list", { name: "Tus proveedores" });
    expect(lista).toHaveTextContent(/^Proveedor de A · 2 compras · DTD-[\w-]+-1-3$/);
    expect(lista).not.toHaveTextContent("Proveedor de B");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    for (const table of ["prealertas", "suppliers_cn"]) {
      const filtros = h.session.on(table).map((op) => op.filters);
      expect(filtros.length).toBeGreaterThan(0);
      for (const f of filtros) {
        expect(f).toEqual(
          expect.arrayContaining([
            { column: "tenant_id", op: "eq", value: TENANT_A },
            { column: "client_markbox", op: "eq", value: MARKBOX },
          ]),
        );
      }
    }
  });

  it("sin principal no consulta proveedores ni compras", async () => {
    h.principal = null;
    expect(await PortalSuppliersPage()).toBeNull();
    expect(h.session.operations).toEqual([]);
  });
});
