/**
 * SDD-0514 · Aviso «Seguimiento en construcción».
 *
 * Lo que se prueba es la pantalla, no el componente suelto: con el interruptor
 * prendido el aviso aparece en la portada, en Envíos (lista y Seguimiento total)
 * y en el detalle de un envío; con el interruptor apagado desaparece de las
 * cuatro a la vez. Si una pantalla pintara su propio aviso sin pasar por
 * `TRACKING_EN_CONSTRUCCION`, el caso apagado la delata.
 *
 * Y el aviso se suma, no reemplaza: los hitos con fecha, la card de naviera, las
 * filas y el seguimiento por contenedor siguen ahí, debajo del aviso.
 *
 * El detalle de una compra se prueba aparte, en
 * `app/portal/(app)/compras/[code]/page.test.tsx`, porque es una página async
 * con sus consultas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AlertItem } from "@/lib/portal/alertas";
import type { TrackGroup } from "@/lib/portal/seguimiento";
import type {
  PortalClient,
  PortalDashboardKpis,
  PortalNextArrival,
  PortalShipmentDetail,
  PortalShipmentRow,
} from "@/lib/portal/portal-types";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";

// El interruptor real es una constante; acá se lee por getter para poder
// probar las dos posiciones sin tocar el archivo.
const interruptor = vi.hoisted(() => ({ prendido: true }));
vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return interruptor.prendido;
  },
}));

import { PortalTrackingEnConstruccion } from "../PortalTrackingEnConstruccion";
import { PortalAlertasHub } from "../../(app)/envios/_components/PortalAlertasHub";
import { PortalShipmentDetailNorte } from "../../(app)/envios/[code]/_components/PortalShipmentDetailNorte";
import { PortalDashboardNorte } from "../../(app)/_components/PortalDashboardNorte";

const TITULO = "Seguimiento en construcción";

beforeEach(() => {
  interruptor.prendido = true;
});
afterEach(cleanup);

/** El aviso, o null. Se busca por rol y por su título, no por clase. */
function aviso(): HTMLElement | null {
  return (
    screen
      .queryAllByRole("status")
      .find((el) => el.textContent?.includes(TITULO)) ?? null
  );
}

