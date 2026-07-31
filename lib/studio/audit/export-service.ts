import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUDIT_EXPORT_FIELDS = [
  "id", "entity_type", "entity_id", "actor_type", "event_type",
  "occurred_at", "correlation_id", "source", "result", "sensitivity",
  "schema_version", "timezone",
] as const;
export type AuditExportField = (typeof AUDIT_EXPORT_FIELDS)[number];
type AuditRow = Record<AuditExportField, string | number | null>;

export function neutralizeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeAuditExport(
  format: "csv" | "json" | "ndjson",
  fields: AuditExportField[],
  rows: AuditRow[],
): string {
  const selected = rows.map((row) =>
    Object.fromEntries(fields.map((field) => [field, row[field]])),
  );
  if (format === "json") return JSON.stringify(selected);
  if (format === "ndjson") return selected.map((row) => JSON.stringify(row)).join("\n");
  return [
    fields.map(neutralizeCsvCell).join(","),
    ...selected.map((row) => fields.map((field) => neutralizeCsvCell(row[field])).join(",")),
  ].join("\n");
}

export function auditExportManifest(
  requestId: string,
  format: string,
  fields: AuditExportField[],
  body: string,
  rowCount: number,
) {
  return {
    version: 1,
    request_id: requestId,
    format,
    fields,
    row_count: rowCount,
    sha256: createHash("sha256").update(body).digest("hex"),
    csv_formula_neutralization: format === "csv",
    generated_at: new Date().toISOString(),
  };
}

export async function runNextAuditExport(admin: SupabaseClient) {
  const claim = await admin.rpc("audit_claim_export_job");
  if (claim.error) throw claim.error;
  const job = Array.isArray(claim.data) ? claim.data[0] : null;
  if (!job) return { processed: false as const };
  const requestId = String(job.request_id);
  try {
    const rowsResult = await admin.rpc("audit_export_rows", { p_request_id: requestId });
    if (rowsResult.error || !Array.isArray(rowsResult.data)) throw rowsResult.error ?? new Error("Filas inválidas");
    const fields = job.fields as AuditExportField[];
    const format = job.format as "csv" | "json" | "ndjson";
    const body = serializeAuditExport(format, fields, rowsResult.data as AuditRow[]);
    const manifest = auditExportManifest(requestId, format, fields, body, rowsResult.data.length);
    const path = `${job.tenant_id}/${requestId}/audit.${format}`;
    const contentType = format === "csv" ? "text/csv" : format === "ndjson" ? "application/x-ndjson" : "application/json";
    const uploaded = await admin.storage.from("audit-exports").upload(path, body, { contentType, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const complete = await admin.rpc("audit_complete_export", {
      p_request_id: requestId,
      p_object_path: path,
      p_sha256: manifest.sha256,
      p_row_count: rowsResult.data.length,
      p_size_bytes: Buffer.byteLength(body),
      p_manifest: manifest,
      p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (complete.error) throw complete.error;
    return { processed: true as const, requestId };
  } catch (error) {
    await admin.rpc("audit_fail_export", {
      p_request_id: requestId,
      p_reason: error instanceof Error ? error.message : "Fallo de exportación",
    });
    throw error;
  }
}

export async function expireAuditExports(admin: SupabaseClient) {
  const claimed = await admin.rpc("audit_claim_expired_exports", { p_limit: 25 });
  if (claimed.error) throw claimed.error;
  const jobs = Array.isArray(claimed.data) ? claimed.data : [];
  let expired = 0;
  for (const job of jobs) {
    const removed = await admin.storage.from("audit-exports").remove([String(job.object_path)]);
    if (removed.error) {
      await admin.rpc("audit_fail_export_expiry", {
        p_request_id: job.request_id,
        p_reason: removed.error.message,
      });
      continue;
    }
    const confirmed = await admin.rpc("audit_confirm_export_expired", {
      p_request_id: job.request_id,
    });
    if (confirmed.error) throw confirmed.error;
    expired += 1;
  }
  return { claimed: jobs.length, expired };
}
