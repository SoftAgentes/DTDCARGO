export interface ReplayGateInput {
  moduleFile: string;
  repairFile: string;
  repairVersion: string;
  repairName: string;
  repairSourceMd5: string;
  repairSourceLength: number;
  targetSplitCount: number;
  targetSplitMd5: string;
  targetVersion: string;
  targetName: string;
  targetSourceMd5: string;
  targetPatchedMd5: string;
  targetPatchedSql: string;
  targetSplitStatements: string[];
  repairSourceSql: string;
  repairPatchedSql: string;
  repairPatchedMd5: string;
}

export interface ReplayGateInputs {
  gates: ReplayGateInput[];
}

export const MIGRATION_PATH: string;
export const SQL_TEST_PATH: string;
export const REPLAY_GATES: Array<{
  moduleFile: string;
  repairFile: string;
  repairVersion: string;
  repairName: string;
  repairSourceMd5: string;
  repairSourceLength: number;
  targetSplitCount: number;
  targetSplitMd5: string;
}>;

export function splitSqlStatements(sql: string): string[];
export function patchReplayGate(
  sourceSql: string,
  gate: ReplayGateInput,
): string;
export function loadInputs(): Promise<ReplayGateInputs>;
export function buildMigration(inputs: ReplayGateInputs): string;
export function buildSqlTest(inputs: ReplayGateInputs): string;
