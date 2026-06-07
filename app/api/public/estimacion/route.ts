/**
 * SDD-0061 Fase B1 — Endpoint público que captura el estimado web en el ERP.
 *
 * POST /api/public/estimacion
 *   body: EstimadoWebPayload (datos de la calc + nota + nombre + teléfono)
 *   → crea una quote source='web', status='draft' ("web · por revisar") con un
 *     código EST-XXXX, y devuelve { ok, estimateCode }.
 *
 * Es el ÚNICO puente público↔ERP de esta feature: las calculadoras NO importan
 * Supabase; le pegan por HTTP a este handler (mismo origen). El handler es FINO:
 * delega validación + mapeo a `lib/public/estimado-web.ts` (lógica pura,
 * boundary-safe) y solo orquesta tenant + correlativo + insert con admin client.
 *
 * El insert corre con service_role (createAdminClient): el visitante es anónimo y
 * necesita bypassear RLS para escribir. quotes NO tiene FORCE RLS → pasa limpio.
 *
 * El estimado queda en el ERP aunque el cliente nunca llegue a enviar el WhatsApp.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import {
  validateEstimadoInput,
  buildEstimadoRow,
  type EstimadoWebPayload,
} from "@/lib/public/estimado-web";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: Partial<EstimadoWebPayload>;
  try {
    payload = (await req.json()) as Partial<EstimadoWebPayload>;
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido." }, { status: 400 });
  }

  // 1. Validar + normalizar (lógica pura).
  const { input, fieldErrors } = validateEstimadoInput(payload);
  if (fieldErrors) {
    return NextResponse.json({ error: "Datos incompletos.", fieldErrors }, { status: 400 });
  }

  // 2. Admin client (service_role). Si la env var falta, no rompemos el flujo del
  //    visitante con un 500 críptico: devolvemos un error claro y el form igual
  //    abre WhatsApp (fallback del lado del cliente).
  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return apiError(
      "El registro del estimado no está disponible ahora.",
      err,
      503,
      "estimacion",
    );
  }

  // 3. Resolver el tenant operativo de DTD (hoy uno solo; mismo patrón que el
  //    registro self-service del portal: primer tenant por created_at).
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantErr || !tenantRow?.id) {
    return apiError(
      "No pudimos registrar tu estimado.",
      tenantErr ?? new Error("no tenant"),
      500,
      "estimacion",
    );
  }
  const tenantId = tenantRow.id;

  // 4. Correlativo EST-YYYY-NNNN.
  const { data: codeData, error: codeErr } = await admin.rpc("next_estimate_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeData) {
    return apiError("No pudimos generar el código del estimado.", codeErr, 500, "estimacion");
  }
  const estimateCode = String(codeData);

  // 5. Insert del estimado web ("web · por revisar").
  const { error: insertErr } = await admin.from("quotes").insert({
    tenant_id: tenantId,
    quote_code: estimateCode,
    ...buildEstimadoRow(input),
  });
  if (insertErr) {
    return apiError("No pudimos registrar tu estimado.", insertErr, 500, "estimacion");
  }

  return NextResponse.json({ ok: true, estimateCode });
}
