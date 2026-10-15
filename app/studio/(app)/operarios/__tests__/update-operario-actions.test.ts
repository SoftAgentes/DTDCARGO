// @vitest-environment node
/**
 * SDD-0529 · `updateOperarioAction`: editar un operario de China o de Venezuela.
 *
 * El candado NO se dobla: corre el `moduleEditDenial` real de
 * lib/studio/rbac-guard.ts sobre un doble de Supabase que aplica de verdad los
 * filtros (`.eq` y `.is`) y devuelve copias. Un doble que devolviera la fila
 * siempre dejaría pasar al usuario desactivado sin que nada fallara.
 *
 * Lo que se afirma:
 *  - admin y operations editan; los otros cinco roles, el usuario desactivado y
 *    la sesión vacía reciben la denegación y la RPC no se llama; un desvío de la
 *    matriz que da edición a commercial lo deja pasar;
 *  - la action manda a la base lo que eligió el usuario: el rol tal cual (los de
 *    Venezuela incluidos) y el almacén vacío como NULL; sin rol no llama a la
 *    base ni pone «operario» por su cuenta;
 *  - lo que la base rechaza vuelve al campo que toca, con su mensaje; lo demás,
 *    al aviso general; y sólo un guardado bueno revalida la página.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPERARIO_ID = "50000000-0000-4000-8000-000000000529";
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_TENANT = "10000000-0000-4000-8000-000000000002";
const USER_ID = "20000000-0000-4000-8000-000000000001";
const WAREHOUSE_ID = "30000000-0000-4000-8000-000000000001";
const DENIED = "No tienes permiso para realizar esta acción.";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn<(p: string) => void>(),
  sessionUserId: null as string | null,
  tables: { user_tenants: [] as Row[], studio_role_module_overrides: [] as Row[] } as Record<string, Row[]>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcError: null as { message: string; code?: string } | null,
  fromCalls: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => mocks.revalidatePath(p),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/** Doble de PostgREST: exige select() primero, aplica `.eq`/`.is` y devuelve copias. */
function query(table: string) {
  let selected = false;
  const filters: Array<(row: Row) => boolean> = [];
  const result = () => {
    if (!(table in mocks.tables)) throw new Error(`editar un operario no debe leer ${table}`);
    return mocks.tables[table].filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r }));
  };
  const builder = {
    select() {
      selected = true;
      return builder;
    },
    eq(col: string, value: unknown) {
      if (!selected) throw new Error(".eq() antes de .select()");
      filters.push((r) => r[col] === value);
      return builder;
    },
    is(col: string, value: null) {
      if (!selected) throw new Error(".is() antes de .select()");
      filters.push((r) => r[col] === value);
      return builder;
    },
    limit() {
      return builder;
    },
    async maybeSingle() {
      return { data: result()[0] ?? null, error: null };
    },
    returns() {
      return Promise.resolve({ data: result(), error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.sessionUserId ? { id: mocks.sessionUserId } : null },
        error: null,
      }),
    },
    from(table: string) {
      mocks.fromCalls.push(table);
      return query(table);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args: { ...args } });
      return { data: null, error: mocks.rpcError ? { ...mocks.rpcError } : null };
    },
  }),
}));

import { updateOperarioAction } from "../actions";

function membership(role: string, over: Partial<Row> = {}): Row {
  return { user_id: USER_ID, tenant_id: TENANT_ID, role, disabled_at: null, warehouse_scope: "all", ...over };
}

function form(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) fd.set(key, value);
  return fd;
}

/** Lo que manda el cajón para Luis Hernández, camionero de Venezuela, al pasarlo a bodeguero. */
const LUIS = { operario_id: OPERARIO_ID, display_name: "Luis Hernández", role: "bodeguero" };

