/**
 * /api/studio/bugs · POST (crear) · GET (listar)
 *
 * POST: el reportador crea un bug. El endpoint:
 *   1. Resuelve tenant del user logueado
 *   2. Calcula duplicate_hash (si no vino client-side)
 *   3. Busca bug vivo con mismo hash → si match: bug_increment_duplicate + return 200
 *   4. Si no match: next_bug_folio → insert bug_reports → insert bug_tech_data (service_role)
 *      → insert bug_timeline (service_role)
 *
 * GET: lista bugs del tenant (RLS filtra · reporter ve los propios, admin ve todos).
 *      Soporta query params: state, category, module, reporter, q (search), tab.
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  computeBugDedupHash,
  extractStackSignature,
  parseBugAdminFilters,
  validateCreateBugInput,
  type BugConsoleLogEntry,
  type BugNetworkRequestEntry,
  type BugEnvironment,
  type BugReport,
  type CreateBugInput,
} from "@/lib/studio/bug-types";
import {
  findDuplicateBug,
  listBugsForAdmin,
  listBugsForReporter,
} from "@/lib/studio/bug-queries";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────
// GET — listar
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Determinar si el caller es admin del tenant
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return NextResponse.json({ error: "Sin tenant." }, { status: 403 });
  }

  const raw: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => {
    raw[k] = v;
  });
  const filters = parseBugAdminFilters(raw);

  try {
    const bugs =
      link.role === "admin"
        ? await listBugsForAdmin(supabase, filters)
        : await listBugsForReporter(supabase, userResp.user.id);
    return NextResponse.json({ bugs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "No pudimos listar los bugs.", detail: msg },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST — crear
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido — esperamos JSON." },
      { status: 400 },
    );
  }

  const { input, fieldErrors } = validateCreateBugInput(
    body as Partial<CreateBugInput>,
  );
  if (fieldErrors) {
    return NextResponse.json({ error: "Datos inválidos.", fieldErrors }, { status: 400 });
  }
  if (!input) {
    return NextResponse.json({ error: "Input inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();

  if (!link?.tenant_id) {
    return NextResponse.json({ error: "Sin tenant." }, { status: 403 });
  }

  // Computar duplicate_hash si no vino del cliente
  let duplicateHash = input.duplicate_hash ?? null;
  if (!duplicateHash) {
    const stackSig = extractStackSignature(input.console_logs);
    duplicateHash = await computeBugDedupHash(
      input.module,
      input.url,
      stackSig,
    );
  }

  // Check dedup
  const dup = await findDuplicateBug(supabase, link.tenant_id, duplicateHash);
  if (dup) {
    try {
      const { data: incremented, error: incErr } = await supabase.rpc(
        "bug_increment_duplicate",
        { p_original_id: dup.id },
      );
      if (incErr) throw incErr;
      const original = (incremented as unknown as BugReport) ?? dup;
      return NextResponse.json({
        ok: true,
        duplicated: true,
        bug_id: original.id,
        folio: original.folio,
        duplicate_count: original.duplicate_count,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "No pudimos contabilizar el duplicado.", detail: msg },
        { status: 500 },
      );
    }
  }

  // Generar folio
  const { data: folioData, error: folioErr } = await supabase.rpc(
    "next_bug_folio",
    { p_tenant_id: link.tenant_id },
  );
  if (folioErr || !folioData) {
    return NextResponse.json(
      { error: "No pudimos generar folio.", detail: folioErr?.message },
      { status: 500 },
    );
  }
  const folio = folioData as unknown as string;

  // Insert bug_reports (con cliente del user — RLS valida reporter_id == auth.uid)
  const { data: insertedBug, error: insertErr } = await supabase
    .from("bug_reports")
    .insert({
      tenant_id: link.tenant_id,
      folio,
      reporter_id: userResp.user.id,
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      module: input.module,
      url: input.url,
      build_sha: input.build_sha,
      browser_info: input.browser_info ?? {},
      duplicate_hash: duplicateHash,
    })
    .select(
      "id, tenant_id, folio, reporter_id, category, severity, state, progress_pct, title, description, module, url, build_sha, browser_info, duplicate_hash, duplicate_count, duplicate_of_id, eta_days, admin_thanks, commit_url, taken_by, taken_at, resolved_at, discarded_at, created_at, updated_at",
    )
    .single();

  if (insertErr || !insertedBug) {
    return NextResponse.json(
      { error: "No pudimos crear el bug.", detail: insertErr?.message },
      { status: 500 },
    );
  }
  const bug = insertedBug as unknown as BugReport;

  // Insert bug_tech_data + timeline · necesitan service_role (RLS bloquea
  // insert directo a esas tablas para authenticated)
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    // Sin admin client, devolvemos el bug igual pero sin tech_data ni timeline
    return NextResponse.json({
      ok: true,
      duplicated: false,
      bug_id: bug.id,
      folio: bug.folio,
      warning: "tech_data + timeline no se guardaron (admin client no configurado).",
    });
  }

  // tech_data
  await supabaseAdmin.from("bug_tech_data").insert({
    bug_id: bug.id,
    console_logs: (input.console_logs ?? []) as BugConsoleLogEntry[],
    network_requests: (input.network_requests ?? []) as BugNetworkRequestEntry[],
    session_replay_url: input.session_replay_url,
    environment: (input.environment ?? {}) as BugEnvironment,
  });

  // timeline · created
  await supabaseAdmin.from("bug_timeline").insert({
    bug_id: bug.id,
    event_type: "created",
    actor_id: userResp.user.id,
    actor_type: "user",
    payload: { category: bug.category, module: bug.module },
  });

  return NextResponse.json({
    ok: true,
    duplicated: false,
    bug_id: bug.id,
    folio: bug.folio,
  });
}
