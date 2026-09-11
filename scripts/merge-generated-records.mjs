#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const INDEX_PATH = "docs/specs/README.md";
const BASELINE_PATH = "supabase/migrations-baseline.json";
const DECLARATIONS_PATH = "supabase/pending-migration-symbol-declarations.json";
const DECLARATIONS_SCHEMA_VERSION = 1;
const INDEX_START = "<!-- AUTO-INDEX:START (generado por scripts/build-docs-index.mjs · no editar a mano) -->";
const INDEX_END = "<!-- AUTO-INDEX:END -->";
const MISSING = Symbol("missing");

function normalizeRepoPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepEqual(left, right) {
  if (left === MISSING || right === MISSING) return left === right;
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (!isObject(left) || !isObject(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]),
    )
  );
}

function mergeValue(base, current, other, label) {
  if (deepEqual(current, other)) return current;
  if (deepEqual(current, base)) return other;
  if (deepEqual(other, base)) return current;
  throw new Error(`conflicto real en ${label}: ambos lados cambiaron el mismo valor`);
}

// La base conserva su orden; lo agregado se ordena para que el resultado no
// dependa del sentido del merge.
function orderedUnion(baseKeys, currentKeys, otherKeys) {
  const known = new Set(baseKeys);
  const added = [...new Set([...currentKeys, ...otherKeys])]
    .filter((key) => !known.has(key))
    .sort();
  return [...baseKeys, ...added];
}

function orderedUnionKeys(base, current, other) {
  return orderedUnion(Object.keys(base), Object.keys(current), Object.keys(other));
}

function mergeObjectByKey(base, current, other, label) {
  if (![base, current, other].every(isObject)) {
    throw new Error(`${label} debe ser un objeto JSON en las tres versiones`);
  }
  const result = Object.create(null);
  for (const key of incomingFirstKeys(current, other)) {
    const baseValue = Object.hasOwn(base, key) ? base[key] : MISSING;
    const currentValue = Object.hasOwn(current, key) ? current[key] : MISSING;
    const otherValue = Object.hasOwn(other, key) ? other[key] : MISSING;

    // Three-way por clave, retiros incluidos. Quitar una espera es el acto que
    // registra la aplicación de su migración: si un lado la quita y el otro la
    // conserva igual a la base, gana el retiro. Resucitarla reabriría la espera
    // de algo ya aplicado. Borrar contra editar es ambiguo y se resuelve a mano.
    if (baseValue !== MISSING && (currentValue === MISSING) !== (otherValue === MISSING)) {
      const kept = currentValue === MISSING ? otherValue : currentValue;
      if (!deepEqual(kept, baseValue)) {
        throw new Error(`conflicto real en ${label}.${key}: borrado contra edición`);
      }
    }

    const merged = mergeValue(baseValue, currentValue, otherValue, `${label}.${key}`);
    if (merged !== MISSING) result[key] = merged;
  }
  return result;
}

// Orden del baseline: primero las claves del lado entrante (%B), en su orden, y
// al final las que solo trae el lado actual (%A), en el orden en que las
// escribió. En `git merge origin/main` desde una rama, %B es main: el resultado
// es el texto de main más lo que agrega la rama, sin reordenar lo de main.
function incomingFirstKeys(current, other) {
  return [...new Set([...Object.keys(other), ...Object.keys(current)])];
}

