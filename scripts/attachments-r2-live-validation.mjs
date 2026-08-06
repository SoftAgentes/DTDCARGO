#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

if (process.env.DTD_ATTACHMENTS_R2_VALIDATION_ALLOW !== "1") {
  throw new Error("Validación R2 bloqueada: define DTD_ATTACHMENTS_R2_VALIDATION_ALLOW=1.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("La validación sintética no corre con NODE_ENV=production.");
}

const required = [
  "DTD_ATTACHMENTS_BACKUP_ENDPOINT",
  "DTD_ATTACHMENTS_BACKUP_BUCKET",
  "DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID",
  "DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY",
  "DTD_ATTACHMENTS_R2_LOCK_RULE_NAME",
  "DTD_ATTACHMENTS_R2_LOCK_DAYS",
  "DTD_ATTACHMENTS_EVIDENCE_PATH",
];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Validación R2 bloqueada: faltan ${missing.join(", ")}`);
if (Number(process.env.DTD_ATTACHMENTS_R2_LOCK_DAYS) < 3654) {
  throw new Error("Validación R2 bloqueada: la retención debe ser de al menos 3654 días.");
}
const endpoint = new URL(process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT);
if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".r2.cloudflarestorage.com")) {
  throw new Error("Validación R2 bloqueada: endpoint R2 HTTPS no reconocido.");
}
const evidencePath = resolve(process.env.DTD_ATTACHMENTS_EVIDENCE_PATH);
const relativeToRepo = relative(process.cwd(), evidencePath);
if (!isAbsolute(process.env.DTD_ATTACHMENTS_EVIDENCE_PATH)
    || (!relativeToRepo.startsWith("..") && !isAbsolute(relativeToRepo))) {
  throw new Error("Validación R2 bloqueada: DTD_ATTACHMENTS_EVIDENCE_PATH debe ser absoluto y externo al repo.");
}

const r2 = new S3Client({
  endpoint: endpoint.href,
  region: "auto",
  credentials: {
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  },
});
const runId = randomUUID();
const key = `validation/${runId}/immutable.json`;
const bytes = Buffer.from(JSON.stringify({ synthetic: true, runId, noPersonalData: true }), "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const startedAt = new Date();
const rpoStarted = performance.now();
const put = await r2.send(new PutObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  Key: key,
  Body: bytes,
  ContentType: "application/json",
  Metadata: { sha256, synthetic: "true", "validation-run": runId },
}));
const etag = put.ETag?.replaceAll('"', "");
if (!etag) throw new Error("R2 no devolvió ETag para el objeto sintético.");
const head = await r2.send(new HeadObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  Key: key,
}));
if (head.Metadata?.sha256 !== sha256 || head.ETag?.replaceAll('"', "") !== etag) {
  throw new Error("R2 no confirmó metadata SHA-256 y ETag del objeto sintético.");
}
const rpoMs = Math.round(performance.now() - rpoStarted);

let deleteDenied = false;
let deleteStatus = null;
try {
  await r2.send(new DeleteObjectCommand({ Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: key }));
} catch (error) {
  deleteStatus = error?.$metadata?.httpStatusCode ?? null;
  deleteDenied = error?.name === "AccessDenied" || deleteStatus === 403;
}
if (!deleteDenied) {
  throw new Error("Gate R2 Bucket Lock falló: el borrado del objeto protegido no fue denegado.");
}

const restoreStarted = performance.now();
const restored = await r2.send(new GetObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  Key: key,
}));
if (!restored.Body) throw new Error("Restore R2 no devolvió bytes.");
const restoredBytes = Buffer.from(await restored.Body.transformToByteArray());
const restoredSha256 = createHash("sha256").update(restoredBytes).digest("hex");
const rtoMs = Math.round(performance.now() - restoreStarted);
if (restoredSha256 !== sha256) throw new Error("Restore R2 devolvió un checksum distinto.");

const retainUntil = new Date(startedAt);
retainUntil.setUTCDate(retainUntil.getUTCDate() + Number(process.env.DTD_ATTACHMENTS_R2_LOCK_DAYS));
const evidence = {
  schemaVersion: 1,
  provider: "cloudflare-r2",
  runId,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  syntheticOnly: true,
  bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  key,
  receiptId: `etag:${etag}`,
  sha256,
  lock: {
    mode: "R2_BUCKET_LOCK",
    ruleName: process.env.DTD_ATTACHMENTS_R2_LOCK_RULE_NAME,
    days: Number(process.env.DTD_ATTACHMENTS_R2_LOCK_DAYS),
    retainUntil: retainUntil.toISOString(),
    deleteDenied,
    deleteStatus,
  },
  restore: { bytes: restoredBytes.byteLength, sha256: restoredSha256 },
  rpoMs,
  rtoMs,
  ok: true,
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ ok: true, runId, deleteDenied, rpoMs, rtoMs, evidencePath }));
