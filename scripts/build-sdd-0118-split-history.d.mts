export interface RepairSource {
  file: string;
  sql: string;
  md5: string;
  tag: string;
}

export interface Repair {
  version: string;
  name: string;
  expectedOldMd5: string;
  oldStatement: string;
  mode: "prepend" | "replace";
  sources: RepairSource[];
}

export interface SplitState {
  version: string;
  name: string;
  cardinality: number;
  joinedMd5: string;
}

export interface SplitHistoryInputs {
  sourceSql: string;
  patched0271Sql: string;
  patchedMd5: string;
  repairs: Repair[];
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const SPLIT_STATES: SplitState[];

export function buildPatched0271(
  originalSql: string,
  repairs: Repair[],
): string;
export function loadInputs(): Promise<SplitHistoryInputs>;
export function buildMigration(inputs: SplitHistoryInputs): string;
export function buildSqlTest(inputs: SplitHistoryInputs): string;
