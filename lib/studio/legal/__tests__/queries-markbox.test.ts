/**
 * Tests del gate por MARKBOX (SDD-0054 · Slice B). Cubre
 * `hasValidAcceptanceForMarkbox`, que espeja TODA la seguridad round-2 de
 * `hasValidAcceptance` pero matchea por `client_markbox` (lo que la factura DDP
 * tiene) en vez de `client_id` + `quote_code`.
 *
 * Garantías que se prueban (vía el helper compartido `acceptanceRowValid`):
 *   - markbox + medida + hash + docs vigentes coinciden → true.
 *   - markbox distinto → false.
 *   - medida distinta → false.
 *   - hash forjado (no recomputa) → false (sigue load-bearing).
 *   - versión de doc no vigente (stale) → false.
 *   - sin tenantId / sin clientMarkbox → false sin tocar la DB.
 *   - `listLegalDocs` devuelve vigentes + archivadas.
 *   - el gate por client_id (`hasValidAcceptance`) mantiene su comportamiento
 *     (no hubo drift al extraer el helper compartido).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasValidAcceptance,
  hasValidAcceptanceForMarkbox,
  listLegalDocs,
} from "../queries";
import { hashEvidence } from "../seal";
import type { DocRef } from "../types";

// ── Stub de SupabaseClient con filtrado real por .eq ──────────
function stub(
  rowsByTable: Record<string, Record<string, unknown>[]>,
): SupabaseClient {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filters.push([col, val]);
          return chain;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          const all = rowsByTable[table] ?? [];
          const data = all.filter((row) =>
            filters.every(([col, val]) => row[col] === val),
          );
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const TENANT = "tn";
const MARKBOX = "DTD-5452";
const VIGENTES: DocRef[] = [
  { key: "tyc", version: "v2.1" },
  { key: "operador", version: "v1.4" },
];

function docsTable(
  versions: DocRef[] = VIGENTES,
  tenant = TENANT,
): Record<string, unknown>[] {
  return versions.map((d, i) => ({
    id: `d${i}`,
    tenant_id: tenant,
    key: d.key,
    name: d.key,
    audience: "cliente",
    version: d.version,
    effective_date: "2026-05-01",
    status: "vigente",
    sections: 1,
    body: [],
    created_at: "",
  }));
}

/** Fila íntegra de legal_acceptances (evidencia v2 · SDD-0067): hash
 *  recomputado desde su evidencia, incluyendo user_agent + declaración. */
function row(opts: {
  id: string;
  tenant_id?: string;
  client_id?: string;
  client_markbox?: string;
  quote_code?: string;
  docs?: DocRef[];
  cbm: number;
  weight_kg: number;
  total_usd: number;
  ip?: string | null;
  user_agent?: string | null;
  merchant_declaration?: boolean;
  accepted_at?: string;
  /** Si se da, sobreescribe el hash (evidencia forjada). */
  hash?: string;
}): Record<string, unknown> {
  const tenant_id = opts.tenant_id ?? TENANT;
  const client_markbox = opts.client_markbox ?? MARKBOX;
  const quote_code = opts.quote_code ?? "Q-1";
  const docs = opts.docs ?? VIGENTES;
  const ip = opts.ip ?? "190.142.88.214";
  const user_agent = opts.user_agent !== undefined ? opts.user_agent : "UA/1.0";
  const merchant_declaration = opts.merchant_declaration ?? true;
  const accepted_at = opts.accepted_at ?? "2026-05-29T10:00:00.000Z";
  const goodHash = hashEvidence({
    client_markbox,
    quote_code,
    docs,
    cbm: opts.cbm,
    weight_kg: opts.weight_kg,
    total_usd: opts.total_usd,
    ip,
    user_agent,
    merchant_declaration,
    accepted_at,
  });
  return {
    id: opts.id,
    tenant_id,
    client_id: opts.client_id ?? "c1",
    client_markbox,
    quote_code,
    docs,
    cbm: opts.cbm,
    weight_kg: opts.weight_kg,
    total_usd: opts.total_usd,
    ip,
    user_agent,
    merchant_declaration,
    accepted_at,
    hash: opts.hash ?? goodHash,
  };
}

const gate = {
  tenantId: TENANT,
  clientMarkbox: MARKBOX,
  cbm: 7,
  weight: 2800,
  total: 5600,
};

function db(acceptances: Record<string, unknown>[], docs = docsTable()) {
  return stub({ legal_acceptances: acceptances, legal_docs: docs });
}

