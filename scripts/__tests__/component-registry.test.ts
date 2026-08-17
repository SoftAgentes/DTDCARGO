import { describe, expect, it } from "vitest";
// @ts-expect-error El generador es ESM ejecutable (.mjs); Vitest valida su API runtime.
import { buildRegistry, loadSourceRecords, validateSourceRecords } from "../build-component-registry.mjs";

type SourceRecord = {
  file: string;
  record: {
    id: string;
    policyRefs: Array<{ code: string }>;
    implementation: { path: string };
    replacement: { componentId: string };
  };
};

describe("CMP-01 component registry", () => {
  it("valida las fuentes reales y representa A11Y-01", async () => {
    const sources = (await loadSourceRecords()) as SourceRecord[];
    // La lista va fijada a propósito: agregar un componente al registro CMP-01
    // tiene que ser una decisión deliberada, no algo que se cuele. `action-menu`
    // entra con SDD-0263 en estado `proposed` (sin consumidores todavía).
    expect(sources).toHaveLength(5);
    expect(sources.map(({ record }) => record.id)).toEqual([
      "action-menu",
      "confirm-dialog",
      "llm-mode-toggle",
      "numeric-input",
      "segmented-control",
    ]);
    expect(
      sources
        .find(({ record }) => record.id === "confirm-dialog")
        ?.record.policyRefs.some(({ code }) => code === "A11Y-01"),
    ).toBe(true);
    expect(
      sources
        .find(({ record }) => record.id === "numeric-input")
        ?.record.policyRefs.some(({ code }) => code === "A11Y-01"),
    ).toBe(true);
    await expect(validateSourceRecords(sources)).resolves.toEqual([]);
  });

  it("rechaza una ruta de implementación inexistente", async () => {
    const sources = (await loadSourceRecords()) as SourceRecord[];
    const invalid = structuredClone(sources);
    invalid[0].record.implementation.path = "app/studio/_components/ui/Missing.tsx";
    const errors = await validateSourceRecords(invalid);
    expect(errors.join("\n")).toContain("ruta inexistente");
  });

  it("genera el mismo agregado con la misma fuente y commit", async () => {
    const sources = (await loadSourceRecords()) as SourceRecord[];
    expect(buildRegistry(sources, "fixture-commit")).toEqual(
      buildRegistry(sources, "fixture-commit"),
    );
  });

  it("rechaza un deprecated sin reemplazo canónico registrado", async () => {
    const sources = (await loadSourceRecords()) as SourceRecord[];
    const invalid = structuredClone(sources);
    const deprecated = invalid.find(
      ({ record }) => record.id === "llm-mode-toggle",
    );
    if (!deprecated) throw new Error("fixture llm-mode-toggle ausente");
    deprecated.record.replacement.componentId = "missing-component";
    const errors = await validateSourceRecords(invalid);
    expect(errors.join("\n")).toContain(
      "replacement.componentId no existe en el registro",
    );
  });
});
