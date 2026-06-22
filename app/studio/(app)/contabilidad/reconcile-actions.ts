/**
 * Server actions de Conciliación bancaria (SDD-0105).
 *
 * Patrón del repo: "use server" + parse manual de FormData + validate*Input()
 * (sin Zod) + revalidatePath(). `moduleEditDenial("accounting")` primero en
 * TODA mutación; `resolveTenant` antes de tocar la DB.
 *
 * REGLA DURA: conciliar SOLO setea el vínculo (matched_entry_id + estado del
 * movimiento). NO crea ni muta asientos del mayor (journal_entries/journal_lines).
 *   - createStatement / addLines: escriben solo en las tablas de conciliación.
 *   - matchLine: liga un movimiento a un asiento EXISTENTE (1:1, defendido por
 *     el unique parcial de la DB).
 *   - setLineStatus: marca manual / ignorado / pending (limpia el vínculo).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  normalizeStatementLines,
  validateStatementInput,
  type LineStatus,
  type StatementActionState,
  type StatementInput,
} from "@/lib/studio/accounting/bank-statement-types";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function resolveTenant(
  supabase: Supa,
): Promise<{ tenantId?: string; error?: string }> {
  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  return { tenantId: link.tenant_id };
}

async function currentUserId(supabase: Supa): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function parseLines(formData: FormData) {
  const raw = formData.get("lines");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeStatementLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

function statementInputFromFormData(
  formData: FormData,
): Partial<StatementInput> {
  return {
    account_id: String(formData.get("account_id") ?? "").trim() || undefined,
    period_label: String(formData.get("period_label") ?? "").trim() || undefined,
    bank_name: String(formData.get("bank_name") ?? "").trim() || null,
    statement_ref: String(formData.get("statement_ref") ?? "").trim() || null,
    opening_balance: Number(formData.get("opening_balance") ?? 0) || 0,
    closing_balance: Number(formData.get("closing_balance") ?? 0) || 0,
    currency: String(formData.get("currency") ?? "USD").trim() || "USD",
    notes: String(formData.get("notes") ?? "").trim() || null,
    lines: parseLines(formData),
  };
}

/**
 * Crea un extracto con sus movimientos. Valida que la cuenta sea del tenant y
 * postable (banco/caja). NO toca el mayor. Idempotencia natural: unique
 * (tenant_id, account_id, period_label) evita dos extractos del mismo período.
 */
export async function createStatement(
  _prev: StatementActionState,
  formData: FormData,
): Promise<StatementActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const partial = statementInputFromFormData(formData);
  const { input, fieldErrors } = validateStatementInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // La cuenta debe existir, ser del tenant y postable (hoja del plan).
  const { data: acct, error: acctErr } = await supabase
    .from("accounts")
    .select("id, is_postable")
    .eq("id", input!.account_id)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; is_postable: boolean }>();
  if (acctErr) return { error: acctErr.message };
  if (!acct?.id) return { fieldErrors: { account_id: "Cuenta no encontrada." } };
  if (!acct.is_postable) {
    return {
      fieldErrors: { account_id: "Elige una cuenta postable (hoja del plan)." },
    };
  }

  const userId = await currentUserId(supabase);

  const { data: inserted, error } = await supabase
    .from("bank_statements")
    .insert({
      tenant_id: tenantId,
      account_id: input!.account_id,
      period_label: input!.period_label,
      bank_name: input!.bank_name,
      statement_ref: input!.statement_ref,
      opening_balance: input!.opening_balance,
      closing_balance: input!.closing_balance,
      currency: input!.currency,
      notes: input!.notes,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if ((error as { code?: string } | null)?.code === "23505") {
      return {
        fieldErrors: {
          period_label: "Ya existe un extracto de esa cuenta para ese período.",
        },
      };
    }
    return { error: `No se pudo crear el extracto: ${error?.message}` };
  }

  // Movimientos del extracto (denormalizando tenant_id para la RLS directa).
  const lineRows = input!.lines.map((l) => ({
    statement_id: inserted.id,
    tenant_id: tenantId,
    line_date: l.line_date,
    description: l.description,
    reference: l.reference,
    direction: l.direction,
    amount: l.amount,
    status: "pending" as LineStatus,
  }));
  const { error: linesErr } = await supabase
    .from("bank_statement_lines")
    .insert(lineRows);
  if (linesErr) {
    // Rollback manual del extracto (no hay transacción cross-statement).
    await supabase.from("bank_statements").delete().eq("id", inserted.id);
    return { error: `No se pudieron guardar los movimientos: ${linesErr.message}` };
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdId: inserted.id };
}

