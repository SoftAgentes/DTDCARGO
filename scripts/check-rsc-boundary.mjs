#!/usr/bin/env node
/**
 * scripts/check-rsc-boundary.mjs — detector de cruces de frontera server/client (RSC).
 *
 * Caza la clase de bug que el resto del gate NO ve (typecheck + vitest dan verde):
 * un **server component / módulo server** que importa y usa un **valor** (helper,
 * constante) exportado por un módulo `"use client"`. En runtime Next.js lo convierte
 * en una *referencia de cliente* y explota con 500
 * ("Attempted to call a client function from the server").
 *
 * Incidente que lo motivó (SDD-0050): `app/studio/(app)/debug/page.tsx` (server)
 * importaba `resolveDebugTab` de `DebugTabs.tsx` (`"use client"`) → 500. El fix fue
 * mover los helpers puros a un módulo server-safe (`debug-tabs.shared.ts`).
 *
 * Heurística (rápida, cero deps, sin TS API):
 *   - Sólo mira módulos importadores que NO son `"use client"` (candidatos a server).
 *   - Si importan un binding-VALOR (no `import type`) desde un módulo LOCAL que SÍ es
 *     `"use client"`, y el nombre del binding NO parece un componente React
 *     (PascalCase tipo `DebugTabs`), lo marcan como violación.
 *       · `resolveDebugTab` (camelCase) → VALOR  → ❌ flag
 *       · `DEBUG_TABS`      (ALL_CAPS)  → VALOR  → ❌ flag
 *       · `DebugTabs`/`NorteTab` (Pascal) → componente → ✅ permitido (se renderiza como JSX)
 *   - `import type {…}` y especificadores `{ type X }` → ignorados (se borran en build).
 *
 * Falsos positivos posibles: una constante/clase no-componente que de verdad sea
 * segura cruzar (raro — Next igual la proxquea). Si aparece uno legítimo, movés el
 * valor a un módulo server-safe (el patrón correcto) o lo importás como `type`.
 *
 * Uso:  node scripts/check-rsc-boundary.mjs [dir...]   (default: app lib)
 * Exit: 0 = sin violaciones · 1 = al menos una (las lista con file:line).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = process.cwd();
const C = { red: "\x1b[31m", green: "\x1b[32m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };

const SCAN_DIRS = process.argv.slice(2).length ? process.argv.slice(2) : ["app", "lib"];
const EXTS = [".ts", ".tsx", ".jsx", ".js"];

/** ¿El módulo declara la directiva `"use client"` al tope (saltando comentarios)? */
function isClientModule(src) {
  let s = src.replace(/^﻿/, "");
  let prev;
  do {
    prev = s;
    s = s.replace(/^\s+/, "");
    s = s.replace(/^\/\/[^\n]*\n?/, "");
    s = s.replace(/^\/\*[\s\S]*?\*\//, "");
  } while (s !== prev);
  return /^['"]use client['"]\s*;?/.test(s);
}

/** ¿El nombre del binding parece un componente React (PascalCase con minúscula)? */
function looksLikeComponent(name) {
  // Empieza en mayúscula seguida de minúscula: DebugTabs, NorteTab. Excluye ALL_CAPS.
  return /^[A-Z][a-z][A-Za-z0-9]*$/.test(name);
}

/** Resuelve un import spec local (`@/...` o relativo) a un archivo real, o null. */
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // bare (node_modules) → no aplica
  for (const e of EXTS) {
    if (existsSync(base + e)) return base + e;
  }
  for (const e of EXTS) {
    const idx = join(base, "index" + e);
    if (existsSync(idx)) return idx;
  }
  return null;
}

// cache de "¿es client?" por archivo resuelto
const clientCache = new Map();
function fileIsClient(file) {
  if (clientCache.has(file)) return clientCache.get(file);
  let v = false;
  try {
    v = isClientModule(readFileSync(file, "utf8"));
  } catch {
    v = false;
  }
  clientCache.set(file, v);
  return v;
}

/** Walk recursivo de un dir devolviendo archivos .ts/.tsx/.js/.jsx. */
function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "__tests__") continue;
      walk(p, out);
    } else if (EXTS.some((e) => ent.name.endsWith(e))) {
      // saltar tests y type-decls
      if (/\.(test|spec)\.[tj]sx?$/.test(ent.name) || ent.name.endsWith(".d.ts")) continue;
      out.push(p);
    }
  }
}

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;

/** Parsea la cláusula de un import y devuelve los nombres de bindings-VALOR. */
function valueBindings(clause) {
  const names = [];
  // default import (identificador antes de `{` o `,`)
  const braceIdx = clause.indexOf("{");
  const head = (braceIdx === -1 ? clause : clause.slice(0, braceIdx)).trim();
  const defMatch = head.match(/^([A-Za-z0-9_$]+)/);
  if (defMatch && !head.startsWith("*")) names.push(defMatch[1]);
  // named imports { a, b as c, type D }
  if (braceIdx !== -1) {
    const end = clause.indexOf("}", braceIdx);
    const inner = clause.slice(braceIdx + 1, end === -1 ? undefined : end);
    for (let spec of inner.split(",")) {
      spec = spec.trim();
      if (!spec || spec.startsWith("type ")) continue; // inline type → se borra
      // `orig as local` → clasificamos por el nombre original (refleja qué ES el export)
      const orig = spec.split(/\s+as\s+/)[0].trim();
      if (orig) names.push(orig);
    }
  }
  return names;
}

const files = [];
for (const d of SCAN_DIRS) walk(resolve(ROOT, d), files);

const violations = [];
for (const file of files) {
  if (fileIsClient(file)) continue; // un módulo client puede importar helpers client sin problema
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!src.includes("import")) continue;
  for (const m of src.matchAll(IMPORT_RE)) {
    const isTypeOnly = !!m[1];
    if (isTypeOnly) continue;
    const clause = m[2];
    const spec = m[3];
    const target = resolveLocal(spec, file);
    if (!target || !fileIsClient(target)) continue;
    for (const name of valueBindings(clause)) {
      if (looksLikeComponent(name)) continue; // componente → OK (JSX)
      const line = src.slice(0, m.index).split("\n").length;
      violations.push({ file, line, name, spec });
    }
  }
}

console.log(`${C.dim}── rsc-boundary ── escaneados ${files.length} módulos en ${SCAN_DIRS.join(", ")} ──${C.nc}`);
if (violations.length === 0) {
  console.log(`${C.green}[OK]${C.nc}   sin cruces server→client de valores`);
  process.exit(0);
}
for (const v of violations) {
  const rel = relative(ROOT, v.file).replace(/\\/g, "/");
  console.log(
    `${C.red}[FAIL]${C.nc} ${rel}:${v.line} — importa el valor ${C.yellow}${v.name}${C.nc} de '${v.spec}' (módulo "use client")`,
  );
}
console.log(
  `\n${C.red}[FAIL]${C.nc} ${violations.length} cruce(s) server→client. ` +
    `Mové el helper/constante a un módulo server-safe (sin "use client") e importalo de ahí, ` +
    `o importalo como \`type\` si sólo es un tipo.`,
);
process.exit(1);
