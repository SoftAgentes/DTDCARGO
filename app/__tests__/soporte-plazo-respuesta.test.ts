/**
 * SDD-0586 §10.5.12 · T1: el plazo que promete el chat de Soporte del portal.
 *
 * Con la regla de P5 y P7 = (a), el sábado, el domingo y los feriados de Venezuela no cuentan, así que
 * «Te responde en el día» ya no era cierto el fin de semana. Sam aprobó el texto nuevo palabra por palabra
 * el 2026-11-07 (04:48Z), por el Director General: «Apruebo los cuatro». Si esta prueba falla porque cambió
 * una palabra, se le vuelve a preguntar; no se ajusta la prueba. Lee el archivo: es texto estático.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const texto = readFileSync(path.join(process.cwd(), "app/portal/(app)/soporte/page.tsx"), "utf8").replace(/\s+/g, " ");

describe("Portal · Soporte · plazo de respuesta (SDD-0586, T1)", () => {
  it("dice lo que Sam aprobó y nada más en esa línea", () => {
    expect(texto).toContain("{role} · Te responde en el día hábil </div>");
  });

  it("ya no promete «en el día» a secas ni la variante descartada de la opción (b)", () => {
    expect(texto).not.toContain("Te responde en el día </div>");
    expect(texto).not.toContain("de lunes a viernes");
  });
});
