/**
 * Queries de cargos del socio + notas de crédito (SDD-0059 · Slice A).
 * Funciones PURAS que reciben un SupabaseClient; RLS filtra por tenant_id.
 *
 * `net_amount` NO es columna (un generated column no puede sumar de otra
 * tabla) → se DERIVA acá = amount − Σ supplier_credit_notes aplicadas
 * (deriveNetAmount). La transición de estado pasa por `canTransitionCharge`
 * (guard); aplicar una nota de crédito lleva el cargo a `corregido`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canTransitionCharge,
  deriveNetAmount,
  num,
  type ChargeInput,
  type ChargeStatus,
  type CreditNoteInput,
  type SupplierCharge,
  type SupplierChargeWithNet,
  type SupplierCreditNote,
} from "./types";

const CHARGE_COLUMNS =
  "id, tenant_id, supplier_id, container_id, description, description_cn, amount, currency, fx_rate, charged_on, status, reconciled, statement_line_id, journal_entry_id, created_at, updated_at, deleted_at";

const CREDIT_NOTE_COLUMNS =
  "id, tenant_id, charge_id, reason, amount, currency, fx_rate, issued_on, document_id, created_at, deleted_at";

function coerceCharge(r: Record<string, unknown>): SupplierCharge {
  return {
    ...(r as unknown as SupplierCharge),
    amount: num(r.amount),
    fx_rate: r.fx_rate == null ? null : num(r.fx_rate),
    reconciled: r.reconciled === true,
  };
}

function coerceCreditNote(r: Record<string, unknown>): SupplierCreditNote {
  return {
    ...(r as unknown as SupplierCreditNote),
    amount: num(r.amount),
    fx_rate: r.fx_rate == null ? null : num(r.fx_rate),
  };
}

/**
 * Lista los cargos del socio CON su net_amount derivado (un query de notas de
 * crédito vivas, agrupado en memoria). RLS por tenant. Sin `supplierId` → todos.
 */
export async function listCharges(
  supabase: SupabaseClient,
  supplierId?: string,
): Promise<SupplierChargeWithNet[]> {
  let q = supabase
    .from("supplier_charges")
    .select(CHARGE_COLUMNS)
    .order("charged_on", { ascending: false })
    .limit(5000);
  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) throw error;

  const charges = ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceCharge,
  );
  if (charges.length === 0) return [];

  // Notas de crédito vivas de esos cargos → agrupadas por charge_id.
  const chargeIds = charges.map((c) => c.id);
  const { data: notesData, error: notesErr } = await supabase
    .from("supplier_credit_notes")
    .select("charge_id, amount, deleted_at")
    .in("charge_id", chargeIds)
    .is("deleted_at", null);
  if (notesErr) throw notesErr;

  const byCharge = new Map<string, { amount: number; deleted_at: null }[]>();
  for (const n of (notesData as Record<string, unknown>[] | null) ?? []) {
    const cid = String(n.charge_id);
    const arr = byCharge.get(cid) ?? [];
    arr.push({ amount: num(n.amount), deleted_at: null });
    byCharge.set(cid, arr);
  }

  return charges.map((c) => {
    const { credited, net_amount } = deriveNetAmount(
      c.amount,
      byCharge.get(c.id) ?? [],
    );
    return { ...c, credited, net_amount };
  });
}

