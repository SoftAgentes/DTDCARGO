export interface TenantAclHistoryInputs {
  tenantLifecycleSql: string;
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const SOURCE_MD5: string;
export const ACL_REVOKE_SQL: string;
export const ACL_REVOKE_MD5: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;

export function loadInputs(): Promise<TenantAclHistoryInputs>;
export function buildMigration(inputs: TenantAclHistoryInputs): string;
export function buildSqlTest(inputs: TenantAclHistoryInputs): string;
