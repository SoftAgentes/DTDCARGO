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
 * Las mutaciones de cuentas y asientos se auditan atómicamente mediante los
 * triggers de dominio D2 (SDD-0174).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import { moduleEditDenial, tenantAdminGate } from "@/lib/studio/rbac-guard";
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
import {
  mensajeDeMotivo,
  textoAvisoCierre,
  type AvisoCierre,
  type ExcepcionDelCierre,
  type ModoCierre,
  type OperacionCierre,
  type ResultadoDeAsiento,
} from "@/lib/studio/accounting/cierre-excepciones";
import { avisoDe, getEstadoCierre } from "@/lib/studio/accounting/cierre-queries";
import {
  getAccountingSettings,
  isPeriodClosed,
} from "@/lib/studio/accounting/period-queries";

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

// ── Excepción al cierre (SDD-0566) ────────────────────────────

/** Lo que la persona escribió para pedir la excepción. La superclave no se guarda ni se registra. */
function excepcionDelFormulario(formData: FormData): ExcepcionDelCierre | null {
  const motivo = String(formData.get("cierre_motivo") ?? "").trim();
  if (!motivo) return null;
  const clave = String(formData.get("cierre_superclave") ?? "");
  return { superclave: clave || null, motivo };
}

/**
 * El aviso del cierre, o null si no se puede leer el estado (por ejemplo, sin
 * la 0493): entonces cada acción vuelve a su mensaje de antes y no ofrece la
 * excepción.
 */
