import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  currentPath: null as string | null,
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => stubs.revalidatePath(...args),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: (...args: unknown[]) => stubs.rpc(...args),
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "clients") throw new Error(`tabla inesperada: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                tenant_id: "tenant-1",
                markbox: "DTD-5452",
                cedula_photo_path: stubs.currentPath,
              },
              error: null,
            }),
          }),
        }),
      };
    },
    storage: {
      from: () => ({ remove: (...args: unknown[]) => stubs.remove(...args) }),
    },
  }),
}));

vi.mock("@/lib/portal/client-photo", () => ({
  PHOTO_BUCKET: "client-docs",
  validatePhotoFile: () => ({ ok: true, file: { name: "cedula.jpg" } }),
  uploadClientPhoto: (...args: unknown[]) => stubs.upload(...args),
}));

vi.mock("@/lib/portal/change-request-queries", () => ({
  getOpenChangeRequest: vi.fn(),
}));
vi.mock("@/lib/portal/change-request-types", () => ({
  buildChangeRequestDiff: vi.fn(),
  mapChangeRequestRow: vi.fn(),
}));
vi.mock("@/lib/studio/change-request-notify", () => ({
  notifyChangeRequestToAdmin: vi.fn(),
}));

const { uploadCedulaPhotoAction } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  stubs.currentPath = null;
  stubs.rpc.mockImplementation(async (name: string) => {
    if (name === "get_portal_client_id") {
      return { data: "client-1", error: null };
    }
    if (name === "portal_set_identity_photo") {
      return { data: null, error: null };
    }
    throw new Error(`rpc inesperada: ${name}`);
  });
  stubs.upload.mockResolvedValue({
    path: "tenant-1/DTD-5452/identity/new.jpg",
    error: null,
  });
  stubs.remove.mockResolvedValue({ error: null });
});

describe("uploadCedulaPhotoAction · contención de privacidad", () => {
  it("rechaza un reemplazo antes de subir otro archivo sensible", async () => {
    stubs.currentPath = "tenant-1/DTD-5452/identity/current.jpg";

    const result = await uploadCedulaPhotoAction({}, new FormData());

    expect(result.error).toMatch(/reemplazar tu documento/i);
    expect(stubs.upload).not.toHaveBeenCalled();
    expect(stubs.remove).not.toHaveBeenCalled();
    expect(stubs.rpc).not.toHaveBeenCalledWith(
      "portal_set_identity_photo",
      expect.anything(),
    );
  });

  it("comprueba el resultado del rollback y pide soporte si Storage no retira el objeto", async () => {
    stubs.rpc.mockImplementation(async (name: string) => {
      if (name === "get_portal_client_id") {
        return { data: "client-1", error: null };
      }
      return { data: null, error: { message: "database_unavailable" } };
    });
    stubs.remove.mockResolvedValue({
      error: { code: "storage_cleanup_failed", message: "falló" },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await uploadCedulaPhotoAction({}, new FormData());

    expect(stubs.remove).toHaveBeenCalledWith([
      "tenant-1/DTD-5452/identity/new.jpg",
    ]);
    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/ni retirar la carga/i);
    expect(result.error).toMatch(/soporte/i);
    expect(consoleError).toHaveBeenCalledWith(
      "[uploadCedulaPhotoAction] rollback error",
      { reason: "storage_remove_failed" },
    );
    consoleError.mockRestore();
  });
});
