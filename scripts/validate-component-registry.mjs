import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRegistry,
  loadSourceRecords,
  validateSourceRecords,
} from "./build-component-registry.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(
  repoRoot,
  "docs",
  "governance",
  "generated",
  "component-registry.json",
);

async function main() {
  const sources = await loadSourceRecords();
  const errors = await validateSourceRecords(sources);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const current = JSON.parse(await fs.readFile(generatedPath, "utf8"));
  const expected = buildRegistry(sources, current.sourceCommit);
  if (`${JSON.stringify(current, null, 2)}\n` !== `${JSON.stringify(expected, null, 2)}\n`) {
    throw new Error(
      "component-registry.json está desactualizado; ejecuta pnpm components:index",
    );
  }

  console.log(
    `CMP-01 válido: ${sources.length} fuente(s), agregado reproducible y cero rutas rotas`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
