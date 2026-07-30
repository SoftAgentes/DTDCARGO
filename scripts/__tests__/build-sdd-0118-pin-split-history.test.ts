import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildPatched0275,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  PIN_SPLIT_FINGERPRINTS,
  PIN_SPLIT_MD5,
  SOURCE_MD5,
  SQL_TEST_PATH,
} from "../build-sdd-0118-pin-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0118 pin search_path split history", () => {
  it("ancla los 33 statements observados en R15", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("a217fa825ff964f2c2a4cb26d31c3dbc");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(inputs.splitStatements).toHaveLength(33);
    expect(PIN_SPLIT_FINGERPRINTS).toHaveLength(33);
    expect(inputs.patched0275Sql).toContain(PIN_SPLIT_MD5);
    expect(inputs.patched0275Sql).toContain("cardinality(statements) = 33");
  });

  it("falla cerrado si el source de 0275 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0275(
        inputs.sourceSql.replace(
          "c3131d8ea3756049d6455bc98b4d0ecc",
          "drift-observado",
        ),
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_pin_split_patched_0275\$[\s\S]*?\$sdd0118_pin_split_patched_0275\$/g,
      "<patched-0275-as-text>",
    );

    expect(migration).toContain("0284 abortada");
    expect(migration).toContain(PATCHED_MD5);
    expect(executable).toContain(
      "update supabase_migrations.schema_migrations",
    );
    expect(executable).not.toContain("update public.");
    expect(executable).not.toContain("alter function public.");
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
