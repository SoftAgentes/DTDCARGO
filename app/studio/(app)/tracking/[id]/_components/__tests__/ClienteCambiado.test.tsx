/**
 * SDD-0645 · D1 de Sam: el cambio de cliente se ve (anterior tachado, actual con
 * «nuevo»), «nuevo» explica por qué la etiqueta conserva el código, y el
 * historial dice cuándo, quién, de qué a qué y por qué.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ClienteCambiado } from "../ClienteCambiado";

afterEach(cleanup);

const CAMBIOS = [
  { fecha: "2026-11-17T15:00:00Z", actor: "Persona B", anterior: "DTD-1001", nuevo: "DTD-1002", motivo: null },
  { fecha: "2026-11-16T18:30:00Z", actor: "Persona A", anterior: "DTD-0000", nuevo: "DTD-1001", motivo: "Dueño real confirmado" },
];

describe("ClienteCambiado", () => {
  it("sin cambios no pinta nada", () => {
    const { container } = render(<ClienteCambiado shipmentCode="DTD-0000-64-1" cambios={[]} />);
    expect(container.textContent).toBe("");
  });

  it("tacha el anterior, marca el nuevo y explica el código al pulsar «nuevo»", async () => {
    const user = userEvent.setup();
    render(<ClienteCambiado shipmentCode="DTD-0000-64-1" cambios={CAMBIOS} />);
    const tachado = document.querySelector("s");
    expect(tachado?.textContent).toBe("Antes: DTD-1001");
    const nuevo = screen.getByRole("button", { name: "nuevo" });
    expect(nuevo).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/ya está impreso en las cajas/)).toBeNull();

    await user.click(nuevo);
    expect(nuevo).toHaveAttribute("aria-expanded", "true");
    const explicacion = screen.getByText(/ya está impreso en las cajas/);
    expect(explicacion.textContent).toContain("DTD-0000-64-1");
    expect(explicacion.textContent).toContain("el embarque es de DTD-1002 desde el");
    expect(explicacion.textContent).toMatch(/17 nov/);
  });

  it("el historial dice cuándo, quién, de qué a qué y el motivo, del más reciente al más viejo", () => {
    render(<ClienteCambiado shipmentCode="DTD-0000-64-1" cambios={CAMBIOS} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Persona B pasó el embarque de DTD-1001 a DTD-1002");
    expect(items[0]).not.toContain("Motivo");
    expect(items[1]).toContain("Persona A pasó el embarque de DTD-0000 a DTD-1001");
    expect(items[1]).toContain("Motivo: Dueño real confirmado");
    // Hora de Caracas (UTC−4): 18:30 Z son las 2:30 p. m.
    expect(items[1]).toMatch(/16 nov.*2:30/);
  });

  it("con el motivo oculto (China, B-1) dice que hay motivo, sin el texto", () => {
    render(
      <ClienteCambiado
        shipmentCode="DTD-0000-64-1"
        cambios={[{ ...CAMBIOS[1], motivo: null, motivoOculto: true }]}
      />,
    );
    const item = screen.getByRole("listitem").textContent ?? "";
    expect(item).toContain("Persona A pasó el embarque de DTD-0000 a DTD-1001. Motivo registrado");
    expect(item).not.toContain("Dueño real");
  });
});
