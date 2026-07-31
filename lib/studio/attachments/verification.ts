import "server-only";

import { createHash } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { AttachmentMime } from "./types";

const ALLOWED = new Set<AttachmentMime>(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function verifyAttachmentBytes(bytes: Uint8Array): Promise<{
  sha256: string;
  canonicalMime: AttachmentMime;
}> {
  const detected = await fileTypeFromBuffer(Buffer.from(bytes));
  if (!detected || !ALLOWED.has(detected.mime as AttachmentMime)) {
    throw new Error("El contenido real del archivo no está permitido.");
  }
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    canonicalMime: detected.mime as AttachmentMime,
  };
}

export interface AntivirusResult { clean: boolean; engine: string; signature?: string }

export async function scanWithConfiguredAntivirus(bytes: Uint8Array): Promise<AntivirusResult> {
  const endpoint = process.env.DTD_ATTACHMENTS_AV_URL;
  const token = process.env.DTD_ATTACHMENTS_AV_TOKEN;
  if (!endpoint || !token) throw new Error("Antivirus externo no configurado.");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
    body: Buffer.from(bytes),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Antivirus respondió ${response.status}.`);
  const result = (await response.json()) as AntivirusResult;
  if (typeof result.clean !== "boolean" || !result.engine) throw new Error("Respuesta de antivirus inválida.");
  return result;
}
