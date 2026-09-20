// @vitest-environment node
import { describe, expect, it } from "vitest";
import { attachmentsPilotState } from "../pilot-gate";

const backup = {
  DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://s3.test",
  DTD_ATTACHMENTS_BACKUP_REGION: "test",
  DTD_ATTACHMENTS_BACKUP_BUCKET: "immutable",
  DTD_ATTACHMENTS_AWS_AUTH_MODE: "default-chain",
};

const externalEvidence = {
  DTD_ATTACHMENTS_AV_PROVIDER: "aws-guardduty-s3",
  DTD_ATTACHMENTS_AWS_ACCOUNT_ID: "111122223333",
  DTD_ATTACHMENTS_SCAN_REGION: "test",
  DTD_ATTACHMENTS_SCAN_BUCKET: "scan",
  DTD_ATTACHMENTS_SCAN_QUEUE_URL: "https://sqs.test/queue",
  DTD_ATTACHMENTS_SCAN_KMS_KEY_ID: "kms-key",
  DTD_ATTACHMENTS_GUARDDUTY_PLAN_VERIFIED_AT: "2026-08-01T12:00:00Z",
  DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "2026-08-01T12:05:00Z",
  DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "2026-08-01T12:10:00Z",
  DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "2026-08-01T12:15:00Z",
  DTD_ATTACHMENTS_AWS_CONTRACT_VERIFIED_AT: "2026-08-01T12:20:00Z",
  DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT: "2026-08-01T12:25:00Z",
};

const production = {
  NODE_ENV: "production",
  DTD_ATTACHMENTS_GASTOS_PILOT: "1",
  DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1",
};
const now = new Date("2026-08-01T13:00:00Z");
const state = (env: Record<string, string | undefined>) => attachmentsPilotState(env, now);

describe("gate del piloto", () => {
  it("está apagado por defecto", () => expect(state({}).enabled).toBe(false));
  it("en producción exige doble confirmación y backup", () => {
    expect(state({
      NODE_ENV: "production",
      DTD_ATTACHMENTS_GASTOS_PILOT: "1",
    }).reason).toBe("production_not_confirmed");
    expect(state({ ...production }).reason).toBe("backup_not_configured");
  });

  it("falla cerrado sin antivirus y prueba EICAR", () => {
    expect(state({ ...production, ...backup }).reason)
      .toBe("antivirus_not_verified");
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "fecha-inválida",
    }).reason).toBe("antivirus_not_verified");
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_GUARDDUTY_PLAN_VERIFIED_AT: "2026-07-30T12:00:00Z",
    }).reason).toBe("antivirus_not_verified");
  });

  it("falla cerrado sin Object Lock y restore comprobados", () => {
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "",
    }).reason).toBe("object_lock_not_verified");
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "",
    }).reason).toBe("restore_not_verified");
  });

  it("falla cerrado sin expediente contractual y decisión PIPL", () => {
    expect(state({
      ...production, ...backup, ...externalEvidence,
      DTD_ATTACHMENTS_AWS_CONTRACT_VERIFIED_AT: "",
    }).reason).toBe("contract_not_verified");
    expect(state({
      ...production, ...backup, ...externalEvidence,
      DTD_ATTACHMENTS_PIPL_TRANSFER_VERIFIED_AT: "",
    }).reason).toBe("pipl_not_verified");
  });

  it("solo habilita producción con todas las evidencias externas", () => {
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
    })).toEqual({ enabled: true, reason: "enabled" });
  });

  it("habilita R2 solo con lock, contrato Cloudflare y credenciales estáticas", () => {
    expect(state({
      ...production,
      ...backup,
      ...externalEvidence,
      DTD_ATTACHMENTS_BACKUP_PROVIDER: "cloudflare-r2",
      DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      DTD_ATTACHMENTS_BACKUP_REGION: "auto",
      DTD_ATTACHMENTS_AWS_AUTH_MODE: "static",
      DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID: "id",
      DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY: "secret",
      DTD_ATTACHMENTS_R2_LOCK_RULE_NAME: "dtdcargo-gastos-10y1d",
      DTD_ATTACHMENTS_R2_LOCK_DAYS: "3654",
      DTD_ATTACHMENTS_AV_PROVIDER: "scanner-managed",
      DTD_ATTACHMENTS_AV_URL: "https://scanner.example.test/scan",
      DTD_ATTACHMENTS_AV_TOKEN: "token",
      DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT: "2026-08-01T12:00:00Z",
      DTD_ATTACHMENTS_CLOUDFLARE_CONTRACT_VERIFIED_AT: "2026-08-01T12:20:00Z",
    })).toEqual({ enabled: true, reason: "enabled" });
  });
});
