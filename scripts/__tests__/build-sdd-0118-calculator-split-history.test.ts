import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildPatched0274,
  buildSqlTest,
  CALCULATOR_SPLIT_FINGERPRINTS,
  CALCULATOR_SPLIT_MD5,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  SOURCE_MD5,
  SQL_TEST_PATH,
} from "../build-sdd-0118-calculator-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0118 calculator settings split history", () => {
  it("ancla los doce statements observados en R14", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("6ddc823788cbdd6b280810d7ae61a86c");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(inputs.splitStatements).toHaveLength(12);
    expect(CALCULATOR_SPLIT_FINGERPRINTS).toHaveLength(12);
    expect(inputs.patched0274Sql).toContain(CALCULATOR_SPLIT_MD5);
    expect(inputs.patched0274Sql).toContain(
      "cardinality(statements) = 12",
    );
  });

  it("falla cerrado si el source de 0274 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0274(
        inputs.sourceSql.replace(
          "0f7deee22e3a978c52159b6fc211ee2c",
          "drift-observado",
        ),
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_calculator_split_patched_0274\$[\s\S]*?\$sdd0118_calculator_split_patched_0274\$/g,
      "<patched-0274-as-text>",
    );

    expect(migration).toContain("0283 abortada");
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
