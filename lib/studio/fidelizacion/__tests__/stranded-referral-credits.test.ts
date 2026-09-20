// @vitest-environment node
/**
 * SDD-0495 · Créditos de referido varados sobre una factura ANULADA.
 *
 * El defecto que estas queries hacen visible: `voidInvoice` manda a revertir los
 * créditos aplicados a la factura que se anula y, si la reversión falla, sólo lo
 * escribía en el log. El crédito quedaba 'aplicado' apuntando a una factura
 * anulada y nadie en el Studio se enteraba.
 *
 * El stub APLICA los filtros sobre las filas, como PostgREST — no es un no-op
 * que devuelve el fixture entero. Es la diferencia entre probar la query y
 * probar el `.map()` de abajo: si alguien borra el `.eq("status", "aplicado")`,
 * un stub permisivo sigue en verde porque el resultado se arma igual. Acá no:
 * el fixture trae, a propósito, filas que SÓLO quedan afuera si la query las
 * excluye (un 'acreditado' sobre la misma factura anulada, un 'aplicado'
 * borrado, un 'aplicado' sobre una factura viva).
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IDS_POR_LOTE, PAGE_SIZE } from "@/lib/db/paginate";
import {
  strandedCreditsForInvoice,
  strandedReferralCredits,
} from "../referral-credit-queries";

type Row = Record<string, unknown>;

/** Tablas que ve el stub y lo que pidió cada query (para afirmar sobre ello). */
let store: { referrals: Row[]; invoices: Row[] };
let selects: { table: string; cols: string }[] = [];

beforeEach(() => {
  selects = [];
  store = { referrals: [], invoices: [] };
});

/**
 * Stub chainable que FILTRA de verdad: eq, is(null), not(col,'is',null), in() y
 * range() se aplican sobre las filas. `range` respeta el corte para que
 * `fetchAllPaged` recorra páginas reales.
 */
