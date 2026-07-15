/**
 * Tests de friction-types (SDD-0119 Slice 1).
 *
 * Cubre criterios de aceptación:
 *  - validateFrictionReportInput() rechaza título/descripción vacíos y
 *    excedidos de longitud, sin Zod.
 *  - frictionStatusTone() mapea cada status a un tono de Badge válido.
 */

import { describe, it, expect } from "vitest";
import {
  FRICTION_DESCRIPTION_MAX,
  FRICTION_TITLE_MAX,
  frictionStatusTone,
  validateFrictionReportInput,
} from "../friction-types";

describe("validateFrictionReportInput", () => {
  it("acepta título + descripción válidos y los trimmea", () => {
    const res = validateFrictionReportInput({
      title: "  Editar videos me toma horas  ",
      description: "  Cada semana monto 6 videos a mano.  ",
    });
    expect(res.fieldErrors).toBeUndefined();
    expect(res.input).toEqual({
      title: "Editar videos me toma horas",
      description: "Cada semana monto 6 videos a mano.",
    });
  });

  it("rechaza título vacío o solo espacios", () => {
    const res = validateFrictionReportInput({
      title: "   ",
      description: "algo",
    });
    expect(res.input).toBeUndefined();
    expect(res.fieldErrors?.title).toBeDefined();
  });

  it("rechaza descripción vacía", () => {
    const res = validateFrictionReportInput({
      title: "algo",
      description: "",
    });
    expect(res.input).toBeUndefined();
    expect(res.fieldErrors?.description).toBeDefined();
  });

  it("rechaza título que supera el máximo", () => {
    const res = validateFrictionReportInput({
      title: "x".repeat(FRICTION_TITLE_MAX + 1),
      description: "algo",
    });
    expect(res.fieldErrors?.title).toContain(String(FRICTION_TITLE_MAX));
  });

  it("rechaza descripción que supera el máximo", () => {
    const res = validateFrictionReportInput({
      title: "algo",
      description: "x".repeat(FRICTION_DESCRIPTION_MAX + 1),
    });
    expect(res.fieldErrors?.description).toContain(
      String(FRICTION_DESCRIPTION_MAX),
    );
  });

  it("reporta ambos errores si título y descripción son inválidos", () => {
    const res = validateFrictionReportInput({ title: "", description: "" });
    expect(res.fieldErrors?.title).toBeDefined();
    expect(res.fieldErrors?.description).toBeDefined();
  });
});

describe("frictionStatusTone", () => {
  it("mapea open→warning, triaged→info, resolved→success", () => {
    expect(frictionStatusTone("open")).toBe("warning");
    expect(frictionStatusTone("triaged")).toBe("info");
    expect(frictionStatusTone("resolved")).toBe("success");
  });
});
