#!/usr/bin/env node

import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { fileTypeFromBuffer } from "file-type";
import { createClient } from "@supabase/supabase-js";
import { GetObjectRetentionCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { assertAttachmentsWorkerStartup } from "./attachments-pilot-preflight.mjs";
import {
  applyGuardDutyResult,
  buildGuardDutyScanObjectKey,
  parseGuardDutySqsMessage,
  scanMetadata,
  sha256Base64,
} from "./attachments-guardduty-adapter.mjs";

assertAttachmentsWorkerStartup();

const workerId = `${hostname()}:${process.pid}`;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const provider = process.env.DTD_ATTACHMENTS_AV_PROVIDER?.trim().toLowerCase() || "scanner-managed";

function awsCredentials() {
  if ((process.env.DTD_ATTACHMENTS_AWS_AUTH_MODE ?? "static") === "default-chain") return undefined;
  return {
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  };
}

function forcePathStyle(endpoint) {
  const hostname = new URL(endpoint).hostname.toLowerCase();
  return !(hostname === "s3.amazonaws.com" || /^s3[.-][a-z0-9-]+\.amazonaws\.com$/.test(hostname));
}

const backup = new S3Client({
  endpoint: process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT,
  region: process.env.DTD_ATTACHMENTS_BACKUP_REGION,
  forcePathStyle: forcePathStyle(process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT),
  credentials: awsCredentials(),
});
const scan = provider === "aws-guardduty-s3" ? new S3Client({
  region: process.env.DTD_ATTACHMENTS_SCAN_REGION,
  credentials: awsCredentials(),
}) : null;
const scanQueue = provider === "aws-guardduty-s3" ? new SQSClient({
  region: process.env.DTD_ATTACHMENTS_SCAN_REGION,
  credentials: awsCredentials(),
}) : null;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

async function downloadDocument(documentId) {
  const { data: document, error } = await supabase.from("documents")
    .select("id,bucket_id,object_key,sha256,canonical_mime")
    .eq("id", documentId).single();
  if (error || !document) throw new Error(error?.message ?? "Documento no encontrado.");
  const downloaded = await supabase.storage.from(document.bucket_id).download(document.object_key);
  if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message ?? "No se pudo descargar el objeto.");
  return { document, bytes: new Uint8Array(await downloaded.data.arrayBuffer()) };
}

