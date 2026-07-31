import { describe, expect, it } from "vitest";
import { attachmentsPilotState } from "../pilot-gate";

const backup = {
  DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://s3.test",
  DTD_ATTACHMENTS_BACKUP_REGION: "test",
  DTD_ATTACHMENTS_BACKUP_BUCKET: "immutable",
  DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID: "id",
  DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY: "secret",
};

describe("gate del piloto", () => {
  it("está apagado por defecto", () => expect(attachmentsPilotState({}).enabled).toBe(false));
  it("en producción exige doble confirmación y backup", () => {
    expect(attachmentsPilotState({ NODE_ENV: "production", DTD_ATTACHMENTS_GASTOS_PILOT: "1" }).reason).toBe("production_not_confirmed");
    expect(attachmentsPilotState({ NODE_ENV: "production", DTD_ATTACHMENTS_GASTOS_PILOT: "1", DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1", ...backup }).enabled).toBe(true);
  });
});

