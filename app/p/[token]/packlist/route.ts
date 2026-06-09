/**
 * SDD-0057 ext · Fase 3 — descarga del packing list/factura PRE-LLENADO por compra.
 *
 * GET /p/{token}/packlist → toma el template base (public/templates), le escribe
 * los datos de la compra (唛头/客户/参考号/proveedor/微信) y lo sirve como .xlsx.
 * Es la versión que baja el proveedor desde su página pública: cero edición del
 * shipping mark (sale solo de la cuenta del cliente).
 *
 * Lee la compra por `share_token` con admin client (visitante anónimo). El template
 * base se trae por su URL estática (CDN) — fiable en Vercel, sin depender de fs.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { getProviderShareByToken } from "@/lib/studio/prealertas/queries";
import { fillPacklist } from "@/lib/studio/prealertas/packlist";

export const runtime = "nodejs";

const TEMPLATE_PATH = "/templates/dtd-packing-list-invoice.xlsx";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const admin = createAdminClient();
  const data = await getProviderShareByToken(admin, token);
  if (!data) return new NextResponse("Not found", { status: 404 });

  // Template base desde el CDN (mismo origen). Fiable en serverless (no fs).
  const tplUrl = new URL(TEMPLATE_PATH, req.nextUrl.origin);
  const tplRes = await fetch(tplUrl, { cache: "no-store" });
  if (!tplRes.ok) {
    return new NextResponse("Template no disponible", { status: 502 });
  }
  const templateBytes = new Uint8Array(await tplRes.arrayBuffer());

  let filled: Uint8Array;
  try {
    filled = fillPacklist(templateBytes, {
      markbox: data.markbox,
      clientName: data.clientName ?? "",
      supplierName: data.supplierName ?? "",
      supplierWechat: data.supplierWechat ?? "",
      code: data.code,
    });
  } catch {
    // Si el pre-llenado falla, servimos el template tal cual (el proveedor lo llena).
    filled = templateBytes;
  }

  const fileName = `PackingList-${data.code}.xlsx`;
  return new NextResponse(filled as BodyInit, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
