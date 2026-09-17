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
import {
  getProviderShareByToken,
  getPrealertaIdsByToken,
} from "@/lib/studio/prealertas/queries";
import { fillPacklist } from "@/lib/studio/prealertas/packlist";
import {
  validatePackingListInput,
  type PackingListPayload,
} from "@/lib/studio/prealertas/packlist-form";
import { notifyPackingListToAdmin } from "@/lib/studio/packing-list-notify";
import { resolveRequestIp } from "@/lib/http/request-ip";
import { apiError } from "@/lib/http/api-error";
import { parseDocumentDraft } from "@/lib/shared/document-import";
import { exportDocument } from "@/lib/studio/document-import/export";

export const runtime = "nodejs";

const TEMPLATE_PATH = "/templates/dtd-packing-list-invoice.xlsx";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ── Anti-abuso del POST (envío del form) · reusa portal_registro_throttle ──
const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "packing:";
const RL_LIMIT = 20; // envíos por IP por ventana (el proveedor corrige sin límite real)
const RL_WINDOW_MINUTES = 60;
const HONEYPOT_FIELD = "empresa_web";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const admin = createAdminClient();
  const data = await getProviderShareByToken(admin, token);
  if (!data) return new NextResponse("Not found", { status: 404 });

  const ids = await getPrealertaIdsByToken(admin, token);
  if (!ids) return new NextResponse("Not found", { status: 404 });
  const { data: shared, error: sharedError } = await admin.from("document_workspaces")
    .select("draft,revision,confirmed_revision").eq("prealerta_id",ids.prealertaId).eq("tenant_id",ids.tenantId).maybeSingle();
  if (sharedError && process.env.DOCUMENT_IMPORT_ENABLED === "true") return new NextResponse("Documento compartido no disponible. Intenta de nuevo.",{status:503});
  if (shared) {
    const filled = await exportDocument(parseDocumentDraft(shared.draft),{markbox:data.markbox,code:data.code,confirmed:shared.revision===shared.confirmed_revision,revision:shared.revision});
    return new NextResponse(filled as BodyInit,{headers:{"Content-Type":XLSX_MIME,"Content-Disposition":`attachment; filename="PackingList-${data.code}.xlsx"`,"Cache-Control":"no-store"}});
  }

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
      clientName: "",
      supplierName: data.supplierName ?? "",
      supplierWechat: data.supplierWechat ?? "",
      code: data.code,
    });
  } catch {
    return new NextResponse("No pudimos preparar tu Excel. Intenta de nuevo.", { status: 502 });
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

/**
 * SDD-0096 · POST /p/{token}/packlist — el proveedor ENVÍA su packing list online.
 *
 * Append-only + versionado por orden (prealerta): cada envío crea una versión
 * nueva (la última queda vigente; el equipo ve el historial). El token es la
 * capability; el route resuelve la compra con admin client (service_role) y llama
 * a la RPC submit_packing_list (atómica). Totales RE-SUMADOS server-side (no se
 * confía en el cliente). Anti-abuso: honeypot + throttle por IP.
 *
 * app/p/** está fuera de la frontera ESLint (ruta pública Supabase-backed, como
 * page.tsx) → puede importar lib/db / lib/studio. El form solo hace `fetch`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: PackingListPayload & Record<string, unknown>;
  try {
    body = (await req.json()) as PackingListPayload & Record<string, unknown>;
  } catch {
    return apiError("Solicitud inválida.", "json parse", 400, "packing");
  }

  // Honeypot: bot → ok silencioso sin escribir.
  if (String(body[HONEYPOT_FIELD] ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const { input, fieldErrors } = validatePackingListInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "Revisa los datos del packing list.", fieldErrors },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return apiError(
      "El envío no está disponible ahora. Intenta más tarde.",
      e,
      503,
      "packing",
    );
  }

  // Throttle por IP (fail-open ante error de lectura). Prefijo propio "packing:".
  const ip = RL_IP_PREFIX + resolveRequestIp(req.headers);
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error: rlErr } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);
  if (!rlErr && (count ?? 0) >= RL_LIMIT) {
    return NextResponse.json(
      { error: "Demasiados envíos desde tu conexión. Intenta más tarde." },
      { status: 429 },
    );
  }
  await admin.from(RL_TABLE).insert({ ip });

  // Resolver la compra por token (capability). 404 si el token es inválido.
  const ids = await getPrealertaIdsByToken(admin, token);
  if (!ids) return new NextResponse("Not found", { status: 404 });

  const {data:workspace,error:workspaceError}=await admin.from("document_workspaces")
    .select("id").eq("prealerta_id",ids.prealertaId).eq("tenant_id",ids.tenantId).maybeSingle();
  if (workspace || (workspaceError && process.env.DOCUMENT_IMPORT_ENABLED === "true")) {
    return NextResponse.json({error:workspace?"Esta compra tiene un documento compartido. Actualiza el enlace y confirma la versión revisada.":"No pudimos comprobar el documento compartido. Intenta de nuevo.",code:"shared_document_required"},{status:workspace?409:503});
  }

  const rawIp = resolveRequestIp(req.headers);
  const { data, error: rpcErr } = await admin.rpc("submit_packing_list", {
    p_prealerta_id: ids.prealertaId,
    p_tenant_id: ids.tenantId,
    p_client_markbox: ids.markbox,
    p_currency: input.currency,
    p_doc_date: input.docDate,
    p_supplier_company: input.supplierCompany,
    p_supplier_contact: input.supplierContact,
    p_supplier_email: input.supplierEmail,
    p_supplier_wechat: input.supplierWechat,
    p_supplier_phone: input.supplierPhone,
    p_supplier_address: input.supplierAddress,
    p_supplier_city: input.supplierCity,
    p_supplier_note: input.supplierNote,
    p_rows: input.rows,
    p_total_ctns: input.totals.ctns,
    p_total_qty: input.totals.qty,
    p_total_amount: input.totals.amount,
    p_total_weight: input.totals.weight,
    p_total_cbm: input.totals.cbm,
    p_submit_ip: rawIp,
    p_user_agent: req.headers.get("user-agent"),
  });

  // La RPC devuelve la fila (composite). PostgREST puede darla como objeto o
  // como array de 1 → normalizamos.
  const row = (Array.isArray(data) ? data[0] : data) as {
    folio: string | null;
    version_no: number;
  } | null;
  if (rpcErr || !row) {
    return apiError(
      "No pudimos registrar tu packing list. Intenta de nuevo.",
      rpcErr,
      500,
      "packing",
    );
  }

  // Avisar al equipo (best-effort: la fila YA quedó guardada → no fallar acá).
  try {
    await notifyPackingListToAdmin(admin, ids.tenantId, {
      folio: row.folio ?? "",
      versionNo: row.version_no,
      code: ids.code,
      markbox: ids.markbox,
      supplierCompany: input.supplierCompany,
      supplierContact: input.supplierContact,
      supplierEmail: input.supplierEmail,
      supplierWechat: input.supplierWechat,
      supplierPhone: input.supplierPhone,
      currency: input.currency,
      totalAmount: input.totals.amount,
      totalCtns: input.totals.ctns,
    });
  } catch (e) {
    console.warn("[packing POST] notify falló (la fila ya se guardó):", e);
  }

  const { data: labelState, error: labelError } = await admin.from("prealertas").select("boxes")
    .eq("id", ids.prealertaId).eq("tenant_id", ids.tenantId).maybeSingle();
  return NextResponse.json({
    ok: true,
    labelsNeedReview: Boolean(labelError) || Number(labelState?.boxes) !== input.totals.ctns,
    folio: row.folio,
    versionNo: row.version_no,
  });
}
