/**
 * /api/studio/bugs · POST (crear) · GET (listar)
 *
 * POST: el reportador crea un bug. Lógica core en lib/studio/bug-create.ts
 * (compartida con el server action createBugAction).
 *
 * GET: lista bugs del tenant (RLS filtra · reporter ve los propios, admin ve todos).
 *      Soporta query params: state, category, module, reporter, q (search), tab.
 *
 * SDD-0036 Fase 1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { createBugForReporter } from "@/lib/studio/bug-create";
import {
  parseBugAdminFilters,
  validateCreateBugInput,
  type CreateBugInput,
} from "@/lib/studio/bug-types";
import {
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
    return apiError("No pudimos listar los bugs.", err, 500, "bugs:list");
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

  let supabaseAdmin = null;
  try {
    supabaseAdmin = createAdminClient();
  } catch {
    // sin admin client, tech_data + timeline no se guardan
  }

  const result = await createBugForReporter({
    supabaseUser: supabase,
    supabaseAdmin,
    reporterId: userResp.user.id,
    tenantId: link.tenant_id,
    input,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
