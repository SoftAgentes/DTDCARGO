export interface AttachmentsPilotState {
  enabled: boolean;
  reason:
    | "enabled"
    | "flag_off"
    | "production_not_confirmed"
    | "backup_not_configured"
    | "antivirus_not_verified"
    | "contract_not_verified"
    | "pipl_not_verified"
    | "object_lock_not_verified"
    | "restore_not_verified";
}

function hasValue(env: Record<string, string | undefined>, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function hasRecentTimestamp(
  env: Record<string, string | undefined>,
  key: string,
  now: Date,
  maxAgeMs: number,
): boolean {
  const value = env[key]?.trim();
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  const nowMs = now.getTime();
  return Number.isFinite(timestamp) && Number.isFinite(nowMs)
    && timestamp <= nowMs + 5 * 60 * 1_000
    && nowMs - timestamp <= maxAgeMs;
}

export function attachmentsPilotState(
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): AttachmentsPilotState {
  if (env.DTD_ATTACHMENTS_GASTOS_PILOT !== "1") {
    return { enabled: false, reason: "flag_off" };
  }
  if (env.NODE_ENV === "production" && env.DTD_ATTACHMENTS_PRODUCTION_CONFIRMED !== "1") {
    return { enabled: false, reason: "production_not_confirmed" };
  }
  const backupReady = [
    "DTD_ATTACHMENTS_BACKUP_ENDPOINT",
    "DTD_ATTACHMENTS_BACKUP_REGION",
    "DTD_ATTACHMENTS_BACKUP_BUCKET",
  ].every((key) => hasValue(env, key));
  const backupProvider = env.DTD_ATTACHMENTS_BACKUP_PROVIDER?.trim().toLowerCase()
    || (env.DTD_ATTACHMENTS_BACKUP_ENDPOINT?.includes(".r2.cloudflarestorage.com")
      ? "cloudflare-r2" : "aws-s3-object-lock");
  const authMode = env.DTD_ATTACHMENTS_AWS_AUTH_MODE ?? "static";
  const credentialReady = authMode === "default-chain" || (authMode === "static" && [
    "DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID",
    "DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY",
  ].every((key) => hasValue(env, key)));
  const r2Ready = backupProvider !== "cloudflare-r2" || (
    authMode === "static"
    && env.DTD_ATTACHMENTS_BACKUP_REGION === "auto"
    && hasValue(env, "DTD_ATTACHMENTS_R2_LOCK_RULE_NAME")
    && Number(env.DTD_ATTACHMENTS_R2_LOCK_DAYS) >= 3654
  );
  if (env.NODE_ENV === "production" && (!backupReady || !credentialReady || !r2Ready)) {
    return { enabled: false, reason: "backup_not_configured" };
  }
  if (env.NODE_ENV === "production") {
    const provider = env.DTD_ATTACHMENTS_AV_PROVIDER?.trim().toLowerCase();
    const antivirusReady = provider === "aws-guardduty-s3"
      ? [
        "DTD_ATTACHMENTS_AWS_ACCOUNT_ID",
        "DTD_ATTACHMENTS_SCAN_REGION",
        "DTD_ATTACHMENTS_SCAN_BUCKET",
        "DTD_ATTACHMENTS_SCAN_QUEUE_URL",
        "DTD_ATTACHMENTS_SCAN_KMS_KEY_ID",
      ].every((key) => hasValue(env, key))
        && hasRecentTimestamp(env, "DTD_ATTACHMENTS_GUARDDUTY_PLAN_VERIFIED_AT", now, 24 * 60 * 60 * 1_000)
        && hasRecentTimestamp(env, "DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT", now, 24 * 60 * 60 * 1_000)
      : provider === "scanner-managed"
        && ["DTD_ATTACHMENTS_AV_URL", "DTD_ATTACHMENTS_AV_TOKEN"].every((key) => hasValue(env, key))
        && hasRecentTimestamp(env, "DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT", now, 24 * 60 * 60 * 1_000)
        && hasRecentTimestamp(env, "DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT", now, 24 * 60 * 60 * 1_000);
    if (!antivirusReady) {
      return { enabled: false, reason: "antivirus_not_verified" };
    }
    if (!hasRecentTimestamp(env, "DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT", now, 93 * 24 * 60 * 60 * 1_000)) {
      return { enabled: false, reason: "object_lock_not_verified" };
    }
    if (!hasRecentTimestamp(env, "DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT", now, 93 * 24 * 60 * 60 * 1_000)) {
      return { enabled: false, reason: "restore_not_verified" };
    }
    const contractEvidence = backupProvider === "cloudflare-r2"
      ? "DTD_ATTACHMENTS_CLOUDFLARE_CONTRACT_VERIFIED_AT"
      : "DTD_ATTACHMENTS_AWS_CONTRACT_VERIFIED_AT";
    if (!hasRecentTimestamp(env, contractEvidence, now, 366 * 24 * 60 * 60 * 1_000)) {
      return { enabled: false, reason: "contract_not_verified" };
    }
    if (!hasRecentTimestamp(env, "DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT", now, 366 * 24 * 60 * 60 * 1_000)) {
      return { enabled: false, reason: "pipl_not_verified" };
    }
  }
  return { enabled: true, reason: "enabled" };
}

export function requireAttachmentsPilot(): void {
  const state = attachmentsPilotState();
  if (!state.enabled) throw new Error(`Piloto de adjuntos inactivo: ${state.reason}`);
}
