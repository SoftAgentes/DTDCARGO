import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildMigration,
  buildPatched0272,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  PATCHED_MD5,
  SOURCE_MD5,
  SPLIT_FIXES,
  SQL_TEST_PATH,
} from "../build-sdd-0118-invite-skip-split-history.mjs";

async function readGenerated(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("SDD-0118 invite skip split history", () => {
  it("parchea sólo los dos estados fragmentados observados en R12", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("887cc625c50ba8f6a2292bad25989fc5");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(SPLIT_FIXES).toHaveLength(2);

    for (const fix of SPLIT_FIXES) {
      expect(inputs.patched0272Sql).toContain(fix.splitMd5);
      expect(inputs.patched0272Sql).toContain(
        `in ('${fix.canonicalMd5}', '${fix.splitMd5}')`,
      );
      expect(inputs.patched0272Sql).toContain(fix.targetMd5);
    }
  });

  it("falla cerrado si el source de 0272 no coincide exactamente", async () => {
    const inputs = await loadInputs();
    expect(() =>
      buildPatched0272(
        inputs.sourceSql.replace(
          SPLIT_FIXES[0].canonicalMd5,
          "drift-observado",
        ),
      ),
    ).toThrow(/no aparece exactamente una vez/);
  });

  it("la migración sólo toca el ledger y acepta reejecución", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_invite_skip_split_patched_0272\$[\s\S]*?\$sdd0118_invite_skip_split_patched_0272\$/g,
      "<patched-0272-as-text>",
    );

    expect(migration).toContain("0281 abortada");
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
