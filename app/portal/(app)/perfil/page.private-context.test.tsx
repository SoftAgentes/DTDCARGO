import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0341 · adopción del contexto privado en /portal/perfil (lote L05).
 * Página y helper reales; sólo se simulan la sesión, Storage y las lecturas
 * ajenas al contexto privado. Con la RPC 0405 —aplicada a producción el
 * 2026-09-12— se firman únicamente los paths que ella devuelve; si la RPC
 * responde error, el perfil degrada a vacío sin elevar privilegios y sin
 * reabrir el reemplazo de la foto de identidad (SDD-0439). El guardia del
 * helper es genérico: el caso de abajo usa PGRST202 como error concreto, pero
 * cubre igual un rechazo de RLS o un fallo de PostgREST.
 */

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
  getProfileCompleteness: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () => ({
    userId: "11111111-1111-4111-8111-111111111111",
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    client: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      markbox: "DTD-1001",
      name: "Cliente sintético A",
      email: null,
      phone: null,
      address: null,
      rif: "V-12345678",
      docKind: "persona",
      city: null,
      state: null,
    },
  }),
  getProfileCompleteness: mocks.getProfileCompleteness,
}));
vi.mock("@/lib/studio/client-address-queries", () => ({
  listClientDeliveryAddresses: async () => [],
}));
vi.mock("@/lib/public/rates-queries", () => ({
  getPublicCalculatorCities: async () => [],
  getPublicCarrierTariffs: async () => [],
  combinarDestinos: () => [],
}));
vi.mock("@/lib/portal/change-request-queries", () => ({
  getPortalChangeRequestSnapshot: async () => ({ open: null, lastResolved: null }),
}));
vi.mock("@/lib/portal/profile-edit-quota", () => ({
  getPortalProfileEditQuota: async () => ({
    limit: 3,
    applied: 0,
    reserved: 0,
    remaining: 3,
    available: true,
  }),
  UNAVAILABLE_PROFILE_EDIT_QUOTA: {
    limit: 3,
    applied: 0,
    reserved: 0,
    remaining: 0,
    available: false,
  },
}));
vi.mock("./actions", () => ({
  uploadCedulaPhotoAction: vi.fn(async () => ({})),
}));
vi.mock("./AvatarEditor", async () => {
  const { createElement } = await import("react");
  return {
    AvatarEditor: ({ avatarUrl }: { avatarUrl: string | null }) =>
      createElement("span", { "data-testid": "avatar" }, avatarUrl ?? "sin-foto"),
  };
});
vi.mock("./PortalAddresses", () => ({ PortalAddresses: () => null }));
vi.mock("./CopyCodeButton", () => ({ CopyCodeButton: () => null }));
vi.mock("./ProfilePendingBanner", () => ({ ProfilePendingBanner: () => null }));
vi.mock("./DataChangeEditor", () => ({ DataChangeEditor: () => null }));

const { default: PortalProfilePage } = await import("./page");

function storageMock() {
  const createSignedUrl = vi.fn(async (path: string, expiresIn: number) => ({
    data: { signedUrl: `https://storage.test/${path}?ttl=${expiresIn}` },
    error: null,
  }));
  const from = vi.fn(() => ({ createSignedUrl }));
  const adminFrom = vi.fn();
  mocks.createAdminClient.mockReturnValue({ storage: { from }, from: adminFrom });
  return { createSignedUrl, from, adminFrom };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProfileCompleteness.mockResolvedValue({
    hasPhoto: true,
    hasAddress: true,
    complete: true,
  });
});

afterEach(cleanup);

describe("perfil Portal · contexto privado por principal (SDD-0341)", () => {
  it("con la RPC 0405 muestra códigos anteriores y firma sólo los paths devueltos", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        previous_markboxes: ["DTD-A001", "DTD-A000"],
        avatar_path: "tenant-a/DTD-1001/avatar/perfil.webp",
        cedula_photo_path: "tenant-a/DTD-1001/cedula.webp",
      },
      error: null,
    });
    const { createSignedUrl, from, adminFrom } = storageMock();

    render(await PortalProfilePage());

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_portal_private_profile_context");
    expect(screen.getByText("Tus códigos anteriores")).toBeTruthy();
    expect(screen.getByText("DTD-A001 · DTD-A000")).toBeTruthy();
    expect(screen.getByTestId("avatar").textContent).toBe(
      "https://storage.test/tenant-a/DTD-1001/avatar/perfil.webp?ttl=3600",
    );
    expect(screen.getByRole("link", { name: /^ver$/i }).getAttribute("href")).toBe(
      "https://storage.test/tenant-a/DTD-1001/cedula.webp?ttl=60",
    );
    expect(screen.queryByRole("button", { name: /subir foto|cambiar foto/i })).toBeNull();
    expect(from).toHaveBeenCalledWith("client-docs");
    expect(createSignedUrl.mock.calls).toEqual([
      ["tenant-a/DTD-1001/avatar/perfil.webp", 3600],
      ["tenant-a/DTD-1001/cedula.webp", 60],
    ]);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("sin la RPC 0405 degrada a vacío sin service_role y conserva la compuerta de identidad", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_private_profile_context without parameters in the schema cache",
      },
    });
    const { createSignedUrl } = storageMock();

    render(await PortalProfilePage());

    expect(mocks.rpc).toHaveBeenCalledWith("get_portal_private_profile_context");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Mi perfil.");
    expect(screen.queryByText(/códigos? anteriores?/i)).toBeNull();
    expect(screen.getByTestId("avatar").textContent).toBe("sin-foto");
    expect(screen.queryByRole("link", { name: /^ver$/i })).toBeNull();
    expect(screen.getByText(/vista temporal no disponible/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /subir foto|cambiar foto/i })).toBeNull();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
