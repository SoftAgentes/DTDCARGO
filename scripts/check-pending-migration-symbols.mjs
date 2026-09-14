/**
 * Detecta código alcanzable desde rutas Next que depende de símbolos de base de
 * datos nacidos únicamente en migraciones declaradas como pendientes.
 *
 * Es un gate repo contra repo: no usa credenciales, red ni heurísticas de
 * try/catch. Una dependencia ausente solo asciende de ROJO a AMARILLO mediante
 * una declaración explícita cuyos sitios y evidencia se validan contra el árbol.
 *
 * Una columna pendiente se asocia a su relación (SDD-0464, ADR-0003): una
 * mención del nombre de la columna en un módulo alcanzable cuenta como sitio
 * salvo que ese módulo, o un vecino directo suyo en el grafo de imports, nombre
 * otra relación que sí tiene una columna con ese nombre según el DDL de las
 * migraciones y ninguno nombre la relación pendiente (ni una función que la
 * devuelva). Sin esa evidencia positiva la referencia se exige: el gate falla
 * cerrado. Funciones, tablas y vistas siguen asociándose por nombre.
 *
 * Uso: node scripts/check-pending-migration-symbols.mjs
 * Exit: 0 = sin rojos (puede haber amarillos declarados) · 1 = rojo · 2 = error del contrato/check
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  nc: "\x1b[0m",
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const NEXT_APP_ENTRYPOINTS = new Set([
  "page",
  "layout",
  "route",
  "default",
  "loading",
  "error",
  "not-found",
  "template",
  "global-error",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "sitemap",
  "robots",
  "manifest",
]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".next-verify",
  ".playwright-mcp",
  ".turbo",
  ".vitest-cache",
  "build",
  "coverage",
  "graphify-out",
  "node_modules",
  "out",
  "outputs",
  "playwright-report",
  "test-results",
]);

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = String.raw`(?:(?<schema>${IDENTIFIER})\s*\.\s*)?(?<name>${IDENTIFIER})`;
/**
 * Un nombre extraído debe estar completo: no lo siguen más caracteres de
 * identificador, un punto (cualificado a medias), un marcador de format()
 * (`%I`, `%s`) ni el fin del fragmento (un literal concatenado con `||` puede
 * cortarlo). Sin esto, plantillas EXECUTE como `create table public.%I` o
 * `create table if not exists %I` darían símbolos falsos (`public`, `if`).
 */
const NAME_END = String.raw`(?![A-Za-z0-9_$"%]|\s*\.|$)`;
const IF_NOT_EXISTS = String.raw`(?:if\s+not\s+exists\s+)?(?!if\s+not\s+exists\b)`;

export function normalizeRepoPath(value) {
  return path.posix.normalize(String(value).replaceAll("\\", "/")).replace(/^\.\//, "");
}

function normalizeIdentifier(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('""', '"');
  }
  return value.toLowerCase();
}

function relationQualifiedName(schema, name) {
  return `${schema}.${name}`;
}

function symbolKey(symbol) {
  if (symbol.kind === "column") {
    return `column:${symbol.schema}.${symbol.relation}.${symbol.name}`;
  }
  return `${symbol.kind}:${symbol.schema}.${symbol.name}`;
}

function symbolDisplayName(symbol) {
  if (symbol.kind === "column") {
    return symbol.schema === "public"
      ? `${symbol.relation}.${symbol.name}`
      : `${symbol.schema}.${symbol.relation}.${symbol.name}`;
  }
  return symbol.schema === "public" ? symbol.name : `${symbol.schema}.${symbol.name}`;
}

function addSymbol(target, symbol) {
  const complete = {
    ...symbol,
    key: symbolKey(symbol),
    displayName: symbolDisplayName(symbol),
    referenceName: symbol.name,
  };
  target.set(complete.key, complete);
}

/**
 * Divide el texto en unidades UTF-16: las mismas que indexan `text[i]`,
 * `startsWith(…, i)` e `indexOf`. No usar `[...text]`, que itera code points:
 * cada carácter astral (emoji fuera del BMP) desplazaría la máscara una
 * posición, movería líneas y ocultaría DDL, imports o sitios de llamada.
 */
function utf16Units(text) {
  return text.split("");
}

const DOLLAR_QUOTE_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y;

/**
 * Separa código de comentarios y literales SQL sin mover líneas ni offsets.
 * Devuelve la vista de código (comentarios y literales en blanco) y cada literal
 * con su posición y su texto ya sin comillas (`''` → `'` en los simples).
 */
