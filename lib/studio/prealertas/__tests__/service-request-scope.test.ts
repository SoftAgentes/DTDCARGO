// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listPrealertaServiceRequests } from "../queries";

type Row = Record<string, unknown>;
const USER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MARK = "DTD-SYNTHETIC";
const member = (): Row => ({
  auth_user_id: USER, status: "active", client_id: CLIENT, tenant_id: TENANT,
  clients: { id: CLIENT, tenant_id: TENANT, markbox: MARK, deleted_at: null },
});
const request = (id: string, over: Row = {}): Row => ({
  id, tenant_id: TENANT, client_markbox: MARK, deleted_at: null,
  prealerta_id: "purchase-own", addon_code: "hold_consolidar",
  status: "solicitada", timing: "a_tiempo", consent_accepted: true,
  trackings: ["synthetic-tracking"], notes: "synthetic note", quoted_amount_usd: "12.50",
  created_at: "2026-09-01T12:00:00Z", updated_at: "2026-09-01T12:00:00Z",
  processed_at: null, ...over,
});

// Transporte con filtros reales; deliberadamente no oculta filas mediante RLS.
function fixture(options: {
  membership?: Row | null; user?: string | null; authError?: boolean;
  queryError?: string; rows?: Row[]; throws?: boolean;
} = {}) {
  const touched: string[] = [];
  const data: Record<string, Row[]> = {
    client_users: options.membership === null ? [] : [options.membership ?? member()],
    prealerta_service_requests: options.rows ?? [
      request("own"), request("foreign-tenant", { tenant_id: OTHER }),
      request("foreign-client", { client_markbox: "DTD-OTHER" }),
      request("deleted", { deleted_at: "2026-09-02" }),
      request("own-second", { prealerta_id: "purchase-second", created_at: "2026-09-02T12:00:00Z" }),
    ],
  };
  const db = {
    auth: { getUser: async () => ({
      data: { user: options.user === null ? null : { id: options.user ?? USER } },
      error: options.authError ? new Error("synthetic auth failure") : null,
    }) },
    from(table: string) {
      touched.push(table);
      if (options.throws) throw new Error("synthetic transport");
      let rows = [...(data[table] ?? [])];
      let maximum = Infinity;
      const result = () => ({
        data: rows.slice(0, maximum),
        error: options.queryError === table ? new Error("synthetic") : null,
      });
      const b = {
        select: () => b,
        eq(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return b; },
        is(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return b; },
        order(key: string, opts: { ascending: boolean }) {
          rows.sort((a, z) => String(a[key]).localeCompare(String(z[key])) * (opts.ascending ? 1 : -1));
          return b;
        },
        limit(n: number) { maximum = n; return b; },
        maybeSingle: async () => ({ ...result(), data: rows.length === 1 ? rows[0] : null }),
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { db, touched };
}

describe("SDD0381 · solicitudes del Portal, sin heredar el ámbito Studio", () => {
  it("excluye mismo Shipping Mark de otro tenant, otros clientes y bajas", async () => {
    const { db } = fixture();
    expect((await listPrealertaServiceRequests(db, { markbox: MARK })).map(r => r.id))
      .toEqual(["own", "own-second"]);
  });
  it("mantiene el filtro opcional por compra y el mapeo", async () => {
    const { db } = fixture();
    const rows = await listPrealertaServiceRequests(db, { markbox: MARK, prealertaId: "purchase-own" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "own", quoted_amount_usd: 12.5, consent_accepted: true,
      trackings: ["synthetic-tracking"], timing: "a_tiempo", processed_at: null,
    });
  });
  it.each([
    ["anónimo", { user: null }],
    ["error de autenticación", { authError: true }],
    ["vínculo ausente", { membership: null }],
    ["error del vínculo", { queryError: "client_users" }],
  ] as const)("sin principal válido: %s no consulta solicitudes", async (_label, options) => {
    const { db, touched } = fixture(options);
    expect(await listPrealertaServiceRequests(db, { markbox: MARK })).toEqual([]);
    expect(touched).not.toContain("prealerta_service_requests");
  });
  it.each([
    ["revocado", (m: Row) => ({ ...m, status: "revoked" })],
    ["invitado", (m: Row) => ({ ...m, status: "invited" })],
    ["otra sesión", (m: Row) => ({ ...m, auth_user_id: OTHER })],
    ["tenant incoherente", (m: Row) => ({ ...m, tenant_id: OTHER })],
    ["cliente incoherente", (m: Row) => ({ ...m, client_id: OTHER })],
    ["cliente retirado", (m: Row) => ({ ...m, clients: { ...(m.clients as Row), deleted_at: "2026-09-02" } })],
    ["cliente ausente", (m: Row) => ({ ...m, clients: null })],
    ["tenant vacío", (m: Row) => ({ ...m, tenant_id: "", clients: { ...(m.clients as Row), tenant_id: "" } })],
    ["relación múltiple", (m: Row) => ({ ...m, clients: [m.clients, m.clients] })],
  ] as const)("rechaza %s antes de leer solicitudes", async (_label, mutate) => {
    const { db, touched } = fixture({ membership: mutate(member()) });
    expect(await listPrealertaServiceRequests(db, { markbox: MARK })).toEqual([]);
    expect(touched).not.toContain("prealerta_service_requests");
  });
  it.each(["", " ", undefined, "DTD-OTHER"])("un filtro Portal inválido (%s) no cae al modo Studio", async markbox => {
    const { db, touched } = fixture();
    expect(await listPrealertaServiceRequests(db, { markbox })).toEqual([]);
    expect(touched).not.toContain("prealerta_service_requests");
  });
  it("admite una relación embebida única", async () => {
    const m = member();
    const { db } = fixture({ membership: { ...m, clients: [m.clients] } });
    expect((await listPrealertaServiceRequests(db, { markbox: MARK })).map(r => r.id))
      .toEqual(["own", "own-second"]);
  });
  it("Studio sin propiedad markbox conserva su consulta y no resuelve identidad Portal", async () => {
    const { db, touched } = fixture({ user: null, membership: null });
    expect((await listPrealertaServiceRequests(db)).map(r => r.id))
      .toEqual(["own", "foreign-tenant", "foreign-client", "own-second"]);
    expect(touched).toEqual(["prealerta_service_requests"]);
  });
  it("conserva límite500 y orden ascendente después del filtro", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => request(String(i), {
      created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    })).reverse();
    const { db } = fixture({ rows });
    const result = await listPrealertaServiceRequests(db, { markbox: MARK });
    expect(result).toHaveLength(500);
    expect(result[0].id).toBe("0");
    expect(result.at(-1)?.id).toBe("499");
  });
  it.each([{ queryError: "prealerta_service_requests" }, { throws: true }])(
    "conserva fallback vacío si falla el transporte", async options => {
      const { db } = fixture(options);
      expect(await listPrealertaServiceRequests(db, { markbox: MARK })).toEqual([]);
    },
  );
});
