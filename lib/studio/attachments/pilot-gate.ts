export interface AttachmentsPilotState {
  enabled: boolean;
  reason:
    | "enabled"
    | "flag_off"
    | "production_not_confirmed"
    | "backup_not_configured"
    | "antivirus_not_verified"
    | "object_lock_not_verified"
    | "restore_not_verified";
}

function hasValue(env: Record<string, string | undefined>, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function hasIsoTimestamp(
  env: Record<string, string | undefined>,
  key: string,
): boolean {
  const value = env[key]?.trim();
  return Boolean(value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value));
}

export function attachmentsPilotState(
  env: Record<string, string | undefined> = process.env,
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
    "DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID",
    "DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY",
  ].every((key) => hasValue(env, key));
  if (env.NODE_ENV === "production" && !backupReady) {
    return { enabled: false, reason: "backup_not_configured" };
  }
  if (env.NODE_ENV === "production") {
    const antivirusReady = [
      "DTD_ATTACHMENTS_AV_URL",
      "DTD_ATTACHMENTS_AV_TOKEN",
      "DTD_ATTACHMENTS_AV_PROVIDER",
    ].every((key) => hasValue(env, key))
      && hasIsoTimestamp(env, "DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT")
      && hasIsoTimestamp(env, "DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT");
    if (!antivirusReady) {
      return { enabled: false, reason: "antivirus_not_verified" };
    }
    if (!hasIsoTimestamp(env, "DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT")) {
      return { enabled: false, reason: "object_lock_not_verified" };
    }
    if (!hasIsoTimestamp(env, "DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT")) {
      return { enabled: false, reason: "restore_not_verified" };
    }
  }
  return { enabled: true, reason: "enabled" };
}

export function requireAttachmentsPilot(): void {
  const state = attachmentsPilotState();
  if (!state.enabled) throw new Error(`Piloto de adjuntos inactivo: ${state.reason}`);
}
