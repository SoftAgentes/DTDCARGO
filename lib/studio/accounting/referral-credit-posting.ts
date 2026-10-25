/**
 * Asiento automático del CRÉDITO DE REFERIDO aplicado (SDD-0137) —
 * referrals ('aplicado') → journal_entries.
 *
 * Hermano de `expense-posting.ts` / `claim-posting.ts`. Al APLICAR el crédito
 * acreditado ($80) del referidor a su próxima factura, se genera un asiento
 * propio (source='referral_credit', independiente del asiento de venta de la
 * factura, que queda INTACTO):
 *
 *     DR  6.11  Publicidad y marketing            = 80.00   (el incentivo, gasto)
 *     CR  1.1.2 Cuentas por cobrar clientes       = 80.00   (baja el saldo del referidor)
 *
 * Clasificación FIJA — sin setting, y NADA de fiscal (decisión del founder
 * 2026-07-15: el módulo Fiscal está apagado, lleva su propio libro, y nada se ata a
 * él). La CUENTA no cambia: sigue siendo 6.11, lo que la spec 0137 §3.3 registra
 * como decisión del founder. Lo que se quitó fue el SETTING que la hacía
 * configurable vía `fiscal_settings.referral_credit_mode` — ese cordón se cortó.
 *
 * 🔜 TRANSITORIO: la re-espec de SDD-0137 (modelo "Delayed Credit" de QuickBooks —
 * la promesa no toca los libros hasta aterrizar como línea en una factura futura)
 * probablemente elimine este asiento por completo: si el crédito baja el TOTAL de
 * la factura, la venta ya se registra por lo que vale y no hay nada que asentar
 * aparte. Ver handoff 2026-07-15.
 *
 * Molde idéntico a expense-posting:
 *  - Corre con admin client (service_role).
 *  - Best-effort: si falta una cuenta del plan → skip graceful (no asienta, no
 *    rompe la aplicación; el caller decide si revierte el estado).
 *  - Idempotencia REAL: la transición de estado 'acreditado'→'aplicado' es la
 *    guarda (row-lock en la acción); acá además no duplicamos si ya hay asiento
 *    vivo linkeado a este referral (referrals.applied_entry_id).
 */

import { createAdminClient } from "@/lib/db/admin";

// Las cuentas viven en `./referral-credit-modes` (módulo SIN imports): este
// archivo arrastra el admin client (service_role) y no puede filtrarse al bundle
// del navegador.
export {
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
} from "./referral-credit-modes";

import {
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_DEBIT_MEMO,
} from "./referral-credit-modes";

/**
 * Lo único que este módulo necesita del cliente del USUARIO: llamar a una RPC.
 * Estructural a propósito: no arrastra `next/headers` a través de
 * `@/lib/db/server` y deja probar la reversión sin montar un cliente entero.
 */