describe("hasValidAcceptanceForMarkbox", () => {
  it("true: markbox + medida + hash + docs vigentes coinciden", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    expect(await hasValidAcceptanceForMarkbox(db([a]), gate)).toBe(true);
  });

  it("false: markbox distinto", async () => {
    const a = row({
      id: "a1",
      client_markbox: "DTD-9999",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptanceForMarkbox(db([a]), gate)).toBe(false);
  });

  it("false: medida distinta (re-aceptación obligatoria)", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    expect(
      await hasValidAcceptanceForMarkbox(db([a]), { ...gate, cbm: 9 }),
    ).toBe(false);
  });

  it("false: hash forjado (sigue load-bearing)", async () => {
    const forged = row({
      id: "a1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      hash: "deadbeef".repeat(8),
    });
    expect(await hasValidAcceptanceForMarkbox(db([forged]), gate)).toBe(false);
  });

  it("v2: user_agent alterado post-hoc → false (la huella lo cubre)", async () => {
    const good = row({
      id: "a1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      user_agent: "Mozilla/5.0 Chrome/126.0",
    });
    const tampered = { ...good, user_agent: null };
    expect(await hasValidAcceptanceForMarkbox(db([tampered]), gate)).toBe(false);
  });

  it("v2: merchant_declaration flipeada post-hoc → false", async () => {
    const good = row({
      id: "a1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      merchant_declaration: true,
    });
    const tampered = { ...good, merchant_declaration: false };
    expect(await hasValidAcceptanceForMarkbox(db([tampered]), gate)).toBe(false);
  });

  it("false: versión de doc no vigente (stale)", async () => {
    const old = row({
      id: "a1",
      docs: [
        { key: "tyc", version: "v2.0" },
        { key: "operador", version: "v1.4" },
      ],
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptanceForMarkbox(db([old]), gate)).toBe(false);
  });

  it("false: cross-tenant (mismo markbox, tenant distinto)", async () => {
    const other = row({
      id: "a1",
      tenant_id: "other",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptanceForMarkbox(db([other]), gate)).toBe(false);
  });

  it("false: sin docs vigentes configuradas (fail-closed)", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    expect(
      await hasValidAcceptanceForMarkbox(
        stub({ legal_acceptances: [a], legal_docs: [] }),
        gate,
      ),
    ).toBe(false);
  });

  it("clampea tol del caller (≤ 0.02): tol absurdo no abre el gate", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    // 7 → 9 = 22% de diferencia, con tol=999 (clampeado a 0.02) → false.
    expect(
      await hasValidAcceptanceForMarkbox(db([a]), { ...gate, cbm: 9, tol: 999 }),
    ).toBe(false);
  });

  it("dentro de la tolerancia clampeada (0.02) → true", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    expect(
      await hasValidAcceptanceForMarkbox(db([a]), {
        ...gate,
        cbm: 7.1,
        tol: 0.02,
      }),
    ).toBe(true);
  });

  it("fail-closed: sin tenantId / sin clientMarkbox → false", async () => {
    const a = row({ id: "a1", cbm: 7, weight_kg: 2800, total_usd: 5600 });
    expect(
      await hasValidAcceptanceForMarkbox(db([a]), { ...gate, tenantId: "" }),
    ).toBe(false);
    expect(
      await hasValidAcceptanceForMarkbox(db([a]), { ...gate, clientMarkbox: "" }),
    ).toBe(false);
  });
});

describe("listLegalDocs", () => {
  it("devuelve vigentes + archivadas (no filtra por status ni audience)", async () => {
    const legal_docs = [
      {
        id: "d1",
        tenant_id: TENANT,
        key: "tyc",
        name: "T&C",
        audience: "cliente",
        version: "v2.1",
        effective_date: "2026-05-01",
        status: "vigente",
        sections: 11,
        body: [],
        created_at: "",
      },
      {
        id: "d2",
        tenant_id: TENANT,
        key: "tyc",
        name: "T&C",
        audience: "cliente",
        version: "v2.0",
        effective_date: "2026-01-10",
        status: "archivada",
        sections: 9,
        body: [],
        created_at: "",
      },
      {
        id: "d3",
        tenant_id: TENANT,
        key: "operador_b2b",
        name: "Acuerdo B2B",
        audience: "interno",
        version: "v1.0",
        effective_date: "2025-06-01",
        status: "vigente",
        sections: 5,
        body: [],
        created_at: "",
      },
    ];
    const rows = await listLegalDocs(stub({ legal_docs }), TENANT);
    // Todas (vigente + archivada + interna).
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id).sort()).toEqual(["d1", "d2", "d3"]);
  });
});

// El gate por client_id sigue íntegro (no drift al extraer el helper compartido).
describe("hasValidAcceptance (sin drift tras el refactor de Slice B)", () => {
  it("true para una aceptación íntegra + vigente + misma medida", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(
      await hasValidAcceptance(db([a]), {
        tenantId: TENANT,
        clientId: "c1",
        quoteCode: "Q-1",
        cbm: 7,
        weight: 2800,
        total: 5600,
      }),
    ).toBe(true);
  });

  it("false con hash forjado (load-bearing intacto)", async () => {
    const forged = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      hash: "deadbeef".repeat(8),
    });
    expect(
      await hasValidAcceptance(db([forged]), {
        tenantId: TENANT,
        clientId: "c1",
        quoteCode: "Q-1",
        cbm: 7,
        weight: 2800,
        total: 5600,
      }),
    ).toBe(false);
  });
});
