import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  vi.clearAllMocks(); mocks.gate.mockReset(); mocks.content.mockResolvedValue("Ficha autorizada");
  mocks.capacidad = true; mocks.nombres = true; mocks.trackingDenial = null;
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
