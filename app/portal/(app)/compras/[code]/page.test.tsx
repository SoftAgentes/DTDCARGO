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
 *
 * SDD-0516 · con el mismo interruptor prendido, la pantalla tampoco promete
 * avisos ni recepciones automáticas que hoy no van a llegar («Te avisamos
 * apenas…», «verás acá cada recepción»): dice una frase neutra. Apagado, vuelve
 * el texto de siempre, palabra por palabra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

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

// SDD-0516 · lo que dice la pantalla de una compra sin recepciones, en las dos
// posiciones del interruptor. La compra simulada anuncia 4 cajas.
const NEUTRO = {
  titulo: "La llegada a bodega todavía no aparece aquí",
  detalle:
    "Anunciaste 4 cajas. Mientras activamos el seguimiento, nuestro equipo en China lleva el control de cada recepción. Para saber si ya llegó, escríbenos en Soporte.",
  recepcion:
    "Las recepciones de esta compra todavía no aparecen aquí mientras activamos el seguimiento.",
};
const DE_SIEMPRE = {
  titulo: "Todavía no llegó a nuestra bodega",
  detalle: "Anunciaste 4 cajas. Te avisamos apenas el proveedor entregue en Yiwu.",
  recepcion:
    "Todavía no registramos la llegada de esta compra a nuestra bodega en Yiwu. Cuando el proveedor entregue, verás acá cada recepción con su fecha, sus cajas y las medidas reales.",
};
/**
 * Cualquier promesa de aviso o de recepción automática, en cualquier parte de
 * la pantalla. Se mira el texto completo y no un nodo: una promesa nueva en
 * otro lugar también cuenta.
 */
const PROMESA = /te avisamos|te notificamos|te avisaremos|verás acá cada recepción/i;

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
    // SDD-0516 · con el interruptor prendido, el estado de llegada lleva el
    // título neutro; la posición del aviso es la misma.
    const llegada = screen.getByText(NEUTRO.titulo);
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
    // SDD-0516 · la frase neutra es sólo para la compra sin recepciones: con
    // una recepción real, el detalle de llegada es el de siempre y la tarjeta
    // de recepción muestra la recepción, no el texto de espera.
    expect(
      screen.getByText("Recibidas en nuestra bodega de Yiwu el 8 oct 2026."),
    ).toBeInTheDocument();
    expect(screen.queryByText(NEUTRO.titulo)).toBeNull();
    expect(screen.queryByText(NEUTRO.recepcion)).toBeNull();
  });
});

describe("/portal/compras/[code] sin promesas de aviso mientras el seguimiento está en construcción (SDD-0516)", () => {
  it("prendido: no promete avisos ni recepciones automáticas y dice la frase neutra", async () => {
    await abrir();
    expect(document.body.textContent).not.toMatch(PROMESA);
    expect(screen.queryByText(DE_SIEMPRE.titulo)).toBeNull();
    expect(screen.queryByText(DE_SIEMPRE.detalle)).toBeNull();
    expect(screen.queryByText(DE_SIEMPRE.recepcion)).toBeNull();

    expect(screen.getByText(NEUTRO.titulo)).toBeInTheDocument();
    expect(screen.getByText(NEUTRO.detalle)).toBeInTheDocument();
    expect(screen.getByText(NEUTRO.recepcion)).toBeInTheDocument();
  });

  it("prendido: la frase neutra queda en el estado de llegada y en la tarjeta de recepción, debajo del aviso", async () => {
    await abrir();
    const caja = aviso();
    expect(caja).not.toBeNull();
    // El detalle va en el mismo bloque que su título, y la tarjeta de
    // recepción conserva su encabezado: se suaviza el texto, no se mueve nada.
    const titulo = screen.getByText(NEUTRO.titulo);
    const bloque = titulo.parentElement!;
    expect(within(bloque).getByText(NEUTRO.detalle)).toBeInTheDocument();
    const tarjeta = screen.getByRole("heading", { name: "Recepción en bodega (China)" })
      .parentElement!;
    expect(within(tarjeta).getByText(NEUTRO.recepcion)).toBeInTheDocument();
    expect(
      caja!.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("apagado: vuelve el texto de siempre, con su promesa", async () => {
    h.prendido = false;
    await abrir();
    expect(screen.getByText(DE_SIEMPRE.titulo)).toBeInTheDocument();
    expect(screen.getByText(DE_SIEMPRE.detalle)).toBeInTheDocument();
    expect(screen.getByText(DE_SIEMPRE.recepcion)).toBeInTheDocument();

    expect(screen.queryByText(NEUTRO.titulo)).toBeNull();
    expect(screen.queryByText(NEUTRO.detalle)).toBeNull();
    expect(screen.queryByText(NEUTRO.recepcion)).toBeNull();
  });
});
