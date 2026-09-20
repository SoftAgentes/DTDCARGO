// @vitest-environment node
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
// @ts-expect-error El generador es ESM ejecutable (.mjs); Vitest valida su API runtime.
import * as repairModule from "../build-sdd-0118-repair.mjs";

const {
  buildMigration,
  buildFollowupMigration,
  buildFollowupSqlTest,
  buildSqlTest,
  buildPlatformAdminMigration,
  buildPlatformAdminSqlTest,
  buildCalculatorSettingsMigration,
  buildCalculatorSettingsSqlTest,
  buildPinSearchPathMigration,
  buildPinSearchPathSqlTest,
  buildRevokeAnonSweepMigration,
  buildRevokeAnonSweepSqlTest,
  CALCULATOR_SETTINGS_MIGRATION_PATH,
  CALCULATOR_SETTINGS_SQL_TEST_PATH,
  FOLLOWUP_MIGRATION_PATH,
  FOLLOWUP_SQL_TEST_PATH,
  loadCalculatorSettingsRepair,
  loadPinSearchPathRepair,
  loadRevokeAnonSweepRepair,
  loadFollowups,
  loadPlatformAdminRepair,
  loadRepairs,
  MIGRATION_PATH,
  PLATFORM_ADMIN_MIGRATION_PATH,
  PLATFORM_ADMIN_SQL_TEST_PATH,
  PIN_SEARCH_PATH_MIGRATION_PATH,
  PIN_SEARCH_PATH_SQL_TEST_PATH,
  REVOKE_ANON_SWEEP_MIGRATION_PATH,
  REVOKE_ANON_SWEEP_SQL_TEST_PATH,
  REPAIRS,
  SQL_TEST_PATH,
} = repairModule;

