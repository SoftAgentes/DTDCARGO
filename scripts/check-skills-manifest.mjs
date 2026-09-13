/**
 * Contrato entre `skills-lock.json` y el árbol de skills (SDD-0464).
 *
 * Dos familias conviven y el manifiesto solo describe una:
 *
 * - Terceros: `npx skills add` las instala en `.agents/skills/<nombre>/`. Su
 *   contenido NO se versiona (`.gitignore`: `higgsfield-*`, `find-skills`) y su
 *   registro SÍ: `skills-lock.json` es lo que `npx skills install` lee para
 *   reinstalarlas (commits 5d74c626 y b4cb0866). Que no existan en un clon
 *   fresco es el estado esperado, no una desalineación.
 * - Propias: versionadas con su `SKILL.md` en `.agents/skills/<nombre>/` y
 *   `.claude/skills/<nombre>/`. No pasan por el lock ni por el CLI.
 *
 * Alineación exigida (exit 1 si falla):
 * 1. El lock es válido: `version: 1`, `skills` objeto y cada entrada con
 *    `source`, `sourceType` y `skillPath` (…/SKILL.md) como strings.
 * 2. Cada entrada del lock apunta a un directorio que git ignora: nunca a una
 *    skill versionada (el CLI la sobrescribiría) ni a una que git versionaría
 *    por accidente (el caso de `find-skills` en b4cb0866).
 * 3. Cada skill versionada tiene `SKILL.md` con frontmatter `name` igual al
 *    directorio y `description` no vacía, y no aparece en el lock.
 * 4. Cada directorio ignorado presente en `.agents/skills/` tiene entrada en el
 *    lock: una instalación sin registro no se puede reproducir.
 *
 * Uso: node scripts/check-skills-manifest.mjs [--root <dir>]
 * Exit: 0 = alineado (imprime el inventario) · 1 = desalineado · 2 = error de contrato/lectura
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runGit } from "./harness-spawn.mjs";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", nc: "\x1b[0m" };

export const LOCK_FILE = "skills-lock.json";
/** Dónde instala el CLI las skills de terceros; solo aquí se exige registro. */
export const THIRD_PARTY_BASE = ".agents/skills";
/** Dónde viven las skills propias versionadas. */
export const VERSIONED_BASES = [".agents/skills", ".claude/skills"];

const SKILL_FILE = /^(?<base>\.agents\/skills|\.claude\/skills)\/(?<name>[^/]+)\/SKILL\.md$/;

/** Frontmatter YAML plano (`clave: valor`) entre dos líneas `---`; null si falta o no cierra. */
export function parseSkillFrontmatter(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const fields = {};
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") return fields;
    const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[match[1]] = value;
  }
  return null;
}

