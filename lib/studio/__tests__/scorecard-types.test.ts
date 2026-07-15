/**
 * SDD-0111 · Tests de la fórmula del scorecard de proveedores (capa pura).
 *
 * La fórmula (computeScore/computeGrade) debe coincidir EXACTAMENTE con el
 * Norte (docs/design/studio/_norte/proveedores/scorecard.js) y con la VIEW
 * supplier_scorecard_v (migr 0236). Se re-implementa acá la fórmula del Norte
 * y se verifica que nuestras funciones dan idéntico resultado sobre los 5
 * proveedores del mock.
 */

import { describe, it, expect } from "vitest";
import {
  computeScore,
  computeGrade,
  computeScorecard,
  gradeBadgeTone,
  supplierClaimStatusTone,
  supplierClaimKindLabel,
  canTransitionSupplierClaim,
  nextSupplierClaimStatuses,
  isTerminalSupplierClaimStatus,
  validateSupplierClaimInput,
  validateOrderSignalInput,
} from "../proveedores/scorecard-types";

// ── Réplica EXACTA de la fórmula del Norte (scorecard.js) ────────
function norteScore(s: { onTime: number; quality: number; defect: number }) {
  return Math.round(s.onTime * 0.4 + s.quality * 0.4 + Math.max(0, 100 - s.defect * 6) * 0.2);
}
function norteGrade(sc: number) {
  return sc >= 90 ? "A" : sc >= 82 ? "B" : sc >= 72 ? "C" : "D";
}

// Los 5 proveedores del mock del Norte (SUP).
const SUP = [
  { id: "s1", onTime: 96, quality: 94, defect: 1.8 },
  { id: "s2", onTime: 92, quality: 96, defect: 1.1 },
  { id: "s3", onTime: 88, quality: 90, defect: 3.2 },
  { id: "s4", onTime: 90, quality: 92, defect: 2.5 },
  { id: "s5", onTime: 78, quality: 85, defect: 5.4 },
];

describe("computeScore / computeGrade — paridad con el Norte", () => {
  it("da el mismo score que la fórmula del Norte para los 5 proveedores", () => {
    for (const s of SUP) {
      expect(computeScore(s.onTime, s.quality, s.defect)).toBe(norteScore(s));
    }
  });

  it("da el mismo grade que el Norte para los 5 proveedores", () => {
    for (const s of SUP) {
      const sc = computeScore(s.onTime, s.quality, s.defect);
      expect(computeGrade(sc)).toBe(norteGrade(sc));
    }
  });

  it("scores y grades esperados (valores explícitos del mock)", () => {
    // s1=94/A · s2=94/A · s3=87/B · s4=90/A · s5=79/C
    // (el s5 es el peor del mock; por la fórmula del Norte cae en C, no D).
    const expected: Record<string, [number, string]> = {
      s1: [94, "A"],
      s2: [94, "A"],
      s3: [87, "B"],
      s4: [90, "A"],
      s5: [79, "C"],
    };
    for (const s of SUP) {
      const sc = computeScore(s.onTime, s.quality, s.defect);
      expect([sc, computeGrade(sc)]).toEqual(expected[s.id]);
    }
  });

  it("umbrales de grade exactos en los bordes", () => {
    expect(computeGrade(90)).toBe("A");
    expect(computeGrade(89)).toBe("B");
    expect(computeGrade(82)).toBe("B");
    expect(computeGrade(81)).toBe("C");
    expect(computeGrade(72)).toBe("C");
    expect(computeGrade(71)).toBe("D");
    expect(computeGrade(0)).toBe("D");
  });

  it("el defecto alto pisa en 0 (no negativo)", () => {
    // defect 20 → 100 - 120 = -20 → max(0,...) = 0.
    expect(computeScore(100, 100, 20)).toBe(80); // 40 + 40 + 0
  });
});

describe("computeScorecard — derivación desde conteos + sin datos", () => {
  it("deriva % + score + grade desde conteos (s1 del mock)", () => {
    // 42 órdenes, 96% on-time, 94% conforme, 1.8% defecto → aproximar conteos.
    const r = computeScorecard({
      ordersCount: 100,
      onTimeCount: 96,
      conformingCount: 94,
      claimsCount: 2, // 2% defect ~ borde del mock
    });
    expect(r.onTimePct).toBe(96);
    expect(r.qualityPct).toBe(94);
    expect(r.defectPct).toBe(2);
    expect(r.score).toBe(computeScore(96, 94, 2));
    expect(r.grade).toBe(computeGrade(r.score as number));
  });

  it("sin denominador (0 órdenes) → todo null y grade null (Sin datos)", () => {
    const r = computeScorecard({
      ordersCount: 0,
      onTimeCount: 0,
      conformingCount: 0,
      claimsCount: 0,
    });
    expect(r.onTimePct).toBeNull();
    expect(r.qualityPct).toBeNull();
    expect(r.defectPct).toBeNull();
    expect(r.score).toBeNull();
    expect(r.grade).toBeNull();
  });

  it("proveedor perfecto = A", () => {
    const r = computeScorecard({
      ordersCount: 10,
      onTimeCount: 10,
      conformingCount: 10,
      claimsCount: 0,
    });
    expect(r.score).toBe(100);
    expect(r.grade).toBe("A");
  });
});