function stub(): SupabaseClient {
  return {
    from(table: "referrals" | "invoices") {
      let rows = [...(store[table] ?? [])];
      const chain: Row = {
        select(cols: string) {
          selects.push({ table, cols });
          return chain;
        },
        eq(col: string, val: unknown) {
          rows = rows.filter((r) => r[col] === val);
          return chain;
        },
        is(col: string, val: unknown) {
          if (val === null) rows = rows.filter((r) => r[col] == null);
          return chain;
        },
        not(col: string, op: string, val: unknown) {
          if (op === "is" && val === null) {
            rows = rows.filter((r) => r[col] != null);
          }
          return chain;
        },
        in(col: string, vals: unknown[]) {
          rows = rows.filter((r) => vals.includes(r[col]));
          return chain;
        },
        order(col: string) {
          rows = [...rows].sort((a, b) =>
            String(a[col] ?? "").localeCompare(String(b[col] ?? "")),
          );
          return chain;
        },
        limit(n: number) {
          rows = rows.slice(0, n);
          return chain;
        },
        range(from: number, to: number) {
          rows = rows.slice(from, to + 1);
          return chain;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({
            data: rows.map((r) => ({ ...r })),
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

/** Un referido 'aplicado' sobre `invoiceId`, con los campos que la query pide. */
function referral(id: string, invoiceId: string | null, extra: Row = {}): Row {
  return {
    id,
    referral_code: `REF-2026-${id}`,
    referrer_markbox: "DTD-5452",
    referred_name: "Ana Pérez",
    reward_usd: 80,
    status: "aplicado",
    deleted_at: null,
    applied_invoice_id: invoiceId,
    ...extra,
  };
}

describe("strandedReferralCredits · qué cuenta como varado", () => {
  it("un crédito aplicado sobre una factura anulada sale listado", async () => {
    store.referrals = [referral("0001", "inv-anulada")];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits, complete } = await strandedReferralCredits(stub());

    expect(complete).toBe(true);
    expect(credits).toEqual([
      {
        referralId: "0001",
        referralCode: "REF-2026-0001",
        referrerMarkbox: "DTD-5452",
        referredName: "Ana Pérez",
        rewardUsd: 80,
      },
    ]);
  });

  it("no lista nada mientras la factura sigue viva: ahí 'aplicado' es lo normal", async () => {
    store.referrals = [referral("0002", "inv-viva")];
    store.invoices = [{ id: "inv-viva", status: "emitida" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits).toEqual([]);
  });

  it("un crédito ya liberado ('acreditado') sobre la MISMA factura anulada no cuenta", async () => {
    // El caso feliz de la reversión: el crédito volvió a 'acreditado'. Si la
    // query dejara de filtrar por estado, este aparecería como varado y el
    // aviso sonaría justo cuando todo salió bien.
    store.referrals = [
      referral("0003", "inv-anulada", {
        status: "acreditado",
        applied_invoice_id: "inv-anulada",
      }),
    ];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits).toEqual([]);
  });

  it("un crédito borrado no cuenta aunque su factura esté anulada", async () => {
    store.referrals = [
      referral("0004", "inv-anulada", { deleted_at: "2026-09-01T00:00:00Z" }),
    ];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits).toEqual([]);
  });

  it("un 'aplicado' sin factura (rastro en null) no rompe ni se cuela", async () => {
    store.referrals = [referral("0005", null)];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits).toEqual([]);
  });

  it("dos créditos sobre la MISMA factura anulada salen los dos", async () => {
    // Agrupar por factura para consultar los ids una sola vez no puede
    // colapsar las filas: son dos referidores distintos perdiendo su premio.
    store.referrals = [
      referral("0006", "inv-anulada"),
      referral("0007", "inv-anulada", {
        referrer_markbox: "DTD-9001",
        referred_name: "Luis Rojas",
      }),
    ];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits.map((c) => c.referralCode)).toEqual([
      "REF-2026-0006",
      "REF-2026-0007",
    ]);
    expect(credits.map((c) => c.referrerMarkbox)).toEqual([
      "DTD-5452",
      "DTD-9001",
    ]);
  });

  it("separa varados de sanos cuando conviven varias facturas", async () => {
    store.referrals = [
      referral("0008", "inv-anulada"),
      referral("0009", "inv-viva"),
      referral("0010", "inv-otra-anulada"),
    ];
    store.invoices = [
      { id: "inv-anulada", status: "anulada" },
      { id: "inv-viva", status: "parcial" },
      { id: "inv-otra-anulada", status: "anulada" },
    ];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits.map((c) => c.referralCode)).toEqual([
      "REF-2026-0008",
      "REF-2026-0010",
    ]);
  });

  it("coacciona reward_usd cuando PostgREST lo manda como string", async () => {
    store.referrals = [referral("0011", "inv-anulada", { reward_usd: "80.00" })];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits } = await strandedReferralCredits(stub());

    expect(credits[0].rewardUsd).toBe(80);
  });
});

describe("strandedReferralCredits · lo que NO cruza al cliente", () => {
  it("no devuelve el código ni el id de la factura: el módulo lo ven roles sin dinero", async () => {
    // Fidelización es commercial/support (+admin) en la matriz de rbac; el
    // código de factura es del módulo `invoices` (accounting). La query lo
    // necesita para decidir, pero no puede entregarlo.
    store.referrals = [referral("0012", "inv-anulada")];
    store.invoices = [
      { id: "inv-anulada", status: "anulada", invoice_code: "F-2026-0007" },
    ];

    const { credits } = await strandedReferralCredits(stub());

    expect(Object.keys(credits[0]).sort()).toEqual([
      "referralCode",
      "referralId",
      "referredName",
      "referrerMarkbox",
      "rewardUsd",
    ]);
    expect(JSON.stringify(credits)).not.toContain("F-2026-0007");
    expect(JSON.stringify(credits)).not.toContain("inv-anulada");
  });

  it("de invoices sólo pide el id, no la factura entera", async () => {
    store.referrals = [referral("0013", "inv-anulada")];
    store.invoices = [
      { id: "inv-anulada", status: "anulada", invoice_code: "F-2026-0007" },
    ];

    await strandedReferralCredits(stub());

    const invoiceSelect = selects.find((s) => s.table === "invoices");
    expect(invoiceSelect?.cols).toBe("id");
  });
});

describe("strandedReferralCredits · lectura truncada", () => {
  it("la segunda lectura no puede truncar: un lote de ids cabe en una página", () => {
    /**
     * `strandedReferralCredits` **no mira** el `complete` de `fetchAllByIds`, y
     * eso sólo es correcto mientras un lote no pueda llenar una página: como
     * mucho `IDS_POR_LOTE` ids ⇒ como mucho esa cantidad de filas, contra
     * `PAGE_SIZE` por página. Consumirlo sería una condición que ningún caso
     * puede hacer valer —código muerto disfrazado de guarda—; afirmarlo acá sí
     * puede fallar, y falla apuntando al sitio correcto.
     *
     * Las dos constantes viven en otro módulo (`lib/db/paginate.ts`), así que la
     * premisa no es de esta query: es prestada. Si alguien sube `IDS_POR_LOTE`
     * por encima de `PAGE_SIZE`, esta prueba se pone roja y hay que volver a
     * propagar el `complete` de la segunda lectura.
     */
    expect(IDS_POR_LOTE).toBeLessThanOrEqual(PAGE_SIZE);
  });

  it("avisa complete:false en vez de presentar un conteo parcial como total", async () => {
    // Con maxPages=1 y pageSize=1 la primera página nunca vuelve vacía:
    // `fetchAllPaged` se queda sin páginas y lo dice. Los que trae son reales,
    // pero el total no se conoce.
    store.referrals = [
      referral("0014", "inv-anulada"),
      referral("0015", "inv-anulada"),
    ];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits, complete } = await strandedReferralCredits(stub(), {
      pageSize: 1,
      maxPages: 1,
    });

    expect(complete).toBe(false);
    expect(credits).toHaveLength(1);
  });

  it("con páginas suficientes recorre todo y vuelve complete:true", async () => {
    store.referrals = [
      referral("0016", "inv-anulada"),
      referral("0017", "inv-anulada"),
    ];
    store.invoices = [{ id: "inv-anulada", status: "anulada" }];

    const { credits, complete } = await strandedReferralCredits(stub(), {
      pageSize: 1,
      maxPages: 10,
    });

    expect(complete).toBe(true);
    expect(credits).toHaveLength(2);
  });
});

