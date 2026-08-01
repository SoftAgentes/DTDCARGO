export interface InviteSkipSplitFix {
  version: string;
  name: string;
  canonicalMd5: string;
  splitMd5: string;
  targetMd5: string;
}

export interface InviteSkipSplitInputs {
  sourceSql: string;
  patched0272Sql: string;
  patchedMd5: string;
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const SPLIT_FIXES: InviteSkipSplitFix[];

export function buildPatched0272(originalSql: string): string;
export function loadInputs(): Promise<InviteSkipSplitInputs>;
export function buildMigration(inputs: InviteSkipSplitInputs): string;
export function buildSqlTest(inputs: InviteSkipSplitInputs): string;
