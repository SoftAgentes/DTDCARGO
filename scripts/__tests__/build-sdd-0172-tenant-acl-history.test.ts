// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ACL_REVOKE_MD5,
  ACL_REVOKE_SQL,
  MIGRATION_PATH,
  SOURCE_MD5,
  SQL_TEST_PATH,
  buildMigration,
  buildSqlTest,
  loadInputs,
} from "../build-sdd-0172-tenant-acl-history.mjs";

function normalized(path: string) {
  return readFile(path, "utf8").then((value) => value.replace(/\r\n/g, "\n"));
}

describe("SDD-0172 · historial reproducible del ACL tenant", () => {
  it("ancla el payload exacto de 0268 y el REVOKE mínimo", async () => {
    const inputs = await loadInputs();
    expect(inputs.tenantLifecycleSql).toContain(
      "0268 abortado: un rol cliente puede borrar tenants",
    );
    expect(SOURCE_MD5).toBe("127a11d4eac9106d621a537b1886c6c3");
    expect(ACL_REVOKE_SQL).toBe(
      "revoke delete on table public.tenants from public, anon, authenticated;",
    );
    expect(ACL_REVOKE_MD5).toBe("6f6ddc2074c8f8c527fa6150ff8616c5");
  });

  it("genera una reparación sólo-ledger exacta e idempotente", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const topLevelSql = migration.replace(
      /\$sdd0172_tenant_acl_revoke\$[\s\S]*?\$sdd0172_tenant_acl_revoke\$/g,
      "''",
    );
    expect(migration).toContain("cardinality(statements) = 2");
    expect(migration).toContain("set statements = array[");
    expect(topLevelSql).not.toMatch(
      /^\s*(create|alter|drop|grant|revoke)\s+(table|function|event trigger)/im,
    );
    expect(await normalized(MIGRATION_PATH)).toBe(migration);
  });

  it("genera la prueba de reproducción R9, replay y rollback", async () => {
    const inputs = await loadInputs();
    const sqlTest = buildSqlTest(inputs);
    expect(sqlTest).toContain(
      "grant delete on table public.tenants to public, anon, authenticated",
    );
    expect(sqlTest).toContain(
      "\\ir ../migrations/0279_restore_tenant_lifecycle_acl_history.sql",
    );
    expect(sqlTest).toContain("select statements[2]");
    expect(sqlTest).toContain("confdeltype = 'r'");
    expect(sqlTest).toContain("rollback;");
    expect(await normalized(SQL_TEST_PATH)).toBe(sqlTest);
  });
});