describe("strandedCreditsForInvoice · la mitad que ve facturación", () => {
  it("lista los créditos que siguen aplicados a esa factura", async () => {
    store.referrals = [
      referral("0018", "inv-anulada"),
      referral("0019", "otra-factura"),
    ];

    const out = await strandedCreditsForInvoice(stub(), "inv-anulada");

    expect(out).toEqual([
      { referralId: "0018", referralCode: "REF-2026-0018", rewardUsd: 80 },
    ]);
  });

  it("no devuelve al referidor ni al referido: facturación no es el módulo del programa", async () => {
    store.referrals = [referral("0020", "inv-anulada")];

    const out = await strandedCreditsForInvoice(stub(), "inv-anulada");

    expect(JSON.stringify(out)).not.toContain("DTD-5452");
    expect(JSON.stringify(out)).not.toContain("Ana Pérez");
    // Y NO llegan a leerse: la proyección explícita de arriba los dejaría
    // afuera igual, así que sin esta aserción el `select` podría ensancharse
    // sin que nada lo note. Lo que se pide es lo que se necesita.
    expect(selects).toEqual([
      { table: "referrals", cols: "id, referral_code, reward_usd" },
    ]);
  });

  it("ignora los ya liberados y los borrados", async () => {
    store.referrals = [
      referral("0021", "inv-anulada", { status: "acreditado" }),
      referral("0022", "inv-anulada", { deleted_at: "2026-09-01T00:00:00Z" }),
    ];

    const out = await strandedCreditsForInvoice(stub(), "inv-anulada");

    expect(out).toEqual([]);
  });

  it("sin id de factura no consulta nada", async () => {
    store.referrals = [referral("0023", "inv-anulada")];

    const out = await strandedCreditsForInvoice(stub(), "");

    expect(out).toEqual([]);
    expect(selects).toHaveLength(0);
  });
});
