/**
 * Contratos del enlazado de jerga en la ficha de servicio.
 *
 * Lo que protegen: que la ficha enlace **una vez por término**, no una vez por
 * viñeta. Una ficha son muchos textos cortos —incluye, no incluye, precio,
 * tiempos, cómo se solicita, nota— pero el lector la ve como UNA pieza. Sin el
 * ámbito compartido de `ambitoGlosario()`, la del LCL consolidado saldría con
 * 7 enlaces para 3 términos distintos.
 *
 * Se corren contra los datos REALES de `lib/servicios-detalle.ts`, no contra un
 * doble: un doble con dos viñetas nunca reproduciría el caso que motivó esto.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FichaCuerpo } from "./FichaCuerpo";
import { SERVICIOS_DETALLE_BY_SLUG } from "@/lib/servicios-detalle";

afterEach(cleanup);

/** Las anclas de /glosario a las que enlaza lo que hay en pantalla. */
const anclasEnPantalla = () =>
  screen
    .queryAllByRole("link")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((h) => h.startsWith("/glosario#"))
    .map((h) => h.replace("/glosario#", ""));

describe("ficha de servicio · jerga enlazada", () => {
  it("no repite el mismo término aunque salga en varias viñetas", () => {
    // Es la ficha con más jerga repartida del catálogo — el caso que motivó
    // el ámbito compartido.
    render(<FichaCuerpo service={SERVICIOS_DETALLE_BY_SLUG["lcl-consolidado"]} />);
    const anclas = anclasEnPantalla();
    expect(anclas.length).toBeGreaterThan(0);
    expect(anclas).toEqual([...new Set(anclas)]);
  });

  it("ninguna ficha del catálogo repite un término", () => {
    const repetidas: string[] = [];
    for (const [slug, service] of Object.entries(SERVICIOS_DETALLE_BY_SLUG)) {
      cleanup();
      render(<FichaCuerpo service={service} />);
      const anclas = anclasEnPantalla();
      const dup = anclas.filter((a, i) => anclas.indexOf(a) !== i);
      if (dup.length) repetidas.push(`${slug}: ${[...new Set(dup)].join(", ")}`);
    }
    expect(repetidas).toEqual([]);
  });

  // Cada ficha es su propia pieza: el explorador las lista juntas y el lector
  // abre una a la vez. Si el registro se filtrara entre fichas, la segunda
  // saldría sin un solo enlace.
  it("cada ficha enlaza por su cuenta, sin heredar de la anterior", () => {
    const lcl = SERVICIOS_DETALLE_BY_SLUG["lcl-consolidado"];
    render(<FichaCuerpo service={lcl} />);
    const primera = anclasEnPantalla();
    cleanup();
    render(<FichaCuerpo service={lcl} />);
    expect(anclasEnPantalla()).toEqual(primera);
  });

  it("el texto de la ficha no se pierde al partirlo en segmentos", () => {
    const s = SERVICIOS_DETALLE_BY_SLUG["lcl-consolidado"];
    const { container } = render(<FichaCuerpo service={s} />);
    const texto = container.textContent ?? "";
    for (const linea of [...s.incluye, ...s.noIncluye]) {
      expect(texto).toContain(linea);
    }
  });

  it("los enlaces de la ficha abren aparte y avisan (LNK-01)", () => {
    render(<FichaCuerpo service={SERVICIOS_DETALLE_BY_SLUG["lcl-consolidado"]} />);
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
});
