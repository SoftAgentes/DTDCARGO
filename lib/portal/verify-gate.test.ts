import { describe, it, expect } from "vitest";
import {
  LOCKED_MODULES,
  MODULE_LABELS,
  MODULE_GATE_COPY,
  isModuleLocked,
  buildVerifySteps,
  otherModulesSentence,
  missingSentence,
  type VerifyProfile,
} from "@/lib/portal/verify-gate";

/**
 * Gate de verificación del portal (SDD-0169). Todo el módulo es puro, así que
 * se testea sin Supabase: lo único que entra es el `ProfileCompleteness` ya
 * resuelto.
 */

const COMPLETO: VerifyProfile = {
  hasPhoto: true,
  hasAddress: true,
  complete: true,
};
const SIN_FOTO: VerifyProfile = {
  hasPhoto: false,
  hasAddress: true,
  complete: false,
};
const SIN_NADA: VerifyProfile = {
  hasPhoto: false,
  hasAddress: false,
  complete: false,
};

describe("isModuleLocked", () => {
  it("cierra los 4 módulos del Norte con el perfil incompleto", () => {
    for (const m of LOCKED_MODULES) {
      expect(isModuleLocked(m, SIN_FOTO)).toBe(true);
    }
  });

  it("abre los 4 módulos cuando el perfil está completo", () => {
    for (const m of LOCKED_MODULES) {
      expect(isModuleLocked(m, COMPLETO)).toBe(false);
    }
  });

  it("abre (fail-open) si no hay dato de perfil", () => {
    // Un fallo de lectura no puede dejar al cliente fuera de su portal.
    expect(isModuleLocked("documentos", null)).toBe(false);
  });

  it("solo mira `complete`, no los sub-campos por separado", () => {
    // Blindaje: si algún día `complete` deja de ser photo && address, el gate
    // sigue la fuente única y no re-deriva la regla.
    const raro: VerifyProfile = {
      hasPhoto: false,
      hasAddress: false,
      complete: true,
    };
    expect(isModuleLocked("academia", raro)).toBe(false);
  });
});

describe("buildVerifySteps", () => {
  it("da 3 pasos y 'Datos básicos' siempre hecho", () => {
    const steps = buildVerifySteps(SIN_NADA);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ label: "Datos básicos", done: true });
  });

  it("refleja dirección y foto por separado", () => {
    const steps = buildVerifySteps(SIN_FOTO);
    expect(steps[1].done).toBe(true); // dirección cargada
    expect(steps[2].done).toBe(false); // falta la foto
  });

  it("marca los 3 hechos con el perfil completo", () => {
    expect(buildVerifySteps(COMPLETO).every((s) => s.done)).toBe(true);
  });
});

describe("otherModulesSentence", () => {
  it("excluye el módulo actual y usa 'y' antes del último", () => {
    expect(otherModulesSentence("documentos")).toBe(
      "Referidos, Academia y Soporte",
    );
  });

  it("funciona desde cualquier módulo", () => {
    expect(otherModulesSentence("soporte")).toBe(
      "Documentos, Referidos y Academia",
    );
  });
});

describe("missingSentence", () => {
  it("nombra las dos cosas cuando faltan las dos", () => {
    expect(missingSentence(SIN_NADA)).toBe(
      "la foto de tu cédula o RIF y tu dirección de entrega",
    );
  });

  it("nombra solo la que falta", () => {
    expect(missingSentence(SIN_FOTO)).toBe("la foto de tu cédula o RIF");
  });

  it("queda vacía con el perfil completo", () => {
    expect(missingSentence(COMPLETO)).toBe("");
  });
});

describe("catálogo de módulos", () => {
  it("tiene etiqueta y copy para cada módulo cerrado", () => {
    for (const m of LOCKED_MODULES) {
      expect(MODULE_LABELS[m]).toBeTruthy();
      expect(MODULE_GATE_COPY[m].length).toBeGreaterThan(20);
    }
  });

  it("no usa voseo en el copy (regla del founder: tuteo VE)", () => {
    // Voseo argentino = bug de marca. Buscamos las formas más comunes.
    const voseo = /\b(podés|tenés|querés|necesitás|mirá|dale|abrí|ganá|entrá)\b/i;
    for (const m of LOCKED_MODULES) {
      expect(MODULE_GATE_COPY[m]).not.toMatch(voseo);
    }
  });
});
