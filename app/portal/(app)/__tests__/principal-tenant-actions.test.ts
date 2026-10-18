// @vitest-environment node
/**
 * SDD-0552 · Cotizaciones, Reclamos y Referidos del Portal toman el tenant del
 * principal de sesión. El admin client ya no relee `clients.tenant_id`.
 *
 * El admin client es un doble que aplica los filtros y trae en `clients` un
 * tenant LEGADO distinto del del principal. La versión anterior leía ese tenant
 * y con él generaba el correlativo, insertaba la fila y avisaba al asesor, así
 * que estas pruebas fallan con ella. En Reclamos hay además un envío del tenant
 * B con el mismo Shipping Mark: la versión anterior sólo comparaba el Shipping
 * Mark y lo vinculaba al reclamo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_A,
  MARKBOX,
  PORTAL_USER,
  TENANT_A,
  TENANT_B,
  portalDouble,
  type PortalDouble,
  type Row,
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({
  principal: null as unknown,
  session: null as unknown as PortalDouble,
  admin: null as unknown as PortalDouble,
  crearAdmin: vi.fn(),
  avisoCotizacion: vi.fn(),
  invitar: vi.fn(),
  correo: vi.fn(),
  ajustesReferidos: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
  // Se deja para que una versión que volviera a usarlo corra y falle por la aserción.
  getPortalClient: async () => (h.principal as { client?: unknown } | null)?.client ?? null,
}));
vi.mock("@/lib/studio/cotizacion-request-notify", () => ({
  notifyCotizacionRequestToAdmin: h.avisoCotizacion,
}));
vi.mock("@/lib/portal/referral-invite", () => ({
  inviteReferral: h.invitar,
  buildReferralInviteEmail: () => ({ subject: "Asunto sintético", html: "<p>sintético</p>" }),
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: h.correo }));
vi.mock("@/lib/studio/fidelizacion/referral-settings-queries", () => ({
  getReferralSettings: h.ajustesReferidos,
}));

const { requestCotizacionAction } = await import("../cotizaciones/actions");
const { createPortalClaimAction } = await import("../reclamos/actions");
const { inviteReferralAction } = await import("../referidos/actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  // Un tenant forjado en el formulario no cambia nada: sale de la sesión.
  fd.set("tenant_id", TENANT_B);
  return fd;
}

beforeEach(() => {
  h.principal = {
    userId: PORTAL_USER,
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A", email: null, phone: null, address: null },
  };
  h.session = portalDouble();
  h.admin = portalDouble({
    tables: {
      // Tenant LEGADO en `clients`: la versión anterior lo leía con el admin.
      clients: [{ id: CLIENT_A, tenant_id: TENANT_B, markbox: MARKBOX, deleted_at: null }],
      shipments: [
        { id: "ship-a", tenant_id: TENANT_A, code: "DTD-0001-01", client_markbox: MARKBOX, deleted_at: null },
        { id: "ship-b", tenant_id: TENANT_B, code: "DTD-0001-B1", client_markbox: MARKBOX, deleted_at: null },
      ],
    },
    rpc: {
      next_estimate_code: (args: Row) => `EST-${args.p_tenant_id === TENANT_A ? "A" : "B"}-0001`,
      next_claim_code_service: (args: Row) => `REC-${args.p_tenant_id === TENANT_A ? "A" : "B"}-0001`,
    },
  });
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.avisoCotizacion.mockReset().mockResolvedValue(undefined);
  h.invitar.mockReset().mockResolvedValue({
    ok: true,
    referralCode: "REF-0001",
    referredName: "Invitado sintético",
    referredEmail: "invitado@example.test",
  });
  h.correo.mockReset().mockResolvedValue(undefined);
  h.ajustesReferidos.mockReset().mockResolvedValue({ referredRewardUsd: 60 });
});

describe("SDD-0552 · solicitud de cotización con el tenant del principal", () => {
  it("el correlativo, la cotización y el aviso van al tenant del principal, sin releer clients", async () => {
    const res = await requestCotizacionAction({}, form({ service: "consolidado_lcl", description: "Lámparas de escritorio" }));
    expect(res).toEqual({ ok: true, createdCode: "EST-A-0001" });
    expect(h.admin.rpcCalls).toEqual([{ name: "next_estimate_code", args: { p_tenant_id: TENANT_A } }]);
    expect(h.admin.store.quotes).toEqual([
      expect.objectContaining({ tenant_id: TENANT_A, quote_code: "EST-A-0001", client_markbox: MARKBOX }),
    ]);
    expect(h.avisoCotizacion).toHaveBeenCalledWith(h.admin.db, TENANT_A, expect.objectContaining({ code: "EST-A-0001" }));
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("sin principal no construye el admin client", async () => {
    h.principal = null;
    const res = await requestCotizacionAction({}, form({ service: "consolidado_lcl", description: "Lámparas" }));
    expect(res.error).toMatch(/sesión expiró/i);
    expect(h.crearAdmin).not.toHaveBeenCalled();
  });
});

describe("SDD-0552 · reclamo del Portal con el tenant del principal", () => {
  it("el correlativo y el reclamo van al tenant del principal, con el usuario de la sesión", async () => {
    const res = await createPortalClaimAction({}, form({ claim_type: "dano", description: "Caja golpeada", shipment_id: "ship-a" }));
    expect(res).toMatchObject({ ok: true, createdCode: "REC-A-0001" });
    expect(h.admin.rpcCalls).toEqual([{ name: "next_claim_code_service", args: { p_tenant_id: TENANT_A } }]);
    expect(h.admin.store.client_claims).toEqual([
      expect.objectContaining({
        tenant_id: TENANT_A,
        claim_code: "REC-A-0001",
        client_id: CLIENT_A,
        client_markbox: MARKBOX,
        shipment_id: "ship-a",
        shipment_code: "DTD-0001-01",
        created_by: PORTAL_USER,
      }),
    ]);
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("un envío del tenant B con el mismo Shipping Mark no se vincula", async () => {
    const res = await createPortalClaimAction({}, form({ claim_type: "dano", description: "Caja golpeada", shipment_id: "ship-b" }));
    expect(res.ok).toBe(true);
    expect(h.admin.store.client_claims).toEqual([
      expect.objectContaining({ tenant_id: TENANT_A, shipment_id: null, shipment_code: null }),
    ]);
  });

  it("sin principal no construye el admin client", async () => {
    h.principal = null;
    const res = await createPortalClaimAction({}, form({ claim_type: "dano", description: "Caja golpeada" }));
    expect(res.error).toMatch(/no está habilitada/i);
    expect(h.crearAdmin).not.toHaveBeenCalled();
  });
});

describe("SDD-0552 · invitación de referido con el tenant del principal", () => {
  it("la invitación, los ajustes y el correo usan el tenant del principal, sin releer clients", async () => {
    const res = await inviteReferralAction({}, form({ email: "invitado@example.test", name: "Invitado sintético" }));
    expect(res).toEqual({ ok: true, invitedEmail: "invitado@example.test" });
    expect(h.invitar).toHaveBeenCalledWith(h.admin.db, expect.objectContaining({
      tenantId: TENANT_A,
      referrerMarkbox: MARKBOX,
      referrerClientId: CLIENT_A,
    }));
    expect(h.ajustesReferidos).toHaveBeenCalledWith(h.admin.db, TENANT_A);
    expect(h.correo).toHaveBeenCalledWith(h.admin.db, TENANT_A, expect.objectContaining({ to: "invitado@example.test" }));
    expect(h.admin.on("clients")).toEqual([]);
  });

  it("sin principal no construye el admin client", async () => {
    h.principal = null;
    const res = await inviteReferralAction({}, form({ email: "invitado@example.test", name: "Invitado" }));
    expect(res.error).toMatch(/sesión expiró/i);
    expect(h.crearAdmin).not.toHaveBeenCalled();
  });
});
