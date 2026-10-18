// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

const stubs = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  notify: vi.fn(),
  client: {
    tenant_id: "tenant-1",
    markbox: "DTD-5452",
    name: "Ana Ficticia",
    doc_kind: "persona" as string | null,
    advisor_id: "advisor-1" as string | null,
  },
  attempt: { field: "document", conflicting_client_id: "client-2" } as
    | { field: string; conflicting_client_id: string | null }
    | null,
  otherMarkbox: "DTD-7000",
  signedIn: true,
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => stubs.revalidatePath(...args),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: (...args: unknown[]) => stubs.rpc(...args),
  }),
}));

// SDD-0552: cliente, tenant, markbox, nombre y tipo de documento salen del
// principal Portal de la sesión (antes: RPC `get_portal_client_id` + relectura
// de `clients` con el admin). Refleja la misma ficha de `stubs.client`.
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: async () =>
    stubs.signedIn
      ? {
          userId: "u1",
          tenantId: stubs.client.tenant_id,
          client: {
            id: "client-1",
            markbox: stubs.client.markbox,
            name: stubs.client.name,
            docKind:
              stubs.client.doc_kind === "empresa" || stubs.client.doc_kind === "persona"
                ? stubs.client.doc_kind
                : null,
          },
        }
      : null,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          chain.filters.push([column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        filters: [] as Array<[string, unknown]>,
        maybeSingle: async () => {
          if (table === "clients") {
            const byId = chain.filters.find(([c]) => c === "id")?.[1];
            if (byId === "client-2") return { data: { markbox: stubs.otherMarkbox }, error: null };
            return { data: stubs.client, error: null };
          }
          if (table === "client_profile_blocked_attempts") {
            return { data: stubs.attempt, error: null };
          }
          throw new Error(`tabla inesperada: ${table}`);
        },
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/studio/change-request-notify", () => ({
  notifyBlockedProfileEditToAdmin: (...args: unknown[]) => stubs.notify(...args),
}));

const { updateMyProfileAction } = await import("./actions");

function form(values: Partial<Record<"name" | "doc" | "phone", string>>) {
  const f = new FormData();
  f.set("name", values.name ?? "");
  f.set("doc", values.doc ?? "");
  f.set("phone", values.phone ?? "");
  // Un atacante no puede elegir la ficha: la action la toma de la sesión.
  f.set("client_id", "ATTACKER");
  return f;
}

