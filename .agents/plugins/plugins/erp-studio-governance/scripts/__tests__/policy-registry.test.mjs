// @vitest-environment node
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
    expect(registry.policies).toHaveLength(28);
    expect(
      registry.policies.every(({ state }) =>
        /\b(?:aprobada|implementada|verificada)\b/i.test(state),
      ),
    ).toBe(true);
  });

  it("representa A11Y-01, NumericInput y el ciclo deprecated", async () => {
    const registry = await buildPolicyRegistry();
    expect(
      registry.policies.some(
        ({ code, version }) => code === "A11Y-01" && version === "1.1",
      ),
    ).toBe(true);
    // 5 desde SDD-0263: `action-menu` entra `proposed`. La cápsula del plugin
    // es un derivado read-only del registro, así que refleja el alta.
    expect(registry.components).toHaveLength(5);
    const numericInput = registry.components.find(
      ({ id }) => id === "numeric-input",
    );
    expect(numericInput.status).toBe("canonical");
    // La cápsula es una PROYECCIÓN del registro, no una copia: sólo trae id,
    // name, status, implementation, policyRefs y replacement. Por eso acá se
    // afirma el `status` y no los `consumers` — ese campo no viaja.
    const actionMenu = registry.components.find(({ id }) => id === "action-menu");
    // `canonical` desde SDD-0266: la cabecera de Clientes es su consumidor
    // verificado, que es lo que CMP-01 exige para promover.
    expect(actionMenu.status).toBe("canonical");
    expect(actionMenu.policyRefs.some(({ code }) => code === "BTN-01")).toBe(true);
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
