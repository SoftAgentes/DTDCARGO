export interface RevokeSplitInputs {
  sourceSql: string;
  patched0276Sql: string;
  patchedMd5: string;
  repair: {
    version: string;
    name: string;
    targetSql: string;
    targetMd5: string;
    targets: Array<{
      name: string;
      argumentsSql: string;
      identity: string;
      regprocedure: string;
    }>;
  };
  splitStatements: string[];
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const SWEEP_VERSION: string;
export const SWEEP_NAME: string;
export const SWEEP_SPLIT_COUNT: number;
export const SWEEP_SPLIT_MD5: string;
export const SWEEP_TARGET_MD5: string;
export const SPLIT_EDGE_FINGERPRINTS: string[];

export function splitReplayTarget(
  bootstrapSql: string,
  sweepSql: string,
): string[];
export function buildPatched0276(originalSql: string): string;
export function loadInputs(): Promise<RevokeSplitInputs>;
export function buildMigration(inputs: RevokeSplitInputs): string;
export function buildSqlTest(inputs: RevokeSplitInputs): string;
