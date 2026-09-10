#!/usr/bin/env node
/**
 * scripts/check-rsc-boundary.mjs — detector de cruces de frontera server/client (RSC).
 *
 * Caza dos clases de bug que el resto del gate NO ve (typecheck + vitest dan verde):
 * un **server component / módulo server** que importa y usa un **valor** (helper,
 * constante) exportado por un módulo `"use client"`. En runtime Next.js lo convierte
 * en una *referencia de cliente* y explota con 500
 * ("Attempted to call a client function from the server").
 *
 * Y el cruce inverso: un módulo `"use client"` que alcanza transitivamente un
 * import `node:*`. Turbopack puede tolerar el esquema y ocultar la fuga, mientras
 * webpack falla con `UnhandledSchemeError`. El gate recorre imports locales de
 * runtime y muestra la traza completa; un archivo `"use server"` corta el recorrido
 * porque Next lo convierte en una frontera de Server Actions legítima.
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
 *   - Para client→node: sigue imports, imports dinámicos y reexports locales de
 *     runtime; ignora imports de tipo y no atraviesa módulos `"use server"`.
 *
 * Falsos positivos posibles: una constante/clase no-componente que de verdad sea
 * segura cruzar (raro — Next igual la proxquea). Si aparece uno legítimo, mueve el
 * valor a un módulo server-safe (el patrón correcto) o impórtalo como `type`.
 *
 * Uso:  node scripts/check-rsc-boundary.mjs [dir...]   (default: app lib)
 * Exit: 0 = sin violaciones · 1 = al menos una (las lista con file:line).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = process.cwd();
const C = { red: "\x1b[31m", green: "\x1b[32m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };

const SCAN_DIRS = process.argv.slice(2).length ? process.argv.slice(2) : ["app", "lib"];
const EXTS = [".ts", ".tsx", ".mts", ".cts", ".jsx", ".js", ".mjs", ".cjs"];

/** ¿El módulo declara una directiva al tope (saltando comentarios)? */
function hasDirective(src, directive) {
  let s = src.replace(/^﻿/, "");
  let prev;
  do {
    prev = s;
    s = s.replace(/^\s+/, "");
    s = s.replace(/^\/\/[^\n]*\n?/, "");
    s = s.replace(/^\/\*[\s\S]*?\*\//, "");
  } while (s !== prev);
  return new RegExp(`^['"]${directive}['"]\\s*;?`).test(s);
}

function isClientModule(src) {
  return hasDirective(src, "use client");
}

function isServerModule(src) {
  return hasDirective(src, "use server");
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
  if (EXTS.some((e) => base.endsWith(e)) && existsSync(base)) return base;
  for (const e of EXTS) {
    if (existsSync(base + e)) return base + e;
  }
  for (const e of EXTS) {
    const idx = join(base, "index" + e);
    if (existsSync(idx)) return idx;
  }
  return null;
}

const sourceCache = new Map();
function fileSource(file) {
  if (sourceCache.has(file)) return sourceCache.get(file);
  let src = null;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    src = null;
  }
  sourceCache.set(file, src);
  return src;
}

const clientCache = new Map();
function fileIsClient(file) {
  if (!clientCache.has(file)) {
    clientCache.set(file, isClientModule(fileSource(file) ?? ""));
  }
  return clientCache.get(file);
}

