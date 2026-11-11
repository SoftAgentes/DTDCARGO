"use server";

/**
 * Server actions del Portal · Compras (prealertas) + Proveedores (SDD-0057,
 * Slice B). El cliente del portal CRUD de SUS proveedores y crea SUS compras.
 *
 * IDENTIDAD + AISLAMIENTO (SDD-0549): resolvemos UNA vez el principal Portal
 * de la sesión (`getPortalClientPrincipal`) y scopeamos TODO por su tenant y su
 * Shipping Mark. El Shipping Mark es único POR tenant y la policy «by tenant» es
 * permisiva: sin el tenant, una sesión híbrida (equipo de otro tenant + cliente
 * Portal) leía y editaba proveedores y compras del mismo Shipping Mark ajeno.
 * Las RPC `get_portal_client_markbox()` / `get_portal_client_tenant()` ya no se
 * usan aquí. La RLS del Portal (0105, endurecida por 0417/0434) permite que el
 * cliente escriba directo, así que usamos el client de SESIÓN (`createClient`) —
 * el service_role queda de respaldo en la policy.
 *
 * Validación manual con `validate*Input` (sin Zod, patrón del repo). El alta de
 * la compra arma el código del Norte `DTD-{clientNo}-{supplier_seq}-{order_seq}`
 * vía las RPCs `next_supplier_seq` / `next_order_seq` y REINTENTA ante un choque
 * del `unique(tenant, code)` (23505), recomputando el order_seq.
 */

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  validateSupplierInput,
  validatePrealertaInput,
  normalizeClientNote,
  normalizeSupplierProfileInput,
  supplierProfileRow,
  buildPrealertaCode,
  buildPrealertaDocPath,
  isAllowedPrealertaDocMime,
  prealertaDocExtFromMime,
  PREALERTA_DOC_BUCKET,
  PREALERTA_DOC_MAX_BYTES,
  type PrealertaDocType,
  type SupplierActionState,
  type DeleteSupplierActionState,
  type PrealertaActionState,
} from "@/lib/studio/prealertas/types";
import {
  validateServiceRequestInput,
  type ServiceRequestInput,
  type ServiceRequestActionState,
} from "@/lib/studio/prealertas/addons";
import { reconcileServiceRequests } from "@/lib/portal/purchase-order-lines";
import {
  isClientRequestConflict,
  isMissingClientRequestColumn,
  readClientRequestId,
} from "@/lib/shared/client-request";
import {
  listActivePrealertaAddons,
  getPrealertaByCode,
} from "@/lib/studio/prealertas/queries";
import { fireWorkflowEvent } from "@/lib/studio/workflow/workflow-rule-engine";

/** Tope de fotos por compra (las demás se ignoran; evita subidas enormes). */
const MAX_FOTOS = 8;

/**
 * Sube UN adjunto de compra al bucket privado con admin client (service_role) e
 * inserta su fila en `prealerta_documents`. Best-effort: devuelve false si el
 * mime/tamaño no pasa o si Storage/insert falla (el adjunto es OPCIONAL, no debe
 * tumbar el registro de la compra). Hace rollback del object si el insert falla.
 */
async function uploadPrealertaDoc(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    tenantId: string;
    prealertaId: string;
    markbox: string;
    docType: PrealertaDocType;
    file: File;
  },
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
      console.error("[uploadPrealertaDoc] storage error:", upErr);
      return false;
    }

    const fileName = (file.name || `${args.docType}.${ext}`).slice(0, 200);
    const { error: insErr } = await admin.from("prealerta_documents").insert({
      tenant_id: args.tenantId,
      prealerta_id: args.prealertaId,
      client_markbox: args.markbox,
      doc_type: args.docType,
      storage_path: path,
      file_name: fileName,
      content_type: mime,
      size_bytes: file.size,
    });
    if (insErr) {
      console.error("[uploadPrealertaDoc] insert error:", insErr);
      // Rollback del object huérfano.
      await admin.storage.from(PREALERTA_DOC_BUCKET).remove([path]);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[uploadPrealertaDoc] unexpected error:", err);
    return false;
  }
}

