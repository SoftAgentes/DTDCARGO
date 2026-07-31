import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildPolicyRegistry,
  repoRoot,
  resolveRepoRoot,
} from "./build-policy-registry.mjs";
import { validateRegistryContract } from "./validate-governance.mjs";

export async function runForwardTests() {
  const expected = await buildPolicyRegistry();
  const cases = [
    {
      name: "resuelve el worktree activo desde fuente o cache",
      run() {
        assert.equal(repoRoot, resolveRepoRoot(process.cwd()));
        assert.equal(repoRoot, process.cwd());
        assert.doesNotMatch(repoRoot, /[\\/]\.codex[\\/]plugins[\\/]cache[\\/]/);
      },
    },
    {
      name: "conserva read-only y 27 políticas aprobadas",
      run() {
        assert.equal(expected.readOnly, true);
        assert.equal(expected.policies.length, 27);
        assert.ok(
          expected.policies.every(({ state }) =>
            /\b(?:aprobada|implementada|verificada)\b/i.test(state),
          ),
        );
      },
    },
    {
      name: "conserva cuatro componentes y NumericInput canonical",
      run() {
        assert.equal(expected.components.length, 4);
        assert.equal(
          expected.components.find(({ id }) => id === "numeric-input")?.status,
          "canonical",
        );
      },
    },
    {
      name: "conserva lifecycle deprecated y cero integración externa",
      run() {
        const deprecated = expected.components.find(
          ({ id }) => id === "llm-mode-toggle",
        );
        assert.equal(deprecated?.status, "deprecated");
        assert.equal(deprecated?.replacement?.componentId, "segmented-control");
        assert.doesNotMatch(
          JSON.stringify(expected),
          /mcpServers|marketplace|credentials|service_role/i,
        );
      },
    },
    {
      name: "rechaza escritura",
      run() {
        const invalid = structuredClone(expected);
        invalid.readOnly = false;
        assert.match(
          validateRegistryContract(invalid, expected).join("\n"),
          /debe ser readOnly/,
        );
      },
    },
    {
      name: "rechaza política no aprobada",
      run() {
        const invalid = structuredClone(expected);
        invalid.policies[0].state = "investigada";
        assert.match(
          validateRegistryContract(invalid, expected).join("\n"),
          /política no aprobada/,
        );
      },
    },
    {
      name: "rechaza integración externa",
      run() {
        const invalid = structuredClone(expected);
        invalid.marketplace = {};
        assert.match(
          validateRegistryContract(invalid, expected).join("\n"),
          /integración externa prohibida/,
        );
      },
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    await testCase.run();
    console.log(`ok ${index + 1} - ${testCase.name}`);
  }
  console.log(`PLG-01 forward-tests: ${cases.length}/${cases.length}`);
  return { passed: cases.length, total: cases.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  runForwardTests().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
