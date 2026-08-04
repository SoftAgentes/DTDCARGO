#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CORE_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DTD_ATTACHMENTS_AV_URL",
  "DTD_ATTACHMENTS_AV_TOKEN",
  "DTD_ATTACHMENTS_BACKUP_ENDPOINT",
  "DTD_ATTACHMENTS_BACKUP_REGION",
  "DTD_ATTACHMENTS_BACKUP_BUCKET",
  "DTD_ATTACHMENTS_BACKUP_ACCESS_KEY_ID",
  "DTD_ATTACHMENTS_BACKUP_SECRET_ACCESS_KEY",
];

const PRODUCTION_EVIDENCE = [
  "DTD_ATTACHMENTS_AV_PROVIDER",
  "DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT",
  "DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT",
  "DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT",
  "DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT",
];

const DAY_MS = 24 * 60 * 60 * 1_000;
const RESTORE_EVIDENCE_MAX_AGE_MS = 93 * DAY_MS;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;

export class AttachmentsPreflightError extends Error {
  constructor(issues) {
    super(`Preflight de adjuntos bloqueado: ${issues.join("; ")}`);
    this.name = "AttachmentsPreflightError";
    this.issues = issues;
  }
}

function isPresent(env, key) {
  return typeof env[key] === "string" && env[key].trim().length > 0;
}

function validateEndpoint(env, key, production, issues) {
  if (!isPresent(env, key)) return;
  let endpoint;
  try {
    endpoint = new URL(env[key]);
  } catch {
    issues.push(`${key} no es una URL válida`);
    return;
  }
  if (endpoint.username || endpoint.password) {
    issues.push(`${key} no puede incluir credenciales`);
  }
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]).has(endpoint.hostname);
  if (endpoint.protocol !== "https:" && (production || !loopback)) {
    issues.push(`${key} debe usar HTTPS${production ? " en Producción" : " fuera de loopback"}`);
  }
}

function validateTimestamp(env, key, nowMs, maxAgeMs, issues) {
  if (!isPresent(env, key)) return;
  const value = Date.parse(env[key]);
  if (!Number.isFinite(value)) {
    issues.push(`${key} no contiene una fecha ISO válida`);
    return;
  }
  if (value > nowMs + CLOCK_SKEW_MS) {
    issues.push(`${key} está en el futuro`);
    return;
  }
  if (nowMs - value > maxAgeMs) {
    issues.push(`${key} está vencida`);
  }
}

export function inspectAttachmentsWorkerEnv(env = process.env, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new TypeError("options.now debe ser una fecha válida");

  const issues = [];
  const production = env.NODE_ENV === "production";

  if (env.DTD_ATTACHMENTS_WORKER_ALLOW !== "1") {
    issues.push("DTD_ATTACHMENTS_WORKER_ALLOW debe ser 1");
  }

  const missingCore = CORE_REQUIRED.filter((key) => !isPresent(env, key));
  if (missingCore.length) issues.push(`faltan ${missingCore.join(", ")}`);

  validateEndpoint(env, "NEXT_PUBLIC_SUPABASE_URL", production, issues);
  validateEndpoint(env, "DTD_ATTACHMENTS_AV_URL", production, issues);
  validateEndpoint(env, "DTD_ATTACHMENTS_BACKUP_ENDPOINT", production, issues);

  if (env.DTD_ATTACHMENTS_AV_PROVIDER?.trim().toLowerCase() === "aws-guardduty-s3") {
    issues.push(
      "DTD_ATTACHMENTS_AV_PROVIDER=aws-guardduty-s3 requiere el adaptador EventBridge/SQS",
    );
  }

  if (production) {
    if (env.DTD_ATTACHMENTS_GASTOS_PILOT !== "1") {
      issues.push("DTD_ATTACHMENTS_GASTOS_PILOT debe ser 1 en Producción");
    }
    if (env.DTD_ATTACHMENTS_PRODUCTION_CONFIRMED !== "1") {
      issues.push("DTD_ATTACHMENTS_PRODUCTION_CONFIRMED debe ser 1 en Producción");
    }
    const missingEvidence = PRODUCTION_EVIDENCE.filter((key) => !isPresent(env, key));
    if (missingEvidence.length) issues.push(`faltan evidencias ${missingEvidence.join(", ")}`);

    validateTimestamp(env, "DTD_ATTACHMENTS_AV_SIGNATURE_UPDATED_AT", nowMs, DAY_MS, issues);
    validateTimestamp(env, "DTD_ATTACHMENTS_AV_EICAR_VERIFIED_AT", nowMs, DAY_MS, issues);
    validateTimestamp(env, "DTD_ATTACHMENTS_OBJECT_LOCK_VERIFIED_AT", nowMs, RESTORE_EVIDENCE_MAX_AGE_MS, issues);
    validateTimestamp(env, "DTD_ATTACHMENTS_RESTORE_DRILL_VERIFIED_AT", nowMs, RESTORE_EVIDENCE_MAX_AGE_MS, issues);
  }

  return {
    ok: issues.length === 0,
    production,
    issues,
    checks: {
      explicitWorkerAllow: env.DTD_ATTACHMENTS_WORKER_ALLOW === "1",
      coreConfiguration: missingCore.length === 0,
      productionEvidence: !production || PRODUCTION_EVIDENCE.every((key) => isPresent(env, key)),
    },
  };
}

export function assertAttachmentsWorkerStartup(env = process.env, options = {}) {
  const result = inspectAttachmentsWorkerEnv(env, options);
  if (!result.ok) throw new AttachmentsPreflightError(result.issues);
  return {
    ok: true,
    production: result.production,
    checks: result.checks,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    console.log(JSON.stringify(assertAttachmentsWorkerStartup()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