/**
 * Sube TODOS los adjuntos opcionales de la compra desde el FormData (packing /
 * factura / whatsapp = 1 c/u; fotos = varias, tope MAX_FOTOS). Best-effort: no
 * lanza — los adjuntos son opcionales. Se llama tras crear la prealerta.
 */
async function uploadPrealertaDocsFromForm(args: {
  formData: FormData;
  tenantId: string;
  prealertaId: string;
  markbox: string;
}): Promise<void> {
  const { formData } = args;
  const singles: [string, PrealertaDocType][] = [
    ["doc_packing", "packing"],
    ["doc_factura", "factura"],
    ["doc_whatsapp", "whatsapp"],
  ];

  const files: { docType: PrealertaDocType; file: File }[] = [];
  for (const [field, docType] of singles) {
    const f = formData.get(field);
    if (f instanceof File && f.size > 0) files.push({ docType, file: f });
  }
  for (const f of formData.getAll("doc_fotos")) {
    if (f instanceof File && f.size > 0) files.push({ docType: "foto", file: f });
    if (files.filter((x) => x.docType === "foto").length >= MAX_FOTOS) break;
  }
  if (files.length === 0) return;

  try {
    const admin = createAdminClient();
    // Un reintento no sube otra vez lo que el primer envío ya dejó (SDD-0599).
    const { data: existentes } = await admin
      .from("prealerta_documents")
      .select("doc_type, file_name, size_bytes")
      .eq("prealerta_id", args.prealertaId)
      .is("deleted_at", null);
    const yaEstan = new Set(
      (existentes ?? []).map((d) => `${d.doc_type}|${d.file_name}|${d.size_bytes}`),
    );
    const nuevos = files.filter(
      ({ docType, file }) => !yaEstan.has(`${docType}|${file.name.slice(0, 200)}|${file.size}`),
    );
    await Promise.all(
      nuevos.map(({ docType, file }) =>
        uploadPrealertaDoc(admin, {
          tenantId: args.tenantId,
          prealertaId: args.prealertaId,
          markbox: args.markbox,
          docType,
          file,
        }),
      ),
    );
  } catch (err) {
    // createAdminClient puede faltar env en algún entorno → no rompemos el alta.
    console.error("[uploadPrealertaDocsFromForm] admin client error:", err);
  }
}

const PORTAL_PATHS = ["/portal", "/portal/proveedores", "/portal/compras"];

function revalidatePortal() {
  for (const p of PORTAL_PATHS) revalidatePath(p);
}

/**
 * Tenant + Shipping Mark del principal Portal logueado, o null si la sesión no
 * tiene un principal válido (vínculo activo, cliente vivo y coherente).
 */
async function portalScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ tenantId: string; markbox: string } | null> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  return { tenantId: principal.tenantId, markbox: principal.client.markbox };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Servicios sobre la compra (add-ons · SDD-0098)            ║
// ╚═══════════════════════════════════════════════════════════╝