/** `a` aparece antes que `b` en el documento. */
function antes(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

// ── Fixtures ────────────────────────────────────────────────────

const prealerta: AlertItem = {
  key: "p:1",
  code: "DTD-TEST-1",
  stage: "prealerta",
  title: "Proveedor de prueba",
  meta: "2 cajas",
  sortAt: "2026-10-01",
  shipmentId: null,
  prealertaId: "1",
};

const enCamino: TrackGroup = {
  key: "s:1",
  kind: "solo",
  label: "ENV-0001",
  labelIsContainer: false,
  route: "Yiwu → Valencia",
  eta: null,
  progress: 60,
  items: [
    {
      id: "s1",
      code: "ENV-0001",
      progress: 60,
      statusLabel: "En tránsito",
      route: "Yiwu → Valencia",
    },
  ],
};

const envio: PortalShipmentDetail = {
  id: "s1",
  code: "ENV-0001",
  service: "consolidado_lcl",
  status: "in_transit",
  origin: "Yiwu, China",
  destination: "Valencia, Venezuela",
  volumeM3: 1.25,
  weightKg: 320,
  arrivedDestinationAt: null,
  createdAt: "2026-09-20T12:00:00Z",
  updatedAt: "2026-10-05T12:00:00Z",
};

/** Un hito real con fecha: lo que la operación sí registró. */
const FECHA_BODEGA = "2026-09-28T15:00:00Z";

const naviera: NavieraSnapshot = {
  consolidationRef: "DTD-CONSOL-0001",
  navieraStatus: "zarpado",
  containerNo: "COSU1234567",
  containerType: "40HC",
  blNumber: null,
  carrierName: "COSCO",
  carrierScac: null,
  vessel: "COSCO FORTUNE",
  voyage: "048W",
  pol: "NGB",
  pod: "PBL",
  etd: "2026-10-02",
  eta: "2026-11-10",
};

const cliente: PortalClient = {
  id: "c1",
  markbox: "DTD-TEST",
  name: "Cliente Prueba",
  email: null,
  phone: null,
  address: null,
  docKind: null,
  rif: null,
  city: null,
  state: null,
};

const kpis: PortalDashboardKpis = {
  activeShipments: 1,
  deliveredYtd: 0,
  invoicedTotal: 0,
  outstandingBalance: 0,
  currency: "USD",
  mixedCurrencies: false,
  pendingInvoiceCount: 0,
};

const proximo: PortalNextArrival = {
  id: "s1",
  code: "ENV-0001",
  service: "consolidado_lcl",
  status: "in_transit",
  origin: "Yiwu",
  destination: "Valencia",
  etaIso: null,
};

const fila: PortalShipmentRow = {
  id: "s1",
  code: "ENV-0001",
  service: "consolidado_lcl",
  status: "in_transit",
  origin: "Yiwu",
  destination: "Valencia",
  updatedAt: "2026-10-05T12:00:00Z",
};

// ── Montajes ────────────────────────────────────────────────────

function montarHub() {
  render(
    <PortalAlertasHub
      items={[prealerta]}
      docs={{}}
      trackGroups={[enCamino]}
      banner={null}
      markbox="DTD-TEST"
    />,
  );
}

function montarDetalle() {
  render(
    <PortalShipmentDetailNorte
      shipment={envio}
      documents={[]}
      signedUrls={{}}
      naviera={naviera}
      live={null}
      stepDates={{ in_warehouse: FECHA_BODEGA }}
    />,
  );
}

function montarPortada() {
  render(
    <PortalDashboardNorte
      client={cliente}
      kpis={kpis}
      nextArrival={proximo}
      nextArrivalNaviera={null}
      shipments={[fila]}
    />,
  );
}

// ── Casos ───────────────────────────────────────────────────────

describe("PortalTrackingEnConstruccion (SDD-0514)", () => {
  it("prendido: título, texto sin fecha prometida y enlace a Soporte, con rol status", () => {
    render(<PortalTrackingEnConstruccion />);
    const caja = aviso();
    expect(caja).not.toBeNull();
    expect(caja!.textContent).toContain(
      "Estamos activando el registro de tu mercancía en nuestra bodega de China.",
    );
    expect(caja!.textContent).toContain("Muy pronto vas a ver aquí cada paso de tu carga.");
    expect(caja!.textContent).toContain("Tus pre-alertas quedan guardadas");
    expect(within(caja!).getByRole("link", { name: /Escríbenos en Soporte/ })).toHaveAttribute(
      "href",
      "/portal/soporte",
    );
  });

  it("apagado: no deja rastro", () => {
    interruptor.prendido = false;
    const { container } = render(<PortalTrackingEnConstruccion />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Envíos · lista (SDD-0514)", () => {
  it("prendido: el aviso aparece y las filas siguen debajo", () => {
    montarHub();
    const caja = aviso();
    expect(caja).not.toBeNull();
    const filaPrealerta = screen.getByText("DTD-TEST-1");
    expect(antes(caja!, filaPrealerta)).toBe(true);
  });

  it("apagado: sin aviso y con las mismas filas", () => {
    interruptor.prendido = false;
    montarHub();
    expect(aviso()).toBeNull();
    expect(screen.getByText("DTD-TEST-1")).toBeInTheDocument();
  });
});

describe("Envíos · Seguimiento total (SDD-0514)", () => {
  it("prendido: el aviso aparece y el envío en camino se sigue viendo con su avance", async () => {
    montarHub();
    await userEvent.click(screen.getByRole("button", { name: /Seguimiento total/ }));
    const caja = aviso();
    expect(caja).not.toBeNull();
    const barra = screen.getByRole("progressbar", { name: "60% del viaje" });
    expect(screen.getByRole("link", { name: /ENV-0001/ })).toHaveAttribute(
      "href",
      "/portal/envios/ENV-0001",
    );
    expect(antes(caja!, barra)).toBe(true);
  });

  it("apagado: sin aviso y con el mismo seguimiento", async () => {
    interruptor.prendido = false;
    montarHub();
    await userEvent.click(screen.getByRole("button", { name: /Seguimiento total/ }));
    expect(aviso()).toBeNull();
    expect(screen.getByRole("progressbar", { name: "60% del viaje" })).toBeInTheDocument();
  });
});

describe("Detalle de un envío (SDD-0514)", () => {
  const fechaHito = new Date(FECHA_BODEGA).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });

  it("prendido: el aviso va arriba del stepper y no tapa los hitos reales ni la naviera", () => {
    montarDetalle();
    const caja = aviso();
    expect(caja).not.toBeNull();
    const seguimiento = screen.getByRole("heading", { name: "Seguimiento" });
    expect(antes(caja!, seguimiento)).toBe(true);
    // El hito real con su fecha sigue en el stepper.
    const tarjeta = seguimiento.parentElement!;
    expect(within(tarjeta).getByText("En bodega")).toBeInTheDocument();
    expect(within(tarjeta).getByText(fechaHito)).toBeInTheDocument();
    // Y la card de naviera con el buque real.
    expect(screen.getByText("COSCO FORTUNE · 048W")).toBeInTheDocument();
  });

  it("apagado: sin aviso y con el mismo stepper", () => {
    interruptor.prendido = false;
    montarDetalle();
    expect(aviso()).toBeNull();
    const tarjeta = screen.getByRole("heading", { name: "Seguimiento" }).parentElement!;
    expect(within(tarjeta).getByText(fechaHito)).toBeInTheDocument();
  });
});

describe("Portada (SDD-0514)", () => {
  it("prendido: el aviso aparece y el próximo arribo y Tus envíos se siguen viendo", () => {
    montarPortada();
    const caja = aviso();
    expect(caja).not.toBeNull();
    const heroe = screen.getByRole("link", { name: "Ver detalle del próximo arribo ENV-0001" });
    expect(antes(caja!, heroe)).toBe(true);
    expect(screen.getByText("Tus envíos")).toBeInTheDocument();
    expect(screen.getAllByText("ENV-0001").length).toBeGreaterThanOrEqual(2);
  });

  it("apagado: sin aviso y con el mismo tablero", () => {
    interruptor.prendido = false;
    montarPortada();
    expect(aviso()).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ver detalle del próximo arribo ENV-0001" }),
    ).toBeInTheDocument();
  });
});
