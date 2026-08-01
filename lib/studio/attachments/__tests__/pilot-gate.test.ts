import { describe, expect, it } from "vitest";
import { attachmentsPilotState } from "../pilot-gate";

const backup = {
  DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://s3.test",
  DTD_ATTACHMENTS_BACKUP_REGION: "test",
  DTD_ATTACHMENTS_BACKUP_BUCKET: "immutable",
  DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID: "id",
  DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY: "secret",
  DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "2026-08-01T00:00:00Z",
  DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "2026-08-01T00:00:00Z",
  DTD_ATTACHMENTS_AV_PROVIDER: "clamav",
  DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT: "2026-08-01T00:00:00Z",
  DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "2026-08-01T00:00:00Z",
};

describe("gate del piloto", () => {
  it("está apagado por defecto", () => expect(attachmentsPilotState({}).enabled).toBe(false));
  it("en producción exige doble confirmación y backup", () => {
    expect(attachmentsPilotState({ NODE_ENV: "production", DTD_ATTACHMENTS_GASTOS_PILOT: "1" }).reason).toBe("production_not_confirmed");
    expect(attachmentsPilotState({ NODE_ENV: "production", DTD_ATTACHMENTS_GASTOS_PILOT: "1", DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1", ...backup }).enabled).toBe(true);
  });

  it("falla cerrado sin antivirus y restore comprobados", () => {
    const base = {
      NODE_ENV: "production",
      DTD_ATTACHMENTS_GASTOS_PILOT: "1",
      DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1",
    };
    expect(attachmentsPilotState({ ...base, ...backup, DTD_ATTACHMENTS_AV_PROVIDER: "" }).reason).toBe("antivirus_not_verified");
    expect(attachmentsPilotState({ ...base, ...backup, DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "" }).reason).toBe("restore_not_verified");
  });
});
