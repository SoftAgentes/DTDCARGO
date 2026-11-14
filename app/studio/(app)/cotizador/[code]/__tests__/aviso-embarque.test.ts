/**
 * SDD-0603 · menores del Studio: el aviso «ya fue convertido a un embarque».
 *
 * Dentro de un aviso el botón va secundario (contorno de tinta): el relleno
 * vino o de tinta es para la acción principal de la pantalla (VIS-01 §5,
 * SDD-0628). La página es un componente de servidor con datos, así que se mira
 * su fuente.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FUENTE = readFileSync(join(process.cwd(), "app/studio/(app)/cotizador/[code]/page.tsx"), "utf8");

/** Texto de cada bloque `<Aviso …>…</Aviso>` del archivo. */
function avisos(fuente: string): string[] {
  return fuente.match(/<Aviso\b[\s\S]*?<\/Aviso>/g) ?? [];
}

const RELLENO = /studio-btn-(?:primary|dark|danger|warning)/;

describe("cotizador/[code] · botón dentro del aviso", () => {
  it("el aviso de conversión lleva «Ver embarque» como secundario", () => {
    const bloques = avisos(FUENTE);
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toContain("Ver embarque");
    expect(bloques[0]).toContain('className="studio-btn studio-btn-ghost studio-btn-sm"');
    expect(bloques[0]).not.toMatch(RELLENO);
  });

  it("mutante: si el botón vuelve a ir relleno, rompe", () => {
    const mutada = FUENTE.replace(
      'className="studio-btn studio-btn-ghost studio-btn-sm"\n              >\n                Ver embarque',
      'className="studio-btn studio-btn-dark studio-btn-sm"\n              >\n                Ver embarque',
    );
    expect(mutada).not.toBe(FUENTE);
    expect(avisos(mutada)[0]).toMatch(RELLENO);
  });
});
