import { describe, expect, it } from "vitest";
import {
  assertAttachmentsWorkerStartup,
  AttachmentsPreflightError,
  inspectAttachmentsWorkerEnv,
} from "../attachments-pilot-preflight.mjs";

const now = new Date("2026-08-03T12:00:00.000Z");

function baseEnv() {
  return {
    NODE_ENV: "test",
    DTD_ATTACHMENTS_WORKER_ALLOW: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
    DTD_ATTACHMENTS_AV_URL: "https://scanner.example.test/scan",
    DTD_ATTACHMENTS_AV_TOKEN: "av-secret-value",
    DTD_ATTACHMENTS_BACKUP_ENDPOINT: "https://s3.example.test",
    DTD_ATTACHMENTS_BACKUP_REGION: "test-1",
    DTD_ATTACHMENTS_BACKUP_BUCKET: "immutable",
    DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID: "backup-id-value",
    DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY: "backup-secret-value",
  };
}

function productionEnv() {
  return {
    ...baseEnv(),
    NODE_ENV: "production",
    DTD_ATTACHMENTS_GASTOS_PILOT: "1",
    DTD_ATTACHMENTS_PRODUCTION_CONFIRMED: "1",
    DTD_ATTACHMENTS_AV_PROVIDER: "scanner-managed",
    DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT: "2026-08-03T11:30:00.000Z",
    DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT: "2026-08-03T11:15:00.000Z",
    DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT: "2026-08-02T12:00:00.000Z",
    DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT: "2026-08-01T12:00:00.000Z",
  };
}

describe("attachments worker preflight", () => {
  it("bloquea el arranque sin autorización operacional explícita", () => {
    const env = baseEnv();
    env.DTD_ATTACHMENTS_WORKER_ALLOW = "0";

    expect(() => assertAttachmentsWorkerStartup(env, { now })).toThrow(AttachmentsPreflightError);
    expect(inspectAttachmentsWorkerEnv(env, { now }).issues).toContain(
      "DTD_ATTACHMENTS_WORKER_ALLOW debe ser 1",
    );
  });

  it("permite el worker no productivo con configuración completa", () => {
    expect(assertAttachmentsWorkerStartup(baseEnv(), { now })).toEqual({
      ok: true,
      production: false,
      checks: {
        explicitWorkerAllow: true,
        coreConfiguration: true,
        productionEvidence: true,
      },
    });
  });

  it("rechaza HTTP fuera de loopback y credenciales embebidas", () => {
    const env = baseEnv();
    env.DTD_ATTACHMENTS_AV_URL = "http://user:password@scanner.example.test/scan";

    const result = inspectAttachmentsWorkerEnv(env, { now });
    expect(result.issues).toContain("DTD_ATTACHMENTS_AV_URL no puede incluir credenciales");
    expect(result.issues).toContain("DTD_ATTACHMENTS_AV_URL debe usar HTTPS fuera de loopback");
  });

  it("permite HTTP solamente para servicios loopback no productivos", () => {
    const env = baseEnv();
    env.DTD_ATTACHMENTS_AV_URL = "http://127.0.0.1:3310/scan";
    env.DTD_ATTACHMENTS_BACKUP_ENDPOINT = "http://localhost:9000";

    expect(inspectAttachmentsWorkerEnv(env, { now }).issues).toEqual([]);
  });

  it("bloquea GuardDuty mientras el worker no tenga adapter EventBridge/SQS", () => {
    const env = baseEnv();
    env.DTD_ATTACHMENTS_AV_PROVIDER = "aws-guardduty-s3";

    expect(inspectAttachmentsWorkerEnv(env, { now }).issues).toContain(
      "DTD_ATTACHMENTS_AV_PROVIDER=aws-guardduty-s3 requiere el adaptador EventBridge/SQS",
    );
  });

  it("exige flags y evidencias en Producción", () => {
    const env = baseEnv();
    env.NODE_ENV = "production";

    const issues = inspectAttachmentsWorkerEnv(env, { now }).issues.join("\n");
    expect(issues).toContain("DTD_ATTACHMENTS_GASTOS_PILOT debe ser 1");
    expect(issues).toContain("DTD_ATTACHMENTS_PRODUCTION_CONFIRMED debe ser 1");
    expect(issues).toContain("faltan evidencias");
  });

  it("bloquea evidencia antivirus vencida y restore drill fuera de vigencia", () => {
    const env = productionEnv();
    env.DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT = "2026-08-01T11:00:00.000Z";
    env.DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT = "2026-04-01T12:00:00.000Z";

    const issues = inspectAttachmentsWorkerEnv(env, { now }).issues;
    expect(issues).toContain("DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT está vencida");
    expect(issues).toContain("DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT está vencida");
  });

  it("acepta Producción únicamente con gates completos y recientes", () => {
    expect(assertAttachmentsWorkerStartup(productionEnv(), { now }).production).toBe(true);
  });

  it("no expone valores secretos en el resultado ni en los errores", () => {
    const env = baseEnv();
    env.DTD_ATTACHMENTS_BACKUP_BUCKET = "";
    const serialized = JSON.stringify(inspectAttachmentsWorkerEnv(env, { now }));

    expect(serialized).not.toContain("service-role-value");
    expect(serialized).not.toContain("av-secret-value");
    expect(serialized).not.toContain("backup-secret-value");
    expect(serialized).toContain("DTD_ATTACHMENTS_BACKUP_BUCKET");
  });
});
