import { describe, expect, it } from "vitest";
import {
  buildPolicyRegistry,
  repoRoot,
  resolveRepoRoot,
} from "../build-policy-registry.mjs";
import { validateRegistryContract } from "../validate-governance.mjs";

describe("PLG-01 policy registry", () => {
  it("resuelve el worktree activo aunque el plugin esté instalado en cache", () => {
    expect(repoRoot).toBe(resolveRepoRoot(process.cwd()));
    expect(repoRoot).toBe(process.cwd());
    expect(repoRoot).not.toMatch(/[\\/]\.codex[\\/]plugins[\\/]cache[\\/]/);
  });

  it("sólo contiene fuentes aprobadas y es read-only", async () => {
    const registry = await buildPolicyRegistry();
    expect(registry.readOnly).toBe(true);
    expect(registry.policies).toHaveLength(27);
    expect(
      registry.policies.every(({ state }) =>
        /\b(?:aprobada|implementada|verificada)\b/i.test(state),
      ),
    ).toBe(true);
  });

  it("representa A11Y-01 y el ciclo deprecated", async () => {
    const registry = await buildPolicyRegistry();
    expect(
      registry.policies.some(
        ({ code, version }) => code === "A11Y-01" && version === "1.1",
      ),
    ).toBe(true);
    const deprecated = registry.components.find(
      ({ id }) => id === "llm-mode-toggle",
    );
    expect(deprecated.status).toBe("deprecated");
    expect(deprecated.replacement.componentId).toBe("segmented-control");
  });

  it("no declara integración externa", async () => {
    const registry = await buildPolicyRegistry();
    expect(
      /mcpServers|marketplace|credentials|service_role/i.test(
        JSON.stringify(registry),
      ),
    ).toBe(false);
  });

  it("rechaza un registro que habilita escritura", async () => {
    const expected = await buildPolicyRegistry();
    const invalid = structuredClone(expected);
    invalid.readOnly = false;
    expect(validateRegistryContract(invalid, expected).join("\n")).toMatch(
      /debe ser readOnly/,
    );
  });

  it("rechaza una política no aprobada", async () => {
    const expected = await buildPolicyRegistry();
    const invalid = structuredClone(expected);
    invalid.policies[0].state = "investigada";
    expect(validateRegistryContract(invalid, expected).join("\n")).toMatch(
      /política no aprobada/,
    );
  });

  it("rechaza integraciones externas añadidas al registro", async () => {
    const expected = await buildPolicyRegistry();
    const invalid = structuredClone(expected);
    invalid.marketplace = {};
    expect(validateRegistryContract(invalid, expected).join("\n")).toMatch(
      /integración externa prohibida/,
    );
  });
});