function scanSql(sql) {
  const out = utf16Units(sql);
  const literals = [];
  const blank = (index) => {
    if (out[index] !== "\n" && out[index] !== "\r") out[index] = " ";
  };

  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      while (i < sql.length && sql[i] !== "\n") blank(i++);
      continue;
    }

    if (sql.startsWith("/*", i)) {
      let depth = 1;
      blank(i++);
      blank(i++);
      while (i < sql.length && depth > 0) {
        if (sql.startsWith("/*", i)) {
          depth += 1;
          blank(i++);
          blank(i++);
        } else if (sql.startsWith("*/", i)) {
          depth -= 1;
          blank(i++);
          blank(i++);
        } else {
          blank(i++);
        }
      }
      continue;
    }

    if (sql[i] === "'") {
      const start = i;
      blank(i++);
      let closed = false;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          blank(i++);
          blank(i++);
        } else if (sql[i] === "'") {
          blank(i++);
          closed = true;
          break;
        } else {
          blank(i++);
        }
      }
      literals.push({ start, text: sql.slice(start + 1, closed ? i - 1 : i).replaceAll("''", "'") });
      continue;
    }

    if (sql[i] === "$") {
      DOLLAR_QUOTE_TAG.lastIndex = i;
      const tag = DOLLAR_QUOTE_TAG.exec(sql)?.[0];
      if (tag) {
        const start = i;
        const end = sql.indexOf(tag, i + tag.length);
        const limit = end === -1 ? sql.length : end + tag.length;
        literals.push({ start, text: sql.slice(start + tag.length, end === -1 ? sql.length : end) });
        while (i < limit) blank(i++);
        continue;
      }
    }

    i += 1;
  }

  return { code: out.join(""), literals };
}

/** Enmascara comentarios y literales SQL sin mover líneas ni offsets. */
export function maskSqlNonCode(sql) {
  return scanSql(sql).code;
}

/**
 * Últimos `count` tokens de código antes de `index`, en minúsculas y separados
 * por un espacio. La vista de código ya dejó comentarios y literales en blanco.
 */
function tokensBefore(code, index, count) {
  const tokens = [];
  let i = index - 1;
  while (tokens.length < count) {
    while (i >= 0 && /\s/.test(code[i])) i -= 1;
    if (i < 0) break;
    const end = i + 1;
    if (/[A-Za-z0-9_$]/.test(code[i])) {
      while (i >= 0 && /[A-Za-z0-9_$]/.test(code[i])) i -= 1;
    } else {
      i -= 1;
    }
    tokens.unshift(code.slice(i + 1, end).toLowerCase());
  }
  return tokens.join(" ");
}

/** Literal que es el cuerpo de un `DO [LANGUAGE plpgsql]`. */
const DO_BODY_CONTEXT = /(?:^| )do(?: language plpgsql)?$/;
/**
 * Literal pasado directo a EXECUTE, solo o como plantilla de [pg_catalog.]format().
 * Un `execute` precedido por punto es una función de usuario (`public.execute(…)`),
 * no la sentencia de PL/pgSQL.
 */
