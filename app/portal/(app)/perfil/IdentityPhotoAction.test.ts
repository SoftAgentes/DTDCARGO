// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const stubs = vi.hoisted(() => ({
  currentPath: null as string | null,
  session: null as SupabaseClient | null,
  admin: null as SupabaseClient | null,
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => stubs.revalidatePath(...args),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => stubs.session ?? ({
    rpc: (...args: unknown[]) => stubs.rpc(...args),
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => stubs.admin ?? ({
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
  stubs.session = null;
  stubs.admin = null;
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
      return { data: null, status: 400, error: { code: "P0001", message: "identity_photo_replacement_temporarily_disabled" } };
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

describe("respuesta incierta · SDK Supabase real con transporte offline", () => {
  const clientId = "00000000-0000-0000-0000-000000000001";
  const prefix = "synthetic-tenant/SYNTHETIC-MARK/";
  const rejection = { code: "P0001", message: "identity_photo_replacement_temporarily_disabled" };
  type Options = {
    commit?: boolean; lost?: boolean; existing?: boolean;
    rejected?: { code: string; message: string };
    status?: number;
    read?: "error" | "throw" | "missing" | "other" | "tenant" | "mark" | "deleted";
    identity?: "other" | "error";
    cleanup?: "error" | "throw";
  };

  async function setup(options: Options = {}) {
    const state = {
      pointer: options.existing ? `${prefix}existing.png` : null as string | null,
      uploaded: "", objects: new Set<string>(), removes: [] as string[][],
      reads: [] as URL[], identities: 0, setters: 0,
    };
    if (state.pointer) state.objects.add(state.pointer);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { "Content-Type": "application/json" },
    });
    const offline: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://photo-test.invalid");
      if (url.pathname.endsWith("/rpc/get_portal_client_id")) {
        state.identities++;
        if (state.identities > 1 && options.identity === "error") throw new TypeError("synthetic identity failure");
        return json(state.identities > 1 && options.identity === "other" ? "other-client" : clientId);
      }
      if (url.pathname === "/rest/v1/clients") {
        state.reads.push(url);
        expect(url.searchParams.get("id")).toBe(`eq.${clientId}`);
        const after = state.reads.length > 1;
        if (after && options.read === "error") return json({ code: "42501", message: "synthetic denied" }, 403);
        if (after && options.read === "throw") throw new TypeError("synthetic read failure");
        if (after && options.read === "missing") return json([]);
        return json([{
          tenant_id: after && options.read === "tenant" ? "other-tenant" : "synthetic-tenant",
          markbox: after && options.read === "mark" ? "OTHER-MARK" : "SYNTHETIC-MARK",
          deleted_at: after && options.read === "deleted" ? "2026-01-01" : null,
          cedula_photo_path: after && options.read === "other" ? `${prefix}concurrent.png` : state.pointer,
        }]);
      }
      if (url.pathname.startsWith("/storage/v1/object/client-docs/") && init?.method === "POST") {
        state.uploaded = decodeURIComponent(url.pathname.split("/client-docs/")[1]);
        expect(state.uploaded).toMatch(/^synthetic-tenant\/SYNTHETIC-MARK\/[\w-]+\.png$/);
        expect(new Headers(init.headers).get("x-upsert")).toBe("false");
        state.objects.add(state.uploaded);
        return json({ Key: `client-docs/${state.uploaded}` });
      }
      if (url.pathname.endsWith("/rpc/portal_set_identity_photo")) {
        state.setters++;
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({ p_new_path: state.uploaded });
        if (options.commit || (!options.lost && !options.rejected)) state.pointer = body.p_new_path;
        if (options.lost) throw new TypeError("synthetic response lost");
        if (options.rejected) return json(options.rejected, options.status ?? 400);
        return json([{ counted: false, remaining_count: 0 }]);
      }
      if (url.pathname === "/storage/v1/object/client-docs" && init?.method === "DELETE") {
        const { prefixes } = JSON.parse(String(init.body));
        state.removes.push(prefixes);
        expect(prefixes).toEqual([state.uploaded]);
        if (options.cleanup === "error") return json({ message: "synthetic cleanup denied" }, 403);
        if (options.cleanup === "throw") throw new TypeError("synthetic cleanup failure");
        for (const key of prefixes) state.objects.delete(key);
        return json([]);
      }
      throw new Error(`Unexpected offline route ${url.pathname}`);
    };
    const makeClient = () => createClient("https://photo-test.invalid", "SYNTHETIC-NOT-A-SECRET", {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: offline },
    });
    stubs.session = makeClient();
    stubs.admin = makeClient();
    const photo = await vi.importActual<typeof import("@/lib/portal/client-photo")>("@/lib/portal/client-photo");
    stubs.upload.mockImplementation((admin, tenant, mark) => photo.uploadClientPhoto(
      admin, tenant, mark, new File(["SYNTHETIC"], "test.png", { type: "image/png" }),
    ));
    const run = () => {
      const form = new FormData();
      form.set("client_id", "ATTACKER"); form.set("tenant_id", "ATTACKER"); form.set("markbox", "ATTACKER");
      return uploadCedulaPhotoAction({}, form);
    };
    return { state, run };
  }

  it("primera foto con cuota cero conserva prefijo/cliente de sesión", async () => {
    const { state, run } = await setup();
    expect(await run()).toEqual({ ok: true });
    expect(state.objects.has(state.pointer!)).toBe(true);
    expect(state.setters).toBe(1);
    expect(state.removes).toEqual([]);
  });
  it("commit con respuesta perdida no borra la foto referenciada", async () => {
    const { state, run } = await setup({ commit: true, lost: true });
    const result = await run();
    expect(state.objects.has(state.pointer!)).toBe(true);
    expect(state.removes).toEqual([]);
    expect(result).toEqual({ ok: true });
    expect(state.identities).toBe(2);
    expect(state.setters).toBe(1);
    expect(state.reads[1].searchParams.get("select")).toBe("tenant_id,markbox,cedula_photo_path,deleted_at");
  });
  it("puntero null no prueba rollback: conserva ante commit posterior", async () => {
    const { state, run } = await setup({ lost: true });
    const result = await run();
    state.pointer = state.uploaded;
    expect(state.objects.has(state.pointer)).toBe(true);
    expect(state.removes).toEqual([]);
    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/soporte/i);
    expect(stubs.revalidatePath).not.toHaveBeenCalled();
  });
  it.each(["error", "throw", "missing", "other", "tenant", "mark", "deleted"] as const)(
    "conserva y no anuncia éxito ante lectura %s", async (read) => {
      const { state, run } = await setup({ lost: true, commit: true, read });
      const result = await run();
      expect(state.removes).toEqual([]);
      expect(state.objects.has(state.uploaded)).toBe(true);
      expect(result.ok).toBeUndefined();
      expect(result.error).toMatch(/soporte/i);
    },
  );
  it.each(["other", "error"] as const)("conserva ante identidad %s", async (identity) => {
    const { state, run } = await setup({ lost: true, commit: true, identity });
    const result = await run();
    expect(state.removes).toEqual([]);
    expect(result.ok).toBeUndefined();
  });
  it.each([rejection, { code: "P0001", message: "profile_edit_limit_reached" }])(
    "limpia sólo objeto nuevo ante rechazo $message", async (rejected) => {
      const { state, run } = await setup({ rejected });
      const result = await run();
      expect(state.removes).toEqual([[state.uploaded]]);
      expect(state.objects.size).toBe(0);
      expect(result.ok).toBeUndefined();
      expect(result.error).toMatch(/soporte/i);
    },
  );
  it("no borra cuando el rechazo contradice el puntero", async () => {
    const { state, run } = await setup({ rejected: rejection, commit: true });
    await run();
    expect(state.objects.has(state.pointer!)).toBe(true);
    expect(state.removes).toEqual([]);
  });
  it("no limpia con error genérico y puntero vacío", async () => {
    const { state, run } = await setup({ rejected: { code: "", message: "database_unavailable" } });
    expect((await run()).ok).toBeUndefined();
    expect(state.removes).toEqual([]);
  });
  it.each([
    { rejected: { code: "", message: rejection.message } },
    { rejected: { code: "P0001", message: `${rejection.message}: unknown` } },
    { rejected: rejection, status: 500 },
  ])("no confunde parecido de error con rechazo confirmado: %j", async (options) => {
    const { state, run } = await setup(options);
    expect((await run()).ok).toBeUndefined();
    expect(state.removes).toEqual([]);
  });
  it("no limpia si lectura de rechazo explícito falla", async () => {
    const { state, run } = await setup({ rejected: rejection, read: "error" });
    expect((await run()).ok).toBeUndefined();
    expect(state.removes).toEqual([]);
  });
  it.each(["error", "throw"] as const)("cleanup %s no anuncia éxito", async (cleanup) => {
    const { state, run } = await setup({ rejected: rejection, cleanup });
    const result = await run();
    expect(state.removes).toEqual([[state.uploaded]]);
    expect(state.objects.has(state.uploaded)).toBe(true);
    expect(result.ok).toBeUndefined();
    expect(result.error).toMatch(/ni retirar la carga/i);
  });
});
