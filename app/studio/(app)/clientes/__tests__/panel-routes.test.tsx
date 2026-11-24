import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), content: vi.fn(), redirect: vi.fn(), capacidad: true, nombres: true, trackingDenial: null as string | null }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: mocks.gate,
  getStudioAccess: async () => ({ role: "commercial" }),
  moduleViewDenial: async () => mocks.trackingDenial,
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac", () => ({ canSpecial: () => mocks.capacidad }));
vi.mock("@/lib/studio/privacidad-cn", () => ({ readCanSeeClientNames: async () => mocks.nombres }));
vi.mock("@/lib/studio/client-queries", () => ({
  parseClientFiltersFromSearchParams: () => ({ tier: "all" }),
  listClientsPage: async () => ({ clients: [{ id: "cliente-ficticio", markbox: "DTD-0000", name: "Cliente ficticio", notes: "NOTA_FICTICIA_SOLO_FICHA" }], total: 1, limite: 50, topeAlcanzado: false }),
}));
vi.mock("@/lib/studio/aliados/aliado-queries", () => ({ listAliadoOptions: async () => [] }));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({ contarAdjuntosDeClientes: async () => null }));
vi.mock("../_components/ClientsClient", () => ({ ClientsClient: () => null }));
vi.mock("../_components/ClientDetailContent", () => ({ ClientDetailContent: mocks.content }));
vi.mock("../_components/ClientDetailPanel", () => ({ ClientDetailPanel: () => null }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import Clientes from "../@ficha/(.)ficha/[markbox]/page";
import Embarques from "../../embarques/@ficha/(.)ficha-cliente/[markbox]/page";
import ClientesDirecta from "../ficha/[markbox]/page";
import EmbarquesDirecta from "../../embarques/ficha-cliente/[markbox]/page";
import ClientesLayout from "../layout";
import EmbarquesLayout from "../../embarques/layout";
import ClientesDefault from "../@ficha/default";
import ClientesRaiz from "../@ficha/page";
import ClientesResto from "../@ficha/[...rest]/page";
import EmbarquesDefault from "../../embarques/@ficha/default";
import EmbarquesRaiz from "../../embarques/@ficha/page";
import EmbarquesResto from "../../embarques/@ficha/[...rest]/page";
import ClientesListado from "../page";
import { EmbarquesClient } from "../../embarques/_components/EmbarquesClient";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks(); mocks.gate.mockReset(); mocks.content.mockResolvedValue("Ficha autorizada");
  mocks.capacidad = true; mocks.nombres = true; mocks.trackingDenial = null;
});

const ENVIO_DE_FILA: ShipmentListRow = {
  id: "envio-ficticio", code: "S-FICTICIO", client_markbox: "DTD-0000", client_name: "Pendiente ficticio",
  origin: "Yiwu", destination: "Valencia", shipment_service: "consolidado_lcl", status: "in_transit",
  weight_kg: null, volume_m3: null, created_at: "2026-11-24T12:00:00Z",
};

describe("Enlaces de Embarques sobre #809 · SDD-0715", () => {
  it("una fila pendiente enlaza su id real al panel sin activar el detalle ni anidar controles", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={[ENVIO_DE_FILA]} adjuntos={undefined} />);
    const asignar = screen.getByRole("link", { name: "Asignar cliente del embarque S-FICTICIO" });
    expect(asignar).toHaveAttribute("href", "/studio/embarques/ficha-cliente/DTD-0000?embarque=envio-ficticio");
    expect(asignar.closest("button")).toBeNull();
    asignar.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(asignar);
    expect(asignar).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir embarque S-FICTICIO" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rastrear embarque S-FICTICIO" })).toHaveAttribute("href", "/studio/tracking/envio-ficticio");
  });

  it("el enlace de ficha no vive dentro del botón del acordeón", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={[{ ...ENVIO_DE_FILA, client_markbox: "DTD-8001" }]} adjuntos={undefined} />);
    const ficha = screen.getByRole("link", { name: "Ver ficha de Pendiente ficticio · DTD-8001" });
    expect(ficha).toHaveAttribute("href", "/studio/embarques/ficha-cliente/DTD-8001");
    expect(ficha.closest("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /^Asignar cliente del embarque/ })).toBeNull();
  });

  it("sin ficha vinculada informa y conserva el camino al embarque sin inventar un Shipping Mark", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={[{ ...ENVIO_DE_FILA, client_markbox: null }]} adjuntos={undefined} />);
    expect(screen.getByText("Sin ficha vinculada")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Asignar cliente del embarque/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Ver ficha de/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Rastrear embarque S-FICTICIO" })).toBeInTheDocument();
  });
});
const props = () => ({ params: Promise.resolve({ markbox: "DTD-8001" }) });

