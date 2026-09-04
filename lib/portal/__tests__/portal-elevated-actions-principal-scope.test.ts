import { beforeEach, describe, expect, it, vi } from "vitest";

type Operation = {
  table: string;
  op: "select" | "insert";
  payload?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const state = vi.hoisted(() => ({
  principal: null as null | {
    userId: string;
    tenantId: string;
    client: { id: string; markbox: string; name: string };
  },
  adminBuilds: 0,
  operations: [] as Operation[],
  referralInputs: [] as Array<Record<string, unknown>>,
}));

function adminDatabase() {
  return {
    rpc: async () => ({ data: "REC-2026-0001", error: null }),
    from(table: string) {
      let operation: Operation | null = null;
      const begin = (op: Operation["op"], payload?: Record<string, unknown>) => {
        operation = { table, op, payload, filters: [] };
        state.operations.push(operation);
      };
      const current = () => {
        if (!operation) begin("select");
        return operation!;
      };
      const chain = {
        select: () => {
          if (!operation) begin("select");
          return chain;
        },
        insert: (payload: Record<string, unknown>) => {
          begin("insert", payload);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          current().filters.push([column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          current().filters.push([column, value]);
          return chain;
        },
        maybeSingle: async () => {
          if (table === "clients") {
            return { data: { tenant_id: "legacy-tenant" }, error: null };
          }
          if (table === "shipments") {
            return {
              data: { id: "shipment-a", code: "ENV-0001", client_markbox: "DTD-0001" },
              error: null,
            };
          }
          if (table === "client_claims") {
            return { data: { id: "claim-a" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "legacy-user" } } }) },
  }),
}));
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
vi.mock("@/lib/portal/referral-invite", () => ({
  inviteReferral: async (_admin: unknown, input: Record<string, unknown>) => {
    state.referralInputs.push(input);
    return {
      ok: true,
      referralCode: "REF-0001",
      referredName: "Invitado",
      referredEmail: "invitado@example.com",
    };
  },
  buildReferralInviteEmail: () => ({ subject: "Invitación", html: "<p>Invitación</p>" }),
}));
vi.mock("@/lib/studio/fidelizacion/referral-settings-queries", () => ({
  getReferralSettings: async () => ({ referredRewardUsd: 60 }),
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/studio/reclamos/claims-types", () => ({ isClaimType: () => true }));
vi.mock("@/lib/studio/reclamos/claim-evidence", () => ({
  collectEvidenceFiles: () => ({ files: [], skipped: 0 }),
  uploadClaimEvidenceBatch: async () => ({ uploaded: 0 }),
}));

const { inviteReferralAction } = await import(
  "@/app/portal/(app)/referidos/actions"
);
const { createPortalClaimAction } = await import(
  "@/app/portal/(app)/reclamos/actions"
);

function referralForm() {
  const form = new FormData();
  form.set("email", "invitado@example.com");
  form.set("name", "Invitado");
  return form;
}

function claimForm() {
  const form = new FormData();
  form.set("claim_type", "damage");
  form.set("description", "Evidencia sintética");
  form.set("shipment_id", "shipment-a");
  return form;
}

function operation(table: string, op: Operation["op"]) {
  const found = state.operations.find((item) => item.table === table && item.op === op);
  expect(found).toBeTruthy();
  return found!;
}

beforeEach(() => {
  state.principal = {
    userId: "portal-user",
    tenantId: "tenant-a",
    client: { id: "client-a", markbox: "DTD-0001", name: "Cliente canónico" },
  };
  state.adminBuilds = 0;
  state.operations.length = 0;
  state.referralInputs.length = 0;
});

describe("SDD0396 · acciones Portal elevadas por principal", () => {
  it.each([
    ["referidos", () => inviteReferralAction({}, referralForm())],
    ["reclamos", () => createPortalClaimAction({}, claimForm())],
  ])("principal inválido corta %s antes de construir admin", async (_label, run) => {
    state.principal = null;
    await run();
    expect(state.adminBuilds).toBe(0);
    expect(state.operations).toEqual([]);
  });

  it("referidos usa tenant, cliente y Shipping Mark del principal", async () => {
    await inviteReferralAction({}, referralForm());
    expect(state.operations.some((item) => item.table === "clients")).toBe(false);
    expect(state.referralInputs[0]).toMatchObject({
      tenantId: "tenant-a",
      referrerClientId: "client-a",
      referrerMarkbox: "DTD-0001",
    });
  });

  it("reclamos limita embarque e insert al principal canónico", async () => {
    await createPortalClaimAction({}, claimForm());
    expect(state.operations.some((item) => item.table === "clients")).toBe(false);
    expect(operation("shipments", "select").filters).toEqual(expect.arrayContaining([
      ["tenant_id", "tenant-a"],
      ["client_markbox", "DTD-0001"],
    ]));
    expect(operation("client_claims", "insert").payload).toMatchObject({
      tenant_id: "tenant-a",
      client_id: "client-a",
      client_markbox: "DTD-0001",
      client_name: "Cliente canónico",
      created_by: "portal-user",
    });
  });
});
