// @vitest-environment node
/**
 * Tests de la lógica de descubrimiento de Slice C (SDD-0054):
 * `listPendingAcceptanceInvoices` + `getPendingAcceptanceInvoice`.
 *
 * Una factura cuenta como "pendiente de aceptar" si es borrador + su shipment es
 * DDP + aún no tiene aceptación vigente. Se prueba:
 *   - borrador DDP sin aceptación → pendiente.
 *   - factura emitida → NO pendiente (filtrada por status).
 *   - shipment NON-DDP (consolidación) → NO pendiente.
 *   - borrador DDP YA aceptada (hay fila vigente que matchea) → NO pendiente.
 *   - getPendingAcceptanceInvoice puntual: aplica los mismos filtros + null.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listPendingAcceptanceInvoices,
  getPendingAcceptanceInvoice,
  getPendingAcceptanceForShipment,
} from "../portal-legal-queries";
import { sealAcceptance } from "@/lib/studio/legal/seal";
import { validateAcceptanceInput, type DocRef } from "@/lib/studio/legal/types";

const TENANT = "tn";
const MARKBOX = "DTD-5452";
const VIGENTES: DocRef[] = [
  { key: "tyc", version: "v2.1", body_sha256: "sha-tyc-v2.1" },
  { key: "operador", version: "v1.4", body_sha256: "sha-operador-v1.4" },
];

/**
 * Stub de Supabase que soporta lo que las queries usan: .eq, .is, .not, .order,
 * .limit, .maybeSingle, y el await del builder (then). Filtra in-memory por las
 * condiciones de igualdad / null relevantes.
 */
function stub(tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  return {
    from(table: string) {
      const eqs: Array<[string, unknown]> = [];
      const ins: Array<[string, unknown[]]> = [];
      const isNulls: string[] = [];
      const notNulls: string[] = [];
      let sort: { col: string; ascending: boolean } | null = null;

      function apply(): Record<string, unknown>[] {
        const rows = (tables[table] ?? []).filter((r) => {
          for (const [c, v] of eqs) if (r[c] !== v) return false;
          for (const [c, vs] of ins) if (!vs.includes(r[c])) return false;
          for (const c of isNulls) if (r[c] != null) return false;
          for (const c of notNulls) if (r[c] == null) return false;
          return true;
        });
        // El `.order` se honra de verdad: si no, un test de "el más nuevo primero"
        // pasaría por orden de inserción y no probaría nada.
        if (sort) {
          const { col, ascending } = sort;
          rows.sort((a, b) => {
            const x = String(a[col] ?? "");
            const y = String(b[col] ?? "");
            return ascending ? x.localeCompare(y) : y.localeCompare(x);
          });
        }
        return rows;
      }

      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          sort = { col, ascending: opts?.ascending !== false };
          return chain;
        },
        limit() {
          return chain;
        },
        eq(c: string, v: unknown) {
          eqs.push([c, v]);
          return chain;
        },
        in(c: string, vs: unknown[]) {
          ins.push([c, vs]);
          return chain;
        },
        is(c: string, v: unknown) {
          if (v === null) isNulls.push(c);
          return chain;
        },
        not(c: string, _op: string, v: unknown) {
          if (v === null) notNulls.push(c);
          return chain;
        },
        maybeSingle() {
          const rows = apply();
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: apply(), error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

function docsTable(): Record<string, unknown>[] {
  return VIGENTES.map((d, i) => ({
    id: `d${i}`,
    tenant_id: TENANT,
    key: d.key,
    name: d.key === "tyc" ? "Términos y Condiciones" : "Condiciones del Operador",
    audience: "cliente",
    version: d.version,
    effective_date: "2026-05-01",
    status: "vigente",
    sections: 1,
    body: [["A", "texto"]],
    created_at: "",
  }));
}

function invoiceRow(opts: {
  id: string;
  code: string;
  status: string;
  shipmentId: string | null;
  shipmentCode?: string | null;
  base?: number;
  total?: number;
  createdAt?: string;
  lines?: unknown[];
}): Record<string, unknown> {
  return {
    id: opts.id,
    invoice_code: opts.code,
    client_name: "Cliente Demo",
    status: opts.status,
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    base_amount: opts.base ?? 5600,
    iva_amount: 0,
    total_amount: opts.total ?? opts.base ?? 5600,
    lines: opts.lines ?? [{ desc: "Flete DDP", qty: 1, unitPrice: opts.base ?? 5600 }],
    notes: null,
    tenant_id: TENANT,
    client_markbox: MARKBOX,
    shipment_id: opts.shipmentId,
    shipment_code: opts.shipmentCode ?? "S-2026-0042",
    deleted_at: null,
    created_at: opts.createdAt ?? "2026-06-01T00:00:00Z",
  };
}

function shipmentRow(opts: {
  id: string;
  service: string;
  cbm?: number;
  weight?: number;
  code?: string;
  tenant?: string;
}): Record<string, unknown> {
  return {
    id: opts.id,
    code: opts.code ?? "S-2026-0042",
    tenant_id: opts.tenant ?? TENANT,
    client_markbox: MARKBOX,
    shipment_service: opts.service,
    volume_m3: opts.cbm ?? 7,
    weight_kg: opts.weight ?? 2800,
    deleted_at: null,
  };
}

/** Fila de aceptación vigente íntegra v2 (para el caso "ya aceptada"). */
function acceptedRow(base: number): Record<string, unknown> {
  const UA = "Mozilla/5.0 TestUA";
  const { input } = validateAcceptanceInput(
    {
      client_id: "c1",
      client_markbox: MARKBOX,
      quote_code: "S-2026-0042",
      cbm: 7,
      weight_kg: 2800,
      total_usd: base,
      user_agent: UA,
      merchant_declaration: true, // v2: sin declaración no valida
      invoice_id: "i1",
      idempotency_key: "k",
    },
    VIGENTES,
  );
  const seal = sealAcceptance(
    input!,
    VIGENTES,
    "1.2.3.4",
    UA,
    new Date("2026-06-02T00:00:00.000Z"),
  );
  return {
    id: "acc1",
    tenant_id: TENANT,
    acceptance_code: "AC-2026-0001",
    client_id: "c1",
    client_markbox: MARKBOX,
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

const args = { tenantId: TENANT, markbox: MARKBOX };

describe("listPendingAcceptanceInvoices", () => {
  it("incluye un borrador DDP sin aceptación", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    const out = await listPendingAcceptanceInvoices(db, args);
    expect(out.map((o) => o.code)).toEqual(["F-2026-0001"]);
    expect(out[0].cbm).toBe(7);
    expect(out[0].baseAmount).toBe(5600);
  });

  it("excluye una factura EMITIDA (no borrador)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "emitida", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await listPendingAcceptanceInvoices(db, args)).toHaveLength(0);
  });

  it("excluye un borrador NON-DDP (consolidación)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "consolidado_lcl" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await listPendingAcceptanceInvoices(db, args)).toHaveLength(0);
  });

  it("excluye un borrador DDP YA aceptado (hay aceptación vigente que matchea)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [acceptedRow(5600)],
      legal_docs: docsTable(),
    });
    expect(await listPendingAcceptanceInvoices(db, args)).toHaveLength(0);
  });

  it("fail-closed: sin tenantId/markbox → []", async () => {
    const db = stub({ invoices: [], shipments: [], legal_acceptances: [], legal_docs: docsTable() });
    expect(await listPendingAcceptanceInvoices(db, { tenantId: "", markbox: MARKBOX })).toEqual([]);
    expect(await listPendingAcceptanceInvoices(db, { tenantId: TENANT, markbox: "" })).toEqual([]);
  });
});

