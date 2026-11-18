import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PistaLey } from "../PistaLey";
import { NOTA_NO_VERIFICADO } from "@/lib/studio/nomina/ley/parametros";

afterEach(() => cleanup());

describe("PistaLey (SDD-0653)", () => {
  it("muestra el valor de ley de cada campo del grupo", () => {
    const { container } = render(<PistaLey campos={["overtime_pct", "night_pct", "holiday_pct"]} />);
    const texto = container.textContent ?? "";
    expect(texto).toContain("Según la ley:");
    expect(texto).toContain("Hora extra diurna ≥ 50 %");
    expect(texto).toContain("Bono nocturno ≥ 30 %");
    expect(texto).toContain("Día feriado ≥ 50 %");
  });

  it("un grupo verificado no lleva asterisco ni nota", () => {
    const { container } = render(<PistaLey campos={["overtime_pct", "night_pct", "holiday_pct"]} />);
    expect(container.textContent).not.toContain("*");
    expect(screen.queryByText(NOTA_NO_VERIFICADO)).toBeNull();
  });

  it("lo no verificado lleva asterisco oculto al lector, texto equivalente y la nota", () => {
    const { container } = render(<PistaLey campos={["min_salary", "cestaticket", "bono_guerra"]} />);
    // Salario mínimo está verificado; cestaticket y bono, no.
    const asteriscos = [...container.querySelectorAll('[aria-hidden="true"]')].filter((el) =>
      (el.textContent ?? "").includes("*"),
    );
    expect(asteriscos.length).toBe(3); // dos marcas y la de la nota
    expect(container.querySelectorAll(".studio-sr-only").length).toBe(2);
    expect(container.querySelector(".studio-sr-only")?.textContent).toContain("no verificado");
    expect(screen.getByText(NOTA_NO_VERIFICADO)).toBeTruthy();
    // Sin nombre accesible puesto en un elemento sin rol.
    expect(container.querySelector("span[aria-label]")).toBeNull();
  });

  it("sin parámetros para esos campos no pinta nada", () => {
    const { container } = render(<PistaLey campos={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
