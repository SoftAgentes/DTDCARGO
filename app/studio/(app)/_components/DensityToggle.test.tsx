import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DENSITY_KEY } from "../../_components/appearance-prefs";
import { DensityToggle } from "./DensityToggle";

const marcado = (nombre: string) =>
  screen.getByRole("button", { name: nombre }).getAttribute("aria-pressed");

describe("Selector de vista · SDD-0688 fase 2", () => {
  beforeEach(() => {
    localStorage.removeItem(DENSITY_KEY);
    delete document.documentElement.dataset.density;
  });
  afterEach(cleanup);

  it("ofrece las tres vistas", () => {
    render(<DensityToggle />);
    for (const n of ["Normal", "Compacta", "Súper compacta"]) {
      expect(screen.getByRole("button", { name: n })).toBeTruthy();
    }
  });

  it("sin elección previa, Compacta nace marcada", () => {
    render(<DensityToggle />);
    expect(marcado("Compacta")).toBe("true");
    expect(marcado("Normal")).toBe("false");
    expect(marcado("Súper compacta")).toBe("false");
  });

  it("Normal quita el atributo, lo guarda y se marca", () => {
    render(<DensityToggle />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Normal" }));
    });
    expect(document.documentElement.dataset.density).toBeUndefined();
    expect(localStorage.getItem(DENSITY_KEY)).toBe("normal");
    expect(marcado("Normal")).toBe("true");
  });

  it("Súper compacta aplica ultra y lo guarda", () => {
    render(<DensityToggle />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Súper compacta" }));
    });
    expect(document.documentElement.dataset.density).toBe("ultra");
    expect(localStorage.getItem(DENSITY_KEY)).toBe("ultra");
    expect(marcado("Súper compacta")).toBe("true");
    expect(marcado("Compacta")).toBe("false");
  });

  it("una vista Amplia guardada antes se lee como Normal", () => {
    localStorage.setItem(DENSITY_KEY, "spacious");
    render(<DensityToggle />);
    expect(marcado("Normal")).toBe("true");
  });
});
