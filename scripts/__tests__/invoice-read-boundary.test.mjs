import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { canAccessModule } from "../../lib/studio/rbac";
import { KPI_CATALOG } from "../../lib/studio/dashboard/dashboard-catalog";

// SDD-0357: inventario de llamadas literales, NO autorización genérica ni
// análisis de flujo. Nuevos callers requieren revisión de su guard y su tenant.
const BASELINE = {
  "app/portal/(app)/facturas/[code]/reportar/actions.ts": 1,
  "app/studio/(app)/cobranzas/actions.ts": 1,
  "app/studio/(app)/cobranzas/recibo/[code]/page.tsx": 1,
  // SDD-0465: +1 por la lectura previa de `softDeleteInvoice` (id, status,
  // invoice_code, deleted_at), detrás de moduleEditDenial("invoices") y con el
  // cliente de sesión bajo RLS; decide el mensaje antes del UPDATE condicionado.
  "app/studio/(app)/facturacion/actions.ts": 11,
  "app/studio/(app)/fidelizacion/actions.ts": 2,
  "lib/portal/portal-legal-queries.ts": 3,
  "lib/portal/portal-queries.ts": 2,
  "lib/studio/accounting/referral-credit-posting.ts": 2,
  "lib/studio/collections-actions.ts": 6,
  "lib/studio/costing/queries.ts": 2,
  "lib/studio/dashboard/dashboard-kpi-queries.ts": 1,
  "lib/studio/fidelizacion/referral-credit-queries.ts": 1,
  "lib/studio/fiscal/queries.ts": 1,
  "lib/studio/invoice-queries.ts": 3,
  "lib/studio/kommo-contact-status.ts": 1,
  "lib/studio/payment-queries.ts": 1,
  "lib/studio/renditions/queries.ts": 3,
  "lib/studio/reports/queries.ts": 4,
};

function filesUnder(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function invoiceCalls(source) {
  const ast = ts.createSourceFile("source.tsx", source, ts.ScriptTarget.Latest, true);
  let count = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const method = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)
          ? callee.argumentExpression.text
          : null;
      const arg = node.arguments[0];
      if (method === "from" && arg && ts.isStringLiteralLike(arg) && arg.text === "invoices") count++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return count;
}

describe("SDD-0357 · frontera de lectura de facturas", () => {
  // L07, ronda 3: tope propio de 60 s. La prueba lee y parsea unos 1.600
  // módulos y, bajo la carga de `pnpm verify`, tardó 22,4 s y 20,8 s contra el
  // tope global de 20 s. Es sincrónica: el tope no la corta a mitad, sólo la
  // marca en rojo si al terminar lo pasó. El inventario exigido no cambia.
  it("congela el inventario de callers de producción sin contar comentarios o fixtures", () => {
    const actual = {};
    for (const path of ["app", "lib", "supabase/functions"].flatMap((root) => filesUnder(resolve(root)))) {
      if (!/\.[cm]?[jt]sx?$/.test(path) || /(__tests__|\.test\.|\.spec\.)/.test(path)) continue;
      const count = invoiceCalls(readFileSync(path, "utf8"));
      if (count) actual[relative(process.cwd(), path).replaceAll("\\", "/")] = count;
    }
    expect(actual).toEqual(BASELINE);
    expect(Object.keys(actual)).toHaveLength(18);
    expect(Object.values(actual).reduce((sum, count) => sum + count, 0)).toBe(46);
  }, 60_000);

  it("reconoce llamadas literales y no confunde ejemplos o comentarios con código", () => {
    expect(invoiceCalls(`// db.from("invoices")
      const example = 'db.from("invoices")';
      db.from("clients"); db.from("invoices"); db["from"]('invoices');
    `)).toBe(2);
  });

  it("mantiene los cuatro widgets financieros detrás del candado invoices", () => {
    for (const id of ["monthRevenue", "invoicesDue", "pendingCollect", "avgTicket"]) {
      expect(KPI_CATALOG.find((kpi) => kpi.id === id)?.module).toBe("invoices");
    }
    for (const role of ["commercial", "operations", "warehouse", "support", "marketing"]) {
      expect(canAccessModule(role, "invoices", { [`${role}:invoices`]: { view: true, edit: true } })).toBe(false);
    }
    expect(canAccessModule("accounting", "invoices")).toBe(true);
    expect(canAccessModule("admin", "invoices")).toBe(true);
  });
});
