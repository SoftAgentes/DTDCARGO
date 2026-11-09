/**
 * Auditoría SEO, GEO y AEO del 2026-11-07 (Lighthouse 13.6, PageSpeed Insights).
 *
 * El menú móvil cerrado queda fuera de pantalla con `aria-hidden="true"`, pero sus
 * enlaces y su botón seguían recibiendo el foco: quien navega con teclado tabulaba
 * hacia enlaces invisibles, y Lighthouse lo marca en Accesibilidad y en
 * «Navegación con agentes» (árbol de accesibilidad mal formado). `inert` saca el
 * cajón cerrado del orden de foco sin cambiar nada de lo que se ve.
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

describe("menú móvil · fuera del foco mientras está cerrado", () => {
  it("cerrado: oculto para lectores y fuera del orden de tabulación", () => {
    render(<Nav />);
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(drawer()).toHaveAttribute("inert");
  });

  it("abierto: vuelve a ser interactivo", async () => {
    const user = userEvent.setup();
    render(<Nav />);
    await user.click(screen.getByRole("button", { name: /abrir menú/i }));
    expect(drawer()).not.toHaveAttribute("inert");
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
  });
});