// JSON.parse acepta claves duplicadas y conserva silenciosamente la última.
// Este parser mínimo implementa JSON completo para poder rechazarlas antes de
// que una entrada del baseline desaparezca por sobrescritura.
function parseJsonWithoutDuplicateKeys(text, label) {
  let index = 0;

  function fail(message) {
    throw new Error(`${label}: ${message} (posición ${index})`);
  }

  function whitespace() {
    while (/[\t\n\r ]/u.test(text[index] ?? "")) index += 1;
  }

  function string() {
    const start = index;
    if (text[index] !== '"') fail("se esperaba string JSON");
    index += 1;
    let escaped = false;
    while (index < text.length) {
      const char = text[index];
      index += 1;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        try {
          return JSON.parse(text.slice(start, index));
        } catch (error) {
          fail(`string JSON inválido: ${error.message}`);
        }
      }
    }
    fail("string JSON sin cierre");
  }

  function array() {
    const result = [];
    index += 1;
    whitespace();
    if (text[index] === "]") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      result.push(value());
      whitespace();
      if (text[index] === "]") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail("se esperaba ',' o ']' en array");
      index += 1;
      whitespace();
    }
    fail("array JSON sin cierre");
  }

  function object() {
    const result = Object.create(null);
    const keys = new Set();
    index += 1;
    whitespace();
    if (text[index] === "}") {
      index += 1;
      return result;
    }
    while (index < text.length) {
      const key = string();
      if (keys.has(key)) fail(`clave duplicada '${key}'`);
      keys.add(key);
      whitespace();
      if (text[index] !== ":") fail("se esperaba ':' después de una clave");
      index += 1;
      result[key] = value();
      whitespace();
      if (text[index] === "}") {
        index += 1;
        return result;
      }
      if (text[index] !== ",") fail("se esperaba ',' o '}' en objeto");
      index += 1;
      whitespace();
    }
    fail("objeto JSON sin cierre");
  }

  function value() {
    whitespace();
    const char = text[index];
    if (char === '"') return string();
    if (char === "{") return object();
    if (char === "[") return array();
    for (const [token, parsed] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ]) {
      if (text.startsWith(token, index)) {
        index += token.length;
        return parsed;
      }
    }
    const number = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      index += number.length;
      const parsed = Number(number);
      if (!Number.isFinite(parsed)) fail("número JSON fuera de rango");
      return parsed;
    }
    fail("valor JSON inválido");
  }

  const parsed = value();
  whitespace();
  if (index !== text.length) fail("contenido extra después del JSON");
  return parsed;
}

function validateBaseline(value, label) {
  if (!isObject(value)) throw new Error(`${label}: la raíz debe ser un objeto`);
  if (!Number.isInteger(value.cutoff)) throw new Error(`${label}: cutoff debe ser entero`);
  if (!isObject(value.pendingBelowCutoff)) {
    throw new Error(`${label}: pendingBelowCutoff debe ser un objeto`);
  }
  for (const [key, reason] of Object.entries(value.pendingBelowCutoff)) {
    if (typeof reason !== "string" || reason.trim() === "") {
      throw new Error(`${label}: pendingBelowCutoff.${key} debe tener un motivo no vacío`);
    }
  }
}

function mergeBaseline(baseText, currentText, otherText) {
  const base = parseJsonWithoutDuplicateKeys(baseText, "baseline base");
  const current = parseJsonWithoutDuplicateKeys(currentText, "baseline actual");
  const other = parseJsonWithoutDuplicateKeys(otherText, "baseline entrante");
  validateBaseline(base, "baseline base");
  validateBaseline(current, "baseline actual");
  validateBaseline(other, "baseline entrante");

  const result = Object.create(null);
  for (const key of incomingFirstKeys(current, other)) {
    if (key === "pendingBelowCutoff") {
      result[key] = mergeObjectByKey(
        base.pendingBelowCutoff,
        current.pendingBelowCutoff,
        other.pendingBelowCutoff,
        "pendingBelowCutoff",
      );
      continue;
    }
    const merged = mergeValue(
      Object.hasOwn(base, key) ? base[key] : MISSING,
      Object.hasOwn(current, key) ? current[key] : MISSING,
      Object.hasOwn(other, key) ? other[key] : MISSING,
      `baseline.${key}`,
    );
    if (merged !== MISSING) result[key] = merged;
  }
  validateBaseline(result, "baseline fusionado");
  return `${JSON.stringify(result, null, 2)}\n`;
}

