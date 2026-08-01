import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  patchReplayGatePayload,
  REPAIR_SPLIT_STATES,
  SOURCE_MD5,
  SQL_TEST_PATH,
} from "../build-sdd-0118-replay-gate-finalizer.mjs";

describe("SDD-0118/0172 replay gate finalizer", () => {
  it("ancla los siete splits exactos observados en R20", async () => {
    const inputs = await loadInputs();

    expect(SOURCE_MD5).toBe("edc792b37b75361e1a095a7f71eaff34");
    expect(inputs.gates).toHaveLength(7);
    expect(REPAIR_SPLIT_STATES).toHaveLength(7);
    expect(inputs.patchedSplitStatements.length).toBeGreaterThan(1);
    expect(inputs.patchedSplitMd5).toMatch(/^[0-9a-f]{32}$/);
    for (const state of REPAIR_SPLIT_STATES) {
      expect(inputs.patched0287Sql).toContain(state.splitMd5);
      expect(inputs.patched0287Sql).toContain(
        `cardinality(statements) = ${state.splitCount}`,
      );
    }
  });

  it("falla cerrado si el source de 0287 cambia", async () => {
    const inputs = await loadInputs();
    const gate = inputs.gates[0];

    expect(() =>
      patchReplayGatePayload(
        inputs.sourceSql.replace(
          gate.repairSourceMd5,
          "drift-observado",
        ),
        inputs.gates,
      ),
    ).toThrow(/no se encontró el bloque fuente/);
  });

  it("la migración sólo toca el ledger y reconoce el split terminal", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_replay_finalizer_patched_0287\$[\s\S]*?\$sdd0118_replay_finalizer_patched_0287\$/g,
      "<patched-0287-as-text>",
    );

    expect(migration).toContain("0288 abortada");
    expect(migration).toContain(inputs.patchedSplitMd5);
    expect(executable).toContain(
      "update supabase_migrations.schema_migrations",
    );
    expect(executable).not.toContain("alter table public.");
    expect(executable).not.toContain("revoke delete on table public.");
  });

  it("mantiene sincronizados migración y test transaccional", async () => {
    const inputs = await loadInputs();
    await expect(readFile(MIGRATION_PATH, "utf8")).resolves.toBe(
      buildMigration(inputs),
    );
    await expect(readFile(SQL_TEST_PATH, "utf8")).resolves.toBe(
      buildSqlTest(inputs),
    );
  });
});
