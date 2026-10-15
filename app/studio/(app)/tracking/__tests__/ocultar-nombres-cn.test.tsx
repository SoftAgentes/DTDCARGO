/**
 * SDD-0531 · Tracking no le entrega nombres de clientes al equipo de China.
 *
 * Se renderizan las páginas reales (lista y detalle) con las consultas reales
 * sobre un doble que filtra, una vez como usuario de Yiwu (región cn,
 * operations) y otra como usuario de Valencia. Se mira:
 *
 *  - lo que se pinta: el nombre y la ubicación de entrega no aparecen para
 *    China, el Shipping Mark sí; para Venezuela todo sigue igual;
 *  - lo que cruza a los componentes de cliente (lo que se serializa hacia el
 *    navegador): ninguna clave de datos del cliente con valor, a ninguna
 *    profundidad — no basta con que no se vea;
 *  - la búsqueda: escribir el nombre no encuentra nada, el Shipping Mark sí.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import {
  datosDelClienteConValor,
  dobleSupabase,
} from "@/lib/studio/__tests__/privacidad-cn-double";
import { CLAVES_DE_DATOS_DEL_CLIENTE } from "@/lib/studio/privacidad-cn";

const h = vi.hoisted(() => ({
  client: null as unknown,
  props: {} as Record<string, unknown>,
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => h.client }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: async () => "operations",
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...(rest as object)}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({
  contarAdjuntosDeEmbarques: async () => null,
}));
vi.mock("@/lib/studio/shipment-document-queries", () => ({
  listShipmentDocuments: async () => [],
  signDocumentUrls: async () => ({}),
}));
vi.mock("@/lib/studio/documents/queries", () => ({
  listDocumentsByEntity: async () => [],
}));
vi.mock("@/lib/auth/session", () => ({
  getUser: async () => null,
  getUserTenantId: async () => "t1",
}));
vi.mock("@/lib/studio/comments/comments-queries", () => ({
  listComments: async () => [],
  loadTenantUsers: async () => [],
}));
// Las acciones no corren en estas pruebas: se reemplazan para que importar el
// panel no arrastre el servidor de correo ni el admin client.
vi.mock("../[id]/actions", () => ({
  updateShipment: vi.fn(async () => ({ ok: true })),
  changeDestination: vi.fn(),
  lookupRateForNewDestination: vi.fn(),
}));
vi.mock("../[id]/datos-reservados-actions", () => ({
  updateShipmentSinUbicacion: vi.fn(async () => ({ ok: true })),
}));
// Paneles de cliente que no tocan datos del cliente: fuera, para no montar sus
// dependencias.
vi.mock("../[id]/_components/StateActionsPanel", () => ({ StateActionsPanel: () => null }));
vi.mock("../[id]/_components/TimelinePanel", () => ({ TimelinePanel: () => null }));
vi.mock("../[id]/_components/FooterActions", () => ({ FooterActions: () => null }));
vi.mock("../[id]/_components/ShipmentDocsPanel", () => ({ ShipmentDocsPanel: () => null }));
vi.mock("@/app/studio/_components/documents/DocsPanel", () => ({ DocsPanel: () => null }));
vi.mock("@/app/studio/(app)/_components/comments/CommentsThread", () => ({
  CommentsThread: () => null,
}));

/**
 * Componentes de cliente que SÍ reciben el envío: se envuelven para guardar
 * sus props (lo que viajaría al navegador) y se renderizan los reales.
 */
