/**
 * Server actions del módulo Contabilidad (SDD-0040).
 *
 * Asientos (state machine borrador → asentado · anulado) + gestión del plan
 * de cuentas. Patrón del repo: "use server" + useActionState + parse manual de
 * FormData + validate*Input() (sin Zod) + revalidatePath().
 *
 *  - createJournalEntry: parsea líneas, valida balanceado (debe=haber, ≥2,
 *    cuentas postables), inserta entry `borrador` + líneas, code via rpc.
 *  - postEntry: borrador → asentado (revalida balanceado) + posted_at.
 *  - voidEntry: asentado → anulado (no borra; los saldos lo ignoran).
 *  - softDeleteEntry: borrador → deleted_at.
 *  - createAccount / updateAccount: gestión del CoA (no asentar a no-postable;
 *    no borrar cuenta con movimientos).
 *
 * Acciones sensibles (asentar/anular/cuenta) → entity_audit_log con
 * actor_type='user' via admin client (entity_type 'journal_entry'/'account'
 * habilitados en la migración 0078).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  validateAccountInput,
  type AccountActionState,
  type AccountInput,
} from "@/lib/studio/account-types";
import {
  entryTotals,
  validateEntryInput,
  normalizeEntryLines,
  type JournalActionState,
  type JournalEntryInput,
  type JournalLineInput,
} from "@/lib/studio/journal-types";
import {
  accountHasMovements,
  listPostableAccounts,
} from "@/lib/studio/account-queries";

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

/** Best-effort audit. No bloquea la mutación. */
async function audit(
  tenantId: string,
  entityType: "journal_entry" | "account",
  entityId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("entity_audit_log").insert({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      actor_type: "user",
      actor_id: actorId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.error("[contabilidad audit] no se pudo registrar:", e);
  }
}

// ── Asientos ──────────────────────────────────────────────────

function parseEntryLines(formData: FormData): JournalLineInput[] {
  const raw = formData.get("lines");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeEntryLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

function entryInputFromFormData(
  formData: FormData,
): Partial<JournalEntryInput> {
  const entryDate = String(formData.get("entry_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  return {
    entry_date: entryDate || undefined,
    memo: memo || null,
    lines: parseEntryLines(formData),
  };
}

export async function createJournalEntry(
  _prev: JournalActionState,
  formData: FormData,
): Promise<JournalActionState> {
  const supabase = await createClient();

  // Set de cuentas postables para validar (solo se asienta a hojas).
  const postable = await listPostableAccounts(supabase);
  const postableIds = new Set(postable.map((a) => a.id));

  const partial = entryInputFromFormData(formData);
  const { input, fieldErrors } = validateEntryInput(partial, postableIds);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_entry_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del asiento." };
  }
  const entry_code = String(codeData);

  // ¿Asentar de una vez? Checkbox del drawer.
  const postNow = String(formData.get("post_on_create") ?? "") === "true";

  const { data: inserted, error } = await supabase
    .from("journal_entries")
    .insert({
      tenant_id: tenantId,
      entry_code,
      entry_date: input!.entry_date,
      memo: input!.memo,
      status: postNow ? "asentado" : "borrador",
      source: "manual",
      posted_at: postNow ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: `No se pudo crear el asiento: ${error?.message}` };
  }

  const lineRows = input!.lines.map((l) => ({
    entry_id: inserted.id,
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    line_memo: l.line_memo,
  }));
  const { error: linesErr } = await supabase
    .from("journal_lines")
    .insert(lineRows);
  if (linesErr) {
    // Rollback manual del header.
    await supabase.from("journal_entries").delete().eq("id", inserted.id);
    return { error: `No se pudieron guardar las líneas: ${linesErr.message}` };
  }

  if (postNow) {
    await audit(
      tenantId,
      "journal_entry",
      inserted.id,
      await currentUserId(supabase),
      "posted",
      { entry_code, on_create: true },
    );
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdCode: entry_code };
}

export async function postEntry(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, tenant_id, entry_code, status")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      entry_code: string;
      status: string;
    }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "borrador") {
    return { error: "Solo los borradores pueden asentarse." };
  }

  // Revalidar balanceado contra las líneas persistidas.
  const { data: lines, error: linesErr } = await supabase
    .from("journal_lines")
    .select("debit, credit")
    .eq("entry_id", id);
  if (linesErr) return { error: linesErr.message };

  const rows = (lines as { debit: number; credit: number }[] | null) ?? [];
  if (rows.length < 2) {
    return { error: "Un asiento necesita al menos 2 líneas para asentarse." };
  }
  const totals = entryTotals(
    rows.map((r) => ({ debit: Number(r.debit), credit: Number(r.credit) })),
  );
  if (!totals.balanced) {
    return {
      error: `El asiento no balancea (debe ${totals.debit.toFixed(2)} ≠ haber ${totals.credit.toFixed(2)}).`,
    };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "asentado", posted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await audit(
    entry.tenant_id,
    "journal_entry",
    entry.id,
    await currentUserId(supabase),
    "posted",
    { entry_code: entry.entry_code },
  );

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function voidEntry(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, tenant_id, entry_code, status, source")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      entry_code: string;
      status: string;
      source: string;
    }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "asentado") {
    return { error: "Solo los asientos asentados pueden anularse." };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ status: "anulado" })
    .eq("id", id);
  if (error) return { error: error.message };

  await audit(
    entry.tenant_id,
    "journal_entry",
    entry.id,
    await currentUserId(supabase),
    "voided",
    { entry_code: entry.entry_code, source: entry.source },
  );

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function softDeleteEntry(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "borrador") {
    return { error: "Solo los borradores pueden eliminarse." };
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

// ── Plan de cuentas ───────────────────────────────────────────

function accountInputFromFormData(
  formData: FormData,
): Partial<AccountInput> {
  const typeRaw = String(formData.get("type") ?? "").trim();
  return {
    code: String(formData.get("code") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim() || undefined,
    type: (typeRaw || undefined) as AccountInput["type"] | undefined,
    parent_id: String(formData.get("parent_id") ?? "").trim() || null,
    is_postable: String(formData.get("is_postable") ?? "true") === "true",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createAccount(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const supabase = await createClient();

  const partial = accountInputFromFormData(formData);
  const { input, fieldErrors } = validateAccountInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const { error } = await supabase.from("accounts").insert({
    tenant_id: tenantId,
    code: input!.code,
    name: input!.name,
    type: input!.type,
    parent_id: input!.parent_id,
    is_postable: input!.is_postable,
    notes: input!.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { code: "Ya existe una cuenta con ese código." } };
    }
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }

  await audit(
    tenantId,
    "account",
    input!.code,
    await currentUserId(supabase),
    "created",
    { code: input!.code, name: input!.name, type: input!.type },
  );

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdCode: input!.code };
}

export async function updateAccount(
  id: string,
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("accounts")
    .select("id, tenant_id, code, is_postable")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      code: string;
      is_postable: boolean;
    }>();
  if (readErr || !current) return { error: "Cuenta no encontrada." };

  const partial = accountInputFromFormData(formData);
  const { input, fieldErrors } = validateAccountInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Si se intenta volver no-postable una cuenta con movimientos, bloquear.
  if (current.is_postable && !input!.is_postable) {
    const hasMov = await accountHasMovements(supabase, id);
    if (hasMov) {
      return {
        error:
          "No se puede volver grupo una cuenta con movimientos asentados.",
      };
    }
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: input!.name,
      type: input!.type,
      is_postable: input!.is_postable,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  await audit(
    current.tenant_id,
    "account",
    current.code,
    await currentUserId(supabase),
    "updated",
    { code: current.code, name: input!.name },
  );

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function deleteAccount(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const hasMov = await accountHasMovements(supabase, id);
  if (hasMov) {
    return { error: "No se puede eliminar una cuenta con movimientos." };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}
