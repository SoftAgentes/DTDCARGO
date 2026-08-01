import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const pluginRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function resolveRepoRoot(cwd = process.cwd()) {
  return path.resolve(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim(),
  );
}
export const repoRoot = resolveRepoRoot();
const targetPath = path.join(pluginRoot, "references", "policy-registry.json");

export async function buildPolicyRegistry() {
  const capsule = JSON.parse(
    await fs.readFile(
      path.join(
        repoRoot,
        "docs",
        "governance",
        "generated",
        "governance-capsule.json",
      ),
      "utf8",
    ),
  );
  const components = JSON.parse(
    await fs.readFile(
      path.join(
        repoRoot,
        "docs",
        "governance",
        "generated",
        "component-registry.json",
      ),
      "utf8",
    ),
  );

  return {
    schemaVersion: "1.0",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim(),
    normativeSource: capsule.normativeSource,
    readOnly: true,
    policies: capsule.policies,
    components: components.components.map(
      ({ id, name, status, implementation, replacement, policyRefs }) => ({
        id,
        name,
        status,
        implementation,
        policyRefs,
        replacement: replacement ?? null,
      }),
    ),
  };
}

export async function writePolicyRegistry() {
  const registry = await buildPolicyRegistry();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  writePolicyRegistry()
    .then((registry) => {
      console.log(
        `PLG-01: ${registry.policies.length} políticas y ${registry.components.length} componentes`,
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
