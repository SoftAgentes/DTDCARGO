// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateInspectionInput } from "@/lib/studio/inspecciones/validators";

describe("validateInspectionInput · cabecera", () => {
  it("acepta una cabecera PSI mínima válida", () => {
    const { input, fieldErrors } = validateInspectionInput({
      type: "product_psi",
      title: "Inspección PO-12345",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).not.toBeNull();
    expect(input!.type).toBe("product_psi");
    expect(input!.title).toBe("Inspección PO-12345");
    expect(input!.score).toBeNull();
    expect(input!.client_id).toBeNull();
  });

  it("rechaza tipo inválido", () => {
    const { input, fieldErrors } = validateInspectionInput({
      type: "no-existe",
      title: "X",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.type).toBeDefined();
  });

  it("rechaza título vacío", () => {
    const { fieldErrors } = validateInspectionInput({
      type: "factory_audit",
      title: "   ",
    });
    expect(fieldErrors?.title).toBeDefined();
  });

  it("acepta score 0..100 solo en factory_audit", () => {
    const ok = validateInspectionInput({
      type: "factory_audit",
      title: "Auditoría",
      score: "85",
    });
    expect(ok.fieldErrors).toBeUndefined();
    expect(ok.input!.score).toBe(85);
  });

  it("redondea el score a entero", () => {
    const { input } = validateInspectionInput({
      type: "factory_audit",
      title: "Auditoría",
      score: "85.6",
    });
    expect(input!.score).toBe(86);
  });

  it("rechaza score en product_psi (solo aplica a fábrica)", () => {
    const { input, fieldErrors } = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      score: "85",
    });
    expect(input).toBeNull();
    expect(fieldErrors?.score).toBeDefined();
  });

  it("rechaza score fuera de 0..100", () => {
    const over = validateInspectionInput({
      type: "factory_audit",
      title: "Auditoría",
      score: "120",
    });
    expect(over.fieldErrors?.score).toBeDefined();

    const neg = validateInspectionInput({
      type: "factory_audit",
      title: "Auditoría",
      score: "-3",
    });
    expect(neg.fieldErrors?.score).toBeDefined();
  });

  it("valida fecha ISO; rechaza basura", () => {
    const ok = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      inspection_date: "2026-06-26",
    });
    expect(ok.fieldErrors).toBeUndefined();
    expect(ok.input!.inspection_date).toBe("2026-06-26");

    const bad = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      inspection_date: "26/06/2026",
    });
    expect(bad.fieldErrors?.inspection_date).toBeDefined();
  });

  it("rechaza días-hombre negativos", () => {
    const { fieldErrors } = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      duration_mandays: "-1",
    });
    expect(fieldErrors?.duration_mandays).toBeDefined();
  });

  it("acepta conclusión del enum y rechaza inválida", () => {
    const ok = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      conclusion: "observations",
    });
    expect(ok.input!.conclusion).toBe("observations");

    const bad = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      conclusion: "maybe",
    });
    expect(bad.fieldErrors?.conclusion).toBeDefined();
  });

  it("normaliza vacíos a null (cliente, producto, proveedor interno)", () => {
    const { input } = validateInspectionInput({
      type: "product_psi",
      title: "PSI",
      client_id: "",
      product: "  ",
      provider_internal: "",
    });
    expect(input!.client_id).toBeNull();
    expect(input!.product).toBeNull();
    expect(input!.provider_internal).toBeNull();
  });

  it("conserva el proveedor interno (white-label) cuando viene", () => {
    const { input } = validateInspectionInput({
      type: "factory_audit",
      title: "Auditoría",
      provider_internal: "Tercero CN",
    });
    expect(input!.provider_internal).toBe("Tercero CN");
  });
});
