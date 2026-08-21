/**
 * Contratos del enlazado de jerga en las fichas del hub `/servicios`.
 *
 * Este archivo tiene 2.197 líneas de copy transcrito del mockup, y sólo 3 de
 * sus 17 fichas usan jerga del glosario. El resto del copy explica en español
 * y no necesita enlace — por eso lo que se protege no es "que haya enlaces en
 * todas", sino que las tres que la usan la enlacen **una sola vez cada una**.
 *
 * Por qué el ámbito es la ficha y no la página: el hub muestra UNA ficha a la
 * vez (hash `#svc/<slug>`), así que el lector nunca ve dos fichas juntas.
 *
 * Las menciones que quedan SIN enlazar son deliberadas y están medidas:
 *  · dentro de `<ChipF2>` — es una etiqueta, no prosa;
 *  · dentro de un `<SvcLink>` a otra ficha — un enlace no anida otro;
 *  · las repeticiones posteriores dentro de la misma ficha.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HUB_FICHAS } from "./hub-fichas";

afterEach(cleanup);

const porSlug = (slug: string) => {
  const f = HUB_FICHAS.find((x) => x.slug === slug);
  if (!f) throw new Error(`no existe la ficha «${slug}» en HUB_FICHAS`);
  return f.node;
};

/** Anclas de /glosario a las que enlaza lo que hay en pantalla. */
const anclas = () =>
  screen
    .queryAllByRole("link")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith("/glosario#"))
    .map((h) => h.replace("/glosario#", ""));

describe("hub /servicios · jerga enlazada", () => {
  it("la ficha de tránsito de aduana enlaza LCL y FCL", () => {
    render(<>{porSlug("transito-de-aduana")}</>);
    expect(anclas().sort()).toEqual(["fcl", "lcl"]);
  });

  it("la ficha de courier de muestras enlaza LCL y FCL", () => {
    render(<>{porSlug("courier-de-muestras")}</>);
    expect(anclas().sort()).toEqual(["fcl", "lcl"]);
  });

  it("la ficha de hold enlaza CBM", () => {
    render(<>{porSlug("hold")}</>);
    expect(anclas()).toEqual(["cbm"]);
  });

  // El riesgo real de este archivo: el copy repite las siglas muchas veces
  // (FCL sale 7 veces sólo en tránsito de aduana). Sin la regla de primera
  // aparición, esa ficha saldría con siete enlaces al mismo sitio.
  it("ninguna ficha del hub repite un término", () => {
    const repetidas: string[] = [];
    for (const { slug, node } of HUB_FICHAS) {
      cleanup();
      render(<>{node}</>);
      const a = anclas();
      const dup = a.filter((x, i) => a.indexOf(x) !== i);
      if (dup.length) repetidas.push(`${slug}: ${[...new Set(dup)].join(", ")}`);
    }
    expect(repetidas).toEqual([]);
  });

  it("los enlaces del hub abren aparte y avisan (LNK-01)", () => {
    render(<>{porSlug("transito-de-aduana")}</>);
    const alGlosario = screen
      .getAllByRole("link")
      .filter((a) => (a.getAttribute("href") ?? "").startsWith("/glosario#"));
    expect(alGlosario.length).toBeGreaterThan(0);
    for (const a of alGlosario) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener");
      expect(a.getAttribute("aria-label")).toContain("pestaña nueva");
    }
  });

  // Un enlace dentro de otro enlace es HTML inválido y el navegador lo
  // reacomoda: la ficha de tránsito nombra "Consolidado LCL" dentro de un
  // <SvcLink> a otra ficha, y ahí NO se enlaza al glosario.
  it("ningún enlace al glosario queda anidado dentro de otro enlace", () => {
    for (const { node } of HUB_FICHAS) {
      cleanup();
      const { container } = render(<>{node}</>);
      const anidados = [...container.querySelectorAll('a[href^="/glosario#"]')].filter(
        (a) => a.parentElement?.closest("a") != null,
      );
      expect(anidados).toHaveLength(0);
    }
  });

  // Guardián de alcance: el copy de este archivo puede crecer, y una ficha
  // nueva con jerga sin enlazar pasaría desapercibida. Esto no falla por eso
  // —sería ruido— pero deja el número medido a la vista de quien lo lea.
  it("hoy son 3 las fichas del hub que usan jerga del glosario", () => {
    const conJerga: string[] = [];
    for (const { slug, node } of HUB_FICHAS) {
      cleanup();
      render(<>{node}</>);
      if (anclas().length) conJerga.push(slug);
    }
    expect(conJerga.sort()).toEqual([
      "courier-de-muestras",
      "hold",
      "transito-de-aduana",
    ]);
  });
});