/** Checkbox/toggle del FormData → boolean. */
function isTruthy(v: FormDataEntryValue | null): boolean {
  const s = String(v ?? "").toLowerCase();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

/** Trackings de un textarea (uno por línea o coma). La validación fina la hace addons. */
function splitTrackings(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Lee del FormData los servicios elegidos sobre la compra. Contrato:
 *  - `addon` (multi)      → códigos seleccionados.
 *  - `consent` (checkbox) → OBLIGATORIO; sin él no se piden servicios.
 *  - `notes_<code>`       → notas por servicio (opcional).
 *  - `trackings_<code>`   → trackings extra por servicio (solo multi).
 * Valida cada uno contra los ACTIVOS; descarta inválidos/inactivos; dedupe por código.
 */
function parseServiceRequestsFromForm(
  formData: FormData,
  activeCodes: ReadonlySet<string>,
): ServiceRequestInput[] {
  if (!isTruthy(formData.get("consent"))) return [];
  const out: ServiceRequestInput[] = [];
  const seen = new Set<string>();
  for (const raw of formData.getAll("addon")) {
    const code = String(raw);
    if (seen.has(code)) continue;
    const v = validateServiceRequestInput(
      {
        addonCode: code,
        notes: (formData.get(`notes_${code}`) as string | null) ?? null,
        trackings: splitTrackings(formData.get(`trackings_${code}`)),
      },
      activeCodes,
    );
    if (v) {
      out.push(v);
      seen.add(code);
    }
  }
  return out;
}

/** Dispara el evento de flujo del servicio pedido (best-effort, admin client). */
async function firePrealertaServiceEvent(
  tenantId: string,
  prealertaId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await fireWorkflowEvent(admin, tenantId, {
      event: "prealerta_servicio_solicitado",
      sourceKind: "prealerta",
      sourceId: prealertaId,
      serviceKey: null,
    });
  } catch (err) {
    console.error("[firePrealertaServiceEvent] admin/workflow error:", err);
  }
}

/**
 * Inserta (best-effort) las solicitudes de servicio elegidas al registrar la compra
 * + avisa al equipo (evento de flujo). NO lanza: los servicios son un extra y jamás
 * tumban el alta de la compra. Usa el client de SESIÓN (RLS portal self insert, con
 * consent obligatorio); el evento de flujo usa admin (tablas del Studio).
 */
async function insertPrealertaServiceRequestsFromForm(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  formData: FormData;
  tenantId: string;
  prealertaId: string;
  markbox: string;
}): Promise<void> {
  try {
    // Mismo catálogo que el asistente le mostró: el del tenant del principal (SDD-0402).
    const active = await listActivePrealertaAddons(args.supabase, { tenantId: args.tenantId });
    const activeCodes = new Set(active.map((a) => a.code as string));
    const reqs = parseServiceRequestsFromForm(args.formData, activeCodes);
    if (reqs.length === 0) return;

    // Asistente de 3 pasos (SDD-0173): lo que DTD recibe es LO MISMO que el
    // cliente leyó en "Así queda tu orden a DTD — en vivo". La reconciliación
    // (línea encabeza las notas + reponer lo que el acople sumó) vive en
    // `reconcileServiceRequests`, que es puro y está testeado.
    const reconciled = reconcileServiceRequests({
      addons: active,
      requests: reqs,
      wizard: isTruthy(args.formData.get("wizard")),
      holdCount: Number(args.formData.get("hold_count")),
      holdTie: isTruthy(args.formData.get("hold_tie")),
    });

    const rows = reconciled.map((r) => ({
      tenant_id: args.tenantId,
      prealerta_id: args.prealertaId,
      client_markbox: args.markbox,
      addon_code: r.addonCode,
      consent_accepted: true,
      notes: r.notes,
      trackings: r.trackings.length ? r.trackings : null,
    }));

    const { error } = await args.supabase
      .from("prealerta_service_requests")
      .insert(rows);
    if (error) {
      console.error("[insertPrealertaServiceRequests] insert error:", error);
      return;
    }

    await firePrealertaServiceEvent(args.tenantId, args.prealertaId);
  } catch (err) {
    console.error("[insertPrealertaServiceRequests] unexpected:", err);
  }
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Crear proveedor                                            ║
// ╚═══════════════════════════════════════════════════════════╝

export async function createSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const { input, fieldErrors } = validateSupplierInput({
    name: (formData.get("name") as string | null) ?? undefined,
    city: (formData.get("city") as string | null) ?? undefined,
    wechat: (formData.get("wechat") as string | null) ?? undefined,
    contact: (formData.get("contact") as string | null) ?? undefined,
    notes: (formData.get("notes") as string | null) ?? undefined,
  });
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // Evita duplicar el mismo proveedor dos veces (partiría su historial en dos códigos).
  const { data: existing, error: dupErr } = await supabase
    .from("suppliers_cn")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null)
    .limit(500);
  if (dupErr) {
    console.error("[createSupplierAction] dup check error:", dupErr);
  } else {
    const normalized = input.name.toLowerCase();
    const isDup = (existing ?? []).some(
      (r) => String((r as { name?: string }).name ?? "").trim().toLowerCase() === normalized,
    );
    if (isDup) {
      return { fieldErrors: { name: "Ya tienes un proveedor con ese nombre." } };
    }
  }

  // Próximo nº de proveedor del cliente (RPC resuelve el tenant del caller).
  const { data: seqData, error: seqErr } = await supabase.rpc(
    "next_supplier_seq",
    { p_client_markbox: markbox },
  );
  if (seqErr || seqData == null) {
    return { error: "No pudimos registrar el proveedor. Prueba de nuevo." };
  }
  const supplierSeq = Number(seqData);

  // Ficha extendida del Norte (SDD-0173 · columnas de la migr 0266, aplicada).
  // Se lee siempre: la pinta sólo el asistente (`<SupplierPicker showProfile />`),
  // y cuando no viene, el normalizador devuelve nulls — que es exactamente lo que
  // guardaba el alta de antes.
  const profileRow = supplierProfileRow(
    normalizeSupplierProfileInput({
      industry: formData.get("industry"),
      contactPhone: formData.get("contactPhone"),
      sourceOrigin: formData.get("sourceOrigin"),
      sourceOriginNote: formData.get("sourceOriginNote"),
      purchaseHistory: formData.get("purchaseHistory"),
      commMethod: formData.get("commMethod"),
    }),
  );

  const { data: row, error: insErr } = await supabase
    .from("suppliers_cn")
    .insert({
      tenant_id: tenantId,
      client_markbox: markbox,
      supplier_seq: supplierSeq,
      name: input.name,
      city: input.city,
      wechat: input.wechat,
      contact: input.contact,
      notes: input.notes,
      ...profileRow,
    })
    .select("id")
    .single<{ id: string }>();

  if (insErr || !row) {
    console.error("[createSupplierAction] insert error:", insErr);
    return { error: "No pudimos registrar el proveedor. Prueba de nuevo." };
  }

  revalidatePortal();
  return { ok: true, supplierId: row.id };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Editar proveedor                                           ║