function splitNul(output) {
  return output.split("\0").map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Lee el árbol con git: skills versionadas (SKILL.md rastreados), directorios
 * ignorados presentes bajo .agents/skills y un predicado de ignorado para rutas
 * que pueden no existir.
 */
export function loadSkillsTree(root = process.cwd()) {
  const tracked = runGit(["ls-files", "-z", "--", ...VERSIONED_BASES], root);
  if (tracked.code !== 0) throw new Error(`git ls-files: ${tracked.err || `exit ${tracked.code}`}`);
  const versioned = [];
  for (const file of splitNul(tracked.out)) {
    const match = file.match(SKILL_FILE);
    if (!match) continue;
    const text = fs.readFileSync(path.join(root, file), "utf8");
    versioned.push({ base: match.groups.base, name: match.groups.name, frontmatter: parseSkillFrontmatter(text) });
  }

  const ignored = runGit(
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z", "--", THIRD_PARTY_BASE],
    root,
  );
  if (ignored.code !== 0) throw new Error(`git ls-files --ignored: ${ignored.err || `exit ${ignored.code}`}`);
  const ignoredPresent = [];
  for (const entry of splitNul(ignored.out)) {
    const match = entry.match(/^\.agents\/skills\/(?<name>[^/]+)\/?$/);
    if (match) ignoredPresent.push({ base: THIRD_PARTY_BASE, name: match.groups.name });
  }

  const isIgnored = (relativePath) => {
    const result = runGit(["check-ignore", "-q", "--", relativePath], root);
    if (result.code === 0) return true;
    if (result.code === 1) return false;
    throw new Error(`git check-ignore ${relativePath}: ${result.err || `exit ${result.code}`}`);
  };

  return { versioned, ignoredPresent, isIgnored };
}

export function readLock(root = process.cwd()) {
  const raw = fs.readFileSync(path.join(root, LOCK_FILE), "utf8").replace(/^﻿/, "");
  return JSON.parse(raw);
}

/** Decisión pura sobre lock y árbol. Devuelve problemas (vacío = alineado) e inventario. */
export function auditSkillsManifest({ lock, versioned, ignoredPresent, isIgnored }) {
  const problems = [];
  const entries = lock && typeof lock === "object" && lock.skills && typeof lock.skills === "object" && !Array.isArray(lock.skills)
    ? Object.entries(lock.skills)
    : null;
  if (lock?.version !== 1 || entries === null) {
    return {
      problems: [`${LOCK_FILE} requiere version=1 y skills{} (objeto por nombre)`],
      inventory: { thirdParty: [], versioned: [] },
    };
  }

  const versionedNames = new Set(versioned.map((skill) => `${skill.base}/${skill.name}`));
  const thirdParty = [];
  for (const [name, entry] of entries) {
    const shape = ["source", "sourceType", "skillPath"].filter((field) => typeof entry?.[field] !== "string" || !entry[field].trim());
    if (!/^[A-Za-z0-9._-]+$/.test(name)) problems.push(`${name}: nombre de skill inválido en el lock`);
    if (shape.length > 0) problems.push(`${name}: la entrada del lock no trae ${shape.join(", ")} como string`);
    else if (!entry.skillPath.endsWith("SKILL.md")) problems.push(`${name}: skillPath debe terminar en SKILL.md (${entry.skillPath})`);
    const directory = `${THIRD_PARTY_BASE}/${name}`;
    if (versionedNames.has(directory)) {
      problems.push(`${name}: está versionada en ${directory} y a la vez registrada como tercero en el lock; una reinstalación la sobrescribiría`);
      continue;
    }
    const ignored = isIgnored(`${directory}/SKILL.md`);
    if (!ignored) {
      problems.push(`${name}: git no ignora ${directory}/; al reinstalarla quedaría versionada por accidente (agrega la regla en .gitignore o retira la entrada)`);
    }
    thirdParty.push({ name, present: ignoredPresent.some((skill) => skill.name === name), ignored });
  }

  const lockNames = new Set(entries.map(([name]) => name));
  for (const skill of versioned) {
    const label = `${skill.base}/${skill.name}`;
    if (!skill.frontmatter) problems.push(`${label}/SKILL.md: sin frontmatter cerrado con ---`);
    else {
      if (skill.frontmatter.name !== skill.name) {
        problems.push(`${label}/SKILL.md: frontmatter name «${skill.frontmatter.name ?? ""}» no coincide con el directorio ${skill.name}`);
      }
      if (!skill.frontmatter.description?.trim()) problems.push(`${label}/SKILL.md: description vacía`);
    }
  }
  for (const skill of ignoredPresent) {
    if (!lockNames.has(skill.name)) {
      problems.push(`${skill.base}/${skill.name}/ está instalada e ignorada pero no figura en ${LOCK_FILE}: no se puede reinstalar`);
    }
  }

  return { problems, inventory: { thirdParty, versioned: versioned.map((skill) => ({ base: skill.base, name: skill.name })) } };
}

export function auditRepository(root = process.cwd()) {
  return auditSkillsManifest({ lock: readLock(root), ...loadSkillsTree(root) });
}

function describeInventory({ thirdParty, versioned }) {
  const present = thirdParty.filter((skill) => skill.present).length;
  const byBase = VERSIONED_BASES
    .map((base) => `${versioned.filter((skill) => skill.base === base).map((skill) => skill.name).join(", ") || "ninguna"} (${base})`)
    .join(" · ");
  return `${thirdParty.length} de terceros registradas en ${LOCK_FILE} (contenido ignorado; ${present} presente(s) en disco) · `
    + `${versioned.length} propias versionadas: ${byBase}`;
}

function main() {
  const rootFlag = process.argv.indexOf("--root");
  const root = rootFlag === -1 ? process.cwd() : path.resolve(process.argv[rootFlag + 1] ?? "");
  let result;
  try {
    result = auditRepository(root);
  } catch (error) {
    console.error(`${C.red}[FAIL]${C.nc} skills-manifest: ${error.message}`);
    return 2;
  }
  if (result.problems.length > 0) {
    console.log(`${C.red}[FAIL]${C.nc} skills-manifest: ${result.problems.length} problema(s) entre ${LOCK_FILE} y el árbol:`);
    for (const problem of result.problems) console.log(`${C.red}   • ${problem}${C.nc}`);
    return 1;
  }
  console.log(`${C.green}[OK]${C.nc} skills-manifest: ${describeInventory(result.inventory)}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
