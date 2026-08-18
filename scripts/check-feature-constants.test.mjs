/**
 * Contrato de `check-feature-constants.mjs`.
 *
 * Validado con MUTACIÓN: cada caso describe un desvío REAL que el paso tiene
 * que cazar. Si alguien afloja el matcher para que "pase", estos se ponen rojos.
 */
import { describe, expect, it } from "vitest";
import {
  encontrarDesvios,
  leerValorReal,
} from "./check-feature-constants.mjs";

const src = (nombre, valor, tipo = false) =>
  `export const ${nombre}${tipo ? ": boolean" : ""} = ${valor};\n`;

describe("leerValorReal", () => {
  it("lee true y false", () => {
    expect(leerValorReal(src("X", "true"), "X")).toBe(true);
    expect(leerValorReal(src("X", "false"), "X")).toBe(false);
  });

  it("acepta la anotación `: boolean` (TERMINOS_LIVE la lleva)", () => {
    expect(leerValorReal(src("TERMINOS_LIVE", "false", true), "TERMINOS_LIVE"))
      .toBe(false);
  });

  it("devuelve null si la constante no está — borrada o renombrada", () => {
    expect(leerValorReal(src("OTRA", "true"), "X")).toBeNull();
  });

  it("NO confunde una constante cuyo nombre es prefijo de otra", () => {
    // `NORTE_PORTAL_LIVE` no debe resolverse leyendo `NORTE_PORTAL_LIVE_V2`.
    const fuente = src("NORTE_PORTAL_LIVE_V2", "false");
    expect(leerValorReal(fuente, "NORTE_PORTAL_LIVE")).toBeNull();
  });
});

describe("encontrarDesvios", () => {
  const flag = (value) => [
    { name: "F", file: "lib/f.ts", value, significa: "prende algo" },
  ];

  it("no reporta nada cuando el código coincide con lo declarado", () => {
    const d = encontrarDesvios(flag(true), () => src("F", "true"));
    expect(d).toEqual([]);
  });

  it("🔴 caza el flip silencioso — el caso que lo hizo existir", () => {
    // Declarado false, alguien lo puso en true y no tocó la declaración.
    const d = encontrarDesvios(flag(false), () => src("F", "true"));
    expect(d).toHaveLength(1);
    expect(d[0].tipo).toBe("valor");
    expect(d[0].detail).toContain("declarado false, real true");
    // El "qué significa" viaja al reporte: un desvío sin consecuencia visible
    // se lee como un detalle técnico y se ignora.
    expect(d[0].significa).toBe("prende algo");
  });

  it("caza la constante borrada o renombrada", () => {
    const d = encontrarDesvios(flag(true), () => src("OTRO_NOMBRE", "true"));
    expect(d).toHaveLength(1);
    expect(d[0].tipo).toBe("constante-ausente");
  });

  it("caza el archivo movido, sin explotar", () => {
    const d = encontrarDesvios(flag(true), () => {
      throw new Error("ENOENT");
    });
    expect(d).toHaveLength(1);
    expect(d[0].tipo).toBe("archivo-ausente");
  });

  it("reporta TODOS los desvíos, no sólo el primero", () => {
    const flags = [
      { name: "A", file: "a.ts", value: true },
      { name: "B", file: "b.ts", value: true },
    ];
    const d = encontrarDesvios(flags, () => src("A", "false"));
    // A difiere en valor; B ni siquiera está en esa fuente.
    expect(d).toHaveLength(2);
  });
});