beforeEach(() => {
  mocks.sessionUserId = USER_ID;
  mocks.tables.user_tenants = [
    membership("operations"),
    // Ruido que los filtros tienen que descartar: otro usuario y otra membresía.
    { user_id: "20000000-0000-4000-8000-000000000099", tenant_id: TENANT_ID, role: "admin", disabled_at: null, warehouse_scope: "all" },
  ];
  mocks.tables.studio_role_module_overrides = [];
  mocks.rpcCalls = [];
  mocks.rpcError = null;
  mocks.fromCalls = [];
  mocks.revalidatePath.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("updateOperarioAction · el candado de la matriz", () => {
  it.each(["admin", "operations"])("%s edita", async (role) => {
    mocks.tables.user_tenants[0] = membership(role);
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ ok: true });
    expect(mocks.rpcCalls).toHaveLength(1);
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith("/studio/operarios");
  });

  it.each(["commercial", "accounting", "warehouse", "support", "marketing"])(
    "%s recibe la denegación y la base no se toca", async (role) => {
      mocks.tables.user_tenants[0] = membership(role);
      expect(await updateOperarioAction({}, form(LUIS))).toEqual({ error: DENIED });
      expect(mocks.rpcCalls).toEqual([]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

  it("un operations desactivado no edita (el doble filtra disabled_at)", async () => {
    mocks.tables.user_tenants[0] = membership("operations", { disabled_at: "2026-10-01T00:00:00Z" });
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("sin sesión no edita, aunque haya membresías", async () => {
    mocks.sessionUserId = null;
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("commercial con el desvío que le da edición sí edita; con sólo vista, no", async () => {
    mocks.tables.user_tenants[0] = membership("commercial");
    mocks.tables.studio_role_module_overrides = [{ role: "commercial", module_id: "operarios", can_view: true, can_edit: true }];
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ ok: true });
    mocks.tables.studio_role_module_overrides = [{ role: "commercial", module_id: "operarios", can_view: true, can_edit: false }];
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("el doble no se toca: las filas de origen siguen iguales y sólo se leen la membresía y los desvíos", async () => {
    const before = structuredClone(mocks.tables);
    await updateOperarioAction({}, form(LUIS));
    expect(mocks.tables).toEqual(before);
    expect(mocks.fromCalls).toEqual(["user_tenants", "studio_role_module_overrides"]);
  });

  it("el tenant no sale del formulario: la action no manda ninguno y la base lo resuelve", async () => {
    mocks.tables.user_tenants[0] = membership("operations", { tenant_id: OTHER_TENANT });
    await updateOperarioAction({}, form({ ...LUIS, tenant_id: TENANT_ID }));
    expect(Object.keys(mocks.rpcCalls[0].args)).not.toContain("p_tenant_id");
  });
});

describe("updateOperarioAction · lo que va a la base", () => {
  it("un operario de Venezuela: su rol de despacho tal cual y el almacén NULL", async () => {
    expect(await updateOperarioAction({}, form({ ...LUIS, warehouse_id: "", display_name_cn: "" }))).toEqual({ ok: true });
    expect(mocks.rpcCalls).toEqual([{
      fn: "admin_update_operario",
      args: {
        p_operario_id: OPERARIO_ID,
        p_display_name: "Luis Hernández",
        p_display_name_cn: null,
        p_role: "bodeguero",
        p_warehouse_id: null,
      },
    }]);
  });

  it("sin el campo de almacén (el cajón de Venezuela no lo trae) también va NULL", async () => {
    await updateOperarioAction({}, form(LUIS));
    expect(mocks.rpcCalls[0].args.p_warehouse_id).toBeNull();
    expect(mocks.rpcCalls[0].args.p_display_name_cn).toBeNull();
  });

  it("un operario de China: su almacén y su nombre en chino, recortados", async () => {
    await updateOperarioAction({}, form({
      operario_id: OPERARIO_ID, display_name: "  Ana China ", display_name_cn: " 安娜 ",
      role: "supervisor", warehouse_id: ` ${WAREHOUSE_ID} `,
    }));
    expect(mocks.rpcCalls[0].args).toEqual({
      p_operario_id: OPERARIO_ID,
      p_display_name: "Ana China",
      p_display_name_cn: "安娜",
      p_role: "supervisor",
      p_warehouse_id: WAREHOUSE_ID,
    });
  });

  it("los cuatro roles viajan tal cual: la action no tiene lista, la base decide por la región", async () => {
    for (const role of ["operario", "supervisor", "bodeguero", "camionero"]) {
      await updateOperarioAction({}, form({ ...LUIS, role }));
    }
    expect(mocks.rpcCalls.map((c) => c.args.p_role)).toEqual(["operario", "supervisor", "bodeguero", "camionero"]);
  });

  it("sin rol no llama a la base ni pone «operario» por su cuenta", async () => {
    for (const role of [undefined, "", "   "]) {
      expect(await updateOperarioAction({}, form({ ...LUIS, role }))).toEqual({
        fieldErrors: { role: "Elige un rol de la lista." },
      });
    }
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sin nombre no llama a la base", async () => {
    expect(await updateOperarioAction({}, form({ ...LUIS, display_name: "  " }))).toEqual({
      fieldErrors: { display_name: "Escribe el nombre del operario." },
    });
    expect(await updateOperarioAction({}, form({ ...LUIS, display_name: " ", role: "" }))).toEqual({
      fieldErrors: { display_name: "Escribe el nombre del operario.", role: "Elige un rol de la lista." },
    });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("sin operario no llama a la base", async () => {
    expect(await updateOperarioAction({}, form({ ...LUIS, operario_id: "" }))).toEqual({ error: "Falta el operario." });
    expect(mocks.rpcCalls).toEqual([]);
  });
});

describe("updateOperarioAction · los rechazos de la base, a su campo", () => {
  it.each([
    ["P0012", "Ese rol no corresponde a la región del operario. Elige uno de la lista.", "role"],
    ["P0012", "Este operario entra con los modos bodeguero, camionero: su rol tiene que ser uno de ellos.", "role"],
    ["P0023", "Los operarios de Venezuela no llevan almacén: son de despacho.", "warehouse_id"],
    ["P0023", "Elige el almacén de China del operario.", "warehouse_id"],
    ["P0011", "Escribe el nombre del operario.", "display_name"],
    ["P0013", "Ya hay un operario con ese nombre en ese almacén.", "display_name"],
  ])("%s «%s» va a %s", async (code, message, field) => {
    mocks.rpcError = { code, message };
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ fieldErrors: { [field]: message } });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "No tienes permiso para realizar esta acción"],
    ["P0014", "Operario no encontrado"],
    ["PGRST202", "Could not find the function public.admin_update_operario"],
  ])("%s va al aviso general", async (code, message) => {
    mocks.rpcError = { code, message };
    expect(await updateOperarioAction({}, form(LUIS))).toEqual({ error: `No se pudo guardar: ${message}` });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
