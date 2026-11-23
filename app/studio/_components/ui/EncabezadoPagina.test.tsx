import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EncabezadoPagina } from "./EncabezadoPagina";

describe("EncabezadoPagina · SDD-0688 fase 2", () => {
  afterEach(cleanup);

  it("pone un solo h1 con el título y usa el estilo de pantalla", () => {
    render(<EncabezadoPagina titulo="Tracking en vivo." />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe("Tracking en vivo.");
    expect(h1[0].className).toContain("t-pantalla");
  });

  it("eyebrow, subtítulo y acciones solo aparecen si se pasan", () => {
    const { container } = render(<EncabezadoPagina titulo="Solo título" />);
    expect(container.querySelector(".studio-eyebrow")).toBeNull();
    expect(container.querySelector(".studio-encabezado__sub")).toBeNull();
    expect(container.querySelector(".studio-encabezado__acciones")).toBeNull();
  });

  it("muestra eyebrow, subtítulo y acciones cuando se pasan", () => {
    render(
      <EncabezadoPagina
        eyebrow="Operación"
        titulo="Calendario"
        subtitulo="Detalle"
        acciones={<button type="button">Exportar</button>}
      />,
    );
    expect(screen.getByText("Operación")).toBeTruthy();
    expect(screen.getByText("Detalle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exportar" })).toBeTruthy();
  });

  it("el tono navy cambia solo colores, no la estructura", () => {
    const { container } = render(<EncabezadoPagina tono="navy" titulo="Hola" />);
    expect(container.querySelector("header")?.getAttribute("data-tono")).toBe("navy");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});
