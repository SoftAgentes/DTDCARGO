/**
 * SDD-0682 §2.2 · Una fila de «En camino»: número DTD, naviera, días, y al abrirla
 * las recepciones con su MARKBOX.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ContenedorEnCamino } from "@/lib/studio/almacen-cn-contenedores";
import { FilaCamino } from "../FilaCamino";

afterEach(cleanup);

function contenedor(over: Partial<ContenedorEnCamino> = {}): ContenedorEnCamino {
  return {
    id: "c-1",
    numeroDtd: 91,
    nombre: "DEMO-CONSOL-01",
    containerNo: "DEMO 000001-0",
    grupo: "mar",
    estadoLabel: "Zarpado",
    naviera: "Naviera demo",
    vessel: "Buque demo",
    eta: "2026-12-08",
    etaFuente: "itinerario",
    diasRestantes: 18,
    progreso: 55,
    clientes: 2,
    piezas: 8,
    recepciones: [
      { id: "r-1", codigo: "WR-C91-A", markbox: "DEMO-B", cajas: 5, cbm: 2 },
      { id: "r-2", codigo: "WR-C91-B", markbox: "DEMO-A", cajas: 3, cbm: 1.5 },
    ],
    ...over,
  };
}

describe("FilaCamino (SDD-0682)", () => {
  it("muestra el número DTD, la referencia, la naviera, los días y el avance", () => {
    render(<FilaCamino c={contenedor()} />);
    expect(screen.getByText("DTD #91")).toBeTruthy();
    expect(screen.getByText("DEMO-CONSOL-01 · DEMO 000001-0")).toBeTruthy();
    expect(screen.getByText("Naviera demo")).toBeTruthy();
    expect(screen.getByText("18 d")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("55");
  });

  it("sin número DTD se nombra por la referencia", () => {
    render(<FilaCamino c={contenedor({ numeroDtd: null })} />);
    expect(screen.getByText("DEMO-CONSOL-01")).toBeTruthy();
  });

  it("abre y cierra las recepciones, con su Shipping Mark", async () => {
    render(<FilaCamino c={contenedor()} />);
    const boton = screen.getByRole("button", { name: "Ver recepciones (2)" });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table")).toBeNull();

    await userEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    const tabla = screen.getByRole("table", { name: "Recepciones del contenedor DTD #91" });
    // ARIA válido: el panel es una fila con una celda, y la tabla vive en la celda.
    const celda = tabla.closest('[role="cell"]');
    expect(celda).not.toBeNull();
    expect(celda!.parentElement!.getAttribute("role")).toBe("row");
    // La celda cruza las 6 columnas de la tabla de «En camino».
    expect(celda!.getAttribute("aria-colspan")).toBe("6");
    const filas = within(tabla).getAllByRole("row");
    expect(filas).toHaveLength(3);
    expect(filas[1].textContent).toContain("WR-C91-A");
    expect(filas[1].textContent).toContain("DEMO-B");

    await userEvent.click(screen.getByRole("button", { name: "Ocultar recepciones" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("sin recepciones lo dice al abrir", async () => {
    render(<FilaCamino c={contenedor({ recepciones: [] })} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver recepciones (0)" }));
    expect(screen.getByText("Este contenedor no tiene recepciones consolidadas registradas.")).toBeTruthy();
  });
});