describe("Rutas de panel SDD-0715", () => {
  it("las props del listado llevan indicador, sin texto de notas", async () => {
    const tree = await ClientesListado({ searchParams: Promise.resolve({}) });
    expect(tree.props.clients[0]).toMatchObject({ hasNote: true, markbox: "DTD-0000" });
    expect(tree.props.clients[0]).not.toHaveProperty("notes");
    expect(JSON.stringify(tree.props)).not.toContain("NOTA_FICTICIA_SOLO_FICHA");
  });
  it.each(["capacidad", "privacidad", "tracking"])("listado no ofrece asignación sin %s", async (limite) => {
    mocks.capacidad = limite !== "capacidad";
    mocks.nombres = limite !== "privacidad";
    mocks.trackingDenial = limite === "tracking" ? "Denegado" : null;
    const tree = await ClientesListado({ searchParams: Promise.resolve({}) });
    expect(tree.props.puedeAsignar).toBe(false);
  });
  it.each([Clientes, Embarques])("no carga ficha si el gate deniega", async (Page) => {
    mocks.gate.mockRejectedValue(new Error("Sin acceso"));
    await expect(Page(props())).rejects.toThrow("Sin acceso");
    expect(mocks.content).not.toHaveBeenCalled();
  });
  it.each([Clientes, Embarques])("autoriza antes de componer el cuerpo server", async (Page) => {
    await Page(props());
    expect(mocks.gate).toHaveBeenCalledWith("clients");
    expect(mocks.content).toHaveBeenCalledWith({ markbox: "DTD-8001", enPanel: true });
    expect(mocks.gate.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.content.mock.invocationCallOrder[0]);
  });
  it("Embarques conserva el id de la fila como selector para resolverlo bajo la ficha", async () => {
    await Embarques({ ...props(), searchParams: Promise.resolve({ embarque: "envio-ficticio" }) });
    expect(mocks.content).toHaveBeenCalledWith({ markbox: "DTD-8001", enPanel: true, shipmentId: "envio-ficticio" });
  });
  it("un selector ambiguo no se transforma en todos los embarques", async () => {
    await Embarques({ ...props(), searchParams: Promise.resolve({ embarque: ["uno", "otro"] }) });
    expect(mocks.content).toHaveBeenCalledWith({ markbox: "DTD-8001", enPanel: true, shipmentId: "" });
  });
  it.each([ClientesDirecta, EmbarquesDirecta])("refresh o URL directa resuelve ficha completa", async (Page) => {
    await Page(props());
    expect(mocks.gate).toHaveBeenCalledWith("clients");
    expect(mocks.redirect).toHaveBeenCalledWith("/studio/clientes/DTD-8001");
    expect(mocks.content).not.toHaveBeenCalled();
  });
  it.each([ClientesDirecta, EmbarquesDirecta])("el acceso directo conserva Configuración al abrir su enlace", async (Page) => {
    await Page({ ...props(), searchParams: Promise.resolve({ pestana: "configuracion" }) });
    expect(mocks.redirect).toHaveBeenCalledWith("/studio/clientes/DTD-8001?pestana=configuracion");
  });
  it.each([ClientesDirecta, EmbarquesDirecta])("no propaga pestañas ajenas desde la URL", async (Page) => {
    await Page({ ...props(), searchParams: Promise.resolve({ pestana: "secreta" }) });
    expect(mocks.redirect).toHaveBeenCalledWith("/studio/clientes/DTD-8001");
  });
  it.each([ClientesDefault, ClientesRaiz, ClientesResto, EmbarquesDefault, EmbarquesRaiz, EmbarquesResto])("limpia el slot fuera de su ruta", (Page) => {
    expect(Page()).toBeNull();
  });
  it.each([ClientesLayout, EmbarquesLayout])("conserva la lista junto al slot y exige acceso", async (Layout) => {
    const tree = await Layout({ children: "Lista conservada", ficha: "Panel" });
    expect(tree.props.children).toEqual(["Lista conservada", "Panel"]);
    expect(mocks.gate).toHaveBeenCalledTimes(1);
  });
});
