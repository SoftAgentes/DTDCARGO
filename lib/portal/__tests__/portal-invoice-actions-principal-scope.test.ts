import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Corte L14 del test de SDD-0397 (PR #21): sólo los casos del reporte de pago,
 * que usa los comandos de SDD-0365 (RPC 0421) y el principal canónico de L18.
 * La aceptación legal y sus mocks quedan fuera de este lote; el corte está
 * documentado en .agents/handoffs/c-l14-portal-comandos-recibos.md.
 */

type Read = { table: string; filters: Array<[string, unknown]> };

const state = vi.hoisted(() => ({
  principal: null as null | {
    userId: string;
    tenantId: string;
    client: { id: string; markbox: string; name: string };
  },
  adminBuilds: 0,
  reads: [] as Read[],
  commands: [] as Array<Record<string, unknown>>,
}));

function adminDatabase() {
  return {
    from(table: string) {
      const read: Read = { table, filters: [] };
      state.reads.push(read);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          read.filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          read.filters.push([column, value]);
          return chain;
        },
        maybeSingle: async () => ({
          data: table === "clients" ? { tenant_id: "legacy-tenant" } : null,
          error: null,
        }),
      };
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    state.adminBuilds += 1;
    return adminDatabase();
  },
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClient: async () => ({
    id: "client-a",
    markbox: "DTD-LEGACY",
    name: "Cliente legado",
  }),
  getPortalClientPrincipal: async () => state.principal,
}));
vi.mock("@/lib/portal/payment-report-types", () => ({
  validatePaymentReportInput: () => ({
    input: { amount: 10, method: "transferencia", paidAt: "2026-09-03", note: null },
    fieldErrors: undefined,
  }),
}));
vi.mock("@/lib/portal/payment-proof", () => ({
  validateProofFile: () => ({ ok: true, file: new File(["x"], "proof.pdf") }),
  uploadPaymentProof: vi.fn(),
}));
vi.mock("@/lib/portal/payment-report-queries", () => ({
  countPendingReports: async () => 0,
  isAtPendingLimit: () => false,
}));
vi.mock("@/lib/portal/payment-report-commands", () => ({
  runPaymentReportCommand: async (_session: unknown, args: Record<string, unknown>) => {
    state.commands.push(args);
    return {
      ok: true,
      receipt: { invoiceCode: String(args.invoiceCode), replayed: false },
    };
  },
}));
vi.mock("@/lib/studio/payment-report-notify", () => ({
  notifyPaymentReportToAdmin: vi.fn(),
}));

const { reportPaymentAction, cancelPaymentReportAction } = await import(
  "@/app/portal/(app)/facturas/[code]/reportar/actions"
);

const requestId = "11111111-1111-4111-8111-111111111111";
const reportId = "22222222-2222-4222-8222-222222222222";

function paymentForm() {
  const form = new FormData();
  form.set("request_id", requestId);
  form.set("report_id", reportId);
  form.set("reason", "Motivo sintético válido");
  return form;
}

beforeEach(() => {
  state.principal = {
    userId: "portal-user",
    tenantId: "tenant-a",
    client: { id: "client-a", markbox: "DTD-0001", name: "Cliente canónico" },
  };
  state.adminBuilds = 0;
  state.reads.length = 0;
  state.commands.length = 0;
});

describe("SDD0397 · reporte de pago Portal por principal (corte L14)", () => {
  it("principal inválido corta reporte antes de construir admin", async () => {
    state.principal = null;
    await reportPaymentAction("FAC-0001", {}, paymentForm());
    expect(state.adminBuilds).toBe(0);
    expect(state.reads).toEqual([]);
  });

  it("reporte fija tenant + Shipping Mark sin releer clients", async () => {
    await reportPaymentAction("FAC-0001", {}, paymentForm());
    expect(state.reads.some((read) => read.table === "clients")).toBe(false);
    const invoice = state.reads.find((read) => read.table === "invoices");
    expect(invoice?.filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
    ]));
  });

  it("cancelación exige principal canónico antes del comando", async () => {
    state.principal = null;
    await cancelPaymentReportAction("FAC-0001", {}, paymentForm());
    expect(state.commands).toEqual([]);
  });
});
