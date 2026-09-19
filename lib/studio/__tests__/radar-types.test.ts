// @vitest-environment node
/**
 * Tests de los helpers del informe del Radar (SDD-0050 Slice C).
 *
 * Cubre la validación defensiva del artefacto + helpers de presentación que usa
 * el RadarTab (tono de severidad, % de completitud).
 */
import { describe, it, expect } from "vitest";
import {
  isRadarReport,
  reconCompletionPct,
  severityBadgeTone,
  type RadarReport,
} from "../radar-types";

const VALID: RadarReport = {
  generatedAt: "2026-06-03",
  norteVersion: "v2.4",
  partA: {
    findings: [
      {
        id: "x",
        title: "T",
        severity: "media",
        action: "A",
      },
    ],
    estimatedTokenSavings: "~8%",
  },
  partB: {
    counts: { built: 11, partial: 8, missing: 3, total: 22 },
  },
};

describe("isRadarReport", () => {
  it("acepta un informe bien formado", () => {
    expect(isRadarReport(VALID)).toBe(true);
  });

  it("rechaza null / no-objeto / vacío", () => {
    expect(isRadarReport(null)).toBe(false);
    expect(isRadarReport(undefined)).toBe(false);
    expect(isRadarReport("nope")).toBe(false);
    expect(isRadarReport({})).toBe(false);
  });

  it("rechaza si faltan campos clave (generatedAt / norteVersion)", () => {
    expect(isRadarReport({ ...VALID, generatedAt: 123 })).toBe(false);
    const sinVersion = Object.fromEntries(
      Object.entries(VALID).filter(([key]) => key !== "norteVersion"),
    );
    expect(isRadarReport(sinVersion)).toBe(false);
  });

  it("rechaza si partA.findings no es array", () => {
    expect(
      isRadarReport({ ...VALID, partA: { ...VALID.partA, findings: "x" } }),
    ).toBe(false);
  });

  it("rechaza si partB.counts no tiene los números esperados", () => {
    expect(
      isRadarReport({
        ...VALID,
        partB: { counts: { built: 1, partial: 2, missing: 3 } },
      }),
    ).toBe(false);
  });
});

describe("reconCompletionPct", () => {
  it("calcula built/total redondeado", () => {
    expect(reconCompletionPct({ built: 11, partial: 8, missing: 3, total: 22 })).toBe(50);
    expect(reconCompletionPct({ built: 1, partial: 0, missing: 2, total: 3 })).toBe(33);
  });

  it("no divide por cero si total=0", () => {
    expect(reconCompletionPct({ built: 0, partial: 0, missing: 0, total: 0 })).toBe(0);
  });
});

describe("severityBadgeTone", () => {
  it("mapea severidad a tono de Badge del sistema", () => {
    expect(severityBadgeTone("alta")).toBe("danger");
    expect(severityBadgeTone("media")).toBe("warning");
    expect(severityBadgeTone("baja")).toBe("neutral");
  });
});
