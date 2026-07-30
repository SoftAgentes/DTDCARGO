export interface PlatformAdminSplitInputs {
  sourceSql: string;
  patched0273Sql: string;
  patchedMd5: string;
  splitStatements: string[];
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const PATCHED_MD5: string;
export const PLATFORM_ADMIN_VERSION: string;
export const PLATFORM_ADMIN_NAME: string;
export const PLATFORM_ADMIN_SPLIT_MD5: string;
export const PLATFORM_ADMIN_TARGET_MD5: string;
export const PLATFORM_ADMIN_SPLIT_FINGERPRINTS: string[];

export function splitPlatformAdminTarget(targetSql: string): string[];
export function buildPatched0273(originalSql: string): string;
export function loadInputs(): Promise<PlatformAdminSplitInputs>;
export function buildMigration(inputs: PlatformAdminSplitInputs): string;
export function buildSqlTest(inputs: PlatformAdminSplitInputs): string;
