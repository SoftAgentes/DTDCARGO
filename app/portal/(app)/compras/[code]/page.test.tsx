/**
 * SDD-0514 · Detalle de una compra con el aviso «Seguimiento en construcción».
 *
 * Es la pantalla donde hoy faltan los pasos siguientes: la bodega de China
 * todavía registra en Excel, así que «Recepción en bodega» sale vacía aunque la
 * mercancía haya llegado. Se renderiza la página real con sus consultas
 * simuladas y se mira lo que ve el cliente:
 *
 *  - prendido: el aviso aparece arriba del estado de llegada;
 *  - apagado: desaparece y la pantalla queda como antes;
 *  - con recepciones reales: el aviso convive con ellas y no las tapa.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  prendido: true,
  recepcion: {
    recepciones: [] as unknown[],
    cajasRecibidas: 0,
    cbmTotal: null as number | null,
    pesoTotal: null as number | null,
    primeraRecepcion: null as string | null,
  },
}));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: async () => ({ id: "c1", markbox: "DTD-TEST", name: "Cliente Prueba" }),
}));
vi.mock("@/lib/studio/prealertas/queries", () => ({
  getPrealertaByCode: async () => ({
    id: "p1",
    code: "PA-0001",
    status: "anunciada",
    description: "Lámparas de escritorio",
    boxes: 4,
    supplier_id: null,
    tracking_cn: null,
    est_value_usd: null,
    created_at: "2026-10-01T12:00:00Z",
    client_note: null,
  }),
  listPredeclaredBoxes: async () => [],
  listPrealertaServiceRequests: async () => [],
  listSuppliers: async () => [],
}));
// Sólo se simula la lectura; `compararCajas` y `nombreDeProveedor` son los reales.
vi.mock("@/lib/portal/purchase-reception-queries", async (original) => ({
  ...(await original<typeof import("@/lib/portal/purchase-reception-queries")>()),
  listarRecepcionesDeCompra: async () => h.recepcion,
}));
vi.mock("@/lib/portal/packing-list-queries", async (original) => ({
  ...(await original<typeof import("@/lib/portal/packing-list-queries")>()),
  obtenerPackingListDeCompra: async () => null,
}));

import PortalPurchaseDetailPage from "./page";

const TITULO = "Seguimiento en construcción";

async function abrir() {
  const ui = await PortalPurchaseDetailPage({ params: Promise.resolve({ code: "PA-0001" }) });
  render(ui!);
}

function aviso(): HTMLElement | null {
  return (
    screen
      .queryAllByRole("status")
      .find((el) => el.textContent?.includes(TITULO)) ?? null
  );
}

beforeEach(() => {
  h.prendido = true;
  h.recepcion = {
    recepciones: [],
    cajasRecibidas: 0,
    cbmTotal: null,
    pesoTotal: null,
    primeraRecepcion: null,
  };
});
afterEach(cleanup);

describe("/portal/compras/[code] con el aviso de seguimiento (SDD-0514)", () => {
  it("prendido: el aviso va arriba del estado de llegada", async () => {
    await abrir();
    const caja = aviso();
    expect(caja).not.toBeNull();
    const llegada = screen.getByText("Todavía no llegó a nuestra bodega");
    expect(
      caja!.compareDocumentPosition(llegada) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("apagado: sin aviso y con la misma pantalla", async () => {
    h.prendido = false;
    await abrir();
    expect(aviso()).toBeNull();
    expect(screen.getByText("Todavía no llegó a nuestra bodega")).toBeInTheDocument();
    expect(screen.getByText("PA-0001")).toBeInTheDocument();
  });

  it("con una recepción real, el aviso convive con ella y no la tapa", async () => {
    h.recepcion = {
      recepciones: [
        {
          id: "r1",
          receiptCode: "WR-CN-0042",
          receivedAt: "2026-10-08",
          boxes: 4,
          cbm: 0.5,
          weightKg: 80,
          status: "pendiente_consolidacion",
          supplierName: null,
          enEmbarque: false,
          fotos: [],
        },
      ],
      cajasRecibidas: 4,
      cbmTotal: 0.5,
      pesoTotal: 80,
      primeraRecepcion: "2026-10-08",
    };
    await abrir();
    expect(aviso()).not.toBeNull();
    expect(screen.getByText("WR-CN-0042")).toBeInTheDocument();
    expect(screen.getByText("Llegaron las 4 cajas")).toBeInTheDocument();
  });
});
