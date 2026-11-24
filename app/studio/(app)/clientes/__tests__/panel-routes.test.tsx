import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), content: vi.fn(), redirect: vi.fn(), shipment: vi.fn(), reassign: vi.fn(), tenant: "tenant-ficticio" as string | null, capacidad: true, nombres: true, trackingDenial: null as string | null }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: mocks.gate,
  getStudioAccess: async () => ({ role: "commercial", tenantId: mocks.tenant }),
  moduleViewDenial: async () => mocks.trackingDenial,
}));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/studio/rbac", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/rbac")>()),
  canSpecial: () => mocks.capacidad,
}));
vi.mock("@/lib/studio/shipment-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/studio/shipment-queries")>()),
  getShipmentById: mocks.shipment,
}));
vi.mock("../../tracking/[id]/_components/ReassignClientPanel", () => ({
  ReassignClientPanel: (props: Record<string, unknown>) => {
    mocks.reassign(props);
    return <button>Asignar cliente ficticio</button>;
  },
}));
vi.mock("@/lib/studio/privacidad-cn", () => ({ readCanSeeClientNames: async () => mocks.nombres }));
vi.mock("@/lib/studio/client-queries", () => ({
  parseClientFiltersFromSearchParams: () => ({ tier: "all" }),
  listClientsPage: async () => ({ clients: [{ id: "cliente-ficticio", markbox: "DTD-0000", name: "Cliente ficticio", notes: "NOTA_FICTICIA_SOLO_FICHA" }], total: 1, limite: 50, topeAlcanzado: false }),
}));
vi.mock("@/lib/studio/aliados/aliado-queries", () => ({ listAliadoOptions: async () => [] }));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({ contarAdjuntosDeClientes: async () => null }));
vi.mock("../_components/ClientsClient", () => ({ ClientsClient: () => null }));
vi.mock("../_components/ClientDetailContent", () => ({ ClientDetailContent: mocks.content }));
vi.mock("../_components/ClientDetailPanel", () => ({ ClientDetailPanel: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
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
  mocks.tenant = "tenant-ficticio";
  mocks.shipment.mockReset();
  mocks.shipment.mockResolvedValue({ id: "envio-ficticio", tenant_id: "tenant-ficticio", code: "S-FICTICIO", client_markbox: "DTD-0000", deleted_at: null });
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
    expect(screen.getByText("Sin ficha vinculada. Tracking abre en otra pestaña.")).toBeInTheDocument();
    const asignar = screen.getByRole("link", { name: "Asignar cliente del embarque S-FICTICIO en Tracking (otra pestaña)" });
    expect(asignar).toHaveAttribute("href", "/studio/tracking/envio-ficticio");
    expect(asignar).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("link", { name: /^Ver ficha de/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Rastrear embarque S-FICTICIO" })).toBeInTheDocument();
  });

  it.each(["DTD-0000", "", "   "])("dos filas pendientes con marca %j conservan destinos exclusivos", (markbox) => {
    const filas = [ENVIO_DE_FILA, { ...ENVIO_DE_FILA, id: "segundo-envio-ficticio", code: "S-SEGUNDO" }]
      .map((fila) => ({ ...fila, client_markbox: markbox }));
    render(<EmbarquesClient pestanaInicial="all" shipments={filas} adjuntos={undefined} />);
    const enlaces = screen.getAllByRole("link", { name: /^Asignar cliente del embarque/ });
    expect(enlaces).toHaveLength(2);
    for (const [i, enlace] of enlaces.entries()) {
      expect(enlace).toHaveAttribute("href", markbox.trim()
        ? `/studio/embarques/ficha-cliente/DTD-0000?embarque=${filas[i].id}`
        : `/studio/tracking/${filas[i].id}`);
      if (!markbox.trim()) expect(enlace).toHaveAttribute("target", "_blank");
      enlace.addEventListener("click", (event) => event.preventDefault());
      fireEvent.click(enlace);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("button", { name: `Abrir embarque ${filas[i].code}` })).toBeInTheDocument();
    }
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
  it("Embarques resuelve el id de la fila directamente con el contrato de Tracking", async () => {
    render(await Embarques({ ...props(), searchParams: Promise.resolve({ embarque: "envio-ficticio" }) }));
    expect(mocks.shipment).toHaveBeenCalledWith({}, "envio-ficticio");
    expect(mocks.reassign).toHaveBeenCalledWith(expect.objectContaining({ shipmentId: "envio-ficticio", sinCliente: true }));
    expect(mocks.content).not.toHaveBeenCalled();
    expect(mocks.gate).toHaveBeenCalledWith("tracking");
  });
  it("un selector ambiguo no se transforma en todos los embarques", async () => {
    render(await Embarques({ ...props(), searchParams: Promise.resolve({ embarque: ["uno", "otro"] }) }));
    expect(mocks.shipment).not.toHaveBeenCalled();
    expect(mocks.content).not.toHaveBeenCalled();
    expect(screen.getByText("Embarque no disponible")).toBeInTheDocument();
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

describe("Acceso exacto independiente de ficha y tope · SDD-0715", () => {
  const seleccion = (id: string) => ({ params: Promise.resolve({ markbox: "DTD-0000" }), searchParams: Promise.resolve({ embarque: id }) });
  const leido = (extra: Record<string, unknown> = {}) => ({
    id: "envio-ficticio", tenant_id: "tenant-ficticio", code: "S-FICTICIO",
    client_markbox: "DTD-0000", deleted_at: null, ...extra,
  });

  it("abre el seleccionado fuera de los primeros 200 aunque no exista ficha comodín", async () => {
    const primeros200 = Array.from({ length: 200 }, (_, i) => `envio-reciente-${i}`);
    expect(primeros200).not.toContain("envio-antiguo-201");
    mocks.content.mockImplementation(() => { throw new Error("No hay ficha comodín visible ni listado disponible"); });
    mocks.shipment.mockResolvedValue(leido({ id: "envio-antiguo-201", code: "S-ANTIGUO-201", notes: "NOTA_FICTICIA_SOLO_SERVIDOR", client_name: "NOMBRE_FICTICIO_NO_EXHIBIR" }));
    render(await Embarques(seleccion("envio-antiguo-201")));
    expect(mocks.shipment).toHaveBeenCalledWith({}, "envio-antiguo-201");
    expect(mocks.content).not.toHaveBeenCalled();
    expect(mocks.gate).not.toHaveBeenCalledWith("clients");
    expect(mocks.reassign).toHaveBeenCalledWith(expect.objectContaining({ shipmentId: "envio-antiguo-201", shipmentCode: "S-ANTIGUO-201" }));
    expect(mocks.reassign.mock.calls[0][0]).toEqual({ shipmentId: "envio-antiguo-201", shipmentCode: "S-ANTIGUO-201", currentMarkbox: "DTD-0000", sinCliente: true });
    expect(screen.queryByText(/NOTA_FICTICIA_SOLO_SERVIDOR|NOMBRE_FICTICIO_NO_EXHIBIR/)).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir este embarque en Tracking/ })).toHaveAttribute("href", "/studio/tracking/envio-antiguo-201");
  });

  it("deniega Tracking antes de resolver un id o cargar datos de ficha", async () => {
    mocks.gate.mockImplementation(async (module: string) => { if (module === "tracking") throw new Error("Sin permiso"); });
    await expect(Embarques(seleccion("envio-ficticio"))).rejects.toThrow("Sin permiso");
    expect(mocks.shipment).not.toHaveBeenCalled();
    expect(mocks.content).not.toHaveBeenCalled();
  });

  it.each([
    { caso: "otro tenant", row: leido({ tenant_id: "tenant-ajeno" }) },
    { caso: "id no corresponde", row: leido({ id: "otro-id" }) },
    { caso: "eliminado", row: leido({ deleted_at: "2026-11-24T12:00:00Z" }) },
    { caso: "no visible o inexistente", row: null },
  ])("$caso: no expone código ni habilita asignación", async ({ row }) => {
    mocks.shipment.mockResolvedValue(row);
    render(await Embarques(seleccion("envio-ficticio")));
    expect(screen.getByText("Embarque no disponible")).toBeInTheDocument();
    expect(screen.queryByText("S-FICTICIO")).toBeNull();
    expect(mocks.reassign).not.toHaveBeenCalled();
    expect(mocks.content).not.toHaveBeenCalled();
  });

  it("sin tenant activo no consulta el embarque ni ofrece acción", async () => {
    mocks.tenant = null;
    render(await Embarques(seleccion("envio-ficticio")));
    expect(mocks.shipment).not.toHaveBeenCalled();
    expect(mocks.reassign).not.toHaveBeenCalled();
  });

  it.each(["privacidad", "capacidad"])("sin %s conserva el gate existente del formulario", async (limite) => {
    mocks.capacidad = limite !== "capacidad";
    mocks.nombres = limite !== "privacidad";
    render(await Embarques(seleccion("envio-ficticio")));
    expect(mocks.reassign).not.toHaveBeenCalled();
  });

  it("relee el cliente actual: una fila desactualizada no permite reasignar al nuevo dueño", async () => {
    mocks.shipment.mockResolvedValue(leido({ client_markbox: "DTD-8002" }));
    render(await Embarques(seleccion("envio-ficticio")));
    expect(screen.getByText(/Este embarque ya tiene cliente asignado/)).toBeInTheDocument();
    expect(mocks.reassign).not.toHaveBeenCalled();
  });

  it("dos filas del mismo grupo resuelven solo su propio id", async () => {
    mocks.shipment.mockImplementation(async (_session: unknown, id: string) => leido({ id, code: `S-${id}` }));
    for (const id of ["fila-uno", "fila-dos"]) {
      const view = render(await Embarques(seleccion(id)));
      expect(mocks.reassign.mock.calls.at(-1)?.[0]).toMatchObject({ shipmentId: id, shipmentCode: `S-${id}` });
      view.unmount();
    }
    expect(mocks.shipment.mock.calls.map((call) => call[1])).toEqual(["fila-uno", "fila-dos"]);
  });

  it("recargar el panel seleccionado lleva al Tracking exacto, no a la ficha comodín", async () => {
    await EmbarquesDirecta(seleccion("envio-antiguo-201"));
    expect(mocks.gate).toHaveBeenCalledWith("tracking");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/studio/tracking/envio-antiguo-201");
  });
});