/** Agrega movimientos a un extracto existente. NO toca el mayor. */
export async function addLines(
  _prev: StatementActionState,
  formData: FormData,
): Promise<StatementActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const statementId = String(formData.get("statement_id") ?? "").trim();
  if (!statementId) return { error: "Falta el extracto." };

  const lines = parseLines(formData);
  if (lines.length < 1) {
    return { fieldErrors: { lines: "Carga al menos un movimiento." } };
  }

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // El extracto debe ser del tenant (RLS lo garantiza, validamos para mensaje).
  const { data: stmt, error: stmtErr } = await supabase
    .from("bank_statements")
    .select("id")
    .eq("id", statementId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string }>();
  if (stmtErr) return { error: stmtErr.message };
  if (!stmt?.id) return { error: "Extracto no encontrado." };

  const lineRows = lines.map((l) => ({
    statement_id: statementId,
    tenant_id: tenantId,
    line_date: l.line_date,
    description: l.description,
    reference: l.reference,
    direction: l.direction,
    amount: l.amount,
    status: "pending" as LineStatus,
  }));
  const { error } = await supabase.from("bank_statement_lines").insert(lineRows);
  if (error) return { error: `No se pudieron guardar los movimientos: ${error.message}` };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

/**
 * Liga un movimiento a un asiento EXISTENTE del diario (estado → matched).
 * NO crea ni muta el asiento: solo setea matched_entry_id + reconciled_*.
 * La defensa 1:1 (un asiento ↔ un solo movimiento) vive en el unique parcial
 * de la DB; acá damos un mensaje claro si choca.
 */
export async function matchLine(
  lineId: string,
  entryId: string,
  confidence?: "high" | "medium" | "low" | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // El asiento debe existir, ser del tenant, estar asentado y vivo.
  const { data: entry, error: entryErr } = await supabase
    .from("journal_entries")
    .select("id, status, deleted_at")
    .eq("id", entryId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; status: string; deleted_at: string | null }>();
  if (entryErr) return { error: entryErr.message };
  if (!entry?.id || entry.deleted_at) return { error: "Asiento no encontrado." };
  if (entry.status !== "asentado") {
    return { error: "Solo se puede ligar a un asiento asentado." };
  }

  const userId = await currentUserId(supabase);
  const { error } = await supabase
    .from("bank_statement_lines")
    .update({
      matched_entry_id: entryId,
      match_confidence: confidence ?? null,
      status: "matched",
      reconciled_at: new Date().toISOString(),
      reconciled_by: userId,
    })
    .eq("id", lineId)
    .eq("tenant_id", tenantId);
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { error: "Ese asiento ya está conciliado con otro movimiento." };
    }
    return { error: `No se pudo conciliar: ${error.message}` };
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

/**
 * Cambia el estado de un movimiento sin asiento: manual (conciliado sin asiento),
 * ignorado, o pending (revertir). Al salir de `matched`, limpia el vínculo
 * (libera el asiento para otro movimiento).
 */
export async function setLineStatus(
  lineId: string,
  status: "manual" | "ignored" | "pending",
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const userId = await currentUserId(supabase);
  const patch: Record<string, unknown> = {
    status,
    // Salir de matched libera el asiento ligado (vuelve a estar disponible 1:1).
    matched_entry_id: null,
    match_confidence: null,
    reconciled_at: status === "manual" ? new Date().toISOString() : null,
    reconciled_by: status === "manual" ? userId : null,
  };

  const { error } = await supabase
    .from("bank_statement_lines")
    .update(patch)
    .eq("id", lineId)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo actualizar el movimiento: ${error.message}` };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}
