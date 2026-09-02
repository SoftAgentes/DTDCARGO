import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPortalClient: vi.fn(),
  getPortalAdvisor: vi.fn(),
  listMyShipments: vi.fn(),
  listMyClaims: vi.fn(),
  getPortalConversationId: vi.fn(),
  getPortalThread: vi.fn(),
  listPortalConversationDigests: vi.fn(),
  listClaimEvidence: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/portal/portal-claims", () => ({
  listMyClaims: mocks.listMyClaims,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalAdvisor: mocks.getPortalAdvisor,
  getPortalClient: mocks.getPortalClient,
  listMyShipments: mocks.listMyShipments,
}));
vi.mock("@/lib/portal/portal-conversation-queries", () => ({
  getPortalConversationId: mocks.getPortalConversationId,
  getPortalThread: mocks.getPortalThread,
  listPortalConversationDigests: mocks.listPortalConversationDigests,
}));
vi.mock("@/lib/studio/reclamos/claim-evidence", () => ({
  listClaimEvidence: mocks.listClaimEvidence,
}));

import { getPortalSupportPrivateContext } from "../support-private-context";

const db = {} as SupabaseClient;
const admin = { role: "service" } as unknown as SupabaseClient;
const client = { id: "client-1", markbox: "DTD-1001", name: "Cliente" };
const claims = [{ id: "claim-1" }, { id: "claim-2" }];
const shipments = [{ id: "shipment-1", code: "ENV-1" }];
const advisor = { id: "advisor-1", name: "Asesora" };
const thread = [{ id: "message-1", body: "Hola" }];
const digests = [{ id: "digest-1", clientSummary: "Resumen" }];
const evidenceItems = [{ id: "evidence-1", url: "https://signed.test/e" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPortalClient.mockResolvedValue(client);
  mocks.listMyClaims.mockResolvedValue(claims);
  mocks.listMyShipments.mockResolvedValue(shipments);
  mocks.getPortalAdvisor.mockResolvedValue(advisor);
  mocks.createAdminClient.mockReturnValue(admin);
  mocks.listClaimEvidence.mockResolvedValue(
    new Map([["claim-1", evidenceItems]]),
  );
  mocks.getPortalThread.mockResolvedValue(thread);
  mocks.getPortalConversationId.mockResolvedValue("conversation-1");
  mocks.listPortalConversationDigests.mockResolvedValue(digests);
});

describe("getPortalSupportPrivateContext", () => {
  it("no consulta ni eleva si el principal no es cliente Portal", async () => {
    mocks.getPortalClient.mockResolvedValue(null);

    await expect(getPortalSupportPrivateContext(db)).resolves.toBeNull();
    expect(mocks.listMyClaims).not.toHaveBeenCalled();
    expect(mocks.listMyShipments).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("acota evidencia y conversación a ids recién resueltos", async () => {
    await expect(getPortalSupportPrivateContext(db)).resolves.toMatchObject({
      client,
      claims,
      shipments,
      advisor,
      evidence: { "claim-1": evidenceItems },
      thread,
      conversationId: "conversation-1",
      digests,
    });
    expect(mocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(mocks.listClaimEvidence).toHaveBeenCalledWith(db, admin, [
      "claim-1",
      "claim-2",
    ]);
    expect(mocks.getPortalThread).toHaveBeenCalledWith(admin, "client-1");
    expect(mocks.getPortalConversationId).toHaveBeenCalledWith(
      admin,
      "client-1",
    );
    expect(mocks.listPortalConversationDigests).toHaveBeenCalledWith(
      admin,
      "client-1",
    );
  });

  it("conserva sólo datos RLS cuando no puede elevar", async () => {
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin service role");
    });

    await expect(getPortalSupportPrivateContext(db)).resolves.toMatchObject({
      client,
      claims,
      shipments,
      advisor,
      evidence: {},
      thread: [],
      conversationId: null,
      digests: [],
    });
    expect(mocks.listClaimEvidence).not.toHaveBeenCalled();
    expect(mocks.getPortalThread).not.toHaveBeenCalled();
  });

  it("aísla fallos de una lectura privada sin perder las demás", async () => {
    mocks.getPortalThread.mockRejectedValue(new Error("hilo no disponible"));
    mocks.listClaimEvidence.mockRejectedValue(new Error("storage no disponible"));

    await expect(getPortalSupportPrivateContext(db)).resolves.toMatchObject({
      evidence: {},
      thread: [],
      conversationId: "conversation-1",
      digests,
    });
  });
});
