/**
 * SDD-0572 · Regla B: un documento en bolívares o yuanes sin tasa no se asienta.
 *
 * Decisión 1 del Director por la delegación de Sam (2026-10-20): el asiento sin
 * tasa no se crea y el documento queda en «Por contabilizar». Antes se asentaba
 * el nominal como si fueran dólares (18000 Bs. = USD 18000).
 *
 * El doble del cliente admin responde «no hay asiento» a la idempotencia y
 * registra cualquier otra lectura o escritura: sin tasa, la función tiene que
 * salir ANTES de buscar cuentas o insertar.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const tocadas: string[] = [];

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: (_c: string, opts?: { head?: boolean }) => {
          if (!opts?.head) tocadas.push(`select ${table}`);
          return chain;
        },
        eq: () => chain,
        is: () => chain,
        insert: () => {
          tocadas.push(`insert ${table}`);
          return chain;
        },
        then: (resolve: (v: { count: number; data: null; error: null }) => unknown) =>
          Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
      };
      return chain;
    },
    rpc: (name: string) => {
      tocadas.push(`rpc ${name}`);
      return Promise.resolve({ data: null, error: null });
    },
  }),
}));

import {
  postReceiptJournalEntry,
  postReceiptReclassEntry,
  postUnidentifiedReceiptJournalEntry,
} from "../receipt-posting";
import { postBillJournalEntry } from "../bill-posting";
import { postSupplierPaymentJournalEntry } from "../supplier-payment-posting";

beforeEach(() => {
  tocadas.length = 0;
});

const comun = { tenantId: "t", amount: 18000, fxRate: null, entryDate: "2026-10-20" };

describe("regla B · sin tasa no se asienta", () => {
  it.each(["VES", "CNY"])("cobro aplicado en %s", async (currency) => {
    const r = await postReceiptJournalEntry({ ...comun, currency, receiptId: "r", receiptCode: "R-1", cashAccountId: "c" });
    expect(r).toEqual({ ok: false, skipped: "missing-fx-rate" });
    expect(tocadas).toEqual([]);
  });

  it("cobro sin identificar y su reclasificación", async () => {
    const base = { ...comun, currency: "VES", receiptId: "r", receiptCode: "R-1" };
    expect(await postUnidentifiedReceiptJournalEntry({ ...base, cashAccountId: "c" })).toEqual({ ok: false, skipped: "missing-fx-rate" });
    expect(await postReceiptReclassEntry(base)).toEqual({ ok: false, skipped: "missing-fx-rate" });
    expect(tocadas).toEqual([]);
  });

  it("CxP y pago a proveedor", async () => {
    expect(
      await postBillJournalEntry({ ...comun, currency: "CNY", billId: "b", billCode: "CXP-1", expenseAccountId: "e" }),
    ).toEqual({ ok: false, skipped: "missing-fx-rate" });
    expect(
      await postSupplierPaymentJournalEntry({ ...comun, currency: "VES", paymentId: "p", paymentCode: "OP-1", cashAccountId: "c" }),
    ).toEqual({ ok: false, skipped: "missing-fx-rate" });
    expect(tocadas).toEqual([]);
  });

  it("con tasa sigue adelante (busca las cuentas)", async () => {
    const r = await postReceiptJournalEntry({ ...comun, fxRate: 36, currency: "VES", receiptId: "r", receiptCode: "R-1", cashAccountId: "c" });
    expect(r.skipped).not.toBe("missing-fx-rate");
    expect(tocadas.length).toBeGreaterThan(0);
  });
});
