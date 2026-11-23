/**
 * SDD-0714 · lo guardado en la cuenta gana sobre lo local al cargar; sin nada en la
 * cuenta, la elección explícita de este navegador se sube una vez; Automático sigue
 * al sistema en vivo.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardar = vi.hoisted(() => vi.fn(async () => ({ ok: true }) as { ok: true } | { error: string }));
vi.mock("@/app/studio/(app)/_actions/apariencia-actions", () => ({ guardarAparienciaAction: guardar }));

import { AparienciaUsuario } from "../AparienciaUsuario";
import { aparienciaDeMetadata } from "../apariencia-usuario";
import { DENSITY_KEY, THEME_KEY, readTheme } from "../appearance-prefs";

const html = document.documentElement;

/** matchMedia falso que se puede cambiar desde la prueba. */
function sistema(oscuro: boolean) {
  const oyentes = new Set<() => void>();
  const mq = {
    matches: oscuro,
    addEventListener: (_: string, f: () => void) => oyentes.add(f),
    removeEventListener: (_: string, f: () => void) => oyentes.delete(f),
  };
  vi.stubGlobal("matchMedia", () => mq);
  return (nuevo: boolean) => {
    mq.matches = nuevo;
    oyentes.forEach((f) => f());
  };
}

describe("AparienciaUsuario · SDD-0714", () => {
  beforeEach(() => {
    localStorage.clear();
    delete html.dataset.density;
    delete html.dataset.theme;
    guardar.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("A6 · lo de la cuenta gana sobre lo local y actualiza el respaldo", () => {
    localStorage.setItem(DENSITY_KEY, "ultra");
    localStorage.setItem(THEME_KEY, "dark");
    render(<AparienciaUsuario guardada={{ vista: "normal", tema: "light" }} />);
    expect(localStorage.getItem(DENSITY_KEY)).toBe("normal");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(html.dataset.density).toBeUndefined();
    expect(html.dataset.theme).toBe("");
    expect(guardar).not.toHaveBeenCalled();
  });

  it("A6 · sin nada en la cuenta, sube la elección explícita de este navegador", async () => {
    localStorage.setItem(DENSITY_KEY, "ultra");
    await act(async () => {
      render(<AparienciaUsuario guardada={null} />);
    });
    expect(guardar).toHaveBeenCalledWith({ vista: "ultra", tema: "dark" });
  });

  it("sin nada en ningún lado no escribe nada", async () => {
    await act(async () => {
      render(<AparienciaUsuario guardada={null} />);
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it("A4 · Automático sigue al sistema en vivo", () => {
    const cambiar = sistema(false);
    render(<AparienciaUsuario guardada={{ vista: "compact", tema: "auto" }} />);
    expect(localStorage.getItem(THEME_KEY)).toBe("auto");
    expect(html.dataset.theme).toBe("");
    act(() => cambiar(true));
    expect(html.dataset.theme).toBe("dark");
    expect(readTheme()).toBe("dark");
    act(() => cambiar(false));
    expect(html.dataset.theme).toBe("");
  });

  it("con un tema fijo, el sistema no lo mueve", () => {
    const cambiar = sistema(false);
    render(<AparienciaUsuario guardada={{ vista: "compact", tema: "light" }} />);
    act(() => cambiar(true));
    expect(html.dataset.theme).toBe("");
  });
});

describe("aparienciaDeMetadata", () => {
  it("lee solo valores del catálogo", () => {
    expect(aparienciaDeMetadata({ studio_apariencia: { vista: "ultra", tema: "auto" } })).toEqual({ vista: "ultra", tema: "auto" });
    expect(aparienciaDeMetadata({ studio_apariencia: { vista: "spacious", tema: "auto" } })).toBeNull();
    expect(aparienciaDeMetadata({ studio_apariencia: "x" })).toBeNull();
    expect(aparienciaDeMetadata({})).toBeNull();
    expect(aparienciaDeMetadata(null)).toBeNull();
  });
});
