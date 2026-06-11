/**
 * Export de evidencia legal (SDD-0067) — JSON para el abogado.
 *
 * GET /api/studio/legal/evidence/[code]
 *   → expediente de UNA aceptación (por acceptance_code AC-YYYY-NNNN):
 *     fila completa + docs aceptadas + `hash_verified` (recomputado server-side
 *     con `hashEvidence`, el MISMO recompute del gate) + datos del cliente
 *     (nombre, Shipping Mark) + metadata de export (exported_at, exported_by).
 *
 * GET /api/studio/legal/evidence/[code]?quote=<ref>
 *   → expediente por OPERACIÓN: TODAS las aceptaciones de esa orden
 *     (quote_code = ref que sella el Portal, normalmente el shipment_code),
 *     array con el mismo formato por item.
 *
 * Auth: ADMIN-ONLY — mismo gating que /studio/legal (sesión + user_tenants
 * role='admin'). Handler FINO: la lógica vive en lib/studio/legal/queries.ts.
 * Errores via apiError() (no filtra detalle crudo en prod).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import {
  getAcceptanceEvidence,
  listAcceptanceEvidenceByQuote,
} from "@/lib/studio/legal/queries";

const TAG = "legal-evidence";
const FORMAT = "dtd-legal-evidence/v2";

/** Nombre de archivo seguro (el código viene de la URL). */
function safeFilename(base: string): string {
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "evidencia";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await ctx.params;
  const code = decodeURIComponent(rawCode ?? "").trim();

  const supabase = await createClient();

  // 1. Sesión.
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) {
    return apiError("No autenticado.", null, 401, TAG);
  }

  // 2. Tenant + rol admin (la capa legal es compliance del dueño).
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) {
    return apiError("Tu cuenta no está vinculada a un tenant.", null, 403, TAG);
  }
  if (link.role !== "admin") {
    return apiError("Solo administradores pueden exportar evidencia.", null, 403, TAG);
  }

  const exportMeta = {
    format: FORMAT,
    exported_at: new Date().toISOString(),
    exported_by: userResp.user.email ?? userResp.user.id,
  };

  const quote = req.nextUrl.searchParams.get("quote")?.trim() ?? "";

  try {
    // Por OPERACIÓN: todas las aceptaciones de la orden (array, mismo formato).
    if (quote) {
      const evidences = await listAcceptanceEvidenceByQuote(supabase, {
        tenantId: link.tenant_id,
        quoteCode: quote,
      });
      return NextResponse.json(
        { ...exportMeta, quote_code: quote, count: evidences.length, evidences },
        {
          headers: {
            "Content-Disposition": `attachment; filename="evidencia-operacion-${safeFilename(quote)}.json"`,
          },
        },
      );
    }

    // Single: una aceptación por su acuse.
    const evidence = await getAcceptanceEvidence(supabase, {
      tenantId: link.tenant_id,
      code,
    });
    if (!evidence) {
      return apiError("No existe esa aceptación.", null, 404, TAG);
    }
    return NextResponse.json(
      { ...exportMeta, evidence },
      {
        headers: {
          "Content-Disposition": `attachment; filename="evidencia-${safeFilename(code)}.json"`,
        },
      },
    );
  } catch (err) {
    return apiError("No pudimos exportar la evidencia.", err, 500, TAG);
  }
}
