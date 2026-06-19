/**
 * SDD-0096 · POST /p/{token}/upload — el PROVEEDOR sube archivos por el link.
 *
 * Re-subir el Excel llenado (si tuvo problemas online) + fotos del producto +
 * cualquier otro documento. Reusa la tabla `prealerta_documents` + bucket
 * `prealerta-docs` (0118, ampliado en 0147): calca uploadPrealertaDoc del portal
 * (proveedores/actions.ts) server-side con admin client (service_role), pero
 * marcando `source: 'supplier'` y `uploaded_by: null` (anónimo). doc_type se
 * infiere del MIME (imagen→foto, hoja de cálculo→packing, resto→otro).
 *
 * El token es la capability; el route resuelve la compra y escribe con admin
 * (bypassa RLS). Anti-abuso: honeypot + throttle por IP + tope de archivos.
 * app/p/** está fuera de la frontera ESLint (ruta pública Supabase-backed).
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { getPrealertaIdsByToken } from "@/lib/studio/prealertas/queries";
import {
  buildPrealertaDocPath,
  isAllowedPrealertaDocMime,
  prealertaDocExtFromMime,
  inferPrealertaDocType,
  PREALERTA_DOC_BUCKET,
  PREALERTA_DOC_MAX_BYTES,
} from "@/lib/studio/prealertas/types";
import { resolveRequestIp } from "@/lib/http/request-ip";
import { apiError } from "@/lib/http/api-error";

export const runtime = "nodejs";

const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "upload:";
const RL_LIMIT = 40; // archivos-request por IP por ventana
const RL_WINDOW_MINUTES = 60;
const HONEYPOT_FIELD = "empresa_web";
/** Tope de archivos por request (las demás se ignoran). */
const MAX_FILES = 12;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Sube UN archivo del proveedor al bucket + inserta su fila (source 'supplier',
 * uploaded_by null). Rollback del object si el insert falla. Devuelve true si OK.
 */
async function uploadSupplierDoc(
  admin: Admin,
  args: { tenantId: string; prealertaId: string; markbox: string; file: File },
): Promise<boolean> {
  const { file } = args;
  const mime = file.type || "";
  if (!isAllowedPrealertaDocMime(mime)) return false;
  if (file.size <= 0 || file.size > PREALERTA_DOC_MAX_BYTES) return false;

  const ext = prealertaDocExtFromMime(mime);
  const path = buildPrealertaDocPath({
    tenantId: args.tenantId,
    prealertaId: args.prealertaId,
    uuid: randomUUID(),
    ext,
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage
      .from(PREALERTA_DOC_BUCKET)
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (upErr) {
      console.error("[upload supplier] storage error:", upErr);
      return false;
    }

    const docType = inferPrealertaDocType(mime);
    const fileName = (file.name || `${docType}.${ext}`).slice(0, 200);
    const { error: insErr } = await admin.from("prealerta_documents").insert({
      tenant_id: args.tenantId,
      prealerta_id: args.prealertaId,
      client_markbox: args.markbox,
      doc_type: docType,
      storage_path: path,
      file_name: fileName,
      content_type: mime,
      size_bytes: file.size,
      source: "supplier",
      // uploaded_by se omite → null (proveedor anónimo).
    });
    if (insErr) {
      console.error("[upload supplier] insert error:", insErr);
      await admin.storage.from(PREALERTA_DOC_BUCKET).remove([path]);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[upload supplier] unexpected error:", err);
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return apiError("Solicitud inválida.", "formData parse", 400, "upload");
  }

  // Honeypot.
  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim()) {
    return NextResponse.json({ ok: true, uploaded: 0 });
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No recibimos ningún archivo." },
      { status: 400 },
    );
  }

  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return apiError(
      "La subida no está disponible ahora. Intenta más tarde.",
      e,
      503,
      "upload",
    );
  }

  // Throttle por IP (fail-open). Prefijo "upload:".
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
      { error: "Demasiadas subidas desde tu conexión. Intenta más tarde." },
      { status: 429 },
    );
  }
  await admin.from(RL_TABLE).insert({ ip });

  const ids = await getPrealertaIdsByToken(admin, token);
  if (!ids) return new NextResponse("Not found", { status: 404 });

  const results = await Promise.all(
    files.map((file) =>
      uploadSupplierDoc(admin, {
        tenantId: ids.tenantId,
        prealertaId: ids.prealertaId,
        markbox: ids.markbox,
        file,
      }),
    ),
  );
  const uploaded = results.filter(Boolean).length;

  if (uploaded === 0) {
    return NextResponse.json(
      {
        error:
          "No pudimos subir tus archivos. Revisa el formato (imágenes, PDF, Excel) y el tamaño (máx. 15 MB).",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, uploaded });
}
