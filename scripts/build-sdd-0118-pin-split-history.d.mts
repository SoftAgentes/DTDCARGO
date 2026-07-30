export interface PinRepair {
  version: string;
  name: string;
  targetSql: string;
  targetMd5: string;
  targets: Array<{
    statement: string;
    name: string;
    argumentsSql: string;
    identity: string;
    regprocedure: string;
  }>;
}

export interface PinSplitInputs {
  sourceSql: string;
  patched0275Sql: string;
  patchedMd5: string;
  repair: PinRepair;
  splitStatements: string[];
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const PIN_VERSION: string;
export const PIN_NAME: string;
export const PIN_SPLIT_MD5: string;
export const PIN_TARGET_MD5: string;
export const PIN_SPLIT_FINGERPRINTS: string[];

export function splitPinTarget(targetSql: string): string[];
export function buildPatched0275(originalSql: string): string;
export function loadInputs(): Promise<PinSplitInputs>;
export function buildMigration(inputs: PinSplitInputs): string;
export function buildSqlTest(inputs: PinSplitInputs): string;
