/**
 * SDD-0654 fase 2 · guía de la Vista simple (AC-15).
 *
 * Arranca sola solo la primera vez y lo marca en la base; se puede saltar; se
 * repite con «Guía» (evento o `?guia=1`); su tarjeta es un diálogo que contiene
 * el foco y se cierra con Escape.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTO_ABRIR_GUIA, EVENTO_ABRIR_TUTORIAL } from "@/lib/portal/simple/eventos";

const markPortalGuiaVistaAction = vi.fn(async () => ({ ok: true }));
const replace = vi.fn();
let params = new URLSearchParams();

vi.mock("../../../actions", () => ({ markPortalGuiaVistaAction: () => markPortalGuiaVistaAction() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/portal",
  useSearchParams: () => params,
}));

const { GuiaPortal } = await import("../GuiaPortal");

/** La pantalla con las anclas de los bloques, como el inicio simple. */
function Pantalla({ guiaVista }: { guiaVista: boolean }) {
  return (
    <div>
      <button type="button">antes</button>
      <section data-guia="donde">1</section>
      <section data-guia="tareas">2</section>
      <section data-guia="proveedor">
        <ul data-guia="proveedores" />
        <span data-guia="codigo-dtd" />
        <span data-guia="codigo-cliente" />
        <span data-guia="codigo-proveedor" />
        <span data-guia="codigo-compra" />
        <pre data-guia="mensaje" />
      </section>
      <section data-guia="duda">6</section>
      <div data-guia="vista" />
      <GuiaPortal guiaVista={guiaVista} />
    </div>
  );
}

beforeEach(() => {
  markPortalGuiaVistaAction.mockClear();
  replace.mockClear();
  params = new URLSearchParams();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const dialogo = () => screen.queryByRole("dialog");

describe("GuiaPortal", () => {
  it("la primera vez arranca sola, lo marca en la base y es un diálogo modal", () => {
    render(<Pantalla guiaVista={false} />);
    const d = screen.getByRole("dialog", { name: "Te mostramos tu portal en 1 minuto" });
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(markPortalGuiaVistaAction).toHaveBeenCalledTimes(1);
  });

  it("si ya la vio, no arranca sola", () => {
    render(<Pantalla guiaVista />);
    expect(dialogo()).toBeNull();
    expect(markPortalGuiaVistaAction).not.toHaveBeenCalled();
  });

  it("recorre los 4 consejos y pregunta si quiere 2 más; «Listo por ahora» la cierra", () => {
    render(<Pantalla guiaVista={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    const etiquetas: string[] = [];
    for (let i = 0; i < 4; i++) {
      etiquetas.push(screen.getByText(/^Consejo \d de 4$/).textContent ?? "");
      fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    }
    expect(etiquetas).toEqual(["Consejo 1 de 4", "Consejo 2 de 4", "Consejo 3 de 4", "Consejo 4 de 4"]);
    expect(screen.getByRole("dialog", { name: "Ya sabes lo básico" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Listo por ahora" }));
    expect(dialogo()).toBeNull();
  });

  it("«Ahora no» la salta en cualquier paso, y Escape también", () => {
    render(<Pantalla guiaVista={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(dialogo()).toBeNull();
    act(() => {
      window.dispatchEvent(new Event(EVENTO_ABRIR_GUIA));
    });
    expect(dialogo()).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogo()).toBeNull();
  });

  it("el foco entra al diálogo y Tab no se escapa de él", () => {
    render(<Pantalla guiaVista={false} />);
    const d = screen.getByRole("dialog");
    expect(d.contains(document.activeElement)).toBe(true);
    const botones = d.querySelectorAll("button");
    const ultimo = botones[botones.length - 1] as HTMLElement;
    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(d.contains(document.activeElement)).toBe(true);
    (botones[0] as HTMLElement).focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(d.contains(document.activeElement)).toBe(true);
  });

  it("se repite con «Guía» desde otra pantalla (?guia=1) y limpia la URL", () => {
    params = new URLSearchParams("guia=1");
    render(<Pantalla guiaVista />);
    expect(screen.getByRole("dialog", { name: "Te mostramos tu portal en 1 minuto" })).toBeInTheDocument();
    // Una sola vez, aunque el router del doble cambie de identidad en cada
    // render (antes eso volvía a abrir la guía sin fin).
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/portal", { scroll: false });
    expect(markPortalGuiaVistaAction).not.toHaveBeenCalled();
  });

  it("el tutorial del código arranca en el paso 1 de 6", () => {
    render(<Pantalla guiaVista />);
    act(() => {
      window.dispatchEvent(new Event(EVENTO_ABRIR_TUTORIAL));
    });
    expect(screen.getByRole("dialog", { name: "Primero, elige a tu proveedor" })).toBeInTheDocument();
    expect(screen.getByText("Paso 1 de 6")).toBeInTheDocument();
  });
});
