import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { AUDIT_EXPORT_FIELDS, runNextAuditExport } from "@/lib/studio/audit/export-service";

function sameSecret(actual: string | null, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    if (!sameSecret(authorization.slice(7), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    try {
      return NextResponse.json(await runNextAuditExport(createAdminClient()));
    } catch {
      return NextResponse.json({ error: "Falló el job de exportación" }, { status: 500 });
    }
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const supabase = await createClient();
  if (body.action === "approve") {
    const { data, error } = await supabase.rpc("audit_approve_export", {
      p_request_id: String(body.requestId ?? ""), p_reason: String(body.reason ?? ""),
    });
    return error ? NextResponse.json({ error: "No se pudo aprobar" }, { status: error.code === "42501" ? 403 : 400 }) : NextResponse.json({ ok: data });
  }
  const fields = Array.isArray(body.fields) ? body.fields.filter((value): value is string => typeof value === "string") : [];
  if (!fields.every((field) => (AUDIT_EXPORT_FIELDS as readonly string[]).includes(field))) {
    return NextResponse.json({ error: "Campos inválidos" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("audit_request_export", {
    p_format: String(body.format ?? ""),
    p_filters: typeof body.filters === "object" && body.filters ? body.filters : {},
    p_fields: fields,
    p_justification: String(body.justification ?? ""),
  });
  return error ? NextResponse.json({ error: "No se pudo solicitar" }, { status: error.code === "42501" ? 403 : 400 }) : NextResponse.json({ requestId: data }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const requestId = request.nextUrl.searchParams.get("id");
  if (!requestId) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const supabase = await createClient();
  const authorized = await supabase.rpc("audit_authorize_export_download", { p_request_id: requestId });
  if (authorized.error || typeof authorized.data !== "string") {
    return NextResponse.json({ error: "Exportación no disponible" }, { status: 403 });
  }
  const signed = await createAdminClient().storage.from("audit-exports").createSignedUrl(authorized.data, 15 * 60);
  if (signed.error) return NextResponse.json({ error: "No se pudo firmar la descarga" }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl, 303);
}

