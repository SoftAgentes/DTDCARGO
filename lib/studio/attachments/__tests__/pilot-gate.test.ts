import { describe, expect, it } from "vitest";
import { attachmentsPilotState } from "../pilot-gate";

const backup = {
  DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://s3.test",
  DTD_ATTACHMENTS_BACKUP_REGION: "test",
  DTD_ATTACHMENTS_BACKUP_BUCKET: "immutable",
  DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID: "id",
  DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY: "secret",
};

const externalEvidence = {
  DTD_ATTACHMENTS_AV_URL: "https://av.test/scan",
  DTD_ATTACHMENTS_AV_TOKEN: "token",
  DTD_ATTACHMENTS_AV_PROVIDER: "guardduty",
  DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT: "2026-08-01T12:00:00Z",
  DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "2026-08-01T12:05:00Z",
  DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "2026-08-01T12:10:00Z",
  DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "2026-08-01T12:15:00Z",
};

const production = {
  NODE_ENV: "production",
  DTD_ATTACHMENTS_GASTOS_PILOT: "1",
  DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1",
};

describe("gate del piloto", () => {
  it("está apagado por defecto", () => expect(attachmentsPilotState({}).enabled).toBe(false));
  it("en producción exige doble confirmación y backup", () => {
    expect(attachmentsPilotState({
      NODE_ENV: "production",
      DTD_ATTACHMENTS_GASTOS_PILOT: "1",
    }).reason).toBe("production_not_confirmed");
    expect(attachmentsPilotState({ ...production }).reason).toBe("backup_not_configured");
  });

  it("falla cerrado sin antivirus y prueba EICAR", () => {
    expect(attachmentsPilotState({ ...production, ...backup }).reason)
      .toBe("antivirus_not_verified");
    expect(attachmentsPilotState({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "fecha-inválida",
    }).reason).toBe("antivirus_not_verified");
  });

  it("falla cerrado sin Object Lock y restore comprobados", () => {
    expect(attachmentsPilotState({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "",
    }).reason).toBe("object_lock_not_verified");
    expect(attachmentsPilotState({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "",
    }).reason).toBe("restore_not_verified");
  });

  it("solo habilita producción con todas las evidencias externas", () => {
    expect(attachmentsPilotState({
      ...production,
      ...backup,
      ...externalEvidence,
    })).toEqual({ enabled: true, reason: "enabled" });
  });
});
