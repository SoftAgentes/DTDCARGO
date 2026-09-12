/**
 * Regresión SDD-0450 (corrección 2026-09-11): el gate pending-migration-symbols
 * enmascara comentarios y literales por unidades UTF-16. Con un spread por code
 * points, cada carácter astral (emoji fuera del BMP) desplazaba la máscara una
 * posición: se reportaban líneas erróneas y se omitían DDL e imports.
 *
 * Cada caso falla con el enmascarado anterior (`[...texto]`) y pasa con el actual.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryData,
  extractCreatedSymbols,
  extractImportSpecifiers,
  findReachableModules,
  findSymbolReferences,
  maskJavaScriptComments,
  maskSqlNonCode,
} from "../check-pending-migration-symbols.mjs";

const EMPTY_DECLARATIONS = { schemaVersion: 1, degradations: [] };
const RPC = "get_portal_fixture_documents";
const MIGRATION = "0406_fixture_portal_documents";
const MIGRATIONS = [{
  name: MIGRATION,
  sql: `create or replace function public.${RPC}(p_limit int) returns setof jsonb language sql as 'select 1';`,
}];
const PAGE_FILE = "app/portal/(app)/documentos/page.tsx";
const QUERIES_FILE = "lib/portal/fixture-queries.ts";
const CALL_LINE = 11;
const EVIDENCE_LINE = 12;

// Astrales en comentario de línea, literal, bloque JSDoc y comentario interno.
const QUERIES = [
  'import "server-only";',
  "",
  "// 📦 Packing lists del principal: la RPC filtra por Shipping Mark.",
  'const EMPTY_LABEL = "Sin documentos 📭";',
  "",
  "/**",
  " * 🚚 Documentos de envío del portal, en un bloque JSDoc con astral.",
  " */",
  "export async function listFixtureDocuments(db) {",
  "  // Sin fallback admin 🧾: la RPC decide qué filas ve el principal.",
  `  const { data, error } = await db.rpc("${RPC}", { p_limit: 20 });`,
  "  if (error) return [];",
  "  return data?.length ? data : [EMPTY_LABEL];",
  "}",
].join("\n");

const PAGE_LINES = [
  'import { listFixtureDocuments } from "@/lib/portal/fixture-queries";',
  "",
  "export default async function Page() {",
  "  const docs = await listFixtureDocuments(db);",
  "  return <ul>{docs.length}</ul>;",
  "}",
];
const PAGE = PAGE_LINES.join("\n");

/**
 * Una máscara solo reemplaza unidades por espacios: misma longitud UTF-16, cada
 * posición igual o en blanco y cada salto de línea en su sitio.
 */
function assertAlignedMask(original, masked) {
  assert.equal(masked.length, original.length, "la máscara cambió la longitud UTF-16");
  for (let index = 0; index < original.length; index += 1) {
    if (original[index] === "\n") {
      assert.equal(masked[index], "\n", `salto de línea movido en la unidad ${index}`);
    } else if (masked[index] !== original[index]) {
      assert.equal(masked[index], " ", `la unidad ${index} cambió por algo distinto de un espacio`);
    }
  }
  assert.equal(masked.split(/\r?\n/).length, original.split(/\r?\n/).length);
}

function reachableSites(analysis) {
  return analysis.reachableReferences.map((reference) => reference.site);
}

function analyze(sourceFiles, declarations = EMPTY_DECLARATIONS) {
  return analyzeRepositoryData({
    migrations: MIGRATIONS,
    pendingMigrationNames: [MIGRATION],
    sourceFiles,
    declarations,
  });
}

test("un par sustituto enmascarado ocupa dos espacios y no mueve el salto de línea", () => {
  assert.equal(maskJavaScriptComments("// 📦\nx"), "     \nx");
  assert.equal(maskSqlNonCode("-- 📦\nx"), "     \nx");
});

test("TS con astrales antes de .rpc() reporta la línea exacta de la llamada", () => {
  assert.ok(
    QUERIES.split("\n")[CALL_LINE - 1].includes(`.rpc("${RPC}"`),
    "fixture: la llamada vive en CALL_LINE",
  );

  for (const [label, source] of [["LF", QUERIES], ["CRLF", QUERIES.replaceAll("\n", "\r\n")]]) {
    assertAlignedMask(source, maskJavaScriptComments(source));
    assert.deepEqual(
      findSymbolReferences({ [QUERIES_FILE]: source }, { name: RPC }).map((reference) => reference.site),
      [`${QUERIES_FILE}:${CALL_LINE}`],
      label,
    );
  }

  const result = analyze({ [PAGE_FILE]: PAGE, [QUERIES_FILE]: QUERIES });
  assert.deepEqual(result.declarationErrors, []);
  assert.deepEqual(result.red.map(reachableSites), [[`${QUERIES_FILE}:${CALL_LINE}`]]);
});

