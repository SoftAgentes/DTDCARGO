// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const harnessPath = "../../../scripts/tests/fechas-caracas-postgrest.mjs";
const { inlineContract, embeddedSql } = await import(harnessPath) as {
  inlineContract: (vars?: Record<string,string>) => string;
  embeddedSql: (sql:string) => string;
};
async function execute(vars:Record<string,string>) {
  const db = new PGlite({ extensions:{pgcrypto} });
  try {
    await db.exec(embeddedSql(inlineContract({run_defaults:"false",run_operations:"false",run_auto_invoice:"false",run_expenses:"false",run_portal:"true",...vars})));
    return null;
  } catch(error) { return error instanceof Error ? error.message : String(error); }
  finally { await db.close(); }
}
describe("Portal C1 · frescura nueva y recibo histórico", () => {
  it("0499 real: futura nueva falla; replay autorizado conserva identidad/hash/auditoría/saldo", async () => {
    expect(await execute({apply_fix:"true"})).toBeNull();
  },240_000);
  it("control rojo anterior: acepta fecha futura Caracas", async () => {
    expect(await execute({apply_fix:"false"})).toBe("TEST0499: Portal futuro nuevo Caracas aun con objeto presente rechazado");
  },240_000);
  it("control rojo anterior: rechaza recuperación idéntica por frescura", async () => {
    expect(await execute({apply_fix:"false",run_portal_replay_only:"true"})).toBe("PAYMENT_INPUT");
  },240_000);
});
