/**
 * Export CSV de una rendición (SDD-0069 · decisión #8a). Route handler fino
 * (sin lógica de negocio): resuelve auth + admin + tenant, lee la rendición con
 * sus recibos y devuelve el CSV (`buildRenditionCsv`) como descarga.
 *
 * ADMIN-ONLY (la rendición es compliance del mandato). Usa `apiError` (no filtra
 * el error crudo en prod). El CSV no nombra "Canopy" / "DoorTuDoor Trading".
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { getRenditionWithReceipts } from "@/lib/studio/renditions/queries";
import { buildRenditionCsv } from "@/lib/studio/renditions/rendition-csv";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    const { code: raw } = await ctx.params;
    const code = decodeURIComponent(raw ?? "").trim();
    if (!code) {
      return NextResponse.json({ error: "Falta el código." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    if (!userResp.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { data: link } = await supabase
      .from("user_tenants")
      .select("tenant_id, role")
      .maybeSingle<{ tenant_id: string; role: string }>();
    if (!link?.tenant_id) {
      return NextResponse.json({ error: "Sin tenant." }, { status: 403 });
    }
    if (link.role !== "admin") {
      return NextResponse.json(
        { error: "Solo un administrador puede exportar rendiciones." },
        { status: 403 },
      );
    }

    const data = await getRenditionWithReceipts(supabase, {
      tenantId: link.tenant_id,
      code,
    });
    if (!data) {
      return NextResponse.json(
        { error: "Rendición no encontrada." },
        { status: 404 },
      );
    }

    const csv = buildRenditionCsv(data.rendition, data.lines);
    // BOM para que Excel respete UTF-8 (acentos de los nombres/etiquetas).
    const body = "﻿" + csv.content;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csv.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError("No se pudo exportar la rendición.", err, 500, "rendiciones-export");
  }
}
