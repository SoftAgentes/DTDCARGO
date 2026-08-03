#!/usr/bin/env node

import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { fileTypeFromBuffer } from "file-type";
import { createClient } from "@supabase/supabase-js";
import { GetObjectRetentionCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertAttachmentsWorkerStartup } from "./attachments-pilot-preflight.mjs";

assertAttachmentsWorkerStartup();

const workerId = `${hostname()}:${process.pid}`;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const backup = new S3Client({
  endpoint: process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT,
  region: process.env.DTD_ATTACHMENTS_BACKUP_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  },
});
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
    const response = await fetch(process.env.DTD_ATTACHMENTS_AV_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.DTD_ATTACHMENTS_AV_TOKEN}`, "content-type": "application/octet-stream" },
      body: Buffer.from(bytes), signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Antivirus respondió ${response.status}`);
    const antivirus = await response.json();
    if (typeof antivirus.clean !== "boolean") throw new Error("Respuesta de antivirus inválida");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const result = await supabase.rpc("complete_document_scan", {
      p_job_id: job.id, p_sha256: sha256, p_canonical_mime: detected.mime,
      p_clean: antivirus.clean, p_error: antivirus.signature ?? null,
    });
    if (result.error) throw result.error;
  } catch (error) {
    await supabase.rpc("fail_document_scan", {
      p_job_id: job.id, p_error: error instanceof Error ? error.message : String(error),
    });
  }
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

const scans = await supabase.rpc("claim_document_scan_jobs", { p_worker: workerId, p_limit: 10 });
if (scans.error) throw scans.error;
for (const job of scans.data ?? []) await processScan(job);

const backups = await supabase.rpc("claim_document_backup_jobs", { p_worker: workerId, p_limit: 10 });
if (backups.error) throw backups.error;
for (const job of backups.data ?? []) await processBackup(job);

console.log(JSON.stringify({ worker: workerId, scans: scans.data?.length ?? 0, backups: backups.data?.length ?? 0 }));
