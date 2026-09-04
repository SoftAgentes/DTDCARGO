// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  notifyChangeRequestToAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  uploadClientPhoto: vi.fn(),
  uploadClientAvatar: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/studio/change-request-notify", () => ({
  notifyChangeRequestToAdmin: mocks.notifyChangeRequestToAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/portal/client-photo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/portal/client-photo")>();
  return {
    ...original,
    uploadClientPhoto: mocks.uploadClientPhoto,
    uploadClientAvatar: mocks.uploadClientAvatar,
  };
});

import {
  cancelDataChangeRequestAction,
  submitDataChangeRequestAction,
  uploadCedulaPhotoAction,
} from "./actions";
import { updateAvatarAction } from "./avatar-actions";

const AUTH_ID = "10000000-0000-4000-8000-000000000001";
const CLIENT_ID = "20000000-0000-4000-8000-000000000001";
const TENANT_ID = "30000000-0000-4000-8000-000000000001";
const OTHER_TENANT_ID = "30000000-0000-4000-8000-000000000002";
const REQUEST_ID = "40000000-0000-4000-8000-000000000001";
const MARKBOX = "DTD-TEST-0384";
const OLD_CEDULA = `${TENANT_ID}/${MARKBOX}/old.png`;
const OLD_AVATAR = `${TENANT_ID}/${MARKBOX}/avatar/old.png`;
const NEW_CEDULA = `${TENANT_ID}/${MARKBOX}/new.png`;
const NEW_AVATAR = `${TENANT_ID}/${MARKBOX}/avatar/new.png`;

type Filter = { method: "eq" | "is" | "in"; column: string; value: unknown };
type Chain = {
  table: string;
  operation: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: Filter[];
};

type SetupOptions = {
  coherent?: boolean;
  authError?: boolean;
  updateError?: boolean;
};

function setup(options: SetupOptions = {}) {
  const coherent = options.coherent ?? true;
  const client = {
    id: CLIENT_ID,
    tenant_id: TENANT_ID,
    markbox: MARKBOX,
    name: "Cliente anterior",
    email: "cliente@example.test",
    phone: "584121234567",
    address: null,
    rif: "V-12345678",
    doc_kind: "persona",
    city: "Valencia",
    state: "Carabobo",
    deleted_at: null,
  };
  const membership = {
    client_id: CLIENT_ID,
    tenant_id: coherent ? TENANT_ID : OTHER_TENANT_ID,
    clients: client,
  };
  const sessionChain = () => {
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: membership, error: null }),
    });
    return builder;
  };
  const session = {
    auth: {
      getUser: vi.fn(async () => options.authError
        ? { data: { user: null }, error: { message: "synthetic auth failure" } }
        : { data: { user: { id: AUTH_ID } }, error: null }),
    },
    // Reproduce el helper legado: devuelve B incluso si el tenant del vínculo es A.
    rpc: vi.fn(async () => ({ data: CLIENT_ID, error: null })),
    from: vi.fn((table: string) => {
      if (table !== "client_users") throw new Error(`Tabla de sesión no simulada: ${table}`);
      return sessionChain();
    }),
  } as unknown as SupabaseClient;

  const chains: Chain[] = [];
  const removed: string[][] = [];
  const insertedRow = {
    id: REQUEST_ID,
    tenant_id: TENANT_ID,
    client_id: CLIENT_ID,
    proposed_name: "Cliente corregido",
    proposed_rif: null,
    proposed_phone: null,
    prev_name: client.name,
    prev_rif: client.rif,
    prev_phone: client.phone,
    status: "pending",
    source: "client",
    submitted_at: "2026-09-03T12:00:00Z",
    reviewed_at: null,
    reviewed_by: null,
    review_note: null,
  };

  function terminal(chain: Chain) {
    if (chain.table === "clients" && chain.operation === "select") {
      return { data: {
        tenant_id: TENANT_ID,
        markbox: MARKBOX,
        cedula_photo_path: OLD_CEDULA,
        avatar_path: OLD_AVATAR,
        name: client.name,
        rif: client.rif,
        phone: client.phone,
        doc_kind: client.doc_kind,
        advisor_id: null,
      }, error: null };
    }
    if (chain.table === "clients" && chain.operation === "update") {
      return { data: null, error: options.updateError
        ? { code: "57014", message: "synthetic update failure" }
        : null };
    }
    if (chain.table === "client_change_requests" && chain.operation === "select") {
      return { data: null, error: null };
    }
    if (chain.table === "client_change_requests" && chain.operation === "insert") {
      return { data: insertedRow, error: null };
    }
    if (chain.table === "client_change_requests" && chain.operation === "delete") {
      return { data: null, error: null };
    }
    throw new Error(`Terminal no simulada: ${chain.table}/${chain.operation}`);
  }

  function builderFor(table: string) {
    const chain: Chain = { table, operation: "select", filters: [] };
    chains.push(chain);
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      insert: (payload: unknown) => { chain.operation = "insert"; chain.payload = payload; return builder; },
      update: (payload: unknown) => { chain.operation = "update"; chain.payload = payload; return builder; },
      delete: () => { chain.operation = "delete"; return builder; },
      eq: (column: string, value: unknown) => {
        chain.filters.push({ method: "eq", column, value });
        return builder;
      },
      is: (column: string, value: unknown) => {
        chain.filters.push({ method: "is", column, value });
        return builder;
      },
      in: (column: string, value: unknown) => {
        chain.filters.push({ method: "in", column, value });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => terminal(chain),
      single: async () => terminal(chain),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(terminal(chain)).then(resolve, reject),
    });
    return builder;
  }

  const remove = vi.fn(async (paths: string[]) => {
    removed.push(paths);
    return { data: [], error: null };
  });
  const admin = {
    from: vi.fn((table: string) => builderFor(table)),
    storage: { from: vi.fn(() => ({ remove })) },
  } as unknown as SupabaseClient;
  mocks.createClient.mockResolvedValue(session);
  mocks.createAdminClient.mockReturnValue(admin);
  return { chains, removed };
}

