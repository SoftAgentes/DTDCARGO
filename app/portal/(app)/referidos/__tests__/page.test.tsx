/**
 * SDD-0339 · L04 — Referidos del Portal lee sólo la RPC ligada al principal.
 *
 * La PR se integra MIGRATE-FIRST: 0404 se aplica en producción antes de
 * fusionar. Estos dos casos fijan la página a ambos lados de esa frontera:
 *  - RPC presente → renderiza el snapshot del principal, sin service_role.
 *  - RPC ausente (PGRST202, 0404 sin aplicar) → la página no renderiza nada:
 *    ni código, ni montos, ni referidos; tampoco cae a service_role ni a
 *    lecturas por Shipping Mark. 0572-b muestra indisponibilidad sanitizada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fmtUsd } from "@/lib/money";
import { billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";

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
  it("NULL real no renderiza programa ni indisponibilidad", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await PortalReferralsPage()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each([[], {}, { markbox: "" }, { markbox: "  " }, undefined, false, true, 0, 42, "detalle interno", [{ markbox: "DTD-1004" }], { markbox: 1004 }, { markbox: true }, { markbox: [] }, { markbox: {} }].map((data) => ({ data })))("shape malformado $data muestra indisponibilidad sanitizada", async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    const html = renderToStaticMarkup(await PortalReferralsPage());
    expect(html).toContain("Programa de referidos no disponible");
    expect(html).not.toContain("detalle interno");
    expect(html).not.toContain("REF-1004");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it.each<AnnualBillingRead>([
    { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
    { state: "completo", subtotalUsd: "-50.01", sinTasaCount: 0 },
    { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
    { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
    { state: "sin_tasa", subtotalUsd: "0.00", sinTasaCount: 1 },
    { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
    { state: "no_disponible", subtotalUsd: null, sinTasaCount: null },
  ])("v2 $state conserva importe exacto, recompensas y referidos", async (billing) => {
    mocks.rpc.mockResolvedValue({ data: {
      markbox: "DTD-1004", billed_usd: 987654,
      ...(billing.state !== "no_disponible" ? { billing_v2: { version: 2, subtotal_usd: billing.subtotalUsd, sin_tasa_count: billing.sinTasaCount, conversion_state: billing.state } } : {}),
      referrer_reward_usd: 80, referred_reward_usd: 60,
      referrals: [{ id: "r", referred_name: "Referido sintético", referred_company: null, status: "acreditado", reward_usd: 80, created_at: "2026-10-20T00:00:00Z" }],
    }, error: null });
    const html = renderToStaticMarkup(await PortalReferralsPage());
    expect(html).toContain(billingStatus(billing));
    expect(html).toContain(formatAnnualUsd(billing.subtotalUsd));
    expect(html).toContain("Referido sintético");
    expect(html).toContain("REF-1004");
    expect(html).toContain(fmtUsd(80));
    expect(html).not.toContain("987,654");
    expect(mocks.from).not.toHaveBeenCalled();
    if (billing.state !== "completo" || (billing.subtotalUsd !== null && billing.subtotalUsd.length > 18)) expect(html).toContain("Por revisar");
  });
  it("con la RPC presente renderiza el snapshot del principal sin service_role", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        markbox: "DTD-1004",
        billed_usd: 60000,
        billing_v2: { version: 2, subtotal_usd: "60000.00", sin_tasa_count: 0, conversion_state: "completo" },
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

    const html = renderToStaticMarkup(page);
    expect(html).toContain("Programa de referidos no disponible");
    expect(html).not.toContain("schema cache");
    expect(html).not.toContain("REF-1004");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_portal_referral_program");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
