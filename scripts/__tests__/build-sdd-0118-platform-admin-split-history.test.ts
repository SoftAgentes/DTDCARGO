import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildMigration,
  buildPatched0273,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  PLATFORM_ADMIN_SPLIT_FINGERPRINTS,
  PLATFORM_ADMIN_SPLIT_MD5,
  SOURCE_MD5,
  SQL_TEST_PATH,
} from "../build-sdd-0118-platform-admin-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0118 platform admin split history", () => {
  it("ancla los diez statements observados en R13", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("22cac3383ef1d3c9a0a814508cc4c817");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(inputs.splitStatements).toHaveLength(10);
    expect(PLATFORM_ADMIN_SPLIT_FINGERPRINTS).toHaveLength(10);
    expect(inputs.patched0273Sql).toContain(PLATFORM_ADMIN_SPLIT_MD5);
    expect(inputs.patched0273Sql).toContain(
      "cardinality(statements) = 10",
    );
  });

  it("falla cerrado si el source de 0273 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0273(
        inputs.sourceSql.replace(
          "6c31b8ac8841b24815e3fb2463eabdd2",
          "drift-observado",
        ),
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_platform_admin_split_patched_0273\$[\s\S]*?\$sdd0118_platform_admin_split_patched_0273\$/g,
      "<patched-0273-as-text>",
    );

    expect(migration).toContain("0282 abortada");
    expect(migration).toContain(PATCHED_MD5);
    expect(executable).toContain(
      "update supabase_migrations.schema_migrations",
    );
    expect(executable).not.toContain("update public.");
    expect(executable).not.toContain("alter table public.");
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
