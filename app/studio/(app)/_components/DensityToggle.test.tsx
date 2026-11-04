import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DENSITY_KEY } from "../../_components/appearance-prefs";
import { DensityToggle } from "./DensityToggle";

describe("DensityToggle · SDD-0603", () => {
  beforeEach(() => {
    localStorage.removeItem(DENSITY_KEY);
    delete document.documentElement.dataset.density;
  });
  afterEach(cleanup);

  it("nace en normal y sin marcar", () => {
    render(<DensityToggle />);
    expect(screen.getByRole("button", { name: "Compacto" }).getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.dataset.density).toBeUndefined();
  });

  it("al oprimirlo aplica compacto, lo guarda y se marca", () => {
    render(<DensityToggle />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Compacto" }));
    });
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(localStorage.getItem(DENSITY_KEY)).toBe("compact");
    expect(screen.getByRole("button", { name: "Compacto" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("al oprimirlo otra vez vuelve a normal", () => {
    localStorage.setItem(DENSITY_KEY, "compact");
    document.documentElement.dataset.density = "compact";
    render(<DensityToggle />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Compacto" }));
    });
    expect(document.documentElement.dataset.density).toBeUndefined();
    expect(localStorage.getItem(DENSITY_KEY)).toBe("normal");
    expect(screen.getByRole("button", { name: "Compacto" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("no pisa la vista espaciosa elegida en Administración hasta que se oprime", () => {
    localStorage.setItem(DENSITY_KEY, "spacious");
    document.documentElement.dataset.density = "spacious";
    render(<DensityToggle />);
    expect(document.documentElement.dataset.density).toBe("spacious");
    expect(screen.getByRole("button", { name: "Compacto" }).getAttribute("aria-pressed")).toBe("false");
  });
});
