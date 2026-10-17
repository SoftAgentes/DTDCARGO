/**
 * Tests de queries de Fidelización & Referidos (SDD-0051 · Slice A).
 *
 * Cubre Acceptance §5 Slice A:
 *  - clientAnnualBilling consume sólo el agregado minimizado de la RPC,
 *    lo pagina completo y no lee `invoices` directamente.
 *  - clientsWithTier asigna el tier derivado y ordena por facturación.
 *  - tierCounts distribuye por nivel (los 4 buckets siempre presentes).
 *  - listReferrals registra los filtros aplicados (status / q).
 *  - programStats / topReferrers / creditsEarned / pendingCredits puros.
 *
 * El stub de SupabaseClient es chainable y enruta por nombre de tabla; registra
 * en `calls` los filtros aplicados (estilo invoice-queries.test.ts).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientAnnualBilling,
  clientsWithTier,
  creditsEarned,
  listReferrals,
  pendingCredits,
  programStats,
  tierCounts,
  topReferrers,
} from "../queries";
import type { Referral, ReferralStatus } from "../types";

// ── Stub de SupabaseClient ────────────────────────────────────
type Recorded = { eq: [string, unknown][]; or: string[] };

/**
 * Devuelve un client que, por cada `.from(table)`, sirve `rowsByTable[table]`
 * (default []). Encadena select/order/limit/eq/or y se resuelve como promise
 * al final (await). Registra eq/or por tabla en `calls`.
 */
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function stub(rowsByTable: Record<string, Record<string, unknown>[]>): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
} {
  const calls: Record<string, Recorded> = {};
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  const pagedChain = (rows: Record<string, unknown>[]) => {
    const chain: Record<string, unknown> = {
      order() {
        return chain;
      },
      range(desde: number, hasta: number) {
        const pedido = hasta - desde + 1;
        const trozo = rows.slice(desde, desde + Math.min(pedido, SERVER_CAP));
        return Promise.resolve({ data: trozo, error: null });
      },
      then(resolve: (v: { data: unknown; error: null }) => unknown) {
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return chain;
  };

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      calls[table] = calls[table] ?? { eq: [], or: [] };
      const rec = calls[table];

      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST. Un doble más generoso que el servidor deja pasar
        // código que en producción trunca.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const todas = rows ?? [];
          const trozo = todas.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
        },
        limit() {
          return chain;
        },
        eq(col: string, val: unknown) {
          rec.eq.push([col, val]);
          return chain;
        },
        // SDD-0509: clientsWithTier filtra eliminados; el filtro en sí lo
        // prueba listados-sin-eliminados.test.ts con un doble que lo aplica.
        is() {
          return chain;
        },
        or(expr: string) {
          rec.or.push(expr);
          return chain;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return pagedChain(rowsByTable[fn] ?? []);
    },
  } as unknown as SupabaseClient;

  return { client, calls, rpcCalls };
}

const NOW = new Date("2026-06-03T00:00:00Z");

describe("clientAnnualBilling", () => {
  it("lee sólo el agregado por RPC y transmite la fecha de referencia", async () => {
    const aggregates = [
      { client_markbox: "DTD-1", billed_usd: 1500 },
      { client_markbox: "DTD-2", billed_usd: 1000 },
      { client_markbox: "DTD-4", billed_usd: 200 },
    ];
    const { client, calls, rpcCalls } = stub({
      studio_client_annual_billing: aggregates,
    });
    const map = await clientAnnualBilling(client, NOW);

    expect(map.get("DTD-1")).toBe(1500);
    expect(map.get("DTD-2")).toBe(1000);
    expect(map.get("DTD-4")).toBe(200);
    expect(calls.invoices).toBeUndefined();
    expect(rpcCalls).toEqual([
      {
        fn: "studio_client_annual_billing",
        args: { p_as_of: "2026-06-03" },
      },
      {
        fn: "studio_client_annual_billing",
        args: { p_as_of: "2026-06-03" },
      },
    ]);
  });

  it("coacciona el numeric agregado que PostgREST entrega como string", async () => {
    const { client } = stub({
      studio_client_annual_billing: [
        { client_markbox: "DTD-9", billed_usd: "2000" },
      ],
    });
    const map = await clientAnnualBilling(client, NOW);
    expect(map.get("DTD-9")).toBe(2000);
  });

  it("sin agregados → map vacío", async () => {
    const { client } = stub({ studio_client_annual_billing: [] });
    const map = await clientAnnualBilling(client, NOW);
    expect(map.size).toBe(0);
  });
});

