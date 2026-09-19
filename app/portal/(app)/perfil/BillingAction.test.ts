// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  profile: {
    principal_kind: "persona",
    principal_name: "Carlos Pérez",
    principal_doc: "V-12345678",
    secondary: null,
    billing_kind: "persona",
  } as Record<string, unknown> | null,
  profileError: null as { message: string } | null,
  rpc: vi.fn(),
  notify: vi.fn(),
  revalidatePath: vi.fn(),
  attempt: { field: "company_rif", conflicting_client_id: "client-2" } as Record<string, unknown> | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => stubs.revalidatePath(...a) }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args?: unknown) => {
      if (name === "portal_get_my_billing_profile") return { data: stubs.profile, error: stubs.profileError };
      if (name === "get_portal_client_id") return { data: "client-1", error: null };
      return stubs.rpc(name, args);
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (_col: string, value: string) => ((chain as { _id?: string })._id = value, chain),
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "client_profile_blocked_attempts") return { data: stubs.attempt, error: null };
          const id = (chain as { _id?: string })._id;
          return id === "client-2"
            ? { data: { markbox: "DTD-9999" }, error: null }
            : { data: { tenant_id: "tenant-1", markbox: "DTD-5452", name: "Carlos Pérez", advisor_id: "adv-1" }, error: null };
        },
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/studio/change-request-notify", () => ({
  notifyBlockedProfileEditToAdmin: (...a: unknown[]) => stubs.notify(...a),
}));

const { saveBillingIdentityAction, removeBillingIdentityAction, setBillingKindAction } = await import("./billing-actions");

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  stubs.profile = {
    principal_kind: "persona",
    principal_name: "Carlos Pérez",
    principal_doc: "V-12345678",
    secondary: null,
    billing_kind: "persona",
  };
  stubs.profileError = null;
  stubs.rpc.mockReset().mockResolvedValue({ data: [{ outcome: "applied" }], error: null });
  stubs.notify.mockReset();
  stubs.revalidatePath.mockReset();
  stubs.attempt = { field: "company_rif", conflicting_client_id: "client-2" };
});

describe("saveBillingIdentityAction (SDD-0487)", () => {
  it("agrega la empresa con el RIF canónico y la casilla como preferencia", async () => {
    const out = await saveBillingIdentityAction({}, form({
      mode: "add", legal_name: " Importadora  Pérez C.A. ", doc: "j123456789", fiscal_address: "", set_default: "on",
    }));
    expect(out).toEqual({ ok: true, done: "saved" });
    expect(stubs.rpc).toHaveBeenCalledWith("portal_upsert_my_billing_identity", {
      p_legal_name: "Importadora Pérez C.A.",
      p_doc: "J-12345678-9",
      p_fiscal_address: null,
      p_set_default: true,
    });
    expect(stubs.revalidatePath).toHaveBeenCalledWith("/portal/perfil");
  });

  it("al agregar sin la casilla no la deja como preferencia; al editar no la toca", async () => {
    await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Importadora", doc: "J-12345678-9", fiscal_address: "" }));
    expect(stubs.rpc.mock.calls[0][1]).toMatchObject({ p_set_default: false });
    await saveBillingIdentityAction({}, form({ mode: "edit", legal_name: "Importadora", doc: "J-12345678-9", fiscal_address: "", set_default: "on" }));
    expect(stubs.rpc.mock.calls[1][1]).toMatchObject({ p_set_default: null });
  });

  it("una cuenta de empresa agrega su cédula, no un RIF", async () => {
    stubs.profile = { ...stubs.profile!, principal_kind: "empresa", billing_kind: "empresa" };
    const bad = await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Juan Gómez", doc: "J-12345678-9", fiscal_address: "" }));
    expect(bad).toMatchObject({ fieldErrors: { doc: "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567." } });
    expect(stubs.rpc).not.toHaveBeenCalled();
    await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Juan Gómez", doc: "v20000000", fiscal_address: "" }));
    expect(stubs.rpc.mock.calls[0][1]).toMatchObject({ p_doc: "V-20000000", p_fiscal_address: null });
  });

  it("un RIF de otra ficha: mensaje genérico y aviso al asesor con los dos Shipping Marks", async () => {
    stubs.rpc.mockResolvedValue({ data: [{ outcome: "blocked" }], error: null });
    const out = await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Otra", doc: "J-40123456-7", fiscal_address: "" }));
    expect(out).toEqual({ error: "No pudimos guardar ese dato. Escríbenos por soporte y lo revisamos." });
    expect(stubs.notify).toHaveBeenCalledWith(expect.anything(), {
      tenantId: "tenant-1",
      markbox: "DTD-5452",
      clientName: "Carlos Pérez",
      advisorId: "adv-1",
      field: "company_rif",
      conflictingMarkbox: "DTD-9999",
    });
    expect(JSON.stringify(stubs.notify.mock.calls)).not.toContain("40123456");
    expect(stubs.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["no_changes", "No cambiaste ningún dato."],
    ["rate_limited", "Por seguridad, espera 24 horas para volver a cambiar un documento, o escríbenos por soporte."],
  ])("traduce %s", async (outcome, error) => {
    stubs.rpc.mockResolvedValue({ data: [{ outcome }], error: null });
    expect(await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Importadora", doc: "J-12345678-9", fiscal_address: "" })))
      .toEqual({ error });
    expect(stubs.notify).not.toHaveBeenCalled();
  });

  it("sin 0466 (la RPC no existe) no anuncia nada ni escribe", async () => {
    stubs.profileError = { message: "Could not find the function" };
    expect(await saveBillingIdentityAction({}, form({ mode: "add", legal_name: "Importadora", doc: "J-12345678-9", fiscal_address: "" })))
      .toEqual({ error: "No está disponible ahora. Prueba de nuevo en un rato." });
    expect(stubs.rpc).not.toHaveBeenCalled();
  });
});

describe("removeBillingIdentityAction y setBillingKindAction", () => {
  it("quitar la identidad revalida el perfil", async () => {
    expect(await removeBillingIdentityAction()).toEqual({ ok: true, done: "removed" });
    expect(stubs.rpc).toHaveBeenCalledWith("portal_delete_my_billing_identity", undefined);
  });

  it("elegir el titular llama a la RPC con el tipo", async () => {
    expect(await setBillingKindAction({}, form({ billing_kind: "empresa" }))).toEqual({ ok: true, done: "kind" });
    expect(stubs.rpc).toHaveBeenCalledWith("portal_set_my_billing_kind", { p_kind: "empresa" });
  });

  it("sin la identidad no se puede elegir y un tipo inventado ni se envía", async () => {
    stubs.rpc.mockResolvedValue({ data: [{ outcome: "missing_identity" }], error: null });
    expect(await setBillingKindAction({}, form({ billing_kind: "empresa" })))
      .toEqual({ error: "Primero agrega esos datos para poder facturar a ese nombre." });
    stubs.rpc.mockClear();
    expect(await setBillingKindAction({}, form({ billing_kind: "tercero" }))).toMatchObject({ error: expect.any(String) });
    expect(stubs.rpc).not.toHaveBeenCalled();
  });
});
