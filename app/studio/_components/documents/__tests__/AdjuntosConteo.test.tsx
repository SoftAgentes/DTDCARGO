/** SDD-0507 · el indicador se lee como texto, no sólo como color. */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AdjuntosConteo } from "../AdjuntosConteo";

describe("<AdjuntosConteo>", () => {
  it("con adjuntos: el número y la palabra (oculta en la celda), y el desglose en title", () => {
    const { container } = render(<AdjuntosConteo total={5} desglose="5 adjuntos: 2 en su ficha" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.textContent).toBe("5 adjuntos");
    expect(chip.getAttribute("title")).toBe("5 adjuntos: 2 en su ficha");
    expect(chip.querySelector(".studio-sr-only")?.textContent).toBe(" adjuntos");
    // El icono es decoración: no se anuncia.
    expect(chip.querySelector("svg")?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("singular", () => {
    const { container } = render(<AdjuntosConteo total={1} desglose="1 adjunto" />);
    expect(container.textContent).toBe("1 adjunto");
  });

  it("sin adjuntos: la palabra, sin ficha ni icono", () => {
    const { container } = render(<AdjuntosConteo total={0} desglose="Sin adjuntos" />);
    expect(container.textContent).toBe("Ninguno");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("en la tarjeta de Tracking la palabra se ve", () => {
    const con = render(<AdjuntosConteo total={2} desglose="x" variante="tarjeta" />);
    expect(con.container.textContent).toBe("2 adjuntos");
    expect(con.container.querySelector(".studio-sr-only")).toBeNull();
    const sin = render(<AdjuntosConteo total={0} desglose="x" variante="tarjeta" />);
    expect(sin.container.textContent).toBe("Sin adjuntos");
  });
});