describe("getPendingAcceptanceInvoice", () => {
  it("devuelve la orden borrador DDP pendiente con su medida + lines", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    const order = await getPendingAcceptanceInvoice(db, { ...args, code: "F-2026-0001" });
    expect(order).not.toBeNull();
    expect(order!.invoiceId).toBe("i1");
    expect(order!.cbm).toBe(7);
    expect(order!.weightKg).toBe(2800);
    expect(order!.baseAmount).toBe(5600);
    expect(order!.lines).toHaveLength(1);
    // Líneas sin shipmentCode (factura hecha a mano): sin lista de embarques.
    expect(order!.embarques).toEqual([]);
  });

  it("SDD-0543 · lista los embarques por el shipmentCode de sus líneas, con la medida de cada envío y scope de tenant", async () => {
    const db = stub({
      invoices: [
        invoiceRow({
          id: "i1",
          code: "F-2026-0001",
          status: "borrador",
          shipmentId: "s1",
          shipmentCode: "DTD-A116-06",
          lines: [
            { desc: "Flete DDP · DTD-A116-06 · 7 m³ × $800", qty: 7, unitPrice: 800, shipmentCode: "DTD-A116-06" },
            { desc: "Exceso de peso · DTD-A116-06 · 10 kg × $0.8", qty: 10, unitPrice: 0.8, shipmentCode: "DTD-A116-06" },
            { desc: "Flete DDP · DTD-A116-08 · 1.5 m³ × $800", qty: 1.5, unitPrice: 800, shipmentCode: "DTD-A116-08" },
            { desc: "Flete DDP · DTD-A116-09 · 0.2 m³ × $800", qty: 0.2, unitPrice: 800, shipmentCode: "DTD-A116-09" },
          ],
        }),
      ],
      shipments: [
        shipmentRow({ id: "s1", code: "DTD-A116-06", service: "puerta_a_puerta_DDP" }),
        shipmentRow({ id: "s2", code: "DTD-A116-08", service: "puerta_a_puerta_DDP", cbm: 1.5, weight: 600 }),
        // El mismo código en OTRO tenant no cuenta: el tercero queda sin medida, no con la ajena.
        shipmentRow({ id: "s3", code: "DTD-A116-09", service: "puerta_a_puerta_DDP", cbm: 99, weight: 9999, tenant: "otro-tenant" }),
      ],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    const order = await getPendingAcceptanceInvoice(db, { ...args, code: "F-2026-0001" });
    expect(order!.embarques).toEqual([
      { code: "DTD-A116-06", cbm: 7, weightKg: 2800 },
      { code: "DTD-A116-08", cbm: 1.5, weightKg: 600 },
      { code: "DTD-A116-09", cbm: null, weightKg: null },
    ]);
    // La medida del envío enlazado sigue siendo la del primero: es la que sella la aceptación.
    expect(order!.shipmentCode).toBe("DTD-A116-06");
    expect(order!.cbm).toBe(7);
  });

  it("null si la factura ya fue emitida", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "emitida", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceInvoice(db, { ...args, code: "F-2026-0001" })).toBeNull();
  });

  it("null si el shipment no es DDP", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "fcl_directo" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceInvoice(db, { ...args, code: "F-2026-0001" })).toBeNull();
  });

  it("null si ya hay aceptación vigente (no hay nada que aceptar)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [acceptedRow(5600)],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceInvoice(db, { ...args, code: "F-2026-0001" })).toBeNull();
  });
});

