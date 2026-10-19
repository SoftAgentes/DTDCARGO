/**
 * SDD-0554 · El detalle de una compra y sus etiquetas leen proveedores y
 * adjuntos con el tenant y el Shipping Mark del principal de sesión.
 *
 * La compra ya se resolvía con el tenant (SDD-0552). Faltaban las lecturas que
 * cuelgan de ella: `listSuppliers` (nombre y WeChat del proveedor) y
 * `listPrealertaDocuments` (adjuntos, que en etiquetas se firman con el admin
 * client). La sesión es un doble que aplica los filtros y no modela la RLS
 * (sesión híbrida). Las lecturas de `lib/studio/prealertas/queries` son las
 * reales.
 *
 * La base no ata el tenant del proveedor ni el del adjunto al de la compra
 * (FK sólo por id, 0105 y 0118): la disposición «incoherente» cuelga de la
 * compra de A un proveedor y un adjunto del tenant B. Con el código anterior
 * se mostraban como propios.
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
  firmadas: [] as string[],
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          h.firmadas.push(path);
          return { data: { signedUrl: `https://firmada.invalid/${path}` }, error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
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
vi.mock("@/lib/studio/label-presentation-queries", () => ({
  getLabelPresentation: async () => ({ settings: {} }),
}));
vi.mock("@/lib/studio/aliados/brand-resolve", () => ({ resolveBrandForPortal: async () => null }));
vi.mock("@/lib/studio/document-import/service", () => ({
  documentLabelGate: async () => ({ allowed: true }),
}));
vi.mock("@/app/portal/(app)/compras/[code]/etiquetas/LabelsClient", () => ({
  LabelsClient: (p: { supplierName: string | null }) => (
    <section aria-label="Etiquetas">{p.supplierName ?? "sin proveedor"}</section>
  ),
}));
vi.mock("@/app/portal/(app)/compras/[code]/etiquetas/ServiceSection", () => ({
  PrealertaServiceSection: () => null,
}));
vi.mock("@/app/portal/_components/ShareProviderButton", () => ({ ShareProviderButton: () => null }));

import PortalPurchaseDetailPage from "../page";
import PortalLabelsPage from "../etiquetas/page";

const COMPRA = "DTD-0001-1-1";
const params = { params: Promise.resolve({ code: COMPRA }) };

function supplier(id: string, tenantId: string, name: string): Row {
  return {
    id,
    tenant_id: tenantId,
    client_markbox: MARKBOX,
    supplier_seq: 1,
    name,
    city: null,
    wechat: `wechat-${id}`,
    contact: null,
    notes: null,
    deleted_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function compra(supplierId: string): Row {
  return {
    id: "pre-a",
    tenant_id: TENANT_A,
    client_markbox: MARKBOX,
    supplier_id: supplierId,
    code: COMPRA,
    description: "Compra de A",
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

function adjunto(id: string, tenantId: string): Row {
  return {
    id,
    tenant_id: tenantId,
    prealerta_id: "pre-a",
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

/** `supplierId` de la compra: el propio (coherente) o el del tenant B (incoherente). */
function sesion(supplierId: "sup-a" | "sup-b") {
  return portalDouble({
    tables: {
      client_users: [portalMembership()],
      prealertas: [compra(supplierId)],
      suppliers_cn: [supplier("sup-a", TENANT_A, "Proveedor de A"), supplier("sup-b", TENANT_B, "Proveedor de B")],
      prealerta_documents: [adjunto("adjunto-de-a", TENANT_A), adjunto("adjunto-de-b", TENANT_B)],
    },
  });
}

beforeEach(() => {
  h.principal = {
    userId: "u1",
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A" },
  };
  h.session = sesion("sup-a");
  h.firmadas = [];
});
afterEach(cleanup);

function consultadasConElPrincipal(table: string) {
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

describe("/portal/compras/[code]: proveedor con el principal de sesión (SDD-0554)", () => {
  it("muestra el proveedor de la compra y lo lee con el tenant y el Shipping Mark del principal", async () => {
    render((await PortalPurchaseDetailPage(params))!);
    expect(screen.getByText("Proveedor de A")).toBeInTheDocument();
    consultadasConElPrincipal("suppliers_cn");
  });

  it("un proveedor del tenant B colgado de la compra no se muestra como propio", async () => {
    h.session = sesion("sup-b");
    render((await PortalPurchaseDetailPage(params))!);
    expect(screen.queryByText("Proveedor de B")).toBeNull();
  });
});

describe("/portal/compras/[code]/etiquetas con el principal de sesión (SDD-0554)", () => {
  it("firma y muestra sólo los adjuntos del tenant del principal", async () => {
    render((await PortalLabelsPage(params))!);
    expect(screen.getByText("adjunto-de-a.pdf")).toBeInTheDocument();
    expect(screen.queryByText("adjunto-de-b.pdf")).toBeNull();
    expect(h.firmadas).toEqual(["ruta/adjunto-de-a.pdf"]);
    consultadasConElPrincipal("prealerta_documents");
  });

  it("la etiqueta lleva el proveedor de la compra, leído con el principal", async () => {
    render((await PortalLabelsPage(params))!);
    expect(screen.getByRole("region", { name: "Etiquetas" })).toHaveTextContent("Proveedor de A");
    expect(screen.getByText("wechat-sup-a")).toBeInTheDocument();
    consultadasConElPrincipal("suppliers_cn");
  });

  it("un proveedor del tenant B colgado de la compra no llega a la etiqueta ni su WeChat", async () => {
    h.session = sesion("sup-b");
    render((await PortalLabelsPage(params))!);
    expect(screen.getByRole("region", { name: "Etiquetas" })).toHaveTextContent("sin proveedor");
    expect(screen.queryByText("wechat-sup-b")).toBeNull();
  });

  it("sin principal no consulta proveedores ni adjuntos ni firma nada", async () => {
    h.principal = null;
    expect(await PortalLabelsPage(params)).toBeNull();
    expect(h.session.on("suppliers_cn")).toEqual([]);
    expect(h.session.on("prealerta_documents")).toEqual([]);
    expect(h.firmadas).toEqual([]);
  });
});
