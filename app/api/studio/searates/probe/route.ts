/**
 * /api/studio/searates/probe · POST — consulta puntual de flete marítimo.
 * SDD-0092 Fase 1 (benchmark interno).
 *
 * Superficie de PRUEBA para validar la API de SeaRates desde el Studio (admin),
 * sin exponer el secreto al cliente: el panel de /studio/debug pega a esta ruta
 * y NUNCA a searates.com → la API key vive solo server-side. El rate es
 * referencia para el costing, NO el precio al cliente público.
 *
 * Body: { pointIdFrom, pointIdTo, shippingType, container?, date?, weightKg?,
 * volumeM3? } — variables del request GraphQL de SeaRates (pointId "P_<n>").
 * Auth: ADMIN-ONLY (sesión + user_tenants role='admin'), mismo gating que el
 * resto de superficies del dueño. Handler FINO: la lógica vive en
 * lib/studio/searates/searates-api.ts. Errores via apiError() (tag "searates").
 *
 * Gasta como máximo 1 llamada de rates + (a lo sumo) 1 de auth de la cuota
 * mensual (100/mes). En mock mode (sin SEARATES_API_KEY) responde 200 con
 * { ok:false, error:'mock_no_key' } sin pegar a la red.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { getOceanRate } from "@/lib/studio/searates/searates-api";

export const runtime = "nodejs";

const TAG = "searates";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // 1. Sesión.
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return apiError("No autenticado.", null, 401, TAG);
  }

  // 2. Tenant + rol admin (el benchmark de costing es del dueño).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) {
    return apiError("Tu cuenta no está vinculada a un tenant.", null, 403, TAG);
  }
  if (link.role !== "admin") {
    return apiError("Solo administradores pueden consultar SeaRates.", null, 403, TAG);
  }

  // 3. Body.
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("Body JSON inválido.", null, 400, TAG);
  }

  // 4. Consulta (getOceanRate valida el input internamente y NUNCA tira).
  const rate = await getOceanRate({
    pointIdFrom: body.pointIdFrom,
    pointIdTo: body.pointIdTo,
    shippingType: body.shippingType,
    container: body.container,
    date: body.date,
    weightKg: body.weightKg,
    volumeM3: body.volumeM3,
  });

  // Devolvemos el resultado tal cual (union ok/error con `raw` cuando ok) con
  // 200: el cliente del panel discrimina por `rate.ok`. Los errores de input/
  // proveedor NO son fallos del endpoint, son resultado de la consulta.
  return NextResponse.json({ rate });
}
