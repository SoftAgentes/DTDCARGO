import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ACCOUNT_PATTERN = /^\d{12}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;

const CONTRACT_ARTIFACTS = new Set([
  "customer-agreement",
  "service-terms",
  "dpa",
  "subprocessors",
  "account-acceptance",
  "billing-identity",
]);
const PIPL_ARTIFACTS = new Set([
  "mechanism-decision",
  "impact-assessment",
  "separate-consent-template",
  "consent-register-export",
]);
const PIPL_MECHANISMS = new Set([
  "cac-article-5-exemption",
  "standard-contract",
  "certification",
  "security-assessment",
]);

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto JSON.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} es obligatorio.`);
  }
  return value.trim();
}

function requireAccount(value, expected, label = "accountId") {
  const accountId = requireString(value, label);
  if (!ACCOUNT_PATTERN.test(accountId)) throw new Error(`${label} debe contener 12 dígitos.`);
  if (expected && accountId !== expected) throw new Error(`${label} no coincide con la cuenta esperada.`);
  return accountId;
}

function requireRecentIso(value, label, now, maxAgeMs) {
  const raw = requireString(value, label);
  const timestamp = Date.parse(raw);
  const nowMs = now.getTime();
  if (!Number.isFinite(timestamp)) throw new Error(`${label} no contiene una fecha ISO válida.`);
  if (timestamp > nowMs + CLOCK_SKEW_MS) throw new Error(`${label} está en el futuro.`);
  if (nowMs - timestamp > maxAgeMs) throw new Error(`${label} está vencida.`);
  return new Date(timestamp).toISOString();
}

function requireValidationObject(value, label) {
  const key = requireString(value?.key, `${label}.key`);
  const versionId = requireString(value?.versionId, `${label}.versionId`);
  if (!/^validation\/[0-9a-f-]{36}\/[a-z0-9.-]+$/i.test(key)) {
    throw new Error(`${label}.key no pertenece al prefijo sintético validation/.`);
  }
  return { key, versionId };
}

export function assertExternalEvidencePath(value, repoRoot = process.cwd()) {
  const raw = requireString(value, "ruta de evidencia");
  if (!isAbsolute(raw)) throw new Error("La ruta de evidencia debe ser absoluta.");
  const absolute = resolve(raw);
  const relativePath = relative(resolve(repoRoot), absolute);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    throw new Error("La evidencia debe permanecer fuera del repositorio.");
  }
  return absolute;
}

export async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readExternalJson(path, repoRoot = process.cwd()) {
  const absolute = assertExternalEvidencePath(path, repoRoot);
  let parsed;
  try {
    parsed = JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    throw new Error(`No se pudo leer evidencia JSON ${absolute}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { absolute, document: assertObject(parsed, "evidencia"), sha256: await sha256File(absolute) };
}

async function verifyArtifacts(artifacts, requiredKinds, repoRoot) {
  if (!Array.isArray(artifacts)) throw new Error("artifacts debe ser una lista.");
  const byKind = new Map();
  for (const item of artifacts) {
    assertObject(item, "artifact");
    const kind = requireString(item.kind, "artifact.kind");
    if (byKind.has(kind)) throw new Error(`Artifact duplicado: ${kind}.`);
    const path = assertExternalEvidencePath(item.path, repoRoot);
    const expectedHash = requireString(item.sha256, `artifact ${kind}.sha256`).toLowerCase();
    if (!SHA256_PATTERN.test(expectedHash)) throw new Error(`Artifact ${kind} no tiene SHA-256 válido.`);
    const actualHash = await sha256File(path);
    if (actualHash !== expectedHash) throw new Error(`Artifact ${kind} cambió: SHA-256 no coincide.`);
    byKind.set(kind, { kind, path, sha256: actualHash });
  }
  const missing = [...requiredKinds].filter((kind) => !byKind.has(kind));
  if (missing.length) throw new Error(`Faltan artifacts: ${missing.join(", ")}.`);
  return [...byKind.values()];
}

