import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
// @ts-expect-error El generador es ESM ejecutable (.mjs); Vitest valida su API runtime.
import * as repairModule from "../build-sdd-0118-repair.mjs";

const {
  buildMigration,
  buildFollowupMigration,
  buildFollowupSqlTest,
  buildSqlTest,
  FOLLOWUP_MIGRATION_PATH,
  FOLLOWUP_SQL_TEST_PATH,
  loadFollowups,
  loadRepairs,
  MIGRATION_PATH,
  REPAIRS,
  SQL_TEST_PATH,
} = repairModule;

describe("SDD-0118 branch replay repair", () => {
  it("cubre los dos prerequisitos adelantados y nueve placeholders post-hoc", () => {
    expect(REPAIRS).toHaveLength(11);
    expect(REPAIRS.filter((repair: { mode: string }) => repair.mode === "prepend"))
      .toHaveLength(2);
    expect(REPAIRS.flatMap((repair: { sources: string[] }) => repair.sources))
      .toContain("0018_mailing.sql");
    expect(REPAIRS.flatMap((repair: { sources: string[] }) => repair.sources))
      .toContain("0024_dispatch_core.sql");
  });

  it("verifica los digests remotos y genera una reparación fail-closed", async () => {
    const repairs = await loadRepairs();
    const migration = buildMigration(repairs);
    const executableSql = migration.replace(
      /\$(sdd0118_\d+_\d+)\$[\s\S]*?\$\1\$/g,
      "<historical-sql-as-text>",
    );

    expect(migration).toContain("SDD-0118 preflight: drift");
    expect(migration).toContain("update supabase_migrations.schema_migrations");
    expect(executableSql).not.toContain("update public.");
    expect(executableSql).not.toContain("alter table public.");
  });

  it("mantiene sincronizados la migración y su prueba transaccional", async () => {
    const repairs = await loadRepairs();
    await expect(readFile(MIGRATION_PATH, "utf8")).resolves.toBe(
      buildMigration(repairs),
    );
    await expect(readFile(SQL_TEST_PATH, "utf8")).resolves.toBe(
      buildSqlTest(repairs),
    );
  });

  it("convierte los dos fixes de invitación supersedidos en no-op", async () => {
    const repairs = await loadRepairs();
    const followups = loadFollowups(repairs);

    expect(followups).toHaveLength(2);
    expect(followups.map((followup: { version: string }) => followup.version))
      .toEqual(["20260528060007", "20260528060008"]);
    await expect(readFile(FOLLOWUP_MIGRATION_PATH, "utf8")).resolves.toBe(
      buildFollowupMigration(followups),
    );
    await expect(readFile(FOLLOWUP_SQL_TEST_PATH, "utf8")).resolves.toBe(
      buildFollowupSqlTest(followups),
    );
  });
});
