import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  buildMigration,
  buildSqlTest,
  loadInputs,
  MIGRATION_PATH,
  patchReplayGate,
  REPLAY_GATES,
  SQL_TEST_PATH,
} from "../build-sdd-0118-replay-gates-split-history.mjs";

describe("SDD-0118/0172 replay gate split history", () => {
  it("ancla los siete splits exactos observados en R18", async () => {
    const inputs = await loadInputs();

    expect(inputs.gates).toHaveLength(7);
    expect(REPLAY_GATES).toHaveLength(7);
    for (const gate of inputs.gates) {
      expect(gate.targetSplitStatements).toHaveLength(gate.targetSplitCount);
      expect(gate.repairPatchedSql).toContain(gate.targetSplitMd5);
      expect(gate.repairPatchedSql).toContain(
        `cardinality(statements) = ${gate.targetSplitCount}`,
      );
      expect(gate.repairPatchedMd5).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("falla cerrado si un gate fuente cambia", async () => {
    const inputs = await loadInputs();
    const gate = inputs.gates[0];

    expect(() =>
      patchReplayGate(
        gate.repairSourceSql.replace(
          gate.targetSourceMd5,
          "drift-observado",
        ),
        gate,
      ),
    ).toThrow(/no se encontró el bloque fuente/);
  });

  it("la migración sólo toca el ledger", async () => {
    const inputs = await loadInputs();
    const migration = buildMigration(inputs);
    const executable = migration.replace(
      /\$sdd0118_replay_gate_\d+\$[\s\S]*?\$sdd0118_replay_gate_\d+\$/g,
      "<repair-payload-as-text>",
    );

    expect(migration).toContain("0287 abortada");
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
