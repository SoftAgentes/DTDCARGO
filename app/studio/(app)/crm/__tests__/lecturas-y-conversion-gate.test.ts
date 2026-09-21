/**
 * Gates de `searchKommoContactsAction`, `exportRecoverySmsCsvAction` y
 * `convertLeadToClientAction` (SDD-0497).
 *
 * Las tres corrían sin candado de rol. Las dos primeras venían en el encargo;
 * la conversión apareció al leer sus vecinas y es el mismo defecto, mutante, en
 * el mismo archivo.
 *
 * La RLS no compensaba ninguna: `"kommo_contacts tenant read"` (0082:174) y
 * `"clients by tenant"` (0456:203-204) son FOR SELECT `to authenticated` y sólo
 * comparan `tenant_id`, sin predicado de rol. La matriz reserva `kommo` a
 * `commercial` (+admin) y excluye a `support` A PROPÓSITO (rbac.ts: «support no
 * hereda su acceso»), así que el universo de contactos quedaba al alcance de
 * cualquier miembro autenticado.
 *
 * El caso del CSV es el más filoso y por eso tiene su propio bloque: no expone
 * una pantalla, produce un ARCHIVO con nombre y teléfono de hasta 5000 personas
 * —incluidos `interesado`s que nunca se registraron ni aceptaron política
 * alguna— destinado a un proveedor de SMS. Ver el análisis de minimización en
 * el docstring de la action y en la spec.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";

const TENANT = "tn-1";
const LEAD = 4242;
const DENIAL_VISTA = "No tienes permiso para ver esto.";
const DENIAL_EDICION = "No tienes permiso para realizar esta acción.";

const CONTACTOS = [
  { id: 1, name: "María Salazar", email: "m@ej.com", phone: "584141234567" },
];

const searchKommoContactsMock = vi.fn();
const convertLeadMock = vi.fn();
vi.mock("@/lib/studio/kommo-convert", () => ({
  searchKommoContacts: (...a: unknown[]) => searchKommoContactsMock(...a),
  convertLead: (...a: unknown[]) => convertLeadMock(...a),
  parseContactFields: vi.fn(),
}));

const getRecoveryUniverseMock = vi.fn();
const buildRecoverySmsCsvMock = vi.fn();
vi.mock("@/lib/studio/kommo-recovery", () => ({
  getRecoveryUniverse: (...a: unknown[]) => getRecoveryUniverseMock(...a),
  buildRecoverySmsCsv: (...a: unknown[]) => buildRecoverySmsCsvMock(...a),
  filterRecoveryRows: (rows: unknown[]) => rows,
  parseRecoveryFilters: () => ({}),
}));

const enqueueKommoMarkboxWritebackMock = vi.fn();
vi.mock("@/lib/studio/kommo-writeback", () => ({
  enqueueKommoMarkboxWriteback: (...a: unknown[]) =>
    enqueueKommoMarkboxWritebackMock(...a),
  enqueueKommoLeadOp: vi.fn(),
  buildNotePayload: vi.fn(),
  buildOwnerPatchPayload: vi.fn(),
  buildStagePatchPayload: vi.fn(),
  buildTagsPatchPayload: vi.fn(),
  buildTaskPayload: vi.fn(),
  normalizeStageMap: () => ({}),
}));

const createAdminClientMock = vi.fn(() => ({ client: "service_role" }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => createAdminClientMock() }));

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (u: string) => revalidatePathMock(u) }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn }));

let overrides: Record<string, { view: boolean; edit: boolean }> = {};
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => overrides,
}));

// ── Cliente de la sesión ──────────────────────────────────────
let sessionUser: { id: string } | null = null;
let role: StudioUserRole | null = null;
const sessionReads: string[] = [];

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
    from(table: string) {
      sessionReads.push(table);
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

const {
  searchKommoContactsAction,
  exportRecoverySmsCsvAction,
  convertLeadToClientAction,
} = await import("../actions");

beforeEach(() => {
  vi.clearAllMocks();
  sessionReads.length = 0;
  overrides = {};
  sessionUser = { id: "user-1" };
  role = "commercial";
  searchKommoContactsMock.mockResolvedValue(CONTACTOS);
  getRecoveryUniverseMock.mockResolvedValue({ rows: CONTACTOS });
  buildRecoverySmsCsvMock.mockReturnValue(
    "nombre,telefono,segmento,dias_inactivo,shipping_mark\nMaría Salazar,584141234567,interesado,120,",
  );
  convertLeadMock.mockResolvedValue({ ok: true, markbox: "DTD-0042", created: true });
});

/** `kommo` la reserva la matriz a `commercial` (+admin). `support` NO entra. */
const ROLES_SIN_CRM = STUDIO_USER_ROLES.filter(
  (r) => !["admin", "commercial"].includes(r),
);

