"use server";

/**
 * Server actions del Portal · Compras (prealertas) + Proveedores (SDD-0057,
 * Slice B). El cliente del portal CRUD de SUS proveedores y crea SUS compras.
 *
 * IDENTIDAD + AISLAMIENTO: resolvemos el MARKBOX del cliente logueado vía
 * `get_portal_client_markbox()` (helper aislada, igual que el resto del portal)
 * y scopeamos TODO por ese markbox. La RLS doble de la migración 0105 permite
 * que el cliente escriba directo (WITH CHECK por `get_portal_client_markbox()` +
 * `get_portal_client_tenant()`), así que usamos el client de SESIÓN
 * (`createClient`) — el service_role queda de respaldo en la policy.
 *
 * Validación manual con `validate*Input` (sin Zod, patrón del repo). El alta de
 * la compra arma el código del Norte `DTD-{clientNo}-{supplier_seq}-{order_seq}`
 * vía las RPCs `next_supplier_seq` / `next_order_seq` y REINTENTA ante un choque
 * del `unique(tenant, code)` (23505), recomputando el order_seq.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateSupplierInput,
  validatePrealertaInput,
  buildPrealertaCode,
  type SupplierActionState,
  type PrealertaActionState,
} from "@/lib/studio/prealertas/types";

const PORTAL_PATHS = ["/portal", "/portal/proveedores", "/portal/compras"];

function revalidatePortal() {
  for (const p of PORTAL_PATHS) revalidatePath(p);
}

/** MARKBOX del cliente del portal logueado, o null. */
async function portalMarkbox(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_portal_client_markbox");
  if (error || !data) return null;
  return String(data);
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
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { error: "Tu sesión expiró. Vuelve a entrar." };

  // Próximo nº de proveedor del cliente (RPC resuelve el tenant del caller).
  const { data: seqData, error: seqErr } = await supabase.rpc(
    "next_supplier_seq",
    { p_client_markbox: markbox },
  );
  if (seqErr || seqData == null) {
    return { error: "No pudimos registrar el proveedor. Prueba de nuevo." };
  }
  const supplierSeq = Number(seqData);

  const { data: tenantData } = await supabase.rpc("get_portal_client_tenant");
  const tenantId = tenantData ? String(tenantData) : null;
  if (!tenantId) return { error: "No pudimos resolver tu cuenta." };

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
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { error: "Tu sesión expiró. Vuelve a entrar." };

  // El UPDATE pasa por la RLS (using/check por markbox) — scopeamos explícito
  // por id + markbox (defensa en profundidad).
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
// ║ Crear compra (prealerta)                                   ║
// ╚═══════════════════════════════════════════════════════════╝

const MAX_CODE_RETRIES = 5;

export async function createPrealertaAction(
  _prev: PrealertaActionState,
  formData: FormData,
): Promise<PrealertaActionState> {
  const estValueRaw = String(formData.get("estValueUsd") ?? "").trim();
  const { input, fieldErrors } = validatePrealertaInput({
    supplierId: (formData.get("supplierId") as string | null) ?? undefined,
    description: (formData.get("description") as string | null) ?? undefined,
    trackingCn: (formData.get("trackingCn") as string | null) ?? undefined,
    boxes: Number(formData.get("boxes")),
    estValueUsd: estValueRaw === "" ? null : Number(estValueRaw),
    // El cliente siempre crea en 'anunciada' (el avance de estado lo hace el operador).
    status: "anunciada",
  });
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };

  // Una compra DEBE tener proveedor (el código depende de su supplier_seq).
  if (!input.supplierId) {
    return { fieldErrors: { supplierId: "Elegí el proveedor de esta compra." } };
  }

  const supabase = await createClient();
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { error: "Tu sesión expiró. Vuelve a entrar." };

  const { data: tenantData } = await supabase.rpc("get_portal_client_tenant");
  const tenantId = tenantData ? String(tenantData) : null;
  if (!tenantId) return { error: "No pudimos resolver tu cuenta." };

  // El supplier_seq del proveedor (para armar el code). Scopeado por markbox.
  const { data: supRow, error: supErr } = await supabase
    .from("suppliers_cn")
    .select("supplier_seq")
    .eq("id", input.supplierId)
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

    const { error: insErr } = await supabase.from("prealertas").insert({
      tenant_id: tenantId,
      client_markbox: markbox,
      supplier_id: input.supplierId,
      code,
      description: input.description,
      tracking_cn: input.trackingCn,
      boxes: input.boxes,
      est_value_usd: input.estValueUsd,
      status: "anunciada",
    });

    if (!insErr) {
      revalidatePortal();
      return { ok: true, prealertaCode: code };
    }
    if (insErr.code === "23505") {
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