function rpcReturns(result: RpcResult) {
  stubs.rpc.mockImplementation(async (name: string) => {
    if (name === "portal_update_my_profile") return result;
    throw new Error(`rpc inesperada: ${name}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.signedIn = true;
  stubs.client.doc_kind = "persona";
  stubs.attempt = { field: "document", conflicting_client_id: "client-2" };
  rpcReturns({ data: [{ outcome: "applied", remaining_count: 2 }], error: null });
});

describe("updateMyProfileAction · SDD-0482", () => {
  it("normaliza, llama a la RPC con los valores canónicos y revalida", async () => {
    const result = await updateMyProfileAction(
      {},
      form({ name: " Ana Pérez ", doc: "v12345678", phone: "0414-123.4567" }),
    );

    expect(result).toEqual({ ok: true });
    expect(stubs.rpc).toHaveBeenCalledWith("portal_update_my_profile", {
      p_name: "Ana Pérez",
      p_doc: "V-12345678",
      p_phone: "584141234567",
    });
    expect(stubs.revalidatePath).toHaveBeenCalledWith("/portal/perfil");
    expect(stubs.notify).not.toHaveBeenCalled();
  });

  it("valida según el tipo de cliente antes de llamar a la RPC", async () => {
    const result = await updateMyProfileAction({}, form({ doc: "J-12345678-9", phone: "12" }));
    expect(result.error).toBe("Revisa los datos marcados.");
    expect(result.fieldErrors).toEqual({
      doc: "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567.",
      phone: "Teléfono inválido.",
    });
    expect(stubs.rpc).not.toHaveBeenCalledWith("portal_update_my_profile", expect.anything());
  });

  it("todo vacío no llama a la RPC", async () => {
    expect(await updateMyProfileAction({}, form({}))).toEqual({
      error: "No cambiaste ningún dato.",
    });
    expect(stubs.rpc).not.toHaveBeenCalledWith("portal_update_my_profile", expect.anything());
  });

  it.each([
    ["no_changes", /no cambiaste ningún dato/i],
    ["rate_limited", /espera 24 horas/i],
  ])("resultado %s: mensaje y sin aviso al asesor", async (outcome, message) => {
    rpcReturns({ data: [{ outcome, remaining_count: 2 }], error: null });
    const result = await updateMyProfileAction({}, form({ doc: "V-99999999" }));
    expect(result.error).toMatch(message);
    expect(result.ok).toBeUndefined();
    expect(stubs.notify).not.toHaveBeenCalled();
    expect(stubs.revalidatePath).not.toHaveBeenCalled();
  });

  it("bloqueo: mensaje genérico y aviso al asesor con los dos Shipping Marks, sin el valor", async () => {
    rpcReturns({ data: [{ outcome: "blocked", remaining_count: 2 }], error: null });
    const result = await updateMyProfileAction({}, form({ doc: "V-87654321" }));

    expect(result.error).toBe("No pudimos guardar ese dato. Escríbenos por soporte y lo revisamos.");
    expect(stubs.notify).toHaveBeenCalledTimes(1);
    const [, args] = stubs.notify.mock.calls[0];
    expect(args).toEqual({
      tenantId: "tenant-1",
      markbox: "DTD-5452",
      clientName: "Ana Ficticia",
      advisorId: "advisor-1",
      field: "document",
      conflictingMarkbox: "DTD-7000",
    });
    expect(JSON.stringify(stubs.notify.mock.calls)).not.toContain("87654321");
  });

  it("bloqueo por teléfono sin cliente en conflicto conocido (carrera)", async () => {
    rpcReturns({ data: [{ outcome: "blocked", remaining_count: 2 }], error: null });
    stubs.attempt = { field: "phone", conflicting_client_id: null };
    await updateMyProfileAction({}, form({ phone: "04140000000" }));
    expect(stubs.notify.mock.calls[0][1]).toMatchObject({ field: "phone", conflictingMarkbox: null });
  });

  it.each([
    ["profile_edit_limit_reached", { error: "Ya usaste tus 3 cambios de perfil. Si necesitas corregir algo importante, escríbenos por soporte." }],
    ["invalid_profile_document", { error: "Revisa los datos marcados.", fieldErrors: { doc: "Revisa el formato de tu documento." } }],
    ["invalid_profile_phone", { error: "Revisa los datos marcados.", fieldErrors: { phone: "Teléfono inválido." } }],
    ["portal_session_required", { error: "Tu sesión expiró. Vuelve a entrar al portal." }],
  ])("traduce el error SQL %s", async (message, expected) => {
    rpcReturns({ data: null, error: { code: "P0001", message } });
    expect(await updateMyProfileAction({}, form({ name: "Ana Pérez" }))).toEqual(expected);
  });

  it("si la RPC no existe (0462 sin aplicar) o responde raro, no anuncia éxito", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcReturns({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    expect((await updateMyProfileAction({}, form({ name: "Ana Pérez" }))).ok).toBeUndefined();
    rpcReturns({ data: [{ outcome: "ok" }], error: null });
    expect((await updateMyProfileAction({}, form({ name: "Ana Pérez" }))).error).toMatch(/no pudimos guardar/i);
    expect(stubs.revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("empresa: acepta RIF y rechaza cédula", async () => {
    stubs.client.doc_kind = "empresa";
    expect(await updateMyProfileAction({}, form({ doc: "j123456789" }))).toEqual({ ok: true });
    expect(stubs.rpc).toHaveBeenCalledWith("portal_update_my_profile", {
      p_name: null,
      p_doc: "J-12345678-9",
      p_phone: null,
    });
    const rejected = await updateMyProfileAction({}, form({ doc: "V-12345678" }));
    expect(rejected.fieldErrors?.doc).toMatch(/RIF inválido/);
  });

  it("sin sesión no hace nada", async () => {
    stubs.signedIn = false;
    stubs.rpc.mockImplementation(async () => ({ data: null, error: { message: "jwt" } }));
    expect(await updateMyProfileAction({}, form({ name: "Ana Pérez" }))).toEqual({
      error: "Tu sesión expiró. Vuelve a entrar al portal.",
    });
    expect(stubs.rpc).not.toHaveBeenCalled();
  });
});
