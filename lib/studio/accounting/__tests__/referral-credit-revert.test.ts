// @vitest-environment node
/**
 * Tests de la REVERSIÓN del crédito de referido (SDD-0137 §3.6, SDD-0496).
 *
 * Desde la SDD-0496 el trabajo de DINERO no está acá: lo hace
 * `revert_referral_credits` (migración 0471) en una transacción, con la factura
 * tomada FOR UPDATE. Que esa transacción sea correcta lo prueban el contrato
 * `supabase/tests/0471_credito_referido_atomico.test.sql` (en PGlite, con el
 * .sql real) y la carrera de tres sesiones de
 * `supabase/tests/0467_reversion_credito_carrera.test.sql`.
 *
 * Lo que se prueba acá es lo que queda en TypeScript:
 *  - la RPC se llama UNA vez, con la factura y el crédito que se pidieron;
 *  - Fix B: los asientos se barren por `journal_entries.referral_id` AUNQUE
 *    `applied_entry_id` sea NULL (crash entre claim y linkage) → no queda
 *    asiento huérfano;
 *  - un `applied_entry_id` que el barrido no encontró se anula igual;
 *  - idempotencia: si la RPC no devolvió créditos, no se toca ningún asiento;
 *  - un fallo de la RPC (por ejemplo, la 0471 sin aplicar) se informa con el
 *    mensaje único y no revierte nada;
 *  - si la plata se revirtió pero un asiento no se pudo anular, se informa
 *    igual, diciendo que la factura quedó bien;
 *  - y los dos fallos se distinguen por `failure`, no por `reverted`: antes de
 *    la SDD-0496, un `ok:false` con `reverted > 0` significaba «unos créditos sí
 *    y otros no», porque la reversión los recorría de a uno. Con la 0471 eso ya
 *    no puede pasar —es una transacción, todos o ninguno—, así que el campo dice
 *    qué falló de verdad.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

// Store mutable compartido entre el stub y las aserciones.
const store: { journal_entries: Row[] } = { journal_entries: [] };
/** Errores inyectados en el admin client, por tabla y operación. */
const adminFails: { select?: string; update?: string } = {};

