/**
 * SDD-0650 F1 · SDD-0669 · La página de la ficha del cliente.
 *
 * Se monta la página real con sus lecturas dobladas y las tarjetas hijas en
 * stubs que anotan que se pintaron y con qué props. `ClientDetailClient`,
 * `FichaPestanas` y `NotaDeLaFicha` son los reales. Lo que se mide:
 *   - «Abrir chat» solo con Bandeja Y al menos una conversación;
 *   - «Cotizaciones» solo con el módulo `quotes`;
 *   - «Sin nombre» con nombre vacío o de espacios;
 *   - si la cadena de códigos falla, los envíos salen del código vigente;
 *   - SDD-0669 (portón): por rol, las tarjetas pintadas son las mismas que antes
 *     de reorganizar, una sola vez cada una y con los mismos permisos;
 *   - la nota y la solicitud de cambio, arriba y fuera de las pestañas;
 *   - un solo bloque de documentos.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Conversacion = { conversation_id: number; status: string; unread_count: number; last_activity_at: string | null };
type Envio = { id: string; code: string; client_markbox: string; origin: null; destination: null; shipment_service: "consolidado_lcl"; status: "draft"; created_at: string };

const state = vi.hoisted(() => ({
  nombre: "Cliente sintético" as string | null,
  notas: null as string | null,
  modulos: [] as string[],
  rol: "commercial" as string,
  puedeEditar: false,
  verSaldo: false,
  verEstado: false,
  verNombres: true,
  conFacturacion: false,
  conDocumento: false,
  solicitud: null as null | { id: string },
  conversaciones: [] as Conversacion[],
  cadenaFalla: false,
  codigos: ["DTD-8001", "DTD-0457"] as string[],
  codigosPedidos: [] as string[][],
  pintadas: [] as string[],
  props: {} as Record<string, Record<string, unknown>>,
  markbox: "DTD-8001",
  envios: [] as Envio[],
  trackingDenial: null as string | null,
  puedeReasignar: false,
  canalPortal: false,
  fotoDocumento: false,
  docKind: null as "persona" | "empresa" | null,
}));

// Los factories de vi.mock se elevan al tope del archivo: lo que usan tiene que
// venir de vi.hoisted, no de una constante de nivel superior.
const { tarjeta, nada } = vi.hoisted(() => ({
  nada: () => null,
  tarjeta: (nombre: string) =>
    function Tarjeta(props: Record<string, unknown>) {
      state.pintadas.push(nombre);
      state.props[nombre] = props;
      return <div data-tarjeta={nombre} />;
    },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: { tenant_id: "t1" }, error: null }),
    };
    const facturas = {
      select: () => facturas,
      eq: () => facturas,
      maybeSingle: async () =>
        state.conFacturacion
          ? { data: { kind: "empresa", legal_name: "Empresa sintética", doc: "J-000000000", fiscal_address: null, is_billing_default: true }, error: null }
          : { data: null, error: { code: "42501" } },
    };
    return {
      from: (tabla: string) => (tabla === "client_billing_identities" ? facturas : chain),
      storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    };
  },
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/client-queries", () => ({
  getClientByMarkbox: async () => ({
    id: "c1", tenant_id: "t1", markbox: state.markbox, name: state.nombre, doc_kind: state.docKind, tier: "nuevo",
    email: null, phone: null, address: null, rif: state.conDocumento ? "V-00000000" : null, notes: state.notas,
    advisor_id: "a1", registration_channel: state.canalPortal ? "portal" : "studio", cedula_photo_path: state.fotoDocumento ? "foto-ficticia" : null, created_at: "2026-10-01T00:00:00Z",
  }),
  listCodigosDeLaFicha: async () => {
    if (state.cadenaFalla) throw new Error("sin red");
    return state.codigos;
  },
  listShipmentsDeLaFicha: async (_s: unknown, _tenant: string, codigos: string[]) => {
    state.codigosPedidos.push([...codigos]);
    return state.envios;
  },
  getClientPortalAccess: async () => null,
  getClientPortalApprovedAt: async () => null,
  getClientAccountState: async (_s: unknown, _c: unknown, o: { puedeVerSaldo: boolean }) =>
    o.puedeVerSaldo ? { tipo: "ok" } : { tipo: "sin_permiso" },
}));
vi.mock("@/lib/studio/client-account", () => ({
  puedeVerEstadoDeCuenta: () => state.verEstado,
  puedeVerSaldoCliente: () => state.verSaldo,
}));
vi.mock("@/lib/studio/user-queries", () => ({
  listTenantAdvisors: async () => [{ userId: "a1", name: "Asesora sintética", role: "commercial", avatarUrl: null, positionLabel: null }],
}));
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
  getStudioAccess: async () => ({ role: state.rol, overrides: {}, grants: [], userId: "u1" }),
  moduleViewDenial: async () => state.trackingDenial,
}));
vi.mock("@/lib/studio/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/rbac")>()),
  canAccessModule: (_rol: unknown, modulo: string) => state.modulos.includes(modulo),
  canEditModule: () => state.puedeEditar,
  canSpecial: () => state.puedeReasignar,
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
  getOpenChangeRequest: async () => state.solicitud,
  listResolvedChangeRequests: async () => [],
  resolveReviewerNames: async () => ({}),
}));
vi.mock("@/lib/studio/privacidad-cn", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/privacidad-cn")>()),
  readCanSeeClientNames: async () => state.verNombres,
}));

// Tarjetas hijas: stubs que anotan que se pintaron.
vi.mock("../_components/ClientDrawer", () => ({ ClientDrawer: nada }));
vi.mock("../_components/ClientAccountHeader", () => ({ ClientAccountHeader: tarjeta("ClientAccountHeader") }));
vi.mock("../_components/PortalAccessCard", () => ({ PortalAccessCard: tarjeta("PortalAccessCard") }));
vi.mock("../_components/AdvisorAssignCard", () => ({ AdvisorAssignCard: tarjeta("AdvisorAssignCard") }));
vi.mock("../_components/AliadoCard", () => ({ AliadoCard: tarjeta("AliadoCard") }));
vi.mock("../_components/ShippingMarkChip", () => ({ ShippingMarkChip: tarjeta("ShippingMarkChip") }));
vi.mock("../_components/ChatwootConversacionesCard", () => ({ ChatwootConversacionesCard: nada }));
// SDD-0650 F2: el panel en vivo tiene sus propias pruebas.
vi.mock("../_components/PanelConversacionesFicha", () => ({
  PanelConversacionesFicha: tarjeta("PanelConversacionesFicha"),
}));
vi.mock("../_components/ConversacionesFichaCard", () => ({ ConversacionesFichaCargando: nada }));
vi.mock("../_components/DeliveryAddressesCard", () => ({ DeliveryAddressesCard: tarjeta("DeliveryAddressesCard") }));
vi.mock("../_components/IdentityVerificationCard", () => ({
  IdentityVerificationCard: tarjeta("IdentityVerificationCard"),
}));
vi.mock("../_components/ClientBillingCard", () => ({ ClientBillingCard: tarjeta("ClientBillingCard") }));
vi.mock("../_components/TodosLosAdjuntos", () => ({ TodosLosAdjuntos: tarjeta("TodosLosAdjuntos") }));
vi.mock("../_components/ChangeRequestCard", () => ({ ChangeRequestCard: tarjeta("ChangeRequestCard") }));
vi.mock("../_components/ChangeRequestHistory", () => ({ ChangeRequestHistory: tarjeta("ChangeRequestHistory") }));
vi.mock("@/app/studio/_components/documents/DocsPanel", () => ({ DocsPanel: tarjeta("DocsPanel") }));
vi.mock("../../tracking/[id]/_components/ReassignClientPanel", () => ({ ReassignClientPanel: tarjeta("ReassignClientPanel") }));

import ClienteDetallePage from "../[markbox]/page";
import { ClientDetailContent } from "../_components/ClientDetailContent";

const UNA: Conversacion[] = [{ conversation_id: 42, status: "open", unread_count: 0, last_activity_at: null }];

beforeEach(() => {
  window.history.replaceState(null, "", "/studio/clientes/DTD-8001");
  state.nombre = "Cliente sintético";
  state.notas = null;
  state.modulos = [];
  state.rol = "commercial";
  state.puedeEditar = false;
  state.verSaldo = false;
  state.verEstado = false;
  state.verNombres = true;
  state.conFacturacion = false;
  state.conDocumento = false;
  state.solicitud = null;
  state.conversaciones = [];
  state.cadenaFalla = false;
  state.codigos = ["DTD-8001", "DTD-0457"];
  state.codigosPedidos = [];
  state.pintadas = [];
  state.props = {};
  state.markbox = "DTD-8001";
  state.envios = [];
  state.trackingDenial = null;
  state.puedeReasignar = false;
  state.canalPortal = false;
  state.fotoDocumento = false;
  state.docKind = null;
});
afterEach(cleanup);

async function montar() {
  render(await ClienteDetallePage({ params: Promise.resolve({ markbox: "DTD-8001" }) }));
}

const ENVIO_PENDIENTE: Envio = {
  id: "envio-ficticio", code: "S-FICTICIO", client_markbox: "DTD-0000",
  origin: null, destination: null, shipment_service: "consolidado_lcl", status: "draft", created_at: "2026-11-24T12:00:00Z",
};

async function montarPanel() {
  render(await ClientDetailContent({ markbox: state.markbox, enPanel: true }));
}

describe("Asignación desde ficha lateral · SDD-0715", () => {
  it("nota sin embarque y cero actividad no montan una escritura", async () => {
    state.notas = "Pendiente ficticio; no identifica un embarque";
    state.puedeReasignar = true;
    await montarPanel();
    expect(screen.getByText(state.notas)).toBeInTheDocument();
    expect(screen.getByText(/se necesita un embarque sin cliente/)).toBeInTheDocument();
    expect(state.pintadas).not.toContain("ReassignClientPanel");
  });

  it("un embarque real ya asignado no se trata como pendiente por su nota", async () => {
    state.notas = "Asignación pendiente ficticia";
    state.envios = [{ ...ENVIO_PENDIENTE, client_markbox: "DTD-8001" }];
    state.puedeReasignar = true;
    await montarPanel();
    expect(state.pintadas).not.toContain("ReassignClientPanel");
  });

  it("solo pasa a la acción existente el id real del embarque sin cliente", async () => {
    state.markbox = "DTD-0000";
    state.codigos = ["DTD-0000"];
    state.envios = [ENVIO_PENDIENTE];
    state.puedeReasignar = true;
    await montarPanel();
    expect(state.props.ReassignClientPanel).toMatchObject({
      shipmentId: "envio-ficticio", shipmentCode: "S-FICTICIO", currentMarkbox: "DTD-0000", sinCliente: true,
    });
  });

  it.each(["tracking", "privacidad", "capacidad"])("sin %s no monta el buscador ni la acción", async (limite) => {
    state.markbox = "DTD-0000";
    state.codigos = ["DTD-0000"];
    state.envios = [ENVIO_PENDIENTE];
    state.puedeReasignar = limite !== "capacidad";
    state.verNombres = limite !== "privacidad";
    state.trackingDenial = limite === "tracking" ? "Sin acceso" : null;
    await montarPanel();
    expect(state.pintadas).not.toContain("ReassignClientPanel");
  });

  it("un id ajeno a los embarques leídos de la ficha no habilita asignación", async () => {
    state.markbox = "DTD-0000";
    state.codigos = ["DTD-0000"];
    state.envios = [ENVIO_PENDIENTE];
    state.puedeReasignar = true;
    render(await ClientDetailContent({ markbox: state.markbox, enPanel: true, shipmentId: "id-ficticio-no-resuelto" }));
    expect(state.pintadas).not.toContain("ReassignClientPanel");
    expect(screen.getByText(/se necesita un embarque sin cliente/)).toBeInTheDocument();
  });

  it("la fila seleccionada no habilita asignación sobre otros embarques", async () => {
    state.markbox = "DTD-0000";
    state.codigos = ["DTD-0000"];
    state.envios = [ENVIO_PENDIENTE, { ...ENVIO_PENDIENTE, id: "otro-envio-ficticio", code: "S-OTRO" }];
    state.puedeReasignar = true;
    render(await ClientDetailContent({ markbox: state.markbox, enPanel: true, shipmentId: "envio-ficticio" }));
    expect(state.pintadas.filter((nombre) => nombre === "ReassignClientPanel")).toHaveLength(1);
    expect(state.props.ReassignClientPanel.shipmentId).toBe("envio-ficticio");
  });
});

describe.each(["completa", "panel"] as const)("Accesos de identidad y asesor · ficha %s · SDD-0715", (modo) => {
  async function montarModo() {
    if (modo === "panel") await montarPanel();
    else await montar();
  }

  it.each(["documento", "foto", "portal"])("acceso visible de verificación con %s, sin duplicar el formulario", async (condicion) => {
    state.conDocumento = condicion === "documento";
    state.fotoDocumento = condicion === "foto";
    state.canalPortal = condicion === "portal";
    await montarModo();
    const acceso = screen.getByRole("region", { name: "Verificación de identidad" });
    expect(within(acceso).getByRole("link", { name: "Verificar cédula en Configuración" }))
      .toHaveAttribute("href", "?pestana=configuracion");
    expect(state.pintadas.filter((nombre) => nombre === "IdentityVerificationCard")).toHaveLength(1);
    expect(document.querySelector('[data-tarjeta="IdentityVerificationCard"]')?.closest('[role="tabpanel"]')?.id)
      .toBe("ficha-panel-configuracion");
    expect(acceso.querySelector("input, select, form")).toBeNull();
  });

  it("sin documento, foto ni portal no agrega un acceso de verificación", async () => {
    await montarModo();
    expect(screen.queryByRole("region", { name: "Verificación de identidad" })).toBeNull();
    expect(state.pintadas).not.toContain("IdentityVerificationCard");
  });

  it("empresas reciben el acceso de RIF y el asesor conserva su único formulario", async () => {
    state.conDocumento = true;
    state.docKind = "empresa";
    await montarModo();
    expect(screen.getByRole("link", { name: "Verificar RIF en Configuración" })).toHaveAttribute("href", "?pestana=configuracion");
    const asesor = screen.getByRole("region", { name: "Asesor asignado" });
    expect(within(asesor).getByRole("link", { name: "Asignar asesor en Configuración" })).toHaveAttribute("href", "?pestana=configuracion");
    expect(asesor).toHaveTextContent("Asesora sintética");
    expect(asesor.querySelector("input, select, form")).toBeNull();
    expect(state.pintadas.filter((nombre) => nombre === "AdvisorAssignCard")).toHaveLength(1);
    const configuracion = document.getElementById("ficha-panel-configuracion")!;
    const tarjetas = [...configuracion.querySelectorAll("[data-tarjeta]")].map((el) => el.getAttribute("data-tarjeta"));
    expect(tarjetas.slice(0, 3)).toEqual(["IdentityVerificationCard", "AdvisorAssignCard", "PortalAccessCard"]);
    expect(tarjetas).toEqual(expect.arrayContaining(["AliadoCard", "DeliveryAddressesCard", "ChangeRequestHistory"]));
  });
});

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

/**
 * SDD-0669 · PORTÓN. Las tarjetas que pintaba la ficha antes de reorganizar,
 * con sus condiciones de entonces (página de `main` `9434cc4f6`):
 *  - siempre: Shipping Mark, cabecera de cuenta, historial de solicitudes,
 *    acceso al portal, asesor, aliado, direcciones, documentos y adjuntos;
 *  - con solicitud abierta: la solicitud;
 *  - con documento, portal o foto: la verificación de identidad;
 *  - si la RLS de la 0466 deja leer la facturación: la facturación;
 *  - con Bandeja (y su flag) y tenant: el panel de conversaciones.
 * Reorganizar no puede sumar ni quitar ninguna, ni pintarla dos veces.
 */
