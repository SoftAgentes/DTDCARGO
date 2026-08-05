import { createHash } from "node:crypto";

export const GUARD_DUTY_DETAIL_TYPE = "GuardDuty Malware Protection Object Scan Result";
export const GUARD_DUTY_SOURCE = "aws.guardduty";
const KEY_PREFIX = "scan/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Evento GuardDuty inválido: falta ${label}`);
  }
  return value.trim();
}

function normalizeObjectKey(value) {
  const raw = requireString(value, "detail.s3ObjectDetails.objectKey");
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch {
    throw new Error("Evento GuardDuty inválido: objectKey no se puede decodificar");
  }
}

export function buildGuardDutyScanObjectKey({ jobId, documentId, sha256, canonicalMime }) {
  const numericJobId = Number(jobId);
  if (!Number.isSafeInteger(numericJobId) || numericJobId <= 0) {
    throw new TypeError("jobId debe ser un entero positivo");
  }
  if (!UUID_PATTERN.test(documentId)) throw new TypeError("documentId debe ser UUID");
  if (!SHA256_PATTERN.test(sha256)) throw new TypeError("sha256 debe ser hexadecimal de 64 caracteres");
  const mime = requireString(canonicalMime, "canonicalMime");
  return `${KEY_PREFIX}/${numericJobId}/${documentId.toLowerCase()}/${sha256}/${Buffer.from(mime).toString("base64url")}`;
}

export function parseGuardDutyScanObjectKey(objectKey) {
  const normalized = normalizeObjectKey(objectKey);
  const [prefix, version, jobIdRaw, documentId, sha256, mimeEncoded, ...extra] = normalized.split("/");
  if (prefix !== "scan" || version !== "v1" || extra.length > 0) {
    throw new Error("Evento GuardDuty fuera del prefijo scan/v1 esperado");
  }
  const jobId = Number(jobIdRaw);
  if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new Error("Evento GuardDuty con jobId inválido");
  if (!UUID_PATTERN.test(documentId)) throw new Error("Evento GuardDuty con documentId inválido");
  if (!SHA256_PATTERN.test(sha256)) throw new Error("Evento GuardDuty con sha256 inválido");
  let canonicalMime;
  try {
    canonicalMime = Buffer.from(requireString(mimeEncoded, "mime"), "base64url").toString("utf8");
  } catch {
    throw new Error("Evento GuardDuty con MIME inválido");
  }
  if (!canonicalMime.includes("/") || canonicalMime.length > 120) {
    throw new Error("Evento GuardDuty con MIME inválido");
  }
  return { objectKey: normalized, jobId, documentId: documentId.toLowerCase(), sha256, canonicalMime };
}

function unwrapQueueBody(body) {
  let parsed;
  try {
    parsed = JSON.parse(requireString(body, "SQS body"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Mensaje SQS no contiene JSON válido");
    throw error;
  }
  if (typeof parsed?.Message === "string") {
    try {
      parsed = JSON.parse(parsed.Message);
    } catch {
      throw new Error("Envelope SNS no contiene un evento JSON válido");
    }
  }
  return parsed;
}

export function parseGuardDutySqsMessage(body, expected) {
  const event = unwrapQueueBody(body);
  if (event?.source !== GUARD_DUTY_SOURCE || event?.["detail-type"] !== GUARD_DUTY_DETAIL_TYPE) {
    throw new Error("Mensaje SQS no es un resultado de análisis GuardDuty");
  }
  if (event.account !== expected.accountId) throw new Error("Evento GuardDuty de otra cuenta AWS");
  if (event.region !== expected.region) throw new Error("Evento GuardDuty de otra región AWS");

  const details = event.detail?.s3ObjectDetails;
  if (details?.bucketName !== expected.bucket) throw new Error("Evento GuardDuty de otro bucket");
  const descriptor = parseGuardDutyScanObjectKey(details.objectKey);
  const eventId = requireString(event.id, "id");
  const versionId = requireString(details.versionId, "detail.s3ObjectDetails.versionId");
  const scanStatus = requireString(event.detail?.scanStatus, "detail.scanStatus");
  const resultStatus = requireString(event.detail?.scanResultDetails?.scanResultStatus, "detail.scanResultDetails.scanResultStatus");
  const reasons = Array.isArray(event.detail?.scanResultDetails?.statusReasons)
    ? event.detail.scanResultDetails.statusReasons.filter((item) => typeof item === "string").slice(0, 5)
    : [];

  if (scanStatus === "COMPLETED" && resultStatus === "NO_THREATS_FOUND") {
    return { ...descriptor, eventId, versionId, verdict: "clean", signature: null, reasons };
  }
  if (scanStatus === "COMPLETED" && resultStatus === "THREATS_FOUND") {
    const signature = event.detail?.scanResultDetails?.threats?.[0]?.name;
    return {
      ...descriptor,
      eventId,
      versionId,
      verdict: "infected",
      signature: typeof signature === "string" ? signature.slice(0, 300) : "malware detectado",
      reasons,
    };
  }
  return {
    ...descriptor,
    eventId,
    versionId,
    verdict: "failed",
    signature: null,
    reasons: [resultStatus, ...reasons].slice(0, 6),
  };
}

export function scanMetadata({ jobId, documentId, sha256, canonicalMime }) {
  return {
    "job-id": String(jobId),
    "document-id": documentId.toLowerCase(),
    sha256,
    "canonical-mime": canonicalMime,
  };
}

export function verifyGuardDutyObjectMetadata(metadata, descriptor) {
  const normalized = Object.fromEntries(
    Object.entries(metadata ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const expected = scanMetadata(descriptor);
  for (const [key, value] of Object.entries(expected)) {
    if (normalized[key] !== value) throw new Error(`Objeto GuardDuty no conserva metadata ${key}`);
  }
  return true;
}

export function sha256Base64(bytes) {
  return createHash("sha256").update(bytes).digest("base64");
}

export async function applyGuardDutyResult({ descriptor, job, headMetadata, completeScan, failScan }) {
  if (!job) throw new Error("Evento GuardDuty sin trabajo de análisis asociado");
  if (String(job.document_id).toLowerCase() !== descriptor.documentId) {
    throw new Error("Evento GuardDuty no corresponde al documento del trabajo");
  }
  if (job.status === "completed") return { disposition: "duplicate", deleteMessage: true };
  if (job.status !== "processing") {
    throw new Error(`Trabajo GuardDuty en estado no procesable: ${job.status}`);
  }
  verifyGuardDutyObjectMetadata(headMetadata, descriptor);

  if (descriptor.verdict === "failed") {
    await failScan({
      jobId: descriptor.jobId,
      error: `GuardDuty no completó el análisis: ${descriptor.reasons.join(", ") || "sin detalle"}`,
    });
    return { disposition: "failed-closed", deleteMessage: true };
  }
  await completeScan({
    jobId: descriptor.jobId,
    sha256: descriptor.sha256,
    canonicalMime: descriptor.canonicalMime,
    clean: descriptor.verdict === "clean",
    error: descriptor.verdict === "infected" ? descriptor.signature : null,
  });
  return {
    disposition: descriptor.verdict === "clean" ? "clean" : "quarantined",
    deleteMessage: true,
  };
}
