/**
 * Gate de EDICIÓN de `seedTenantCitiesFromVeCatalogAction` (SDD-0497).
 *
 * Era la única de las ocho acciones de `admin/rutas/actions.ts` sin
 * `moduleEditDenial`, y MUTA. La RPC no compensa por rol: la definición viva de
 * `seed_tenant_cities_from_ve_catalog` (0200:304-334, que redefine la de
 * 0024:601) es SECURITY DEFINER —la RLS de `dispatch_city_catalog` ni se
 * evalúa— y sólo exige membresía ACTIVA en el tenant. El sweep que la tocó fue
 * la 0209, que le revocó EXECUTE a `public` y `anon` pero se lo CONSERVÓ a
 * `authenticated` (0209:112-113), que es el rol de cualquiera con sesión.
 *
 * Gravedad baja (catálogo público de ciudades, idempotente, sin PII) pero el
 * candado faltaba. Y su denegación tampoco se veía: `RoutesClient` sólo pintaba
 * `seedState.ok`, así que un fallo dejaba el botón mudo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const DENIAL = "No tienes permiso para realizar esta acción.";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
/** Cada RPC que llegó a salir: la prueba de si el seed corrió. */
const rpcCalls: { fn: string; args: unknown }[] = [];
let rpcError: { message: string } | null = null;
let rpcInserted = 98;

type Query = {
  select: () => Query;
  eq: () => Query;
  is: () => Query;
  limit: () => Query;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};

function sessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: rpcError ? null : rpcInserted, error: rpcError };
    },
    from(table: string) {
      const row =
        table === "user_tenants" && role ? { tenant_id: TENANT, role } : null;
      const query: Query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return query;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => sessionClient() }));

const { seedTenantCitiesFromVeCatalogAction } = await import("../actions");

const correr = () => seedTenantCitiesFromVeCatalogAction({}, new FormData());

beforeEach(() => {
  vi.clearAllMocks();
  rpcCalls.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "operations";
  rpcError = null;
  rpcInserted = 98;
});

/** `admin-rutas` la reserva la matriz a `operations` (+admin). */
const ROLES_SIN_RUTAS = STUDIO_USER_ROLES.filter(
  (r) => !["admin", "operations"].includes(r),
);

describe("seedTenantCitiesFromVeCatalogAction · lado negativo", () => {
  it.each(ROLES_SIN_RUTAS)("rol %s: no corre la RPC y recibe el motivo", async (r) => {
    role = r;

    const res = await correr();

    expect(res).toEqual({ error: DENIAL });
    expect(rpcCalls).toHaveLength(0);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("sin sesión tampoco corre", async () => {
    sessionUser = null;
    role = null;

    expect(await correr()).toEqual({ error: DENIAL });
    expect(rpcCalls).toHaveLength(0);
  });

  it("si la RPC falla, el motivo llega distinto del de permiso", async () => {
    rpcError = { message: "No autorizado para tenant" };

    const res = await correr();

    expect(res.error).toContain("No se pudo seedear");
    expect(res.error).not.toBe(DENIAL);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("seedTenantCitiesFromVeCatalogAction · lado positivo", () => {
  it("operations siembra el catálogo y ve cuántas entraron", async () => {
    const res = await correr();

    expect(res).toEqual({ ok: true, createdCode: "98 ciudades agregadas" });
    expect(rpcCalls).toEqual([
      { fn: "seed_tenant_cities_from_ve_catalog", args: { p_tenant_id: TENANT } },
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/admin/rutas");
  });

  it("idempotente: si ya estaban, lo dice sin fingir que agregó", async () => {
    rpcInserted = 0;

    const res = await correr();

    expect(res).toEqual({ ok: true, createdCode: "Catálogo ya estaba sincronizado" });
  });

  it("admin también", async () => {
    role = "admin";

    expect((await correr()).ok).toBe(true);
    expect(rpcCalls).toHaveLength(1);
  });
});
