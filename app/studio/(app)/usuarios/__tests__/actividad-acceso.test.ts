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
  // SDD-0635: cambios de rol y de almacén por D1 (entidad membership, con motivo).
  {
    id: "ev-a-rol", tenant_id: TENANT_A, entity_type: "membership", entity_id: PERSONA_A,
    event_type: "membership_role_changed", reason: "Pasa a llevar la cobranza", actor_id: ADMIN_A,
    before_data: { role: "operations" }, after_data: { role: "commercial" }, occurred_at: "2026-11-14T15:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-a-alm", tenant_id: TENANT_A, entity_type: "membership", entity_id: PERSONA_A,
    event_type: "membership_scope_changed", reason: "Atiende solo China", actor_id: ADMIN_A,
    before_data: { warehouse_scope: "all" }, after_data: { warehouse_scope: "cn" }, occurred_at: "2026-11-14T10:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-a-invit", tenant_id: TENANT_A, entity_type: "membership", entity_id: PERSONA_A,
    event_type: "membership_invitation_revoked", reason: "No es un cambio de esta persona", actor_id: ADMIN_A,
    before_data: null, after_data: { revoked: true }, occurred_at: "2026-11-14T16:00:00Z", ...DE_MAS,
  },
  {
    id: "ev-b-rol", tenant_id: TENANT_B, entity_type: "membership", entity_id: PERSONA_A,
    event_type: "membership_role_changed", reason: "Del otro tenant", actor_id: ADMIN_B,
    before_data: { role: "support" }, after_data: { role: "commercial" }, occurred_at: "2026-11-14T15:30:00Z", ...DE_MAS,
  },
];

/** `user_role_audit` (0201): suspensiones sin motivo; sus role_change repiten D1. */
const ROLE_AUDIT: Row[] = [
  { id: "ra-a-off", tenant_id: TENANT_A, target_user_id: PERSONA_A, action: "disable", actor_user_id: ADMIN_A, old_value: "commercial", new_value: "commercial", created_at: "2026-11-14T09:00:00Z" },
  { id: "ra-a-rol", tenant_id: TENANT_A, target_user_id: PERSONA_A, action: "role_change", actor_user_id: ADMIN_A, old_value: "operations", new_value: "commercial", created_at: "2026-11-14T15:00:00Z" },
  { id: "ra-b-on", tenant_id: TENANT_B, target_user_id: PERSONA_A, action: "enable", actor_user_id: ADMIN_B, old_value: null, new_value: null, created_at: "2026-11-14T09:30:00Z" },
];

interface Consulta {
  table: string;
  columns: string | null;
  filters: [string, unknown][];
  ins: [string, unknown[]][];
  limit: number | null;
}

/** Doble del cliente de servicio: honra `.eq()`, proyecta el `select` y aplica `.limit()`. */
function adminDouble() {
  const consultas: Consulta[] = [];
  const tablas: Record<string, Row[]> = { user_tenants: MIEMBROS, entity_audit_log: BITACORA, user_role_audit: ROLE_AUDIT };
  function from(table: string) {
    const c: Consulta = { table, columns: null, filters: [], ins: [], limit: null };
    consultas.push(c);
    const filas = () => {
      const cols = c.columns ? c.columns.split(",").map((s) => s.trim()) : null;
      const out = (tablas[table] ?? [])
        .filter((r) => c.filters.every(([k, v]) => r[k] === v))
        .filter((r) => c.ins.every(([k, vs]) => vs.includes(r[k])))
        .map((r) => (cols ? Object.fromEntries(cols.map((k) => [k, r[k]])) : { ...r }));
      return c.limit === null ? out : out.slice(0, c.limit);
    };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: (cols: string) => ((c.columns = cols), b),
      eq: (k: string, v: unknown) => (c.filters.push([k, v]), b),
      in: (k: string, vs: unknown[]) => (c.ins.push([k, vs]), b),
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
    expect(ids).toEqual(["ev-b-rol", "ev-b1", "ra-b-on"]);
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
  it("caso feliz: extras, rol, almacén y suspensión de esa persona en el tenant de la sesión, en orden", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const res = await listUserAccessActivityAction(PERSONA_A);
    expect(res).toEqual({
      ok: true,
      events: [
        {
          id: "ev-a-rol", kind: "rol", event: "role_changed", moduleId: null, canEdit: null,
          before: "operations", after: "commercial", reason: "Pasa a llevar la cobranza", actorId: ADMIN_A,
          occurredAt: "2026-11-14T15:00:00Z",
        },
        {
          id: "ev-a1", kind: "extra", event: "created", moduleId: "kommo", canEdit: true,
          before: null, after: null, reason: "Cubre el CRM durante una ausencia", actorId: ADMIN_A,
          occurredAt: "2026-11-14T12:00:00Z",
        },
        {
          id: "ev-a-alm", kind: "almacen", event: "scope_changed", moduleId: null, canEdit: null,
          before: "all", after: "cn", reason: "Atiende solo China", actorId: ADMIN_A,
          occurredAt: "2026-11-14T10:00:00Z",
        },
        {
          id: "ra-a-off", kind: "estado", event: "disabled", moduleId: null, canEdit: null,
          before: null, after: null, reason: null, actorId: ADMIN_A,
          occurredAt: "2026-11-14T09:00:00Z",
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

describe("Actividad · rol, almacén y estado (SDD-0635 §3.7)", () => {
  it("lee membership solo con los dos tipos de la persona y user_role_audit solo disable/enable, siempre del tenant", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    await listUserAccessActivityAction(PERSONA_A);
    const membresia = admin.consultas.find((c) => c.table === "entity_audit_log" && c.filters.some(([, v]) => v === "membership"));
    expect(membresia?.filters).toEqual([
      ["tenant_id", TENANT_A],
      ["entity_type", "membership"],
      ["entity_id", PERSONA_A],
    ]);
    expect(membresia?.ins).toEqual([["event_type", ["membership_role_changed", "membership_scope_changed"]]]);
    const estado = admin.consultas.find((c) => c.table === "user_role_audit");
    expect(estado?.filters).toEqual([
      ["tenant_id", TENANT_A],
      ["target_user_id", PERSONA_A],
    ]);
    expect(estado?.ins).toEqual([["action", ["disable", "enable"]]]);
    expect(estado?.columns).toBe("id, action, actor_user_id, created_at");
  });

  it("no mezcla la revocación de invitaciones, el role_change repetido ni lo del otro tenant", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const res = await listUserAccessActivityAction(PERSONA_A);
    const ids = "events" in res ? res.events.map((e) => e.id) : [];
    expect(ids.length).toBeGreaterThan(0);
    for (const fuera of ["ev-a-invit", "ra-a-rol", "ev-b-rol", "ra-b-on"]) expect(ids).not.toContain(fuera);
  });

  it("si una de las bitácoras falla, se dice en vez de mostrar media historia", async () => {
    comoUsuario(ADMIN_A, TENANT_A, "admin");
    const base = admin.client.from;
    const falla = { data: null, error: { message: "x" } };
    admin.client.from = ((t: string) => {
      if (t !== "user_role_audit") return base(t);
      const b: Record<string, unknown> = {};
      Object.assign(b, {
        select: () => b,
        eq: () => b,
        in: () => b,
        order: () => b,
        limit: () => b,
        then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(falla).then(ok, ko),
      });
      return b;
    }) as typeof base;
    const res = await listUserAccessActivityAction(PERSONA_A);
    expect(res).toEqual({ error: "No se pudo cargar la actividad. Intenta de nuevo." });
  });
});
