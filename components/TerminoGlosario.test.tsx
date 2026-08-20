/**
 * Tests del enlace al glosario (regla del founder, 2026-08-20).
 *
 * Lo que se protege: que consultar una definición NO le quite al visitante la
 * página donde estaba. Es un desvío lateral, no una navegación — y en la
 * calculadora, además, volver atrás le borraría la cotización a medio llenar.
 *
 * El default vive en el componente, así que una página nueva lo hereda sin
 * tener que acordarse. Estas pruebas existen para que nadie lo apague sin
 * querer, y para que el aviso de accesibilidad no se caiga en un refactor.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConGlosario } from "./TerminoGlosario";

afterEach(cleanup);

describe("enlace al glosario", () => {
  it("abre en pestaña nueva SIN que la página tenga que pedirlo", () => {
    render(<ConGlosario>Viaja en modalidad DDP.</ConGlosario>);
    const a = screen.getByRole("link");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("href", "/glosario#ddp");
  });

  // Sin `noopener`, la pestaña que se abre puede manipular la que la abrió por
  // `window.opener`. Es gratis ponerlo y no se negocia.
  it("lleva rel=noopener", () => {
    render(<ConGlosario>Pagas por CBM.</ConGlosario>);
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener");
  });

  // WCAG G201: un enlace que cambia de contexto tiene que avisarlo. El texto
  // visible es una sigla de tres letras, así que el aviso va en el aria-label.
  it("avisa en el nombre accesible que se abre otra pestaña", () => {
    render(<ConGlosario>Tarifa DDP.</ConGlosario>);
    const a = screen.getByRole("link");
    expect(a.getAttribute("aria-label")).toContain("pestaña nueva");
    // Y el texto que se VE sigue siendo sólo la sigla, sin el aviso encima.
    expect(a.textContent).toBe("DDP");
  });

  it("se puede apagar en un caso puntual, y entonces no promete lo que no hace", () => {
    render(<ConGlosario nuevaPestana={false}>Tarifa DDP.</ConGlosario>);
    const a = screen.getByRole("link");
    expect(a).not.toHaveAttribute("target");
    expect(a.getAttribute("aria-label")).not.toContain("pestaña nueva");
  });

  it("un texto sin jerga no genera ningún enlace", () => {
    render(<ConGlosario>Traemos tu carga hasta tu puerta.</ConGlosario>);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
