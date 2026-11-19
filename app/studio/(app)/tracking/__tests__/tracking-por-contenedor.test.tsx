/**
 * SDD-0659 · Tracking por contenedor: la página real, con las consultas reales
 * sobre un doble que filtra.
 *
 * Todos los datos son inventados: los Shipping Marks van en el rango DTD-9xxx
 * para que no coincidan con ningún cliente real.
 *
 * Se mira lo que Sam pidió y lo que no se puede romper:
 *  - salen los contenedores, no los clientes uno por uno;
 *  - el envío sin contenedor no desaparece;
 *  - el buscador dice en qué contenedor viene un cliente;
 *  - una posición estimada se rotula como estimada y no hay velocidad;
 *  - al equipo de China (SDD-0531) no le llega ningún nombre: ni en «Quién
 *    viene adentro», ni en lo que cruza al panel, ni buscando por nombre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
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
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
// `scroll` se quita: no es un atributo de <a>.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown; scroll?: boolean }) => {
    const dom: Record<string, unknown> = { ...rest };
    delete dom.scroll;
    return (
      <a href={href} {...dom}>
        {children as never}
      </a>
    );
  },
}));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({
  contarAdjuntosDeEmbarques: async () => null,
}));

function capturar<P extends object>(nombre: string, Real: (p: P) => ReactElement | null) {
  return function Capturado(p: P) {
    h.props[nombre] = p;
    return <Real {...p} />;
  };
}
vi.mock("../_components/ContenedorPanel", async (original) => {
  const m = await original<typeof import("../_components/ContenedorPanel")>();
  return { ...m, ContenedorPanel: capturar("ContenedorPanel", m.ContenedorPanel) };
});
vi.mock("../_components/BuscadorTracking", async (original) => {
  const m = await original<typeof import("../_components/BuscadorTracking")>();
  return { ...m, BuscadorTracking: capturar("BuscadorTracking", m.BuscadorTracking) };
});
vi.mock("../_components/ContenedorList", async (original) => {
  const m = await original<typeof import("../_components/ContenedorList")>();
  return { ...m, ContenedorList: capturar("ContenedorList", m.ContenedorList) };
});

import TrackingPage from "../page";

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

const TABLAS = {
  shipments: [
    // Sin contenedor.
    envio({ id: "00000000-0000-4000-8000-0000000000a1", code: "S-2026-0042", client_name: "María Pérez", client_markbox: "DTD-9042" }),
    // Dentro del contenedor 64.
    envio({ id: "00000000-0000-4000-8000-0000000000a2", code: "S-2026-0043", client_name: "Comercial Rojas", client_markbox: "DTD-9077" }),
    // Ya entregado, en el contenedor 61.
    envio({
      id: "00000000-0000-4000-8000-0000000000a3",
      code: "S-2026-0010",
      client_name: "Comercial Rojas",
      client_markbox: "DTD-9077",
      status: "delivered",
    }),
  ],
  shipment_events: [
    { id: "e1", shipment_id: "00000000-0000-4000-8000-0000000000a2", status: "shipped", note: null, occurred_at: "2026-11-09T08:00:00Z", created_by: null, created_at: "2026-11-09T08:00:00Z" },
  ],
  consolidations: [
    { id: "00000000-0000-4000-8000-000000000c64", ref: "DTD-CONSOL-0064", booking_id: "b1", sailing_id: "sa1", container_type: "40HC", container_no: "DTDU6400183", status: "zarpado", updated_at: "2026-11-09T00:00:00Z", deleted_at: null },
    { id: "00000000-0000-4000-8000-000000000c66", ref: "DTD-CONSOL-0066", sailing_id: null, container_type: "40HC", container_no: null, status: "consolidando", updated_at: "2026-11-15T00:00:00Z", deleted_at: null },
    { id: "00000000-0000-4000-8000-000000000c61", ref: "DTD-CONSOL-0061", sailing_id: null, container_type: "40HC", container_no: "DTDU6100048", status: "arribado", updated_at: "2026-08-01T00:00:00Z", deleted_at: null },
    { id: "00000000-0000-4000-8000-000000000c99", ref: null, sailing_id: null, container_type: "40HC", container_no: null, status: "solicitada", updated_at: "2026-11-16T00:00:00Z", deleted_at: null },
  ],
  consolidation_items: [
    { id: "i1", consolidation_id: "00000000-0000-4000-8000-000000000c64", shipment_id: "00000000-0000-4000-8000-0000000000a2", client_markbox: "DTD-9077", client_name: "Comercial Rojas", cbm: 2.5, weight_kg: 300, pieces: 18, created_at: "2026-11-01T00:00:00Z" },
    { id: "i2", consolidation_id: "00000000-0000-4000-8000-000000000c64", shipment_id: null, client_markbox: "DTD-9100", client_name: "Ana Soto", cbm: 1.5, weight_kg: 120, pieces: 4, created_at: "2026-11-02T00:00:00Z" },
    { id: "i3", consolidation_id: "00000000-0000-4000-8000-000000000c61", shipment_id: "00000000-0000-4000-8000-0000000000a3", client_markbox: "DTD-9077", client_name: "Comercial Rojas", cbm: 3, weight_kg: 400, pieces: 25, created_at: "2026-07-01T00:00:00Z" },
  ],
  bookings: [
    { id: "b1", bl_number: "BLPRUEBA6620041", updated_at: "2026-11-05T00:00:00Z", deleted_at: null },
    { id: "b2", bl_number: null, updated_at: "2026-11-05T00:00:00Z", deleted_at: null },
  ],
  sailings: [
    { id: "sa1", vessel: "Buque de prueba", pol: "Ningbo", pod: "La Guaira", etd: "2026-11-08", eta: "2099-01-01" },
  ],
};

function sinDatosDelCliente(valor: unknown) {
  return datosDelClienteConValor(valor, CLAVES_DE_DATOS_DEL_CLIENTE);
}

async function pintar(
  membresia: typeof YIWU,
  params: Record<string, string> = {},
) {
  h.client = dobleSupabase({
    userId: "u1",
    tablas: { user_tenants: [membresia], ...TABLAS },
  }).client;
  render(await TrackingPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  h.props = {};
});
afterEach(cleanup);

describe("/studio/tracking por contenedor", () => {
  it("abre en «En mar» y lista contenedores, no clientes", async () => {
    await pintar(VALENCIA);
    const filtros = screen.getByRole("navigation", { name: "Filtrar por ubicación" });
    const chip = (nombre: RegExp) => within(filtros).getByRole("link", { name: nombre });
    expect(chip(/En mar\s*1/)).toHaveAttribute("aria-current", "true");
    expect(chip(/En origen\s*1/)).toBeInTheDocument();
    expect(chip(/En destino\s*0/)).toBeInTheDocument();
    expect(chip(/Sin contenedor\s*1/)).toBeInTheDocument();

    const lista = h.props.ContenedorList as { contenedores: { id: string }[] };
    expect(lista.contenedores.map((c) => c.id)).toEqual(["00000000-0000-4000-8000-000000000c64"]);
    expect(screen.getByRole("link", { name: "Abrir contenedor DTD-CONSOL-0064" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    // La solicitud sin autorizar y el contenedor ya entregado no salen.
    expect(document.body.textContent).not.toContain("DTD-CONSOL-0061");
    expect(JSON.stringify(h.props.ContenedorPanel)).not.toContain("00000000-0000-4000-8000-000000000c99");
  });

  it("el panel trae buque, ETA, carga y los clientes del contenedor", async () => {
    await pintar(VALENCIA);
    const panel = screen.getByRole("region", { name: "Contenedor DTD-CONSOL-0064" });
    expect(within(panel).getByText(/DTDU6400183 · 40HC · Buque de prueba/)).toBeInTheDocument();
    expect(within(panel).getByText("según el itinerario")).toBeInTheDocument();
    expect(within(panel).getByText("4 m³")).toBeInTheDocument();

    // «Quién viene adentro» dice clientes y cargas por separado.
    expect(panel.querySelector(".studio-tracking-ops-quien-sub")?.textContent).toBe(
      "2 clientes · 2 cargas · 4 m³",
    );

    const filas = [...panel.querySelectorAll<HTMLElement>("tbody tr")];
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByText("Comercial Rojas")).toBeInTheDocument();
    expect(within(filas[0]).getByRole("link", { name: "Abrir embarque S-2026-0043", hidden: true })).toHaveAttribute(
      "href",
      "/studio/tracking/00000000-0000-4000-8000-0000000000a2",
    );
    expect(within(filas[1]).getByText("Ana Soto")).toBeInTheDocument();
    expect(within(filas[1]).getByText("Sin envío enlazado")).toBeInTheDocument();
    // «Quién viene adentro» está cerrado hasta que se pide.
    expect(panel.querySelector("details")).not.toHaveAttribute("open");
  });

  it("una posición estimada se rotula como estimada, y no hay velocidad", async () => {
    await pintar(VALENCIA);
    expect(
      screen.getByText(/Posición estimada con las fechas del itinerario\. No es la ubicación real/),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bkn\b|km\/h|Velocidad/);
    // El hito cumplido lleva su fecha real; la llegada, la del plan.
    const hitos = screen.getByRole("list", { name: "Hitos del contenedor" });
    expect(within(hitos).getByText(/09 nov/)).toBeInTheDocument();
    expect(within(hitos).getByText(/\(plan\)/)).toBeInTheDocument();
  });

  it("el mapa muestra los demás contenedores como enlaces", async () => {
    await pintar(VALENCIA);
    const mapa = screen.getByRole("group", { name: /Mapa del Pacífico/ });
    expect(
      within(mapa).getByRole("link", { name: "Contenedor DTD-CONSOL-0066: Consolidando" }),
    ).toHaveAttribute("href", "/studio/tracking?g=origen&c=00000000-0000-4000-8000-000000000c66");
    // El elegido no es enlace a sí mismo.
    expect(within(mapa).queryByRole("link", { name: /DTD-CONSOL-0064/ })).toBeNull();
  });

  it("`?id=` de un envío con contenedor abre su contenedor con el envío resaltado", async () => {
    await pintar(VALENCIA, { id: "00000000-0000-4000-8000-0000000000a2" });
    const panel = screen.getByRole("region", { name: "Contenedor DTD-CONSOL-0064" });
    expect(panel.querySelector("details")).toHaveAttribute("open");
    expect(panel.querySelector('tr[data-resaltado="true"]')?.textContent).toContain("DTD-9077");
  });

  it("el envío sin contenedor sigue visible en «Sin contenedor»", async () => {
    await pintar(VALENCIA, { g: "sin" });
    expect(screen.getAllByText("S-2026-0042").length).toBeGreaterThan(0);
    expect(screen.getByText("María Pérez")).toBeInTheDocument();
    // El que ya va en un contenedor no se repite aquí.
    expect(screen.queryByText("S-2026-0043")).toBeNull();
    expect(
      screen.getByText(/Posición estimada por estado\. No es la ubicación real/),
    ).toBeInTheDocument();
  });

  it("`?id=` de un envío sin contenedor abre ese filtro", async () => {
    await pintar(VALENCIA, { id: "00000000-0000-4000-8000-0000000000a1" });
    const filtros = screen.getByRole("navigation", { name: "Filtrar por ubicación" });
    expect(within(filtros).getByRole("link", { name: /Sin contenedor/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("region", { name: "Envío S-2026-0042" })).toBeInTheDocument();
  });

  it("buscar un cliente dice en qué contenedor viene, incluido lo ya entregado", async () => {
    await pintar(VALENCIA, { q: "rojas" });
    const resultados = screen.getByRole("region", { name: "Resultados de «rojas»" });
    expect(within(resultados).getByRole("heading", { name: /Comercial Rojas/ })).toBeInTheDocument();
    const enlaces = within(resultados).getAllByRole("link");
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual([
      "/studio/tracking?c=00000000-0000-4000-8000-000000000c64&e=00000000-0000-4000-8000-0000000000a2",
      "/studio/tracking?c=00000000-0000-4000-8000-000000000c61&e=00000000-0000-4000-8000-0000000000a3",
    ]);
    expect(within(enlaces[0]).getByText("En tránsito")).toBeInTheDocument();
    expect(within(enlaces[1]).getByText("Entregado")).toBeInTheDocument();
  });

  it("buscar por número de contenedor lo encuentra, y `?c=` abre uno ya entregado", async () => {
    await pintar(VALENCIA, { q: "DTDU61" });
    const resultados = screen.getByRole("region", { name: "Resultados de «DTDU61»" });
    expect(within(resultados).getByRole("link")).toHaveAttribute("href", "/studio/tracking?c=00000000-0000-4000-8000-000000000c61");
    cleanup();

    await pintar(VALENCIA, { c: "00000000-0000-4000-8000-000000000c61" });
    expect(screen.getByRole("region", { name: "Contenedor DTD-CONSOL-0061" })).toBeInTheDocument();
  });

  it("buscar por BL encuentra el contenedor de esa reserva", async () => {
    await pintar(VALENCIA, { q: "blprueba66" });
    const resultados = screen.getByRole("region", { name: "Resultados de «blprueba66»" });
    const enlace = within(resultados).getByRole("link");
    expect(enlace).toHaveAttribute("href", "/studio/tracking?c=00000000-0000-4000-8000-000000000c64");
    expect(within(enlace).getByText("BL BLPRUEBA6620041")).toBeInTheDocument();
    expect(within(enlace).getByText("DTD-CONSOL-0064")).toBeInTheDocument();
  });

  it("un id de la URL que no es UUID se ignora: la página abre como sin él", async () => {
    await pintar(VALENCIA, { c: "no-es-un-uuid", id: "1 or 1=1", e: "x" });
    expect(screen.getByRole("region", { name: "Contenedor DTD-CONSOL-0064" })).toBeInTheDocument();
    const filtros = screen.getByRole("navigation", { name: "Filtrar por ubicación" });
    expect(within(filtros).getByRole("link", { name: /En mar/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("una búsqueda de un carácter no busca y lo dice", async () => {
    await pintar(VALENCIA, { q: "r" });
    expect(screen.getByText(/Escribe al menos 2 caracteres/)).toBeInTheDocument();
    expect((h.props.BuscadorTracking as { resultados: unknown }).resultados).toBeNull();
  });
});

describe("/studio/tracking por contenedor · equipo de China (SDD-0531)", () => {
  it("«Quién viene adentro» no recibe ni pinta nombres; pinta el Shipping Mark", async () => {
    await pintar(YIWU);
    const panel = h.props.ContenedorPanel as { nombresOcultos: boolean; contenedor: { items: unknown[] } };
    expect(panel.contenedor.items).toHaveLength(2);
    expect(sinDatosDelCliente(panel)).toEqual([]);
    expect(sinDatosDelCliente(h.props.ContenedorList)).toEqual([]);
    expect(panel.nombresOcultos).toBe(true);
    for (const nombre of ["Comercial Rojas", "Ana Soto", "María Pérez"]) {
      expect(JSON.stringify(h.props), nombre).not.toContain(nombre);
      expect(document.body.textContent, nombre).not.toContain(nombre);
    }
    expect(screen.getAllByText("DTD-9077").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sin cliente")).toBeNull();
  });

  it("buscar por nombre no encuentra nada; por Shipping Mark, sí y sin nombre", async () => {
    await pintar(YIWU, { q: "rojas" });
    expect(screen.getByText(/Nada coincide con «rojas»/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Buscar Shipping Mark, contenedor o BL…")).toBeInTheDocument();
    cleanup();

    await pintar(YIWU, { q: "DTD-9077" });
    const resultados = screen.getByRole("region", { name: "Resultados de «DTD-9077»" });
    expect(within(resultados).getAllByRole("link")).toHaveLength(2);
    expect(sinDatosDelCliente(h.props.BuscadorTracking)).toEqual([]);
    expect(JSON.stringify(h.props.BuscadorTracking)).not.toContain("Comercial Rojas");
    expect(document.body.textContent).not.toContain("Comercial Rojas");
  });

  it("buscar por BL funciona y tampoco trae nombres", async () => {
    await pintar(YIWU, { q: "BLPRUEBA66" });
    const resultados = screen.getByRole("region", { name: "Resultados de «BLPRUEBA66»" });
    expect(within(resultados).getByRole("link")).toHaveAttribute(
      "href",
      "/studio/tracking?c=00000000-0000-4000-8000-000000000c64",
    );
    expect(sinDatosDelCliente(h.props.BuscadorTracking)).toEqual([]);
    for (const nombre of ["Comercial Rojas", "Ana Soto"]) {
      expect(JSON.stringify(h.props), nombre).not.toContain(nombre);
      expect(document.body.textContent, nombre).not.toContain(nombre);
    }
  });
});
