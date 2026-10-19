/**
 * SDD-0554 · El hub de «Mis envíos» lee compras, proveedores y adjuntos con el
 * tenant y el Shipping Mark del principal de sesión.
 *
 * La sesión es un doble que aplica los filtros y no modela la RLS (sesión
 * híbrida): el mismo Shipping Mark tiene una compra con proveedor y factura en
 * el tenant A y otra en el tenant B. Las lecturas de
 * `lib/studio/prealertas/queries` son las reales.
 *
 * Los ids de compra que salen de `listPrealertas` acotan después la lectura de
 * packing lists con el ADMIN client, que no tiene RLS
 * (`prealertasConPackingList`). Con el código anterior el hub mostraba la compra
 * del tenant B como propia, con su factura, y mandaba su id al admin.
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

const ADMIN = { cliente: "admin" };

const h = vi.hoisted(() => ({
  session: null as unknown as PortalDouble,
  principal: null as unknown,
  conPacking: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ADMIN }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
  listMyShipments: async () => [],
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("@/lib/portal/next-sailing-queries", async (original) => ({
  ...(await original<typeof import("@/lib/portal/next-sailing-queries")>()),
  getNextOpenSailing: async () => null,
}));
vi.mock("@/lib/portal/packing-list-queries", () => ({ prealertasConPackingList: h.conPacking }));
vi.mock("@/lib/portal/consolidation-queries", () => ({ getConsolidationsForShipments: async () => ({}) }));
vi.mock("@/app/portal/_components/PortalHubTabs", () => ({ EnviosHubTabs: () => null }));
vi.mock("@/app/portal/(app)/envios/_components/PortalAlertasHub", () => ({
  PortalAlertasHub: (p: {
    items: { key: string; code: string; title: string }[];
    docs: Record<string, { packing: boolean; factura: boolean; foto: boolean }>;
  }) => (
    <>
      <ul aria-label="Alertas">
        {p.items.map((i) => (
          <li key={i.key}>{`${i.code} · ${i.title}`}</li>
        ))}
      </ul>
      <ul aria-label="Documentos por compra">
        {Object.entries(p.docs).map(([key, d]) => (
          <li key={key}>{`${key} · packing ${d.packing ? "sí" : "no"} · factura ${d.factura ? "sí" : "no"}`}</li>
        ))}
      </ul>
    </>
  ),
}));

import PortalShipmentsPage from "../page";

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
    boxes: 2,
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

function factura(id: string, tenantId: string, prealertaId: string): Row {
  return {
    id,
    tenant_id: tenantId,
    prealerta_id: prealertaId,
    client_markbox: MARKBOX,
    doc_type: "factura",
    storage_path: `ruta/${id}.pdf`,
    file_name: `${id}.pdf`,
    content_type: "application/pdf",
    size_bytes: 10,
    source: "client",
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
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
        prealerta("pre-a", TENANT_A, "DTD-0001-1-1", "sup-a"),
        prealerta("pre-b", TENANT_B, "DTD-0001-1-7", "sup-b"),
      ],
      prealerta_documents: [factura("doc-a", TENANT_A, "pre-a"), factura("doc-b", TENANT_B, "pre-b")],
    },
  });
  // Devuelve como «con packing list» todo id que reciba: así se ve qué ids le llegan.
  h.conPacking.mockReset().mockImplementation(async (_admin: unknown, ids: string[]) => new Set(ids));
});
afterEach(cleanup);

describe("/portal/envios: compras del hub con el principal de sesión (SDD-0554)", () => {
  it("muestra sólo la compra del tenant del principal, con su proveedor y sus documentos", async () => {
    render((await PortalShipmentsPage())!);
    const alertas = screen.getByRole("list", { name: "Alertas" });
    expect(alertas).toHaveTextContent("DTD-0001-1-1 · Proveedor de A");
    expect(alertas).not.toHaveTextContent("DTD-0001-1-7");
    const docs = screen.getByRole("list", { name: "Documentos por compra" });
    expect(docs).toHaveTextContent("p:pre-a · packing sí · factura sí");
    expect(docs).not.toHaveTextContent("p:pre-b");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("al admin client sólo le llegan los ids de compra del tenant del principal", async () => {
    await PortalShipmentsPage();
    expect(h.conPacking).toHaveBeenCalledTimes(1);
    expect(h.conPacking).toHaveBeenCalledWith(ADMIN, ["pre-a"], MARKBOX);
  });

  it("compras, proveedores y adjuntos se consultan con el tenant y el Shipping Mark del principal", async () => {
    await PortalShipmentsPage();
    for (const table of ["prealertas", "suppliers_cn", "prealerta_documents"]) {
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

  it("sin principal no consulta compras ni llama al admin client", async () => {
    h.principal = null;
    expect(await PortalShipmentsPage()).toBeNull();
    expect(h.session.operations).toEqual([]);
    expect(h.conPacking).not.toHaveBeenCalled();
  });
});
