#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const DRIVER = "dtd-generated-records";
const SETTINGS = new Map([
  [`merge.${DRIVER}.name`, "DTD generated records semantic merge"],
  [
    `merge.${DRIVER}.driver`,
    "node scripts/merge-generated-records.mjs %O %A %B %P",
  ],
  [`merge.${DRIVER}.recursive`, "binary"],
]);
const checkOnly = process.argv.includes("--check");

function git(args, { allowMissing = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  if (allowMissing && result.status === 1) return null;
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(" ")} falló: ${detail}`);
  }
  return result.stdout.trim();
}

function main() {
  const root = git(["rev-parse", "--show-toplevel"]);
  const script = path.join(root, "scripts", "merge-generated-records.mjs");
  if (!existsSync(script)) {
    throw new Error(`falta el driver versionado: ${script}`);
  }

  if (!checkOnly) {
    for (const [key, value] of SETTINGS) {
      git(["config", "--local", key, value]);
    }
  }

  const mismatches = [];
  for (const [key, expected] of SETTINGS) {
    const actual = git(["config", "--local", "--get", key], { allowMissing: true });
    if (actual !== expected) mismatches.push(`${key}: esperado '${expected}', actual '${actual ?? "ausente"}'`);
  }
  if (mismatches.length > 0) {
    throw new Error(
      `driver no configurado en este clon:\n  - ${mismatches.join("\n  - ")}\n` +
        "Ejecuta: node scripts/install-merge-drivers.mjs",
    );
  }

  console.log(
    `✓ merge driver '${DRIVER}' ${checkOnly ? "verificado" : "instalado"} en ${root}`,
  );
}

try {
  main();
} catch (error) {
  console.error(`✖ install-merge-drivers — ${error.message}`);
  process.exitCode = 1;
}
