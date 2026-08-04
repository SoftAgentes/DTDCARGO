#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectRetentionCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

if (process.env.DTD_ATTACHMENTS_AWS_VALIDATION_ALLOW !== "1") {
  throw new Error("Validación AWS bloqueada: define DTD_ATTACHMENTS_AWS_VALIDATION_ALLOW=1.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("La validación destructiva controlada no corre con NODE_ENV=production.");
}

const required = [
  "DTD_ATTACHMENTS_AWS_ACCOUNT_ID",
  "DTD_ATTACHMENTS_SCAN_REGION",
  "DTD_ATTACHMENTS_SCAN_BUCKET",
  "DTD_ATTACHMENTS_SCAN_KMS_KEY_ID",
  "DTD_ATTACHMENTS_BACKUP_BUCKET",
  "DTD_ATTACHMENTS_BACKUP_REGION",
  "DTD_ATTACHMENTS_EVIDENCE_PATH",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Validación AWS bloqueada: faltan ${missing.join(", ")}`);
if (process.env.DTD_ATTACHMENTS_SCAN_REGION !== process.env.DTD_ATTACHMENTS_BACKUP_REGION) {
  throw new Error("Validación AWS bloqueada: scan y backup deben compartir región.");
}
const evidencePath = resolve(process.env.DTD_ATTACHMENTS_EVIDENCE_PATH);
const relativeToRepo = relative(process.cwd(), evidencePath);
if (!isAbsolute(process.env.DTD_ATTACHMENTS_EVIDENCE_PATH)
    || (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo))) {
  throw new Error("Validación AWS bloqueada: DTD_ATTACHMENTS_EVIDENCE_PATH debe ser absoluto y externo al repo.");
}

function credentials() {
  if ((process.env.DTD_ATTACHMENTS_AWS_AUTH_MODE ?? "default-chain") === "default-chain") return undefined;
  if (!process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID || !process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY) {
    throw new Error("Validación AWS bloqueada: faltan credenciales static.");
  }
  return {
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  };
}

const s3 = new S3Client({ region: process.env.DTD_ATTACHMENTS_SCAN_REGION, credentials: credentials() });
const runId = randomUUID();
const cleanKey = `validation/${runId}/clean.txt`;
const eicarKey = `validation/${runId}/eicar.com.txt`;
const backupKey = `validation/${runId}/immutable.json`;
const cleanBytes = Buffer.from("DTD Cargo synthetic clean attachment validation\n", "utf8");
const eicarBytes = Buffer.from([
  "X5O!P%@AP[4", "\\", "PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
].join(""), "ascii");
const backupBytes = Buffer.from(JSON.stringify({ synthetic: true, runId, noPersonalData: true }), "utf8");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function putScanObject(key, bytes) {
  const response = await s3.send(new PutObjectCommand({
    Bucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET,
    Key: key,
    Body: bytes,
    ContentType: "text/plain",
    ChecksumSHA256: Buffer.from(sha256(bytes), "hex").toString("base64"),
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: process.env.DTD_ATTACHMENTS_SCAN_KMS_KEY_ID,
    Metadata: { synthetic: "true", "validation-run": runId },
  }));
  if (!response.VersionId) throw new Error(`Scan bucket no devolvió VersionId para ${key}`);
  return response.VersionId;
}

async function waitForGuardDutyTag(key, versionId, expected) {
  const timeoutSeconds = Number(process.env.DTD_ATTACHMENTS_SCAN_TIMEOUT_SECONDS ?? "600");
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 1800) {
    throw new Error("DTD_ATTACHMENTS_SCAN_TIMEOUT_SECONDS debe estar entre 30 y 1800.");
  }
  const started = performance.now();
  while (performance.now() - started < timeoutSeconds * 1000) {
    const tags = await s3.send(new GetObjectTaggingCommand({
      Bucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET, Key: key, VersionId: versionId,
    }));
    const status = tags.TagSet?.find((tag) => tag.Key === "GuardDutyMalwareScanStatus")?.Value;
    if (status) {
      if (status !== expected) throw new Error(`GuardDuty devolvió ${status}; se esperaba ${expected}.`);
      return { status, elapsedMs: Math.round(performance.now() - started) };
    }
    await delay(10_000);
  }
  throw new Error(`GuardDuty no etiquetó ${key} dentro de ${timeoutSeconds}s.`);
}

const evidence = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  syntheticOnly: true,
  accountId: process.env.DTD_ATTACHMENTS_AWS_ACCOUNT_ID,
  region: process.env.DTD_ATTACHMENTS_SCAN_REGION,
  scanBucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET,
  backupBucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
};

const cleanVersionId = await putScanObject(cleanKey, cleanBytes);
const eicarVersionId = await putScanObject(eicarKey, eicarBytes);
evidence.cleanScan = await waitForGuardDutyTag(cleanKey, cleanVersionId, "NO_THREATS_FOUND");
evidence.eicarScan = await waitForGuardDutyTag(eicarKey, eicarVersionId, "THREATS_FOUND");

const retainUntil = new Date();
retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + 10);
retainUntil.setUTCDate(retainUntil.getUTCDate() + 1);
const rpoStarted = performance.now();
const backupPut = await s3.send(new PutObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  Key: backupKey,
  Body: backupBytes,
  ContentType: "application/json",
  ChecksumSHA256: Buffer.from(sha256(backupBytes), "hex").toString("base64"),
  Metadata: { sha256: sha256(backupBytes), synthetic: "true", "validation-run": runId },
  ObjectLockMode: "COMPLIANCE",
  ObjectLockRetainUntilDate: retainUntil,
}));
if (!backupPut.VersionId) throw new Error("Backup WORM no devolvió VersionId.");
const retention = await s3.send(new GetObjectRetentionCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: backupKey, VersionId: backupPut.VersionId,
}));
if (retention.Retention?.Mode !== "COMPLIANCE" || !retention.Retention.RetainUntilDate
    || retention.Retention.RetainUntilDate < retainUntil) {
  throw new Error("La cuenta real no confirmó Object Lock COMPLIANCE por la retención requerida.");
}
evidence.rpoMs = Math.round(performance.now() - rpoStarted);
evidence.objectLock = {
  mode: retention.Retention.Mode,
  retainUntil: retention.Retention.RetainUntilDate.toISOString(),
  versionId: backupPut.VersionId,
};

let deleteDenied = false;
try {
  await s3.send(new DeleteObjectCommand({
    Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: backupKey, VersionId: backupPut.VersionId,
  }));
} catch (error) {
  deleteDenied = error?.name === "AccessDenied" || error?.$metadata?.httpStatusCode === 403;
}
if (!deleteDenied) throw new Error("Gate Object Lock falló: el borrado de la versión protegida no fue denegado.");
evidence.objectLock.deleteDenied = true;

const restoreStarted = performance.now();
const restored = await s3.send(new GetObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: backupKey, VersionId: backupPut.VersionId,
}));
if (!restored.Body) throw new Error("Restore real no devolvió bytes.");
const restoredBytes = Buffer.from(await restored.Body.transformToByteArray());
evidence.rtoMs = Math.round(performance.now() - restoreStarted);
evidence.restore = {
  bytes: restoredBytes.byteLength,
  sha256: sha256(restoredBytes),
  expectedSha256: sha256(backupBytes),
};
if (evidence.restore.sha256 !== evidence.restore.expectedSha256) {
  throw new Error("Restore real devolvió un checksum distinto.");
}

evidence.completedAt = new Date().toISOString();
evidence.ok = true;
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8", flag: "wx",
});
console.log(JSON.stringify({
  ok: true,
  runId,
  eicar: evidence.eicarScan.status,
  deleteDenied: true,
  rpoMs: evidence.rpoMs,
  rtoMs: evidence.rtoMs,
  evidencePath,
}));
