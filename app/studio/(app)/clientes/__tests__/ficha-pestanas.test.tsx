/**
 * SDD-0669 · Pestañas de la ficha del cliente (`FichaPestanas`).
 *
 * - La activa sale de `?pestana=`, filtrada por las pestañas que llegaron: un
 *   valor ajeno o de una pestaña que el rol no tiene abre Resumen.
 * - Los paneles inactivos van con `hidden`; clic y teclado cambian la URL con
 *   `history.replaceState` (sin recargar).
 */
import { useSyncExternalStore } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sp = vi.hoisted(() => ({ actual: new URLSearchParams(), listeners: new Set<() => void>() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => useSyncExternalStore(
    (listener) => { sp.listeners.add(listener); return () => { sp.listeners.delete(listener); }; },
    () => sp.actual,
  ),
}));

import { EnlacePestana, FichaPestanas, type PestanaFicha } from "../_components/FichaPestanas";

const TODAS: PestanaFicha[] = [
  { id: "resumen", etiqueta: "Resumen", contenido: <p>panel resumen</p> },
  { id: "envios", etiqueta: "Envíos", n: 3, contenido: <p>panel envíos</p> },
  { id: "documentos", etiqueta: "Documentos", n: null, contenido: <p>panel documentos</p> },
  { id: "configuracion", etiqueta: "Configuración", contenido: <p>panel configuración</p> },
];

/** Entrada inicial o recarga: el router ya conoce la URL y su árbol interno. */
function conUrl(query: string) {
  window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ["fixture"] }, "", `/studio/clientes/DTD-0000${query}`);
  sp.actual = new URLSearchParams(window.location.search);
}

beforeEach(() => {
  conUrl("");
  const original = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "replaceState").mockImplementation((estado, titulo, url) => {
    // Contrato de Next app-router.js: las llamadas internas no notifican al router.
    // Este doble reactivo reproduce el límite de History; no ejecuta Next real.
    if (estado?.__NA || estado?._N) {
      original(estado, titulo, url);
      return;
    }
    const previo = window.history.state;
    original({ ...estado, __NA: previo?.__NA,
      __PRIVATE_NEXTJS_INTERNALS_TREE: previo?.__PRIVATE_NEXTJS_INTERNALS_TREE }, titulo, url);
    sp.actual = new URLSearchParams(window.location.search);
    sp.listeners.forEach((listener) => listener());
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
  it("recorre los cuatro paneles conservando parámetros, árbol y estado montado", () => {
    conUrl("?filtro=activo#detalle");
    const inicial = window.history.state;
    const longitud = window.history.length;
    render(<FichaPestanas pestanas={TODAS.map((p) => ({ ...p,
      contenido: <>{p.contenido}<input aria-label={`nota ${p.id}`} /></>,
    }))} />);
    fireEvent.change(screen.getByLabelText("nota resumen"), { target: { value: "borrador ficticio" } });
    for (const id of ["envios", "documentos", "configuracion", "resumen"] as const) {
      fireEvent.click(document.getElementById(`ficha-tab-${id}`)!);
      expect((document.getElementById(`ficha-panel-${id}`) as HTMLElement).hidden).toBe(false);
      expect(document.getElementById(`ficha-tab-${id}`)?.getAttribute("aria-selected")).toBe("true");
      expect(new URLSearchParams(window.location.search).get("pestana")).toBe(id === "resumen" ? null : id);
      expect(new URLSearchParams(window.location.search).get("filtro")).toBe("activo");
      expect(window.location.hash).toBe("#detalle");
      expect(window.history.state).toEqual(inicial);
      expect(window.history.length).toBe(longitud);
    }
    expect((screen.getByLabelText("nota resumen") as HTMLInputElement).value).toBe("borrador ficticio");
  });

  it.each(TODAS)("al volver a montar conserva el panel $id elegido por la URL", ({ id }) => {
    const vista = render(<FichaPestanas pestanas={TODAS} />);
    fireEvent.click(document.getElementById(`ficha-tab-${id}`)!);
    vista.unmount();
    // Simula la entrada del router tras recargar, sin forzar el render tras el clic.
    conUrl(`${window.location.search}${window.location.hash}`);
    render(<FichaPestanas pestanas={TODAS} />);
    expect((document.getElementById(`ficha-panel-${id}`) as HTMLElement).hidden).toBe(false);
  });

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
    render(<FichaPestanas pestanas={TODAS} />);
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: /Envíos/ }));
    });
    expect(window.location.search).toBe("?pestana=envios");
    expect(visible("panel envíos")).toBe(true);
    act(() => {
      fireEvent.click(screen.getByRole("tab", { name: "Resumen" }));
    });
    expect(window.location.search).toBe("");
  });

  it("flechas, Inicio y Fin recorren las pestañas y llevan el foco", () => {
    render(<FichaPestanas pestanas={TODAS} />);
    const resumen = screen.getByRole("tab", { name: "Resumen" });
    resumen.focus();
    act(() => {
      fireEvent.keyDown(resumen, { key: "ArrowLeft" });
    });
    expect(window.location.search).toBe("?pestana=configuracion");
    expect(visible("panel configuración")).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Configuración" }));
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "Home" });
    });
    expect(window.location.search).toBe("");
    expect(visible("panel resumen")).toBe(true);
    act(() => {
      fireEvent.keyDown(document.activeElement as Element, { key: "End" });
    });
    expect(visible("panel configuración")).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(visible("panel resumen")).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(visible("panel envíos")).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(visible("panel documentos")).toBe(true);
  });

  it("solo la activa entra al orden de Tab", () => {
    conUrl("?pestana=documentos");
    render(<FichaPestanas pestanas={TODAS} />);
    const indices = screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"));
    expect(indices).toEqual(["-1", "-1", "0", "-1"]);
  });
});

describe("EnlacePestana", () => {
  it.each(TODAS)("abre $id y lleva el foco sin render manual", ({ id }) => {
    conUrl("?filtro=activo#detalle");
    render(<><EnlacePestana pestana={id}>Ver sección</EnlacePestana>
      <FichaPestanas pestanas={TODAS} /></>);
    const scroll = vi.fn();
    document.getElementById("ficha-pestanas")!.scrollIntoView = scroll;
    fireEvent.click(screen.getByRole("link", { name: "Ver sección" }));
    expect((document.getElementById(`ficha-panel-${id}`) as HTMLElement).hidden).toBe(false);
    expect(document.activeElement).toBe(document.getElementById(`ficha-tab-${id}`));
    expect(new URLSearchParams(window.location.search).get("filtro")).toBe("activo");
    expect(window.location.hash).toBe("#detalle");
    expect(scroll).toHaveBeenCalled();
  });

  it("un acceso a una pestaña ausente no expone contenido del rol", () => {
    render(<><EnlacePestana pestana="configuracion">Ver configuración</EnlacePestana>
      <FichaPestanas pestanas={TODAS.filter((p) => p.id !== "configuracion")} /></>);
    document.getElementById("ficha-pestanas")!.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("link", { name: "Ver configuración" }));
    expect(screen.queryByText("panel configuración")).toBeNull();
    expect(visible("panel resumen")).toBe(true);
  });

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