async function processScan(job) {
  try {
    const { bytes } = await downloadDocument(job.document_id);
    const detected = await fileTypeFromBuffer(bytes);
    if (!detected || !allowedMime.has(detected.mime)) {
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const result = await supabase.rpc("complete_document_scan", {
        p_job_id: job.id, p_sha256: sha256,
        p_canonical_mime: detected?.mime ?? "application/octet-stream",
        p_clean: false, p_error: "magic bytes no permitidos",
      });
      if (result.error) throw result.error;
      return;
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (provider === "aws-guardduty-s3") {
      const key = buildGuardDutyScanObjectKey({
        jobId: job.id, documentId: job.document_id, sha256, canonicalMime: detected.mime,
      });
      const submitted = await scan.send(new PutObjectCommand({
        Bucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET,
        Key: key,
        Body: Buffer.from(bytes),
        ContentType: detected.mime,
        ChecksumSHA256: sha256Base64(bytes),
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: process.env.DTD_ATTACHMENTS_SCAN_KMS_KEY_ID,
        Metadata: scanMetadata({
          jobId: job.id, documentId: job.document_id, sha256, canonicalMime: detected.mime,
        }),
      }));
      if (!submitted.VersionId) throw new Error("GuardDuty scan-inbox no devolvió VersionId.");
      return "submitted";
    }

    const response = await fetch(process.env.DTD_ATTACHMENTS_AV_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.DTD_ATTACHMENTS_AV_TOKEN}`, "content-type": "application/octet-stream" },
      body: Buffer.from(bytes), signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Antivirus respondió ${response.status}`);
    const antivirus = await response.json();
    if (typeof antivirus.clean !== "boolean") throw new Error("Respuesta de antivirus inválida");
    const result = await supabase.rpc("complete_document_scan", {
      p_job_id: job.id, p_sha256: sha256, p_canonical_mime: detected.mime,
      p_clean: antivirus.clean, p_error: antivirus.signature ?? null,
    });
    if (result.error) throw result.error;
    return antivirus.clean ? "clean" : "infected";
  } catch (error) {
    await supabase.rpc("fail_document_scan", {
      p_job_id: job.id, p_error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}

async function consumeGuardDutyResults() {
  if (!scan || !scanQueue) return { received: 0, completed: 0, failed: 0 };
  const received = await scanQueue.send(new ReceiveMessageCommand({
    QueueUrl: process.env.DTD_ATTACHMENTS_SCAN_QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 1,
    VisibilityTimeout: 120,
  }));
  let completed = 0;
  let failed = 0;
  for (const message of received.Messages ?? []) {
    try {
      const descriptor = parseGuardDutySqsMessage(message.Body, {
        accountId: process.env.DTD_ATTACHMENTS_AWS_ACCOUNT_ID,
        region: process.env.DTD_ATTACHMENTS_SCAN_REGION,
        bucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET,
      });
      const jobResult = await supabase.from("document_scan_outbox")
        .select("id,status,document_id").eq("id", descriptor.jobId).maybeSingle();
      if (jobResult.error) throw jobResult.error;
      const headMetadata = jobResult.data?.status === "completed" ? {} : (await scan.send(new HeadObjectCommand({
        Bucket: process.env.DTD_ATTACHMENTS_SCAN_BUCKET,
        Key: descriptor.objectKey,
        VersionId: descriptor.versionId,
      }))).Metadata;
      const result = await applyGuardDutyResult({
        descriptor,
        job: jobResult.data,
        headMetadata,
        completeScan: async ({ jobId, sha256, canonicalMime, clean, error }) => {
          const rpc = await supabase.rpc("complete_document_scan", {
            p_job_id: jobId, p_sha256: sha256, p_canonical_mime: canonicalMime,
            p_clean: clean, p_error: error,
          });
          if (rpc.error) throw rpc.error;
        },
        failScan: async ({ jobId, error }) => {
          const rpc = await supabase.rpc("fail_document_scan", { p_job_id: jobId, p_error: error });
          if (rpc.error) throw rpc.error;
        },
      });
      if (result.deleteMessage) {
        await scanQueue.send(new DeleteMessageCommand({
          QueueUrl: process.env.DTD_ATTACHMENTS_SCAN_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }));
      }
      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({
        worker: workerId,
        guardDutyMessageId: message.MessageId ?? null,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return { received: received.Messages?.length ?? 0, completed, failed };
}

async function processBackup(job) {
  try {
    const { document, bytes } = await downloadDocument(job.document_id);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!document.sha256 || document.sha256 !== sha256) throw new Error("Checksum de origen cambió antes del respaldo.");
    const key = `dtdcargo/${document.object_key}`;
    const retainUntil = new Date();
    retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + 10);
    retainUntil.setUTCDate(retainUntil.getUTCDate() + 1);
    const put = await backup.send(new PutObjectCommand({
      Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: key, Body: bytes,
      ContentType: document.canonical_mime, ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
      Metadata: { sha256 },
      ObjectLockMode: "COMPLIANCE", ObjectLockRetainUntilDate: retainUntil,
    }));
    if (!put.VersionId) throw new Error("Proveedor sin VersionId; Object Lock/versionado no verificable.");
    const head = await backup.send(new HeadObjectCommand({
      Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: key, VersionId: put.VersionId,
    }));
    if (head.Metadata?.sha256 !== sha256) throw new Error("Checksum de respaldo no verificable.");
    const retention = await backup.send(new GetObjectRetentionCommand({
      Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET, Key: key, VersionId: put.VersionId,
    }));
    if (!retention.Retention?.Mode || !retention.Retention.RetainUntilDate
        || retention.Retention.RetainUntilDate < retainUntil) {
      throw new Error("Object Lock por 10 años no verificable.");
    }
    const result = await supabase.rpc("complete_document_backup", {
      p_job_id: job.id, p_provider: new URL(process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT).hostname,
      p_object_key: key, p_version_id: put.VersionId, p_backup_sha256: sha256,
      p_lock_mode: retention.Retention.Mode,
      p_retain_until: retention.Retention.RetainUntilDate.toISOString(),
    });
    if (result.error) throw result.error;
  } catch (error) {
    await supabase.rpc("fail_document_backup", {
      p_job_id: job.id, p_error: error instanceof Error ? error.message : String(error),
    });
  }
}

const guardDutyBefore = await consumeGuardDutyResults();
const scans = await supabase.rpc("claim_document_scan_jobs", { p_worker: workerId, p_limit: 10 });
if (scans.error) throw scans.error;
for (const job of scans.data ?? []) await processScan(job);

const backups = await supabase.rpc("claim_document_backup_jobs", { p_worker: workerId, p_limit: 10 });
if (backups.error) throw backups.error;
for (const job of backups.data ?? []) await processBackup(job);
const guardDutyAfter = await consumeGuardDutyResults();

console.log(JSON.stringify({
  worker: workerId,
  scans: scans.data?.length ?? 0,
  backups: backups.data?.length ?? 0,
  guardDuty: {
    received: guardDutyBefore.received + guardDutyAfter.received,
    completed: guardDutyBefore.completed + guardDutyAfter.completed,
    failed: guardDutyBefore.failed + guardDutyAfter.failed,
  },
}));
