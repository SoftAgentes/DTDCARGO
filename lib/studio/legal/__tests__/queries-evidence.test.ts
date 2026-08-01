/**
 * Tests del export de evidencia (SDD-0067 · decisión #5):
 * `getAcceptanceEvidence` (expediente de UNA aceptación por acuse) y
 * `listAcceptanceEvidenceByQuote` (todas las de una orden, para `?quote=`).
 *
 * Lo importante: `hash_verified` usa el MISMO recompute que el gate
 * (`rowHashVerified` → `hashEvidence`) — acá se prueba que:
 *   - fila íntegra → hash_verified true (+ datos del cliente).
 *   - fila manipulada post-hoc (user_agent / medida) → hash_verified false
 *     (el expediente se exporta IGUAL, marcado como no-íntegro — el abogado
 *     necesita ver la fila aunque esté corrupta).
 *   - por quote_code devuelve TODAS las aceptaciones de la orden.
 *   - fail-closed sin tenant/código.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAcceptanceEvidence,
  listAcceptanceEvidenceByQuote,
} from "../queries";
import { hashEvidence } from "../seal";
import type { DocRef } from "../types";

const TENANT = "tn";
const MARKBOX = "DTD-5452";
const UA = "Mozilla/5.0 Chrome/126.0";
const VIGENTES: DocRef[] = [
  { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
  { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
];

/** Stub chainable con .eq aplicado + maybeSingle (primera fila o null). */
function stub(
  rowsByTable: Record<string, Record<string, unknown>[]>,
): SupabaseClient {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      function apply(): Record<string, unknown>[] {
        return (rowsByTable[table] ?? []).filter((row) =>
          filters.every(([col, val]) => row[col] === val),
        );
      }
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
        maybeSingle() {
          return Promise.resolve({ data: apply()[0] ?? null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: apply(), error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

/** Fila v2 íntegra de legal_acceptances (hash recomputado de su evidencia). */
function row(opts: {
  id: string;
  code: string;
  quote_code?: string;
  client_id?: string | null;
  user_agent?: string | null;
  merchant_declaration?: boolean;
  accepted_at?: string;
  hash?: string;
}): Record<string, unknown> {
  const quote_code = opts.quote_code ?? "S-2026-0042";
  const user_agent = opts.user_agent !== undefined ? opts.user_agent : UA;
  const merchant_declaration = opts.merchant_declaration ?? true;
  const accepted_at = opts.accepted_at ?? "2026-06-10T10:00:00.000Z";
  const goodHash = hashEvidence({
    client_markbox: MARKBOX,
    quote_code,
    docs: VIGENTES,
    cbm: 7,
    weight_kg: 2800,
    total_usd: 5600,
    ip: "1.1.1.1",
    user_agent,
    merchant_declaration,
    accepted_at,
  });
  return {
    id: opts.id,
    tenant_id: TENANT,
    acceptance_code: opts.code,
    client_id: opts.client_id !== undefined ? opts.client_id : "c1",
    client_markbox: MARKBOX,
    quote_code,
    docs: VIGENTES,
    cbm: 7,
    weight_kg: 2800,
    total_usd: 5600,
    accepted_at,
    ip: "1.1.1.1",
    user_agent,
    merchant_declaration,
    invoice_id: "inv-1",
    hash: opts.hash ?? goodHash,
    idempotency_key: null,
    created_at: "",
  };
}

const CLIENTS = [
  { id: "c1", tenant_id: TENANT, name: "Comercial Demo C.A.", markbox: MARKBOX },
];

describe("getAcceptanceEvidence", () => {
  it("fila íntegra → hash_verified true + fila completa + cliente", async () => {
    const db = stub({
      legal_acceptances: [row({ id: "a1", code: "AC-2026-0001" })],
      clients: CLIENTS,
    });
    const out = await getAcceptanceEvidence(db, {
      tenantId: TENANT,
      code: "AC-2026-0001",
    });
    expect(out).not.toBeNull();
    expect(out!.hash_verified).toBe(true);
    expect(out!.acceptance.acceptance_code).toBe("AC-2026-0001");
    expect(out!.acceptance.user_agent).toBe(UA);
    expect(out!.acceptance.merchant_declaration).toBe(true);
    expect(out!.acceptance.invoice_id).toBe("inv-1");
    // toMatchObject: el stub devuelve la fila entera (Supabase real proyecta
    // las columnas del select) — lo que importa es id + nombre + Shipping Mark.
    expect(out!.client).toMatchObject({
      id: "c1",
      name: "Comercial Demo C.A.",
      markbox: MARKBOX,
    });
  });

  it("fila con user_agent manipulado post-hoc → hash_verified FALSE (se exporta igual)", async () => {
    const good = row({ id: "a1", code: "AC-2026-0001" });
    const tampered = { ...good, user_agent: "OtroUA/9.9" };
    const db = stub({ legal_acceptances: [tampered], clients: CLIENTS });
    const out = await getAcceptanceEvidence(db, {
      tenantId: TENANT,
      code: "AC-2026-0001",
    });
    expect(out).not.toBeNull();
    expect(out!.hash_verified).toBe(false); // mismo recompute que el gate
    expect(out!.acceptance.user_agent).toBe("OtroUA/9.9"); // la fila se muestra tal cual
  });

  it("fila con hash forjado → hash_verified false", async () => {
    const forged = row({
      id: "a1",
      code: "AC-2026-0001",
      hash: "deadbeef".repeat(8),
    });
    const db = stub({ legal_acceptances: [forged], clients: CLIENTS });
    const out = await getAcceptanceEvidence(db, {
      tenantId: TENANT,
      code: "AC-2026-0001",
    });
    expect(out!.hash_verified).toBe(false);
  });

  it("client_id null → client null (la evidencia se exporta aunque falte)", async () => {
    const db = stub({
      legal_acceptances: [row({ id: "a1", code: "AC-2026-0001", client_id: null })],
      clients: CLIENTS,
    });
    const out = await getAcceptanceEvidence(db, {
      tenantId: TENANT,
      code: "AC-2026-0001",
    });
    expect(out!.client).toBeNull();
    expect(out!.hash_verified).toBe(true);
  });

  it("código inexistente → null; fail-closed sin tenant/código", async () => {
    const db = stub({
      legal_acceptances: [row({ id: "a1", code: "AC-2026-0001" })],
      clients: CLIENTS,
    });
    expect(
      await getAcceptanceEvidence(db, { tenantId: TENANT, code: "AC-2026-9999" }),
    ).toBeNull();
    expect(
      await getAcceptanceEvidence(db, { tenantId: "", code: "AC-2026-0001" }),
    ).toBeNull();
    expect(
      await getAcceptanceEvidence(db, { tenantId: TENANT, code: "  " }),
    ).toBeNull();
  });
});

describe("listAcceptanceEvidenceByQuote", () => {
  it("devuelve TODAS las aceptaciones de la orden (mismo formato por item)", async () => {
    const a1 = row({
      id: "a1",
      code: "AC-2026-0001",
      quote_code: "S-2026-0042",
      accepted_at: "2026-06-09T10:00:00.000Z",
    });
    // Re-aceptación de la misma orden (p. ej. tras re-liquidar la medida).
    const a2 = row({
      id: "a2",
      code: "AC-2026-0002",
      quote_code: "S-2026-0042",
      accepted_at: "2026-06-10T10:00:00.000Z",
    });
    // De OTRA orden → no entra.
    const other = row({
      id: "a3",
      code: "AC-2026-0003",
      quote_code: "S-2026-0099",
    });
    const db = stub({
      legal_acceptances: [a1, a2, other],
      clients: CLIENTS,
    });
    const out = await listAcceptanceEvidenceByQuote(db, {
      tenantId: TENANT,
      quoteCode: "S-2026-0042",
    });
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.acceptance.acceptance_code).sort()).toEqual([
      "AC-2026-0001",
      "AC-2026-0002",
    ]);
    expect(out.every((e) => e.hash_verified)).toBe(true);
    expect(out.every((e) => e.client?.id === "c1")).toBe(true);
  });

  it("verificación por item: una fila íntegra y una manipulada conviven", async () => {
    const good = row({
      id: "a1",
      code: "AC-2026-0001",
      quote_code: "S-2026-0042",
    });
    const bad = {
      ...row({
        id: "a2",
        code: "AC-2026-0002",
        quote_code: "S-2026-0042",
        accepted_at: "2026-06-11T10:00:00.000Z",
      }),
      merchant_declaration: false, // flip post-hoc
    };
    const db = stub({ legal_acceptances: [good, bad], clients: CLIENTS });
    const out = await listAcceptanceEvidenceByQuote(db, {
      tenantId: TENANT,
      quoteCode: "S-2026-0042",
    });
    const byCode = new Map(out.map((e) => [e.acceptance.acceptance_code, e]));
    expect(byCode.get("AC-2026-0001")!.hash_verified).toBe(true);
    expect(byCode.get("AC-2026-0002")!.hash_verified).toBe(false);
  });

  it("fail-closed: sin tenant/quote → []", async () => {
    const db = stub({ legal_acceptances: [], clients: [] });
    expect(
      await listAcceptanceEvidenceByQuote(db, { tenantId: "", quoteCode: "S-1" }),
    ).toEqual([]);
    expect(
      await listAcceptanceEvidenceByQuote(db, { tenantId: TENANT, quoteCode: "" }),
    ).toEqual([]);
  });
});
