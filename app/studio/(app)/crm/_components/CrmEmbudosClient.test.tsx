import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrmEtapa, CrmTarjetaTablero } from "@/lib/studio/crm-tablero";

const moverMock = vi.fn();
vi.mock("../tarjeta-actions", () => ({
  moverTarjetaAction: (...a: unknown[]) => moverMock(...a),
}));
vi.mock("./TarjetaFichaDrawer", () => ({
  TarjetaFichaDrawer: ({ tarjetaId }: { tarjetaId: string }) => <div>Ficha {tarjetaId}</div>,
}));
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn(), push: vi.fn() }),
}));
const toast = { show: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() };
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => toast }));

const { CrmEmbudosClient } = await import("./CrmEmbudosClient");

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "perdido", nombre: "Perdido", orden: 90, terminal: true, sistema: true, activa: true },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "clientes", clave: "postventa", nombre: "Postventa", orden: 20, terminal: false, sistema: true, activa: true },
];

const base = {
  shippingMark: null,
  origen: null,
  diasEnEtapa: 1,
  asesorNombre: null,
  tareasAbiertas: 0,
  tareasVencidas: 0,
  fuente: "manual",
  utmSource: null,
} as const;

const TARJETAS: CrmTarjetaTablero[] = [
  { ...base, id: "t-lead", nombre: "Lead de prueba", segmento: "lead_nuevo", tablero: "leads", etapa: "nuevo" },
  {
    ...base,
    id: "t-cliente",
    nombre: "Cliente de prueba",
    segmento: "cliente",
    tablero: "clientes",
    etapa: "activo",
    shippingMark: "DTD-0101",
    origen: { tablero: "leads", etapa: "nuevo", vuelta: false },
  },
];

const LEAD_CON_CODIGO: CrmTarjetaTablero = {
  ...base,
  id: "t-codigo",
  nombre: "Registrado sin carga",
  segmento: "lead_registrado",
  tablero: "leads",
  etapa: "nuevo",
  shippingMark: "DTD-9497",
};

function pintar(tarjetas = TARJETAS, ocultas = 0) {
  render(
    <CrmEmbudosClient
      etapas={ETAPAS}
      tarjetas={tarjetas}
      ocultas={ocultas}
      recortado={false}
      canEdit
      tableroInicial="leads"
    />,
  );
}

describe("CrmEmbudosClient", () => {
  it("tres segmentos con su conteo; cada tarjeta en exactamente uno (SDD-0647)", async () => {
    const user = userEvent.setup();
    pintar([...TARJETAS, LEAD_CON_CODIGO]);
    // SDD-0648: la vista Tablero | Lista suma su propio grupo de radios; aquí cuenta el de segmentos.
    const segmentos = screen.getByRole("radiogroup", { name: "Segmento" });
    expect(within(segmentos).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Clientes (1)",
      "Leads (1)",
      "Leads con código (1)",
    ]);
    // Leads: solo el que no tiene código.
    expect(screen.getByText("Lead de prueba")).toBeTruthy();
    expect(screen.queryByText("Registrado sin carga")).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Leads con código (1)" }));
    expect(screen.getByText("Registrado sin carga")).toBeTruthy();
    expect(screen.queryByText("Lead de prueba")).toBeNull();
    expect(screen.queryByText("Cliente de prueba")).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith("/studio/crm?tab=embudos&embudo=leads_con_codigo", {
      scroll: false,
    });

    await user.click(screen.getByRole("radio", { name: "Clientes (1)" }));
    expect(screen.getByText("Cliente de prueba")).toBeTruthy();
    expect(screen.queryByText("Registrado sin carga")).toBeNull();
  });

  it("abre en la vista que dice la URL", () => {
    render(
      <CrmEmbudosClient
        etapas={ETAPAS}
        tarjetas={[...TARJETAS, LEAD_CON_CODIGO]}
        ocultas={0}
        recortado={false}
        canEdit
        tableroInicial="leads_con_codigo"
      />,
    );
    expect(screen.getByRole("radio", { name: "Leads con código (1)" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Registrado sin carga")).toBeTruthy();
  });

  it("los dos embudos con su conteo; cada tarjeta en el suyo", async () => {
    const user = userEvent.setup();
    pintar();
    expect(screen.getByRole("radio", { name: "Leads (1)" })).toBeTruthy();
    expect(screen.getByText("Lead de prueba")).toBeTruthy();
    expect(screen.queryByText("Cliente de prueba")).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Clientes (1)" }));
    expect(screen.getByText("Cliente de prueba")).toBeTruthy();
    expect(screen.getByText(/Vino de Leads · Nuevo/)).toBeTruthy();
    expect(replaceMock).toHaveBeenCalledWith("/studio/crm?tab=embudos&embudo=clientes", { scroll: false });
  });

  it("cerrar en Perdido pide motivo antes de llamar a la acción", async () => {
    const user = userEvent.setup();
    moverMock.mockResolvedValue({ ok: true, movida: true });
    pintar();
    // SDD-0648: mover va por el menú de la tarjeta.
    await user.click(screen.getByRole("button", { name: "Acciones de Lead de prueba" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover a Perdido" }));
    expect(moverMock).not.toHaveBeenCalled();

    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByRole("textbox"), "Compró con otro");
    await user.click(within(dialogo).getByRole("button", { name: "Mover a Perdido" }));

    await waitFor(() =>
      expect(moverMock).toHaveBeenCalledWith("t-lead", "leads", "perdido", "Compró con otro"),
    );
    await waitFor(() => expect(toast.show).toHaveBeenCalled());
  });

  it("si el servidor dice que no, avisa y la tarjeta vuelve a su columna", async () => {
    const user = userEvent.setup();
    moverMock.mockResolvedValue({ error: "Esa etapa ya no existe o está apagada." });
    pintar([TARJETAS[1]]);
    await user.click(screen.getByRole("radio", { name: "Clientes (1)" }));
    await user.click(screen.getByRole("button", { name: "Acciones de Cliente de prueba" }));
    await user.click(screen.getByRole("menuitem", { name: "Mover a Postventa" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Esa etapa ya no existe o está apagada."));
    await waitFor(() =>
      expect(within(screen.getByRole("region", { name: "Etapa Activo" })).getByText("Cliente de prueba")).toBeTruthy(),
    );
  });

  it("sin tarjetas: estado vacío que dice cuántas están escondidas por ficha borrada", () => {
    pintar([], 2);
    expect(screen.getByText("Todavía no hay tarjetas.")).toBeTruthy();
    expect(screen.getByText(/2 tarjetas escondidas porque sus fichas están borradas/)).toBeTruthy();
  });

  it("la búsqueda filtra por nombre y lo dice cuando no hay nada", async () => {
    const user = userEvent.setup();
    pintar();
    await user.type(screen.getByLabelText("Buscar por nombre o Shipping Mark"), "nadie");
    expect(screen.queryByText("Lead de prueba")).toBeNull();
    expect(screen.getByText("Ninguna tarjeta de Leads coincide con la búsqueda.")).toBeTruthy();
  });
});
