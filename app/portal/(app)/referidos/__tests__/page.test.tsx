/**
 * SDD-0339 · L04 — Referidos del Portal lee sólo la RPC ligada al principal.
 *
 * La PR se integra MIGRATE-FIRST: 0404 se aplica en producción antes de
 * fusionar. Estos dos casos fijan la página a ambos lados de esa frontera:
 *  - RPC presente → renderiza el snapshot del principal, sin service_role.
 *  - RPC ausente (PGRST202, 0404 sin aplicar) → la página no renderiza nada:
 *    ni código, ni montos, ni referidos; tampoco cae a service_role ni a
 *    lecturas por Shipping Mark. Queda vacía, no engañosa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fmtUsd } from "@/lib/money";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  createAdminClient: vi.fn(),
  getProfileCompleteness: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getProfileCompleteness: mocks.getProfileCompleteness,
}));
// Islas cliente del hero y del formulario de invitación: fuera de esta lectura.
vi.mock("@/app/portal/_components/ReferralShareActions", () => ({
  ReferralShareActions: () => null,
}));
vi.mock("@/app/portal/_components/ReferralInviteForm", () => ({
  ReferralInviteForm: () => null,
}));

import PortalReferralsPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfileCompleteness.mockResolvedValue({
    hasPhoto: true,
    hasAddress: true,
    complete: true,
  });
  mocks.from.mockImplementation(() => {
    throw new Error("lectura directa de tabla no permitida en Referidos");
  });
  mocks.createAdminClient.mockImplementation(() => {
    throw new Error("service_role no permitido en Referidos");
  });
});

describe("PortalReferralsPage · RPC 0404 por principal", () => {
  it("con la RPC presente renderiza el snapshot del principal sin service_role", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        markbox: "DTD-1004",
        billed_usd: 60000,
        referrer_reward_usd: 100,
        referred_reward_usd: 50,
        referrals: [
          {
            id: "a",
            referred_name: "Ana Referida",
            referred_company: "Empresa A",
            status: "acreditado",
            reward_usd: 100,
            created_at: "2026-05-18T00:00:00.000Z",
          },
        ],
      },
      error: null,
    });

    const html = renderToStaticMarkup(await PortalReferralsPage());

    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_portal_referral_program");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(html).toContain("REF-1004");
    expect(html).toContain("Ana Referida");
    expect(html).toContain("+" + fmtUsd(100));
    expect(html).toContain(fmtUsd(50));
  });

  it("con la RPC ausente (PGRST202) no renderiza datos ni cae a service_role", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_referral_program without parameters in the schema cache",
      },
    });

    const page = await PortalReferralsPage();

    expect(page).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_portal_referral_program");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
