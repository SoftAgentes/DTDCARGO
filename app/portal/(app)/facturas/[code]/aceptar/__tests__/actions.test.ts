/**
 * Tests de `registerAcceptanceAction` (SDD-0054 · Slice C + SDD-0067 · v2).
 *
 * Cubre §4 de la spec 0067 ("Action: sin checkbox 2 → fieldError, no insert"):
 *  - sin la declaración de comerciante (checkbox 2) → fieldError individual y
 *    NO se inserta nada (ni se pide el correlativo).
 *  - sin el checkbox 1 → su fieldError; sin ambos → ambos.
 *  - happy path: el insert sella `user_agent` desde headers() (NUNCA del body
 *    del form — un campo "user_agent" forjado en el form se ignora),
 *    `merchant_declaration: true` e `invoice_id` (metadato).
 *
 * Todas las dependencias server (sesión, admin client, headers, queries de
 * descubrimiento, gate) están stubbeadas — sin red ni DB real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashEvidence } from "@/lib/studio/legal/seal";
import type { DocRef } from "@/lib/studio/legal/types";

const TENANT = "tn";
const MARKBOX = "DTD-5452";
const HEADER_UA = "Mozilla/5.0 (TestRunner) Chrome/126.0";
const VIGENTES: DocRef[] = [
  { key: "tyc", version: "v2.1" },
  { key: "operador", version: "v1.4" },
];

// ── Mocks (antes de importar el SUT) ──────────────────────────
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => revalidatePathMock(p),
}));

// user-agent SERVER-SIDE: la action lo lee de headers(), no del form.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": HEADER_UA }),
}));

vi.mock("@/lib/http/request-ip", () => ({
  getRequestIp: async () => "190.142.88.214",
}));

const getPortalClientMock = vi.fn();
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: () => getPortalClientMock(),
}));

const getPendingMock = vi.fn();
vi.mock("@/lib/portal/portal-legal-queries", () => ({
  getPendingAcceptanceInvoice: (...args: unknown[]) => getPendingMock(...args),
}));

const hasValidMock = vi.fn();
const currentDocsMock = vi.fn();
vi.mock("@/lib/studio/legal/queries", () => ({
  hasValidAcceptanceForMarkbox: (...args: unknown[]) => hasValidMock(...args),
  currentClientDocs: (...args: unknown[]) => currentDocsMock(...args),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ __session: true }),
}));

// Admin client: captura inserts + rpc.
let insertedRows: Array<Record<string, unknown>>;
let rpcCalls: number;
const adminClient = {
  from(table: string) {
    if (table === "clients") {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { tenant_id: TENANT } }),
              };
            },
          };
        },
      };
    }
    if (table === "legal_acceptances") {
      return {
        insert: async (row: Record<string, unknown>) => {
          insertedRows.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`tabla inesperada en el stub: ${table}`);
  },
  rpc: async (name: string) => {
    if (name !== "next_acceptance_code") {
      throw new Error(`rpc inesperada: ${name}`);
    }
    rpcCalls += 1;
    return { data: "AC-2026-0007", error: null };
  },
};
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => adminClient,
}));

// Import del SUT después de los mocks.
import { registerAcceptanceAction } from "../actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const ORDER = {
  invoiceId: "inv-1",
  code: "F-2026-0001",
  shipmentId: "s1",
  shipmentCode: "S-2026-0042",
  clientName: "Cliente Demo",
  baseAmount: 5600,
  totalAmount: 6496,
  currency: "USD",
  ivaRate: 16,
  ivaAmount: 896,
  fxRate: null,
  cbm: 7,
  weightKg: 2800,
  lines: [],
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  insertedRows = [];
  rpcCalls = 0;
  getPortalClientMock.mockResolvedValue({ id: "c1", markbox: MARKBOX });
  getPendingMock.mockResolvedValue(ORDER);
  hasValidMock.mockResolvedValue(false); // no hay aceptación previa
  currentDocsMock.mockResolvedValue(
    VIGENTES.map((d) => ({ key: d.key, version: d.version, name: d.key })),
  );
});

describe("registerAcceptanceAction · checkboxes obligatorios (SDD-0067)", () => {
  it("sin checkbox 2 (declaración) → fieldError accept_merchant y NO inserta", async () => {
    const out = await registerAcceptanceAction(
      "F-2026-0001",
      {},
      form({ accept_docs: "on" }), // solo checkbox 1
    );
    expect(out.ok).toBeUndefined();
    expect(out.fieldErrors?.accept_merchant).toBeTruthy();
    expect(out.fieldErrors?.accept_docs).toBeUndefined();
    expect(insertedRows).toHaveLength(0); // no insert
    expect(rpcCalls).toBe(0); // ni siquiera pidió el correlativo
  });

  it("sin checkbox 1 → fieldError accept_docs y NO inserta", async () => {
    const out = await registerAcceptanceAction(
      "F-2026-0001",
      {},
      form({ accept_merchant: "on" }),
    );
    expect(out.fieldErrors?.accept_docs).toBeTruthy();
    expect(out.fieldErrors?.accept_merchant).toBeUndefined();
    expect(insertedRows).toHaveLength(0);
  });

  it("sin ninguno → ambos fieldErrors, NO inserta", async () => {
    const out = await registerAcceptanceAction("F-2026-0001", {}, form({}));
    expect(out.fieldErrors?.accept_docs).toBeTruthy();
    expect(out.fieldErrors?.accept_merchant).toBeTruthy();
    expect(insertedRows).toHaveLength(0);
  });
});

describe("registerAcceptanceAction · happy path v2", () => {
  it("sella user_agent desde headers() + merchant_declaration + invoice_id; hash v2 íntegro", async () => {
    const out = await registerAcceptanceAction(
      "F-2026-0001",
      {},
      // Un atacante mete "user_agent" en el form → se IGNORA (evidencia
      // server-side: lo sellado es el header del request).
      form({ accept_docs: "on", accept_merchant: "on", user_agent: "Forjado/1.0" }),
    );

    expect(out.ok).toBe(true);
    expect(out.acceptanceCode).toBe("AC-2026-0007");
    expect(insertedRows).toHaveLength(1);

    const row = insertedRows[0];
    expect(row.tenant_id).toBe(TENANT);
    expect(row.client_markbox).toBe(MARKBOX);
    expect(row.quote_code).toBe("S-2026-0042"); // ref de la ORDEN (M-1)
    expect(row.user_agent).toBe(HEADER_UA); // del header, NO "Forjado/1.0"
    expect(row.merchant_declaration).toBe(true);
    expect(row.invoice_id).toBe("inv-1"); // atadura forense (metadato)
    expect(row.total_usd).toBe(5600); // base_amount pre-IVA

    // El hash insertado verifica contra la PROPIA fila (lo que haría el gate).
    const recomputed = hashEvidence({
      client_markbox: String(row.client_markbox),
      quote_code: String(row.quote_code),
      docs: row.docs as DocRef[],
      cbm: Number(row.cbm),
      weight_kg: Number(row.weight_kg),
      total_usd: Number(row.total_usd),
      ip: row.ip as string | null,
      user_agent: row.user_agent as string | null,
      merchant_declaration: row.merchant_declaration === true,
      accepted_at: String(row.accepted_at),
    });
    expect(row.hash).toBe(recomputed);

    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it("idempotente: si ya hay aceptación vigente de ESTA orden → ok sin insertar", async () => {
    hasValidMock.mockResolvedValue(true);
    const out = await registerAcceptanceAction(
      "F-2026-0001",
      {},
      form({ accept_docs: "on", accept_merchant: "on" }),
    );
    expect(out.ok).toBe(true);
    expect(out.alreadyAccepted).toBe(true);
    expect(insertedRows).toHaveLength(0);
  });
});
