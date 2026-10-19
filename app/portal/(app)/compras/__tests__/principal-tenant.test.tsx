/**
 * SDD-0554 · «Mis compras» y «Nueva compra» leen compras y proveedores con el
 * tenant y el Shipping Mark del principal de sesión.
 *
 * La sesión es un doble que aplica los filtros y no modela la RLS (sesión
 * híbrida): el mismo Shipping Mark tiene una compra y un proveedor en el tenant
 * A y otros en el tenant B. Las lecturas de `lib/studio/prealertas/queries` son
 * las reales, también `listPrealertaServiceRequests`, que resuelve su vínculo
 * desde `client_users` (SDD-0381).
 *
 * Con el código anterior (sólo Shipping Mark), las dos pantallas mostraban la
 * compra y el proveedor del tenant B como propios.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  CLIENT_A,
  MARKBOX,
  TENANT_A,
  TENANT_B,
  portalDouble,
  portalMembership,
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
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
}));
vi.mock("@/lib/portal/demo", () => ({ showNewPurchaseWizard: () => true }));
vi.mock("@/app/portal/_components/PortalHubTabs", () => ({ EnviosHubTabs: () => null }));
vi.mock("@/app/portal/_components/NewPurchaseButton", () => ({ NewPurchaseButton: () => null }));
vi.mock("@/app/portal/(app)/compras/ComprasList", () => ({
  ComprasList: (p: { items: { code: string; supplierName: string | null; services: number }[] }) => (
    <ul aria-label="Mis compras">
      {p.items.map((i) => (
        <li key={i.code}>{`${i.code} · ${i.supplierName ?? "sin proveedor"} · ${i.services} servicios`}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/app/portal/(app)/compras/nueva/NewPurchaseWizard", () => ({
  NewPurchaseWizard: (p: { suppliers: { id: string; name: string; orderCount: number; nextCode: string }[] }) => (
    <ul aria-label="Proveedores para la compra">
      {p.suppliers.map((s) => (
        <li key={s.id}>{`${s.name} · ${s.orderCount} compras · ${s.nextCode}`}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/app/portal/(app)/compras/nueva/NewPurchaseForm", () => ({ NewPurchaseForm: () => null }));

import PortalPurchasesPage from "../page";
import NuevaCompraPage from "../nueva/page";

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

function prealerta(id: string, tenantId: string, code: string, supplierId: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_id: supplierId,
    code,
    description: `Compra ${id}`,
    tracking_cn: null,
    client_note: null,
    boxes: 3,
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

function servicio(id: string, tenantId: string, prealertaId: string): Row {
  return {
    id,
    tenant_id: tenantId,
    prealerta_id: prealertaId,
    client_markbox: MARKBOX,
    addon_code: "hold_consolidar",
    status: "solicitada",
    timing: "a_tiempo",
    trackings: null,
    consent_accepted: true,
    notes: null,
    quoted_amount_usd: null,
    processed_at: null,
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
      client_users: [portalMembership()],
      suppliers_cn: [supplier("sup-a", TENANT_A, "Proveedor de A"), supplier("sup-b", TENANT_B, "Proveedor de B")],
      prealertas: [
        prealerta("pre-a", TENANT_A, "DTD-0001-1-1", "sup-a"),
        prealerta("pre-b", TENANT_B, "DTD-0001-1-7", "sup-b"),
      ],
      prealerta_service_requests: [servicio("srv-a", TENANT_A, "pre-a"), servicio("srv-b", TENANT_B, "pre-b")],
    },
  });
});
afterEach(cleanup);

function filtrosCon(table: string) {
  return h.session.on(table).map((op) => op.filters);
}

const DEL_PRINCIPAL = [
  { column: "tenant_id", op: "eq", value: TENANT_A },
  { column: "client_markbox", op: "eq", value: MARKBOX },
];

describe("/portal/compras con el principal de sesión (SDD-0554)", () => {
  it("lista sólo las compras del tenant del principal, con su proveedor y sus servicios", async () => {
    render((await PortalPurchasesPage())!);
    const lista = screen.getByRole("list", { name: "Mis compras" });
    expect(lista).toHaveTextContent("DTD-0001-1-1 · Proveedor de A · 1 servicios");
    expect(lista).not.toHaveTextContent("DTD-0001-1-7");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    for (const table of ["prealertas", "suppliers_cn"]) {
      const filtros = filtrosCon(table);
      expect(filtros.length).toBeGreaterThan(0);
      for (const f of filtros) expect(f).toEqual(expect.arrayContaining(DEL_PRINCIPAL));
    }
  });

  it("sin principal no pinta nada ni consulta compras, proveedores ni servicios", async () => {
    h.principal = null;
    expect(await PortalPurchasesPage()).toBeNull();
    expect(h.session.operations).toEqual([]);
  });
});

describe("/portal/compras/nueva con el principal de sesión (SDD-0554)", () => {
  const props = { searchParams: Promise.resolve({}) };

  it("ofrece sólo los proveedores del tenant del principal y cuenta sólo sus compras", async () => {
    render((await NuevaCompraPage(props))!);
    const lista = screen.getByRole("list", { name: "Proveedores para la compra" });
    expect(lista).toHaveTextContent(/^Proveedor de A · 1 compras · DTD-[\w-]+-1-2$/);
    expect(lista).not.toHaveTextContent("Proveedor de B");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    for (const table of ["prealertas", "suppliers_cn"]) {
      const filtros = filtrosCon(table);
      expect(filtros.length).toBeGreaterThan(0);
      for (const f of filtros) expect(f).toEqual(expect.arrayContaining(DEL_PRINCIPAL));
    }
  });

  it("sin principal no consulta compras ni proveedores", async () => {
    h.principal = null;
    expect(await NuevaCompraPage(props)).toBeNull();
    expect(h.session.operations).toEqual([]);
  });
});
