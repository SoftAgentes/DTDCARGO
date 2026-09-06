/**
 * Tests del DestinoCombobox (SDD-0237).
 *
 * Lo que se protege acá es lo que se rompe en un selector de 178 opciones:
 * que filtre, que no exija tildes, que el estado se VEA pero no se BUSQUE
 * (decisión del founder), que los destinos que no cotizan lleguen marcados, y
 * que salir sin elegir nunca deje un texto a medias donde debería haber un
 * destino válido.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Ciudad } from "@/lib/calculadora";
import { DestinoCombobox } from "./DestinoCombobox";

const CIUDADES: Ciudad[] = [
  { id: "valencia", label: "Valencia (sede)", km: 0, casco: true, ventaCbm: 105.94, cubierta: true, estado: "Carabobo" },
  { id: "carupano", label: "Carúpano", km: 0, casco: false, ventaCbm: 176.57, cubierta: true, estado: "Sucre" },
  { id: "cariaco", label: "Cariaco", km: 0, casco: false, ventaCbm: null, cubierta: false, cercana: "cumana", estado: "Sucre" },
  { id: "maracaibo", label: "Maracaibo", km: 410, casco: false, ventaCbm: 123.6, cubierta: true, estado: "Zulia" },
  { id: "sin-precio", label: "Pueblo Sin Precio", km: 0, casco: false, ventaCbm: null, cubierta: true, estado: "Falcón" },
];

function Harness() {
  const [value, setValue] = useState("valencia");
  return (
    <>
      <DestinoCombobox id="ciudad" ciudades={CIUDADES} value={value} onChange={setValue} />
      <output data-testid="elegido">{value}</output>
    </>
  );
}

const combo = () => screen.getByRole("combobox");
const opciones = () => within(screen.getByRole("listbox")).getAllByRole("option");

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DestinoCombobox", () => {
  it("muestra la ciudad elegida y abre con TODAS al enfocar", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(combo()).toHaveValue("Valencia (sede)");
    await user.click(combo());
    // Al abrir NO se filtra por el texto que ya está puesto: si filtrara,
    // verías una sola opción y el selector sería inútil para cambiar de ciudad.
    expect(opciones()).toHaveLength(CIUDADES.length);
  });

  it("filtra por nombre de ciudad", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("maraca");
    const items = opciones();
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Maracaibo");
  });

  it("encuentra sin tildes: 'carupano' → Carúpano", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("carupano");
    expect(opciones()).toHaveLength(1);
    expect(opciones()[0]).toHaveTextContent("Carúpano");
  });

  it("muestra el estado pero NO busca por él (founder 1-ago-2026)", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    // Se ve, para desambiguar homónimos.
    expect(within(screen.getByRole("listbox")).getByText("Zulia")).toBeInTheDocument();
    // Pero no matchea: escribir un estado no lista sus ciudades.
    await user.keyboard("zulia");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("listbox")).toHaveTextContent("No encontramos esa ciudad");
  });

  it("marca los destinos que no cotizan solos, y sólo esos", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combo());

    const porTexto = (t: string) => opciones().find((o) => o.textContent?.includes(t))!;
    expect(porTexto("Cariaco")).toHaveTextContent("No llegamos");
    expect(porTexto("Pueblo Sin Precio")).toHaveTextContent("A medida");
    // Las que cotizan van limpias — incluida la de zona sin costo.
    expect(porTexto("Valencia")).not.toHaveTextContent("A medida");
    expect(porTexto("Maracaibo")).not.toHaveTextContent("No llegamos");
  });

  it("selecciona con teclado (↓ + Enter) y propaga el slug", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    // Abre parado en la elegida (índice 0 = valencia) → ↓ va a la siguiente.
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("elegido")).toHaveTextContent("carupano");
    expect(combo()).toHaveValue("Carúpano");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selecciona con el mouse", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("cariaco");
    await user.click(opciones()[0]);
    expect(screen.getByTestId("elegido")).toHaveTextContent("cariaco");
  });

  it("Escape descarta lo tipeado y restaura el destino elegido", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("mara");
    expect(combo()).toHaveValue("mara");

    await user.keyboard("{Escape}");
    // Un texto a medias NO es un destino: el valor real sigue siendo el slug.
    expect(combo()).toHaveValue("Valencia (sede)");
    expect(screen.getByTestId("elegido")).toHaveTextContent("valencia");
  });

  it("reemplaza la etiqueta al escribir antes del primer frame de foco", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("mara");
    expect(combo()).toHaveValue("mara");
    act(() => frames.forEach((callback) => callback(0)));
    expect(combo()).toHaveValue("mara");
  });

  it("un frame de foco entre letras no selecciona la búsqueda ya escrita", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    // Aislamos el frame tardío del mecanismo de selección del clic inicial.
    // El navegador ya tiene la etiqueta seleccionada cuando empiezan las teclas.
    (combo() as HTMLInputElement).select();
    await user.keyboard("mar");
    expect(combo()).toHaveValue("mar");
    act(() => frames.forEach((callback) => callback(0)));
    await user.keyboard("a");
    expect(combo()).toHaveValue("mara");
    await user.keyboard("{Escape}");
    expect(combo()).toHaveValue("Valencia (sede)");
    expect(screen.getByTestId("elegido")).toHaveTextContent("valencia");
  });

  it("respeta el cursor manual después de empezar a escribir", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(combo());
    await user.keyboard("mara");
    const input = combo() as HTMLInputElement;
    input.setSelectionRange(2, 2);
    fireEvent.mouseUp(input);
    await user.keyboard("x");
    expect(input).toHaveValue("maxra");
  });

  it("hacer click afuera tampoco deja un texto a medias", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(combo());
    await user.keyboard("xyz");
    await user.click(document.body);

    expect(combo()).toHaveValue("Valencia (sede)");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("expone el contrato ARIA de combobox", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(combo()).toHaveAttribute("aria-expanded", "false");
    await user.click(combo());
    expect(combo()).toHaveAttribute("aria-expanded", "true");
    expect(combo()).toHaveAttribute("aria-autocomplete", "list");

    const listbox = screen.getByRole("listbox");
    expect(combo()).toHaveAttribute("aria-controls", listbox.id);
    // El resaltado del teclado tiene que viajar por aria-activedescendant.
    await user.keyboard("{ArrowDown}");
    const activo = combo().getAttribute("aria-activedescendant");
    expect(activo).toBeTruthy();
    expect(document.getElementById(activo!)).toHaveTextContent("Carúpano");
  });
});
