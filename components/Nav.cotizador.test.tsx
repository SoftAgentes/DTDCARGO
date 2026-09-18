/**
 * SDD-0473 · El cotizador en el menú principal, sólo cuando existe.
 *
 * Founder 2026-09-18: «agrega el cotizador al menú principal». Va pegado a
 * Tarifas, en la barra de escritorio y en el menú móvil. Con
 * `DOCUMENT_IMPORT_ENABLED` apagada —el estado de producción hasta cerrar la
 * compuerta de privacidad— /cotizador es 404, así que el menú tiene que quedar
 * EXACTAMENTE como estaba: mismos enlaces, mismo orden, ninguno de más.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { Nav } from "./Nav";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const ANTES = ["Tarifas", "Servicios", "Pre-alertas", "Actualidad"];
const CON_COTIZADOR = ["Tarifas", "Cotizador", "Servicios", "Pre-alertas", "Actualidad"];

/** Enlaces principales de la barra de escritorio, en orden, antes de «Contáctenos». */
function barra(): string[] {
  const principal = screen.getAllByRole("navigation")[0];
  const nombres = within(principal).getAllByRole("link").map((a) => a.textContent?.trim() ?? "");
  const inicio = nombres.indexOf("Tarifas");
  return nombres.slice(inicio, nombres.indexOf("Contáctenos", inicio));
}

async function drawer(): Promise<string[]> {
  await userEvent.setup().click(screen.getByRole("button", { name: /abrir menú/i }));
  const menu = screen.getByRole("dialog", { name: /menú de navegación/i });
  const nombres = within(menu).getAllByRole("link").map((a) => a.textContent?.trim() ?? "");
  const inicio = nombres.indexOf("Tarifas");
  return nombres.slice(inicio, inicio + (nombres.includes("Cotizador") ? 5 : 4));
}

describe("Nav · cotizador en el menú principal (SDD-0473)", () => {
  it("con la bandera encendida, va después de Tarifas en la barra y en el menú móvil", async () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    render(<Nav />);
    expect(barra()).toEqual(CON_COTIZADOR);
    for (const a of screen.getAllByRole("link", { name: "Cotizador" })) expect(a).toHaveAttribute("href", "/cotizador");
    expect(await drawer()).toEqual(CON_COTIZADOR);
  });

  it("con cualquier otro valor, el menú queda exactamente como antes", async () => {
    for (const valor of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      render(<Nav />);
      expect(barra(), `DOCUMENT_IMPORT_ENABLED=${JSON.stringify(valor)}`).toEqual(ANTES);
      expect(document.querySelector('a[href="/cotizador"]')).toBeNull();
      // Ni un píxel distinto: el espaciado de la barra es el de siempre.
      expect(fila().className).toContain(" gap-x-1.5 ");
      for (const el of espaciables()) expect(el.className).toMatch(/(^|\s)px-2\s/);
      expect(await drawer()).toEqual(ANTES);
      cleanup();
    }
  });

  it("con el cotizador, la barra se aprieta sólo entre lg y xl, que es donde no entraba", () => {
    // Medido a 1024 con el espaciado de siempre: scrollWidth 1021 contra 1009.
    // Con hueco 0 y relleno 6 px sobran 18 px. Desde xl, las clases de siempre.
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    render(<Nav />);
    expect(fila().className).toContain(" gap-x-0 ");
    expect(fila().className).toContain("xl:gap-x-3");
    for (const el of espaciables()) {
      expect(el.className).toMatch(/(^|\s)px-1\.5\s/);
      expect(el.className).toContain("xl:px-2.5");
    }
  });
});

/** La fila de escritorio: el contenedor de enlaces, «Contáctenos», «Ayuda» y el botón. */
function fila(): HTMLElement {
  const tarifas = within(screen.getAllByRole("navigation")[0]).getByRole("link", { name: "Tarifas" });
  return tarifas.parentElement as HTMLElement;
}
/** Lo que lleva relleno horizontal en esa fila: enlaces principales, «Contáctenos» y «Ayuda». */
function espaciables(): HTMLElement[] {
  const f = fila();
  return [...f.querySelectorAll<HTMLElement>(":scope > a:not(.btn), :scope > details > summary")];
}