describe("clientsWithTier", () => {
  it("asigna tier derivado y ordena desc por facturación", async () => {
    const billing = [
      { client_markbox: "DTD-A", billed_usd: 320000 },
      { client_markbox: "DTD-B", billed_usd: 60000 },
    ];
    const clients = [
      { id: "1", markbox: "DTD-A", name: "Alfa" },
      { id: "2", markbox: "DTD-B", name: "Beta" },
      { id: "3", markbox: "DTD-C", name: "Gamma" },
    ];
    const { client } = stub({ studio_client_annual_billing: billing, clients });
    const res = await clientsWithTier(client, NOW);

    expect(res.map((c) => c.markbox)).toEqual(["DTD-A", "DTD-B", "DTD-C"]);
    expect(res[0].tier.id).toBe("platinum"); // 320.000
    expect(res[1].tier.id).toBe("silver"); // 60.000
    expect(res[2].tier.id).toBe("bronze"); // 0
    expect(res[2].billedUsd).toBe(0);
  });
});

describe("tierCounts", () => {
  it("distribuye por nivel con los 4 buckets presentes", async () => {
    const billing = [
      { client_markbox: "DTD-A", billed_usd: 320000 },
      { client_markbox: "DTD-B", billed_usd: 60000 },
      { client_markbox: "DTD-C", billed_usd: 200000 },
    ];
    const clients = [
      { id: "1", markbox: "DTD-A", name: "Alfa" }, // platinum
      { id: "2", markbox: "DTD-B", name: "Beta" }, // silver
      { id: "3", markbox: "DTD-C", name: "Gamma" }, // gold
      { id: "4", markbox: "DTD-D", name: "Delta" }, // bronze (sin facturas)
    ];
    const { client } = stub({ studio_client_annual_billing: billing, clients });
    const counts = await tierCounts(client, NOW);

    const byId = Object.fromEntries(counts.map((c) => [c.tier.id, c.count]));
    expect(counts).toHaveLength(4);
    expect(byId.bronze).toBe(1);
    expect(byId.silver).toBe(1);
    expect(byId.gold).toBe(1);
    expect(byId.platinum).toBe(1);
  });
});

describe("listReferrals", () => {
  const referralRows = [
    { id: "r1", referral_code: "REF-2026-0001", referrer_markbox: "DTD-5452", referred_name: "X", reward_usd: "80", status: "acreditado" },
  ];

  it("sin filtros: ningún eq/or aplicado", async () => {
    const { client, calls } = stub({ referrals: referralRows });
    const res = await listReferrals(client);
    expect(res).toHaveLength(1);
    expect(res[0].reward_usd).toBe(80); // coerción numérica
    expect(calls.referrals.eq).toHaveLength(0);
    expect(calls.referrals.or).toHaveLength(0);
  });

  it("filtro status → eq('status', value)", async () => {
    const { client, calls } = stub({ referrals: referralRows });
    await listReferrals(client, { status: "acreditado" });
    expect(calls.referrals.eq).toContainEqual(["status", "acreditado"]);
  });

  it("filtro q → or() con los 4 campos buscables", async () => {
    const { client, calls } = stub({ referrals: referralRows });
    await listReferrals(client, { q: "mejías" });
    expect(calls.referrals.or).toHaveLength(1);
    const expr = calls.referrals.or[0];
    expect(expr).toContain("referral_code.ilike");
    expect(expr).toContain("referrer_markbox.ilike");
    expect(expr).toContain("referred_name.ilike");
    expect(expr).toContain("referred_company.ilike");
  });
});