const SIEMPRE = [
  "AdvisorAssignCard",
  "AliadoCard",
  "ChangeRequestHistory",
  "ClientAccountHeader",
  "DeliveryAddressesCard",
  "DocsPanel",
  "PortalAccessCard",
  "ShippingMarkChip",
  "TodosLosAdjuntos",
];

type Rol = {
  nombre: string;
  rol: string;
  modulos: string[];
  puedeEditar: boolean;
  verSaldo: boolean;
  verEstado: boolean;
  verNombres: boolean;
  conFacturacion: boolean;
};

const ROLES: Rol[] = [
  { nombre: "Admin", rol: "admin", modulos: ["bandeja", "quotes"], puedeEditar: true, verSaldo: true, verEstado: true, verNombres: true, conFacturacion: true },
  { nombre: "Comercial", rol: "commercial", modulos: ["bandeja", "quotes"], puedeEditar: true, verSaldo: true, verEstado: false, verNombres: true, conFacturacion: true },
  { nombre: "Operaciones", rol: "operations", modulos: [], puedeEditar: false, verSaldo: true, verEstado: false, verNombres: true, conFacturacion: false },
  { nombre: "Contabilidad", rol: "accounting", modulos: [], puedeEditar: false, verSaldo: true, verEstado: true, verNombres: true, conFacturacion: true },
  { nombre: "Soporte", rol: "support", modulos: ["bandeja"], puedeEditar: false, verSaldo: false, verEstado: false, verNombres: true, conFacturacion: false },
  { nombre: "Región China sin nombres", rol: "commercial", modulos: ["bandeja"], puedeEditar: false, verSaldo: false, verEstado: false, verNombres: false, conFacturacion: false },
];

