/**
 * Round-trip de Slice C ↔ Slice B (SDD-0054 · el test más importante).
 *
 * Prueba que una aceptación PRODUCIDA como la produce la action de Slice C (sellar
 * con la medida del SHIPMENT + base_amount de la factura + TODAS las docs vigentes
 * cliente) es RECONOCIDA por el gate de Slice B (`hasValidAcceptanceForMarkbox`).
 *
 * Si esto se rompiera, el cliente aceptaría por el Portal pero el operador no
 * podría emitir (la factura DDP seguiría "bloqueada" porque el gate no ve la
 * aceptación). También verifica los casos negativos: docs incompletos → gate false,
 * medida distinta → gate false.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasValidAcceptanceForMarkbox } from "../queries";
import { sealAcceptance } from "../seal";
import { validateAcceptanceInput, type DocRef } from "../types";

// Stub de SupabaseClient con filtrado real por .eq (espeja queries-markbox.test).
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
          const data = all.filter((r) =>
            filters.every(([col, val]) => r[col] === val),
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

function docsTable(versions: DocRef[] = VIGENTES): Record<string, unknown>[] {
  return versions.map((d, i) => ({
    id: `d${i}`,
    tenant_id: TENANT,
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

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1";

/**
 * Produce una fila `legal_acceptances` EXACTAMENTE como lo haría la action de
 * Slice C (v2 · SDD-0067): validar input (con la declaración de comerciante del
 * checkbox 2) → sellar con seal.ts (user_agent de headers()) → mapear el sello
 * a columnas DB (incluidas user_agent / merchant_declaration / invoice_id).
 */
function sealedRowAsActionWould(opts: {
  cbm: number;
  weightKg: number;
  baseAmount: number;
  docs: DocRef[];
  quoteRef: string;
}): Record<string, unknown> {
  const { input, fieldErrors } = validateAcceptanceInput(
    {
      client_id: "c1",
      client_markbox: MARKBOX,
      quote_code: opts.quoteRef,
      cbm: opts.cbm,
      weight_kg: opts.weightKg,
      total_usd: opts.baseAmount, // ← base_amount (pre-IVA), como la action
      user_agent: UA, // ← la action lo lee de headers(), nunca del form
      merchant_declaration: true, // ← checkbox 2 validado por la action
      invoice_id: "inv-1",
      idempotency_key: "inv:x|docs:y",
    },
    opts.docs,
  );
  if (fieldErrors || !input) throw new Error("input inválido en el test");

  const ip = "190.142.88.214";
  const now = new Date("2026-06-04T12:00:00.000Z");
  const seal = sealAcceptance(input, opts.docs, ip, UA, now);

  return {
    id: "a1",
    tenant_id: TENANT,
    acceptance_code: "AC-2026-0001",
    client_id: seal.client_id,
    client_markbox: seal.client_markbox,
    quote_code: seal.quote_code,
    docs: seal.docs,
    cbm: seal.cbm,
    weight_kg: seal.weight_kg,
    total_usd: seal.total_usd,
    accepted_at: seal.accepted_at,
    ip: seal.ip,
    user_agent: seal.user_agent,
    merchant_declaration: seal.merchant_declaration,
    invoice_id: seal.invoice_id,
    hash: seal.hash,
  };
}

describe("round-trip Slice C → gate Slice B", () => {
  it("true: el gate RECONOCE una aceptación v2 sellada como la produce la action (orderRef = shipment_code)", async () => {
    // Shipment: cbm 7, weight 2800. Factura base_amount = 5600. El sello v2
    // incluye user_agent + merchant_declaration en el hash — y el gate los
    // recomputa desde la fila: si este test pasa, sello y verificación v2
    // están alineados de punta a punta.
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042", // shipment_code como ref de la orden
    });

    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    // El gate de Facturación matchea por markbox + medida del shipment +
    // base_amount + la ORDEN puntual (orderRef = invoice.shipment_code).
    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 5600,
      orderRef: "S-2026-0042",
    });
    expect(ok).toBe(true);
  });

  it("v2 · false: fila v2 con user_agent alterado POST-HOC → hash no matchea → gate false", async () => {
    // La evidencia es LOAD-BEARING también sobre el user_agent (SDD-0067): la
    // misma fila que el gate acepta íntegra deja de valer si alguien le muta el
    // user_agent después del sello (aunque la medida siga coincidiendo).
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042",
    });
    const tampered = { ...row, user_agent: `${row.user_agent} (editado)` };
    const db = stub({ legal_acceptances: [tampered], legal_docs: docsTable() });

    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 5600,
      orderRef: "S-2026-0042",
    });
    expect(ok).toBe(false);
  });

  it("M-1 · false: aceptación de OTRO shipment (misma terna) NO cubre esta orden", async () => {
    // El cliente aceptó la orden S-2026-0042 con cbm 7 / weight 2800 / 5600.
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042",
    });
    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    // Otra factura DDP del MISMO cliente con la MISMA terna pero de OTRO shipment
    // (S-2026-0099) → la aceptación NO es fungible: el gate exige el quote_code.
    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 5600,
      orderRef: "S-2026-0099",
    });
    expect(ok).toBe(false);
  });

  it("M-1 · true: SIN orderRef (legacy) la misma terna sí matchea — no rompe non-DDP/sin shipment_code", async () => {
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042",
    });
    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    // Sin orderRef el gate cae al match por terna (comportamiento previo).
    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 5600,
    });
    expect(ok).toBe(true);
  });

  it("false: docs incompletos (solo tyc) → el gate NO la cuenta", async () => {
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: [{ key: "tyc", version: "v2.1" }], // falta 'operador'
      quoteRef: "S-2026-0042",
    });
    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 5600,
      orderRef: "S-2026-0042",
    });
    expect(ok).toBe(false);
  });

  it("false: medida del envío distinta a la facturada → re-aceptación", async () => {
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042",
    });
    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    // El operador re-liquidó con otra medida (cbm 9) → el gate no la reconoce.
    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 9,
      weight: 2800,
      total: 5600,
      orderRef: "S-2026-0042",
    });
    expect(ok).toBe(false);
  });

  it("false: total facturado distinto al aceptado → re-aceptación", async () => {
    const row = sealedRowAsActionWould({
      cbm: 7,
      weightKg: 2800,
      baseAmount: 5600,
      docs: VIGENTES,
      quoteRef: "S-2026-0042",
    });
    const db = stub({ legal_acceptances: [row], legal_docs: docsTable() });

    const ok = await hasValidAcceptanceForMarkbox(db, {
      tenantId: TENANT,
      clientMarkbox: MARKBOX,
      cbm: 7,
      weight: 2800,
      total: 9999, // distinto del aceptado (5600)
      orderRef: "S-2026-0042",
    });
    expect(ok).toBe(false);
  });
});
