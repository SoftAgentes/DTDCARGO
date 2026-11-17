/**
 * SDD-0650 F1 · La página de la ficha del cliente.
 *
 * Se monta la página real con sus lecturas dobladas y las tarjetas hijas en
 * stubs. `ClientDetailClient` es el real: ahí viven los botones. Lo que se mide:
 *   - «Abrir chat» solo con Bandeja Y al menos una conversación;
 *   - «Cotizaciones» solo con el módulo `quotes`;
 *   - «Sin nombre» con nombre vacío o de espacios;
 *   - si la cadena de códigos falla, los envíos salen del código vigente.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  nombre: "Cliente sintético" as string | null,
  modulos: [] as string[],
  conversaciones: [] as { conversation_id: number; status: string; unread_count: number; last_activity_at: string | null }[],
  cadenaFalla: false,
  codigos: ["DTD-8001", "DTD-0457"] as string[],
  codigosPedidos: [] as string[][],
}));

// Los factories de vi.mock se elevan al tope del archivo: lo que usan tiene que
// venir de vi.hoisted, no de una constante de nivel superior.
const { nada } = vi.hoisted(() => ({ nada: () => null }));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { tenant_id: "t1" }, error: null }),
    };
    return { from: () => chain, storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } };
  },
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/client-queries", () => ({
  getClientByMarkbox: async () => ({
    id: "c1", tenant_id: "t1", markbox: "DTD-8001", name: state.nombre, doc_kind: null, tier: "nuevo",
    email: null, phone: null, address: null, rif: null, notes: null, advisor_id: null,
    registration_channel: "studio", cedula_photo_path: null, created_at: "2026-10-01T00:00:00Z",
  }),
  listCodigosDeLaFicha: async () => {
    if (state.cadenaFalla) throw new Error("sin red");
    return state.codigos;
  },
  listShipmentsDeLaFicha: async (_s: unknown, _tenant: string, codigos: string[]) => {
    state.codigosPedidos.push([...codigos]);
    return [];
  },
  getClientPortalAccess: async () => null,
  getClientPortalApprovedAt: async () => null,
  getClientAccountState: async () => ({ tipo: "sin_permiso" }),
}));
vi.mock("@/lib/studio/client-account", () => ({
  puedeVerEstadoDeCuenta: () => false,
  puedeVerSaldoCliente: () => false,
}));
vi.mock("@/lib/studio/user-queries", () => ({ listTenantAdvisors: async () => [] }));
vi.mock("@/lib/studio/client-types", () => ({
  clientCompleteness: () => ({ isComplete: true, doneCount: 1, total: 1, pct: 100, items: [] }),
  docKindLabel: () => "Persona",
  tierBadgeTone: () => "neutral",
  tierLabel: () => "Nuevo",
}));
vi.mock("@/lib/studio/identity", () => ({ isAutoVerifyEnabled: () => false }));
vi.mock("@/lib/studio/aliados/aliado-queries", () => ({
  getAliadoByClientId: async () => null,
  listAliadoOptions: async () => [],
}));
vi.mock("@/lib/studio/price-books/price-book-queries", () => ({ listPriceBooks: async () => [] }));
vi.mock("@/lib/studio/markbox-history-queries", () => ({ listMarkboxHistory: async () => [] }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioAccess: async () => ({ role: "commercial", overrides: {}, grants: [], userId: "u1" }),
}));
vi.mock("@/lib/studio/rbac", () => ({
  canAccessModule: (_rol: unknown, modulo: string) => state.modulos.includes(modulo),
  canEditModule: () => false,
}));
vi.mock("@/lib/studio/feature-flags-queries", () => ({ listFeatureFlags: async () => [] }));
vi.mock("@/lib/studio/feature-flags-types", () => ({ isModuleEnabled: () => true }));
vi.mock("@/lib/studio/chatwoot/conversations-queries", () => ({
  listConversacionesDeCliente: async () => state.conversaciones,
}));
vi.mock("@/lib/studio/client-address-queries", () => ({ listClientDeliveryAddresses: async () => [] }));
vi.mock("@/lib/public/rates-queries", () => ({
  getPublicCalculatorCities: async () => [],
  getPublicCarrierTariffs: async () => [],
  combinarDestinos: () => [],
}));
vi.mock("@/lib/studio/documents/queries", () => ({ listDocumentsByEntity: async () => [] }));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({ listarAdjuntosDelCliente: async () => null }));
vi.mock("@/lib/portal/change-request-queries", () => ({
  getOpenChangeRequest: async () => null,
  listResolvedChangeRequests: async () => [],
  resolveReviewerNames: async () => ({}),
}));

// Tarjetas hijas: fuera del alcance de esta prueba.
vi.mock("../_components/ClientDrawer", () => ({ ClientDrawer: nada }));
vi.mock("../_components/ClientAccountHeader", () => ({ ClientAccountHeader: nada }));
vi.mock("../_components/PortalAccessCard", () => ({ PortalAccessCard: nada }));
vi.mock("../_components/AdvisorAssignCard", () => ({ AdvisorAssignCard: nada }));
vi.mock("../_components/AliadoCard", () => ({ AliadoCard: nada }));
vi.mock("../_components/ShippingMarkChip", () => ({ ShippingMarkChip: nada }));
vi.mock("../_components/ChatwootConversacionesCard", () => ({ ChatwootConversacionesCard: nada }));
vi.mock("../_components/DeliveryAddressesCard", () => ({ DeliveryAddressesCard: nada }));
vi.mock("../_components/IdentityVerificationCard", () => ({ IdentityVerificationCard: nada }));
vi.mock("../_components/ClientBillingCard", () => ({ ClientBillingCard: nada }));
vi.mock("../_components/TodosLosAdjuntos", () => ({ TodosLosAdjuntos: nada }));
vi.mock("../_components/ChangeRequestCard", () => ({ ChangeRequestCard: nada }));
vi.mock("../_components/ChangeRequestHistory", () => ({ ChangeRequestHistory: nada }));
vi.mock("@/app/studio/_components/documents/DocsPanel", () => ({ DocsPanel: nada }));

import ClienteDetallePage from "../[markbox]/page";

const UNA = [{ conversation_id: 42, status: "open", unread_count: 0, last_activity_at: null }];

beforeEach(() => {
  state.nombre = "Cliente sintético";
  state.modulos = [];
  state.conversaciones = [];
  state.cadenaFalla = false;
  state.codigos = ["DTD-8001", "DTD-0457"];
  state.codigosPedidos = [];
});
afterEach(cleanup);

async function montar() {
  render(await ClienteDetallePage({ params: Promise.resolve({ markbox: "DTD-8001" }) }));
}

describe("Ficha del cliente · acciones rápidas (SDD-0650 F1)", () => {
  it("«Abrir chat» lleva a la conversación más reciente con Bandeja y una conversación", async () => {
    state.modulos = ["bandeja"];
    state.conversaciones = UNA;
    await montar();
    expect(screen.getByRole("link", { name: "Abrir chat" }).getAttribute("href")).toBe("/studio/bandeja?c=42");
  });

  it("sin conversaciones no hay «Abrir chat», aunque haya Bandeja", async () => {
    state.modulos = ["bandeja"];
    await montar();
    expect(screen.queryByRole("link", { name: "Abrir chat" })).toBeNull();
  });

  it("sin Bandeja no hay «Abrir chat», aunque haya conversaciones", async () => {
    state.conversaciones = UNA;
    await montar();
    expect(screen.queryByRole("link", { name: "Abrir chat" })).toBeNull();
  });

  it("«Cotizaciones» aparece solo con el módulo quotes", async () => {
    state.modulos = ["quotes"];
    await montar();
    expect(screen.getByRole("link", { name: "Cotizaciones" }).getAttribute("href")).toBe(
      "/studio/cotizador?client=DTD-8001",
    );
    cleanup();
    state.modulos = [];
    await montar();
    expect(screen.queryByRole("link", { name: "Cotizaciones" })).toBeNull();
  });
});

describe("Ficha del cliente · nombre y códigos (SDD-0650 F1)", () => {
  it.each([["vacío", ""], ["de espacios", "   "], ["nulo", null]])(
    "con nombre %s dice «Sin nombre»",
    async (_caso, nombre) => {
      state.nombre = nombre;
      await montar();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sin nombre");
    },
  );

  it("con nombre, lo muestra", async () => {
    await montar();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cliente sintético");
  });

  it("pide los envíos de todos los códigos de la ficha", async () => {
    await montar();
    expect(state.codigosPedidos).toEqual([["DTD-8001", "DTD-0457"]]);
  });

  it("si la cadena de códigos falla, los envíos salen del código vigente", async () => {
    state.cadenaFalla = true;
    await montar();
    expect(state.codigosPedidos).toEqual([["DTD-8001"]]);
  });
});
