// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";
const harnessPath = "../../../scripts/tests/fechas-caracas-postgrest.mjs";
const { inlineContract, embeddedSql } = await import(harnessPath) as {
  inlineContract: (vars?: Record<string, string>, replacements?: Record<string, string>) => string;
  embeddedSql: (sql: string) => string;
};

const off = { run_defaults:"false", run_operations:"false", run_auto_invoice:"false", run_expenses:"false", run_portal:"false", run_closing:"false" };
async function execute(vars: Record<string,string>) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try { await db.exec(embeddedSql(inlineContract(vars))); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
  finally { await db.close(); }
}
describe("0499 · migración REAL, luego solo reloj instrumentado", () => {
  it("composición0493: OLD/NEW, excepción real y tres guardas de gasto C1", async () => {
    expect(await execute({ ...off, apply_fix:"true", run_expenses:"true", run_closing:"true" })).toBeNull();
  },240_000);
  it("defaults, cobro, pago, 0128 y gasto: fechas, ACL, tenant, centavos e historia", async () => {
    expect(await execute({ apply_fix:"true", run_portal:"false" })).toBeNull();
  },240_000);
  it.each([
    ["defaults","TEST0499: default journal Caracas independiente de sesión"],
    ["operations","TEST0499: cobro null captura Caracas una vez"],
    ["auto_invoice","TEST0499: 0128 retorna fecha persistida misma ancla y vencimiento"],
    ["expenses","TEST0499: origen Caracas cerrado sin asiento rechazado"],
  ])("control rojo permanente anterior: %s", async (group,message) => {
    expect(await execute({ ...off, apply_fix:"false", [`run_${group}`]:"true" })).toBe(message);
  },240_000);
});