test("SQL con astrales en un comentario justo antes de create function extrae el símbolo", () => {
  // Con el spread anterior, la máscara del comentario avanzaba tantas posiciones
  // como astrales la precedían: el salto de línea preservado absorbía la primera
  // y la segunda borraba la «c» de create.
  const sql = [
    "-- 📦🚚 Documentos del portal por principal.",
    `create or replace function public.${RPC}(p_limit int)`,
    "returns setof jsonb",
    "language sql",
    "security definer",
    "set search_path = public",
    "as $$",
    "  select '{}'::jsonb limit p_limit;",
    "$$;",
  ].join("\n");

  assertAlignedMask(sql, maskSqlNonCode(sql));
  assert.deepEqual(extractCreatedSymbols(sql, MIGRATION).map((symbol) => symbol.key), [`function:public.${RPC}`]);
});

test("SQL con astrales previos en literales conserva la función posterior (forma de 0090)", () => {
  const sql = [
    "create table if not exists public.fixture_reactions (",
    "  emoji text not null check (emoji in ('👍','👀','🔥'))",
    ");",
    "",
    "-- Congela columnas de identidad en UPDATE.",
    "create or replace function public.fixture_freeze_immutable()",
    "returns trigger",
    "language plpgsql",
    "as $$",
    "begin",
    "  return new;",
    "end $$;",
  ].join("\n");

  assertAlignedMask(sql, maskSqlNonCode(sql));
  assert.deepEqual(extractCreatedSymbols(sql, "0090_fixture").map((symbol) => symbol.key), [
    "function:public.fixture_freeze_immutable",
    "table:public.fixture_reactions",
  ]);
});

test("SQL con astrales en comentarios conserva ALTER TABLE ... ADD COLUMN (forma de 0128)", () => {
  const sql = [
    "-- IVA (review 🟡): el total se construye desde base + iva.",
    "-- Ya-facturado (review 🟡): excluye borrador y anulada.",
    "alter table public.fixture_orders",
    "  add column if not exists invoicing_total_boxes int;",
  ].join("\n");

  assertAlignedMask(sql, maskSqlNonCode(sql));
  assert.deepEqual(extractCreatedSymbols(sql, "0128_fixture").map((symbol) => symbol.key), [
    "column:public.fixture_orders.invoicing_total_boxes",
  ]);
});

test("una declaración anclada a la línea real de la llamada pasa como AMARILLO", () => {
  const declarations = {
    schemaVersion: 1,
    degradations: [{
      id: "fixture-portal-documents-pending-rpc",
      primarySymbol: RPC,
      migration: MIGRATION,
      symbols: [{ kind: "function", name: RPC, callSites: [`${QUERIES_FILE}:${CALL_LINE}`] }],
      evidence: [{
        site: `${QUERIES_FILE}:${EVIDENCE_LINE}`,
        contains: "if (error) return [];",
        degradation: "sin la RPC la sección queda vacía y falla cerrada",
      }],
    }],
  };

  const result = analyze({ [PAGE_FILE]: PAGE, [QUERIES_FILE]: QUERIES }, declarations);
  assert.deepEqual(result.declarationErrors, []);
  assert.deepEqual(result.red, []);
  assert.deepEqual(result.yellow.map((group) => group.primarySymbol), [RPC]);
  assert.deepEqual(result.yellow[0].analyses.map(reachableSites), [[`${QUERIES_FILE}:${CALL_LINE}`]]);
});

test("un import tras un comentario con astrales conserva la arista y el ROJO", () => {
  // Con el spread anterior se borraba la «i» de import: el módulo quedaba fuera
  // del grafo y un ROJO real pasaba a silencio.
  const page = ["// 📦🚚 Documentos del portal: tarjetas de packing list.", ...PAGE_LINES].join("\n");
  const sourceFiles = { [PAGE_FILE]: page, [QUERIES_FILE]: QUERIES };

  assertAlignedMask(page, maskJavaScriptComments(page));
  assert.deepEqual(extractImportSpecifiers(page), ["@/lib/portal/fixture-queries"]);
  assert.ok(findReachableModules(sourceFiles).has(QUERIES_FILE));

  const result = analyze(sourceFiles);
  assert.deepEqual(result.silent, []);
  assert.deepEqual(result.red.map(reachableSites), [[`${QUERIES_FILE}:${CALL_LINE}`]]);
});