export function validateLiveValidationReceipt(value, expected, options = {}) {
  const receipt = assertObject(value, "receipt AWS");
  const now = options.now instanceof Date ? options.now : new Date();
  if (receipt.schemaVersion !== 1 || receipt.ok !== true || receipt.syntheticOnly !== true) {
    throw new Error("Receipt AWS no acredita un simulacro sintético exitoso.");
  }
  requireAccount(receipt.accountId, expected.accountId, "receipt.accountId");
  if (receipt.region !== expected.region) throw new Error("Receipt AWS pertenece a otra región.");
  if (receipt.scanBucket !== expected.scanBucket || receipt.backupBucket !== expected.backupBucket) {
    throw new Error("Receipt AWS pertenece a otros buckets.");
  }
  const completedAt = requireRecentIso(receipt.completedAt, "receipt.completedAt", now, DAY_MS);
  if (receipt.cleanScan?.status !== "NO_THREATS_FOUND") throw new Error("Receipt AWS no acredita archivo limpio.");
  if (receipt.eicarScan?.status !== "THREATS_FOUND") throw new Error("Receipt AWS no acredita EICAR.");
  const cleanObject = requireValidationObject(receipt.cleanScan, "receipt.cleanScan");
  const eicarObject = requireValidationObject(receipt.eicarScan, "receipt.eicarScan");
  if (receipt.objectLock?.mode !== "COMPLIANCE" || receipt.objectLock?.deleteDenied !== true) {
    throw new Error("Receipt AWS no acredita Object Lock COMPLIANCE y borrado denegado.");
  }
  const backupObject = requireValidationObject(receipt.objectLock, "receipt.objectLock");
  const retainUntilMs = Date.parse(receipt.objectLock.retainUntil ?? "");
  if (!Number.isFinite(retainUntilMs) || retainUntilMs < now.getTime() + 9 * 365 * DAY_MS) {
    throw new Error("Receipt AWS no acredita retención Object Lock cercana a diez años.");
  }
  if (!SHA256_PATTERN.test(receipt.restore?.sha256 ?? "")
      || receipt.restore.sha256 !== receipt.restore.expectedSha256) {
    throw new Error("Receipt AWS no acredita restore byte-idéntico.");
  }
  if (!Number.isFinite(receipt.rpoMs) || receipt.rpoMs < 0 || receipt.rpoMs > 60 * 60 * 1_000) {
    throw new Error("Receipt AWS excede RPO de una hora.");
  }
  if (!Number.isFinite(receipt.rtoMs) || receipt.rtoMs < 0 || receipt.rtoMs > 4 * 60 * 60 * 1_000) {
    throw new Error("Receipt AWS excede RTO de cuatro horas.");
  }
  return {
    completedAt,
    rpoMs: receipt.rpoMs,
    rtoMs: receipt.rtoMs,
    cleanObject,
    eicarObject,
    backupObject,
    retainUntil: new Date(retainUntilMs).toISOString(),
    restoreSha256: receipt.restore.sha256,
  };
}

export async function validateContractEvidence(value, expected, options = {}) {
  const receipt = assertObject(value, "evidencia contractual");
  const now = options.now instanceof Date ? options.now : new Date();
  if (receipt.schemaVersion !== 1) throw new Error("Evidencia contractual usa otro schemaVersion.");
  requireAccount(receipt.accountId, expected.accountId, "contrato.accountId");
  if (receipt.legalEntity !== "INVERSIONES DTD SERVICES, C.A.") {
    throw new Error("La identidad contractual no coincide con la sociedad.");
  }
  if (receipt.accountCountry !== "VE") throw new Error("La cuenta contractual no está registrada en Venezuela.");
  if (receipt.contractingParty !== "Amazon Web Services, Inc.") {
    throw new Error("La parte contractual AWS no coincide con la selección aprobada.");
  }
  requireString(receipt.acceptedByRole, "contrato.acceptedByRole");
  const acceptedAt = requireRecentIso(receipt.acceptedAt, "contrato.acceptedAt", now, 10 * 366 * DAY_MS);
  const reviewedAt = requireRecentIso(receipt.reviewedAt, "contrato.reviewedAt", now, 366 * DAY_MS);
  const artifacts = await verifyArtifacts(receipt.artifacts, CONTRACT_ARTIFACTS, options.repoRoot ?? process.cwd());
  return { acceptedAt, reviewedAt, artifacts };
}

export async function validatePiplEvidence(value, expected, options = {}) {
  const receipt = assertObject(value, "evidencia PIPL");
  const now = options.now instanceof Date ? options.now : new Date();
  if (receipt.schemaVersion !== 1) throw new Error("Evidencia PIPL usa otro schemaVersion.");
  requireAccount(receipt.accountId, expected.accountId, "pipl.accountId");
  if (receipt.scope !== "china-personal-data") throw new Error("La decisión PIPL no cubre datos personales originados en China.");
  if (!PIPL_MECHANISMS.has(receipt.mechanism)) throw new Error("La decisión PIPL no identifica un mecanismo admitido.");
  if (receipt.impactAssessmentCompleted !== true) throw new Error("La evaluación de impacto PIPL no está completada.");
  if (receipt.separateConsentVerified !== true) throw new Error("El consentimiento separado PIPL no está verificado.");
  requireString(receipt.approvedByRole, "pipl.approvedByRole");
  const decidedAt = requireRecentIso(receipt.decidedAt, "pipl.decidedAt", now, 366 * DAY_MS);
  const artifacts = await verifyArtifacts(receipt.artifacts, PIPL_ARTIFACTS, options.repoRoot ?? process.cwd());
  return { decidedAt, mechanism: receipt.mechanism, artifacts };
}
