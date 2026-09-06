// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listMyCotizaciones, listMyEstimates } from "../portal-queries";

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
const quote = (id: string, over: Row = {}): Row => ({
  id, tenant_id: TENANT, client_markbox: MARK, deleted_at: null,
  quote_code: id, source: "web", status: "draft", service: "puerta_a_puerta_DDP",
  total_usd: 0, created_at: "2026-09-01", updated_at: "2026-09-01",
  converted_to_shipment_id: null, ...over,
});

/** Transporte en memoria: aplica filtros reales, no simula que RLS los añadió.
 * Modela al híbrido con permiso Studio para recibir ambos tenants/propietarios. */
function fixture(options: {
  membership?: Row | null; memberships?: Row[]; user?: string | null; authError?: boolean;
  queryError?: string; quotes?: Row[]; shipments?: Row[];
} = {}) {
  const touched: string[] = [];
  const data: Record<string, Row[]> = {
    client_users: options.memberships ?? (options.membership === null ? [] : [options.membership ?? member()]),
    quotes: options.quotes ?? [
      quote("own"), quote("foreign-tenant", { tenant_id: OTHER }),
      quote("foreign-client", { client_markbox: "DTD-OTHER" }),
      quote("deleted", { deleted_at: "2026-09-02" }),
      quote("formal", { source: "studio" }),
    ],
    shipments: options.shipments ?? [],
  };
  const db = {
    auth: { getUser: async () => ({
      data: { user: options.user === null ? null : { id: options.user ?? USER } },
      error: options.authError ? new Error("synthetic auth failure") : null,
    }) },
    // Contraste legado: el helper devuelve texto sin acreditar cliente vivo/coherente.
    rpc: async () => ({ data: MARK, error: null }),
    from(table: string) {
      touched.push(table);
      let rows = [...(data[table] ?? [])];
      const result = () => ({ data: rows, error: options.queryError === table ? new Error("synthetic") : null });
      const b = {
        select: () => b,
        eq(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return b; },
        neq(key: string, value: unknown) { rows = rows.filter(r => r[key] !== value); return b; },
        is(key: string, value: unknown) { rows = rows.filter(r => r[key] === value); return b; },
        in(key: string, values: unknown[]) { rows = rows.filter(r => values.includes(r[key])); return b; },
        order(key: string, options: { ascending: boolean }) {
          rows.sort((a, z) => String(a[key]).localeCompare(String(z[key])) * (options.ascending ? 1 : -1));
          return b;
        },
        limit(n: number) { rows = rows.slice(0, n); return Promise.resolve(result()); },
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

describe("SDD0380 · cotizaciones propias aun con permisos Studio adicionales", () => {
  it("excluye mismo Shipping Mark de otro tenant, otros clientes y bajas", async () => {
    const { db } = fixture();
    expect((await listMyEstimates(db)).map(r => r.id)).toEqual(["own"]);
  });
  it("conserva el split web/studio de cotizaciones formales", async () => {
    const { db } = fixture();
    expect((await listMyCotizaciones(db)).map(r => r.id)).toEqual(["formal"]);
  });
  it.each([
    ["anónimo", { user: null }],
    ["error de autenticación", { authError: true }],
    ["vínculo ausente", { membership: null }],
    ["error al resolver vínculo", { queryError: "client_users" }],
  ] as const)("sin principal válido: %s no consulta quotes", async (_label, options) => {
    const { db, touched } = fixture(options);
    expect(await listMyEstimates(db)).toEqual([]);
    expect(touched).not.toContain("quotes");
  });
  const invalid: [string, (row: Row) => Row][] = [
    ["revocado", row => ({ ...row, status: "revoked" })],
    ["invitado", row => ({ ...row, status: "invited" })],
    ["otra sesión", row => ({ ...row, auth_user_id: OTHER })],
    ["tenant incoherente", row => ({ ...row, tenant_id: OTHER })],
    ["id de cliente incoherente", row => ({ ...row, client_id: OTHER })],
    ["cliente retirado", row => ({ ...row, clients: { ...(row.clients as Row), deleted_at: "2026-09-02" } })],
    ["cliente ausente", row => ({ ...row, clients: null })],
    ["tenant vacío", row => ({ ...row, tenant_id: "", clients: { ...(row.clients as Row), tenant_id: "" } })],
    ["Shipping Mark vacío", row => ({ ...row, clients: { ...(row.clients as Row), markbox: " " } })],
    ["relación múltiple", row => ({ ...row, clients: [row.clients, row.clients] })],
  ];
  it.each(invalid)("rechaza %s sin consultar cotizaciones", async (_label, mutate) => {
    const { db, touched } = fixture({ membership: mutate(member()) });
    expect(await listMyEstimates(db)).toEqual([]);
    expect(touched).not.toContain("quotes");
  });
  it("rechaza varias membresías activas sin consultar cotizaciones", async () => {
    const { db, touched } = fixture({ memberships: [member(), member()] });
    expect(await listMyEstimates(db)).toEqual([]);
    expect(touched).not.toContain("quotes");
  });
  it("conserva las 100 cotizaciones más recientes dentro del ámbito", async () => {
    const own = Array.from({ length: 105 }, (_, i) => quote(String(i), {
      created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    }));
    const { db } = fixture({ quotes: [
      quote("foreign-newest", { tenant_id: OTHER, created_at: "2099-01-01" }),
      ...own,
    ] });
    const rows = await listMyEstimates(db);
    expect(rows.map(row => row.id)).toEqual(own.slice(5).reverse().map(row => row.id));
  });
  it("admite relación embebida de una sola fila sin ampliar ámbito", async () => {
    const m = member();
    const { db } = fixture({ membership: { ...m, clients: [m.clients] } });
    expect((await listMyEstimates(db)).map(r => r.id)).toEqual(["own"]);
  });
  it.each([
    ["propio", TENANT, MARK, "SHIP-SYNTHETIC"],
    ["otro tenant", OTHER, MARK, null],
    ["otro cliente", TENANT, "DTD-OTHER", null],
  ])("el código de envío queda ligado al mismo ámbito: %s", async (_label, tenant, mark, expected) => {
    const { db } = fixture({
      quotes: [quote("linked", { converted_to_shipment_id: "shipment" })],
      shipments: [{ id: "shipment", tenant_id: tenant, client_markbox: mark, code: "SHIP-SYNTHETIC", deleted_at: null }],
    });
    expect((await listMyEstimates(db))[0].convertedToShipmentCode).toBe(expected);
  });
  it("mantiene vacío ante error de lectura de quotes", async () => {
    const { db } = fixture({ queryError: "quotes" });
    expect(await listMyEstimates(db)).toEqual([]);
  });
  it("no consulta envíos cuando ninguna cotización tiene enlace", async () => {
    const { db, touched } = fixture();
    await listMyEstimates(db);
    expect(touched).not.toContain("shipments");
  });
});
