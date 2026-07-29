import { describe, expect, it } from "vitest";
import {
  buildRegistry,
  loadSourceRecords,
  validateSourceRecords,
} from "../build-component-registry.mjs";

describe("CMP-01 component registry", () => {
  it("valida la fuente real de ConfirmDialog", async () => {
    const sources = await loadSourceRecords();
    expect(sources).toHaveLength(1);
    expect(sources[0].record.id).toBe("confirm-dialog");
    await expect(validateSourceRecords(sources)).resolves.toEqual([]);
  });

  it("rechaza una ruta de implementación inexistente", async () => {
    const sources = await loadSourceRecords();
    const invalid = structuredClone(sources);
    invalid[0].record.implementation.path = "app/studio/_components/ui/Missing.tsx";
    const errors = await validateSourceRecords(invalid);
    expect(errors.join("\n")).toContain("ruta inexistente");
  });

  it("genera el mismo agregado con la misma fuente y commit", async () => {
    const sources = await loadSourceRecords();
    expect(buildRegistry(sources, "fixture-commit")).toEqual(
      buildRegistry(sources, "fixture-commit"),
    );
  });
});
