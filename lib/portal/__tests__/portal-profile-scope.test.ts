// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalClient, getPortalClientPrincipal } from "../portal-queries";

type Row = Record<string, unknown>;
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const CLIENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function client(id: string, tenantId: string, deletedAt: string | null = null): Row {
  return {
    id,
    tenant_id: tenantId,
    markbox: id === CLIENT_A ? "DTD-A" : "DTD-B",
    name: id === CLIENT_A ? "Cliente sintético A" : "Cliente sintético B",
    email: null,
    phone: null,
    address: null,
    rif: null,
    doc_kind: "empresa",
    city: null,
    state: null,
    deleted_at: deletedAt,
  };
}

function fixture(options: {
  membership?: Row | Row[] | null;
  authUser?: string | null;
  authError?: boolean;
  membershipError?: boolean;
  clientRow?: Row;
  throwsAt?: "auth" | "membership";
}) {
  const row = options.clientRow ?? client(CLIENT_A, TENANT_A);
  const membership = options.membership === undefined
    ? { auth_user_id: USER, status: "active", client_id: CLIENT_A, tenant_id: TENANT_A, clients: row }
    : options.membership;
  const touched: string[] = [];
  const db = {
    auth: { getUser: async () => {
      if (options.throwsAt === "auth") throw new Error("synthetic auth transport");
      return {
        data: { user: options.authUser === null ? null : { id: options.authUser ?? USER } },
        error: options.authError ? new Error("synthetic auth error") : null,
      };
    } },
    rpc: async (name: string) => ({
      data: name === "get_portal_client_id" && membership && !Array.isArray(membership)
        ? membership.client_id as string
        : null,
      error: null,
    }),
    from(table: string) {
      touched.push(table);
      if (options.throwsAt === "membership") throw new Error("synthetic query transport");
      let rows: Row[] = table === "client_users"
        ? (Array.isArray(membership) ? membership : membership ? [membership] : [])
        : table === "clients" ? [row] : [];
      const result = () => ({
        data: rows.length === 1 ? rows[0] : null,
        error: options.membershipError || rows.length > 1
          ? new Error("synthetic membership error") : null,
      });
      const builder = {
        select: () => builder,
        eq(key: string, value: unknown) {
          rows = rows.filter(candidate => candidate[key] === value);
          return builder;
        },
        maybeSingle: async () => result(),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, touched };
}

describe("SDD0382 · principal del perfil Portal", () => {
  it("entrega UID, tenant y el DTO propio desde una relación activa coherente", async () => {
    const { db, touched } = fixture({});
    expect(await getPortalClientPrincipal(db)).toEqual({
      userId: USER,
      tenantId: TENANT_A,
      client: {
        id: CLIENT_A, markbox: "DTD-A", name: "Cliente sintético A",
        email: null, phone: null, address: null, rif: null,
        docKind: "empresa", city: null, state: null,
      },
    });
    expect(touched).toEqual(["client_users"]);
  });

  it.each([
    { label: "otro UID", patch: { auth_user_id: "otro-usuario" } },
    { label: "vínculo inactivo", patch: { status: "inactive" } },
    { label: "cliente embebido distinto", patch: { client_id: CLIENT_B } },
    { label: "client_id vacío", patch: { client_id: " " } },
    { label: "tenant vacío", patch: { tenant_id: " " } },
  ])("rechaza $label aunque el vínculo sea visible por otro rol", async ({ patch }) => {
    const { db } = fixture({ membership: {
      auth_user_id: USER, status: "active", client_id: CLIENT_A,
      tenant_id: TENANT_A, clients: client(CLIENT_A, TENANT_A), ...patch,
    } });
    expect(await getPortalClientPrincipal(db)).toBeNull();
  });

  it("un usuario autenticado sin vínculo no recibe principal Portal", async () => {
    const { db } = fixture({ membership: null });
    expect(await getPortalClientPrincipal(db)).toBeNull();
  });

  it("rechaza múltiples vínculos activos sin escoger uno", async () => {
    const ownMembership = {
      auth_user_id: USER, status: "active", client_id: CLIENT_A,
      tenant_id: TENANT_A, clients: client(CLIENT_A, TENANT_A),
    };
    const { db } = fixture({ membership: [ownMembership, ownMembership] });
    expect(await getPortalClientPrincipal(db)).toBeNull();
  });

  it("acepta la relación embebida de exactamente un cliente", async () => {
    const { db } = fixture({ membership: {
      auth_user_id: USER, status: "active", client_id: CLIENT_A,
      tenant_id: TENANT_A, clients: [client(CLIENT_A, TENANT_A)],
    } });
    expect((await getPortalClientPrincipal(db))?.client.id).toBe(CLIENT_A);
  });

  it.each([
    { label: "ausente", embedded: null },
    { label: "colección vacía", embedded: [] },
    { label: "múltiple", embedded: [client(CLIENT_A, TENANT_A), client(CLIENT_B, TENANT_B)] },
    { label: "malformado", embedded: "client" },
    { label: "sin estado de retiro", embedded: { ...client(CLIENT_A, TENANT_A), deleted_at: undefined } },
    { label: "sin Shipping Mark", embedded: { ...client(CLIENT_A, TENANT_A), markbox: " " } },
    { label: "sin nombre", embedded: { ...client(CLIENT_A, TENANT_A), name: " " } },
  ])("rechaza cliente embebido $label", async ({ embedded }) => {
    const { db } = fixture({ membership: {
      auth_user_id: USER, status: "active", client_id: CLIENT_A,
      tenant_id: TENANT_A, clients: embedded,
    } });
    expect(await getPortalClientPrincipal(db)).toBeNull();
  });

  it("rechaza un vínculo activo cuyo tenant no coincide con el cliente", async () => {
    const foreign = client(CLIENT_B, TENANT_B);
    const { db } = fixture({
      clientRow: foreign,
      membership: {
        auth_user_id: USER,
        status: "active",
        client_id: CLIENT_B,
        tenant_id: TENANT_A,
        clients: foreign,
      },
    });
    expect(await getPortalClient(db)).toBeNull();
  });

  it("rechaza un cliente retirado aunque otro rol amplíe la RLS", async () => {
    const retired = client(CLIENT_A, TENANT_A, "2026-09-03T00:00:00Z");
    const { db } = fixture({
      clientRow: retired,
      membership: {
        auth_user_id: USER,
        status: "active",
        client_id: CLIENT_A,
        tenant_id: TENANT_A,
        clients: retired,
      },
    });
    expect(await getPortalClient(db)).toBeNull();
  });

  it("no confía en una RPC de identidad cuando la sesión está ausente", async () => {
    const { db, touched } = fixture({ authUser: null });
    expect(await getPortalClient(db)).toBeNull();
    expect(touched).toEqual([]);
  });

  it("un error de autenticación con UID presente impide leer el vínculo", async () => {
    const { db, touched } = fixture({ authError: true });
    expect(await getPortalClientPrincipal(db)).toBeNull();
    expect(touched).toEqual([]);
  });

  it("rechaza una respuesta de vínculo con datos y error", async () => {
    const { db } = fixture({ membershipError: true });
    expect(await getPortalClientPrincipal(db)).toBeNull();
  });

  it.each(["auth", "membership"] as const)(
    "falla cerrado si %s lanza una excepción de transporte",
    async throwsAt => {
      const { db } = fixture({ throwsAt });
      await expect(getPortalClient(db)).resolves.toBeNull();
    },
  );
});
