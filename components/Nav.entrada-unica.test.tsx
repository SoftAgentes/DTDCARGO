/**
 * SDD-0276 · el nav tiene UNA sola puerta de cuenta, en las tres superficies.
 *
 * Antes había dos disparadores —"Acceder" de texto y "Regístrate" de color— y
 * en la barra móvil, donde sólo cabe un botón, "Acceder" ni aparecía. El
 * visitante tenía que decidir cuál de los dos era él antes de poder hacer nada.
 *
 * Lo que se protege:
 *  1. Un único punto de cuenta por superficie, apuntando a `/entrar`.
 *  2. La etiqueta conserva la palabra "crear". No es cosmética: el A/B de
 *     Mozilla Persona midió que un botón único de sólo-login produce 12,4×
 *     menos altas que uno que nombra la creación. Si alguien la acorta a
 *     "Entrar" para ganar ancho, esto se pone rojo y obliga a leer el porqué.
 *  3. "Acceder" no vuelve a aparecer como entrada paralela.
 *
 * El drawer se prueba abriéndolo: su contenido no está en el DOM hasta entonces.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { Nav } from "./Nav";

const ETIQUETA = /entrar o crear cuenta/i;

beforeEach(() => cleanup());

describe("nav público · una sola puerta de cuenta", () => {
  it("no ofrece 'Acceder' como entrada paralela en la barra", () => {
    render(<Nav />);

    expect(screen.queryByRole("link", { name: /^acceder$/i })).toBeNull();
  });

  it("la barra lleva el botón único, y apunta a /entrar", () => {
    render(<Nav />);

    // Dos superficies conviven en el DOM (escritorio y móvil se ocultan por
    // CSS, no por JS), así que se esperan 2 y ambas deben apuntar al mismo sitio.
    const puertas = screen.getAllByRole("link", { name: ETIQUETA });
    expect(puertas.length).toBe(2);
    for (const p of puertas) expect(p.getAttribute("href")).toBe("/entrar");
  });

  it("la etiqueta conserva la palabra que mueve las altas", () => {
    render(<Nav />);

    const puerta = screen.getAllByRole("link", { name: ETIQUETA })[0];
    expect(puerta.textContent?.toLowerCase()).toContain("crear");
  });

  it("el menú móvil también trae la puerta única, y sólo una vez", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    await user.click(screen.getByRole("button", { name: /abrir menú/i }));

    const drawer = screen.getByRole("dialog");
    const enDrawer = within(drawer).getAllByRole("link", { name: ETIQUETA });
    expect(enDrawer.length).toBe(1);
    expect(enDrawer[0].getAttribute("href")).toBe("/entrar");
    expect(
      within(drawer).queryByRole("link", { name: /^acceder$/i }),
    ).toBeNull();
  });

  it("ninguna superficie manda ya directo a /registro", () => {
    render(<Nav />);

    const alRegistro = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/registro");
    expect(alRegistro.length).toBe(0);
  });
});
