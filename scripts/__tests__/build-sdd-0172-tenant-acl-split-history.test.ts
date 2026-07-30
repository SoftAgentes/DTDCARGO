import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildPatched0279,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  SOURCE_MD5,
  SQL_TEST_PATH,
  TENANT_SPLIT_COUNT,
  TENANT_SPLIT_FINGERPRINTS,
  TENANT_SPLIT_MD5,
} from "../build-sdd-0172-tenant-acl-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0172 tenant ACL split history", () => {
  it("ancla los diez statements observados en R17", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("5251a9ca8ccbf579c5b81688e63acb01");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(inputs.splitStatements).toHaveLength(TENANT_SPLIT_COUNT);
    expect(TENANT_SPLIT_FINGERPRINTS).toHaveLength(TENANT_SPLIT_COUNT);
    expect(inputs.patched0279Sql).toContain(TENANT_SPLIT_MD5);
    expect(inputs.patched0279Sql).toContain(
      `cardinality(statements) = ${TENANT_SPLIT_COUNT}`,
    );
  });

  it("falla cerrado si el source de 0279 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0279(
        inputs.sourceSql.replace(
          "6f6ddc2074c8f8c527fa6150ff8616c5",
          "drift-observado",
        ),
        inputs.tenantLifecycleSql,
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0172_tenant_split_patched_0279\$[\s\S]*?\$sdd0172_tenant_split_patched_0279\$/g,
      "<patched-0279-as-text>",
    );

    expect(migration).toContain("0286 abortada");
    expect(migration).toContain(PATCHED_MD5);
    expect(executable).toContain(
      "update supabase_migrations.schema_migrations",
    );
    expect(executable).not.toContain("alter table public.");
    expect(executable).not.toContain("revoke delete on table public.tenants");
  });

  it("mantiene sincronizados migración y test transaccional", async () => {
    const inputs = await loadInputs();
    await expect(readGenerated(MIGRATION_PATH)).resolves.toBe(
      buildMigration(inputs),
    );
    await expect(readGenerated(SQL_TEST_PATH)).resolves.toBe(
      buildSqlTest(inputs),
    );
  });
});
