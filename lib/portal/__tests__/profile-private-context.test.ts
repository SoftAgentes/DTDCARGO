// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { getPortalPrivateProfileContext } from "../profile-private-context";

function dbWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPortalPrivateProfileContext", () => {
  it("resuelve por RPC sin ids y firma sólo los paths devueltos", async () => {
    const { db, rpc } = dbWithRpc({
      previous_markboxes: ["DTD-A001", "DTD-A000"],
      avatar_path: "tenant-a/DTD-1001/avatar.webp",
      cedula_photo_path: "tenant-a/DTD-1001/cedula.webp",
    });
    const createSignedUrl = vi
      .fn()
      .mockResolvedValueOnce({ data: { signedUrl: "https://cdn.test/avatar" } })
      .mockResolvedValueOnce({ data: { signedUrl: "https://cdn.test/cedula" } });
    const from = vi.fn().mockReturnValue({ createSignedUrl });
    mocks.createAdminClient.mockReturnValue({ storage: { from } });

    await expect(getPortalPrivateProfileContext(db)).resolves.toEqual({
      previousMarkboxes: ["DTD-A001", "DTD-A000"],
      avatarUrl: "https://cdn.test/avatar",
      cedulaUrl: "https://cdn.test/cedula",
    });
    expect(rpc).toHaveBeenCalledWith("get_portal_private_profile_context");
    expect(from).toHaveBeenCalledWith("client-docs");
    expect(createSignedUrl).toHaveBeenNthCalledWith(
      1,
      "tenant-a/DTD-1001/avatar.webp",
      3600,
    );
    expect(createSignedUrl).toHaveBeenNthCalledWith(
      2,
      "tenant-a/DTD-1001/cedula.webp",
      60,
    );
  });

  it("no eleva si el principal no tiene fotos", async () => {
    const { db } = dbWithRpc({
      previous_markboxes: ["DTD-A001"],
      avatar_path: null,
      cedula_photo_path: null,
    });

    await expect(getPortalPrivateProfileContext(db)).resolves.toEqual({
      previousMarkboxes: ["DTD-A001"],
      avatarUrl: null,
      cedulaUrl: null,
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("conserva códigos pero no URLs cuando Storage falla", async () => {
    const { db } = dbWithRpc({
      previous_markboxes: ["DTD-A001"],
      avatar_path: "tenant-a/avatar.webp",
      cedula_photo_path: null,
    });
    mocks.createAdminClient.mockImplementation(() => {
      throw new Error("sin storage");
    });

    await expect(getPortalPrivateProfileContext(db)).resolves.toEqual({
      previousMarkboxes: ["DTD-A001"],
      avatarUrl: null,
      cedulaUrl: null,
    });
  });

  it.each([
    { data: null, error: null },
    { data: null, error: { message: "boom" } },
  ])("falla cerrado sin contexto válido", async ({ data, error }) => {
    const { db } = dbWithRpc(data, error);
    await expect(getPortalPrivateProfileContext(db)).resolves.toEqual({
      previousMarkboxes: [],
      avatarUrl: null,
      cedulaUrl: null,
    });
  });
});