function matches(row: Row, filters: Row): boolean {
  return Object.entries(filters).every(([k, v]) => {
    if (v === null) return row[k] == null;
    return row[k] === v;
  });
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from(table: keyof typeof store) {
      const filters: Row = {};
      let op: "select" | "update" = "select";
      let payload: Row = {};
      const chain: Row = {
        select() {
          return chain;
        },
        update(p: Row) {
          op = "update";
          payload = p;
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        is(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
          if (op === "update") {
            if (adminFails.update) {
              return Promise.resolve({ data: null, error: { message: adminFails.update } }).then(resolve);
            }
            for (const r of store[table].filter((r) => matches(r, filters))) Object.assign(r, payload);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (adminFails.select) {
            return Promise.resolve({ data: null, error: { message: adminFails.select } }).then(resolve);
          }
          // Copias, como PostgREST: lo leído no cambia si después se escribe.
          const rows = store[table].filter((r) => matches(r, filters)).map((r) => ({ ...r }));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

import {
  REVERT_REFERRAL_CREDITS_ERROR,
  revertReferralCreditsForInvoice,
  type RevertedReferralCredit,
} from "../referral-credit-posting";

/** Lo que devolvió la RPC en cada llamada, y con qué argumentos se la llamó. */
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };

const supabase = {
  rpc(fn: string, args: Record<string, unknown>) {
    rpcCalls.push({ fn, args });
    return Promise.resolve(rpcResult);
  },
};

/** El jsonb de `revert_referral_credits`, con lo que la app consume. */
function reverted(credits: Partial<RevertedReferralCredit>[]) {
  return {
    data: {
      count: credits.length,
      reverted: credits.map((c) => ({
        referral_id: "r1",
        referral_code: "REF-2026-0001",
        amount: 80,
        applied_entry_id: null,
        ...c,
      })),
    },
    error: null,
  };
}

const entry = (id: string) => store.journal_entries.find((e) => e.id === id)!;

beforeEach(() => {
  rpcCalls.length = 0;
  rpcResult = { data: null, error: null };
  delete adminFails.select;
  delete adminFails.update;
  store.journal_entries = [
    {
      id: "e1",
      tenant_id: "t1",
      referral_id: "r1", // ← el asiento vive con referral_id seteado…
      source: "referral_credit",
      status: "asentado",
      deleted_at: null,
      invoice_id: "inv1",
    },
  ];
});

describe("revertReferralCreditsForInvoice · SDD-0496 (la plata la mueve la RPC)", () => {
  it("llama a revert_referral_credits una vez, con la factura y sin filtro de crédito", async () => {
    rpcResult = reverted([{ referral_id: "r1" }]);

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(rpcCalls).toEqual([
      { fn: "revert_referral_credits", args: { p_invoice_id: "inv1", p_referral_id: null } },
    ]);
    expect(res.ok).toBe(true);
    expect(res.reverted).toBe(1);
  });

  it("con un crédito nombrado lo pasa como filtro: es la compensación de la aplicación", async () => {
    rpcResult = reverted([{ referral_id: "r1" }]);

    await revertReferralCreditsForInvoice(supabase, "t1", "inv1", "r1");

    expect(rpcCalls[0].args).toEqual({ p_invoice_id: "inv1", p_referral_id: "r1" });
  });

  it("sin factura no llama a la RPC: es el no-op que ya tenía", async () => {
    const res = await revertReferralCreditsForInvoice(supabase, "t1", "");
    expect(rpcCalls).toEqual([]);
    expect(res).toEqual({ ok: true, reverted: 0, credits: [] });
  });

  it("Fix B: anula el asiento aunque applied_entry_id sea NULL (no queda huérfano)", async () => {
    // …pero el crédito nunca linkeó applied_entry_id (crash entre claim y linkage).
    rpcResult = reverted([{ referral_id: "r1", applied_entry_id: null }]);

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res).toMatchObject({ ok: true, reverted: 1 });
    expect(entry("e1").status).toBe("anulado");
  });

  it("anula también un applied_entry_id que el barrido por referral_id no encontró", async () => {
    // Asiento viejo, de antes del Fix B: vive sin referral_id.
    store.journal_entries.push({
      id: "e0", tenant_id: "t1", referral_id: null, source: "referral_credit",
      status: "asentado", deleted_at: null, invoice_id: "inv1",
    });
    rpcResult = reverted([{ referral_id: "r1", applied_entry_id: "e0" }]);

    await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(entry("e0").status).toBe("anulado");
    expect(entry("e1").status).toBe("anulado");
  });

  it("idempotente: si la RPC no devolvió créditos, no toca ningún asiento", async () => {
    rpcResult = reverted([]);

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res).toEqual({ ok: true, reverted: 0, credits: [] });
    expect(entry("e1").status).toBe("asentado");
  });

  it("redondea a dos decimales el monto que devuelve la RPC", async () => {
    rpcResult = reverted([{ referral_id: "r1", amount: 79.999 as unknown as number }]);

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res.credits?.[0].amount).toBe(80);
  });
});

describe("revertReferralCreditsForInvoice · los fallos se informan", () => {
  it("si la RPC falla no revierte nada y el mensaje lo nombra (0471 sin aplicar)", async () => {
    rpcResult = {
      data: null,
      error: { message: 'Could not find the function public.revert_referral_credits' },
    };

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res.ok).toBe(false);
    expect(res.reverted).toBe(0);
    expect(res.error).toContain(REVERT_REFERRAL_CREDITS_ERROR);
    expect(res.error).toContain("revert_referral_credits");
    expect(res.failure).toBe("revert");
    // Ningún asiento se tocó: la plata no se movió.
    expect(entry("e1").status).toBe("asentado");
  });

  it("si la plata volvió pero el asiento no se pudo anular, lo dice sin negar la reversión", async () => {
    rpcResult = reverted([{ referral_id: "r1" }]);
    adminFails.update = "permission denied for table journal_entries";

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res.ok).toBe(false);
    expect(res.reverted).toBe(1);
    expect(res.error).toContain("El crédito volvió al cliente y la factura quedó bien");
    expect(res.error).toContain("permission denied");
    // `reverted` no alcanza para distinguirlo: el campo propio sí.
    expect(res.failure).toBe("entries");
  });

  it("si no se pueden leer los asientos, lo informa con el crédito que los tenía", async () => {
    rpcResult = reverted([{ referral_id: "r1" }]);
    adminFails.select = "statement timeout";

    const res = await revertReferralCreditsForInvoice(supabase, "t1", "inv1");

    expect(res.ok).toBe(false);
    expect(res.reverted).toBe(1);
    expect(res.error).toContain("crédito r1");
    expect(res.error).toContain("statement timeout");
    expect(res.failure).toBe("entries");
  });

  it("una excepción del cliente se devuelve, no se propaga", async () => {
    const roto = {
      rpc() {
        throw new Error("fetch failed");
      },
    };

    const res = await revertReferralCreditsForInvoice(roto, "t1", "inv1");

    expect(res).toMatchObject({ ok: false, reverted: 0, failure: "revert" });
    expect(res.error).toBe(`${REVERT_REFERRAL_CREDITS_ERROR}: fetch failed`);
  });
});
