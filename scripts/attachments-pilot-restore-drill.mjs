#!/usr/bin/env node

import { createHash } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

if (process.env.NODE_ENV === "production") throw new Error("Restore drill prohibido con NODE_ENV=production.");
if (process.env.DTD_ATTACHMENTS_DRILL_ALLOW !== "1") throw new Error("Define DTD_ATTACHMENTS_DRILL_ALLOW=1 para el simulacro no productivo.");
const required = [
  "DTD_ATTACHMENTS_BACKUP_ENDPOINT", "DTD_ATTACHMENTS_BACKUP_REGION",
  "DTD_ATTACHMENTS_BACKUP_BUCKET", "DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID",
  "DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY", "DTD_ATTACHMENTS_DRILL_OBJECT_KEY",
  "DTD_ATTACHMENTS_DRILL_VERSION_ID", "DTD_ATTACHMENTS_DRILL_SHA256",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Simulacro fail-closed: faltan ${missing.join(", ")}`);

const s3 = new S3Client({
  endpoint: process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT,
  region: process.env.DTD_ATTACHMENTS_BACKUP_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  },
});
const result = await s3.send(new GetObjectCommand({
  Bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
  Key: process.env.DTD_ATTACHMENTS_DRILL_OBJECT_KEY,
  VersionId: process.env.DTD_ATTACHMENTS_DRILL_VERSION_ID,
}));
if (!result.Body) throw new Error("La versión de respaldo no devolvió bytes.");
const bytes = await result.Body.transformToByteArray();
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== process.env.DTD_ATTACHMENTS_DRILL_SHA256) throw new Error("Restore drill falló: checksum distinto.");
console.log(JSON.stringify({ ok: true, bytes: bytes.byteLength, sha256, wroteProduction: false }));

