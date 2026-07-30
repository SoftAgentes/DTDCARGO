export interface TenantAclSplitInputs {
  sourceSql: string;
  tenantLifecycleSql: string;
  patched0279Sql: string;
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
export const TENANT_VERSION: string;
export const TENANT_NAME: string;
export const TENANT_SPLIT_COUNT: number;
export const TENANT_SPLIT_MD5: string;
export const TENANT_SPLIT_FINGERPRINTS: string[];

export function splitTenantTarget(tenantLifecycleSql: string): string[];
export function buildPatched0279(
  originalSql: string,
  tenantLifecycleSql: string,
): string;
export function loadInputs(): Promise<TenantAclSplitInputs>;
export function buildMigration(inputs: TenantAclSplitInputs): string;
export function buildSqlTest(inputs: TenantAclSplitInputs): string;
