import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildPatched0276,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  SOURCE_MD5,
  SPLIT_EDGE_FINGERPRINTS,
  SQL_TEST_PATH,
  SWEEP_SPLIT_COUNT,
  SWEEP_SPLIT_MD5,
} from "../build-sdd-0118-revoke-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0118 revoke anon split history", () => {
  it("ancla los 101 statements observados en R16", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("784f95726bd9c6f21963722f1ce7e61d");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(inputs.splitStatements).toHaveLength(SWEEP_SPLIT_COUNT);
    expect(SPLIT_EDGE_FINGERPRINTS).toHaveLength(8);
    expect(inputs.patched0276Sql).toContain(SWEEP_SPLIT_MD5);
    expect(inputs.patched0276Sql).toContain(
      `cardinality(statements) = ${SWEEP_SPLIT_COUNT}`,
    );
  });

  it("falla cerrado si el source de 0276 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0276(
        inputs.sourceSql.replace(
          "c6c722efdb7ff79ef037e0d826739205",
          "drift-observado",
        ),
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_revoke_split_patched_0276\$[\s\S]*?\$sdd0118_revoke_split_patched_0276\$/g,
      "<patched-0276-as-text>",
    );

    expect(migration).toContain("0285 abortada");
    expect(migration).toContain(PATCHED_MD5);
    expect(executable).toContain(
      "update supabase_migrations.schema_migrations",
    );
    expect(executable).not.toContain("update public.");
    expect(executable).not.toContain("revoke execute on function public.");
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
