/**
 * Contrato exhaustivo de RBAC para los GET de `app/api/studio` (SDD-0286).
 *
 * RLS limita el tenant, pero no decide qué módulos puede ver un rol. Cada GET
 * debe llamar `moduleViewDenial` con su módulo real o aparecer en la allowlist
 * con una autorización más fina y verificable. El análisis usa el AST para que
 * un import, comentario u otro handler no produzca un falso verde.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

const STUDIO_API = join(process.cwd(), "app", "api", "studio");

type GuardRule = { moduleId: string; beforeCall: string };

const GUARDED: Record<string, GuardRule> = {
  "attachments/[id]/download/route.ts": {
    moduleId: "expenses",
    beforeCall: "authorizeAttachmentDownload",
  },
  "bitacora/export/route.ts": {
    moduleId: "bitacora",
    beforeCall: "listAssignableProfiles",
  },
  "conversaciones/[id]/route.ts": {
    moduleId: "conversaciones",
    beforeCall: "from",
  },
  "kpis/route.ts": { moduleId: "dashboard", beforeCall: "from" },
  "legal/evidence/[code]/route.ts": {
    moduleId: "legal",
    beforeCall: "from",
  },
  "shipments/[id]/route.ts": {
    moduleId: "tracking",
    beforeCall: "getShipmentById",
  },
  "shipments/route.ts": { moduleId: "tracking", beforeCall: "from" },
};

const ALLOWLIST: Record<string, string> = {
  "audit/export/route.ts":
    "La RPC audit_authorize_export_download autoriza la solicitud antes de que el admin client firme la URL.",
  "bugs/route.ts":
    "Bug Reporter es transversal: RLS limita la lista propia y el rol admin habilita la lista completa.",
  "bugs/[id]/route.ts":
    "Bug Reporter autoriza por registro; tech_data sólo se entrega al admin del tenant del bug.",
  "bugs/[id]/messages/route.ts":
    "Bug Reporter autoriza el hilo por registro mediante RLS.",
  "bugs/[id]/prompt/route.ts":
    "Exige admin activo del tenant exacto del bug antes de generar el prompt.",
  "bugs/[id]/replay/route.ts":
    "Autoriza por registro mediante RLS antes de firmar la URL temporal del replay.",
  "comercial/export/route.ts":
    "El tipo solicitado decide el módulo: quotes para estimados e invoices para facturas, con overrides.",
  "operativo/export/route.ts":
    "El tipo solicitado decide el módulo: clients, collections o tracking, con overrides.",
};

function findRoutes(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) findRoutes(full, acc);
    else if (entry.name === "route.ts") acc.push(full);
  }
  return acc;
}

function parseRoute(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

type RouteHandler = ts.FunctionLikeDeclaration & { body: ts.ConciseBody };

function isExported(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
      ts.getModifiers(node)?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
  );
}

function localHandlers(source: ts.SourceFile): Map<string, RouteHandler> {
  const handlers = new Map<string, RouteHandler>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      handlers.set(statement.name.text, statement as RouteHandler);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          handlers.set(declaration.name.text, declaration.initializer as RouteHandler);
        }
      }
    }
  }
  return handlers;
}

function getHandler(source: ts.SourceFile): RouteHandler | null {
  const handlers = localHandlers(source);
  const candidates: RouteHandler[] = [];

  for (const statement of source.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "GET" &&
      statement.body &&
      isExported(statement)
    ) {
      candidates.push(statement as RouteHandler);
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "GET") {
          continue;
        }
        if (
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          candidates.push(declaration.initializer as RouteHandler);
        }
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text !== "GET") continue;
        const localName = element.propertyName?.text ?? element.name.text;
        const handler = handlers.get(localName);
        if (handler) candidates.push(handler);
      }
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length > 1) throw new Error(`${source.fileName} exporta GET más de una vez`);
  return unique[0] ?? null;
}

function callName(call: ts.CallExpression): string | null {
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
  return null;
}

function allCalls(handler: RouteHandler, name: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && callName(node) === name) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(handler.body);
  return calls;
}

function unwrapParentheses(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isNumeric403(node: ts.Node | undefined): boolean {
  return Boolean(node && ts.isNumericLiteral(node) && node.text === "403");
}

function isStatus403Property(property: ts.ObjectLiteralElementLike): boolean {
  if (!ts.isPropertyAssignment(property)) return false;
  const name = property.name;
  const isStatus =
    (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text === "status";
  return isStatus && isNumeric403(property.initializer);
}

function is403Response(expression: ts.Expression): boolean {
  const value = unwrapParentheses(expression);
  if (!ts.isCallExpression(value)) return false;

  if (ts.isIdentifier(value.expression) && value.expression.text === "apiError") {
    return isNumeric403(value.arguments[2]);
  }

  if (
    ts.isPropertyAccessExpression(value.expression) &&
    ts.isIdentifier(value.expression.expression) &&
    value.expression.expression.text === "NextResponse" &&
    value.expression.name.text === "json"
  ) {
    const options = value.arguments[1];
    return Boolean(
      options &&
        ts.isObjectLiteralExpression(options) &&
        options.properties.some(isStatus403Property),
    );
  }
  return false;
}

function returns403(node: ts.Statement): boolean {
  if (ts.isReturnStatement(node)) {
    return Boolean(node.expression && is403Response(node.expression));
  }
  if (ts.isBlock(node)) {
    return node.statements.some(
      (statement) =>
        ts.isReturnStatement(statement) &&
        Boolean(statement.expression && is403Response(statement.expression)),
    );
  }
  return false;
}

type EffectiveGuard = {
  moduleId: string;
  callPosition: number;
  cutoffPosition: number;
};

function authorizationStatements(body: ts.Block): ts.Statement[] {
  const statements: ts.Statement[] = [];
  for (const statement of body.statements) {
    if (ts.isTryStatement(statement)) {
      statements.push(...statement.tryBlock.statements);
    } else {
      statements.push(statement);
    }
  }
  return statements;
}

function effectiveGuards(handler: RouteHandler): EffectiveGuard[] {
  if (!ts.isBlock(handler.body)) return [];
  const guards: EffectiveGuard[] = [];
  const statements = authorizationStatements(handler.body);

  for (const [index, statement] of statements.entries()) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      if (!ts.isAwaitExpression(declaration.initializer)) continue;
      const awaited = declaration.initializer.expression;
      if (!ts.isCallExpression(awaited) || callName(awaited) !== "moduleViewDenial") {
        continue;
      }
      const moduleArg = awaited.arguments[1];
      if (!moduleArg || !ts.isStringLiteralLike(moduleArg)) continue;
      const denialName = declaration.name.text;

      const denialCheck = statements.slice(index + 1).find(
        (candidate) =>
          ts.isIfStatement(candidate) &&
          ts.isIdentifier(unwrapParentheses(candidate.expression)) &&
          (unwrapParentheses(candidate.expression) as ts.Identifier).text ===
            denialName &&
          returns403(candidate.thenStatement),
      );
      if (denialCheck) {
        guards.push({
          moduleId: moduleArg.text,
          callPosition: awaited.getStart(),
          cutoffPosition: denialCheck.getEnd(),
        });
      }
    }
  }
  return guards;
}

function relativeRoute(file: string): string {
  return relative(STUDIO_API, file).split(sep).join("/");
}

const routes = findRoutes(STUDIO_API).sort();
const getRoutes = routes
  .map((file) => ({ file, handler: getHandler(parseRoute(file)) }))
  .filter(
    (entry): entry is { file: string; handler: RouteHandler } =>
      entry.handler !== null,
  );

describe("RBAC anti-drift · GET de la API Studio (SDD-0286)", () => {
  it("clasifica exactamente los 15 GET actuales", () => {
    const overlap = Object.keys(GUARDED).filter((path) => path in ALLOWLIST);
    expect(overlap).toEqual([]);
    expect(getRoutes.map((entry) => relativeRoute(entry.file)).sort()).toEqual(
      [...Object.keys(GUARDED), ...Object.keys(ALLOWLIST)].sort(),
    );
  });

  for (const entry of getRoutes) {
    const route = relativeRoute(entry.file);
    it(`${route} conserva su contrato de autorización`, () => {
      if (route in GUARDED) {
        const rule = GUARDED[route];
        const rawCalls = allCalls(entry.handler, "moduleViewDenial");
        const guards = effectiveGuards(entry.handler);
        expect(rawCalls).toHaveLength(1);
        expect(guards.map((guard) => guard.moduleId)).toEqual([rule.moduleId]);

        const firstDomainCall = allCalls(entry.handler, rule.beforeCall)
          .map((call) => call.getStart())
          .sort((a, b) => a - b)[0];
        expect(firstDomainCall, `falta la consulta de dominio ${rule.beforeCall}`).toBeTypeOf(
          "number",
        );
        expect(guards[0].callPosition).toBeLessThan(firstDomainCall);
        expect(guards[0].cutoffPosition).toBeLessThan(firstDomainCall);
        return;
      }
      expect(ALLOWLIST[route]?.length).toBeGreaterThan(20);
      expect(allCalls(entry.handler, "moduleViewDenial")).toEqual([]);
    });
  }
});