async function avisoDelCierre(supabase: Supa): Promise<AvisoCierre | null> {
  try {
    return avisoDe(await getEstadoCierre(supabase));
  } catch (e) {
    console.error("[cierre-contable] estado no disponible:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * La respuesta de una RPC de 0493, en palabras de la persona. Solo se muestran
 * los mensajes propios de la 0493, que llevan `hint = 'dtd-cierre'`: un 42501
 * nativo («permission denied for function …») tiene el mismo código y no se
 * muestra. Cualquier otro error de la base tampoco (ERR-01).
 */
const esMensajeDelCierre = (error: { code?: string; message?: string; hint?: string }): boolean =>
  error.hint === "dtd-cierre" && (error.code === "22023" || error.code === "42501") && Boolean(error.message);

/** La respuesta de una RPC de 0493 (ver esMensajeDelCierre). */
function resultadoDelCierre(
  data: unknown,
  error: { code?: string; message?: string; hint?: string } | null,
  operacion: OperacionCierre,
): { ok: true; entryCode?: string } | { ok: false; error: string } {
  if (error) {
    if (esMensajeDelCierre(error) && error.message) {
      return { ok: false, error: error.message };
    }
    console.error("[cierre-contable] rpc:", error.code, error.message);
    return { ok: false, error: mensajeDeMotivo("", operacion) };
  }
  const d = (data ?? {}) as { ok?: boolean; motivo?: string; entry_code?: string };
  if (d.ok === true) return { ok: true, entryCode: d.entry_code };
  return { ok: false, error: mensajeDeMotivo(d.motivo ?? "", operacion) };
}

/** Asentar, anular o eliminar en período cerrado: pide la excepción o la usa. */
async function enPeriodoCerrado(
  supabase: Supa,
  operacion: OperacionCierre,
  rpc: "asentar_asiento_en_cierre" | "anular_asiento_en_cierre" | "eliminar_borrador_en_cierre",
  id: string,
  excepcion: ExcepcionDelCierre | undefined,
  mensajeSinExcepcion: string,
): Promise<ResultadoDeAsiento> {
  const aviso = await avisoDelCierre(supabase);
  if (!aviso) return { error: mensajeSinExcepcion };
  const motivo = excepcion?.motivo?.trim() ?? "";
  if (!excepcion || !motivo) return { error: textoAvisoCierre(aviso), cierre: aviso };
  const { data, error } = await supabase.rpc(rpc, {
    p_entry_id: id,
    p_clave: excepcion.superclave || null,
    p_motivo: motivo,
  });
  const r = resultadoDelCierre(data, error, operacion);
  if (!r.ok) return { error: r.error, cierre: aviso };
  revalidatePath("/studio/contabilidad");
  return { ok: true };
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
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  // Set de cuentas postables para validar (solo se asienta a hojas).
  const postable = await listPostableAccounts(supabase);
  const postableIds = new Set(postable.map((a) => a.id));

  const partial = entryInputFromFormData(formData);
  const { input, fieldErrors } = validateEntryInput(partial, postableIds);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // Guard de período cerrado (SDD-0080): no crear asientos con fecha cerrada.
  // El trigger de DB es la defensa dura; esto da un mensaje claro antes.
  // SDD-0566: con la excepción (superclave y motivo) se crea por la RPC.
  const settings = await getAccountingSettings(supabase);
  if (isPeriodClosed(settings.closing_date, input!.entry_date)) {
    const aviso = await avisoDelCierre(supabase);
    if (!aviso) {
      return {
        error: `Período contable cerrado al ${settings.closing_date}: no puedes crear asientos con esa fecha o anteriores.`,
      };
    }
    const excepcion = excepcionDelFormulario(formData);
    if (!excepcion) return { error: textoAvisoCierre(aviso), cierre: aviso };
    const { data, error } = await supabase.rpc("crear_asiento_en_cierre", {
      p_entrada: {
        entry_date: input!.entry_date,
        memo: input!.memo,
        asentar: String(formData.get("post_on_create") ?? "") === "true",
        lineas: input!.lines.map((l) => ({
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          line_memo: l.line_memo,
        })),
      },
      p_clave: excepcion.superclave,
      p_motivo: excepcion.motivo,
    });
    const r = resultadoDelCierre(data, error, "crear");
    if (!r.ok) return { error: r.error, cierre: aviso };
    revalidatePath("/studio/contabilidad");
    return { ok: true, createdCode: r.entryCode };
  }

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

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdCode: entry_code };
}

export async function postEntry(
  id: string,
  excepcion?: ExcepcionDelCierre,
): Promise<ResultadoDeAsiento> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, tenant_id, entry_code, status, entry_date")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      entry_code: string;
      status: string;
      entry_date: string;
    }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "borrador") {
    return { error: "Solo los borradores pueden asentarse." };
  }

  // Guard de período cerrado (SDD-0080). SDD-0566: con la excepción, por la RPC.
  const settings = await getAccountingSettings(supabase);
  if (isPeriodClosed(settings.closing_date, entry.entry_date)) {
    return await enPeriodoCerrado(supabase, "asentar", "asentar_asiento_en_cierre", id, excepcion,
      `Período contable cerrado al ${settings.closing_date}: no puedes asentar en período cerrado.`);
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

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function voidEntry(
  id: string,
  reasonRaw: string,
  superclave?: string | null,
): Promise<ResultadoDeAsiento> {
  const reasonResult = validateAuditReason(reasonRaw);
  if (!reasonResult.ok) return { error: reasonResult.error };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, tenant_id, entry_code, status, source, entry_date")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      entry_code: string;
      status: string;
      source: string;
      entry_date: string;
    }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "asentado") {
    return { error: "Solo los asientos asentados pueden anularse." };
  }

  // Guard de período cerrado (SDD-0080): no anular asientos de período cerrado.
  // SDD-0566: el motivo de la anulación es también el de la excepción; con la
  // superclave (o en modo advertencia) se anula por la RPC.
  const settings = await getAccountingSettings(supabase);
  if (isPeriodClosed(settings.closing_date, entry.entry_date)) {
    const pedida = superclave === undefined ? undefined : { superclave, motivo: reasonResult.reason };
    return await enPeriodoCerrado(supabase, "anular", "anular_asiento_en_cierre", id, pedida,
      `Período contable cerrado al ${settings.closing_date}: no puedes anular asientos de período cerrado.`);
  }

  const { data: changed, error } = await supabase.rpc(
    "void_journal_entry_with_audit_reason",
    {
      p_id: id,
      p_reason: reasonResult.reason,
    },
  );
  if (error) return { error: error.message };
  if (!changed) return { error: "El asiento ya no admite anulación." };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function softDeleteEntry(
  id: string,
  excepcion?: ExcepcionDelCierre,
): Promise<ResultadoDeAsiento> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { data: entry, error: readErr } = await supabase
    .from("journal_entries")
    .select("id, status, entry_date")
    .eq("id", id)
    .maybeSingle<{ id: string; status: string; entry_date: string }>();
  if (readErr || !entry) return { error: "Asiento no encontrado." };
  if (entry.status !== "borrador") {
    return { error: "Solo los borradores pueden eliminarse." };
  }

  // Guard de período cerrado (SDD-0080). SDD-0566: con la excepción, por la RPC.
  const settings = await getAccountingSettings(supabase);
  if (isPeriodClosed(settings.closing_date, entry.entry_date)) {
    return await enPeriodoCerrado(supabase, "eliminar", "eliminar_borrador_en_cierre", id, excepcion,
      `Período contable cerrado al ${settings.closing_date}: no puedes eliminar asientos de período cerrado.`);
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

// ── Cierre de período (SDD-0080, admin-only) ──────────────────

const CLOSING_ADMIN_MSG =
  "Solo los administradores pueden fijar el cierre de período.";

/**
 * Fija (o limpia) la fecha de cierre del período contable del tenant. Admin-only.
 * `closingDate` vacío/null → reabre (sin cierre). La defensa dura vive en el
 * trigger de DB; acá validamos rol + formato y persistimos el singleton.
 */
export async function setClosingDateAction(
  closingDate: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const closing = closingDate?.trim() || null;
  if (closing && !/^\d{4}-\d{2}-\d{2}$/.test(closing)) {
    return { error: "Formato de fecha inválido (YYYY-MM-DD)." };
  }

  // SDD-0498: el gate lo resuelve `rbac-guard` (una sola resolución del rol,
  // con el fail-closed por `disabled_at` del endurecimiento 0200). Acá se leía
  // `user_tenants` a mano sin ese filtro, así que un admin suspendido seguía
  // pudiendo fijar y levantar el cierre del período.
  const gate = await tenantAdminGate(supabase, { denied: CLOSING_ADMIN_MSG });
  if (!gate.ok) return { error: gate.denied };

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("accounting_settings").upsert(
    {
      tenant_id: gate.tenantId,
      closing_date: closing,
      locked_by: closing ? gate.userId : null,
      locked_at: closing ? nowIso : null,
      updated_by: gate.userId,
    },
    { onConflict: "tenant_id" },
  );
  if (error) {
    return { error: `No se pudo guardar el cierre: ${error.message}` };
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

// ── Modo del cierre y superclave (SDD-0566, admin-only) ───────

/** Cambia cómo se toca un período cerrado. Queda en el historial (trigger de 0493). */
export async function setClosingModeAction(
  modo: ModoCierre,
): Promise<{ ok?: boolean; error?: string }> {
  if (modo !== "superclave" && modo !== "advertencia") {
    return { error: "Elige un modo del cierre." };
  }
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase, { denied: CLOSING_ADMIN_MSG });
  if (!gate.ok) return { error: gate.denied };

  const { error } = await supabase.from("accounting_settings").upsert(
    { tenant_id: gate.tenantId, closing_mode: modo, updated_by: gate.userId },
    { onConflict: "tenant_id" },
  );
  if (error) {
    console.error("[cierre-contable] modo:", error.code, error.message);
    return { error: "No se pudo guardar el modo del cierre. Intenta de nuevo." };
  }
  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

const SUPERCLAVE_MOTIVO: Record<string, string> = {
  incorrecta: "La superclave actual no es correcta. Cada 5 intentos fallidos se bloquea, y cada bloqueo dura el doble que el anterior.",
  bloqueada: "La superclave está bloqueada por intentos fallidos. Intenta de nuevo más tarde o restablécela.",
};

/** Error de una RPC de la superclave: nuestros textos (con su hint) o uno genérico. Nunca el valor. */
function errorDeSuperclave(error: { code?: string; message?: string; hint?: string }): string {
  if (esMensajeDelCierre(error) && error.message) return error.message;
  console.error("[cierre-contable] superclave:", error.code);
  return "No se pudo guardar la superclave. Intenta de nuevo.";
}

function validarNuevaSuperclave(nueva: string, confirmacion: string): string | null {
  // bcrypt usa solo los primeros 72 bytes (como la 0493): más larga, dos claves serían la misma.
  if (nueva.length < 8 || nueva.length > 64 || Buffer.byteLength(nueva, "utf8") > 72) {
    return "La superclave debe tener entre 8 y 64 caracteres (con muchas tildes o eñes, menos).";
  }
  if (nueva !== confirmacion) return "La confirmación no coincide con la superclave nueva.";
  return null;
}

/** Define la superclave (si no hay) o la cambia dando la actual. Se guarda solo como hash. */
export async function fijarSuperclaveAction(
  actual: string,
  nueva: string,
  confirmacion: string,
): Promise<{ ok?: boolean; error?: string }> {
  const invalida = validarNuevaSuperclave(nueva, confirmacion);
  if (invalida) return { error: invalida };
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase, { denied: CLOSING_ADMIN_MSG });
  if (!gate.ok) return { error: gate.denied };

  const { data, error } = await supabase.rpc("fijar_superclave_de_cierre", {
    p_actual: actual || null,
    p_nueva: nueva,
  });
  if (error) return { error: errorDeSuperclave(error) };
  const d = (data ?? {}) as { ok?: boolean; motivo?: string };
  if (d.ok !== true) return { error: SUPERCLAVE_MOTIVO[d.motivo ?? ""] ?? "No se pudo guardar la superclave." };
  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

/** Restablece la superclave sin la actual (olvido), con motivo. Queda en el historial. */
export async function restablecerSuperclaveAction(
  nueva: string,
  confirmacion: string,
  motivo: string,
): Promise<{ ok?: boolean; error?: string }> {
  const invalida = validarNuevaSuperclave(nueva, confirmacion);
  if (invalida) return { error: invalida };
  if (motivo.trim().length < 10) return { error: "Indica el motivo del restablecimiento (al menos 10 caracteres)." };
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase, { denied: CLOSING_ADMIN_MSG });
  if (!gate.ok) return { error: gate.denied };

  const { error } = await supabase.rpc("restablecer_superclave_de_cierre", {
    p_nueva: nueva,
    p_motivo: motivo.trim(),
  });
  if (error) return { error: errorDeSuperclave(error) };
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
    subtype: String(formData.get("subtype") ?? "").trim() || null,
    is_postable: String(formData.get("is_postable") ?? "true") === "true",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createAccount(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

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
    subtype: input!.subtype,
    is_postable: input!.is_postable,
    notes: input!.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return { fieldErrors: { code: "Ya existe una cuenta con ese código." } };
    }
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdCode: input!.code };
}

export async function updateAccount(
  id: string,
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

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
      subtype: input!.subtype,
      is_postable: input!.is_postable,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export async function deleteAccount(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const hasMov = await accountHasMovements(supabase, id);
  if (hasMov) {
    return { error: "No se puede eliminar una cuenta con movimientos." };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}