function photoForm(field: "cedula_photo" | "avatar") {
  const form = new FormData();
  form.set(field, new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" }));
  return form;
}

function changeForm() {
  const form = new FormData();
  form.set("name", "Cliente corregido");
  form.set("doc", "V-12345678");
  form.set("phone", "584121234567");
  return form;
}

function filtersFor(chains: Chain[], table: string, operation: Chain["operation"]) {
  return chains.filter((chain) => chain.table === table && chain.operation === operation);
}

const exactClientScope = expect.arrayContaining([
  { method: "eq", column: "tenant_id", value: TENANT_ID },
  { method: "eq", column: "id", value: CLIENT_ID },
  { method: "is", column: "deleted_at", value: null },
]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifyChangeRequestToAdmin.mockResolvedValue(undefined);
  mocks.uploadClientPhoto.mockResolvedValue({ path: NEW_CEDULA });
  mocks.uploadClientAvatar.mockResolvedValue({ path: NEW_AVATAR });
});

describe("SDD0384 · principal coherente antes de service_role", () => {
  it.each([
    ["cédula", () => uploadCedulaPhotoAction({}, photoForm("cedula_photo"))],
    ["avatar", () => updateAvatarAction({}, photoForm("avatar"))],
    ["solicitud", () => submitDataChangeRequestAction({}, changeForm())],
    ["cancelación", () => cancelDataChangeRequestAction({})],
  ] as const)("%s falla cerrado con vínculo tenant/cliente incoherente", async (_label, run) => {
    setup({ coherent: false });
    const result = await run();
    expect(result.ok).not.toBe(true);
    expect(result.error).toMatch(/sesión/i);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.uploadClientPhoto).not.toHaveBeenCalled();
    expect(mocks.uploadClientAvatar).not.toHaveBeenCalled();
    expect(mocks.notifyChangeRequestToAdmin).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("corta también cuando Auth no puede verificar la sesión", async () => {
    setup({ authError: true });
    await expect(cancelDataChangeRequestAction({})).resolves.toMatchObject({ error: expect.stringMatching(/sesión/i) });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("recupera un fallo al construir el cliente de sesión sin elevar", async () => {
    setup();
    mocks.createClient.mockRejectedValueOnce(new Error("synthetic session transport failure"));
    await expect(cancelDataChangeRequestAction({})).resolves.toMatchObject({ error: expect.stringMatching(/sesión/i) });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});

describe("SDD0384 · scope explícito de las operaciones elevadas", () => {
  it("cédula fija tenant/cliente vivo al leer y actualizar", async () => {
    const { chains } = setup();
    await expect(uploadCedulaPhotoAction({}, photoForm("cedula_photo"))).resolves.toEqual({ ok: true });
    expect(filtersFor(chains, "clients", "select")).toHaveLength(1);
    expect(filtersFor(chains, "clients", "select")[0].filters).toEqual(exactClientScope);
    expect(filtersFor(chains, "clients", "update")).toHaveLength(1);
    expect(filtersFor(chains, "clients", "update")[0].filters).toEqual(exactClientScope);
    expect(mocks.uploadClientPhoto).toHaveBeenCalledWith(expect.anything(), TENANT_ID, MARKBOX, expect.any(File));
  });

  it("avatar fija tenant/cliente vivo al leer y actualizar", async () => {
    const { chains } = setup();
    await expect(updateAvatarAction({}, photoForm("avatar"))).resolves.toEqual({ ok: true });
    expect(filtersFor(chains, "clients", "select")[0].filters).toEqual(exactClientScope);
    expect(filtersFor(chains, "clients", "update")[0].filters).toEqual(exactClientScope);
    expect(mocks.uploadClientAvatar).toHaveBeenCalledWith(expect.anything(), TENANT_ID, MARKBOX, expect.any(File));
  });

  it("alta fija tenant, cliente y origen en lectura e insert", async () => {
    const { chains } = setup();
    await expect(submitDataChangeRequestAction({}, changeForm())).resolves.toEqual({ ok: true });
    expect(filtersFor(chains, "clients", "select")[0].filters).toEqual(exactClientScope);
    const open = filtersFor(chains, "client_change_requests", "select")[0];
    expect(open.filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "tenant_id", value: TENANT_ID },
      { method: "eq", column: "client_id", value: CLIENT_ID },
      { method: "eq", column: "source", value: "client" },
      { method: "eq", column: "status", value: "pending" },
    ]));
    expect(filtersFor(chains, "client_change_requests", "insert")[0].payload).toMatchObject({
      tenant_id: TENANT_ID,
      client_id: CLIENT_ID,
      source: "client",
      status: "pending",
    });
  });

  it("cancelación fija tenant, cliente, origen y estado", async () => {
    const { chains } = setup();
    await expect(cancelDataChangeRequestAction({})).resolves.toEqual({ ok: true });
    expect(filtersFor(chains, "client_change_requests", "delete")[0].filters).toEqual(expect.arrayContaining([
      { method: "eq", column: "tenant_id", value: TENANT_ID },
      { method: "eq", column: "client_id", value: CLIENT_ID },
      { method: "eq", column: "source", value: "client" },
      { method: "eq", column: "status", value: "pending" },
    ]));
  });

  it("conserva rollback: al fallar update elimina sólo el objeto nuevo", async () => {
    const { removed } = setup({ updateError: true });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await uploadCedulaPhotoAction({}, photoForm("cedula_photo"));
      expect(result.ok).not.toBe(true);
      expect(removed).toEqual([[NEW_CEDULA]]);
      expect(removed.flat()).not.toContain(OLD_CEDULA);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it.each([
    ["cédula", () => uploadCedulaPhotoAction({}, new FormData())],
    ["avatar", () => updateAvatarAction({}, new FormData())],
  ] as const)("%s inválida no construye admin", async (_label, run) => {
    setup();
    const result = await run();
    expect(result.ok).not.toBe(true);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
