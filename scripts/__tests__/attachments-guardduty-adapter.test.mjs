// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  applyGuardDutyResult,
  buildGuardDutyScanObjectKey,
  parseGuardDutySqsMessage,
  scanMetadata,
  verifyGuardDutyObjectMetadata,
} from "../attachments-guardduty-adapter.mjs";

const accountId = "111122223333";
const region = "us-east-1";
const bucket = "dtd-attachments-scan";
const documentId = "17341ed6-8c5a-4f42-85f1-c7677e765e9a";
const sha256 = "a".repeat(64);
const canonicalMime = "application/pdf";
const objectKey = buildGuardDutyScanObjectKey({ jobId: 42, documentId, sha256, canonicalMime });

function event(resultStatus = "NO_THREATS_FOUND", overrides = {}) {
  return JSON.stringify({
    version: "0",
    id: "72c7d362-737a-6dce-fc78-9e27a0171419",
    "detail-type": "GuardDuty Malware Protection Object Scan Result",
    source: "aws.guardduty",
    account: accountId,
    time: "2026-08-03T12:00:00Z",
    region,
    resources: ["arn:aws:guardduty:us-east-1:111122223333:malware-protection-plan/example"],
    detail: {
      schemaVersion: "1.0",
      scanStatus: resultStatus === "FAILED" ? "FAILED" : "COMPLETED",
      resourceType: "S3_OBJECT",
      s3ObjectDetails: { bucketName: bucket, objectKey, versionId: "version-1", s3Throttled: false },
      scanResultDetails: {
        scanResultStatus: resultStatus,
        threats: resultStatus === "THREATS_FOUND" ? [{ name: "EICAR-Test-File (not a virus)" }] : null,
        statusReasons: resultStatus === "FAILED" ? ["INTERNAL_ERROR"] : null,
      },
    },
    ...overrides,
  });
}

const expected = { accountId, region, bucket };

describe("GuardDuty EventBridge/SQS adapter", () => {
  it("construye una clave determinística sin PII y recupera el descriptor", () => {
    expect(objectKey).toBe(`scan/v1/42/${documentId}/${sha256}/YXBwbGljYXRpb24vcGRm`);
    expect(parseGuardDutySqsMessage(event(), expected)).toMatchObject({
      jobId: 42, documentId, sha256, canonicalMime, verdict: "clean", versionId: "version-1",
    });
  });

  it("rechaza mensajes de otra cuenta, región, bucket o tipo", () => {
    expect(() => parseGuardDutySqsMessage(event("NO_THREATS_FOUND", { account: "999900001111" }), expected))
      .toThrow("otra cuenta");
    expect(() => parseGuardDutySqsMessage(event("NO_THREATS_FOUND", { region: "us-west-2" }), expected))
      .toThrow("otra región");
    expect(() => parseGuardDutySqsMessage(event(), { ...expected, bucket: "otro" })).toThrow("otro bucket");
    expect(() => parseGuardDutySqsMessage(JSON.stringify({ source: "attacker" }), expected)).toThrow("no es un resultado");
  });

  it("acepta un envelope SNS únicamente después de validar el evento interno", () => {
    const wrapped = JSON.stringify({ Type: "Notification", Message: event() });
    expect(parseGuardDutySqsMessage(wrapped, expected).verdict).toBe("clean");
  });

  it("mapea malware a cuarentena con la primera firma", () => {
    expect(parseGuardDutySqsMessage(event("THREATS_FOUND"), expected)).toMatchObject({
      verdict: "infected", signature: "EICAR-Test-File (not a virus)",
    });
  });

  it("trata resultados fallidos o no soportados como fallo cerrado", () => {
    expect(parseGuardDutySqsMessage(event("FAILED"), expected)).toMatchObject({
      verdict: "failed", reasons: ["FAILED", "INTERNAL_ERROR"],
    });
  });

  it("verifica metadata contra el descriptor antes de tocar Supabase", () => {
    const descriptor = parseGuardDutySqsMessage(event(), expected);
    expect(verifyGuardDutyObjectMetadata(scanMetadata(descriptor), descriptor)).toBe(true);
    expect(() => verifyGuardDutyObjectMetadata({ ...scanMetadata(descriptor), sha256: "b".repeat(64) }, descriptor))
      .toThrow("metadata sha256");
  });

  it("completa limpio e infectado y borra el mensaje solamente después", async () => {
    const completeScan = vi.fn().mockResolvedValue(undefined);
    const failScan = vi.fn().mockResolvedValue(undefined);
    const clean = parseGuardDutySqsMessage(event(), expected);
    const result = await applyGuardDutyResult({
      descriptor: clean,
      job: { status: "processing", document_id: documentId },
      headMetadata: scanMetadata(clean), completeScan, failScan,
    });
    expect(result).toEqual({ disposition: "clean", deleteMessage: true });
    expect(completeScan).toHaveBeenCalledWith(expect.objectContaining({ jobId: 42, clean: true }));
    expect(failScan).not.toHaveBeenCalled();

    const infected = parseGuardDutySqsMessage(event("THREATS_FOUND"), expected);
    await applyGuardDutyResult({
      descriptor: infected,
      job: { status: "processing", document_id: documentId },
      headMetadata: scanMetadata(infected), completeScan, failScan,
    });
    expect(completeScan).toHaveBeenLastCalledWith(expect.objectContaining({ clean: false, error: "EICAR-Test-File (not a virus)" }));
  });

  it("es idempotente con jobs completos y no reejecuta RPC", async () => {
    const completeScan = vi.fn();
    const result = await applyGuardDutyResult({
      descriptor: parseGuardDutySqsMessage(event(), expected),
      job: { status: "completed", document_id: documentId },
      headMetadata: {}, completeScan, failScan: vi.fn(),
    });
    expect(result).toEqual({ disposition: "duplicate", deleteMessage: true });
    expect(completeScan).not.toHaveBeenCalled();
  });

  it("conserva el mensaje si el job o la relación no son procesables", async () => {
    const descriptor = parseGuardDutySqsMessage(event(), expected);
    await expect(applyGuardDutyResult({
      descriptor,
      job: { status: "failed", document_id: documentId },
      headMetadata: scanMetadata(descriptor), completeScan: vi.fn(), failScan: vi.fn(),
    })).rejects.toThrow("estado no procesable");
    await expect(applyGuardDutyResult({
      descriptor,
      job: { status: "processing", document_id: "6c78155f-f8cc-4eb2-b8a0-c8bf1f735aaf" },
      headMetadata: scanMetadata(descriptor), completeScan: vi.fn(), failScan: vi.fn(),
    })).rejects.toThrow("no corresponde");
  });
});
