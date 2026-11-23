// @vitest-environment node
/**
 * SDD-0712 · capa pura de la fusión manual: lectura de las RPC que FALLA
 * CERRADO, avisos de riesgo y validación del motivo y de la confirmación.
 */
import { describe, expect, it } from "vitest";

import {
  avisosDeFusion,
  confirmacionCoincide,
  errorDeMotivo,
  parsePreview,
  parseSearchRows,
  type MergeWarnings,
} from "../client-merge-manual";
import { entradasDeCodigosFusionados } from "../markbox-history-types";

const LADO = (id: string, markbox: string) => ({
  id,
  markbox,
  name: "Jose Mendez",
  hasDocument: true,
  hasEmail: false,
  hasPhone: true,
  hasPortal: false,
  counts: { shipments: 2, invoices: 1, addresses: 0, conversations: 3 },
});

const SIN_AVISOS: MergeWarnings = {
  portalRevoked: false,
  portalMoved: false,
  documentNotPassed: false,
  emailNotPassed: false,
  phoneNotPassed: false,
  sameNameOnly: false,
};

const PREVIEW = {
  ok: true,
  blockers: [],
  survivor: LADO("a", "DTD-9001"),
  merged: LADO("b", "DTD-8221"),
  warnings: SIN_AVISOS,
};

describe("parseSearchRows", () => {
  it("lee filas completas y descarta las que no traen id, código o nombre", () => {
    const hits = parseSearchRows([
      { client_id: "a", markbox: "DTD-9001", nombre: "jose mendez", email: null, phone: "0424", rif: "V-1", matched_by: ["nombre", 3] },
      { client_id: "b", markbox: "DTD-8221", nombre: "" },
      { markbox: "DTD-1", nombre: "x" },
      "basura",
    ]);
    expect(hits).toEqual([
      { id: "a", markbox: "DTD-9001", name: "jose mendez", email: null, phone: "0424", rif: "V-1", matchedBy: ["nombre"] },
    ]);
  });
  it("algo que no es lista queda vacío", () => {
    expect(parseSearchRows(null)).toEqual([]);
    expect(parseSearchRows({})).toEqual([]);
  });
});

describe("parsePreview (falla cerrado)", () => {
  it("lee una vista previa completa", () => {
    expect(parsePreview(PREVIEW)?.survivor.markbox).toBe("DTD-9001");
  });
  it.each([
    ["sin lado", { ...PREVIEW, merged: undefined }],
    [
      "conteo negativo",
      { ...PREVIEW, merged: { ...LADO("b", "DTD-8221"), counts: { shipments: -1, invoices: 0, addresses: 0, conversations: 0 } } },
    ],
    ["aviso que falta", { ...PREVIEW, warnings: { ...SIN_AVISOS, portalMoved: undefined } }],
    ["ok no booleano", { ...PREVIEW, ok: "si" }],
    ["bandera como texto", { ...PREVIEW, survivor: { ...LADO("a", "DTD-9001"), hasPortal: "true" } }],
    ["no es objeto", null],
  ])("rechaza: %s", (_n, data) => {
    expect(parsePreview(data)).toBeNull();
  });
});

describe("avisosDeFusion", () => {
  it("sin riesgos no avisa", () => {
    expect(avisosDeFusion(SIN_AVISOS)).toEqual([]);
  });
  it("el nombre solo y el portal revocado van primero y como error", () => {
    const a = avisosDeFusion({ ...SIN_AVISOS, sameNameOnly: true, portalRevoked: true, emailNotPassed: true });
    expect(a.map((x) => x.tono)).toEqual(["error", "error", "atencion"]);
    expect(a[1].texto).toMatch(/portal/);
  });
});

describe("motivo y confirmación", () => {
  it("el motivo pide 4 a 1000 caracteres", () => {
    expect(errorDeMotivo("  ab ")).not.toBeNull();
    expect(errorDeMotivo("Son esposos")).toBeNull();
    expect(errorDeMotivo("x".repeat(1001))).not.toBeNull();
    expect(errorDeMotivo(undefined)).not.toBeNull();
  });
  it("la confirmación es el Shipping Mark que se anula, sin mayúsculas ni bordes", () => {
    expect(confirmacionCoincide(" dtd-8221 ", "DTD-8221")).toBe(true);
    expect(confirmacionCoincide("DTD-9001", "DTD-8221")).toBe(false);
    expect(confirmacionCoincide("", "DTD-8221")).toBe(false);
  });
});

describe("entradasDeCodigosFusionados", () => {
  it("deja fuera el vigente y lo que ya está en el historial, sin repetir", () => {
    const historial = [{ id: "h1", markbox: "LEG-12", reason: null, retiredAt: "2026-06-11T00:00:00Z" }];
    const r = entradasDeCodigosFusionados(["DTD-9001", "LEG-12", "dtd-8221", "DTD-8221", " "], "DTD-9001", historial);
    expect(r.map((e) => e.markbox)).toEqual(["dtd-8221"]);
    expect(r[0].retiredAt).toBe("");
    expect(r[0].reason).toMatch(/fusionada/);
  });
});
