// @vitest-environment node
/**
 * SDD-0552 · «Mi perfil» toma cliente, tenant y Shipping Mark del principal de
 * sesión. El admin client sólo lee lo que el principal no trae (puntero de la
 * foto, avatar, asesor); ya no relee `clients.tenant_id` ni `clients.markbox`.
 *
 * El admin client es un doble que aplica los filtros y trae para el cliente un
 * tenant y un Shipping Mark LEGADOS distintos de los del principal. La versión
 * anterior resolvía la identidad con la RPC `get_portal_client_id` y leía ese
 * tenant y ese Shipping Mark con el admin: subía la foto y el avatar bajo el
 * prefijo legado y avisaba al asesor del tenant legado. Estas pruebas fallan
 * con ella. La RPC legada se siembra con el valor que devolvía, para que el
 * código anterior tenga con qué correr.
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
} from "@/lib/portal/__tests__/portal-tenant-double";

const h = vi.hoisted(() => ({
  principal: null as unknown,
  session: null as unknown as PortalDouble,
  admin: null as unknown as PortalDouble,
  crearAdmin: vi.fn(),
  subirFoto: vi.fn(),
  subirAvatar: vi.fn(),
  avisoBloqueo: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => h.session.db }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => h.principal,
}));
vi.mock("@/lib/portal/client-photo", () => ({
  PHOTO_BUCKET: "client-docs",
  validatePhotoFile: () => ({ ok: true, file: { name: "cedula.jpg" } }),
  uploadClientPhoto: h.subirFoto,
  uploadClientAvatarJpeg: h.subirAvatar,
}));
vi.mock("@/lib/portal/jpeg-metadata", () => ({ stripJpegMetadata: (bytes: Uint8Array) => bytes }));
vi.mock("@/lib/studio/change-request-notify", () => ({ notifyBlockedProfileEditToAdmin: h.avisoBloqueo }));

const { uploadCedulaPhotoAction, updateMyProfileAction } = await import("../actions");
const { updateAvatarAction } = await import("../avatar-actions");
const { saveBillingIdentityAction } = await import("../billing-actions");

const LEGACY_MARKBOX = "DTD-LEGADO";
const OTRO_CLIENTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function arrange(rpc: Record<string, unknown> = {}) {
  h.session = portalDouble({
    rpc: {
      // La RPC legada: el código anterior resolvía la identidad con ella.
      get_portal_client_id: CLIENT_A,
      portal_set_identity_photo: [{ counted: false, remaining_count: 3 }],
      portal_get_my_billing_profile: {
        principal_kind: "persona",
        principal_name: "Cliente sintético A",
        principal_doc: "V-12345678",
        secondary: null,
        billing_kind: "persona",
      },
      ...rpc,
    },
  });
  h.admin = portalDouble({
    tables: {
      clients: [
        {
          id: CLIENT_A,
          // Tenant y Shipping Mark LEGADOS: la versión anterior los leía con el admin.
          tenant_id: TENANT_B,
          markbox: LEGACY_MARKBOX,
          name: "Nombre legado",
          doc_kind: "persona",
          advisor_id: "asesor-a",
          cedula_photo_path: null,
          avatar_path: null,
          deleted_at: null,
        },
        { id: OTRO_CLIENTE, tenant_id: TENANT_A, markbox: "DTD-0777", deleted_at: null },
      ],
      client_profile_blocked_attempts: [
        { client_id: CLIENT_A, field: "document", conflicting_client_id: OTRO_CLIENTE, created_at: "2026-10-18T00:00:00.000Z" },
      ],
    },
  });
}

beforeEach(() => {
  h.principal = {
    userId: PORTAL_USER,
    tenantId: TENANT_A,
    client: { id: CLIENT_A, markbox: MARKBOX, name: "Cliente sintético A", docKind: "persona" },
  };
  arrange();
  h.crearAdmin.mockReset().mockImplementation(() => h.admin.db);
  h.subirFoto.mockReset().mockImplementation(async (_db: unknown, tenant: string, mark: string) => ({
    path: `${tenant}/${mark}/identity/nueva.jpg`,
    error: null,
  }));
  h.subirAvatar.mockReset().mockImplementation(async (_db: unknown, tenant: string, mark: string) => ({
    path: `${tenant}/${mark}/avatar/nuevo.jpg`,
    error: null,
  }));
  h.avisoBloqueo.mockReset().mockResolvedValue(undefined);
});

const AVISO_ESPERADO = {
  tenantId: TENANT_A,
  markbox: MARKBOX,
  clientName: "Cliente sintético A",
  advisorId: "asesor-a",
  conflictingMarkbox: "DTD-0777",
};

describe("SDD-0552 · foto de cédula con el principal de sesión", () => {
  it("sube bajo el tenant y el Shipping Mark del principal", async () => {
    expect(await uploadCedulaPhotoAction({}, new FormData())).toEqual({ ok: true });
    expect(h.subirFoto).toHaveBeenCalledTimes(1);
    expect(h.subirFoto.mock.calls[0].slice(0, 3)).toEqual([h.admin.db, TENANT_A, MARKBOX]);
    expect(h.session.rpcCalls).toEqual([
      { name: "portal_set_identity_photo", args: { p_new_path: `${TENANT_A}/${MARKBOX}/identity/nueva.jpg` } },
    ]);
  });

  it("sin principal no lee clients ni sube nada", async () => {
    h.principal = null;
    expect(await uploadCedulaPhotoAction({}, new FormData())).toEqual({
      error: "Tu sesión expiró. Vuelve a entrar al portal.",
    });
    expect(h.crearAdmin).not.toHaveBeenCalled();
    expect(h.subirFoto).not.toHaveBeenCalled();
    expect(h.session.rpcCalls).toEqual([]);
  });
});

describe("SDD-0552 · avatar con el principal de sesión", () => {
  it("sube bajo el tenant y el Shipping Mark del principal y apunta al nuevo", async () => {
    const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" });
    const fd = new FormData();
    fd.set("avatar", jpeg);
    expect(await updateAvatarAction({}, fd)).toEqual({ ok: true });
    expect(h.subirAvatar.mock.calls[0].slice(0, 3)).toEqual([h.admin.db, TENANT_A, MARKBOX]);
    expect(h.admin.store.clients.find((c) => c.id === CLIENT_A)?.avatar_path).toBe(
      `${TENANT_A}/${MARKBOX}/avatar/nuevo.jpg`,
    );
  });
});

describe("SDD-0552 · avisos de bloqueo con el principal de sesión", () => {
  it("el bloqueo de un dato del perfil avisa al asesor con el tenant y el Shipping Mark del principal", async () => {
    arrange({ portal_update_my_profile: [{ outcome: "blocked", remaining_count: 2 }] });
    const fd = new FormData();
    fd.set("name", "");
    fd.set("doc", "V-87654321");
    fd.set("phone", "");
    const out = await updateMyProfileAction({}, fd);
    expect(out.error).toMatch(/escríbenos por soporte/i);
    expect(h.avisoBloqueo).toHaveBeenCalledWith(h.admin.db, { ...AVISO_ESPERADO, field: "document" });
  });

  it("el bloqueo de un RIF de facturación avisa al asesor con el tenant y el Shipping Mark del principal", async () => {
    arrange({ portal_upsert_my_billing_identity: [{ outcome: "blocked" }] });
    h.admin.store.client_profile_blocked_attempts[0].field = "company_rif";
    const fd = new FormData();
    fd.set("mode", "add");
    fd.set("legal_name", "Importadora sintética C.A.");
    fd.set("doc", "J-40123456-7");
    fd.set("fiscal_address", "");
    const out = await saveBillingIdentityAction({}, fd);
    expect(out.error).toMatch(/escríbenos por soporte/i);
    expect(h.avisoBloqueo).toHaveBeenCalledWith(h.admin.db, { ...AVISO_ESPERADO, field: "company_rif" });
  });
});