// ╚═══════════════════════════════════════════════════════════╝

export async function updateSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!supplierId) return { error: "Falta el proveedor a editar." };

  const { input, fieldErrors } = validateSupplierInput({
    name: (formData.get("name") as string | null) ?? undefined,
    city: (formData.get("city") as string | null) ?? undefined,
    wechat: (formData.get("wechat") as string | null) ?? undefined,
    contact: (formData.get("contact") as string | null) ?? undefined,
    notes: (formData.get("notes") as string | null) ?? undefined,
  });
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // El UPDATE pasa por la RLS (using/check por principal) — scopeamos explícito
  // por id + tenant + Shipping Mark (defensa en profundidad).
  const { error: updErr } = await supabase
    .from("suppliers_cn")
    .update({
      name: input.name,
      city: input.city,
      wechat: input.wechat,
      contact: input.contact,
      notes: input.notes,
    })
    .eq("id", supplierId)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null);

  if (updErr) {
    console.error("[updateSupplierAction] update error:", updErr);
    return { error: "No pudimos guardar los cambios. Prueba de nuevo." };
  }

  revalidatePortal();
  return { ok: true, supplierId };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Borrar proveedor                                            ║
// ╚═══════════════════════════════════════════════════════════╝

export async function deleteSupplierAction(
  _prev: DeleteSupplierActionState,
  formData: FormData,
): Promise<DeleteSupplierActionState> {
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!supplierId) return { error: "Falta el proveedor a borrar." };

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // No se borra un proveedor con compras vivas — partiría su historial/código.
  const { count, error: countErr } = await supabase
    .from("prealertas")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null);
  if (countErr) {
    console.error("[deleteSupplierAction] count error:", countErr);
    return { error: "No pudimos borrar el proveedor. Prueba de nuevo." };
  }
  if ((count ?? 0) > 0) {
    return { error: "No puedes borrar un proveedor con compras registradas." };
  }

  const { error: delErr } = await supabase
    .from("suppliers_cn")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", supplierId)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null);
  if (delErr) {
    console.error("[deleteSupplierAction] update error:", delErr);
    return { error: "No pudimos borrar el proveedor. Prueba de nuevo." };
  }

  revalidatePortal();
  return { ok: true };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Crear compra (prealerta)                                   ║
// ╚═══════════════════════════════════════════════════════════╝

const MAX_CODE_RETRIES = 5;