/**
 * SDD-0075 §1 Slice A: el CTA de aceptación en el detalle del envío. Misma
 * definición de "pendiente" que las de arriba, pero entrando por el envío.
 */
describe("getPendingAcceptanceForShipment", () => {
  const shipArgs = { ...args, shipmentId: "s1" };

  it("devuelve la orden borrador DDP pendiente de ESE envío", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    const order = await getPendingAcceptanceForShipment(db, shipArgs);
    expect(order).not.toBeNull();
    expect(order!.code).toBe("F-2026-0001");
    expect(order!.cbm).toBe(7);
    expect(order!.weightKg).toBe(2800);
    expect(order!.baseAmount).toBe(5600);
  });

  it("null si el envío no tiene borradores (la factura ya se emitió)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "emitida", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceForShipment(db, shipArgs)).toBeNull();
  });

  it("null si el envío no es DDP (sólo DDP entra al flujo de aceptación)", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "consolidado_lcl" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceForShipment(db, shipArgs)).toBeNull();
  });

  it("null si ya hay aceptación vigente que matchea", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [acceptedRow(5600)],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceForShipment(db, shipArgs)).toBeNull();
  });

  it("no toma el borrador de OTRO envío del mismo cliente", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i2", code: "F-2026-0002", status: "borrador", shipmentId: "s2" })],
      shipments: [
        shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" }),
        shipmentRow({ id: "s2", service: "puerta_a_puerta_DDP" }),
      ],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceForShipment(db, shipArgs)).toBeNull();
  });

  it("con 2 borradores del mismo envío, devuelve el que sigue pendiente", async () => {
    const db = stub({
      invoices: [
        invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1", base: 5600 }),
        invoiceRow({ id: "i2", code: "F-2026-0002", status: "borrador", shipmentId: "s1", base: 6000 }),
      ],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      // Sella la de 5600 → la de 6000 sigue esperando aceptación.
      legal_acceptances: [acceptedRow(5600)],
      legal_docs: docsTable(),
    });
    const order = await getPendingAcceptanceForShipment(db, shipArgs);
    expect(order!.code).toBe("F-2026-0002");
    expect(order!.baseAmount).toBe(6000);
  });

  it("entre 2 borradores pendientes, devuelve el MÁS NUEVO (order created_at desc)", async () => {
    const db = stub({
      invoices: [
        // El viejo va primero en el array: si el `.order` no se respetara, ganaría éste.
        invoiceRow({
          id: "i1",
          code: "F-2026-0001",
          status: "borrador",
          shipmentId: "s1",
          base: 5600,
          createdAt: "2026-06-01T00:00:00Z",
        }),
        invoiceRow({
          id: "i2",
          code: "F-2026-0002",
          status: "borrador",
          shipmentId: "s1",
          base: 6000,
          createdAt: "2026-06-20T00:00:00Z",
        }),
      ],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    const order = await getPendingAcceptanceForShipment(db, shipArgs);
    expect(order!.code).toBe("F-2026-0002");
  });

  it("no cruza markbox: con el markbox de otro cliente → null", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(
      await getPendingAcceptanceForShipment(db, { ...shipArgs, markbox: "DTD-9999" }),
    ).toBeNull();
  });

  it("fail-closed: sin tenantId / markbox / shipmentId → null", async () => {
    const db = stub({
      invoices: [invoiceRow({ id: "i1", code: "F-2026-0001", status: "borrador", shipmentId: "s1" })],
      shipments: [shipmentRow({ id: "s1", service: "puerta_a_puerta_DDP" })],
      legal_acceptances: [],
      legal_docs: docsTable(),
    });
    expect(await getPendingAcceptanceForShipment(db, { ...shipArgs, tenantId: "" })).toBeNull();
    expect(await getPendingAcceptanceForShipment(db, { ...shipArgs, markbox: "" })).toBeNull();
    expect(await getPendingAcceptanceForShipment(db, { ...shipArgs, shipmentId: "" })).toBeNull();
  });
});