/** Un cargo con su net_amount derivado. null si no existe / no es del tenant. */
export async function getChargeWithNet(
  supabase: SupabaseClient,
  chargeId: string,
): Promise<SupplierChargeWithNet | null> {
  const { data, error } = await supabase
    .from("supplier_charges")
    .select(CHARGE_COLUMNS)
    .eq("id", chargeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const charge = coerceCharge(data as Record<string, unknown>);

  const { data: notesData, error: notesErr } = await supabase
    .from("supplier_credit_notes")
    .select("amount, deleted_at")
    .eq("charge_id", chargeId)
    .is("deleted_at", null);
  if (notesErr) throw notesErr;

  const notes = ((notesData as Record<string, unknown>[] | null) ?? []).map(
    (n) => ({ amount: num(n.amount), deleted_at: null as null }),
  );
  const { credited, net_amount } = deriveNetAmount(charge.amount, notes);
  return { ...charge, credited, net_amount };
}

/** Inserta un cargo. RLS por tenant. */
export async function addCharge(
  supabase: SupabaseClient,
  tenantId: string,
  input: ChargeInput,
): Promise<SupplierCharge> {
  const { data, error } = await supabase
    .from("supplier_charges")
    .insert({
      tenant_id: tenantId,
      supplier_id: input.supplier_id,
      container_id: input.container_id,
      description: input.description,
      description_cn: input.description_cn,
      amount: input.amount,
      currency: input.currency,
      fx_rate: input.fx_rate,
      charged_on: input.charged_on ?? undefined,
      status: input.status,
    })
    .select(CHARGE_COLUMNS)
    .single();
  if (error) throw error;
  return coerceCharge(data as Record<string, unknown>);
}

/**
 * Transición de estado de un cargo con guard (canTransitionCharge). Throwea si
 * la transición es inválida (NO toca la DB). RLS por tenant.
 */
export async function transitionChargeStatus(
  supabase: SupabaseClient,
  chargeId: string,
  from: ChargeStatus,
  to: ChargeStatus,
): Promise<void> {
  if (!canTransitionCharge(from, to)) {
    throw new Error(`Transición de cargo inválida: ${from} → ${to}`);
  }
  const { error } = await supabase
    .from("supplier_charges")
    .update({ status: to })
    .eq("id", chargeId)
    .eq("status", from) // optimistic: la fila debe seguir en `from`
    .is("deleted_at", null);
  if (error) throw error;
}

/**
 * Registra una nota de crédito sobre un cargo. Inserta la nota y, si el cargo
 * estaba `vigente` o `disputado`, lo lleva a `corregido` (la corrección llegó).
 * Devuelve la nota + el net_amount recalculado. RLS por tenant.
 */
export async function applyCreditNote(
  supabase: SupabaseClient,
  tenantId: string,
  input: CreditNoteInput,
): Promise<{ note: SupplierCreditNote; net_amount: number }> {
  const { data: noteData, error: noteErr } = await supabase
    .from("supplier_credit_notes")
    .insert({
      tenant_id: tenantId,
      charge_id: input.charge_id,
      reason: input.reason,
      amount: input.amount,
      currency: input.currency,
      fx_rate: input.fx_rate,
      issued_on: input.issued_on ?? undefined,
      document_id: input.document_id,
    })
    .select(CREDIT_NOTE_COLUMNS)
    .single();
  if (noteErr) throw noteErr;
  const note = coerceCreditNote(noteData as Record<string, unknown>);

  // Llevar el cargo a `corregido` si todavía no es terminal.
  const { data: chargeRow, error: chargeErr } = await supabase
    .from("supplier_charges")
    .select("status")
    .eq("id", input.charge_id)
    .is("deleted_at", null)
    .maybeSingle<{ status: ChargeStatus }>();
  if (chargeErr) throw chargeErr;

  if (
    chargeRow &&
    (chargeRow.status === "vigente" || chargeRow.status === "disputado")
  ) {
    const { error: updErr } = await supabase
      .from("supplier_charges")
      .update({ status: "corregido" })
      .eq("id", input.charge_id)
      .is("deleted_at", null);
    if (updErr) throw updErr;
  }

  // net_amount recalculado tras la nota.
  const updated = await getChargeWithNet(supabase, input.charge_id);
  return { note, net_amount: updated?.net_amount ?? 0 };
}

/**
 * Marca un set de cargos como `reconciled = true` (al cerrar un estado de
 * cuenta — SDD-0059 Slice B1). Idempotente; no-op si la lista viene vacía. RLS
 * por tenant. Append-safe: sólo toca el flag, no el estado del cargo.
 */
export async function markChargesReconciled(
  supabase: SupabaseClient,
  chargeIds: string[],
): Promise<void> {
  const ids = chargeIds.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("supplier_charges")
    .update({ reconciled: true })
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
}

/** Notas de crédito vivas de un cargo. RLS por tenant. */
export async function listCreditNotes(
  supabase: SupabaseClient,
  chargeId: string,
): Promise<SupplierCreditNote[]> {
  const { data, error } = await supabase
    .from("supplier_credit_notes")
    .select(CREDIT_NOTE_COLUMNS)
    .eq("charge_id", chargeId)
    .is("deleted_at", null)
    .order("issued_on", { ascending: false });
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coerceCreditNote,
  );
}