function esperadas(r: Rol, extra: { solicitud: boolean; documento: boolean }): string[] {
  const conPanel = r.modulos.includes("bandeja");
  return [
    ...SIEMPRE,
    ...(extra.solicitud ? ["ChangeRequestCard"] : []),
    ...(extra.documento ? ["IdentityVerificationCard"] : []),
    ...(r.conFacturacion ? ["ClientBillingCard"] : []),
    ...(conPanel ? ["PanelConversacionesFicha"] : []),
  ].sort();
}

describe("Ficha del cliente · por rol, las mismas tarjetas que antes (SDD-0669)", () => {
  describe.each(ROLES)("$nombre", (r) => {
    it.each([
      { solicitud: false, documento: false },
      { solicitud: true, documento: true },
    ])("solicitud $solicitud · documento $documento", async (extra) => {
      Object.assign(state, {
        rol: r.rol,
        modulos: r.modulos,
        puedeEditar: r.puedeEditar,
        verSaldo: r.verSaldo,
        verEstado: r.verEstado,
        verNombres: r.verNombres,
        conFacturacion: r.conFacturacion,
        solicitud: extra.solicitud ? { id: "r1" } : null,
        conDocumento: extra.documento,
        conversaciones: UNA,
      });
      await montar();

      // Las mismas, una vez cada una.
      expect([...state.pintadas].sort()).toEqual(esperadas(r, extra));

      // Con los mismos permisos.
      expect(state.props.ShippingMarkChip.canEdit).toBe(r.puedeEditar);
      expect(state.props.PortalAccessCard.canEdit).toBe(r.puedeEditar);
      expect(state.props.AliadoCard.canEdit).toBe(r.puedeEditar);
      expect(state.props.ClientAccountHeader.canViewStatement).toBe(r.verEstado);
      expect(state.props.ClientAccountHeader.estado).toEqual(r.verSaldo ? { tipo: "ok" } : { tipo: "sin_permiso" });
      if (r.modulos.includes("bandeja")) {
        expect(state.props.PanelConversacionesFicha.puedeVerDatos).toBe(r.verNombres);
      }
      expect(screen.queryByRole("link", { name: "Estado de cuenta" }) !== null).toBe(r.verEstado);
    });
  });

  it("sin Bandeja no hay columna de conversaciones y las pestañas toman el ancho", async () => {
    const { container } = render(
      await ClienteDetallePage({ params: Promise.resolve({ markbox: "DTD-8001" }) }),
    );
    expect(container.querySelector(".studio-ficha-conversaciones")).toBeNull();
    expect(container.querySelector(".studio-ficha-cuerpo--sin-panel")).not.toBeNull();
  });

  it("con Bandeja, las conversaciones van fuera de las pestañas (a la vista en todas)", async () => {
    state.modulos = ["bandeja"];
    state.conversaciones = UNA;
    const { container } = render(
      await ClienteDetallePage({ params: Promise.resolve({ markbox: "DTD-8001" }) }),
    );
    const panel = container.querySelector('[data-tarjeta="PanelConversacionesFicha"]') as HTMLElement;
    expect(panel.closest('[role="tabpanel"]')).toBeNull();
    expect(panel.closest(".studio-ficha-conversaciones")).not.toBeNull();
  });
});