const EXECUTE_TEMPLATE_CONTEXT = /(?:^|(?<!\.) )execute(?: \()?(?: (?:pg_catalog \. )?format \()?$/;
/** DO → EXECUTE → DO…: más niveles son inusuales y no se siguen. */
const MAX_EXECUTED_DEPTH = 4;

/**
 * Vistas de código SQL que corren al aplicar la migración. Además del texto
 * enmascarado, entra en el cuerpo de cada bloque DO (PL/pgSQL que se ejecuta en
 * ese momento) y, dentro de él, en cada literal pasado directamente a EXECUTE,
 * solo o como plantilla de format(). No entra en cuerpos de función ni en otros
 * literales: su DDL solo correría si alguien los invoca después.
 */
function executedSqlViews(sql, plpgsql = false, depth = 0) {
  const { code, literals } = scanSql(sql);
  const views = [code];
  if (depth >= MAX_EXECUTED_DEPTH) return views;
  for (const literal of literals) {
    // Siete tokens: la forma más larga (`execute ( pg_catalog . format (`) y el
    // anterior a `execute`, que decide si es una función `esquema.execute(…)`.
    const context = tokensBefore(code, literal.start, 7);
    if (DO_BODY_CONTEXT.test(context)) {
      views.push(...executedSqlViews(literal.text, true, depth + 1));
    } else if (plpgsql && EXECUTE_TEMPLATE_CONTEXT.test(context)) {
      views.push(...executedSqlViews(literal.text, false, depth + 1));
    }
  }
  return views;
}

const CREATED_OBJECTS = [
  ["function", new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+${QUALIFIED_IDENTIFIER}${NAME_END}`, "gi")],
  ["table", new RegExp(String.raw`\bcreate\s+table\s+${IF_NOT_EXISTS}${QUALIFIED_IDENTIFIER}${NAME_END}`, "gi")],
  ["view", new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?view\s+${QUALIFIED_IDENTIFIER}${NAME_END}`, "gi")],
];
const ALTER_TABLE = new RegExp(
  String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?!if\s+exists\b)(?:only\s+)?(?!only\b)`
    + String.raw`${QUALIFIED_IDENTIFIER}${NAME_END}(?<body>[\s\S]*?)(?:;|$)`,
  "gi",
);
const ADD_COLUMN = new RegExp(String.raw`\badd\s+column\s+${IF_NOT_EXISTS}(?<column>${IDENTIFIER})${NAME_END}`, "gi");
/**
 * Dentro del cuerpo de un `alter table` (que termina en `;`) el nombre de la
 * columna puede ser lo último: `drop column x;` o `rename a to b;`. Ahí no
 * aplica la guarda de fin de fragmento de NAME_END, pensada para literales de
 * EXECUTE cortados con `||`.
 */
const NAME_END_IN_BODY = String.raw`(?![A-Za-z0-9_$"%]|\s*\.)`;
const DROP_COLUMN = new RegExp(
  String.raw`\bdrop\s+column\s+(?:if\s+exists\s+)?(?!if\s+exists\b)(?<column>${IDENTIFIER})${NAME_END_IN_BODY}`,
  "gi",
);
const RENAME_COLUMN = new RegExp(
  String.raw`\brename\s+(?:column\s+)?(?!constraint\b|to\b)(?<from>${IDENTIFIER})${NAME_END}\s+to\s+(?<to>${IDENTIFIER})${NAME_END_IN_BODY}`,
  "gi",
);
/** `create table` seguido de su lista de columnas; el cuerpo se recorre aparte. */
const CREATE_TABLE_BODY = new RegExp(
  String.raw`\bcreate\s+table\s+${IF_NOT_EXISTS}${QUALIFIED_IDENTIFIER}${NAME_END}\s*\(`,
  "gi",
);
const CREATE_VIEW = new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?view\s+${QUALIFIED_IDENTIFIER}${NAME_END}`, "gi");
const DROP_TABLE = new RegExp(
  String.raw`\bdrop\s+table\s+(?:if\s+exists\s+)?(?!if\s+exists\b)${QUALIFIED_IDENTIFIER}${NAME_END}`,
  "gi",
);
const CREATE_FUNCTION_HEAD = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+${QUALIFIED_IDENTIFIER}${NAME_END}\s*\(`,
  "gi",
);
/** `returns [setof] relación`; `returns table(…)` define columnas propias y no nombra una relación. */
const FUNCTION_RETURNS = new RegExp(
  String.raw`^\s*returns\s+(?:setof\s+)?(?!table\s*\()${QUALIFIED_IDENTIFIER}${NAME_END}`,
  "i",
);
const ITEM_HEAD = new RegExp(String.raw`^\s*(?<name>${IDENTIFIER})`);
/** Elementos de un cuerpo `create table (…)` que no son definiciones de columna. */
const TABLE_CONSTRAINT_KEYWORDS = new Set(["constraint", "primary", "unique", "foreign", "check", "exclude", "like"]);

function symbolFromMatch(kind, groups, migration) {
  const schema = normalizeIdentifier(groups.schema ?? "public");
  const name = normalizeIdentifier(groups.name);
  return { kind, schema, name, migration };
}

/**
 * Extrae los tipos de DDL cubiertos por SDD-0450, incluido el DDL de bloques DO
 * (estático o como literal de EXECUTE). La función es pura: recibe texto SQL y
 * devuelve símbolos canónicos, sin leer disco.
 */
export function extractCreatedSymbols(sql, migration = "fixture") {
  const symbols = new Map();

  for (const code of executedSqlViews(sql)) {
    for (const [kind, regexp] of CREATED_OBJECTS) {
      for (const match of code.matchAll(regexp)) {
        addSymbol(symbols, symbolFromMatch(kind, match.groups, migration));
      }
    }

    for (const statement of code.matchAll(ALTER_TABLE)) {
      const schema = normalizeIdentifier(statement.groups.schema ?? "public");
      const relation = normalizeIdentifier(statement.groups.name);
      for (const column of statement.groups.body.matchAll(ADD_COLUMN)) {
        addSymbol(symbols, {
          kind: "column",
          schema,
          relation,
          name: normalizeIdentifier(column.groups.column),
          migration,
        });
      }
    }
  }

  return [...symbols.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Índice del paréntesis que cierra el abierto justo antes de `start`; -1 si no cierra. */
function closingParenthesis(code, start) {
  let depth = 1;
  for (let i = start; i < code.length; i += 1) {
    if (code[i] === "(") depth += 1;
    else if (code[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Divide por comas de primer nivel: `numeric(12,2)` o `references t(id)` no cortan. */
function splitTopLevel(body) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === "(") depth += 1;
    else if (body[i] === ")") depth -= 1;
    else if (body[i] === "," && depth === 0) {
      items.push(body.slice(start, i));
      start = i + 1;
    }
  }
  items.push(body.slice(start));
  return items;
}

/** Nombres de columna de un cuerpo `create table (…)`: el primer token de cada elemento que no es restricción. */
function columnsOfTableBody(body) {
  const columns = [];
  for (const item of splitTopLevel(body)) {
    const head = item.match(ITEM_HEAD);
    if (!head) continue;
    const raw = head.groups.name;
    if (!raw.startsWith('"') && TABLE_CONSTRAINT_KEYWORDS.has(raw.toLowerCase())) continue;
    columns.push(normalizeIdentifier(raw));
  }
  return columns;
}

/**
 * Aplica sobre `relations` (clave `esquema.relación` → Set de columnas) el DDL
 * ejecutado por una migración, en orden textual: cuerpos de `create table`,
 * `add column`, `drop column`, `rename column`, `drop table` y el registro de
 * vistas sin columnas. Es evidencia positiva: una columna que no se pudo leer
 * simplemente no consta, y el gate cae del lado estricto (SDD-0464).
 */
export function applyRelationColumns(sql, relations = new Map()) {
  const ensure = (schema, name) => {
    const key = relationQualifiedName(schema, name);
    if (!relations.has(key)) relations.set(key, new Set());
    return relations.get(key);
  };

  for (const code of executedSqlViews(sql)) {
    const events = [];
    for (const match of code.matchAll(CREATE_TABLE_BODY)) {
      const bodyStart = match.index + match[0].length;
      const bodyEnd = closingParenthesis(code, bodyStart);
      const body = bodyEnd === -1 ? "" : code.slice(bodyStart, bodyEnd);
      events.push({
        index: match.index,
        apply: () => {
          const columns = ensure(normalizeIdentifier(match.groups.schema ?? "public"), normalizeIdentifier(match.groups.name));
          for (const column of columnsOfTableBody(body)) columns.add(column);
        },
      });
    }
    for (const match of code.matchAll(CREATE_VIEW)) {
      events.push({
        index: match.index,
        apply: () => ensure(normalizeIdentifier(match.groups.schema ?? "public"), normalizeIdentifier(match.groups.name)),
      });
    }
    for (const match of code.matchAll(DROP_TABLE)) {
      events.push({
        index: match.index,
        apply: () => relations.delete(
          relationQualifiedName(normalizeIdentifier(match.groups.schema ?? "public"), normalizeIdentifier(match.groups.name)),
        ),
      });
    }
    for (const statement of code.matchAll(ALTER_TABLE)) {
      const schema = normalizeIdentifier(statement.groups.schema ?? "public");
      const relation = normalizeIdentifier(statement.groups.name);
      const body = statement.groups.body;
      events.push({
        index: statement.index,
        apply: () => {
          const columns = ensure(schema, relation);
          for (const column of body.matchAll(ADD_COLUMN)) columns.add(normalizeIdentifier(column.groups.column));
          for (const column of body.matchAll(DROP_COLUMN)) columns.delete(normalizeIdentifier(column.groups.column));
          for (const column of body.matchAll(RENAME_COLUMN)) {
            columns.delete(normalizeIdentifier(column.groups.from));
            columns.add(normalizeIdentifier(column.groups.to));
          }
        },
      });
    }
    events.sort((a, b) => a.index - b.index);
    for (const event of events) event.apply();
  }

  return relations;
}

/** Columnas por relación después de aplicar, en orden de nombre, todas las migraciones dadas. */
export function relationColumnsAfter(migrations) {
  const relations = new Map();
  for (const migration of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
    applyRelationColumns(migration.sql, relations);
  }
  return relations;
}

/**
 * Funciones que devuelven filas de una relación (`returns [setof] esquema.relación`),
 * como Map `esquema.función` → `esquema.relación`. Solo interesa lo que coincide
 * con una relación conocida; el consumidor filtra.
 */
export function extractFunctionRelations(sql, relations = new Map()) {
  for (const code of executedSqlViews(sql)) {
    for (const match of code.matchAll(CREATE_FUNCTION_HEAD)) {
      const argumentsStart = match.index + match[0].length;
      const argumentsEnd = closingParenthesis(code, argumentsStart);
      if (argumentsEnd === -1) continue;
      const returns = code.slice(argumentsEnd + 1).match(FUNCTION_RETURNS);
      if (!returns) continue;
      relations.set(
        relationQualifiedName(normalizeIdentifier(match.groups.schema ?? "public"), normalizeIdentifier(match.groups.name)),
        relationQualifiedName(normalizeIdentifier(returns.groups.schema ?? "public"), normalizeIdentifier(returns.groups.name)),
      );
    }
  }
  return relations;
}

/**
 * Un símbolo pendiente es ausencia solo si ninguna migración no eximida crea el
 * mismo símbolo. Así, CREATE OR REPLACE sobre una función aplicada es redefinición.
 */
export function findPendingOnlySymbols(migrations, pendingMigrationNames) {
  const pending = new Set(pendingMigrationNames);
  const appliedKeys = new Set();
  const pendingSymbols = new Map();

  for (const migration of migrations) {
    const symbols = extractCreatedSymbols(migration.sql, migration.name);
    if (!pending.has(migration.name)) {
      for (const symbol of symbols) appliedKeys.add(symbol.key);
      continue;
    }

    for (const symbol of symbols) {
      const existing = pendingSymbols.get(symbol.key);
      if (existing) {
        existing.migrations.push(migration.name);
      } else {
        pendingSymbols.set(symbol.key, { ...symbol, migrations: [migration.name] });
      }
    }
  }

  return [...pendingSymbols.values()]
    .filter((symbol) => !appliedKeys.has(symbol.key))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Enmascara solo comentarios JS/TS, sin mover líneas ni offsets; conserva
 * strings para imports y símbolos DB.
 */
export function maskJavaScriptComments(source) {
  const out = utf16Units(source);
  let quote = null;

  for (let i = 0; i < source.length;) {
    if (quote) {
      if (source[i] === "\\") {
        i += 2;
      } else if (source[i] === quote) {
        quote = null;
        i += 1;
      } else {
        i += 1;
      }
      continue;
    }

    if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      quote = source[i];
      i += 1;
      continue;
    }

    if (source.startsWith("//", i)) {
      while (i < source.length && source[i] !== "\n") {
        out[i] = " ";
        i += 1;
      }
      continue;
    }

    if (source.startsWith("/*", i)) {
      out[i++] = " ";
      out[i++] = " ";
      while (i < source.length && !source.startsWith("*/", i)) {
        if (source[i] !== "\n" && source[i] !== "\r") out[i] = " ";
        i += 1;
      }
      if (i < source.length) {
        out[i++] = " ";
        out[i++] = " ";
      }
      continue;
    }

    i += 1;
  }

  return out.join("");
}

/** Import/export estático, import() literal y require() literal. */
export function extractImportSpecifiers(source) {
  const code = maskJavaScriptComments(source);
  const found = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^;"']*?\s+from\s*)?["']([^"'\r\n]+)["']/g,
    /\bimport\s*\(\s*["']([^"'\r\n]+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"'\r\n]+)["']\s*\)/g,
  ];
  for (const regexp of patterns) {
    for (const match of code.matchAll(regexp)) found.add(match[1]);
  }
  return [...found];
}

function asSourceMap(sourceFiles) {
  const entries = sourceFiles instanceof Map ? [...sourceFiles.entries()] : Object.entries(sourceFiles);
  return new Map(entries.map(([name, contents]) => [normalizeRepoPath(name), contents]));
}

export function resolveImportSpecifier(importer, specifier, availableModules) {
  const modules = availableModules instanceof Set ? availableModules : new Set(availableModules);
  let base;
  if (specifier.startsWith("@/")) {
    base = specifier.slice(2);
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.posix.join(path.posix.dirname(importer), specifier);
  } else {
    return null;
  }

  base = normalizeRepoPath(base.split(/[?#]/, 1)[0]);
  if (base.startsWith("../")) return null;

  const ext = path.posix.extname(base);
  const stems = SOURCE_EXTENSIONS.includes(ext) ? [base.slice(0, -ext.length)] : [base];
  const candidates = [base];
  for (const stem of stems) {
    for (const sourceExtension of SOURCE_EXTENSIONS) candidates.push(`${stem}${sourceExtension}`);
    for (const sourceExtension of SOURCE_EXTENSIONS) candidates.push(`${stem}/index${sourceExtension}`);
  }
  return candidates.find((candidate) => modules.has(candidate)) ?? null;
}

export function findAppEntrypoints(modulePaths) {
  return [...modulePaths].filter((file) => {
    if (!file.startsWith("app/")) return false;
    const basename = path.posix.basename(file);
    const extension = SOURCE_EXTENSIONS.find((candidate) => basename.endsWith(candidate));
    if (!extension) return false;
    return NEXT_APP_ENTRYPOINTS.has(basename.slice(0, -extension.length));
  });
}

/**
 * Cierre transitivo de imports desde archivos de entrada de app/, con sus
 * aristas: `imports` (módulo → lo que importa) e `importers` (módulo → quién lo
 * importa), ambas solo entre módulos alcanzables.
 */
export function findReachableGraph(sourceFiles, entrypoints) {
  const sources = asSourceMap(sourceFiles);
  const modules = new Set(sources.keys());
  const roots = entrypoints?.map(normalizeRepoPath) ?? findAppEntrypoints(modules);
  const reachable = new Set();
  const imports = new Map();
  const importers = new Map();
  const pending = [...roots].filter((file) => modules.has(file));

  while (pending.length > 0) {
    const current = pending.pop();
    if (reachable.has(current)) continue;
    reachable.add(current);
    const edges = new Set();
    for (const specifier of extractImportSpecifiers(sources.get(current))) {
      const resolved = resolveImportSpecifier(current, specifier, modules);
      if (!resolved) continue;
      edges.add(resolved);
      if (!importers.has(resolved)) importers.set(resolved, new Set());
      importers.get(resolved).add(current);
      if (!reachable.has(resolved)) pending.push(resolved);
    }
    imports.set(current, edges);
  }

  return { reachable, imports, importers };
}

/** Devuelve el cierre transitivo de imports desde archivos de entrada de app/. */
export function findReachableModules(sourceFiles, entrypoints) {
  return findReachableGraph(sourceFiles, entrypoints).reachable;
}

const IDENTIFIER_TOKENS = /[a-z_$][a-z0-9_$]*/g;

/** Tokens identificador de un módulo, en minúsculas y sin comentarios. */
export function identifierTokens(source) {
  return new Set(maskJavaScriptComments(source).toLowerCase().match(IDENTIFIER_TOKENS) ?? []);
}

function unqualifiedName(key) {
  return key.slice(key.indexOf(".") + 1);
}

/**
 * Asociación columna → relación (SDD-0464, ADR-0003). El ámbito de un módulo
 * son sus tokens y los de sus vecinos directos alcanzables (lo que importa y
 * quien lo importa). Una referencia al nombre de una columna pendiente:
 *
 * - cuenta si el ámbito nombra la relación pendiente o una función que la
 *   devuelve (`returns [setof] relación`);
 * - se descarta como homónima solo si, sin nombrar la relación pendiente, el
 *   ámbito nombra otra relación que tiene una columna con ese nombre según el
 *   DDL de las migraciones;
 * - cuenta en cualquier otro caso: sin evidencia de otra dueña, falla cerrado.
 */
export function createColumnAssociation({ migrations, sourceFiles, imports, importers }) {
  const sources = asSourceMap(sourceFiles);
  const relations = relationColumnsAfter(migrations);
  const functionRelations = new Map();
  for (const migration of migrations) extractFunctionRelations(migration.sql, functionRelations);

  const ownersByColumn = new Map();
  for (const [key, columns] of relations) {
    for (const column of columns) {
      if (!ownersByColumn.has(column)) ownersByColumn.set(column, []);
      ownersByColumn.get(column).push({ key, relation: unqualifiedName(key) });
    }
  }
  const aliasesByRelation = new Map();
  for (const [functionKey, relationKey] of functionRelations) {
    if (!relations.has(relationKey)) continue;
    if (!aliasesByRelation.has(relationKey)) aliasesByRelation.set(relationKey, []);
    aliasesByRelation.get(relationKey).push(unqualifiedName(functionKey));
  }

  const tokenCache = new Map();
  const tokensOf = (file) => {
    if (!tokenCache.has(file)) tokenCache.set(file, identifierTokens(sources.get(file) ?? ""));
    return tokenCache.get(file);
  };
  const scopeOf = (file) => [file, ...(imports.get(file) ?? []), ...(importers.get(file) ?? [])];
  const scopeHas = (file, token) => scopeOf(file).some((module) => tokensOf(module).has(token));

  return {
    relations,
    functionRelations,
    classify(symbol, file) {
      const relationKey = relationQualifiedName(symbol.schema, symbol.relation);
      const aliases = [symbol.relation, ...(aliasesByRelation.get(relationKey) ?? [])];
      if (aliases.some((token) => scopeHas(file, token))) return { counted: true, reason: "relación nombrada" };
      const evidence = (ownersByColumn.get(symbol.name) ?? []).find(
        (owner) => owner.key !== relationKey && scopeHas(file, owner.relation),
      );
      if (evidence) return { counted: false, reason: "homónima", relation: evidence.relation };
      return { counted: true, reason: "sin evidencia de otra relación" };
    },
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findSymbolReferences(sourceFiles, symbol) {
  const sources = asSourceMap(sourceFiles);
  const token = symbol.referenceName ?? symbol.name;
  const regexp = new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(token)}(?=$|[^A-Za-z0-9_$])`, "i");
  const references = [];

  for (const [file, source] of sources) {
    const lines = maskJavaScriptComments(source).split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (regexp.test(lines[index])) references.push({ file, line: index + 1, site: `${file}:${index + 1}` });
    }
  }

  return references;
}

function parseSite(site) {
  const match = String(site).match(/^(.*):(\d+)$/);
  return match ? { file: normalizeRepoPath(match[1]), line: Number(match[2]) } : null;
}

function sameStringSet(actual, declared) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(declared)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function findDeclaredSymbol(analyses, declaration) {
  return analyses.filter(({ symbol }) =>
    symbol.kind === declaration.kind
    && (symbol.displayName === declaration.name
      || relationQualifiedName(symbol.schema, symbol.name) === declaration.name),
  );
}

/** Valida que una excepción nombre símbolos, todos sus sitios y evidencia viva. */
export function validateDeclarations(declarations, analyses, sourceFiles, reachable) {
  const errors = [];
  const symbolToGroup = new Map();
  const groups = [];
  const sources = asSourceMap(sourceFiles);
  const ids = new Set();

  if (declarations?.schemaVersion !== 1 || !Array.isArray(declarations?.degradations)) {
    return {
      errors: ["el archivo de declaraciones requiere schemaVersion=1 y degradations[]"],
      symbolToGroup,
      groups,
    };
  }

  for (const group of declarations.degradations) {
    const groupErrors = [];
    const resolvedSymbols = [];
    if (!group?.id || ids.has(group.id)) groupErrors.push("id ausente o duplicado");
    else ids.add(group.id);
    if (!group?.primarySymbol) groupErrors.push("primarySymbol ausente");
    if (!group?.migration) groupErrors.push("migration ausente");
    if (!Array.isArray(group?.symbols) || group.symbols.length === 0) {
      groupErrors.push("symbols[] debe nombrar al menos un símbolo");
    }
    if (!Array.isArray(group?.evidence) || group.evidence.length === 0) {
      groupErrors.push("evidence[] debe explicar y anclar el degradado");
    }

    for (const declaration of group?.symbols ?? []) {
      if (!declaration?.name || !declaration?.kind || !Array.isArray(declaration?.callSites)) {
        groupErrors.push("cada símbolo requiere name, kind y callSites[]");
        continue;
      }
      const matches = findDeclaredSymbol(analyses, declaration);
      if (matches.length !== 1) {
        groupErrors.push(`${declaration.kind}:${declaration.name} no identifica un único símbolo pendiente ausente`);
        continue;
      }
      const analysis = matches[0];
      if (!analysis.symbol.migrations.includes(group.migration)) {
        groupErrors.push(`${declaration.name} no nace en ${group.migration}`);
      }
      if (analysis.reachableReferences.length === 0) {
        groupErrors.push(`${declaration.name} ya no tiene sitio alcanzable; elimina la declaración vencida`);
      }
      const actualSites = analysis.reachableReferences.map((reference) => reference.site);
      if (!sameStringSet(actualSites, declaration.callSites)) {
        groupErrors.push(
          `${declaration.name} declara [${declaration.callSites.join(", ")}] pero hoy llama desde [${actualSites.join(", ")}]`,
        );
      }
      if (symbolToGroup.has(analysis.symbol.key)) {
        groupErrors.push(`${declaration.name} aparece en más de una declaración`);
      }
      resolvedSymbols.push(analysis);
    }

    if (Array.isArray(group?.symbols)
      && !group.symbols.some((symbol) => symbol.name === group.primarySymbol)) {
      groupErrors.push("primarySymbol debe ser uno de los símbolos declarados");
    }

    for (const evidence of group?.evidence ?? []) {
      const parsed = parseSite(evidence?.site);
      if (!parsed || !evidence?.contains || !evidence?.degradation) {
        groupErrors.push("cada evidencia requiere site, contains y degradation");
        continue;
      }
      const source = sources.get(parsed.file);
      const line = source?.split(/\r?\n/)[parsed.line - 1];
      if (line === undefined || !line.includes(evidence.contains)) {
        groupErrors.push(`${evidence.site} no contiene la evidencia declarada: ${evidence.contains}`);
      }
      if (!reachable.has(parsed.file)) {
        groupErrors.push(`${evidence.site} no es alcanzable desde app/**`);
      }
    }

    if (groupErrors.length > 0) {
      for (const error of groupErrors) errors.push(`${group?.id ?? "<sin-id>"}: ${error}`);
      continue;
    }

    const normalized = { ...group, analyses: resolvedSymbols };
    groups.push(normalized);
    for (const analysis of resolvedSymbols) symbolToGroup.set(analysis.symbol.key, normalized);
  }

  return { errors, symbolToGroup, groups };
}

/** Decisión pura completa del gate sobre migraciones, fuentes y declaraciones dadas. */
export function analyzeRepositoryData({
  migrations,
  pendingMigrationNames,
  sourceFiles,
  declarations,
  entrypoints,
}) {
  const pendingOnlySymbols = findPendingOnlySymbols(migrations, pendingMigrationNames);
  const { reachable, imports, importers } = findReachableGraph(sourceFiles, entrypoints);
  // El modelo de columnas por relación solo hace falta si hay columnas pendientes.
  const association = pendingOnlySymbols.some((symbol) => symbol.kind === "column")
    ? createColumnAssociation({ migrations, sourceFiles, imports, importers })
    : null;
  const analyses = pendingOnlySymbols.map((symbol) => {
    const references = findSymbolReferences(sourceFiles, symbol);
    const reachableReferences = [];
    const homonymReferences = [];
    for (const reference of references) {
      if (!reachable.has(reference.file)) continue;
      const verdict = symbol.kind === "column" ? association.classify(symbol, reference.file) : { counted: true };
      if (verdict.counted) reachableReferences.push(reference);
      else homonymReferences.push({ ...reference, relation: verdict.relation });
    }
    return { symbol, references, reachableReferences, homonymReferences };
  });
  const declarationResult = validateDeclarations(declarations, analyses, sourceFiles, reachable);
  const red = analyses.filter((analysis) =>
    analysis.reachableReferences.length > 0 && !declarationResult.symbolToGroup.has(analysis.symbol.key),
  );
  const silent = analyses.filter((analysis) => analysis.reachableReferences.length === 0);

  return {
    pendingOnlySymbols,
    reachable,
    analyses,
    red,
    yellow: declarationResult.groups,
    silent,
    declarationErrors: declarationResult.errors,
  };
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function collectSourceFiles(root) {
  const files = {};
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(path.join(directory, entry.name));
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;
      const absolute = path.join(directory, entry.name);
      files[normalizeRepoPath(path.relative(root, absolute))] = fs.readFileSync(absolute, "utf8");
    }
  };
  visit(root);
  return files;
}

export function loadRepositoryData(root = process.cwd()) {
  const baselineFile = path.join(root, "supabase", "migrations-baseline.json");
  const declarationsFile = path.join(root, "supabase", "pending-migration-symbol-declarations.json");
  const migrationsDirectory = path.join(root, "supabase", "migrations");
  const baseline = readJson(baselineFile);
  if (!baseline?.pendingBelowCutoff || typeof baseline.pendingBelowCutoff !== "object") {
    throw new Error("migrations-baseline.json no contiene pendingBelowCutoff");
  }

  const pendingMigrationNames = Object.keys(baseline.pendingBelowCutoff);
  const migrations = fs.readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => ({
      name: file.replace(/\.sql$/, ""),
      sql: fs.readFileSync(path.join(migrationsDirectory, file), "utf8"),
    }));
  const migrationNames = new Set(migrations.map((migration) => migration.name));
  const missingPendingFiles = pendingMigrationNames.filter((name) => !migrationNames.has(name));
  if (missingPendingFiles.length > 0) {
    throw new Error(`pendingBelowCutoff declara migraciones sin archivo: ${missingPendingFiles.join(", ")}`);
  }

  return {
    migrations,
    pendingMigrationNames,
    sourceFiles: collectSourceFiles(root),
    declarations: readJson(declarationsFile),
  };
}

export function auditRepository(root = process.cwd()) {
  return analyzeRepositoryData(loadRepositoryData(root));
}

function printResult(result) {
  if (result.declarationErrors.length > 0) {
    console.log(`${C.red}[FAIL]${C.nc} pending-migration-symbols: declaraciones inválidas:`);
    for (const error of result.declarationErrors) console.log(`${C.red}   • ${error}${C.nc}`);
    return 2;
  }

  for (const group of result.yellow) {
    console.log(
      `${C.yellow}[AMARILLO]${C.nc} pending-migration-symbols: ${group.primarySymbol} `
      + `${C.dim}(${group.migration})${C.nc}`,
    );
    for (const analysis of group.analyses) {
      console.log(
        `${C.dim}   ${analysis.symbol.kind} ${analysis.symbol.displayName} → `
        + `${analysis.reachableReferences.map((reference) => reference.site).join(", ")}${C.nc}`,
      );
    }
    for (const evidence of group.evidence) {
      console.log(`${C.dim}   evidencia ${evidence.site}: ${evidence.degradation}${C.nc}`);
    }
  }

  // Referencias homónimas: el nombre coincide, pero el módulo (o un vecino)
  // trabaja con otra relación que sí tiene esa columna. No se exigen; se listan
  // para que la revisión pueda verificar la asociación (SDD-0464).
  const homonyms = result.analyses.filter((analysis) => analysis.homonymReferences.length > 0);
  const homonymCount = homonyms.reduce((total, analysis) => total + analysis.homonymReferences.length, 0);
  for (const analysis of homonyms) {
    console.log(
      `${C.dim}[HOMÓNIMOS] pending-migration-symbols: ${analysis.symbol.displayName} `
      + `(${analysis.symbol.migrations.join(", ")}) — ${analysis.homonymReferences.length} sitio(s) de otra relación, no exigidos:${C.nc}`,
    );
    for (const reference of analysis.homonymReferences) {
      console.log(`${C.dim}   ${reference.site} → ${reference.relation}.${analysis.symbol.name}${C.nc}`);
    }
  }
  const homonymSuffix = homonymCount > 0 ? ` · ${homonymCount} homónimo(s) descartado(s)` : "";

  if (result.red.length > 0) {
    console.log(
      `${C.red}[ROJO]${C.nc} pending-migration-symbols: ${result.red.length} símbolo(s) `
      + `ausente(s) con código alcanzable y sin declaración${homonymSuffix}:`,
    );
    for (const analysis of result.red) {
      console.log(
        `${C.red}   • ${analysis.symbol.displayName}${C.nc} ${C.dim}`
        + `(${analysis.symbol.kind}; ${analysis.symbol.migrations.join(", ")})${C.nc}`,
      );
      for (const reference of analysis.reachableReferences) {
        console.log(`${C.red}      ${reference.site}${C.nc}`);
      }
    }
    return 1;
  }

  console.log(
    `${C.green}[OK]${C.nc} pending-migration-symbols: 0 ROJO · `
    + `${result.yellow.length} AMARILLO declarado(s)${homonymSuffix}`,
  );
  return 0;
}

async function main() {
  try {
    process.exitCode = printResult(auditRepository());
  } catch (error) {
    console.error(`${C.red}[FAIL]${C.nc} pending-migration-symbols: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
