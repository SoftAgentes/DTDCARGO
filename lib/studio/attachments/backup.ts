import "server-only";

import { GetObjectCommand, GetObjectRetentionCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

function backupConfig() {
  const values = {
    endpoint: process.env.DTD_ATTACHMENTS_BACKUP_ENDPOINT,
    region: process.env.DTD_ATTACHMENTS_BACKUP_REGION,
    bucket: process.env.DTD_ATTACHMENTS_BACKUP_BUCKET,
    accessKeyId: process.env.DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID,
    secretAccessKey: process.env.DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY,
  };
  if (Object.values(values).some((value) => !value)) throw new Error("Respaldo externo no configurado.");
  return values as Record<keyof typeof values, string>;
}

function client(config: ReturnType<typeof backupConfig>) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
}

export async function writeImmutableBackup(input: { objectKey: string; bytes: Uint8Array; sha256: string; contentType: string }) {
  const config = backupConfig();
  const s3 = client(config);
  const retainUntil = new Date();
  retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + 10);
  retainUntil.setUTCDate(retainUntil.getUTCDate() + 1);
  const response = await s3.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.objectKey,
    Body: input.bytes,
    ContentType: input.contentType,
    ChecksumSHA256: Buffer.from(input.sha256, "hex").toString("base64"),
    Metadata: { sha256: input.sha256 },
    ObjectLockMode: "COMPLIANCE",
    ObjectLockRetainUntilDate: retainUntil,
  }));
  const versionId = response.VersionId;
  if (!versionId) throw new Error("El proveedor no devolvió una versión inmutable.");
  const head = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: input.objectKey, VersionId: versionId }));
  if (head.Metadata?.sha256 !== input.sha256) throw new Error("El respaldo no conserva el checksum declarado.");
  const retention = await s3.send(new GetObjectRetentionCommand({ Bucket: config.bucket, Key: input.objectKey, VersionId: versionId }));
  if (!retention.Retention?.Mode || !retention.Retention.RetainUntilDate
      || retention.Retention.RetainUntilDate < retainUntil) {
    throw new Error("El proveedor no confirmó Object Lock por la retención requerida.");
  }
  return {
    provider: new URL(config.endpoint).hostname, objectKey: input.objectKey,
    versionId, sha256: input.sha256, lockMode: retention.Retention.Mode,
    retainUntil: retention.Retention.RetainUntilDate.toISOString(),
  };
}

export async function readBackupVersion(input: { objectKey: string; versionId: string }): Promise<Uint8Array> {
  const config = backupConfig();
  const response = await client(config).send(new GetObjectCommand({
    Bucket: config.bucket, Key: input.objectKey, VersionId: input.versionId,
  }));
  if (!response.Body) throw new Error("Respaldo sin contenido.");
  return response.Body.transformToByteArray();
}

export function sha256Of(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
