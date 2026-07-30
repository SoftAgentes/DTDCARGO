import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildPolicyRegistry,
  pluginRoot,
  repoRoot,
} from "./build-policy-registry.mjs";

const registryPath = path.join(pluginRoot, "references", "policy-registry.json");

export function validateRegistryContract(current, expected) {
  const errors = [];
  const comparableExpected = structuredClone(expected);
  comparableExpected.sourceCommit = current.sourceCommit;

  if (
    `${JSON.stringify(current, null, 2)}\n` !==
    `${JSON.stringify(comparableExpected, null, 2)}\n`
  ) {
    errors.push("policy-registry.json está desactualizado");
  }
  if (current.readOnly !== true) errors.push("el registro debe ser readOnly");
  if (
    current.policies.some(
      ({ state }) =>
        !/\b(?:aprobada|implementada|verificada)\b/i.test(state),
    )
  ) {
    errors.push("una política no aprobada entró al registro");
  }
  if (/mcpServers|marketplace|credentials|service_role/i.test(JSON.stringify(current))) {
    errors.push("el registro declara una integración externa prohibida");
  }
  return errors;
}

export async function validateGovernance() {
  const current = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const expected = await buildPolicyRegistry();
  const errors = validateRegistryContract(current, expected);

  for (const policy of current.policies) {
    try {
      await fs.access(path.join(repoRoot, policy.path));
    } catch {
      errors.push(`política sin fuente: ${policy.path}`);
    }
  }
  for (const component of current.components) {
    try {
      await fs.access(path.join(repoRoot, component.implementation.path));
    } catch {
      errors.push(`componente sin implementación: ${component.id}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return current;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  validateGovernance()
    .then((registry) => {
      console.log(
        `PLG-01 válido: read-only · ${registry.policies.length} políticas · ${registry.components.length} componentes`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