/** La compra que ya creó este intento. Sin 0512 la columna no existe, y sigue como un envío nuevo. */
async function findPrealertaByRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { tenantId: string; markbox: string; requestId: string },
): Promise<{ id: string; code: string; share_token: string | null } | null> {
  const { data, error } = await supabase
    .from("prealertas")
    .select("id, code, share_token")
    .eq("tenant_id", args.tenantId)
    .eq("client_markbox", args.markbox)
    .eq("client_request_id", args.requestId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; code: string; share_token: string | null }>();
  return error ? null : data;
}

/**
 * Un reintento del mismo envío: la compra ya existe, con sus cajas. Responde lo mismo que el
 * primero y completa lo que un corte pudo dejar a medias. Adjuntos y servicios no se duplican:
 * los primeros se comparan y los segundos tienen índice único.
 */
async function replayPrealerta(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  formData: FormData;
  tenantId: string;
  markbox: string;
  existing: { id: string; code: string; share_token: string | null };
}): Promise<PrealertaActionState> {
  const { supabase, formData, tenantId, markbox, existing } = args;
  await uploadPrealertaDocsFromForm({ formData, tenantId, prealertaId: existing.id, markbox });
  await insertPrealertaServiceRequestsFromForm({
    supabase,
    formData,
    tenantId,
    prealertaId: existing.id,
    markbox,
  });
  revalidatePortal();
  return {
    ok: true,
    prealertaCode: existing.code,
    shareToken: existing.share_token ?? undefined,
    replayed: true,
  };
}