describe("Ficha del cliente · avisos, pestañas y documentos (SDD-0669)", () => {
  it("la nota de la ficha sale arriba, fuera de las pestañas, una sola vez", async () => {
    state.notas = "PENDIENTE: dato sintético de prueba";
    await montar();
    const nota = screen.getAllByText("PENDIENTE: dato sintético de prueba");
    expect(nota).toHaveLength(1);
    expect(nota[0].closest('[role="tabpanel"]')).toBeNull();
  });

  it("la solicitud de cambio pendiente va arriba, fuera de las pestañas", async () => {
    state.solicitud = { id: "r1" };
    const { container } = render(
      await ClienteDetallePage({ params: Promise.resolve({ markbox: "DTD-8001" }) }),
    );
    const s = container.querySelector('[data-tarjeta="ChangeRequestCard"]') as HTMLElement;
    expect(s.closest('[role="tabpanel"]')).toBeNull();
  });

  it("cuatro pestañas; Resumen abierta por defecto", async () => {
    await montar();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Resumen",
      "Envíos0",
      "Documentos",
      "Configuración",
    ]);
    expect(screen.getByRole("tab", { name: "Resumen" }).getAttribute("aria-selected")).toBe("true");
  });

  it("?pestana= con un valor ajeno abre Resumen", async () => {
    window.history.replaceState(null, "", "/studio/clientes/DTD-8001?pestana=secreta");
    await montar();
    expect(screen.getByRole("tab", { name: "Resumen" }).getAttribute("aria-selected")).toBe("true");
  });

  it("un solo bloque de documentos: el panel de la ficha plegado y los adjuntos de sus embarques", async () => {
    await montar();
    expect(state.props.DocsPanel.formularioPlegado).toBe(true);
    expect(state.props.TodosLosAdjuntos.soloEmbarques).toBe(true);
    const docs = document.querySelector('[data-tarjeta="DocsPanel"]') as HTMLElement;
    const adjuntos = document.querySelector('[data-tarjeta="TodosLosAdjuntos"]') as HTMLElement;
    expect(docs.closest('[role="tabpanel"]')?.id).toBe("ficha-panel-documentos");
    expect(adjuntos.closest('[role="tabpanel"]')?.id).toBe("ficha-panel-documentos");
  });

  it("el asesor asignado sale en la franja, solo para leer", async () => {
    await montar();
    const franja = document.querySelector(".studio-ficha-franja") as HTMLElement;
    expect(franja.textContent).toContain("Asesor: Asesora sintética");
    expect(franja.querySelector('[data-tarjeta="AdvisorAssignCard"]')).toBeNull();
  });
});
