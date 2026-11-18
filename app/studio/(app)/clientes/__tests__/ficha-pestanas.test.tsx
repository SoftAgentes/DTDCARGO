/**
 * SDD-0669 · Pestañas de la ficha del cliente (`FichaPestanas`).
 *
 * - La activa sale de `?pestana=`, filtrada por las pestañas que llegaron: un
 *   valor ajeno o de una pestaña que el rol no tiene abre Resumen.
 * - Los paneles inactivos van con `hidden`; clic y teclado cambian la URL con
 *   `history.replaceState` (sin recargar).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sp = vi.hoisted(() => ({ actual: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => sp.actual,
}));

import { EnlacePestana, FichaPestanas, type PestanaFicha } from "../_components/FichaPestanas";

const TODAS: PestanaFicha[] = [
  { id: "resumen", etiqueta: "Resumen", contenido: <p>panel resumen</p> },
  { id: "envios", etiqueta: "Envíos", n: 3, contenido: <p>panel envíos</p> },
  { id: "documentos", etiqueta: "Documentos", n: null, contenido: <p>panel documentos</p> },
  { id: "configuracion", etiqueta: "Configuración", contenido: <p>panel configuración</p> },
];

/** `replaceState` real de jsdom y, como hace Next, los params al día. */
function conUrl(query: string) {
  window.history.replaceState(null, "", `/studio/clientes/DTD-0000${query}`);
  sp.actual = new URLSearchParams(window.location.search);
}

beforeEach(() => {
  conUrl("");
  const original = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "replaceState").mockImplementation((estado, titulo, url) => {
    original(estado, titulo, url);
    sp.actual = new URLSearchParams(window.location.search);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function visible(texto: string): boolean {
  const panel = screen.getByText(texto).closest('[role="tabpanel"]') as HTMLElement;
  return !panel.hidden;
}

describe("FichaPestanas", () => {
  it("sin parámetro abre Resumen y esconde los demás paneles", () => {
    render(<FichaPestanas pestanas={TODAS} />);
    expect(screen.getByRole("tab", { name: "Resumen" }).getAttribute("aria-selected")).toBe("true");
    expect(visible("panel resumen")).toBe(true);
    expect(visible("panel envíos")).toBe(false);
    expect(visible("panel configuración")).toBe(false);
  });

  it("abre la pestaña de la URL", () => {
    conUrl("?pestana=configuracion");
    render(<FichaPestanas pestanas={TODAS} />);
    expect(visible("panel configuración")).toBe(true);
    expect(visible("panel resumen")).toBe(false);
  });

  it.each([["?pestana=otra"], ["?pestana="], ["?pestana=ENVIOS"]])("%s abre Resumen", (q) => {
    conUrl(q);
    render(<FichaPestanas pestanas={TODAS} />);
    expect(visible("panel resumen")).toBe(true);
  });

  it("la URL no abre una pestaña que no llegó para el rol", () => {
    conUrl("?pestana=configuracion");
    render(<FichaPestanas pestanas={TODAS.filter((p) => p.id !== "configuracion")} />);
    expect(screen.queryByRole("tab", { name: "Configuración" })).toBeNull();
    expect(screen.queryByText("panel configuración")).toBeNull();
    expect(visible("panel resumen")).toBe(true);
  });

  it("el contador sale al lado de la etiqueta; con null no sale", () => {
    render(<FichaPestanas pestanas={TODAS} />);
    expect(screen.getByRole("tab", { name: /Envíos/ }).textContent).toBe("Envíos3");
    expect(screen.getByRole("tab", { name: "Documentos" }).textContent).toBe("Documentos");
  });

  it("un clic cambia la URL sin recargar y muestra su panel", () => {
    const { rerender } = render(<FichaPestanas pestanas={TODAS} />);
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: /Envíos/ }));
    });
    expect(window.location.search).toBe("?pestana=envios");
    rerender(<FichaPestanas pestanas={TODAS} />);
    expect(visible("panel envíos")).toBe(true);
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    });
    expect(window.location.search).toBe("");
  });

  it("flechas, Inicio y Fin recorren las pestañas y llevan el foco", () => {
    const { rerender } = render(<FichaPestanas pestanas={TODAS} />);
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    resumen.focus();
    act(() => {
      fireEvent.keyDown(resumen, { key: "ArrowLeft" });
    });
    expect(window.location.search).toBe("?pestana=configuracion");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Configuración" }));
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    });
    expect(window.location.search).toBe("");
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    });
    rerender(<FichaPestanas pestanas={TODAS} />);
    expect(visible("panel configuración")).toBe(true);
  });

  it("solo la activa entra al orden de Tab", () => {
    conUrl("?pestana=documentos");
    render(<FichaPestanas pestanas={TODAS} />);
    const indices = screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"));
    expect(indices).toEqual(["-1", "-1", "0", "-1"]);
  });
});

describe("EnlacePestana", () => {
  it("sin JavaScript es un enlace a ?pestana=; con clic cambia la URL", () => {
    render(<EnlacePestana pestana="documentos">3 adjuntos · ver todos</EnlacePestana>);
    const a = screen.getByRole("link", { name: "3 adjuntos · ver todos" });
    expect(a.getAttribute("href")).toBe("?pestana=documentos");
    act(() => {
      fireEvent.click(a);
    });
    expect(window.location.search).toBe("?pestana=documentos");
  });
});
