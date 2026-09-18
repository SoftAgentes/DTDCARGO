/**
 * SDD-0473 · El footer enlaza /cotizador sólo cuando la ruta existe.
 *
 * Con `DOCUMENT_IMPORT_ENABLED` apagada, /cotizador responde 404: un enlace en el
 * pie de todas las páginas públicas sería un enlace roto en todo el sitio. Y con
 * la bandera encendida nadie llega a la página si nadie la enlaza (lo que pasaba
 * al integrar la 0473).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const ENLACE = { name: "Cotiza con tu proforma" };

describe("Footer · enlace al cotizador (SDD-0473)", () => {
  it("con la bandera encendida, enlaza /cotizador junto a la calculadora", () => {
    vi.stubEnv("DOCUMENT_IMPORT_ENABLED", "true");
    render(<Footer />);
    expect(screen.getByRole("link", ENLACE)).toHaveAttribute("href", "/cotizador");
    expect(screen.getByRole("link", { name: "Calculadora de envío" })).toHaveAttribute("href", "/tarifas");
  });

  it("con cualquier otro valor no hay enlace, porque la ruta es 404", () => {
    for (const valor of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("DOCUMENT_IMPORT_ENABLED", valor);
      render(<Footer />);
      expect(screen.queryByRole("link", ENLACE), `DOCUMENT_IMPORT_ENABLED=${JSON.stringify(valor)}`).toBeNull();
      expect(document.querySelector('a[href="/cotizador"]')).toBeNull();
      cleanup();
    }
  });
});
