import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { armarColumnas, type CrmEtapa, type CrmTarjetaTablero } from "@/lib/studio/crm-tablero";
import { CrmEmbudosLista } from "./CrmEmbudosLista";

afterEach(cleanup);

const ETAPAS: CrmEtapa[] = [
  { tablero: "leads", clave: "nuevo", nombre: "Nuevo", orden: 10, terminal: false, sistema: true, activa: true },
  { tablero: "leads", clave: "contactado", nombre: "Contactado", orden: 20, terminal: false, sistema: true, activa: true },
];

const base: CrmTarjetaTablero = {
  id: "t-1",
  nombre: "Lead uno",
  shippingMark: null,
  segmento: "lead_nuevo",
  tablero: "leads",
  etapa: "nuevo",
  origen: null,
  diasEnEtapa: 2,
  asesorNombre: null,
  tareasAbiertas: 0,
  tareasVencidas: 0,
  fuente: "whatsapp_leads",
  utmSource: null,
};

const TARJETAS: CrmTarjetaTablero[] = [
  base,
  { ...base, id: "t-2", nombre: "Lead dos", etapa: "contactado", fuente: "instagram", diasEnEtapa: 40, tareasVencidas: 1 },
  { ...base, id: "t-3", nombre: "Lead tres", diasEnEtapa: 9, fuente: "manual" },
];

function pintar(onOpen = vi.fn()) {
  render(
    <CrmEmbudosLista tablero="leads" columnas={armarColumnas(ETAPAS, TARJETAS, "leads")} onOpen={onOpen} />,
  );
  return onOpen;
}

describe("CrmEmbudosLista (SDD-0648 §3, D6)", () => {
  it("muestra las mismas tarjetas, por etapa y la más antigua primero dentro de cada etapa", () => {
    pintar();
    const filas = screen.getAllByRole("row").slice(1);
    expect(filas.map((f) => f.getAttribute("data-tarjeta-id"))).toEqual(["t-3", "t-1", "t-2"]);
  });

  it("cada fila dice el canal con texto, no solo con el logo", () => {
    pintar();
    const fila = document.querySelector('[data-tarjeta-id="t-2"]') as HTMLElement;
    // El texto visible, no el <title> del logo.
    expect(within(fila).getByText("Instagram", { selector: "span" })).toBeTruthy();
    expect(within(fila).getByText("1 vencida")).toBeTruthy();
    expect(within(fila).getByText(/más de 30 días/)).toBeTruthy();
  });

  it("el nombre abre la ficha", async () => {
    const user = userEvent.setup();
    const onOpen = pintar();
    await user.click(screen.getByRole("button", { name: "Abrir ficha de Lead dos" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "t-2" }));
  });

  it("sin tarjetas lo dice", () => {
    render(<CrmEmbudosLista tablero="leads" columnas={armarColumnas(ETAPAS, [], "leads")} onOpen={vi.fn()} />);
    expect(screen.getByText("Sin tarjetas en este embudo.")).toBeTruthy();
  });
});
