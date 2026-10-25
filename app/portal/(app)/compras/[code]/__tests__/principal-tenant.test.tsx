/**
 * SDD-0552 · El detalle de una compra y su «Completar detalle» leen la compra
 * con el tenant y el Shipping Mark del principal de sesión.
 *
 * Eran las dos pantallas del Portal que llamaban a `getPrealertaByCode` sin
 * comparar el tenant después. La sesión es un doble que aplica los filtros y no
 * modela la RLS (sesión híbrida): la misma compra existe en los tenants A y B, y
 * otra sólo en B. `getPrealertaByCode` es el real.
 *
 * Con el código anterior (sólo código + Shipping Mark), la compra compartida da
 * 404 al cliente legítimo y la compra del tenant B se le muestra como propia.
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

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ cliente: "admin" }) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
}));
vi.mock("@/lib/studio/prealertas/queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/prealertas/queries")>()),
  listPredeclaredBoxes: async () => [],
  listPrealertaServiceRequests: async () => [],
  listSuppliers: async () => [],
}));
vi.mock("@/lib/portal/purchase-reception-queries", async (original) => ({
  ...(await original<typeof import("@/lib/portal/purchase-reception-queries")>()),
  listarRecepcionesDeCompra: async () => ({
    recepciones: [],
    cajasRecibidas: 0,
    cbmTotal: null,
    pesoTotal: null,
    primeraRecepcion: null,
  }),
}));
vi.mock("@/lib/portal/packing-list-queries", async (original) => ({
  ...(await original<typeof import("@/lib/portal/packing-list-queries")>()),
  obtenerPackingListDeCompra: async () => null,
}));
vi.mock("@/lib/portal/portal-avisos-queries", () => ({ listMyPortalAvisos: async () => [] }));
vi.mock("@/app/portal/(app)/compras/nueva/PurchaseStepDetalle", () => ({
  PurchaseStepDetalle: (p: { code: string; guardado: { description: string } }) => (
    <form aria-label="Completar detalle">
      {p.code} · {p.guardado.description}
    </form>
  ),
}));

import PortalPurchaseDetailPage from "../page";
import CompletarDetalleCompraPage from "../detalle/page";

function prealerta(id: string, tenantId: string, code: string): Row {
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
  };
}

const COMPARTIDA = "DTD-0001-1-1";
const SOLO_EN_B = "DTD-0001-1-2";
const params = (code: string) => ({ params: Promise.resolve({ code }) });

beforeEach(() => {
  h.principal = {
    userId: "u1",
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A" },
  };
  h.session = portalDouble({
    tables: {
      prealertas: [
        prealerta("pre-a", TENANT_A, COMPARTIDA),
        prealerta("pre-b", TENANT_B, COMPARTIDA),
        prealerta("pre-b-sola", TENANT_B, SOLO_EN_B),
      ],
    },
  });
});
afterEach(cleanup);

function filtrosDeLaCompra() {
  return h.session.on("prealertas").map((op) => op.filters);
}

describe("/portal/compras/[code] con el principal de sesión (SDD-0552)", () => {
  it("con la misma compra en los dos tenants muestra la del tenant del principal", async () => {
    render((await PortalPurchaseDetailPage(params(COMPARTIDA)))!);
    expect(screen.getByText("Compra pre-a")).toBeInTheDocument();
    expect(screen.queryByText("Compra pre-b")).toBeNull();
    expect(filtrosDeLaCompra()).toEqual([
      expect.arrayContaining([
        { column: "tenant_id", op: "eq", value: TENANT_A },
        { column: "client_markbox", op: "eq", value: MARKBOX },
      ]),
    ]);
  });

  it("una compra que sólo existe en el tenant B responde 404", async () => {
    await expect(PortalPurchaseDetailPage(params(SOLO_EN_B))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sin principal no consulta la compra", async () => {
    h.principal = null;
    expect(await PortalPurchaseDetailPage(params(COMPARTIDA))).toBeNull();
    expect(h.session.on("prealertas")).toEqual([]);
  });
});

describe("/portal/compras/[code]/detalle con el principal de sesión (SDD-0552)", () => {
  it("con la misma compra en los dos tenants precarga la del tenant del principal", async () => {
    render(await CompletarDetalleCompraPage(params(COMPARTIDA)));
    expect(screen.getByRole("form", { name: "Completar detalle" })).toHaveTextContent(
      `${COMPARTIDA} · Compra pre-a`,
    );
    expect(filtrosDeLaCompra()).toEqual([
      expect.arrayContaining([{ column: "tenant_id", op: "eq", value: TENANT_A }]),
    ]);
  });

  it("una compra que sólo existe en el tenant B responde 404", async () => {
    await expect(CompletarDetalleCompraPage(params(SOLO_EN_B))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
