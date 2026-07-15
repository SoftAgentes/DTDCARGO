/**
 * SDD-0111 · Server actions del Scorecard de proveedores.
 *
 * Patrón del Studio: parsing/validación MANUAL (sin Zod) + guard de edición
 * (moduleEditDenial "suppliers" — el módulo que posee /studio/proveedores,
 * mismo id que usa requireModuleView + actions.ts) + revalidatePath. Tenant
 * resuelto desde user_tenants. Acciones:
 *   - createOrderSignalAction     · captura una señal de recepción (camino A)
 *   - createSupplierClaimAction   · abre un reclamo al proveedor (camino C)
 *   - updateSupplierClaimAction   · edita los datos de un reclamo
 *   - advanceSupplierClaimAction  · avanza el estado (máquina de estados)
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  canTransitionSupplierClaim,
  validateOrderSignalInput,
  validateSupplierClaimInput,
  type SupplierClaimInput,
  type SupplierClaimStatus,
  type OrderSignalInput,
} from "@/lib/studio/proveedores/scorecard-types";

// El módulo que posee /studio/proveedores tiene id "suppliers" (lib/studio/modules.ts).
const MODULE_ID = "suppliers";

export type ScorecardActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  claimCode?: string;
};

type StudioClient = Awaited<ReturnType<typeof createClient>>;

/** tenant_id del operador logueado (primer membership). */
async function resolveOperatorTenantId(
  supabase: StudioClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

/** Mensaje legible si el insert/update choca con la RLS o falta la migración 0236. */
function friendlyWriteError(error: { code?: string; message?: string }): string {
  if (error.code === "42P01" || /does not exist|relation .* does not exist/i.test(error.message ?? "")) {
    return "El scorecard de proveedores necesita una migración de base de datos que todavía no se aplicó a producción. Avísale al equipo técnico.";
  }
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return "No tienes permiso para escribir esta señal en tu tenant.";
  }
  return "No se pudo guardar. Prueba de nuevo.";
}

/** La ficha de proveedor debe existir en el tenant del operador (defensa en profundidad). */
async function assertSupplierInTenant(
  supabase: StudioClient,
  tenantId: string,
  supplierCnId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("suppliers_cn")
    .select("id")
    .eq("id", supplierCnId)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  return !!data;
}

// ── Señal de recepción (camino A) ───────────────────────────────

export async function createOrderSignalAction(
  raw: {
    supplierCnId: string;
    purchaseOrderId?: string | null;
    clientMarkbox?: string | null;
    onTime: boolean;
    conforming: boolean;
    expectedAt?: string | null;
    receivedAt?: string | null;
    notes?: string | null;
  },
): Promise<ScorecardActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateOrderSignalInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };
  const signal = input as OrderSignalInput;

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  if (!(await assertSupplierInTenant(supabase, tenantId, signal.supplierCnId))) {
    return { error: "Ese proveedor no existe en tu tenant." };
  }

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;

  const { error } = await supabase.from("supplier_order_signals").insert({
    tenant_id: tenantId,
    supplier_cn_id: signal.supplierCnId,
    purchase_order_id: signal.purchaseOrderId,
    client_markbox: signal.clientMarkbox,
    on_time: signal.onTime,
    conforming: signal.conforming,
    expected_at: signal.expectedAt,
    received_at: signal.receivedAt,
    notes: signal.notes,
    created_by: uid,
  });

  if (error) {
    console.error("[createOrderSignalAction] insert error:", error);
    return { error: friendlyWriteError(error) };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true };
}

// ── Reclamo al proveedor · crear (camino C) ─────────────────────

export async function createSupplierClaimAction(
  raw: {
    supplierCnId: string;
    purchaseOrderId?: string | null;
    clientMarkbox?: string | null;
    kind: string;
    amountUsd?: string | number | null;
    description: string;
  },
): Promise<ScorecardActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateSupplierClaimInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };
  const claim = input as SupplierClaimInput;

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  if (!(await assertSupplierInTenant(supabase, tenantId, claim.supplierCnId))) {
    return { error: "Ese proveedor no existe en tu tenant." };
  }

  const { data: code, error: codeErr } = await supabase.rpc(
    "next_supplier_claim_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !code) {
    console.error("[createSupplierClaimAction] code error:", codeErr);
    return { error: friendlyWriteError(codeErr ?? {}) };
  }

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id ?? null;

  const { error } = await supabase.from("supplier_claims").insert({
    tenant_id: tenantId,
    claim_code: String(code),
    supplier_cn_id: claim.supplierCnId,
    purchase_order_id: claim.purchaseOrderId,
    client_markbox: claim.clientMarkbox,
    kind: claim.kind,
    amount_usd: claim.amountUsd,
    description: claim.description,
    created_by: uid,
  });

  if (error) {
    console.error("[createSupplierClaimAction] insert error:", error);
    return { error: friendlyWriteError(error) };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true, claimCode: String(code) };
}

// ── Reclamo al proveedor · editar datos ─────────────────────────

export async function updateSupplierClaimAction(
  claimId: string,
  raw: {
    supplierCnId: string;
    purchaseOrderId?: string | null;
    clientMarkbox?: string | null;
    kind: string;
    amountUsd?: string | number | null;
    description: string;
  },
): Promise<ScorecardActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const id = claimId.trim();
  if (!id) return { error: "Falta el reclamo a editar." };

  const { input, fieldErrors } = validateSupplierClaimInput(raw);
  if (fieldErrors) return { fieldErrors };
  if (!input) return { error: "Datos inválidos." };
  const claim = input as SupplierClaimInput;

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  if (!(await assertSupplierInTenant(supabase, tenantId, claim.supplierCnId))) {
    return { error: "Ese proveedor no existe en tu tenant." };
  }

  const { error } = await supabase
    .from("supplier_claims")
    .update({
      supplier_cn_id: claim.supplierCnId,
      purchase_order_id: claim.purchaseOrderId,
      client_markbox: claim.clientMarkbox,
      kind: claim.kind,
      amount_usd: claim.amountUsd,
      description: claim.description,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    console.error("[updateSupplierClaimAction] update error:", error);
    return { error: friendlyWriteError(error) };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true };
}

// ── Reclamo al proveedor · avanzar estado ───────────────────────

export async function advanceSupplierClaimAction(
  claimId: string,
  from: SupplierClaimStatus,
  to: SupplierClaimStatus,
): Promise<ScorecardActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const id = claimId.trim();
  if (!id) return { error: "Falta el reclamo." };

  if (!canTransitionSupplierClaim(from, to)) {
    return { error: "Transición de estado no permitida." };
  }

  const tenantId = await resolveOperatorTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver tu tenant." };

  // Actualiza solo si el estado ACTUAL sigue siendo `from` (evita carreras
  // entre dos operadores). resolved_at lo sella el trigger.
  const { data, error } = await supabase
    .from("supplier_claims")
    .update({ status: to })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("status", from)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("[advanceSupplierClaimAction] update error:", error);
    return { error: friendlyWriteError(error) };
  }
  if (!data) {
    return { error: "El reclamo cambió de estado — recarga la página." };
  }

  revalidatePath("/studio/proveedores");
  return { ok: true };
}
