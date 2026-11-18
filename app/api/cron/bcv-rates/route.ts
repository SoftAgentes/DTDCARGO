import { NextResponse, type NextRequest } from "next/server";
import { matchesBearerSecret } from "@/lib/http/secret-compare";
import { parseBcvDryRun, syncBcvRates } from "@/lib/studio/fx/bcv-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Header exclusivo; auth/query/normalOFF se resuelven antes de crear cliente o IO. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!matchesBearerSecret(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  let dryRun: boolean;
  try { dryRun = parseBcvDryRun(new URL(request.url).searchParams); }
  catch { return NextResponse.json({ status: "REJECTED", reason: "INVALID_QUERY" }, { status: 400, headers }); }
  const summary = await syncBcvRates({ enabled: process.env.BCV_RATES_ENABLED === "true", dryRun,
    scope: process.env.BCV_RATE_TENANT_IDS, signal: request.signal });
  return NextResponse.json(summary, { status: summary.status === "REJECTED" ? 503
    : summary.status === "PARTIAL" ? 207 : 200, headers });
}
