import type { ReplayGateInput } from "./build-sdd-0118-replay-gates-split-history.mjs";

export interface ReplayFinalizerInputs {
  gates: ReplayGateInput[];
  sourceSql: string;
  patched0287Sql: string;
  patchedMd5: string;
  patchedSplitStatements: string[];
  patchedSplitMd5: string;
}

export const SOURCE_PATH: string;
export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const TARGET_VERSION: string;
export const TARGET_NAME: string;
export const SOURCE_MD5: string;
export const SOURCE_LENGTH: number;
export const REPAIR_SPLIT_STATES: Array<{
  repairName: string;
  splitCount: number;
  splitMd5: string;
}>;

export function patchReplayGatePayload(
  sourceSql: string,
  gates: ReplayGateInput[],
): string;
export function loadInputs(): Promise<ReplayFinalizerInputs>;
export function buildMigration(inputs: ReplayFinalizerInputs): string;
export function buildSqlTest(inputs: ReplayFinalizerInputs): string;