function capturar<P extends object>(
  nombre: string,
  Real: (p: P) => ReactElement | null,
) {
  return function Capturado(p: P) {
    h.props[nombre] = p;
    return <Real {...p} />;
  };
}
vi.mock("../_components/ActiveShipmentList", async (original) => {
  const m = await original<typeof import("../_components/ActiveShipmentList")>();
  return { ...m, ActiveShipmentList: capturar("ActiveShipmentList", m.ActiveShipmentList) };
});
vi.mock("../[id]/_components/ShipmentDataPanel", async (original) => {
  const m = await original<typeof import("../[id]/_components/ShipmentDataPanel")>();
  return { ...m, ShipmentDataPanel: capturar("ShipmentDataPanel", m.ShipmentDataPanel) };
});
vi.mock("../[id]/_components/ShipmentPlanPanel", () => ({
  ShipmentPlanPanel: (p: object) => {
    h.props.ShipmentPlanPanel = p;
    return null;
  },
}));
// El envío seleccionado de la lista hoy va sólo a componentes de servidor, que
// no pintan el nombre. Se miran igual: el contrato es que la página les entrega
// el envío ya oculto, para que convertir uno en componente de cliente mañana no
// abra la fuga sin que nada falle.
vi.mock("../_components/TrackingMap", async (original) => {
  const m = await original<typeof import("../_components/TrackingMap")>();
  return { ...m, TrackingMap: capturar("TrackingMap", m.TrackingMap) };
});
vi.mock("../_components/TrackingTimeline", async (original) => {
  const m = await original<typeof import("../_components/TrackingTimeline")>();
  return { ...m, TrackingTimeline: capturar("TrackingTimeline", m.TrackingTimeline) };
});
vi.mock("../_components/TrackingDetailActions", async (original) => {
  const m = await original<typeof import("../_components/TrackingDetailActions")>();
  return {
    ...m,
    TrackingDetailActions: capturar("TrackingDetailActions", m.TrackingDetailActions),
  };
});

import TrackingPage from "../page";
import ShipmentDetailPage from "../[id]/page";

const YIWU = { user_id: "u1", tenant_id: "t1", region: "cn", role: "operations", disabled_at: null };
const VALENCIA = { ...YIWU, region: "ve" };

function envio(over: Record<string, unknown>) {
  return {
    tenant_id: "t1",
    origin: "Yiwu",
    destination: "Valencia",
    destination_gps: null,
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    weight_kg: 100,
    volume_m3: 1.2,
    vehicle_category: null,
    vehicle_model: null,
    arrived_destination_at: null,
    planned_departure_at: null,
    planned_arrival_at: null,
    planned_delivery_at: null,
    planning_timezone: "America/Caracas",
    planning_version: 1,
    planning_updated_at: null,
    planning_updated_by: null,
    cancellation_reason: null,
    notes: null,
    deleted_at: null,
    created_at: "2026-10-10T12:00:00Z",
    updated_at: "2026-10-12T12:00:00Z",
    ...over,
  };
}

const ENVIOS = [
  envio({
    id: "s1",
    code: "S-2026-0042",
    client_name: "María Pérez",
    client_markbox: "DTD-0042",
    shipment_service: "transporte_terrestre",
    vehicle_category: "camion_chico",
    destination_gps: "10.1620, -68.0077",
    created_at: "2026-10-12T12:00:00Z",
  }),
  envio({
    id: "s2",
    code: "S-2026-0043",
    client_name: "Comercial Rojas",
    client_markbox: "DTD-0077",
    created_at: "2026-10-11T12:00:00Z",
  }),
];

function sembrar(membresia: typeof YIWU) {
  h.client = dobleSupabase({
    userId: "u1",
    tablas: { user_tenants: [membresia], shipments: ENVIOS, shipment_events: [] },
  }).client;
}

function sinDatosDelCliente(valor: unknown) {
  return datosDelClienteConValor(valor, CLAVES_DE_DATOS_DEL_CLIENTE);
}

beforeEach(() => {
  h.props = {};
});
afterEach(cleanup);

