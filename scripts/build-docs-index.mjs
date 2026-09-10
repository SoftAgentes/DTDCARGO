#!/usr/bin/env node
/**
 * build-docs-index.mjs — generador + validador del registro de specs (ISO 9001 §7.5.3).
 *
 * Cero dependencias. Uso:
 *   node scripts/build-docs-index.mjs           → valida + regenera el índice en docs/specs/README.md
 *   node scripts/build-docs-index.mjs --check   → solo valida (no escribe) · para CI / `pnpm docs:check`
 *
 * NO se cuelga de `next build`: un typo de front-matter en docs NUNCA bloquea un deploy de código.
 * Falla (exit 1) si una spec no tiene front-matter core (sdd/title/status) o status inválido.
 * Mata el drift que hundió a design/README.md: el índice se genera, no se mantiene a mano.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SPECS_DIR = "docs/specs";
const README = join(SPECS_DIR, "README.md");
const VALID_STATUS = ["draft", "proposed", "approved", "in-progress", "done", "superseded"];
const START = "<!-- AUTO-INDEX:START (generado por scripts/build-docs-index.mjs · no editar a mano) -->";
const END = "<!-- AUTO-INDEX:END -->";
const checkOnly = process.argv.includes("--check");

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseFrontMatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const fm = {};
  for (const rawLine of text.slice(3, end).split(/\r?\n/)) {
    // Stripear \r colgante: con CRLF, la última línea del frontmatter queda con
    // un \r final (el slice corta antes del \n de cierre) y `(.*)$` no lo matchea
    // (en regex JS `.` no incluye \r) → el último campo no se parseaba.
    const line = rawLine.replace(/\r+$/, "");
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if (v === "null" || v === "") v = null;
    else v = v.replace(/^["']|["']$/g, "");
    fm[m[1]] = v;
  }
  return fm;
}

const errors = [];
const missingConfid = [];
const rows = [];
const numbers = new Set();

const dirs = readdirSync(SPECS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{4}-/.test(d.name))
  .map((d) => d.name)
  .sort();

for (const dir of dirs) {
  const specPath = join(SPECS_DIR, dir, "spec.md");
  if (!existsSync(specPath)) {
    errors.push(`${dir}: falta spec.md`);
    continue;
  }
  const fm = parseFrontMatter(readFileSync(specPath, "utf8"));
  if (!fm) {
    errors.push(`${dir}/spec.md: sin front-matter (---)`);
    continue;
  }
  numbers.add(parseInt(dir.slice(0, 4), 10));
  for (const k of ["sdd", "title", "status"]) {
    if (!fm[k]) errors.push(`${dir}/spec.md: falta '${k}' en front-matter`);
  }
  if (fm.status && !VALID_STATUS.includes(fm.status)) {
    errors.push(`${dir}/spec.md: status inválido '${fm.status}' (válidos: ${VALID_STATUS.join("|")})`);
  }
  if (!fm.confidencialidad) missingConfid.push(dir.slice(0, 4));
  rows.push({
    num: dir.slice(0, 4),
    slug: dir,
    title: fm.title || "(sin título)",
    status: fm.status || "?",
    confid: fm.confidencialidad || "interno",
  });
}

// Huecos en el correlativo (código sin spec o renumerado → auditar)
const max = numbers.size ? Math.max(...numbers) : 0;
const gaps = [];
for (let i = 1; i <= max; i++) if (!numbers.has(i)) gaps.push(String(i).padStart(4, "0"));

// Tabla
let table = `### Índice de specs (generado · ${rows.length} specs)\n\n`;
table += "| # | Spec | Estado | Conf. |\n|---|---|---|---|\n";
for (const r of rows) {
  const t = r.title.length > 64 ? r.title.slice(0, 61) + "…" : r.title;
  table += `| ${r.num} | ${t} | ${r.status} | ${r.confid} |\n`;
}
if (gaps.length) {
  table += `\n> **Huecos en el correlativo:** ${gaps.join(", ")} — código sin spec o renumerado, auditar caso por caso.\n`;
}

function renderReadme(md) {
  const block = `${START}\n${table}${END}`;
  if (md.includes(START) && md.includes(END)) {
    return md.replace(new RegExp(`${escapeRe(START)}[\\s\\S]*${escapeRe(END)}`), block);
  }
  return md.trimEnd() + "\n\n" + block + "\n";
}

// Reporte
if (missingConfid.length) {
  console.warn(`⚠ ${missingConfid.length}/${rows.length} specs sin 'confidencialidad' (default: interno). Backfill incremental: ${missingConfid.join(", ")}`);
}

if (!existsSync(README)) {
  errors.push(`falta ${README}`);
} else {
  const md = readFileSync(README, "utf8");
  const expected = renderReadme(md);
  if (checkOnly) {
    if (md !== expected) {
      errors.push(`${README}: índice desactualizado; ejecuta 'pnpm docs:index'`);
    }
  } else {
    writeFileSync(README, expected);
    console.log(`✓ índice regenerado en ${README} — ${rows.length} specs${gaps.length ? `, ${gaps.length} huecos` : ""}`);
  }
}

if (errors.length) {
  console.error("✖ docs:check — errores:");
  for (const e of errors) console.error("  - " + e);
} else if (checkOnly) {
  console.log(`✓ docs:check — índice sincronizado con ${rows.length} specs`);
}

process.exit(errors.length ? 1 : 0);
