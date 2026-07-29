export interface RlsHistoryInputs {
  bootstrapSql: string;
  sweepSql: string;
}

export const BOOTSTRAP_PATH: string;
export const SWEEP_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;

export const BOOTSTRAP_MD5: string;
export const SWEEP_MD5: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;

export function loadInputs(): Promise<RlsHistoryInputs>;
export function buildMigration(inputs: RlsHistoryInputs): string;
export function buildSqlTest(inputs: RlsHistoryInputs): string;