// El driver solo valida lo que necesita para unir por id. Símbolos, sitios y
// evidencia siguen a cargo de scripts/check-pending-migration-symbols.mjs.
function validateDeclarations(value, label) {
  if (!isObject(value)) throw new Error(`${label}: la raíz debe ser un objeto`);
  if (value.schemaVersion !== DECLARATIONS_SCHEMA_VERSION) {
    throw new Error(
      `${label}: schemaVersion ${JSON.stringify(value.schemaVersion)} no soportado; ` +
        `este driver fusiona la versión ${DECLARATIONS_SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(value.degradations)) {
    throw new Error(`${label}: degradations debe ser un array`);
  }
  const ids = new Set();
  for (const [index, entry] of value.degradations.entries()) {
    if (!isObject(entry) || typeof entry.id !== "string" || entry.id.trim() === "") {
      throw new Error(`${label}: degradations[${index}] requiere un id string no vacío`);
    }
    if (ids.has(entry.id)) throw new Error(`${label}: id duplicado '${entry.id}'`);
    ids.add(entry.id);
  }
}

// El encabezado (schemaVersion, $doc y cualquier clave fuera de degradations)
// define el contrato de todas las entradas. Si difiere entre ramas, aunque solo
// una lo haya cambiado, ninguna unión por entrada lo reconcilia.
function assertSameDeclarationsHeader(current, other) {
  const keys = new Set([...Object.keys(current), ...Object.keys(other)]);
  keys.delete("degradations");
  for (const key of keys) {
    const currentValue = Object.hasOwn(current, key) ? current[key] : MISSING;
    const otherValue = Object.hasOwn(other, key) ? other[key] : MISSING;
    if (!deepEqual(currentValue, otherValue)) {
      throw new Error(
        `conflicto real en declaraciones.${key}: difiere entre las ramas; ` +
          "el encabezado del contrato no se fusiona automáticamente",
      );
    }
  }
}

// Three-way por id. A diferencia de pendingBelowCutoff, una eliminación
// unilateral sí gana si la otra rama conserva la entrada igual a la base:
// retirar la declaración es el cierre esperado al aplicar su migración, y
// resucitarla dejaría una excepción vencida que el gate rechaza.
function mergeDeclarationEntry(base, current, other, id) {
  if (deepEqual(current, other)) return current;
  if (deepEqual(current, base)) return other;
  if (deepEqual(other, base)) return current;
  const label = `degradations[id=${id}]`;
  if (current === MISSING || other === MISSING) {
    throw new Error(`conflicto real en ${label}: borrado contra edición`);
  }
  if (base === MISSING) {
    throw new Error(
      `conflicto real en ${label}: ambas ramas agregan el mismo id con contenido distinto`,
    );
  }
  throw new Error(`conflicto real en ${label}: ambas ramas editaron la declaración de forma distinta`);
}

function mergeDeclarations(baseText, currentText, otherText) {
  const base = parseJsonWithoutDuplicateKeys(baseText, "declaraciones base");
  const current = parseJsonWithoutDuplicateKeys(currentText, "declaraciones actual");
  const other = parseJsonWithoutDuplicateKeys(otherText, "declaraciones entrante");
  validateDeclarations(base, "declaraciones base");
  validateDeclarations(current, "declaraciones actual");
  validateDeclarations(other, "declaraciones entrante");
  assertSameDeclarationsHeader(current, other);

  const byId = (entries) => new Map(entries.map((entry) => [entry.id, entry]));
  const baseById = byId(base.degradations);
  const currentById = byId(current.degradations);
  const otherById = byId(other.degradations);
  const pick = (entries, id) => (entries.has(id) ? entries.get(id) : MISSING);
  const degradations = [];
  for (const id of orderedUnion(
    [...baseById.keys()],
    [...currentById.keys()],
    [...otherById.keys()],
  )) {
    const merged = mergeDeclarationEntry(
      pick(baseById, id),
      pick(currentById, id),
      pick(otherById, id),
      id,
    );
    if (merged !== MISSING) degradations.push(merged);
  }

  const result = Object.create(null);
  for (const key of Object.keys(current)) {
    result[key] = key === "degradations" ? degradations : current[key];
  }
  validateDeclarations(result, "declaraciones fusionadas");
  return `${JSON.stringify(result, null, 2)}\n`;
}

function renderIndex(rows) {
  const sorted = [...rows.values()].sort((left, right) => left.num.localeCompare(right.num));
  let table = `### Índice de specs (generado · ${sorted.length} specs)\n\n`;
  table += "| # | Spec | Estado | Conf. |\n|---|---|---|---|\n";
  for (const row of sorted) table += `${row.line}\n`;

  const numbers = new Set(sorted.map((row) => Number.parseInt(row.num, 10)));
  const max = numbers.size ? Math.max(...numbers) : 0;
  const gaps = [];
  for (let number = 1; number <= max; number += 1) {
    if (!numbers.has(number)) gaps.push(String(number).padStart(4, "0"));
  }
  if (gaps.length > 0) {
    table += `\n> **Huecos en el correlativo:** ${gaps.join(", ")} — código sin spec o renumerado, auditar caso por caso.\n`;
  }
  return `${INDEX_START}\n${table}${INDEX_END}`;
}

function parseIndex(text, label) {
  const start = text.indexOf(INDEX_START);
  const end = text.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${label}: faltan marcadores AUTO-INDEX válidos`);
  }
  if (text.indexOf(INDEX_START, start + 1) !== -1 || text.indexOf(INDEX_END, end + 1) !== -1) {
    throw new Error(`${label}: marcadores AUTO-INDEX duplicados`);
  }

  const rows = new Map();
  const block = text.slice(start, end + INDEX_END.length);
  for (const line of block.split(/\r?\n/u)) {
    const match = line.match(/^\| (\d{4}) \| (.*) \| ([^|]+) \| ([^|]+) \|$/u);
    if (!match) continue;
    const num = match[1];
    if (rows.has(num)) throw new Error(`${label}: fila duplicada para SDD-${num}`);
    rows.set(num, { num, line });
  }
  if (block !== renderIndex(rows)) {
    throw new Error(`${label}: bloque generado no es canónico; ejecuta 'pnpm docs:index'`);
  }
  return {
    prefix: text.slice(0, start),
    suffix: text.slice(end + INDEX_END.length),
    rows,
  };
}

function mergeIndex(baseText, currentText, otherText) {
  const base = parseIndex(baseText, "índice base");
  const current = parseIndex(currentText, "índice actual");
  const other = parseIndex(otherText, "índice entrante");
  const rows = new Map();
  const baseRows = Object.fromEntries(base.rows);
  const currentRows = Object.fromEntries(current.rows);
  const otherRows = Object.fromEntries(other.rows);
  for (const key of orderedUnionKeys(baseRows, currentRows, otherRows)) {
    const merged = mergeValue(
      base.rows.has(key) ? base.rows.get(key) : MISSING,
      current.rows.has(key) ? current.rows.get(key) : MISSING,
      other.rows.has(key) ? other.rows.get(key) : MISSING,
      `índice SDD-${key}`,
    );
    if (merged !== MISSING) rows.set(key, merged);
  }

  const prefix = mergeValue(base.prefix, current.prefix, other.prefix, "preámbulo del índice");
  const suffix = mergeValue(base.suffix, current.suffix, other.suffix, "sufijo del índice");
  return `${prefix}${renderIndex(rows)}${suffix}`;
}

function main() {
  const [baseFile, currentFile, otherFile, rawRepoPath] = process.argv.slice(2);
  if (!baseFile || !currentFile || !otherFile || !rawRepoPath) {
    throw new Error("uso: merge-generated-records.mjs <base> <actual> <entrante> <ruta-repo>");
  }
  const repoPath = normalizeRepoPath(rawRepoPath);
  const base = readFileSync(baseFile, "utf8");
  const current = readFileSync(currentFile, "utf8");
  const other = readFileSync(otherFile, "utf8");

  let merged;
  if (repoPath === BASELINE_PATH) {
    merged = mergeBaseline(base, current, other);
  } else if (repoPath === INDEX_PATH) {
    merged = mergeIndex(base, current, other);
  } else if (repoPath === DECLARATIONS_PATH) {
    merged = mergeDeclarations(base, current, other);
  } else {
    throw new Error(`ruta no autorizada para este driver: ${repoPath}`);
  }

  // Solo se toca %A después de validar y construir el resultado completo.
  writeFileSync(currentFile, merged, "utf8");
  console.error(`✓ merge semántico: ${repoPath}`);
}

try {
  main();
} catch (error) {
  console.error(`✖ merge semántico rechazado: ${error.message}`);
  process.exitCode = 1;
}