// ── Helpers puros ─────────────────────────────────────────────
function ref(p: Partial<Referral>): Referral {
  return {
    id: p.id ?? crypto.randomUUID(),
    tenant_id: "t1",
    referral_code: p.referral_code ?? "REF-2026-0001",
    referrer_client_id: null,
    referrer_markbox: p.referrer_markbox ?? "DTD-5452",
    referred_name: p.referred_name ?? "Referido",
    referred_company: null,
    referred_email: null,
    referred_phone: null,
    referred_client_id: null,
    status: (p.status ?? "invitado") as ReferralStatus,
    reward_usd: p.reward_usd ?? 0,
    lead_id: null,
    notes: null,
    applied_invoice_id: null,
    applied_entry_id: null,
    applied_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    deleted_at: null,
    ...p,
  };
}

const SET: Referral[] = [
  ref({ referrer_markbox: "DTD-5452", status: "acreditado", reward_usd: 80 }),
  ref({ referrer_markbox: "DTD-5452", status: "acreditado", reward_usd: 80 }),
  ref({ referrer_markbox: "DTD-5452", status: "primer-embarque", reward_usd: 80 }),
  ref({ referrer_markbox: "DTD-5452", status: "registrado", reward_usd: 0 }),
  ref({ referrer_markbox: "DTD-5452", status: "invitado", reward_usd: 0 }),
  ref({ referrer_markbox: "DTD-5392", status: "acreditado", reward_usd: 80 }),
  ref({ referrer_markbox: "DTD-5392", status: "invitado", reward_usd: 0 }),
];

describe("creditsEarned / pendingCredits (puros)", () => {
  it("creditsEarned suma reward_usd de acreditados del referidor", () => {
    expect(creditsEarned(SET, "DTD-5452")).toBe(160); // 80 + 80
    expect(creditsEarned(SET, "DTD-5392")).toBe(80);
    expect(creditsEarned(SET, "DTD-0000")).toBe(0);
  });

  it("pendingCredits cuenta referrerReward por cada activo (ni acreditado ni invitado)", () => {
    // DTD-5452: primer-embarque (1) + registrado (1) = 2 activos × 80 = 160
    expect(pendingCredits(SET, "DTD-5452")).toBe(160);
    // DTD-5392: solo acreditado + invitado → 0 activos
    expect(pendingCredits(SET, "DTD-5392")).toBe(0);
  });
});

describe("programStats", () => {
  it("agrega total / acreditados / activos / creditsIssued / convRate", async () => {
    const rows = SET as unknown as Record<string, unknown>[];
    const { client } = stub({ referrals: rows });
    const stats = await programStats(client);

    expect(stats.total).toBe(7);
    expect(stats.acreditados).toBe(3); // 2 de 5452 + 1 de 5392
    expect(stats.activos).toBe(2); // primer-embarque + registrado de 5452
    expect(stats.creditsIssued).toBe(240); // 3 × 80
    expect(stats.convRate).toBeCloseTo((3 / 7) * 100, 5);
  });

  it("sin referidos → todo en cero, convRate 0", async () => {
    const { client } = stub({ referrals: [] });
    const stats = await programStats(client);
    expect(stats).toEqual({
      total: 0,
      acreditados: 0,
      activos: 0,
      creditsIssued: 0,
      convRate: 0,
    });
  });
});

describe("topReferrers", () => {
  it("ranking por acreditados / total + créditos", async () => {
    const rows = SET as unknown as Record<string, unknown>[];
    const { client } = stub({ referrals: rows });
    const top = await topReferrers(client, 5);

    expect(top[0].markbox).toBe("DTD-5452"); // 2 acreditados
    expect(top[0].acreditados).toBe(2);
    expect(top[0].total).toBe(5);
    expect(top[0].credits).toBe(160);
    expect(top[1].markbox).toBe("DTD-5392"); // 1 acreditado
    expect(top[1].acreditados).toBe(1);
  });

  it("respeta el límite n", async () => {
    const rows = SET as unknown as Record<string, unknown>[];
    const { client } = stub({ referrals: rows });
    const top = await topReferrers(client, 1);
    expect(top).toHaveLength(1);
    expect(top[0].markbox).toBe("DTD-5452");
  });
});