export type SupabaseLikeClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ReferralCreditPostingInput = {
  tenantId: string;
  /** referrals.id del crédito que se aplica. */
  referralId: string;
  referralCode: string;
  /** MARKBOX del referidor (para el memo). */
  referrerMarkbox: string;
  /** Factura del referidor donde se aplica (invoices.id). Linkea el asiento. */
  invoiceId: string;
  invoiceCode: string;
  /** Monto del crédito en USD (referrals.reward_usd, típ. 80). */
  amountUsd: number;
  /** Fecha del asiento. YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type ReferralCreditPostingResult = {
  ok: boolean;
  entryCode?: string;
  entryId?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, monto cero, etc.). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Una línea del asiento (debe XOR haber). */
export type ReferralCreditLine = {
  account_id: string;
  debit: number;
  credit: number;
  line_memo: string;
};

/**
 * Construye las 2 líneas del asiento del crédito aplicado. PURA — testeable
 * sin DB. Por construcción balancea (Σ debe == Σ haber == amountUsd):
 *
 *   DR  debitAccountId   = amountUsd   (6.11 marketing | 4.9 descuento, según modo)
 *   CR  receivableId     = amountUsd   (1.1.2 CxC: baja el saldo del referidor)
 */
export function buildReferralCreditLines(
  debitAccountId: string,
  receivableAccountId: string,
  amountUsd: number,
): ReferralCreditLine[] {
  const amt = round2(amountUsd);
  return [
    {
      account_id: debitAccountId,
      debit: amt,
      credit: 0,
      line_memo: REFERRAL_CREDIT_DEBIT_MEMO,
    },
    {
      account_id: receivableAccountId,
      debit: 0,
      credit: amt,
      line_memo: "Baja de CxC por crédito de referido",
    },
  ];
}

/**
 * Crea (idempotente, best-effort) el asiento del crédito de referido aplicado.
 * No throwea: devuelve `{ ok, entryCode | entryId | skipped | error }`.
 */
export async function postReferralCreditJournalEntry(
  input: ReferralCreditPostingInput,
): Promise<ReferralCreditPostingResult> {
  try {
    const admin = createAdminClient();

    const amountUsd = round2(Number(input.amountUsd) || 0);
    if (amountUsd <= 0) {
      return { ok: true, skipped: "zero-amount" };
    }

    // 1. Idempotencia REAL (hueco B): ¿ya hay un asiento VIVO (no anulado) de
    //    este crédito? Se busca por journal_entries.referral_id — NO por
    //    referrals.applied_entry_id, que puede quedar NULL si el proceso murió
    //    entre el claim y el linkage. Si existe, se devuelve su id para que el
    //    caller lo (re)linkee (idempotente). El UNIQUE parcial en DB
    //    (journal_entries_referral_credit_uniq) es la guarda dura contra la carrera.
    const { data: existing, error: exErr } = await admin
      .from("journal_entries")
      .select("id, entry_code")
      .eq("tenant_id", input.tenantId)
      .eq("referral_id", input.referralId)
      .eq("source", "referral_credit")
      .neq("status", "anulado")
      .is("deleted_at", null)
      .maybeSingle<{ id: string; entry_code: string }>();
    if (exErr) return { ok: false, error: exErr.message };
    if (existing?.id) {
      return {
        ok: true,
        entryId: existing.id,
        entryCode: existing.entry_code,
        skipped: "entry-already-exists",
      };
    }

    // 2. Cuenta del DEBE: fija (6.11 marketing). Ya no hay modo configurable.
    const debitCode = REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE;
    const { data: debitAcc, error: debitErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("code", debitCode)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (debitErr) return { ok: false, error: debitErr.message };
    if (!debitAcc?.id || !debitAcc.is_postable) {
      return { ok: false, skipped: "missing-debit-account" };
    }

    // 3. Cuenta del HABER: CxC de clientes (1.1.2).
    const { data: crAcc, error: crErr } = await admin
      .from("accounts")
      .select("id, is_postable")
      .eq("tenant_id", input.tenantId)
      .eq("code", REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE)
      .maybeSingle<{ id: string; is_postable: boolean }>();
    if (crErr) return { ok: false, error: crErr.message };
    if (!crAcc?.id || !crAcc.is_postable) {
      return { ok: false, skipped: "missing-receivable-account" };
    }

    // 4. entry_code atómico (mismo RPC que el resto de posteos).
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: input.tenantId },
    );
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);
    const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);

    // 5. Insertar el asiento (asentado) + sus 2 líneas. Se linkea a la factura
    //    (invoice_id) para la reversión al anular la factura (§3.6).
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Crédito de referido ${input.referralCode} · ${input.referrerMarkbox} · factura ${input.invoiceCode}`,
        status: "asentado",
        source: "referral_credit",
        invoice_id: input.invoiceId,
        referral_id: input.referralId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      // Carrera (doble-submit): el UNIQUE parcial journal_entries_referral_credit_uniq
      // rechazó un 2º asiento del mismo crédito (23505). Ganó otro proceso →
      // devolvemos el asiento vivo existente en vez de duplicar (idempotencia DB).
      if (entryErr?.code === "23505") {
        const { data: won } = await admin
          .from("journal_entries")
          .select("id, entry_code")
          .eq("tenant_id", input.tenantId)
          .eq("referral_id", input.referralId)
          .eq("source", "referral_credit")
          .neq("status", "anulado")
          .is("deleted_at", null)
          .maybeSingle<{ id: string; entry_code: string }>();
        if (won?.id) {
          return {
            ok: true,
            entryId: won.id,
            entryCode: won.entry_code,
            skipped: "entry-already-exists",
          };
        }
      }
      return {
        ok: false,
        error: entryErr?.message ?? "no se pudo crear el asiento",
      };
    }

    const lines = buildReferralCreditLines(
      debitAcc.id,
      crAcc.id,
      amountUsd,
    ).map((l) => ({ ...l, entry_id: insertedEntry.id }));
    const { error: linesErr } = await admin
      .from("journal_lines")
      .insert(lines);
    if (linesErr) {
      // Rollback manual del header (no hay tx cross-statement acá). Fix D: si el
      // DELETE del header falla, NO dejamos un asiento 'asentado' sin líneas
      // (0=0, cuenta como vivo y bloquea el UNIQUE de reintento) → fallback:
      // marcarlo 'anulado' para que no afecte saldos ni tape la re-aplicación.
      const { error: delErr } = await admin
        .from("journal_entries")
        .delete()
        .eq("id", insertedEntry.id);
      if (delErr) {
        await admin
          .from("journal_entries")
          .update({ status: "anulado" })
          .eq("id", insertedEntry.id);
      }
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode, entryId: insertedEntry.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Anula el asiento vivo de un crédito de referido (al revertir la aplicación:
 * §3.6 factura anulada). Marca `anulado` (los saldos lo ignoran). Idempotente,
 * best-effort, no throwea. Busca por el asiento linkeado al referral.
 */
export async function voidReferralCreditEntry(
  tenantId: string,
  entryId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!entryId) return { ok: true };
    const admin = createAdminClient();
    const { error } = await admin
      .from("journal_entries")
      .update({ status: "anulado" })
      .eq("tenant_id", tenantId)
      .eq("id", entryId)
      .eq("status", "asentado")
      .is("deleted_at", null);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}


/**
 * Lo que `revert_referral_credits` (migración 0471) devuelve por cada crédito
 * que sacó de 'aplicado'. `applied_entry_id` puede ser null: si el proceso que
 * aplicó murió antes de linkear el asiento, el link nunca se escribió aunque el
 * asiento exista con `referral_id` (el hueco B de SDD-0137).
 */
export type RevertedReferralCredit = {
  referral_id: string;
  referral_code: string | null;
  amount: number;
  applied_entry_id: string | null;
};

/**
 * Mensaje único del fallo de la reversión. El gate de símbolos pendientes lo usa
 * como evidencia: sin la 0471 aplicada, PostgREST responde que la función no
 * existe y la reversión devuelve `ok: false` con este texto por delante, sin
 * tocar ni la factura ni el crédito.
 */
export const REVERT_REFERRAL_CREDITS_ERROR = "No se pudieron revertir los créditos de referido";

/**
 * QUÉ falló cuando `ok` es false. Existe porque `reverted` no alcanza para
 * distinguirlo y sobrecargarlo haría mentir al aviso del Studio:
 *
 *  - `"revert"`: la RPC falló y NO se movió nada — ni la factura, ni el crédito,
 *    ni los asientos. `reverted` es 0. Qué lo produce hoy, con la 0471 ya
 *    aplicada (2026-09-21). **El orden NO es de frecuencia** —nadie contó
 *    errores de producción— sino de cuál cuesta más reconocer:
 *      · **`statement_timeout` (57014)** — la factura lleva más de **8 s** tomada
 *        por otro escritor: un cobro, una anulación u otra aplicación. Es
 *        CONTENCIÓN, no un permiso roto, y es el precio del `FOR UPDATE` que
 *        esta SDD introdujo: antes nadie esperaba y se corrompía en silencio.
 *        Va primera porque **es nueva y es la que nadie va a sospechar**: quien
 *        vea `failure: "revert"` se va derecho a buscar un permiso.
 *        Los 8 s son del rol `authenticated`, el de la sesión que llama a las
 *        RPC; medido en producción, no supuesto. (Desde la 0494 son SECURITY
 *        DEFINER, pero el statement_timeout sigue siendo el de la sesión.)
 *        **Busca 57014, NO 55P03.** El `lock_timeout` del clúster es 0, así que
 *        la espera por el lock no vence nunca: lo que corta es el
 *        `statement_timeout`, y corta la sentencia entera. Quien busque
 *        `lock_not_available` en los logs no va a encontrar nada y va a concluir
 *        que no hubo contención. El `lock_timeout = '5s'` de la cabecera de la
 *        0471 tampoco rige acá: es de sesión al aplicar, y el `proconfig` de las
 *        dos funciones lleva sólo `search_path`.
 *        Y los 8 s cubren la RPC ENTERA, no sólo la espera: con varios créditos
 *        en la misma factura, el barrido gasta del mismo presupuesto.
 *      · `REFERRAL_CREDIT_FORBIDDEN` (42501) — quien llama no es
 *        `accounting`/`admin` del tenant, o `get_user_tenant_id()` no resuelve
 *        una membresía activa única.
 *      · `REFERRAL_CREDIT_INPUT` (22023) — llegó sin id de factura.
 *      · transporte: PostgREST o red.
 *    Ya NO lo produce que la función no exista (`PGRST202`): eso sólo volvería
 *    restaurando la base a antes de la 0471.
 *  - `"entries"`: el dinero SÍ volvió (la factura quedó bien y el crédito está
 *    disponible otra vez) y lo que no se pudo fue anular su asiento. `reverted`
 *    cuenta los créditos devueltos. Avisar «no se revirtió» acá sería falso.
 *
 * Antes de la SDD-0496 no había forma de separarlos: la reversión recorría los
 * créditos de a uno, `reverted` contaba los que salían bien y un `ok:false` con
 * `reverted > 0` significaba «unos sí y otros no». Con la 0471 ese caso ya no
 * existe —los créditos de una factura se revierten en UNA transacción, todos o
 * ninguno—, así que el campo queda libre para decir lo que de verdad pasó.
 *
 * ⚠️ SI AGREGAS UN TERCER VALOR ACÁ, mirá `voidReferralRevertTitle` en
 * `lib/studio/fidelizacion/referral-revert-notice.ts`: su `else` es
 * ATRAPA-TODO. Hoy es correcto y su prueba lo fija, pero no distingue «título
 * desconocido» de «es el del crédito sin liberar», así que un tercer caso
 * caería al título del crédito varado **sin que nada avise** — y si ese tercer
 * caso no es sobre un crédito varado, el banner diría lo contrario del cuerpo,
 * que es justo el defecto que la 0496 vino a cerrar. Agregá su título y su rama
 * en la misma tanda. (Anotado a pedido del Director, 2026-09-21.)
 */
export type ReferralCreditRevertFailure = "revert" | "entries";

/**
 * REVIERTE los créditos de referido aplicados a una factura (§3.6: la factura se
 * anuló), o uno solo si se nombra `referralId` — que es como `applyReferralCredit`
 * compensa cuando el asiento no se pudo crear.
 *
 * SDD-0496: el trabajo de dinero lo hace `revert_referral_credits` (0471) en UNA
 * transacción, con la factura tomada FOR UPDATE: el crédito vuelve a 'acreditado'
 * con el rastro limpio y el abono baja de `invoices.paid_amount` con la regla de
 * estado de `void_collection_receipt` (0467) juntos, o no pasa nada. Antes eran
 * peticiones separadas con guard optimista y relectura (SDD-0490), y quedaban
 * dos ventanas en las que se bajaba un abono que nunca había llegado a la
 * factura.
 *
 * Corre con el cliente del USUARIO, no con el admin client: la RPC exige rol
 * accounting/admin en el tenant de QUIEN LLAMA (auth.uid()), igual que las de la
 * 0467. Hasta la 0494 era SECURITY INVOKER; desde la 0494 es DEFINER (SDD-0567),
 * porque authenticated ya no tiene UPDATE de referrals, y la guarda no cambió.
 * `voidInvoice` y `applyReferralCredit` ya están detrás del mismo gate de dinero.
 *
 * Lo único que queda afuera son los ASIENTOS, best-effort y con el admin client,
 * como en la 0467: se barren por `journal_entries.referral_id` (no sólo por
 * `applied_entry_id`) para que un asiento sin linkear igual se anule. Si la
 * plata se revirtió pero un asiento no se pudo anular, se informa igual —con
 * `failure: "entries"`— porque el mayor necesita una mirada aunque la factura ya
 * esté bien. Un fallo de la RPC lleva `failure: "revert"` y no movió nada.
 *
 * No throwea. `reverted` cuenta los créditos que la RPC devolvió a 'acreditado'.
 */
export async function revertReferralCreditsForInvoice(
  supabase: SupabaseLikeClient,
  tenantId: string,
  invoiceId: string,
  referralId?: string | null,
): Promise<{
  ok: boolean;
  reverted: number;
  error?: string;
  credits?: RevertedReferralCredit[];
  failure?: ReferralCreditRevertFailure;
}> {
  try {
    if (!invoiceId) return { ok: true, reverted: 0, credits: [] };

    const { data, error } = await supabase.rpc("revert_referral_credits", {
      p_invoice_id: invoiceId,
      p_referral_id: referralId ?? null,
    });
    if (error) {
      return {
        ok: false,
        reverted: 0,
        failure: "revert",
        error: `${REVERT_REFERRAL_CREDITS_ERROR}: ${error.message}`,
      };
    }

    const credits =
      ((data as { reverted?: RevertedReferralCredit[] } | null)?.reverted ?? []).map((c) => ({
        ...c,
        amount: round2(Number(c.amount) || 0),
      }));
    if (credits.length === 0) return { ok: true, reverted: 0, credits };

    // Los asientos, fuera de la transacción de dinero. Idempotente por el
    // `.eq("status", "asentado")` de voidReferralCreditEntry.
    const admin = createAdminClient();
    const failures: string[] = [];
    for (const c of credits) {
      const { data: entries, error: readErr } = await admin
        .from("journal_entries")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("referral_id", c.referral_id)
        .eq("source", "referral_credit")
        .eq("status", "asentado")
        .is("deleted_at", null);
      if (readErr) {
        failures.push(`crédito ${c.referral_id}: ${readErr.message}`);
        continue;
      }
      const ids = ((entries as { id: string }[] | null) ?? []).map((e) => e.id);
      // Cinturón y tirantes: un applied_entry_id que el filtro no barrió
      // (asientos viejos con referral_id null) se anula igual.
      if (c.applied_entry_id && !ids.includes(c.applied_entry_id)) ids.push(c.applied_entry_id);
      for (const id of ids) {
        const voided = await voidReferralCreditEntry(tenantId, id);
        if (!voided.ok) failures.push(`asiento ${id}: ${voided.error}`);
      }
    }

    return failures.length > 0
      ? {
          ok: false,
          reverted: credits.length,
          credits,
          failure: "entries",
          error:
            `El crédito volvió al cliente y la factura quedó bien, pero no se pudo anular su asiento: ${failures.join("; ")}`,
        }
      : { ok: true, reverted: credits.length, credits };
  } catch (e) {
    return {
      ok: false,
      reverted: 0,
      failure: "revert",
      error: `${REVERT_REFERRAL_CREDITS_ERROR}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
