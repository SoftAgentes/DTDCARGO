// @vitest-environment node
import { describe, expect, it } from "vitest";
// @ts-expect-error El generador es ESM ejecutable (.mjs); Vitest valida su API runtime.
import { buildCapsule, loadPolicySources, validatePolicySources } from "../build-governance-capsule.mjs";

type PolicySource = {
  code: string;
  version: string;
  state: string;
  approvedAt: string;
  path: string;
};

type Capsule = {
  policies: PolicySource[];
};

describe("cápsula ejecutable de gobernanza", () => {
  it("indexa una vez las 28 políticas aprobadas", async () => {
    const sources = (await loadPolicySources()) as PolicySource[];
    expect(sources).toHaveLength(28);
    await expect(validatePolicySources(sources)).resolves.toEqual([]);
    const capsule = buildCapsule(sources, "fixture-commit") as Capsule;
    expect(capsule.policies).toHaveLength(28);
    expect(new Set(capsule.policies.map(({ code }) => code)).size).toBe(28);
  });

  it("incluye los contratos A11Y-01, CMP-01 y PLG-01", async () => {
    const capsule = buildCapsule(
      (await loadPolicySources()) as PolicySource[],
      "fixture-commit",
    ) as Capsule;
    expect(
      capsule.policies
        .filter(({ code }) => ["A11Y-01", "CMP-01", "PLG-01"].includes(code))
        .map(({ code, version }) => `${code}@${version}`),
    ).toEqual(["A11Y-01@1.1", "CMP-01@1.1", "PLG-01@1.0"]);
  });

  it("rechaza códigos duplicados", async () => {
    const sources = (await loadPolicySources()) as PolicySource[];
    const invalid = [...sources, structuredClone(sources[0])];
    const errors = await validatePolicySources(invalid);
    expect(errors.join("\n")).toContain("código duplicado");
  });
});
