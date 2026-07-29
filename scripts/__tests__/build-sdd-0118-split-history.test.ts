import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  MIGRATION_PATH,
  PATCHED_MD5,
  SOURCE_MD5,
  SPLIT_STATES,
  SQL_TEST_PATH,
  buildMigration,
  buildSqlTest,
  loadInputs,
} from "../build-sdd-0118-split-history.mjs";

function normalized(path: string) {
  return readFile(path, "utf8").then((value) => value.replace(/\r\n/g, "\n"));
}

describe("SDD-0118 · historial fragmentado de 0271", () => {
  it("ancla el payload original y los once fingerprints observados en R11", async () => {
    const inputs = await loadInputs();
    expect(SOURCE_MD5).toBe("0839e50eeb47a158382fc2f6c27d5fe9");
    expect(inputs.patchedMd5).toBe(PATCHED_MD5);
    expect(SPLIT_STATES).toHaveLength(11);
    expect(SPLIT_STATES[0]).toEqual({
      version: "20260526213130",
      name: "seed_team_invitation_template",
      cardinality: 63,
      joinedMd5: "b9da059306c4a80875e54947b9338252",
    });
  });

  it("parchea preflight y postflight sin relajar los fingerprints", async () => {
    const inputs = await loadInputs();
    for (const split of SPLIT_STATES) {
      expect(inputs.patched0271Sql).toContain(
        `cardinality(statements) = ${split.cardinality}`,
      );
      expect(inputs.patched0271Sql).toContain(split.joinedMd5);
    }
    expect(inputs.patched0271Sql).toContain(
      "0280 acepta además la fragmentación exacta observada",
    );
  });

  it("genera una migración sólo-ledger exacta e idempotente", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const topLevelSql = migration.replace(
      /\$sdd0118_split_patched_0271\$[\s\S]*?\$sdd0118_split_patched_0271\$/g,
      "''",
    );
    expect(migration).toContain("set statements = array[");
    expect(migration).toContain("ledger 0271 ausente, ambiguo o con drift");
    expect(topLevelSql).not.toMatch(
      /^\s*(create|alter|drop|grant|revoke)\s+(table|function|event trigger)/im,
    );
    expect(await normalized(MIGRATION_PATH)).toBe(migration);
  });

  it("genera prueba transaccional, doble aplicación y rollback", async () => {
    const inputs = await loadInputs();
    const sqlTest = buildSqlTest(inputs);
    expect(sqlTest.match(/0280_repair_sdd0118_split_history\.sql/g)).toHaveLength(
      2,
    );
    expect(sqlTest).toContain("md5(statements[1])");
    expect(sqlTest).toContain("rollback;");
    expect(await normalized(SQL_TEST_PATH)).toBe(sqlTest);
  });
});