describe("gradeBadgeTone — mapeo Norte → tonos del Studio", () => {
  it("A=success B=info C=warning D=danger sinDatos=neutral", () => {
    expect(gradeBadgeTone("A")).toBe("success");
    expect(gradeBadgeTone("B")).toBe("info");
    expect(gradeBadgeTone("C")).toBe("warning");
    expect(gradeBadgeTone("D")).toBe("danger");
    expect(gradeBadgeTone(null)).toBe("neutral");
  });
});

describe("máquina de estados del reclamo", () => {
  it("transiciones válidas desde abierto", () => {
    expect(canTransitionSupplierClaim("abierto", "en_revision")).toBe(true);
    expect(canTransitionSupplierClaim("abierto", "rechazado")).toBe(true);
    expect(canTransitionSupplierClaim("abierto", "resuelto")).toBe(false);
  });

  it("en_revision puede resolver o rechazar", () => {
    expect(canTransitionSupplierClaim("en_revision", "resuelto")).toBe(true);
    expect(canTransitionSupplierClaim("en_revision", "rechazado")).toBe(true);
  });

  it("terminales solo reabren", () => {
    expect(nextSupplierClaimStatuses("resuelto")).toEqual(["abierto"]);
    expect(nextSupplierClaimStatuses("rechazado")).toEqual(["abierto"]);
    expect(isTerminalSupplierClaimStatus("resuelto")).toBe(true);
    expect(isTerminalSupplierClaimStatus("rechazado")).toBe(true);
    expect(isTerminalSupplierClaimStatus("abierto")).toBe(false);
  });

  it("tonos de estado", () => {
    expect(supplierClaimStatusTone("resuelto")).toBe("success");
    expect(supplierClaimStatusTone("rechazado")).toBe("neutral");
    expect(supplierClaimStatusTone("en_revision")).toBe("info");
    expect(supplierClaimStatusTone("abierto")).toBe("wine");
  });

  it("labels de tipo", () => {
    expect(supplierClaimKindLabel("dano")).toBe("Daño");
    expect(supplierClaimKindLabel("calidad")).toBe("Calidad");
  });
});

describe("validateSupplierClaimInput — manual, sin Zod", () => {
  const supplierCnId = "11111111-1111-1111-1111-111111111111";

  it("acepta un reclamo válido y normaliza el monto (coma decimal)", () => {
    const { input, fieldErrors } = validateSupplierClaimInput({
      supplierCnId,
      kind: "dano",
      amountUsd: "1.234,50", // no debería colar el separador de miles
      description: "Caja rota",
    });
    // "1.234,50".replace(",",".") = "1.234.50" → Number → NaN → error.
    expect(fieldErrors?.amountUsd).toBeDefined();
    expect(input).toBeUndefined();
  });

  it("acepta monto simple con coma y describe", () => {
    const { input, fieldErrors } = validateSupplierClaimInput({
      supplierCnId,
      kind: "calidad",
      amountUsd: "880,50",
      description: "Producto no conforme",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.amountUsd).toBe(880.5);
    expect(input?.kind).toBe("calidad");
  });

  it("rechaza sin proveedor, tipo inválido y sin descripción", () => {
    const { fieldErrors } = validateSupplierClaimInput({
      supplierCnId: "",
      kind: "no_existe",
      description: "  ",
    });
    expect(fieldErrors?.supplierCnId).toBeDefined();
    expect(fieldErrors?.kind).toBeDefined();
    expect(fieldErrors?.description).toBeDefined();
  });

  it("monto vacío → 0 (advisory)", () => {
    const { input } = validateSupplierClaimInput({
      supplierCnId,
      kind: "otro",
      description: "Sin monto",
    });
    expect(input?.amountUsd).toBe(0);
  });
});

describe("validateOrderSignalInput — default optimista", () => {
  const supplierCnId = "22222222-2222-2222-2222-222222222222";

  it("on_time/conforming arrancan true si no se marcan explícitamente false", () => {
    const { input } = validateOrderSignalInput({ supplierCnId });
    expect(input?.onTime).toBe(true);
    expect(input?.conforming).toBe(true);
  });

  it("respeta false explícito", () => {
    const { input } = validateOrderSignalInput({
      supplierCnId,
      onTime: false,
      conforming: false,
    });
    expect(input?.onTime).toBe(false);
    expect(input?.conforming).toBe(false);
  });

  it("rechaza fecha con formato inválido", () => {
    const { fieldErrors } = validateOrderSignalInput({
      supplierCnId,
      expectedAt: "07/06/2026",
    });
    expect(fieldErrors?.expectedAt).toBeDefined();
  });

  it("rechaza uuid de proveedor inválido", () => {
    const { fieldErrors } = validateOrderSignalInput({ supplierCnId: "abc" });
    expect(fieldErrors?.supplierCnId).toBeDefined();
  });
});
