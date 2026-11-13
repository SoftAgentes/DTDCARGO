/**
 * SDD-0627 · la página real del detalle: la nota del stepper y la tarjeta
 * Naviera muestran la MISMA llegada a puerto. SeaRates cuenta sólo si su última
 * consulta salió bien (`fetchStatus === "ok"`); con la consulta en error, las
 * dos caen al itinerario. Si la ETA ya pasó, las dos dicen «por confirmar».
 *
 * Se monta `page.tsx` entero (no el componente suelto): si alguien vuelve a
 * tomar `live.podEta` sin el filtro en la página, esta prueba falla.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { TrackingSnapshotRow } from "@/lib/studio/naviera-tracking/snapshot-queries";
import type { NavieraSnapshot } from "@/lib/studio/naviera-tracking/types";

const h = vi.hoisted(() => ({
  naviera: null as unknown,
  live: null as unknown,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ cliente: "sesion" }) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({ cliente: "admin" }) }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => null,
  getMyShipment: async (_db: unknown, code: string) => ({
    id: "ship-a",
    code,
    service: "consolidado_lcl",
    status: "in_transit",
    origin: null,
    destination: null,
    volumeM3: null,
    weightKg: null,
    arrivedDestinationAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
  }),
}));
vi.mock("@/lib/studio/notifications/portal-visibility-queries", () => ({
  getHiddenPortalStatusesForPortal: async () => new Set(),
}));
vi.mock("@/lib/portal/shipment-events-queries", () => ({
  listMyShipmentEvents: async () => [],
  stepDatesFromEvents: () => ({
    shipped: "2026-11-01T12:00:00Z",
    in_transit: "2026-11-02T12:00:00Z",
  }),
}));
vi.mock("@/lib/studio/notifications/notification-history-queries", () => ({
  listShipmentNotificationHistory: async () => [],
}));
vi.mock("@/lib/portal/demo", () => ({ showShipmentAcceptanceCta: () => false }));
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  getPendingAcceptanceForShipment: async () => null,
}));
vi.mock("@/lib/studio/shipment-document-queries", () => ({
  listShipmentDocuments: async () => [],
  signDocumentUrls: async () => ({}),
}));
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentNaviera: async () => h.naviera,
  getShipmentTrackingSnapshot: async () => h.live,
}));

import PortalShipmentDetailPage from "../page";

function naviera(eta: string | null): NavieraSnapshot {
  return {
    consolidationRef: "DTD-CONSOL-0001",
    navieraStatus: "zarpado",
    containerNo: "TEST1234567",
    containerType: "40HC",
    blNumber: null,
    carrierName: "Naviera de prueba",
    carrierScac: null,
    vessel: "BUQUE DE PRUEBA",
    voyage: "001W",
    pol: "SHA",
    pod: "LGU",
    etd: "2026-11-01",
    eta,
    transitDays: 60,
  };
}

function live(fetchStatus: string, podEta: string | null): TrackingSnapshotRow {
  return {
    id: "snap-1",
    consolidationId: "con-1",
    number: "TEST1234567",
    numberType: "CT",
    sealine: null,
    sealineName: null,
    status: null,
    vessel: null,
    polDate: null,
    polActual: null,
    podEta,
    podActual: null,
    lastLat: null,
    lastLng: null,
    milestones: [],
    fetchStatus,
    errorCode: fetchStatus === "ok" ? null : "TIMEOUT",
    apiRemaining: null,
    fetchedAt: "2026-11-10T00:00:00Z",
  };
}

async function montar() {
  render(await PortalShipmentDetailPage({ params: Promise.resolve({ code: "ENV-0001" }) }));
  const nota = screen.getByTestId("seguimiento-estimado-nota").textContent ?? "";
  const tarjeta = screen.getByText("Arribo a puerto (ETA)").parentElement?.textContent ?? "";
  return { nota, tarjeta };
}

beforeEach(() => {
  h.naviera = null;
  h.live = null;
});
afterEach(cleanup);

describe("SDD-0627 · una sola llegada a puerto en la página", () => {
  it("SeaRates en ok: nota y tarjeta usan su ETA", async () => {
    h.naviera = naviera("2099-05-20");
    h.live = live("ok", "2099-03-10T12:00:00Z");
    const { nota, tarjeta } = await montar();
    expect(nota).toMatch(/Llegada a puerto según la naviera: 10 mar/);
    expect(nota).toMatch(/2099/);
    expect(nota).not.toMatch(/may/);
    expect(tarjeta).toMatch(/10 mar/);
    expect(tarjeta).toMatch(/Confirmada por la naviera/);
  });

  it("SeaRates en error: las dos ignoran su ETA vieja y usan la del itinerario", async () => {
    h.naviera = naviera("2099-05-20");
    h.live = live("error", "2099-03-10T12:00:00Z");
    const { nota, tarjeta } = await montar();
    expect(nota).toMatch(/Llegada a puerto según la naviera: 20 may/);
    expect(nota).not.toMatch(/mar\.? 2099/);
    expect(tarjeta).toMatch(/20 may/);
    expect(tarjeta).not.toMatch(/10 mar/);
    expect(tarjeta).toMatch(/Estimada por la naviera/);
  });

  it("ETA de la naviera ya pasada: nota y tarjeta dicen «por confirmar», nunca «Confirmada»", async () => {
    h.naviera = naviera("2020-01-15");
    h.live = live("ok", "2020-01-15T12:00:00Z");
    const { nota, tarjeta } = await montar();
    expect(nota).toMatch(/La llegada a puerto está por confirmar/);
    expect(tarjeta).toMatch(/por confirmar/);
    expect(tarjeta).not.toMatch(/Confirmada por la naviera/);
  });

  it("B2 · una `date` pura del itinerario no se corre al día anterior en Caracas", async () => {
    h.naviera = naviera("2099-12-01");
    const { tarjeta } = await montar();
    expect(tarjeta).toMatch(/01 dic/);
    expect(tarjeta).not.toMatch(/30 nov/);
  });
});
