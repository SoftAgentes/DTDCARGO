import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = path.join(repoRoot, "docs", "governance", "components");
const generatedPath = path.join(
  repoRoot,
  "docs",
  "governance",
  "generated",
  "component-registry.json",
);
const schemaPath = path.join(
  repoRoot,
  "docs",
  "governance",
  "templates",
  "component-registry.schema.json",
);

function toRepoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/");
}

function formatAjvErrors(errors = []) {
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}

async function readJson(absolutePath) {
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

async function exists(repoPath) {
  try {
    await fs.access(path.join(repoRoot, repoPath));
    return true;
  } catch {
    return false;
  }
}

function referencedPaths(record) {
  return [
    record.implementation.path,
    ...record.policyRefs.map((reference) => reference.path),
    ...(record.recommendationRefs ?? []),
    record.api.contractPath,
    ...record.accessibility.evidence,
    ...record.examples.correct,
    ...record.examples.incorrect,
    ...record.tests.map((test) => test.path),
    ...record.consumers.map((consumer) => consumer.path),
    record.review.reviewPath,
    ...(record.replacement ? [record.replacement.planPath] : []),
  ];
}

export async function loadSourceRecords() {
  const entries = await fs.readdir(componentsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map(async (file) => ({
      file,
      record: await readJson(path.join(componentsDir, file)),
    })),
  );
}

export async function validateSourceRecords(sources) {
  const schema = await readJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  const errors = [];
  const ids = new Set();
  const tokenFiles = [
    await fs.readFile(path.join(repoRoot, "app", "studio", "tokens.css"), "utf8"),
    await fs.readFile(path.join(repoRoot, "app", "globals.css"), "utf8"),
  ].join("\n");

  for (const { file, record } of sources) {
    const label = `docs/governance/components/${file}`;

    if (!validateSchema(record)) {
      errors.push(`${label}: ${formatAjvErrors(validateSchema.errors)}`);
      continue;
    }

    if (file !== `${record.id}.json`) {
      errors.push(`${label}: el basename debe coincidir con id=${record.id}`);
    }
    if (ids.has(record.id)) {
      errors.push(`${label}: id duplicado ${record.id}`);
    }
    ids.add(record.id);

    if (record.implementation.path.startsWith("docs/governance/")) {
      errors.push(`${label}: implementation.path no puede apuntar a gobernanza`);
    }

    for (const repoPath of referencedPaths(record)) {
      if (!(await exists(repoPath))) {
        errors.push(`${label}: ruta inexistente ${repoPath}`);
      }
    }

    if (await exists(record.implementation.path)) {
      const implementation = await fs.readFile(
        path.join(repoRoot, record.implementation.path),
        "utf8",
      );
      const exportPattern = new RegExp(
        `export\\s+(?:async\\s+)?(?:function|class|const|let|var)\\s+${record.implementation.exportName}\\b`,
      );
      if (!exportPattern.test(implementation)) {
        errors.push(
          `${label}: export ${record.implementation.exportName} no encontrado`,
        );
      }
      for (const token of record.tokens) {
        if (!implementation.includes(`var(${token}`)) {
          errors.push(`${label}: token ${token} no se consume en la implementación`);
        }
        if (!tokenFiles.includes(`${token}:`)) {
          errors.push(`${label}: token ${token} no está declarado`);
        }
      }
    }

    for (const policyRef of record.policyRefs) {
      if (!(await exists(policyRef.path))) continue;
      const policy = await fs.readFile(path.join(repoRoot, policyRef.path), "utf8");
      const heading = new RegExp(
        `^#\\s+${policyRef.code}\\s+v${policyRef.version}\\b`,
        "m",
      );
      if (!heading.test(policy)) {
        errors.push(
          `${label}: ${policyRef.code} no coincide con versión/ruta declarada`,
        );
      }
      if (!/\|\s*Estado\s*\|\s*(?:aprobada|implementada|verificada)\b/im.test(policy)) {
        errors.push(`${label}: ${policyRef.code} no tiene estado elegible`);
      }
    }

    for (const consumer of record.consumers) {
      if (!(await exists(consumer.path))) continue;
      const content = await fs.readFile(path.join(repoRoot, consumer.path), "utf8");
      if (
        !new RegExp(
          `import\\s*\\{[^}]*\\b${record.implementation.exportName}\\b[^}]*\\}`,
          "s",
        ).test(content)
      ) {
        errors.push(
          `${label}: consumidor ${consumer.path} no importa ${record.implementation.exportName}`,
        );
      }
    }

    if (
      record.status === "canonical" &&
      Object.entries(record.accessibility)
        .filter(([key]) => key !== "evidence")
        .some(([, state]) => !["verified", "not-applicable"].includes(state))
    ) {
      errors.push(`${label}: canonical requiere evidencia accesible completa`);
    }

    const serialized = JSON.stringify(record);
    const prohibited = [
      /\bsbp_[A-Za-z0-9_-]+\b/i,
      /\bservice[_-]?role[_-]?key\b/i,
      /\b(?:token|signature|sig|expires)=/i,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    ];
    if (prohibited.some((pattern) => pattern.test(serialized))) {
      errors.push(`${label}: contiene secreto, correo o payload prohibido`);
    }
  }

  return errors;
}

export function buildRegistry(sources, sourceCommit) {
  const components = sources
    .map(({ record }) => record)
    .sort((left, right) => left.id.localeCompare(right.id));
  const generatedAt = `${components
    .map((component) => component.review.lastReviewedAt)
    .sort()
    .at(-1)}T00:00:00.000Z`;

  return {
    schemaVersion: "1.0",
    generatedAt,
    sourceCommit,
    components,
  };
}

export async function writeRegistry({ sourceCommit } = {}) {
  const sources = await loadSourceRecords();
  const errors = await validateSourceRecords(sources);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  const resolvedCommit =
    sourceCommit ??
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  const registry = buildRegistry(sources, resolvedCommit);
  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.writeFile(generatedPath, `${JSON.stringify(registry, null, 2)}\n`);
  return registry;
}

async function main() {
  const registry = await writeRegistry();
  console.log(
    `CMP-01: ${registry.components.length} componente(s) → ${toRepoPath(generatedPath)}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
