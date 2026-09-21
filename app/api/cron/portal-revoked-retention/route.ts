/**
 * /api/cron/portal-revoked-retention — retención de 30 días de un vínculo del
 * Portal revocado (SDD-0477, migr 0460).
 *
 * Decisión de Sam (2026-09-15): un vínculo revocado conserva 30 días el correo
 * y las fechas; después se borran y la fila queda como «Revocado». Todo pasa en
 * la RPC `erase_revoked_portal_access_data`: el plazo con el reloj de la base,
 * los holds de 0301, el tope por corrida y un evento AUD-01 por fila, en una
 * sola transacción. Esta ruta sólo la llama y reporta conteos: nunca correos
 * ni ids.
 *
 * GATE: dry-run por defecto. Borra de verdad sólo si
 * PORTAL_REVOKED_RETENTION_ENABLED === "true" (patrón de purge-receipt-orphans
 * y bitacora-purge-orphans): primero se leen los conteos en los logs, después
 * Sam activa. `?dryRun=1` fuerza dry-run aunque esté activo.
 *
 * Auth: CRON_SECRET en `Authorization: Bearer <secret>` (sólo header, nunca
 * query-param). Idempotente: una fila ya borrada no vuelve a ser elegible.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { matchesBearerSecret } from "@/lib/http/secret-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Filas por corrida. La RPC acepta de 1 a 1000; con 200 al día un pico de
 * revocaciones se vacía en pocas corridas sin una transacción larga.
 */
const ERASE_LIMIT = 200;

type EraseResult = {
  dry_run: boolean;
  retention_days: number;
  cutoff: string;
  limit: number;
  eligible: number;
  held: number;
  erased: number;
  remaining: number;
};

function authorize(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET no configurado" };
  const auth = req.headers.get("authorization");
  if (matchesBearerSecret(auth, secret)) return { ok: true };
  return { ok: false, reason: "Forbidden" };
}

function isEraseResult(data: unknown): data is EraseResult {
  if (!data || typeof data !== "object") return false;
  const r = data as Record<string, unknown>;
  return (
    typeof r.dry_run === "boolean" &&
    typeof r.cutoff === "string" &&
    ["retention_days", "limit", "eligible", "held", "erased", "remaining"].every(
      (k) => typeof r[k] === "number",
    )
  );
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const url = new URL(req.url);
  const forcedDryRun = url.searchParams.get("dryRun") === "1";
  const enabled = process.env.PORTAL_REVOKED_RETENTION_ENABLED === "true";
  const live = enabled && !forcedDryRun;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("erase_revoked_portal_access_data", {
    p_limit: ERASE_LIMIT,
    p_dry_run: !live,
  });
  if (error) {
    return apiError(
      "No se pudo aplicar la retención de vínculos revocados.",
      error,
      500,
      "portal-revoked-retention",
    );
  }
  if (!isEraseResult(data) || data.dry_run === live) {
    return apiError(
      "La retención de vínculos revocados devolvió una respuesta inesperada.",
      new Error("la RPC de retención respondió con otra forma"),
      500,
      "portal-revoked-retention",
    );
  }

  const summary = {
    ok: true,
    mode: live ? "live" : "dry-run",
    retentionDays: data.retention_days,
    cutoff: data.cutoff,
    limit: data.limit,
    eligible: data.eligible,
    held: data.held,
    erased: data.erased,
    remaining: data.remaining,
  };
  console.log("[portal-revoked-retention]", JSON.stringify(summary));
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
