/**
 * Auditoría SEO, GEO y AEO del 2026-11-07 (Lighthouse 13.6, PageSpeed Insights).
 *
 * El menú móvil cerrado queda fuera de pantalla con `aria-hidden="true"`, pero sus
 * enlaces y su botón seguían recibiendo el foco: quien navega con teclado tabulaba
 * hacia enlaces invisibles, y Lighthouse lo marca en Accesibilidad y en
 * «Navegación con agentes» (árbol de accesibilidad mal formado). `inert` saca el
 * cajón cerrado del orden de foco sin cambiar nada de lo que se ve.
 *
 * Esta prueba mide los ATRIBUTOS (`inert` y `aria-hidden`), no el orden de
 * tabulación. Que el navegador saque del foco un elemento `inert` es comportamiento
 * de la plataforma; medirlo pediría un navegador real (Tab con Playwright), que
 * aquí no corre.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { Nav } from "./Nav";

beforeEach(() => cleanup());

function drawer(): HTMLElement {
  const el = document.getElementById("mobile-drawer");
  expect(el, "no se encontró #mobile-drawer").not.toBeNull();
  return el!;
}

describe("menú móvil · atributos del cajón según esté cerrado o abierto", () => {
  it("cerrado: aria-hidden=\"true\" e inert", () => {
    render(<Nav />);
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(drawer()).toHaveAttribute("inert");
  });

  it("abierto: sin inert y con aria-hidden=\"false\"", async () => {
    const user = userEvent.setup();
    render(<Nav />);
    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(drawer()).not.toHaveAttribute("inert");
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
  });
});
