import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PORTAL_ROOT = resolve("app/portal");
const ADMIN_MODULE = normalizedPath(resolve("lib/db/admin.ts"));
const configFile = ts.readConfigFile(resolve("tsconfig.json"), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const compilerOptions = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  ROOT,
  undefined,
  resolve("tsconfig.json"),
).options;

function normalizedPath(path) {
  return resolve(path).replaceAll("\\", "/").toLowerCase();
}

function repoPath(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function productionComponents(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return productionComponents(path);
    }
    if (!/\.(?:tsx|jsx)$/i.test(entry.name) || /\.(?:test|spec)\.[^.]+$/i.test(entry.name)) return [];
    return [path];
  });
}

function hasRuntimeImport(node) {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings?.elements.some((element) => !element.isTypeOnly) ?? false;
}

function hasRuntimeExport(node) {
  if (node.isTypeOnly) return false;
  if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return true;
  return node.exportClause.elements.some((element) => !element.isTypeOnly);
}

function resolvedModule(specifier, containingFile) {
  return ts.resolveModuleName(specifier, containingFile, compilerOptions, ts.sys)
    .resolvedModule?.resolvedFileName;
}

function analyzeSource(source, file) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  );
  const client = sourceFile.statements.some((statement) =>
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use client",
  );
  const findings = [];
  const record = (node, kind, specifier) => {
    const target = resolvedModule(specifier, file);
    if (!target || normalizedPath(target) !== ADMIN_MODULE) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    findings.push({ file: repoPath(file), line: line + 1, client, kind, specifier });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (hasRuntimeImport(node)) record(node, "import", node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)) {
      if (hasRuntimeExport(node)) record(node, "export", node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      record(node, "import-equals", node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const requireCall = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (dynamicImport || requireCall) {
        const argument = node.arguments[0];
        if (!argument || !ts.isStringLiteralLike(argument)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          findings.push({
            file: repoPath(file), line: line + 1, client,
            kind: dynamicImport ? "dynamic-import" : "dynamic-require",
            specifier: "<no literal>",
          });
        } else {
          record(node, dynamicImport ? "dynamic-import" : "require", argument.text);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

describe("Portal RSC · frontera AST de service_role", () => {
  it("barre todos los componentes Portal de producción y prohíbe admin directo", () => {
    const files = productionComponents(PORTAL_ROOT);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.endsWith("layout.tsx"))).toBe(true);
    const findings = files.flatMap((file) => analyzeSource(readFileSync(file, "utf8"), file));
    expect(findings).toEqual([]);
  });

  it("detecta alias, relativos, namespace, reexports y cargas dinámicas reales", () => {
    const fixture = resolve("app/portal/synthetic-boundary.tsx");
    const cases = [
      'import { createAdminClient as elevated } from "@/lib/db/admin";',
      'import * as admin from "../../lib/db/admin";',
      'export { createAdminClient } from "@/lib/db/admin";',
      'const admin = require("@/lib/db/admin");',
      'const admin = await import("@/lib/db/admin");',
    ];
    for (const source of cases) expect(analyzeSource(source, fixture)).toHaveLength(1);
  });

  it("ignora comentarios, strings e imports sólo de tipo", () => {
    const fixture = resolve("app/portal/synthetic-safe.tsx");
    const source = `
      // import { createAdminClient } from "@/lib/db/admin";
      const note = "@/lib/db/admin createAdminClient()";
      import type { AdminMarker } from "@/lib/db/admin";
      export type { AdminMarker } from "@/lib/db/admin";
    `;
    expect(analyzeSource(source, fixture)).toEqual([]);
  });

  it("rechaza imports dinámicos no literales y marca componentes cliente", () => {
    const fixture = resolve("app/portal/synthetic-client.tsx");
    const [finding] = analyzeSource(
      '"use client"; const target = "@/lib/db/admin"; import(target);',
      fixture,
    );
    expect(finding).toMatchObject({ client: true, kind: "dynamic-import", specifier: "<no literal>" });
  });
});
