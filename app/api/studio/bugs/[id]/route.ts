/**
 * /api/studio/bugs/[id]
 *
 * GET   — detalle completo del bug (reporter ve los propios, admin del tenant todos).
 *         Incluye attachments, messages y timeline. `tech_data` SOLO se devuelve
 *         si el caller es admin del tenant del bug (D3 + P1-1 codex review).
 *
 * PATCH — admin del tenant edita campos: severity, eta_days, admin_thanks,
 *         commit_url, duplicate_of_id (manual override).
 *         Para cambiar estado, usar /state endpoint.
 *
 * SDD-0036 Fase 1 + P1-1 fix.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import {
  getBugDetail,
  getBugTechData,
  listBugAttachments,
  listBugMessages,
  listBugTimeline,
} from "@/lib/studio/bug-queries";
import type { BugSeverity } from "@/lib/studio/bug-types";

export const runtime = "nodejs";

type AdminPatchPayload = {
  severity?: BugSeverity | null;
  eta_days?: number | null;
  admin_thanks?: string | null;
  commit_url?: string | null;
  duplicate_of_id?: string | null;
};

const PATCHABLE_FIELDS: (keyof AdminPatchPayload)[] = [
  "severity",
  "eta_days",
  "admin_thanks",
  "commit_url",
  "duplicate_of_id",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const bug = await getBugDetail(supabase, id);
    if (!bug) {
      return NextResponse.json({ error: "Bug no encontrado." }, { status: 404 });
    }

    // P1-1 (codex review): tech_data SOLO si caller es admin del tenant DEL BUG.
    // Reporter no ve sus propios datos tecnicos (consistente con D3 invisible
    // auto-capture). Validamos antes de pedir tech_data para no inflar el query
    // si va a ser descartado.
    const { data: tenantLink } = await supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", userResp.user.id)
      .eq("tenant_id", bug.tenant_id)
      .is("disabled_at", null)
      .maybeSingle<{ role: string }>();

    const isAdminOfBugTenant = tenantLink?.role === "admin";

    const [attachments, techData, messages, timeline] = await Promise.all([
      listBugAttachments(supabase, id),
      isAdminOfBugTenant ? getBugTechData(supabase, id) : Promise.resolve(null),
      listBugMessages(supabase, id),
      listBugTimeline(supabase, id),
    ]);

    return NextResponse.json({
      bug,
      attachments,
      tech_data: techData,
      messages,
      timeline,
    });
  } catch (err) {
    return apiError("No pudimos leer el bug.", err, 500, "bugs:get");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  let raw: Partial<AdminPatchPayload>;
  try {
    raw = (await request.json()) as Partial<AdminPatchPayload>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const update: Partial<AdminPatchPayload> = {};
  for (const key of PATCHABLE_FIELDS) {
    if (key in raw) update[key] = raw[key] as never;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios para guardar." }, { status: 400 });
  }

  // Validar eta_days
  if (update.eta_days !== undefined && update.eta_days !== null) {
    const n = Number(update.eta_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      return NextResponse.json(
        { error: "ETA inválido (entero 0-365)." },
        { status: 400 },
      );
    }
    update.eta_days = n;
  }
  if (
    update.severity &&
    !["baja", "media", "alta", "critica"].includes(update.severity)
  ) {
    return NextResponse.json({ error: "Severidad inválida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Bug no encontrado." }, { status: 404 });
    }
    // RLS rechaza si no es admin
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "Solo admins pueden editar bugs." },
        { status: 403 },
      );
    }
    return apiError("No pudimos actualizar el bug.", error, 500, "bugs:patch");
  }

  return NextResponse.json({ bug: data });
}
