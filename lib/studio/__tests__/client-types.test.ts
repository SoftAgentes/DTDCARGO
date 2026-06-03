/**
 * Tests de los helpers de verificación de identidad en `client-types` (SDD-0046 · B2).
 *
 * Cubre el mapeo ADVISORY del badge (acceptance §6 Slice B / Slice B2):
 *   sin verificar → neutral · corresponde → success · no corresponde → danger ·
 *   no disponible → warning. Y el label de la fuente para "Verificado por …".
 *
 * El badge es informativo — nunca bloquea al cliente; estos helpers solo deciden
 * el tono/label visible, así que un cambio accidental de mapeo lo caza este test.
 */

import { describe, it, expect } from "vitest";
import { docVerifyBadge, docVerifySourceLabel } from "../client-types";

describe("docVerifyBadge (advisory)", () => {
  it("sin verificar (null) → neutral / 'Sin verificar'", () => {
    expect(docVerifyBadge(null)).toEqual({
      tone: "neutral",
      label: "Sin verificar",
    });
  });

  it("ok → success / 'Corresponde'", () => {
    expect(docVerifyBadge("ok")).toEqual({
      tone: "success",
      label: "Corresponde",
    });
  });

  it("mismatch → danger / 'No corresponde'", () => {
    expect(docVerifyBadge("mismatch")).toEqual({
      tone: "danger",
      label: "No corresponde",
    });
  });

  it("unavailable → warning / 'No disponible'", () => {
    expect(docVerifyBadge("unavailable")).toEqual({
      tone: "warning",
      label: "No disponible",
    });
  });
});

describe("docVerifySourceLabel", () => {
  it("mapea cada fuente a su label legible", () => {
    expect(docVerifySourceLabel("cne")).toBe("CNE");
    expect(docVerifySourceLabel("seniat")).toBe("SENIAT");
    expect(docVerifySourceLabel("manual")).toBe("marca manual");
  });

  it("null → guion", () => {
    expect(docVerifySourceLabel(null)).toBe("—");
  });
});