const serverCache = new Map();
function fileIsServer(file) {
  if (!serverCache.has(file)) {
    serverCache.set(file, isServerModule(fileSource(file) ?? ""));
  }
  return serverCache.get(file);
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
const SIDE_EFFECT_IMPORT_RE = /\bimport\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_FROM_RE = /\bexport\s+(type\s+)?(?:\*\s*(?:as\s+[A-Za-z0-9_$]+\s*)?|\{([\s\S]*?)\})\s+from\s*['"]([^'"]+)['"]/g;

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

/** ¿Una cláusula named/default/namespace sobrevive al borrado de tipos? */
function clauseHasRuntimeValue(clause) {
  const braceIdx = clause.indexOf("{");
  const head = (braceIdx === -1 ? clause : clause.slice(0, braceIdx)).trim();
  if (head && (head.startsWith("*") || /^[A-Za-z0-9_$]+/.test(head))) return true;
  if (braceIdx === -1) return false;
  const end = clause.indexOf("}", braceIdx);
  const inner = clause.slice(braceIdx + 1, end === -1 ? undefined : end);
  const specs = inner.split(",").map((part) => part.trim()).filter(Boolean);
  if (specs.length === 0) return true; // `import {} from` todavía evalúa el módulo
  return specs.some((spec) => !spec.startsWith("type "));
}

function lineAt(src, index) {
  return src.slice(0, index).split("\n").length;
}

/** Imports/reexports que sobreviven a TypeScript y forman el grafo de runtime. */
const runtimeImportCache = new Map();
function runtimeImports(file) {
  if (runtimeImportCache.has(file)) return runtimeImportCache.get(file);
  const src = fileSource(file) ?? "";
  const imports = [];
  const seen = new Set();
  const add = (spec, index) => {
    const key = `${index}:${spec}`;
    if (seen.has(key)) return;
    seen.add(key);
    imports.push({ spec, line: lineAt(src, index) });
  };

  for (const m of src.matchAll(IMPORT_RE)) {
    if (m[1] || !clauseHasRuntimeValue(m[2])) continue;
    add(m[3], m.index);
  }
  for (const m of src.matchAll(SIDE_EFFECT_IMPORT_RE)) add(m[1], m.index);
  for (const m of src.matchAll(DYNAMIC_IMPORT_RE)) add(m[1], m.index);
  for (const m of src.matchAll(EXPORT_FROM_RE)) {
    if (m[1]) continue;
    if (m[2] !== undefined) {
      const specs = m[2].split(",").map((part) => part.trim()).filter(Boolean);
      if (specs.length > 0 && specs.every((spec) => spec.startsWith("type "))) continue;
    }
    add(m[3], m.index);
  }

  runtimeImportCache.set(file, imports);
  return imports;
}

const files = [];
for (const d of SCAN_DIRS) walk(resolve(ROOT, d), files);

const violations = [];
for (const file of files) {
  if (fileIsClient(file)) continue; // un módulo client puede importar helpers client sin problema
  const src = fileSource(file);
  if (src == null) continue;
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
      const line = lineAt(src, m.index);
      violations.push({ file, line, name, spec });
    }
  }
}

/** Traza todo módulo node:* alcanzable desde cada raíz `use client`. */
const nodeLeaks = [];
for (const root of files.filter(fileIsClient)) {
  const visited = new Set([root]);
  const pending = [{ file: root, trace: [root] }];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const imported of runtimeImports(current.file)) {
      if (imported.spec.startsWith("node:")) {
        nodeLeaks.push({
          root,
          source: current.file,
          line: imported.line,
          spec: imported.spec,
          trace: [...current.trace, imported.spec],
        });
        continue;
      }
      const target = resolveLocal(imported.spec, current.file);
      if (!target || visited.has(target)) continue;
      // Una acción de archivo es una referencia remota soportada, no código cliente.
      if (fileIsServer(target)) continue;
      visited.add(target);
      pending.push({ file: target, trace: [...current.trace, target] });
    }
  }
}

console.log(`${C.dim}── rsc-boundary ── escaneados ${files.length} módulos en ${SCAN_DIRS.join(", ")} ──${C.nc}`);
if (violations.length === 0 && nodeLeaks.length === 0) {
  console.log(`${C.green}[OK]${C.nc}   sin cruces server→client de valores ni client→node: transitivos`);
  process.exit(0);
}
for (const v of violations) {
  const rel = relative(ROOT, v.file).replace(/\\/g, "/");
  console.log(
    `${C.red}[FAIL]${C.nc} ${rel}:${v.line} — importa el valor ${C.yellow}${v.name}${C.nc} de '${v.spec}' (módulo "use client")`,
  );
}
for (const leak of nodeLeaks) {
  const source = relative(ROOT, leak.source).replace(/\\/g, "/");
  const trace = leak.trace
    .map((part) => part.startsWith("node:") ? part : relative(ROOT, part).replace(/\\/g, "/"))
    .join(" -> ");
  console.log(
    `${C.red}[FAIL]${C.nc} ${source}:${leak.line} — ${C.yellow}${leak.spec}${C.nc} alcanzable desde un módulo "use client"`,
  );
  console.log(`       traza: ${trace}`);
}
if (violations.length > 0) {
  console.log(
    `\n${C.red}[FAIL]${C.nc} ${violations.length} cruce(s) server→client. ` +
      `Mueve el helper/constante a un módulo server-safe (sin "use client") e impórtalo de ahí, ` +
      `o impórtalo como \`type\` si sólo es un tipo.`,
  );
}
if (nodeLeaks.length > 0) {
  console.log(
    `\n${C.red}[FAIL]${C.nc} ${nodeLeaks.length} fuga(s) desde cliente hacia node:*. ` +
      `Mueve el valor compartido a un módulo puro o coloca la lógica de servidor detrás de una frontera "use server".`,
  );
}
process.exit(1);
