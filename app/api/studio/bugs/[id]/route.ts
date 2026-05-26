/**
 * /api/studio/bugs/[id]
 *
 * GET   — detalle completo del bug (reporter ve los propios, admin del tenant todos).
 *         Incluye attachments, tech_data, messages count y timeline count.
 *
 * PATCH — admin del tenant edita campos: severity, eta_days, admin_thanks,
 *         commit_url, duplicate_of_id (manual override).
 *         Para cambiar estado, usar /state endpoint.
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
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

    const [attachments, techData, messages, timeline] = await Promise.all([
      listBugAttachments(supabase, id),
      getBugTechData(supabase, id),
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
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "No pudimos leer el bug.", detail: msg },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const supabase = await createClient();
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
    return NextResponse.json(
      { error: "No pudimos actualizar el bug.", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ bug: data });
}
