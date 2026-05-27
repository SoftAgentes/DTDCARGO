/**
 * Endpoints /api/studio/bugs/[id]/replay
 *
 * POST: recibe el blob de rrweb session replay del client (gzipeado) y lo
 *   sube al bucket `bug-replays`. Actualiza `bug_tech_data.session_replay_url`
 *   con la storage key (no URL pública).
 *
 * GET: devuelve una signed URL temporal del replay para que el admin pueda
 *   descargarlo desde el drawer (TTL 10 min).
 *
 * Auth: caller debe ser el reporter del bug (o admin del tenant). El bug
 * id viene del path. RLS de bug_reports valida.
 *
 * POST body: multipart/form-data con field `replay` (blob, max 10 MB).
 *
 * Best-effort: si falla el upload, NO rompe el flow del bug. Solo log y
 * 5xx — el bug ya está creado, solo queda sin replay.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";

const MAX_REPLAY_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["application/gzip", "application/json"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bugId } = await params;
  if (!bugId) {
    return NextResponse.json({ error: "Falta bug id." }, { status: 400 });
  }

  // Auth — necesitamos el user logueado
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Validar que el bug existe + caller tiene acceso (reporter o admin
  // del tenant). RLS de bug_reports ya filtra; si la query devuelve null
  // es porque no tiene acceso.
  const { data: bug, error: bugErr } = await supabase
    .from("bug_reports")
    .select("id, reporter_id, tenant_id")
    .eq("id", bugId)
    .maybeSingle<{ id: string; reporter_id: string; tenant_id: string }>();

  if (bugErr || !bug) {
    return NextResponse.json(
      { error: "Bug no encontrado o sin acceso." },
      { status: 404 },
    );
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — esperamos multipart/form-data." },
      { status: 400 },
    );
  }

  const replay = formData.get("replay");
  if (!(replay instanceof Blob)) {
    return NextResponse.json(
      { error: "Falta el field 'replay' con el blob." },
      { status: 400 },
    );
  }
  if (replay.size === 0) {
    return NextResponse.json(
      { error: "Blob vacío — nada que subir." },
      { status: 400 },
    );
  }
  if (replay.size > MAX_REPLAY_SIZE) {
    return NextResponse.json(
      { error: `Replay demasiado grande (max ${MAX_REPLAY_SIZE} bytes).` },
      { status: 413 },
    );
  }
  if (replay.type && !ALLOWED_TYPES.has(replay.type)) {
    return NextResponse.json(
      { error: `Content-type no permitido: ${replay.type}` },
      { status: 415 },
    );
  }

  // Storage path: bug-replays bucket, key = <bug_id>.json.gz
  const extension = replay.type === "application/json" ? "json" : "json.gz";
  const storageKey = `${bugId}.${extension}`;

  // Upload via admin client (service_role bypassa RLS del bucket)
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client no configurado." },
      { status: 500 },
    );
  }

  const { error: uploadErr } = await admin.storage
    .from("bug-replays")
    .upload(storageKey, replay, {
      contentType: replay.type || "application/gzip",
      upsert: true, // si ya existe (reintento), reemplaza
    });

  if (uploadErr) {
    console.error(`[bug-replay] upload failed for ${bugId}:`, uploadErr.message);
    return NextResponse.json(
      { error: `No se pudo subir el replay: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  // Update bug_tech_data.session_replay_url (storage key, no URL pública)
  const { error: updateErr } = await admin
    .from("bug_tech_data")
    .update({ session_replay_url: storageKey })
    .eq("bug_id", bugId);

  if (updateErr) {
    console.error(
      `[bug-replay] update bug_tech_data failed for ${bugId}:`,
      updateErr.message,
    );
    // No es fatal: el replay está en el bucket, solo no se reflejó en DB.
    // Cleanup nightly puede detectar orfandad o admin puede re-asociar.
    return NextResponse.json(
      {
        ok: true,
        warning: "Replay subido pero no se pudo asociar al bug en DB.",
        storage_key: storageKey,
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true, storage_key: storageKey });
}

// ─────────────────────────────────────────────────────────────
// GET /replay — signed URL del blob para el player admin
// ─────────────────────────────────────────────────────────────

const SIGNED_TTL_SECONDS = 600; // 10 min

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bugId } = await params;
  if (!bugId) {
    return NextResponse.json({ error: "Falta bug id." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Validar acceso al bug + leer storage key.
  // RLS de bug_reports filtra a reporter o admin del tenant. Y la RLS de
  // bug_tech_data espeja la de bug_reports (ver migración 0028).
  const { data: tech, error: techErr } = await supabase
    .from("bug_tech_data")
    .select("session_replay_url")
    .eq("bug_id", bugId)
    .maybeSingle<{ session_replay_url: string | null }>();

  if (techErr) {
    return NextResponse.json(
      { error: "Bug no encontrado o sin acceso." },
      { status: 404 },
    );
  }
  if (!tech?.session_replay_url) {
    return NextResponse.json(
      { error: "Sin replay registrado para este bug." },
      { status: 404 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client no configurado." },
      { status: 500 },
    );
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("bug-replays")
    .createSignedUrl(tech.session_replay_url, SIGNED_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    console.error(`[bug-replay GET] sign failed:`, signErr?.message);
    return NextResponse.json(
      { error: "No se pudo generar URL signed." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    signed_url: signed.signedUrl,
    expires_in: SIGNED_TTL_SECONDS,
    storage_key: tech.session_replay_url,
    is_gzipped: tech.session_replay_url.endsWith(".gz"),
  });
}