describe("searchKommoContactsAction · lado negativo", () => {
  it.each(ROLES_SIN_CRM)("rol %s: no lee el espejo de contactos", async (r) => {
    role = r;

    const res = await searchKommoContactsAction("mar");

    expect(res).toEqual({ contacts: [], error: DENIAL_VISTA });
    expect(searchKommoContactsMock).not.toHaveBeenCalled();
  });

  it("sin sesión tampoco", async () => {
    sessionUser = null;
    role = null;

    const res = await searchKommoContactsAction("mar");

    expect(res.error).toBe(DENIAL_VISTA);
    expect(searchKommoContactsMock).not.toHaveBeenCalled();
  });

  it("devolver [] vacío NO alcanza: la denegación tiene que venir con motivo", async () => {
    role = "support";

    const res = await searchKommoContactsAction("mar");

    // Sin este assert, un `return { contacts: [] }` mudo pasaría el test de
    // arriba y la pantalla diría «sin resultados» en vez de «sin permiso».
    expect(res.error).toBeTruthy();
  });
});

describe("exportRecoverySmsCsvAction · lado negativo", () => {
  it.each(ROLES_SIN_CRM)(
    "rol %s: no se le arma el CSV ni se toca el universo",
    async (r) => {
      role = r;

      const res = await exportRecoverySmsCsvAction({});

      expect(res).toEqual({ error: DENIAL_VISTA });
      expect(res.csv).toBeUndefined();
      expect(getRecoveryUniverseMock).not.toHaveBeenCalled();
      expect(buildRecoverySmsCsvMock).not.toHaveBeenCalled();
    },
  );

  it("el universo NO se lee antes del candado: ni un teléfono sale de la base", async () => {
    role = "warehouse";

    await exportRecoverySmsCsvAction({});

    // Minimización (skill revisar-datos-ve, punto 2): el gate va ANTES de la
    // lectura, no después con un descarte. Si se moviera, este assert cae.
    expect(getRecoveryUniverseMock).not.toHaveBeenCalled();
    expect(sessionReads).toEqual(["user_tenants"]);
  });

  it("sin sesión tampoco se genera el archivo", async () => {
    sessionUser = null;
    role = null;

    expect(await exportRecoverySmsCsvAction({})).toEqual({ error: DENIAL_VISTA });
    expect(buildRecoverySmsCsvMock).not.toHaveBeenCalled();
  });
});

describe("convertLeadToClientAction · lado negativo", () => {
  it.each(ROLES_SIN_CRM)("rol %s: no convierte el lead en cliente", async (r) => {
    role = r;

    const res = await convertLeadToClientAction(LEAD);

    expect(res).toEqual({ error: DENIAL_EDICION });
    expect(convertLeadMock).not.toHaveBeenCalled();
    expect(enqueueKommoMarkboxWritebackMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("sin sesión tampoco convierte", async () => {
    sessionUser = null;
    role = null;

    expect(await convertLeadToClientAction(LEAD)).toEqual({ error: DENIAL_EDICION });
    expect(convertLeadMock).not.toHaveBeenCalled();
  });

  it("el motivo de una mutación no es el de una lectura", async () => {
    role = "operations";

    const mutacion = await convertLeadToClientAction(LEAD);
    const lectura = await searchKommoContactsAction("mar");

    expect(mutacion.error).toBe(DENIAL_EDICION);
    expect(lectura.error).toBe(DENIAL_VISTA);
    expect(mutacion.error).not.toBe(lectura.error);
  });
});

describe("crm · lado positivo", () => {
  it("commercial busca contactos", async () => {
    const res = await searchKommoContactsAction("mar");

    expect(res).toEqual({ contacts: CONTACTOS });
    expect(searchKommoContactsMock).toHaveBeenCalledWith(expect.anything(), "mar");
  });

  it("commercial exporta el CSV con su conteo", async () => {
    const res = await exportRecoverySmsCsvAction({});

    expect(res.error).toBeUndefined();
    expect(res.count).toBe(1);
    expect(res.csv).toContain("584141234567");
  });

  it("commercial convierte el lead y encola el write-back del markbox", async () => {
    const res = await convertLeadToClientAction(LEAD);

    expect(res).toEqual({ ok: true, markbox: "DTD-0042", created: true });
    expect(convertLeadMock).toHaveBeenCalledWith(expect.anything(), TENANT, LEAD, {});
    expect(enqueueKommoMarkboxWritebackMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/studio/crm");
  });

  it("admin también, en las tres", async () => {
    role = "admin";

    expect((await searchKommoContactsAction("mar")).error).toBeUndefined();
    expect((await exportRecoverySmsCsvAction({})).error).toBeUndefined();
    expect((await convertLeadToClientAction(LEAD)).error).toBeUndefined();
  });
});