export async function createPrealertaAction(
  _prev: PrealertaActionState,
  formData: FormData,
): Promise<PrealertaActionState> {
  const estValueRaw = String(formData.get("estValueUsd") ?? "").trim();
  const boxesRaw = String(formData.get("boxes") ?? "").trim();
  // El asistente de 3 pasos (SDD-0173) registra la compra al terminar el paso 1:
  // descripción, cajas, valor y tracking llegan después, en el paso 2. El
  // formulario largo de siempre no manda `wizard` y sigue exigiéndolo todo.
  const fromWizard = isTruthy(formData.get("wizard"));
  const { input, fieldErrors } = validatePrealertaInput(
    {
      supplierId: (formData.get("supplierId") as string | null) ?? undefined,
      description: (formData.get("description") as string | null) ?? undefined,
      trackingCn: (formData.get("trackingCn") as string | null) ?? undefined,
      boxes: boxesRaw === "" ? undefined : Number(boxesRaw),
      estValueUsd: estValueRaw === "" ? null : Number(estValueRaw),
      // El cliente siempre crea en 'anunciada' (el avance de estado lo hace el operador).
      status: "anunciada",
    },
    { requireDetalle: !fromWizard },
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  // Una compra DEBE tener proveedor (el código depende de su supplier_seq).
  if (!input.supplierId) {
    return { fieldErrors: { supplierId: "Elige el proveedor de esta compra." } };
  }

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // Antes de gastar un correlativo: si este intento ya creó la compra, no crea otra.
  const requestId = readClientRequestId(formData);
  if (requestId) {
    const existing = await findPrealertaByRequest(supabase, { tenantId, markbox, requestId });
    if (existing) return replayPrealerta({ supabase, formData, tenantId, markbox, existing });
  }

  // El supplier_seq del proveedor (para armar el code). Scopeado por tenant +
  // Shipping Mark: un proveedor de otro tenant no es válido para esta compra.
  const { data: supRow, error: supErr } = await supabase
    .from("suppliers_cn")
    .select("supplier_seq")
    .eq("id", input.supplierId)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null)
    .maybeSingle<{ supplier_seq: number }>();
  if (supErr || !supRow) {
    return { fieldErrors: { supplierId: "Ese proveedor no es válido." } };
  }
  const supplierSeq = Number(supRow.supplier_seq);

  // Insert con REINTENTO: el order_seq se recomputa en cada vuelta (RPC), y ante
  // un choque del unique(tenant, code) — 23505 — reintentamos (race entre dos
  // compras simultáneas al mismo proveedor).
  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const { data: orderData, error: orderErr } = await supabase.rpc(
      "next_order_seq",
      { p_client_markbox: markbox, p_supplier_id: input.supplierId },
    );
    if (orderErr || orderData == null) {
      lastError = "No pudimos generar el código de la compra.";
      continue;
    }
    const orderSeq = Number(orderData);
    const code = buildPrealertaCode(markbox, supplierSeq, orderSeq);

    const row = {
      tenant_id: tenantId,
      client_markbox: markbox,
      supplier_id: input.supplierId,
      code,
      description: input.description,
      tracking_cn: input.trackingCn,
      boxes: input.boxes,
      est_value_usd: input.estValueUsd,
      status: "anunciada",
      // Nota del cliente sobre ESTA compra (paso 1 · migr 0269, aplicada
      // 2026-07-29).
      client_note: normalizeClientNote(formData.get("clientNote")),
    };
    const insertar = (fila: typeof row & { client_request_id?: string }) =>
      supabase
        .from("prealertas")
        .insert(fila)
        .select("id, share_token")
        .single<{ id: string; share_token: string | null }>();

    let { data: insRow, error: insErr } = await insertar(
      requestId ? { ...row, client_request_id: requestId } : row,
    );
    // Sin 0512 la columna no existe: la compra entra sin candado, como antes.
    if (isMissingClientRequestColumn(insErr)) {
      ({ data: insRow, error: insErr } = await insertar(row));
    }

    if (!insErr && insRow) {
      // WeChat/WhatsApp del proveedor (número o ID): si lo cargó, lo guardamos en
      // el proveedor (reusable en re-compras). Best-effort, no bloquea el alta.
      const supplierWechat = String(formData.get("supplierWechat") ?? "").trim();
      if (supplierWechat) {
        await supabase
          .from("suppliers_cn")
          .update({ wechat: supplierWechat })
          .eq("id", input.supplierId)
          .eq("tenant_id", tenantId)
          .eq("client_markbox", markbox)
          .is("deleted_at", null);
      }

      // Adjuntos opcionales (packing/factura/fotos/whatsapp) — subida server-side.
      await uploadPrealertaDocsFromForm({
        formData,
        tenantId,
        prealertaId: insRow.id,
        markbox,
      });

      // Servicios sobre la compra (add-ons · SDD-0098) — best-effort, no tumba el alta.
      await insertPrealertaServiceRequestsFromForm({
        supabase,
        formData,
        tenantId,
        prealertaId: insRow.id,
        markbox,
      });

      revalidatePortal();
      return {
        ok: true,
        prealertaCode: code,
        shareToken: insRow.share_token ?? undefined,
      };
    }
    if (requestId && isClientRequestConflict(insErr)) {
      // Otro intento del mismo envío ganó la carrera: esa es la compra.
      const existing = await findPrealertaByRequest(supabase, { tenantId, markbox, requestId });
      if (existing) return replayPrealerta({ supabase, formData, tenantId, markbox, existing });
      return { error: "No pudimos registrar la compra. Prueba de nuevo." };
    }
    if (insErr?.code === "23505") {
      // Choque de código → otra compra ganó la carrera; reintentamos.
      lastError = "Reintentando…";
      continue;
    }
    console.error("[createPrealertaAction] insert error:", insErr);
    return { error: "No pudimos registrar la compra. Prueba de nuevo." };
  }

  return {
    error: lastError ?? "No pudimos registrar la compra. Prueba de nuevo.",
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Pedir un servicio sobre una compra ya creada (detalle)    ║
// ╚═══════════════════════════════════════════════════════════╝
// Entrada secundaria al menú de servicios: desde el detalle de la compra. El gate
// de "tardía" lo aplica el trigger en DB (si la compra ya fue recibida).

export async function requestPrealertaServiceAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const code = String(formData.get("prealertaCode") ?? "").trim();
  const addonCode = String(formData.get("addonCode") ?? "").trim();
  if (!code) return { error: "Falta la compra." };
  if (!isTruthy(formData.get("consent"))) {
    return { error: "Debes aceptar las condiciones del servicio." };
  }

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // La compra (scopeada por tenant y Shipping Mark del principal, y comprobada
  // otra vez contra el tenant, como la página de etiquetas) → su id.
  const pre = await getPrealertaByCode(supabase, code, { markbox, tenantId });
  if (!pre || pre.tenant_id !== tenantId) return { error: "Esa compra no es válida." };

  // El servicio debe estar activo en el menú del tenant del principal (SDD-0402).
  const active = await listActivePrealertaAddons(supabase, { tenantId });
  const activeCodes = new Set(active.map((a) => a.code as string));
  const v = validateServiceRequestInput(
    {
      addonCode,
      notes: (formData.get("notes") as string | null) ?? null,
      trackings: splitTrackings(formData.get("trackings")),
    },
    activeCodes,
  );
  if (!v) return { error: "Ese servicio no está disponible." };

  const { error } = await supabase.from("prealerta_service_requests").insert({
    tenant_id: tenantId,
    prealerta_id: pre.id,
    client_markbox: markbox,
    addon_code: v.addonCode,
    consent_accepted: true,
    notes: v.notes,
    trackings: v.trackings.length ? v.trackings : null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya pediste ese servicio para esta compra." };
    }
    console.error("[requestPrealertaServiceAction] insert error:", error);
    return { error: "No pudimos registrar el servicio. Prueba de nuevo." };
  }

  await firePrealertaServiceEvent(tenantId, pre.id);
  revalidatePortal();
  revalidatePath(`/portal/compras/${encodeURIComponent(code)}/etiquetas`);
  return { ok: true, requestedCount: 1 };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Completar el detalle de una compra ya creada (SDD-0173)   ║
// ╚═══════════════════════════════════════════════════════════╝
// Paso 2 del asistente: el Norte registra la compra apenas hay proveedor y
// deja descripción, cajas, valor, tracking y adjuntos para después. Esta
// action es la que los adjunta.

export async function updatePrealertaDetalleAction(
  _prev: PrealertaActionState,
  formData: FormData,
): Promise<PrealertaActionState> {
  const code = String(formData.get("prealertaCode") ?? "").trim();
  if (!code) return { error: "Falta la compra." };

  const supabase = await createClient();
  const scope = await portalScope(supabase);
  if (!scope) return { error: "Tu sesión expiró. Vuelve a entrar." };
  const { tenantId, markbox } = scope;

  // Scopeado por Shipping Mark y tenant del principal: una compra de otro
  // cliente, o del mismo Shipping Mark en otro tenant, no existe para esta sesión.
  const pre = await getPrealertaByCode(supabase, code, { markbox, tenantId });
  if (!pre || pre.tenant_id !== tenantId) return { error: "Esa compra no es válida." };

  // Sólo mientras nadie la haya tocado en bodega: una vez recibida, el detalle
  // lo manda el operario con la carga delante, no el cliente desde el portal.
  if (pre.status !== "anunciada") {
    return {
      error:
        "Esta compra ya está en proceso. Escríbele a tu asesor para cambiar el detalle.",
    };
  }

  const estValueRaw = String(formData.get("estValueUsd") ?? "").trim();
  const boxesRaw = String(formData.get("boxes") ?? "").trim();
  const { input, fieldErrors } = validatePrealertaInput(
    {
      supplierId: pre.supplier_id,
      description: (formData.get("description") as string | null) ?? undefined,
      trackingCn: (formData.get("trackingCn") as string | null) ?? undefined,
      boxes: boxesRaw === "" ? undefined : Number(boxesRaw),
      estValueUsd: estValueRaw === "" ? null : Number(estValueRaw),
      status: pre.status,
    },
    { requireDetalle: false },
  );
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({
      description: input.description,
      tracking_cn: input.trackingCn,
      boxes: input.boxes,
      est_value_usd: input.estValueUsd,
    })
    .eq("id", pre.id)
    .eq("tenant_id", tenantId)
    .eq("client_markbox", markbox)
    .is("deleted_at", null);

  if (updErr) {
    console.error("[updatePrealertaDetalleAction] update error:", updErr);
    return { error: "No pudimos guardar el detalle. Prueba de nuevo." };
  }

  // Adjuntos del paso 2 (packing/factura/fotos) — mismo camino que el alta.
  await uploadPrealertaDocsFromForm({
    formData,
    tenantId,
    prealertaId: pre.id,
    markbox,
  });

  revalidatePortal();
  revalidatePath(`/portal/compras/${encodeURIComponent(code)}`);
  return { ok: true, prealertaCode: code, shareToken: pre.share_token ?? undefined };
}
