import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(cwd = process.cwd()) {
  return path.resolve(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    }).trim(),
  );
}

async function listFiles(root, current = root) {
  const files = [];
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, absolute)));
    else if (entry.isFile()) files.push(path.relative(root, absolute));
  }
  return files.sort();
}

async function digest(absolute) {
  return createHash("sha256").update(await fs.readFile(absolute)).digest("hex");
}

async function assertInstalledMatches(sourceRoot, targetRoot) {
  const sourceFiles = await listFiles(sourceRoot);
  const targetFiles = new Set(await listFiles(targetRoot));
  for (const relative of sourceFiles) {
    if (!targetFiles.has(relative)) {
      throw new Error(`cache incompleta: falta ${relative}`);
    }
    const [sourceHash, targetHash] = await Promise.all([
      digest(path.join(sourceRoot, relative)),
      digest(path.join(targetRoot, relative)),
    ]);
    if (sourceHash !== targetHash) {
      throw new Error(`cache desactualizada: ${relative}`);
    }
  }
  return sourceFiles.length;
}

export async function reinstallPlugin({ install = false } = {}) {
  const repoRoot = resolveRepoRoot();
  const sourceRoot = path.join(
    repoRoot,
    ".agents",
    "plugins",
    "plugins",
    "erp-studio-governance",
  );
  const manifest = JSON.parse(
    await fs.readFile(
      path.join(sourceRoot, ".codex-plugin", "plugin.json"),
      "utf8",
    ),
  );
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`versión de plugin inválida: ${manifest.version}`);
  }
  const codexBase = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
  const cacheBase = path.join(
    codexBase,
    "plugins",
    "cache",
    "dtdcargo",
    manifest.name,
  );
  const targetRoot = path.resolve(cacheBase, manifest.version);
  if (!targetRoot.startsWith(`${path.resolve(cacheBase)}${path.sep}`)) {
    throw new Error("ruta de cache fuera del destino aprobado");
  }

  if (install) {
    execFileSync(
      process.execPath,
      [path.join(sourceRoot, "scripts", "build-policy-registry.mjs")],
      { cwd: repoRoot, stdio: "inherit" },
    );
    await fs.mkdir(targetRoot, { recursive: true });
    await fs.cp(sourceRoot, targetRoot, { recursive: true, force: true });
  }

  const files = await assertInstalledMatches(sourceRoot, targetRoot);
  execFileSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "validate-governance.mjs")],
    { cwd: repoRoot, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "run-forward-tests.mjs")],
    { cwd: repoRoot, stdio: "inherit" },
  );
  console.log(
    `PLG-01 cache ${install ? "reinstalada" : "verificada"}: ${manifest.name}@${manifest.version} · ${files} archivos fuente`,
  );
  return { repoRoot, sourceRoot, targetRoot, files };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const install = process.argv.includes("--install");
  reinstallPlugin({ install }).catch((error) => {
    console.error(error.message);
    console.error(`script cargado desde: ${scriptDir}`);
    process.exitCode = 1;
  });
}
