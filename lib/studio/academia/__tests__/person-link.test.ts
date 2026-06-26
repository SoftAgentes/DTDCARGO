/**
 * Tests SDD-0107: ancla de la inscripción a la persona por cédula.
 *
 * Cubre los criterios de aceptación de la capa pura (sin DB):
 *  - isValidStudentCi: acepta cédula simple (V-18.452.110) y RIF (J-12345678-9),
 *    rechaza basura y documentos demasiado cortos.
 *  - formatStudentCi: normalización VISIBLE (agrupa miles, mayúscula, RIF canónico).
 *  - normalizeCedula (espejo del índice SQL): paridad con el backfill de 0177.
 *  - validateEnrollmentInput: cédula inválida → fieldErrors.studentCi; válida →
 *    se guarda en formato canónico.
 *  - dedupe por cédula normalizada: dos formatos del mismo documento colapsan a
 *    una sola clave (lo que evita el choque del índice único de persons).
 */

import { describe, it, expect } from "vitest";
import {
  formatStudentCi,
  isValidStudentCi,
  normalizeCedula,
  validateEnrollmentInput,
} from "../types";

describe("isValidStudentCi", () => {
  it("acepta cédula venezolana simple (con y sin puntos)", () => {
    expect(isValidStudentCi("V-18.452.110")).toBe(true);
    expect(isValidStudentCi("V18452110")).toBe(true);
    expect(isValidStudentCi("v 18452110")).toBe(true);
    expect(isValidStudentCi("E-9.555.123")).toBe(true);
  });

  it("acepta RIF completo (formato de clients)", () => {
    expect(isValidStudentCi("J-12345678-9")).toBe(true);
    expect(isValidStudentCi("J123456789")).toBe(true);
    expect(isValidStudentCi("G-20009999-7")).toBe(true);
  });

  it("rechaza basura y documentos demasiado cortos", () => {
    expect(isValidStudentCi("")).toBe(false);
    expect(isValidStudentCi("hola mundo")).toBe(false);
    expect(isValidStudentCi("V-1")).toBe(false);
    expect(isValidStudentCi("18452110")).toBe(false); // sin letra de prefijo
    expect(isValidStudentCi("X-12345678")).toBe(false); // letra no válida
  });
});

describe("formatStudentCi · normalización visible", () => {
  it("agrupa miles y pone la letra en mayúscula", () => {
    expect(formatStudentCi("v18452110")).toBe("V-18.452.110");
    expect(formatStudentCi("V-18452110")).toBe("V-18.452.110");
    expect(formatStudentCi(" v 18.452.110 ")).toBe("V-18.452.110");
  });

  it("RIF completo → formato canónico X-XXXXXXXX-X", () => {
    expect(formatStudentCi("j123456789")).toBe("J-12345678-9");
    expect(formatStudentCi("J-12345678-9")).toBe("J-12345678-9");
  });
});

describe("normalizeCedula · paridad con el índice SQL de 0170/0177", () => {
  it("saca puntos/guiones/espacios y pasa a mayúsculas", () => {
    expect(normalizeCedula("V-18.452.110")).toBe("V18452110");
    expect(normalizeCedula("v 18452110")).toBe("V18452110");
    expect(normalizeCedula("J-12345678-9")).toBe("J123456789");
  });

  it("dos formatos del mismo documento colapsan a la misma clave (dedupe)", () => {
    const a = normalizeCedula("V-18.452.110");
    const b = normalizeCedula("v18452110");
    const c = normalizeCedula("V 18.452.110");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("la cédula formateada visible normaliza igual que el raw (idempotencia del ancla)", () => {
    const raw = "v18452110";
    expect(normalizeCedula(raw)).toBe(normalizeCedula(formatStudentCi(raw)));
  });
});

describe("validateEnrollmentInput · cédula (SDD-0107)", () => {
  it("cédula inválida → fieldErrors.studentCi y no input", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Ana",
      studentCi: "V-1",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.studentCi).toBeTruthy();
  });

  it("cédula válida → se guarda en formato canónico visible", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Ana",
      studentCi: " v18452110 ",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.studentCi).toBe("V-18.452.110");
  });

  it("RIF válido → formato canónico", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Comercial XY",
      studentCi: "j123456789",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.studentCi).toBe("J-12345678-9");
  });

  it("sin cédula → studentCi null (inscripción sin ancla, válida)", () => {
    const { input, fieldErrors } = validateEnrollmentInput({
      cohortId: "c-1",
      studentName: "Ana",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.studentCi).toBeNull();
  });
});
