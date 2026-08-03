/**
 * SDD-0244 · cuánta confianza da un par candidato a duplicado.
 *
 * Esto no es cosmético: `candidateConfidence` es lo que decide si la pantalla de
 * fusión pide confirmación SOSTENIDA. El caso que lo motiva es real — en
 * producción había un par (`DTD-J000` ↔ `DTD-9001`) que coincidía ÚNICAMENTE por
 * nombre, y el nombre era "Jose Mendez". La ficha vieja no tenía correo, ni
 * teléfono, ni documento.
 *
 * Si eso se clasificara como coincidencia fuerte, el operador fusionaría de un
 * clic y podría estar uniendo a dos personas distintas — un daño bastante peor
 * que dejar el duplicado, porque mezcla historiales de carga y de facturación.
 */
import { describe, it, expect } from "vitest";
import {
  candidateConfidence,
  candidateReasons,
  type DuplicateCandidate,
} from "../client-merge-queries";

function par(over: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    legacyId: "viejo",
    legacyMarkbox: "DTD-A098",
    legacyName: "ALAIN CARDENAS",
    newId: "nuevo",
    newMarkbox: "DTD-9017",
    newName: "Alain de Cardenas",
    matchEmail: false,
    matchPhone: false,
    matchName: false,
    matchDocument: false,
    score: 0,
    ...over,
  };
}

describe("candidateConfidence", () => {
  it("sólo por nombre es DÉBIL — el caso 'Jose Mendez'", () => {
    expect(candidateConfidence(par({ matchName: true }))).toBe("debil");
  });

  it("el documento manda: siempre confianza alta", () => {
    expect(candidateConfidence(par({ matchDocument: true }))).toBe("alta");
  });

  it("correo + teléfono juntos es alta — el caso DTD-A098 / DTD-9017", () => {
    expect(candidateConfidence(par({ matchEmail: true, matchPhone: true }))).toBe("alta");
  });

  it("una sola señal de contacto es media, no alta", () => {
    expect(candidateConfidence(par({ matchEmail: true }))).toBe("media");
    expect(candidateConfidence(par({ matchPhone: true }))).toBe("media");
  });

  it("el nombre no sube la confianza por sí solo", () => {
    // Nombre + correo sigue siendo 'media': el nombre acompaña, no decide.
    expect(candidateConfidence(par({ matchEmail: true, matchName: true }))).toBe("media");
  });
});

describe("candidateReasons", () => {
  it("enumera las señales de más fuerte a más débil", () => {
    const r = candidateReasons(
      par({ matchDocument: true, matchEmail: true, matchPhone: true, matchName: true }),
    );
    expect(r).toEqual(["documento", "correo", "teléfono", "nombre"]);
  });

  it("no inventa señales que no coincidieron", () => {
    expect(candidateReasons(par({ matchName: true }))).toEqual(["nombre"]);
  });
});