async function readNormalized(path: string): Promise<string> {
  return (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
}

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
    await expect(readNormalized(MIGRATION_PATH)).resolves.toBe(
      buildMigration(repairs),
    );
    await expect(readNormalized(SQL_TEST_PATH)).resolves.toBe(
      buildSqlTest(repairs),
    );
  });

  it("convierte los dos fixes de invitación supersedidos en no-op", async () => {
    const repairs = await loadRepairs();
    const followups = loadFollowups(repairs);

    expect(followups).toHaveLength(2);
    expect(followups.map((followup: { version: string }) => followup.version))
      .toEqual(["20260528060007", "20260528060008"]);
    await expect(readNormalized(FOLLOWUP_MIGRATION_PATH)).resolves.toBe(
      buildFollowupMigration(followups),
    );
    await expect(readNormalized(FOLLOWUP_SQL_TEST_PATH)).resolves.toBe(
      buildFollowupSqlTest(followups),
    );
  });

  it("retira sólo el bootstrap fijo del payload platform_admins", async () => {
    const repair = await loadPlatformAdminRepair();

    expect(repair.version).toBe("20260529071707");
    expect(repair.name).toBe("platform_admins");
    expect(repair.remoteMd5).toBe("6c31b8ac8841b24815e3fb2463eabdd2");
    expect(repair.targetMd5).toBe("cb374d4ad4c3b2bb62915e80a5a13793");
    expect(repair.targetSql).toContain(
      "create table if not exists public.platform_admins",
    );
    expect(repair.targetSql).toContain(
      "create or replace function public.is_platform_admin()",
    );
    expect(repair.targetSql).not.toContain(
      "insert into public.platform_admins",
    );
    expect(repair.targetSql).not.toContain(
      "83c98d22-ea54-4d7a-b10f-a23098a2edbe",
    );
  });

  it("mantiene sincronizado y fail-closed el gate 0273", async () => {
    const repair = await loadPlatformAdminRepair();
    const migration = buildPlatformAdminMigration(repair);
    const executableSql = migration.replace(
      /\$sdd0118_platform_admin_target\$[\s\S]*?\$sdd0118_platform_admin_target\$/g,
      "<replay-safe-sql-as-text>",
    );

    expect(migration).toContain("SDD-0118 platform_admins: drift");
    expect(migration).toContain(repair.remoteMd5);
    expect(migration).toContain(repair.targetMd5);
    expect(executableSql).not.toContain(
      "insert into public.platform_admins",
    );
    await expect(
      readNormalized(PLATFORM_ADMIN_MIGRATION_PATH),
    ).resolves.toBe(buildPlatformAdminMigration(repair));
    await expect(
      readNormalized(PLATFORM_ADMIN_SQL_TEST_PATH),
    ).resolves.toBe(buildPlatformAdminSqlTest(repair));
  });

  it("restaura el payload canónico de calculator_settings", async () => {
    const repair = await loadCalculatorSettingsRepair();

    expect(repair.version).toBe("20260604131310");
    expect(repair.name).toBe("0103_calculator_settings");
    expect(repair.targetMd5).toBe("0f7deee22e3a978c52159b6fc211ee2c");
    expect(repair.targetSql).toContain(
      "create table if not exists public.calculator_settings",
    );
    expect(repair.targetSql).toContain(
      "create or replace function public.public_calculator_config()",
    );
    expect(repair.targetSql).toContain(
      "revoke all on function public.public_calculator_config() from public",
    );
  });

  it("mantiene sincronizado y fail-closed el gate 0274", async () => {
    const repair = await loadCalculatorSettingsRepair();
    const migration = buildCalculatorSettingsMigration(repair);
    const executableSql = migration.replace(
      /\$sdd0118_calculator_settings_target\$[\s\S]*?\$sdd0118_calculator_settings_target\$/g,
      "<calculator-settings-sql-as-text>",
    );

    expect(migration).toContain("statements is null");
    expect(migration).toContain("SDD-0118 calculator_settings: drift");
    expect(migration).toContain(repair.targetMd5);
    expect(executableSql).not.toContain(
      "create table if not exists public.calculator_settings",
    );
    expect(executableSql).not.toContain(
      "insert into public.calculator_settings",
    );
    await expect(
      readNormalized(CALCULATOR_SETTINGS_MIGRATION_PATH),
    ).resolves.toBe(buildCalculatorSettingsMigration(repair));
    await expect(
      readNormalized(CALCULATOR_SETTINGS_SQL_TEST_PATH),
    ).resolves.toBe(buildCalculatorSettingsSqlTest(repair));
  });

  it("restaura las 33 firmas canónicas de pin search_path", async () => {
    const repair = await loadPinSearchPathRepair();

    expect(repair.version).toBe("20260703235255");
    expect(repair.name).toBe("0210_pin_search_path_triggers");
    expect(repair.targetMd5).toBe("c3131d8ea3756049d6455bc98b4d0ecc");
    expect(repair.targets).toHaveLength(33);
    expect(
      repair.targets.map((target: { identity: string }) => target.identity),
    ).toContain("public.comments_freeze_immutable()");
    expect(
      repair.targets.map((target: { identity: string }) => target.identity),
    ).toContain("public.comments_validate_entity()");
    expect(
      repair.targets.map((target: { identity: string }) => target.identity),
    ).toContain("public.validate_operario_pin_format(p_pin text)");
    expect(
      repair.targets.map(
        (target: { regprocedure: string }) => target.regprocedure,
      ),
    ).toContain("public.validate_operario_pin_format(text)");
  });

  it("mantiene sincronizado y fail-closed el gate 0275", async () => {
    const repair = await loadPinSearchPathRepair();
    const migration = buildPinSearchPathMigration(repair);
    const executableSql = migration.replace(
      /\$sdd0118_pin_search_path_target\$[\s\S]*?\$sdd0118_pin_search_path_target\$/g,
      "<pin-search-path-sql-as-text>",
    );

    expect(migration).toContain("statements is null");
    expect(migration).toContain("SDD-0118 pin_search_path: drift");
    expect(migration).toContain(repair.targetMd5);
    expect(executableSql).not.toContain(
      "alter function public.comments_freeze_immutable()",
    );
    expect(executableSql).not.toContain(
      "alter function public.comments_validate_entity()",
    );
    await expect(
      readNormalized(PIN_SEARCH_PATH_MIGRATION_PATH),
    ).resolves.toBe(buildPinSearchPathMigration(repair));
    await expect(
      readNormalized(PIN_SEARCH_PATH_SQL_TEST_PATH),
    ).resolves.toBe(buildPinSearchPathSqlTest(repair));
  });

  it("restaura los 48 pares ACL canónicos del sweep anon", async () => {
    const repair = await loadRevokeAnonSweepRepair();

    expect(repair.version).toBe("20260703234254");
    expect(repair.name).toBe("0209_revoke_anon_rpc_sweep");
    expect(repair.targetMd5).toBe("c6c722efdb7ff79ef037e0d826739205");
    expect(repair.targets).toHaveLength(48);
    expect(
      repair.targets.map((target: { identity: string }) => target.identity),
    ).toContain("public.comment_mentions_validate()");
    expect(
      repair.targets.map((target: { identity: string }) => target.identity),
    ).not.toContain("public.public_track_shipment(text)");
  });

  it("mantiene sincronizado y fail-closed el gate 0276", async () => {
    const repair = await loadRevokeAnonSweepRepair();
    const migration = buildRevokeAnonSweepMigration(repair);
    const executableSql = migration.replace(
      /\$sdd0118_revoke_anon_target\$[\s\S]*?\$sdd0118_revoke_anon_target\$/g,
      "<revoke-anon-sql-as-text>",
    );

    expect(migration).toContain("statements is null");
    expect(migration).toContain("SDD-0118 revoke_anon: drift");
    expect(migration).toContain(repair.targetMd5);
    expect(executableSql).not.toContain(
      "revoke execute on function public.comment_mentions_validate()",
    );
    await expect(
      readNormalized(REVOKE_ANON_SWEEP_MIGRATION_PATH),
    ).resolves.toBe(buildRevokeAnonSweepMigration(repair));
    await expect(
      readNormalized(REVOKE_ANON_SWEEP_SQL_TEST_PATH),
    ).resolves.toBe(buildRevokeAnonSweepSqlTest(repair));
  });
});