describe("/studio/tracking (lista)", () => {
  async function pintar(membresia: typeof YIWU) {
    sembrar(membresia);
    render(await TrackingPage({ searchParams: Promise.resolve({}) }));
  }

  it("China: la lista no recibe ni pinta nombres; pinta el Shipping Mark", async () => {
    await pintar(YIWU);
    const lista = h.props.ActiveShipmentList as ComponentProps<
      typeof import("../_components/ActiveShipmentList").ActiveShipmentList
    >;
    expect(sinDatosDelCliente(lista)).toEqual([]);
    expect(JSON.stringify(lista)).not.toContain("María Pérez");
    expect(JSON.stringify(lista)).not.toContain("Comercial Rojas");
    expect(lista.nombresOcultos).toBe(true);
    expect(screen.queryByText("María Pérez")).toBeNull();
    expect(screen.queryByText("Comercial Rojas")).toBeNull();
    expect(screen.queryByText("Sin cliente")).toBeNull();
    expect(screen.getByText("DTD-0077")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("María Pérez");
  });

  it("China: el envío seleccionado llega oculto a cada componente del detalle", async () => {
    await pintar(YIWU);
    for (const hijo of ["TrackingMap", "TrackingTimeline", "TrackingDetailActions"]) {
      const p = h.props[hijo] as { shipment: { code: string } };
      expect(p.shipment.code, hijo).toBe("S-2026-0042");
      expect(sinDatosDelCliente(p), hijo).toEqual([]);
      expect(JSON.stringify(p), hijo).not.toContain("10.1620");
      expect(JSON.stringify(p), hijo).not.toContain("María Pérez");
    }
  });

  it("China: buscar por el nombre no encuentra el envío; por el Shipping Mark, sí", async () => {
    await pintar(YIWU);
    const buscador = screen.getByPlaceholderText("Buscar embarque…");

    fireEvent.change(buscador, { target: { value: "Rojas" } });
    expect(screen.getByText("Ningún envío coincide con la búsqueda.")).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "DTD-0077" } });
    expect(screen.getByText("S-2026-0043")).toBeInTheDocument();
    expect(screen.queryByText("Ningún envío coincide con la búsqueda.")).toBeNull();
  });

  it("Venezuela: la lista sigue con nombres y la búsqueda por nombre funciona", async () => {
    await pintar(VALENCIA);
    const lista = h.props.ActiveShipmentList as { shipments: { client_name: string | null }[] };
    expect(lista.shipments.map((s) => s.client_name)).toEqual(["María Pérez", "Comercial Rojas"]);
    expect(screen.getByText("Comercial Rojas")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar embarque…"), {
      target: { value: "Rojas" },
    });
    expect(screen.getByText("S-2026-0043")).toBeInTheDocument();
  });
});

describe("/studio/tracking/[id] (detalle)", () => {
  async function pintar(membresia: typeof YIWU) {
    sembrar(membresia);
    render(await ShipmentDetailPage({ params: Promise.resolve({ id: "s1" }) }));
  }

  it("China: el envío cruza a los paneles sin nombre ni ubicación", async () => {
    await pintar(YIWU);
    // Que los paneles se montaron con ESTE envío: si no, la aserción de abajo
    // pasaría sobre nada.
    for (const panel of ["ShipmentDataPanel", "ShipmentPlanPanel"]) {
      expect((h.props[panel] as { shipment: { code: string } }).shipment.code).toBe("S-2026-0042");
    }
    expect(sinDatosDelCliente(h.props.ShipmentDataPanel)).toEqual([]);
    expect(sinDatosDelCliente(h.props.ShipmentPlanPanel)).toEqual([]);
    // Por VALOR, además de por clave: no depende del conjunto que se prueba.
    for (const panel of ["ShipmentDataPanel", "ShipmentPlanPanel"]) {
      const serializado = JSON.stringify(h.props[panel]);
      expect(serializado, panel).not.toContain("María Pérez");
      expect(serializado, panel).not.toContain("10.1620");
    }
    expect((h.props.ShipmentDataPanel as { nombresOcultos: boolean }).nombresOcultos).toBe(true);
  });

  it("China: no pinta el nombre ni la ubicación; el encabezado muestra el Shipping Mark", async () => {
    await pintar(YIWU);
    const texto = document.body.textContent ?? "";
    expect(texto).not.toContain("María Pérez");
    expect(texto).not.toContain("10.1620");
    expect(document.querySelector("#client_name")).toBeNull();
    expect(document.querySelector("#destination_gps")).toBeNull();
    expect(screen.getByText("La ubicación de entrega no se muestra en tu región.", { exact: false }))
      .toBeInTheDocument();
    // El Shipping Mark sigue: en el encabezado y en su campo bloqueado.
    expect(screen.getByText("DTD-0042", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("Shipping Mark", { exact: false })).toHaveValue("DTD-0042");
  });

  it("Venezuela: el detalle sigue igual que antes", async () => {
    await pintar(VALENCIA);
    const datos = h.props.ShipmentDataPanel as { shipment: Record<string, unknown> };
    expect(datos.shipment.client_name).toBe("María Pérez");
    expect(datos.shipment.destination_gps).toBe("10.1620, -68.0077");
    expect(screen.getByText("María Pérez")).toBeInTheDocument();
    expect(document.querySelector("#client_name")).toHaveValue("María Pérez");
    expect(document.querySelector("#destination_gps")).toHaveValue("10.1620, -68.0077");
    const ayuda = screen.getByText(
      "Cliente y Shipping Mark vienen de la base de clientes — no se editan acá.",
    );
    expect(within(ayuda.parentElement as HTMLElement).queryByText(/tu región/)).toBeNull();
  });
});
