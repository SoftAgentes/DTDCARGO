/**
 * /api/studio/bitacora/transcribe · POST — audio del bucket → transcript.
 *
 * Route FINA (sin lógica de negocio, SDD-0146 Fase 3):
 *  (a) sesión Supabase + `moduleEditDenial("bitacora")` (support = read-only → 403;
 *      solo gestores transcriben).
 *  (b) sin las env de Cloudflare → 503 "transcripción no configurada" (pegar texto
 *      sigue vivo; el cliente lo detecta por el status).
 *  (c) valida `path` del body: DEBE ser un audio del tenant del caller
 *      (`{tenant}/bitacora_meeting/{uuid}/{uuid}.(webm|mp4|m4a)`) — rechaza `..`,
 *      otro tenant y extensiones malas → 400.
 *  (d) descarga el objeto con **service-role**: el borrador puede no existir aún en
 *      BD (se crea al analizar), así que la RLS de storage del user no bastaría; el
 *      path ya está acotado al tenant del caller, así que no hay fuga cross-tenant.
 *  (e) `transcribeAudio` → 200 `{ transcript }`; error de CF → 502.
 *
 * `maxDuration = 60`: tope práctico del plan (300s requiere Pro). Un audio de ≤10
 * min (cap duro del cliente) transcribe en Whisper turbo muy por debajo de 60s.
 */

import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  transcribeAudio,
  transcriptionConfigured,
} from "@/lib/studio/bitacora/transcribe";
import {
  BITACORA_BUCKET,
  isValidMeetingAudioPath,
} from "@/lib/studio/bitacora/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // (a) sesión + gate de edición del módulo (support no transcribe).
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return apiError("No autorizado.", null, 401, "bitacora:transcribe");
  }
  const denial = await moduleEditDenial(supabase, "bitacora");
  if (denial) {
    return apiError(denial, null, 403, "bitacora:transcribe");
  }

  // (b) fail-closed si Cloudflare no está configurado.
  if (!transcriptionConfigured()) {
    return apiError(
      "La transcripción de audio no está configurada todavía.",
      null,
      503,
      "bitacora:transcribe",
    );
  }

  // Tenant del caller (para acotar el path al propio tenant).
  const { data: tenantRaw } = await supabase.rpc("get_user_tenant_id");
  const tenantId = tenantRaw ? String(tenantRaw) : "";
  if (!tenantId) {
    return apiError("No se pudo resolver el tenant.", null, 400, "bitacora:transcribe");
  }

  // (c) valida el path.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("JSON inválido.", null, 400, "bitacora:transcribe");
  }
  const path =
    body && typeof body === "object"
      ? (body as { path?: unknown }).path
      : undefined;
  if (!isValidMeetingAudioPath(path, tenantId)) {
    return apiError("Ruta de audio inválida.", null, 400, "bitacora:transcribe");
  }

  // (d) descarga con service-role (el borrador puede no existir aún; el path ya
  // está acotado al tenant del caller → sin fuga cross-tenant). createAdminClient
  // lanza si falta el service_role → 500 limpio (no 500 sin capturar).
  let bytes: ArrayBuffer;
  try {
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage
      .from(BITACORA_BUCKET)
      .download(path as string);
    if (dlErr || !blob) {
      return apiError("No se encontró el audio.", dlErr, 404, "bitacora:transcribe");
    }
    bytes = await blob.arrayBuffer();
  } catch (err) {
    return apiError("No se pudo leer el audio.", err, 500, "bitacora:transcribe");
  }

  // (e) transcribe. Error de CF → 502 (upstream), no filtra el detalle en prod.
  try {
    const transcript = await transcribeAudio(bytes);
    return NextResponse.json({ transcript });
  } catch (err) {
    return apiError(
      "No se pudo transcribir el audio. Reintenta.",
      err,
      502,
      "bitacora:transcribe",
    );
  }
}
