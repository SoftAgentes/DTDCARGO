// @vitest-environment node
/**
 * SDD-0622 · pestaña «Actividad» de la ficha: `listUserAccessActivityAction`.
 *
 * Desde la 0270 `authenticated` no tiene SELECT sobre `entity_audit_log`
 * (`0270_audit_governed_query_rbac.sql:588-591`), así que la lectura con la
 * sesión salía siempre vacía. Decisión del Director General (2026-11-14): leer
 * con el cliente de servicio, sin migración, con todos los candados en la
 * acción. Lo que defiende cada bloque:
 *
 *   1. ver `users` y ser admin del tenant antes de leer (un extra de `users`
 *      no alcanza: es solo de lectura y la acción pide admin);
 *   2. el tenant sale de la sesión y la persona destino tiene que ser miembro
 *      de ese tenant en `user_tenants`; si no, error y no se lee la bitácora;
 *   3. filtros fijos (`tenant_id`, `entity_type`, `entity_id`), columnas fijas
 *      y tope de filas.
 *
 * El doble del cliente de servicio HONRA los filtros `.eq()` (como el de
 * `user-tenants-double.ts`): si la acción olvida el filtro de tenant, los
 * eventos del otro tenant aparecen y la prueba «no trae eventos de otro tenant»
 * sale roja. Ese mutante se corrió a mano al escribir esta prueba (handoff de la
 * SDD-0622, vuelta W-509).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseDouble, type DoubleHandle } from "@/lib/studio/__tests__/user-tenants-double";

const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const ADMIN_B = "22222222-2222-4222-8222-222222222222";
const PERSONA_A = "33333333-3333-4333-8333-333333333333";
const PERSONA_B = "44444444-4444-4444-8444-444444444444";
const PERSONA_C = "55555555-5555-4555-8555-555555555555";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));
let grants: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/user-module-grants-queries", () => ({
  getMyModuleGrants: async () => grants,
}));
vi.mock("@/lib/studio/platform-admin", () => ({ isPlatformAdmin: async () => false }));
vi.mock("@/lib/studio/telegram/link-code", () => ({ generateTelegramLinkCode: () => "code" }));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));

type Row = Record<string, unknown>;

/** Membresías de los dos tenants (las lee el cliente de servicio). */
const MIEMBROS: Row[] = [
  { user_id: ADMIN_A, tenant_id: TENANT_A, role: "admin", disabled_at: null },
  { user_id: PERSONA_A, tenant_id: TENANT_A, role: "commercial", disabled_at: null },
  { user_id: ADMIN_B, tenant_id: TENANT_B, role: "admin", disabled_at: null },
  { user_id: PERSONA_B, tenant_id: TENANT_B, role: "commercial", disabled_at: null },
  { user_id: PERSONA_C, tenant_id: TENANT_A, role: "operations", disabled_at: null },
  // La misma persona también figura en B: sus eventos de B no deben verse desde A.
  { user_id: PERSONA_A, tenant_id: TENANT_B, role: "commercial", disabled_at: null },
];

/** Columnas de más que la bitácora tiene y la pestaña no pinta. */
const DE_MAS = { payload: { target_role: "commercial" }, correlation_id: "c-1", sensitivity: "internal", actor_type: "user" };

const BITACORA: Row[] = [
  {
    id: "ev-a1", tenant_id: TENANT_A, entity_type: "studio_user_module_grant", entity_id: PERSONA_A,
    event_type: "user_module_grant_created", reason: "Cubre el CRM durante una ausencia", actor_id: ADMIN_A,
    before_data: null, after_data: { module_id: "kommo", can_view: true, can_edit: true, expires_at: null },
    occurred_at: "2026-11-14T12:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-b1", tenant_id: TENANT_B, entity_type: "studio_user_module_grant", entity_id: PERSONA_A,
    event_type: "user_module_grant_created", reason: "Evento del otro tenant", actor_id: ADMIN_B,
    before_data: null, after_data: { module_id: "rates", can_view: true, can_edit: false, expires_at: null },
    occurred_at: "2026-11-14T13:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-c1", tenant_id: TENANT_A, entity_type: "studio_user_module_grant", entity_id: PERSONA_C,
    event_type: "user_module_grant_revoked", reason: "Ya no cubre el CRM", actor_id: ADMIN_A,
    before_data: { module_id: "kommo", can_view: true, can_edit: false, expires_at: null }, after_data: null,
    occurred_at: "2026-11-14T11:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-a-otro-tipo", tenant_id: TENANT_A, entity_type: "user", entity_id: PERSONA_A,
    event_type: "role_changed", reason: "Otro tipo de evento", actor_id: ADMIN_A,
    before_data: null, after_data: null, occurred_at: "2026-11-14T14:00:00Z", ...DE_MAS,
  },
];

interface Consulta {
  table: string;
  columns: string | null;
  filters: [string, unknown][];
  limit: number | null;
}

