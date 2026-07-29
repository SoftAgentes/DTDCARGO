import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_MD5,
  MIGRATION_PATH,
  SQL_TEST_PATH,
  SWEEP_MD5,
  buildMigration,
  buildSqlTest,
  loadInputs,
} from "../build-sdd-0118-rls-history.mjs";

function normalized(path: string) {
  return readFile(path, "utf8").then((value) => value.replace(/\r\n/g, "\n"));
}

describe("SDD-0118 · historial reproducible de rls_auto_enable", () => {
  it("ancla los payloads recuperados con digests exactos", async () => {
    const inputs = await loadInputs();
    expect(inputs.bootstrapSql).toContain(
      "create or replace function public.rls_auto_enable()",
    );
    expect(inputs.bootstrapSql).toContain("create event trigger ensure_rls");
    expect(inputs.sweepSql).toContain(
      "revoke execute on function public.rls_auto_enable()",
    );
    expect(BOOTSTRAP_MD5).toBe("171643b4a504a765e5183d0e80cd461f");
    expect(SWEEP_MD5).toBe("c6c722efdb7ff79ef037e0d826739205");
  });

  it("genera una reparación sólo-ledger, exacta e idempotente", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const topLevelSql = migration.replace(
      /\$sdd0118_rls_bootstrap\$[\s\S]*?\$sdd0118_rls_bootstrap\$/g,
      "''",
    );
    expect(migration).toContain("cardinality(statements) = 2");
    expect(migration).toContain("set statements = array[");
    expect(topLevelSql).not.toMatch(
      /^\s*(create|alter|drop|grant|revoke)\s+(table|function|event trigger)/im,
    );
    expect(await normalized(MIGRATION_PATH)).toBe(migration);
  });

  it("genera la prueba de ledger, orden, RLS, trigger y rollback", async () => {
    const inputs = await loadInputs();
    const sqlTest = buildSqlTest(inputs);
    expect(sqlTest).toContain(
      "\\ir ../migrations/0278_restore_rls_auto_enable_history.sql",
    );
    expect(sqlTest).toContain("create table public.sdd_0172_rls_probe");
    expect(sqlTest).toContain("and c.relrowsecurity");
    expect(sqlTest).toContain("rollback;");
    expect(await normalized(SQL_TEST_PATH)).toBe(sqlTest);
  });
});
