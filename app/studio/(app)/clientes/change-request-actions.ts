/**
 * Server actions de aprobación de solicitudes de cambio de datos (SDD-0151).
 *
 * El cliente propuso un cambio desde el portal (client_change_requests, status
 * pending). Acá el asesor lo APRUEBA (aplica a `clients`) o lo RECHAZA (con nota).
 *
 * Auth/tenant: `moduleEditDenial(supabase, "clients")` (RBAC del módulo) + se
 * resuelve el tenant del usuario y se exige que la solicitud pertenezca a ESE
 * tenant (defensa contra IDs de otro tenant). La aplicación a `clients` va por la
 * sesión (RLS del Studio, tenant-scope) y se apoya en `clients_tenant_doc_unique`
 * (23505) para no duplicar RIF/cédula — mismo criterio que updateClientAction. La
 * mutación de la solicitud va con el ADMIN client: la RLS de client_change_requests
 * es read-only para authenticated (solo service_role escribe).
 *
 * Firma de args planos + `{ok?, error?}` → se consumen con ActionButton
 * (patrón assignAdvisorAction).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { identityResetOnChange } from "@/lib/studio/identity/reset-on-change";
import { notifyChangeRequestResolvedToClient } from "@/lib/studio/change-request-notify";

type ReviewResult = { ok?: boolean; error?: string };

const REQ_COLS =
  "id, tenant_id, client_id, proposed_name, proposed_rif, proposed_phone, status";

type ReqRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  proposed_name: string | null;
  proposed_rif: string | null;
  proposed_phone: string | null;
  status: string;
};

/** Resuelve el tenant del usuario y carga la solicitud PENDING de ese tenant. */
async function loadPendingRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
): Promise<{ req?: ReqRow; error?: string }> {
  const { data: tenantLink } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  const tenantId = tenantLink?.tenant_id;
  if (!tenantId) return { error: "No autorizado." };

  const { data, error } = await admin
    .from("client_change_requests")
    .select(REQ_COLS)
    .eq("id", requestId)
    .maybeSingle<ReqRow>();
  if (error || !data) return { error: "No encontramos la solicitud." };
  if (data.tenant_id !== tenantId) return { error: "No autorizado." };
  if (data.status !== "pending") {
    return { error: "Esa solicitud ya fue revisada." };
  }
  return { req: data };
}

export async function approveChangeRequestAction(
  requestId: string,
  markbox: string,
): Promise<ReviewResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };
  if (!requestId) return { error: "Falta la solicitud." };

  const admin = createAdminClient();
  const { req, error: loadErr } = await loadPendingRequest(
    supabase,
    admin,
    requestId,
  );
  if (loadErr || !req) return { error: loadErr ?? "No encontramos la solicitud." };

  // Aplicar SOLO los campos propuestos (no-nulos) a la ficha del cliente.
  const patch: Record<string, string | null> = {};
  if (req.proposed_name != null) patch.name = req.proposed_name;
  if (req.proposed_rif != null) patch.rif = req.proposed_rif;
  if (req.proposed_phone != null) patch.phone = req.proposed_phone;
  if (Object.keys(patch).length === 0) {
    return { error: "La solicitud no tiene cambios que aplicar." };
  }

  // Si el cambio toca nombre o RIF/cédula, la verificación previa (SDD-0046)
  // queda apuntando al documento viejo → resetear doc_verify_* para re-verificar.
  const { data: cur } = await supabase
    .from("clients")
    .select("name, rif")
    .eq("id", req.client_id)
    .maybeSingle<{ name: string | null; rif: string | null }>();
  const identityReset = identityResetOnChange(
    { name: cur?.name ?? null, rif: cur?.rif ?? null },
    { name: patch.name, rif: patch.rif },
  );
  if (identityReset) Object.assign(patch, identityReset);

  const { error: updErr } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", req.client_id);
  if (updErr) {
    if ((updErr as { code?: string }).code === "23505") {
      return { error: "Ese RIF/cédula ya está en otro cliente del tenant." };
    }
    return { error: `No se pudo aplicar el cambio: ${updErr.message}` };
  }

  // Marcar la solicitud como aprobada (admin: RLS read-only para authenticated).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: reqErr } = await admin
    .from("client_change_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", requestId);
  if (reqErr) {
    // La ficha ya se actualizó; loguear y seguir (el patch es idempotente).
    console.error("[approveChangeRequestAction] request update error:", reqErr);
  }

  // Avisar al cliente que su cambio quedó aplicado (push best-effort, SDD-0148).
  await notifyChangeRequestResolvedToClient(admin, {
    clientId: req.client_id,
    approved: true,
  });

  if (markbox) revalidatePath(`/studio/clientes/${markbox}`);
  revalidatePath("/studio/clientes");
  return { ok: true };
}

export async function rejectChangeRequestAction(
  requestId: string,
  markbox: string,
  note: string | null,
): Promise<ReviewResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "clients");
  if (denial) return { error: denial };
  if (!requestId) return { error: "Falta la solicitud." };

  const admin = createAdminClient();
  const { req, error: loadErr } = await loadPendingRequest(
    supabase,
    admin,
    requestId,
  );
  if (loadErr || !req) return { error: loadErr ?? "No encontramos la solicitud." };

  const cleanNote = (note ?? "").trim() || null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: reqErr } = await admin
    .from("client_change_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      review_note: cleanNote,
    })
    .eq("id", requestId);
  if (reqErr) {
    return { error: `No se pudo rechazar: ${reqErr.message}` };
  }

  // Avisar al cliente que su solicitud no se aplicó (con el motivo, si lo hay).
  await notifyChangeRequestResolvedToClient(admin, {
    clientId: req.client_id,
    approved: false,
    note: cleanNote,
  });

  if (markbox) revalidatePath(`/studio/clientes/${markbox}`);
  return { ok: true };
}
