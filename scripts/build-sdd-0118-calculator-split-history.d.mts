export interface CalculatorRepair {
  version: string;
  name: string;
  targetSql: string;
  targetMd5: string;
}

export interface CalculatorSplitInputs {
  sourceSql: string;
  patched0274Sql: string;
  patchedMd5: string;
  repair: CalculatorRepair;
  splitStatements: string[];
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const CALCULATOR_VERSION: string;
export const CALCULATOR_NAME: string;
export const CALCULATOR_SPLIT_MD5: string;
export const CALCULATOR_TARGET_MD5: string;
export const CALCULATOR_SPLIT_FINGERPRINTS: string[];

export function splitCalculatorTarget(targetSql: string): string[];
export function buildPatched0274(originalSql: string): string;
export function loadInputs(): Promise<CalculatorSplitInputs>;
export function buildMigration(inputs: CalculatorSplitInputs): string;
export function buildSqlTest(inputs: CalculatorSplitInputs): string;
