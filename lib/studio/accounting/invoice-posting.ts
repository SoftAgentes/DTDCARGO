/**
 * Asiento automático de venta al emitir una factura (SDD-0040 · §5.4).
 *
 * Cierra el gancho `// TODO(SDD-contabilidad)` de SDD-0021. Al emitir una
 * factura se crea un asiento `asentado` con source='invoice':
 *
 *   debe   1.1.2  Cuentas por cobrar clientes      = total_amount
 *   haber  4.5    Otros ingresos por servicios     = base_amount
 *   haber  2.1.5  IVA / impuesto a las ventas       = iva_amount  (si > 0)
 *
 * Reglas:
 *  - Idempotente por invoice_id (no duplica si ya hay asiento vivo para la
 *    factura).
 *  - Corre con el cliente admin (service_role), igual que el audit log.
 *  - Best-effort: si algo falla, NO rompe la emisión (el caller logea y sigue).
 *    Devuelve un resultado en vez de throwear.
 *  - El balance se valida antes de insertar (total == base + iva). Si no
 *    cuadra (caso patológico), no asienta.
 */

import { createAdminClient } from "@/lib/db/admin";

/** Cuentas usadas por el asiento de venta (codes del CoA seed, SDD-0040 §5). */
export const SALES_AR_CODE = "1.1.2"; // Cuentas por cobrar clientes (debe)
export const SALES_INCOME_CODE = "4.5"; // Otros ingresos por servicios (haber)
export const SALES_IVA_CODE = "2.1.5"; // IVA por pagar (haber, si IVA ON)

export type InvoicePostingInput = {
  tenantId: string;
  invoiceId: string;
  invoiceCode: string;
  baseAmount: number;
  ivaAmount: number;
  totalAmount: number;
  /** Fecha del asiento (emisión). YYYY-MM-DD. Default hoy. */
  entryDate?: string;
};

export type InvoicePostingResult = {
  ok: boolean;
  /** entry_code creado, si se asentó. */
  entryCode?: string;
  /** Motivo cuando no se asentó (ya existía, falta cuenta, no cuadra, error). */
  skipped?: string;
  error?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Crea (idempotente) el asiento de venta de una factura. No throwea: devuelve
 * `{ ok, entryCode | skipped | error }`. El caller decide el log.
 */
export async function postInvoiceJournalEntry(
  input: InvoicePostingInput,
): Promise<InvoicePostingResult> {
  try {
    const admin = createAdminClient();

    // 1. Idempotencia: ¿ya hay asiento vivo para esta factura?
    const { count, error: existsErr } = await admin
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", input.invoiceId)
      .is("deleted_at", null);
    if (existsErr) return { ok: false, error: existsErr.message };
    if ((count ?? 0) > 0) {
      return { ok: true, skipped: "entry-already-exists" };
    }

    const base = round2(Number(input.baseAmount) || 0);
    const iva = round2(Number(input.ivaAmount) || 0);
    const total = round2(Number(input.totalAmount) || 0);

    if (total <= 0) {
      return { ok: true, skipped: "zero-total" };
    }
    // El asiento debe cuadrar: total = base + iva. Si no, no arriesgamos un
    // libro desbalanceado (caso patológico de datos).
    if (Math.abs(total - round2(base + iva)) > 0.01) {
      return { ok: false, skipped: "totals-mismatch" };
    }

    // 2. Resolver las cuentas necesarias por code (en el tenant).
    const codes = [SALES_AR_CODE, SALES_INCOME_CODE];
    if (iva > 0) codes.push(SALES_IVA_CODE);

    const { data: acctRows, error: acctErr } = await admin
      .from("accounts")
      .select("id, code")
      .eq("tenant_id", input.tenantId)
      .in("code", codes);
    if (acctErr) return { ok: false, error: acctErr.message };

    const byCode = new Map<string, string>();
    for (const r of (acctRows as { id: string; code: string }[] | null) ?? []) {
      byCode.set(r.code, r.id);
    }
    const arId = byCode.get(SALES_AR_CODE);
    const incomeId = byCode.get(SALES_INCOME_CODE);
    const ivaId = iva > 0 ? byCode.get(SALES_IVA_CODE) : undefined;

    if (!arId || !incomeId || (iva > 0 && !ivaId)) {
      // El plan de cuentas no está sembrado (o faltan cuentas clave). No
      // bloqueamos la emisión: la factura sale igual.
      return { ok: false, skipped: "missing-accounts" };
    }

    // 3. Generar el entry_code atómico.
    const { data: codeData, error: codeErr } = await admin.rpc(
      "next_entry_code",
      { p_tenant_id: input.tenantId },
    );
    if (codeErr || !codeData) {
      return { ok: false, error: codeErr?.message ?? "next_entry_code falló" };
    }
    const entryCode = String(codeData);
    const entryDate = input.entryDate ?? new Date().toISOString().slice(0, 10);

    // 4. Insertar el asiento (asentado) + sus líneas.
    const { data: insertedEntry, error: entryErr } = await admin
      .from("journal_entries")
      .insert({
        tenant_id: input.tenantId,
        entry_code: entryCode,
        entry_date: entryDate,
        memo: `Factura ${input.invoiceCode}`,
        status: "asentado",
        source: "invoice",
        invoice_id: input.invoiceId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (entryErr || !insertedEntry) {
      return { ok: false, error: entryErr?.message ?? "no se pudo crear el asiento" };
    }

    const lines: {
      entry_id: string;
      account_id: string;
      debit: number;
      credit: number;
      line_memo: string;
    }[] = [
      {
        entry_id: insertedEntry.id,
        account_id: arId,
        debit: total,
        credit: 0,
        line_memo: "Cuenta por cobrar al cliente",
      },
      {
        entry_id: insertedEntry.id,
        account_id: incomeId,
        debit: 0,
        credit: base,
        line_memo: "Ingreso por servicios",
      },
    ];
    if (iva > 0 && ivaId) {
      lines.push({
        entry_id: insertedEntry.id,
        account_id: ivaId,
        debit: 0,
        credit: iva,
        line_memo: "IVA débito fiscal",
      });
    }

    const { error: linesErr } = await admin.from("journal_lines").insert(lines);
    if (linesErr) {
      // Rollback manual del header (no hay transacción cross-statement acá).
      await admin.from("journal_entries").delete().eq("id", insertedEntry.id);
      return { ok: false, error: linesErr.message };
    }

    return { ok: true, entryCode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
