/**
 * Aviso · SDD-0628 — semántica, forma y acción.
 *
 * jsdom no calcula estilos ni contraste: eso lo mide `avisos-contract.test.ts`
 * sobre `studio.css` y `tokens.css`. Aquí se prueba lo que anuncia un lector
 * de pantalla, lo que se oprime y que el color no viaja en el estilo en línea.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Aviso, rolDeAviso, type AvisoTono } from "./Aviso";
import { ErrorAlert } from "./ErrorAlert";

afterEach(cleanup);

const TONOS: AvisoTono[] = ["info", "atencion", "exito", "error"];

describe("Aviso · SDD-0628", () => {
  it.each([
    ["info", "status"],
    ["atencion", "status"],
    ["exito", "status"],
    ["error", "alert"],
  ] as const)("tono %s se anuncia como %s", (tono, rol) => {
    render(<Aviso tono={tono}>Mensaje</Aviso>);
    expect(screen.getByRole(rol)).toHaveTextContent("Mensaje");
    expect(rolDeAviso(tono)).toBe(rol);
  });

  it("urgente convierte la atención en alert; sin urgente es status", () => {
    render(<Aviso tono="atencion" urgente>Bloquea el cierre</Aviso>);
    expect(screen.getByRole("alert")).toHaveTextContent("Bloquea el cierre");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el tono por defecto es info", () => {
    render(<Aviso>Dato</Aviso>);
    expect(screen.getByRole("status")).toHaveAttribute("data-tono", "info");
  });

  it.each(TONOS)("tono %s: franja con clase, icono oculto al lector y sin color en línea", (tono) => {
    const { container } = render(<Aviso tono={tono}>Texto</Aviso>);
    const franja = container.firstElementChild as HTMLElement;
    expect(franja).toHaveClass("studio-aviso");
    expect(franja).toHaveAttribute("data-tono", tono);
    expect(franja.getAttribute("style")).toBeNull();
    const svgs = franja.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute("aria-hidden", "true");
    // Ningún nodo del aviso pinta color, fondo, borde ni sombra en línea.
    for (const nodo of Array.from(franja.querySelectorAll<HTMLElement>("[style]"))) {
      expect(nodo.getAttribute("style")).not.toMatch(/color|background|border|shadow/i);
    }
  });

  it("cada tono usa un icono de forma distinta (no solo color)", () => {
    const formas = TONOS.map((tono) => {
      const { container } = render(<Aviso tono={tono}>x</Aviso>);
      const html = container.querySelector("svg")!.innerHTML;
      cleanup();
      return html;
    });
    expect(new Set(formas).size).toBe(TONOS.length);
  });

  it("título opcional en negrita antes del mensaje", () => {
    render(
      <Aviso tono="atencion" titulo="Falta el peso">
        Cotiza con un asesor.
      </Aviso>,
    );
    const titulo = screen.getByText("Falta el peso");
    expect(titulo.tagName).toBe("STRONG");
    expect(titulo).toHaveClass("studio-aviso-titulo");
    expect(screen.getByRole("status")).toHaveTextContent("Falta el pesoCotiza con un asesor.");
  });

  it("sin título no pinta el nodo del título", () => {
    const { container } = render(<Aviso>Solo mensaje</Aviso>);
    expect(container.querySelector(".studio-aviso-titulo")).toBeNull();
  });

  it("la acción es un botón secundario existente, con verbo, y se oprime con teclado", async () => {
    const onClick = vi.fn();
    render(
      <Aviso tono="error" accion={{ etiqueta: "Reintentar", onClick }}>
        No se pudo guardar.
      </Aviso>,
    );
    const boton = screen.getByRole("button", { name: "Reintentar" });
    expect(boton).toHaveAttribute("type", "button");
    expect(boton).toHaveClass("studio-btn", "studio-btn-ghost", "studio-btn-sm");
    boton.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("la acción deshabilitada no se dispara", async () => {
    const onClick = vi.fn();
    render(<Aviso accion={{ etiqueta: "Ver", onClick, disabled: true }}>x</Aviso>);
    await userEvent.click(screen.getByRole("button", { name: "Ver" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("compacto agrega su clase y reduce el icono", () => {
    const { container } = render(<Aviso compacto>x</Aviso>);
    expect(container.firstElementChild).toHaveClass("studio-aviso-compacto");
    expect(container.querySelector("svg")).toHaveAttribute("width", "14");
  });
});

describe("Aviso · foco por programa (enmienda de SDD-0603)", () => {
  it("sin tabIndex no es enfocable ni entra en el orden de Tab", () => {
    render(<Aviso tono="error">No se pudo guardar.</Aviso>);
    const alerta = screen.getByRole("alert");
    expect(alerta).not.toHaveAttribute("tabindex");
    alerta.focus();
    expect(alerta).not.toHaveFocus();
  });

  it("con tabIndex={-1} recibe el foco por programa y conserva rol, clases y tono", () => {
    const { container } = render(
      <Aviso tono="error" compacto tabIndex={-1}>
        No se pudo guardar.
      </Aviso>,
    );
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveAttribute("tabindex", "-1");
    alerta.focus();
    expect(alerta).toHaveFocus();
    expect(alerta.className).toBe("studio-aviso studio-aviso-compacto");
    expect(alerta).toHaveAttribute("data-tono", "error");
    expect(alerta.getAttribute("style")).toBeNull();
    // Lo encuentra el selector con el que `useDialogA11y` lleva el foco al error.
    expect(container.querySelector('[role="alert"][tabindex="-1"]')).toBe(alerta);
  });

  it("tabIndex no cambia el rol de un tono que no es error", () => {
    render(
      <Aviso tono="atencion" tabIndex={-1}>
        Revisa el monto.
      </Aviso>,
    );
    expect(screen.getByRole("status")).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ref apunta a la franja y sirve para enfocarla", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Aviso tono="error" tabIndex={-1} ref={ref}>
        No se pudo guardar.
      </Aviso>,
    );
    expect(ref.current).toBe(screen.getByRole("alert"));
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it("con y sin las props de foco el marcado es el mismo, salvo tabindex", () => {
    const sin = render(
      <Aviso tono="error" titulo="Falló">
        x
      </Aviso>,
    ).container.innerHTML;
    cleanup();
    const con = render(
      <Aviso tono="error" titulo="Falló" tabIndex={-1} ref={createRef<HTMLDivElement>()}>
        x
      </Aviso>,
    ).container.innerHTML;
    expect(con).toContain('tabindex="-1"');
    expect(con.replace(' tabindex="-1"', "")).toBe(sin);
  });
});

describe("ErrorAlert sobre Aviso · misma API", () => {
  it("sin error no pinta nada", () => {
    const { container } = render(<ErrorAlert state={{}} />);
    expect(container.innerHTML).toBe("");
  });

  it("con error pinta una franja de error con role=alert y sin estilo en línea", () => {
    const { container } = render(<ErrorAlert state={{ error: "No se pudo guardar." }} />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("No se pudo guardar.");
    expect(alerta).toHaveClass("studio-aviso");
    expect(alerta).toHaveAttribute("data-tono", "error");
    expect(container.querySelector("[style*='background']")).toBeNull();
  });

  it("compact pasa a compacto", () => {
    render(<ErrorAlert state={{ error: "x" }} compact />);
    expect(screen.getByRole("alert")).toHaveClass("studio-aviso-compacto");
  });
});
