export interface AttachmentsPilotState {
  enabled: boolean;
  reason: "enabled" | "flag_off" | "production_not_confirmed" | "backup_not_configured";
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
  ].every((key) => Boolean(env[key]?.trim()));
  if (env.NODE_ENV === "production" && !backupReady) {
    return { enabled: false, reason: "backup_not_configured" };
  }
  return { enabled: true, reason: "enabled" };
}

export function requireAttachmentsPilot(): void {
  const state = attachmentsPilotState();
  if (!state.enabled) throw new Error(`Piloto de adjuntos inactivo: ${state.reason}`);
}

