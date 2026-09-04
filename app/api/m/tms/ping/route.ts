/**
 * POST /api/m/tms/ping — GPS live del camión (Sprint 3 · plan v3).
 *
 * Recibe pings cada 30s desde el camionero PWA (`navigator.geolocation.
 * watchPosition` → POST). Insert en `tms_truck_locations` con el
 * `truck_id` resuelto desde el driver linkeado del operario.
 *
 * Auth: cookie `dtd_op` (operario PIN). NO Supabase auth.
 * Rate limit: max 1 ping / 25s por driver (defensive · evita storms).
 *
 * Body shape:
 *  {
 *    lat: number,
 *    lng: number,
 *    accuracy_m: number | null,
 *    source: "watch" | "manual"
 *  }
 *
 * Errors:
 *  - 401 sin sesión / sin tms_driver_id linkeado
 *  - 403 modo activo no es camionero/supervisor
 *  - 422 payload inválido (lat/lng fuera de rango, NaN)
 *  - 429 rate limit
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { createRequestLogger } from "@/lib/observability/structured-logger";

const RATE_LIMIT_SEC = 25;

export async function POST(req: Request) {
  const logger = createRequestLogger(req, "api.m.tms.ping");
  const respond = (body: Record<string, unknown>, status = 200) =>
    logger.withResponse(NextResponse.json(body, { status }));

  const session = await getCurrentOperario();
  if (!session) {
    return respond({ error: "Sesión inválida." }, 401);
  }
  if (session.region !== "ve") {
    return respond({ error: "Solo operarios VE." }, 403);
  }
  const activeMode = session.current_mode ?? session.role;
  if (activeMode !== "camionero" && activeMode !== "supervisor") {
    return respond({ error: "Modo activo no permite GPS del camión." }, 403);
  }
  if (!session.tms_driver_id) {
    return respond({ error: "Operario sin driver TMS linkeado." }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Body inválido." }, 422);
  }

  if (!body || typeof body !== "object") {
    return respond({ error: "Body inválido." }, 422);
  }
  const { lat, lng, accuracy_m, source } = body as {
    lat?: unknown;
    lng?: unknown;
    accuracy_m?: unknown;
    source?: unknown;
  };

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return respond({ error: "lat/lng fuera de rango." }, 422);
  }
  const accNum =
    accuracy_m == null
      ? null
      : Number.isFinite(Number(accuracy_m))
        ? Math.min(Math.max(0, Number(accuracy_m)), 100_000)
        : null;
  const sourceClean: "camionero_ping" | "manual" =
    source === "manual" ? "manual" : "camionero_ping";

  const admin = createAdminClient();

  // 1. Resolver truck_id del driver (linkeado via tms_trucks.driver_id).
  // tms_truck_locations.truck_id es NOT NULL · si no hay truck linkeado,
  // no podemos persistir el ping. La UI muestra warning al camionero.
  const { data: truck } = await admin
    .from("tms_trucks")
    .select("id")
    .eq("tenant_id", session.tenant_id)
    .eq("driver_id", session.tms_driver_id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!truck?.id) {
    return respond(
      { error: "Sin camión TMS linkeado a tu cuenta · pídele al admin que lo asigne." },
      412,
    );
  }
  const truckId = truck.id;

  // 2. Rate limit: chequear último ping del driver
  const { data: lastPing } = await admin
    .from("tms_truck_locations")
    .select("recorded_at")
    .eq("tenant_id", session.tenant_id)
    .eq("driver_id", session.tms_driver_id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ recorded_at: string }>();

  if (lastPing?.recorded_at) {
    const elapsedSec =
      (Date.now() - new Date(lastPing.recorded_at).getTime()) / 1000;
    if (elapsedSec < RATE_LIMIT_SEC) {
      return respond(
        {
          error: `Rate limit · espera ${Math.ceil(
            RATE_LIMIT_SEC - elapsedSec,
          )}s antes del próximo ping.`,
        },
        429,
      );
    }
  }

  // 3. Insert location
  const { error } = await admin.from("tms_truck_locations").insert({
    tenant_id: session.tenant_id,
    truck_id: truckId,
    driver_id: session.tms_driver_id,
    lat: latNum,
    lng: lngNum,
    accuracy_m: accNum,
    source: sourceClean,
  });

  if (error) {
    logger.error("mobile_tms.location_write_failed", {
      error,
      operation: "ping",
      stage: "insert",
    });
    return respond({ error: "No se pudo guardar GPS." }, 500);
  }

  return respond({ ok: true, truck_id: truckId });
}
