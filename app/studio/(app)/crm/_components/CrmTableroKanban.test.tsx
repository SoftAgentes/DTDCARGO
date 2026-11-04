import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  armarColumnas,
  type CrmEtapa,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";
import { CrmTableroKanban } from "./CrmTableroKanban";

afterEach(cleanup);

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "contactado", nombre: "Contactado", orden: 20, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "perdido", nombre: "Perdido", orden: 90, terminal: true, sistema: true, activa: true },
  { tablero: "clientes", clave: "activo", nombre: "Activo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "clientes", clave: "postventa", nombre: "Postventa", orden: 20, terminal: false, sistema: true, activa: true },
];

const lead: CrmTarjetaTablero = {
  id: "t-1",
  nombre: "Lead de prueba",
  shippingMark: null,
  segmento: "lead_registrado",
  tablero: "leads",
  etapa: "nuevo",
  origen: { tablero: "clientes", etapa: "postventa", vuelta: true },
  diasEnEtapa: 45,
  asesorNombre: "Asesora de prueba",
  tareasAbiertas: 2,
  tareasVencidas: 1,
};

function pintar({
  canEdit = true,
  tarjetas = [lead],
  onMove = vi.fn<(t: CrmTarjetaTablero, d: CrmEtapa) => void>(),
  onOpen = vi.fn<(t: CrmTarjetaTablero) => void>(),
}: {
  canEdit?: boolean;
  tarjetas?: CrmTarjetaTablero[];
  onMove?: Mock<(t: CrmTarjetaTablero, d: CrmEtapa) => void>;
  onOpen?: Mock<(t: CrmTarjetaTablero) => void>;
} = {}) {
  render(
    <CrmTableroKanban
      tablero="leads"
      columnas={armarColumnas(ETAPAS, tarjetas, "leads")}
      etapas={ETAPAS}
      canEdit={canEdit}
      moviendo={new Set()}
      onMove={onMove}
      onOpen={onOpen}
    />,
  );
  return { onMove, onOpen };
}

describe("CrmTableroKanban · columnas y tarjeta", () => {
  it("pinta las etapas de Leads en orden y la tarjeta en su columna", () => {
    pintar();
    const columnas = screen.getAllByRole("region");
    expect(columnas.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Etapa Nuevo",
      "Etapa Contactado",
      "Etapa Perdido",
    ]);
    expect(within(columnas[0]).getByText("Lead de prueba")).toBeTruthy();
    expect(within(columnas[1]).getByText("Sin tarjetas en esta etapa.")).toBeTruthy();
  });

  it("dice de dónde vino, el dueño, el segmento y la tarea vencida", () => {
    pintar();
    expect(screen.getByText(/Volvió de Clientes · Postventa/)).toBeTruthy();
    expect(screen.getByText("Asesora de prueba")).toBeTruthy();
    expect(screen.getByText("Registrado")).toBeTruthy();
    expect(screen.getByText("1 tarea vencida")).toBeTruthy();
    // La antigüedad no depende solo del color.
    expect(screen.getByText(/más de 30 días/)).toBeTruthy();
  });
});

describe("CrmTableroKanban · mover (DND-01)", () => {
  it("con teclado: el selector alcanza cualquier etapa activa del tablero, sin la actual", async () => {
    const user = userEvent.setup();
    const { onMove } = pintar();
    const selector = screen.getByRole("combobox", { name: "Mover Lead de prueba a otra etapa" });
    const opciones = within(selector)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual(["Mover a…", "Contactado", "Perdido"]);

    await user.selectOptions(selector, "contactado");
    expect(onMove).toHaveBeenCalledWith(lead, expect.objectContaining({ clave: "contactado" }));
  });

  it("arrastrando: soltar en otra columna mueve; soltar en la misma no", () => {
    const { onMove } = pintar();
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => {
        store[k] = v;
      },
      getData: (k: string) => store[k] ?? "",
      effectAllowed: "",
    };
    const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
    fireEvent.dragStart(card, { dataTransfer });

    fireEvent.drop(screen.getByRole("region", { name: "Etapa Nuevo" }), { dataTransfer });
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.drop(screen.getByRole("region", { name: "Etapa Contactado" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(lead, expect.objectContaining({ clave: "contactado" }));
  });

  it("abrir la ficha es un botón propio, aparte del arrastre", async () => {
    const user = userEvent.setup();
    const { onOpen } = pintar();
    await user.click(screen.getByRole("button", { name: "Abrir ficha de Lead de prueba" }));
    expect(onOpen).toHaveBeenCalledWith(lead);
  });

  it("sin permiso de edición: no hay selector ni arrastre, pero la ficha se abre", () => {
    const { onMove } = pintar({ canEdit: false });
    expect(screen.queryByRole("combobox")).toBeNull();
    const card = document.querySelector('[data-tarjeta-id="t-1"]')!;
    expect(card.getAttribute("draggable")).toBe("false");
    const dataTransfer = { getData: () => "t-1", setData: () => {} };
    fireEvent.drop(screen.getByRole("region", { name: "Etapa Contactado" }), { dataTransfer });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Abrir ficha de Lead de prueba" })).toBeTruthy();
  });
});
