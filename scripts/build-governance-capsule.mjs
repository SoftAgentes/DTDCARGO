import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const governanceDir = path.join(repoRoot, "docs", "governance");
const policiesDir = path.join(governanceDir, "policies");
const masterPath = path.join(governanceDir, "README.md");
const generatedPath = path.join(
  governanceDir,
  "generated",
  "governance-capsule.json",
);

function repoPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).replaceAll(path.sep, "/");
}

function parsePolicy(file, content) {
  const heading = content.match(
    /^#\s+([A-Z][A-Z0-9]{1,5}-[0-9]{2})\s+v([0-9]+\.[0-9]+)\b/m,
  );
  const state = content.match(/^\|\s*Estado\s*\|\s*([^|]+?)\s*\|$/im);
  const approval =
    content.match(
      /^\|\s*Aprobaci[oó]n\s*\|\s*(\d{4}-\d{2}-\d{2})\b[^|]*\|$/im,
    ) ??
    content.match(
      /^\|\s*Creado\s*\|\s*(\d{4}-\d{2}-\d{2})\b[^|]*\|$/im,
    );

  return {
    file,
    content,
    code: heading?.[1],
    version: heading?.[2],
    state: state?.[1]?.trim(),
    approvedAt: approval?.[1],
    path: repoPath(path.join(policiesDir, file)),
  };
}

export async function loadPolicySources() {
  const files = (await fs.readdir(policiesDir))
    .filter((file) => file.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) =>
      parsePolicy(file, await fs.readFile(path.join(policiesDir, file), "utf8")),
    ),
  );
}

export async function validatePolicySources(sources) {
  const errors = [];
  const codes = new Set();
  const master = await fs.readFile(masterPath, "utf8");

  for (const source of sources) {
    const label = `docs/governance/policies/${source.file}`;
    if (!source.code || !source.version) {
      errors.push(`${label}: heading CODE vX.Y ausente o inválido`);
      continue;
    }
    if (!source.state) errors.push(`${label}: Estado ausente`);
    if (!source.approvedAt) {
      errors.push(`${label}: fecha de Aprobación/Creado ausente`);
    }
    if (codes.has(source.code)) errors.push(`${label}: código duplicado ${source.code}`);
    codes.add(source.code);
    if (!/\b(?:aprobada|implementada|verificada)\b/i.test(source.state ?? "")) {
      errors.push(`${label}: estado no elegible para enforcement: ${source.state}`);
    }
    if (!new RegExp(`^\\|\\s*${source.code}\\s*\\|`, "m").test(master)) {
      errors.push(`${label}: ${source.code} ausente del registro maestro`);
    }
  }

  return errors;
}

export function buildCapsule(sources, sourceCommit) {
  const policies = sources
    .map(({ code, version, state, approvedAt, path: policyPath }) => ({
      code,
      version,
      state,
      approvedAt,
      path: policyPath,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
  const latestApproval = policies
    .map((policy) => policy.approvedAt)
    .sort()
    .at(-1);

  return {
    schemaVersion: "1.0",
    generatedAt: `${latestApproval}T00:00:00.000Z`,
    sourceCommit,
    normativeSource: "docs/governance/README.md",
    agentBrief: "docs/governance/AGENT-BRIEF.md",
    commands: {
      governance: "pnpm governance:check",
      components: "pnpm components:check",
      documentation: "pnpm docs:check",
      canonical: "pnpm verify"
    },
    policies,
  };
}

export async function writeCapsule({ sourceCommit } = {}) {
  const sources = await loadPolicySources();
  const errors = await validatePolicySources(sources);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const commit =
    sourceCommit ??
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  const capsule = buildCapsule(sources, commit);
  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.writeFile(generatedPath, `${JSON.stringify(capsule, null, 2)}\n`);
  return capsule;
}

export async function checkCapsule() {
  const sources = await loadPolicySources();
  const errors = await validatePolicySources(sources);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const current = JSON.parse(await fs.readFile(generatedPath, "utf8"));
  const expected = buildCapsule(sources, current.sourceCommit);
  if (`${JSON.stringify(current, null, 2)}\n` !== `${JSON.stringify(expected, null, 2)}\n`) {
    throw new Error(
      "governance-capsule.json está desactualizado; ejecuta pnpm governance:index",
    );
  }
  return current;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const capsule = checkOnly ? await checkCapsule() : await writeCapsule();
  console.log(
    `Gobernanza: ${capsule.policies.length} política(s) aprobada(s) · ${checkOnly ? "cápsula vigente" : "cápsula generada"}`,
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
