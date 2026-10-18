/**
 * SDD-0516 · Portada del Portal: la tarjeta de notificaciones no promete el
 * aviso de llegada a bodega mientras el seguimiento está en construcción.
 *
 * La bodega de China todavía registra en Excel, así que el aviso «tu mercancía
 * llegó a bodega» no sale: sólo se programa cuando la recepción se registra en
 * el sistema. Con `TRACKING_EN_CONSTRUCCION` prendido, la tarjeta deja de
 * prometerlo y conserva lo demás; apagado, vuelve el texto de siempre.
 *
 * Se renderiza la página real con sus consultas simuladas. La tarjeta
 * `PortalPushOptIn` se reemplaza por una que pinta los textos que recibe: el
 * componente real no se pinta en jsdom (no hay soporte de push) y su forma de
 * mostrar `descripcion` no cambia en esta tarea. Lo que se prueba es qué le pasa
 * la portada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({ prendido: true }));

vi.mock("@/lib/portal/tracking-en-construccion", () => ({
  get TRACKING_EN_CONSTRUCCION() {
    return h.prendido;
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
// Sin `from`: las lecturas con el admin client van en try/catch y caen a su
// valor vacío, que es lo que la portada hace cuando fallan.
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
// SDD-0552: la portada resuelve el principal (cliente + tenant) de la sesión.
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => ({
    userId: "u1",
    tenantId: "t1",
    client: {
      id: "c1",
      markbox: "DTD-TEST",
      name: "Cliente Prueba",
      email: null,
      phone: null,
      address: null,
    },
  }),
  getPortalActivation: async () => ({ activated: true, reason: null }),
  getProfileCompleteness: async () => ({
    hasPhoto: true,
    hasAddress: true,
    complete: true,
  }),
  getDashboardKpis: async () => ({}),
  getNextArrival: async () => null,
  getPortalAdvisor: async () => null,
  listMyShipments: async () => [],
}));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  listPendingAcceptanceInvoices: async () => [],
}));
vi.mock("@/lib/portal/shipment-events-queries", () => ({
  listMyRecentActivity: async () => [],
}));
vi.mock("@/lib/portal/next-sailing-queries", () => ({
  getNextOpenSailing: async () => null,
  daysUntil: () => null,
}));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentNaviera: async () => null,
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("./_components/PortalDashboardNorte", () => ({
  PortalDashboardNorte: () => <div>Tablero del cliente</div>,
}));
vi.mock("./_components/PortalAdvisorCard", () => ({
  PortalAdvisorCard: () => null,
}));
vi.mock("../_components/PortalPushOptIn", () => ({
  PortalPushOptIn: (p: {
    titulo?: string;
    descripcion?: string;
    tituloActivo?: string;
    descripcionActiva?: string;
  }) => (
    <section aria-label="Tarjeta de notificaciones">
      <p>{p.titulo}</p>
      <p>{p.descripcion}</p>
      <p>{p.tituloActivo}</p>
      <p>{p.descripcionActiva}</p>
    </section>
  ),
}));

import PortalHomePage from "./page";

const DE_SIEMPRE =
  "Activa las notificaciones y tu navegador te avisa cuando tu mercancía llega a bodega, cuando zarpa y cuando está por entregarse — aunque no tengas el portal abierto.";
const SIN_BODEGA =
  "Activa las notificaciones y tu navegador te avisa cuando tu carga zarpa y cuando está por entregarse — aunque no tengas el portal abierto.";

async function abrir() {
  const ui = await PortalHomePage();
  render(ui!);
  return screen.getByRole("region", { name: "Tarjeta de notificaciones" });
}

beforeEach(() => {
  h.prendido = true;
});
afterEach(cleanup);

describe("/portal · tarjeta de notificaciones con el seguimiento en construcción (SDD-0516)", () => {
  it("prendido: no promete el aviso de llegada a bodega y conserva zarpe y entrega", async () => {
    const tarjeta = await abrir();
    expect(tarjeta.textContent).not.toMatch(/bodega/i);
    expect(screen.getByText(SIN_BODEGA)).toBeInTheDocument();
    expect(screen.queryByText(DE_SIEMPRE)).toBeNull();
    // El resto de la tarjeta y la portada no cambian.
    expect(screen.getByText("Entérate apenas se mueva tu carga")).toBeInTheDocument();
    expect(screen.getByText("Te avisamos apenas tu carga se mueva.")).toBeInTheDocument();
    expect(screen.getByText("Tablero del cliente")).toBeInTheDocument();
  });

  it("apagado: vuelve el texto de siempre, con el aviso de bodega", async () => {
    h.prendido = false;
    await abrir();
    expect(screen.getByText(DE_SIEMPRE)).toBeInTheDocument();
    expect(screen.queryByText(SIN_BODEGA)).toBeNull();
    expect(screen.getByText("Entérate apenas se mueva tu carga")).toBeInTheDocument();
  });
});