/** Doble del cliente de servicio: honra `.eq()`, proyecta el `select` y aplica `.limit()`. */
function adminDouble() {
  const consultas: Consulta[] = [];
  const tablas: Record<string, Row[]> = { user_tenants: MIEMBROS, entity_audit_log: BITACORA };
  function from(table: string) {
    const c: Consulta = { table, columns: null, filters: [], limit: null };
    consultas.push(c);
    const filas = () => {
      const cols = c.columns ? c.columns.split(",").map((s) => s.trim()) : null;
      const out = (tablas[table] ?? [])
        .filter((r) => c.filters.every(([k, v]) => r[k] === v))
        .map((r) => (cols ? Object.fromEntries(cols.map((k) => [k, r[k]])) : { ...r }));
      return c.limit === null ? out : out.slice(0, c.limit);
    };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: (cols: string) => ((c.columns = cols), b),
      eq: (k: string, v: unknown) => (c.filters.push([k, v]), b),
      order: () => b,
      limit: (n: number) => ((c.limit = n), b),
      maybeSingle: async () => ({ data: filas()[0] ?? null, error: null }),
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: filas(), error: null }).then(ok, ko),
    });
    return b;
  }
  return { client: { from }, consultas };
}

let sesion: DoubleHandle;
let admin: ReturnType<typeof adminDouble>;
vi.mock("@/lib/db/server", () => ({ createClient: async () => sesion.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin.client }));

const { listUserAccessActivityAction } = await import("../actions");

function comoUsuario(userId: string, tenantId: string, role: string) {
  sesion = supabaseDouble({
    userId,
    memberships: [{ user_id: userId, tenant_id: tenantId, role, disabled_at: null, warehouse_scope: "all" }],
  });
}

const leyoBitacora = () => admin.consultas.some((c) => c.table === "entity_audit_log");

beforeEach(() => {
  grants = {};
  admin = adminDouble();
});

describe("Actividad · candados antes de leer", () => {
  it("un no-admin no ve nada y no se lee la bitácora", async () => {
    comoUsuario(PERSONA_A, TENANT_A, "commercial");
    const res = await listUserAccessActivityAction(PERSONA_A);
    expect("error" in res).toBe(true);
    expect(leyoBitacora()).toBe(false);
    expect(admin.consultas).toEqual([]);
  });

  it("con un extra de `users` (solo ver) tampoco: hace falta el rol admin", async () => {
    comoUsuario(PERSONA_A, TENANT_A, "commercial");
    grants = { users: { view: true, edit: false } };
    const res = await listUserAccessActivityAction(PERSONA_B);
    expect("error" in res).toBe(true);
    expect(admin.consultas).toEqual([]);
  });

  it("un admin de otro tenant no ve nada de una persona que solo es de A", async () => {
    comoUsuario(ADMIN_B, TENANT_B, "admin");
    const res = await listUserAccessActivityAction(PERSONA_C);
    expect(res).toEqual({ error: "La persona no es parte de tu equipo." });
    expect(leyoBitacora()).toBe(false);
  });

  it("un admin de otro tenant, con una persona de los dos tenants, solo ve lo de su tenant", async () => {
    comoUsuario(ADMIN_B, TENANT_B, "admin");
    const res = await listUserAccessActivityAction(PERSONA_A);
    const ids = "events" in res ? res.events.map((e) => e.id) : null;
    expect(ids).toEqual(["ev-b1"]);
  });

  it("una persona destino de otro tenant da error y no se lee la bitácora", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const res = await listUserAccessActivityAction(PERSONA_B);
    expect(res).toEqual({ error: "La persona no es parte de tu equipo." });
    expect(leyoBitacora()).toBe(false);
  });

  it("el tenant de la comprobación de miembro es el de la sesión", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    await listUserAccessActivityAction(PERSONA_A);
    const miembro = admin.consultas.find((c) => c.table === "user_tenants");
    expect(miembro?.filters).toEqual([
      ["tenant_id", TENANT_A],
      ["user_id", PERSONA_A],
    ]);
  });
});

describe("Actividad · consulta con filtros fijos", () => {
  it("caso feliz: solo eventos de extras de esa persona en el tenant de la sesión, con las columnas esperadas", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const res = await listUserAccessActivityAction(PERSONA_A);
    expect(res).toEqual({
      ok: true,
      events: [
        {
          id: "ev-a1",
          event: "created",
          moduleId: "kommo",
          canEdit: true,
          reason: "Cubre el CRM durante una ausencia",
          actorId: ADMIN_A,
          occurredAt: "2026-11-14T12:00:00Z",
        },
      ],
    });
    const q = admin.consultas.find((c) => c.table === "entity_audit_log");
    expect(q?.columns).toBe("id, event_type, reason, actor_id, before_data, after_data, occurred_at");
    expect(q?.limit).toBe(50);
  });

  it("no trae eventos de otro tenant aunque sean de la misma persona (filtro de tenant)", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const res = await listUserAccessActivityAction(PERSONA_A);
    const ids = "events" in res ? res.events.map((e) => e.id) : [];
    expect(ids).not.toContain("ev-b1");
    const q = admin.consultas.find((c) => c.table === "entity_audit_log");
    expect(q?.filters).toEqual(
      expect.arrayContaining([
        ["tenant_id", TENANT_A],
        ["entity_type", "studio_user_module_grant"],
        ["entity_id", PERSONA_A],
      ]),
    );
  });
});
