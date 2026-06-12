/**
 * Tests de queries de la Capa Legal (SDD-0054 · Slice A). Cubre Acceptance §5:
 *  - currentClientDocs filtra status=vigente + audience=cliente y parsea body.
 *  - listAcceptances ordena desc y filtra por doc/version en memoria (jsonb).
 *  - hasValidAcceptance (gate AUT-04): true cuando hay aceptación con medida
 *    coincidente, false cuando no hay o la medida difiere; fail-closed sin
 *    clientId/quoteCode.
 *
 * El stub de SupabaseClient es chainable y APLICA los `.eq(col, val)` sobre las
 * rows de la tabla (no solo passthrough) para ejercer los filtros reales.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  currentClientDocs,
  hasValidAcceptance,
  listAcceptances,
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

// ── currentClientDocs ─────────────────────────────────────────
describe("currentClientDocs", () => {
  it("filtra vigente + cliente y parsea body jsonb (string u objeto)", async () => {
    const legal_docs = [
      {
        id: "d1",
        tenant_id: "tn",
        key: "tyc",
        name: "T&C",
        audience: "cliente",
        version: "v2.1",
        effective_date: "2026-05-01",
        status: "vigente",
        sections: "11",
        body: JSON.stringify([["1. Objeto", "…"]]),
        created_at: "",
      },
      {
        id: "d2",
        tenant_id: "tn",
        key: "operador",
        name: "Operador",
        audience: "cliente",
        version: "v1.4",
        effective_date: "2026-04-15",
        status: "vigente",
        sections: 9,
        body: [["1. Rol", "…"]],
        created_at: "",
      },
      // archivada → no entra (el .eq status=vigente la filtra en el stub)
      {
        id: "d3",
        tenant_id: "tn",
        key: "tyc",
        name: "T&C vieja",
        audience: "cliente",
        version: "v2.0",
        status: "archivada",
        sections: 9,
        body: [],
        created_at: "",
      },
      // interna → no entra
      {
        id: "d4",
        tenant_id: "tn",
        key: "operador_b2b",
        name: "Acuerdo B2B",
        audience: "interno",
        version: "v1.0",
        status: "vigente",
        sections: 5,
        body: [],
        created_at: "",
      },
    ];

    const docs = await currentClientDocs(stub({ legal_docs }), "tn");
    expect(docs).toHaveLength(2);
    const keys = docs.map((d) => d.key).sort();
    expect(keys).toEqual(["operador", "tyc"]);

    const tyc = docs.find((d) => d.key === "tyc")!;
    expect(tyc.sections).toBe(11); // string → number
    expect(Array.isArray(tyc.body)).toBe(true);
    expect(tyc.body[0][0]).toBe("1. Objeto"); // body string parseado
  });

  it("sin docs → array vacío", async () => {
    const docs = await currentClientDocs(stub({ legal_docs: [] }), "tn");
    expect(docs).toHaveLength(0);
  });

  it("m-6: tenantId vacío → fail-closed (array vacío, no toca la DB)", async () => {
    // Sin tenant NO se acota el set vigente → con admin client (RLS off) se
    // mezclarían docs de todos los tenants. Por eso fail-closed.
    const docs = await currentClientDocs(stub({ legal_docs: [] }), "  ");
    expect(docs).toHaveLength(0);
  });
});

// ── listAcceptances ───────────────────────────────────────────
describe("listAcceptances", () => {
  const legal_acceptances = [
    {
      id: "a1",
      tenant_id: "tn",
      acceptance_code: "AC-2026-0001",
      client_id: "c1",
      client_markbox: "DTD-1",
      quote_code: "Q-1",
      docs: [
        { key: "tyc", version: "v2.1" },
        { key: "operador", version: "v1.4" },
      ],
      cbm: "7",
      weight_kg: "2800",
      total_usd: "5600",
      accepted_at: "2026-05-29T10:00:00Z",
      ip: "1.1.1.1",
      user_agent: "UA/1.0",
      merchant_declaration: true,
      invoice_id: "inv-1",
      hash: "abc",
      idempotency_key: null,
      created_at: "",
    },
    {
      id: "a2",
      tenant_id: "tn",
      acceptance_code: "AC-2026-0002",
      client_id: "c2",
      client_markbox: "DTD-2",
      quote_code: "Q-2",
      docs: [{ key: "tyc", version: "v2.0" }],
      cbm: 3,
      weight_kg: 1000,
      total_usd: 2000,
      accepted_at: "2026-05-28T10:00:00Z",
      ip: "2.2.2.2",
      hash: "def",
      idempotency_key: null,
      created_at: "",
    },
  ];

  it("coacciona numeric y parsea docs jsonb; expone los campos v2", async () => {
    const rows = await listAcceptances(stub({ legal_acceptances }));
    expect(rows).toHaveLength(2);
    const a1 = rows.find((r) => r.id === "a1")!;
    expect(a1.cbm).toBe(7);
    expect(typeof a1.cbm).toBe("number");
    expect(a1.docs[0].key).toBe("tyc");
    // v2 (SDD-0067): la bitácora expone user_agent + declaración + invoice.
    expect(a1.user_agent).toBe("UA/1.0");
    expect(a1.merchant_declaration).toBe(true);
    expect(a1.invoice_id).toBe("inv-1");
    // Fila sin columnas v2 pobladas → defaults seguros (null / false).
    const a2 = rows.find((r) => r.id === "a2")!;
    expect(a2.user_agent).toBeNull();
    expect(a2.merchant_declaration).toBe(false);
    expect(a2.invoice_id).toBeNull();
  });

  it("filtra por cliente (en query)", async () => {
    const rows = await listAcceptances(stub({ legal_acceptances }), {
      client: "c1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("a1");
  });

  it("filtra por doc/version (en memoria, jsonb)", async () => {
    const byV21 = await listAcceptances(stub({ legal_acceptances }), {
      doc: "tyc",
      version: "v2.1",
    });
    expect(byV21.map((r) => r.id)).toEqual(["a1"]);

    const byOperador = await listAcceptances(stub({ legal_acceptances }), {
      doc: "operador",
    });
    expect(byOperador.map((r) => r.id)).toEqual(["a1"]);
  });
});

// ── hasValidAcceptance · GATE AUT-04 (round-2: hash load-bearing) ──
describe("hasValidAcceptance", () => {
  const TENANT = "tn";
  const VIGENTES: DocRef[] = [
    { key: "tyc", version: "v2.1" },
    { key: "operador", version: "v1.4" },
  ];

  // legal_docs vigentes (de cara al cliente) que la aceptación DEBE cubrir.
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

  // Fila de legal_acceptances íntegra (evidencia v2): hash recomputado desde su
  // propia evidencia — incluye user_agent + merchant_declaration (SDD-0067).
  function row(opts: {
    id: string;
    tenant_id?: string;
    client_id: string;
    quote_code: string;
    client_markbox?: string;
    docs?: DocRef[];
    cbm: number;
    weight_kg: number;
    total_usd: number;
    ip?: string | null;
    user_agent?: string | null;
    merchant_declaration?: boolean;
    accepted_at?: string;
    /** Si se da, sobreescribe el hash (para simular evidencia forjada). */
    hash?: string;
  }): Record<string, unknown> {
    const tenant_id = opts.tenant_id ?? TENANT;
    const client_markbox = opts.client_markbox ?? "DTD-1";
    const docs = opts.docs ?? VIGENTES;
    const ip = opts.ip ?? "1.1.1.1";
    const user_agent = opts.user_agent !== undefined ? opts.user_agent : "UA/1.0";
    const merchant_declaration = opts.merchant_declaration ?? true;
    const accepted_at = opts.accepted_at ?? "2026-05-29T10:00:00.000Z";
    const goodHash = hashEvidence({
      client_markbox,
      quote_code: opts.quote_code,
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
      client_id: opts.client_id,
      client_markbox,
      quote_code: opts.quote_code,
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
    clientId: "c1",
    quoteCode: "Q-1",
    cbm: 7,
    weight: 2800,
    total: 5600,
  };

  function db(acceptances: Record<string, unknown>[], docs = docsTable()) {
    return stub({ legal_acceptances: acceptances, legal_docs: docs });
  }

  it("(e) true para una aceptación íntegra + vigente + misma medida", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptance(db([a]), gate)).toBe(true);
  });

  it("(f) matchea pese a la asimetría de formato de accepted_at (DB …+00:00 vs sello …000Z)", async () => {
    // El sello hashea toISOString() (…000Z); Postgres devuelve el timestamptz como
    // …+00:00. El gate canoniza antes de recomputar — sin eso TODA fila real fallaría el
    // match (regresión: el stub usaba el mismo formato a ambos lados y no lo cazaba).
    const sealedAt = "2026-05-29T10:00:00.000Z"; // lo que hasheó el sello
    const dbAt = "2026-05-29T10:00:00+00:00"; // lo que devuelve Postgres
    const hashFromSeal = hashEvidence({
      client_markbox: "DTD-1",
      quote_code: "Q-1",
      docs: VIGENTES,
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      ip: "1.1.1.1",
      user_agent: "UA/1.0", // mismos defaults v2 que el builder row()
      merchant_declaration: true,
      accepted_at: sealedAt,
    });
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      accepted_at: dbAt, // fila en el formato que devuelve Postgres
      hash: hashFromSeal, // hash computado desde el formato del sello (…000Z)
    });
    expect(await hasValidAcceptance(db([a]), gate)).toBe(true);
  });

  it("(a) rechaza fila con hash mutado/corrupto", async () => {
    const forged = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      hash: "deadbeef".repeat(8), // hash que no corresponde a la evidencia
    });
    expect(await hasValidAcceptance(db([forged]), gate)).toBe(false);
  });

  it("(a') rechaza fila cuya medida fue mutada sin re-firmar (hash no cuadra)", async () => {
    // hash válido para total 5600, pero la fila dice total 9999 → no cuadra.
    const good = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    const tampered = { ...good, total_usd: 9999 };
    // el gate vigente pide total 9999 → mediría match, pero el hash es del 5600.
    expect(
      await hasValidAcceptance(db([tampered]), { ...gate, total: 9999 }),
    ).toBe(false);
  });

  it("(a'') v2: user_agent alterado post-hoc → hash no matchea → gate false", async () => {
    // La evidencia es load-bearing también sobre el user_agent (SDD-0067): una
    // fila sellada con un UA y mutada después (aunque sea 1 char) se descarta.
    const good = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      user_agent: "Mozilla/5.0 Chrome/126.0",
    });
    const tampered = { ...good, user_agent: "Mozilla/5.0 Chrome/126.1" };
    expect(await hasValidAcceptance(db([good]), gate)).toBe(true); // sanity
    expect(await hasValidAcceptance(db([tampered]), gate)).toBe(false);
  });

  it("(a''') v2: merchant_declaration flipeada post-hoc → gate false", async () => {
    const good = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
      merchant_declaration: true,
    });
    const tampered = { ...good, merchant_declaration: false };
    expect(await hasValidAcceptance(db([tampered]), gate)).toBe(false);
  });

  it("(b) rechaza aceptación cuya versión de doc ya no es la vigente", async () => {
    // aceptó tyc v2.0; la vigente ahora es v2.1 → re-versión ⇒ re-aceptación.
    const old = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      docs: [
        { key: "tyc", version: "v2.0" },
        { key: "operador", version: "v1.4" },
      ],
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptance(db([old]), gate)).toBe(false);
  });

  it("(b') rechaza aceptación que no cubre TODAS las keys vigentes", async () => {
    // solo aceptó tyc; falta operador (también vigente de cara al cliente).
    const partial = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      docs: [{ key: "tyc", version: "v2.1" }],
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptance(db([partial]), gate)).toBe(false);
  });

  it("(c) rechaza cross-tenant: mismo estimado/cliente, tenant distinto", async () => {
    // aceptación íntegra pero de OTRO tenant (lo que pasaría con service_role
    // si no se filtrara tenant_id explícito).
    const otherTenant = row({
      id: "a1",
      tenant_id: "other",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    // legal_docs vigentes existen para el tenant del gate (TENANT), no para 'other'.
    expect(await hasValidAcceptance(db([otherTenant]), gate)).toBe(false);
  });

  it("(d) clampea tol del caller (≤ 0.02): un tol absurdo no abre el gate", async () => {
    // aceptado 7 / vigente 9 = 22% de diferencia. Con tol=999 (clampeado a 0.02)
    // sigue fuera de margen → false (el caller no puede ablandar el gate).
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(
      await hasValidAcceptance(db([a]), { ...gate, cbm: 9, tol: 999 }),
    ).toBe(false);
  });

  it("dentro de la tolerancia clampeada (0.02) → true", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    // 7 → 7.1 = 1.4% < 2% → match.
    expect(
      await hasValidAcceptance(db([a]), { ...gate, cbm: 7.1, tol: 0.02 }),
    ).toBe(true);
  });

  it("false cuando la medida difiere (re-aceptación obligatoria)", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptance(db([a]), { ...gate, cbm: 9 })).toBe(false);
  });

  it("false cuando no hay aceptación para ese estimado", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(
      await hasValidAcceptance(db([a]), { ...gate, quoteCode: "Q-999" }),
    ).toBe(false);
  });

  it("false cuando el cliente no es el que aceptó", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(
      await hasValidAcceptance(db([a]), { ...gate, clientId: "c2" }),
    ).toBe(false);
  });

  it("false cuando no hay docs vigentes configuradas (fail-closed)", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(
      await hasValidAcceptance(
        stub({ legal_acceptances: [a], legal_docs: [] }),
        gate,
      ),
    ).toBe(false);
  });

  it("fail-closed: sin tenantId/clientId/quoteCode → false", async () => {
    const a = row({
      id: "a1",
      client_id: "c1",
      quote_code: "Q-1",
      cbm: 7,
      weight_kg: 2800,
      total_usd: 5600,
    });
    expect(await hasValidAcceptance(db([a]), { ...gate, tenantId: "" })).toBe(
      false,
    );
    expect(await hasValidAcceptance(db([a]), { ...gate, clientId: "" })).toBe(
      false,
    );
    expect(await hasValidAcceptance(db([a]), { ...gate, quoteCode: "" })).toBe(
      false,
    );
  });
});
