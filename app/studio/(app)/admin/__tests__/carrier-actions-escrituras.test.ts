// @vitest-environment node
/**
 * SDD-0539 · Las escrituras de `freight_carriers` ya no dicen `ok` sin guardar.
 *
 * `saveCarrierAction` editaba con `update().eq("id")` y respondía `ok` aunque
 * la RLS o un borrado previo dejaran cero filas. Es el defecto que la 0537
 * corrigió en las tarifas. Su segundo paso, `setDefaultCarrier`, tenía el mismo
 * defecto y uno peor: bajaba al transportista que cotiza la web ANTES de
 * comprobar que el nuevo existiera. Con un id borrado, la web se quedaba sin
 * transportista y la acción decía `ok`. `deleteCarrierAction` repetía el
 * patrón.
 *
 * Cliente REAL de supabase-js sobre el PostgREST en memoria
 * (`postgrest-offline.ts`): aplica los filtros en las escrituras, simula la RLS
 * de 0330 por tenant y el índice único de un predeterminado vivo por tenant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postgrestOffline, type Fila } from "./postgrest-offline";
import { PREDETERMINADO_NO_ENCONTRADO } from "@/lib/studio/freight-carriers/queries";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const OTRO_TENANT = "99999999-9999-4999-8999-999999999999";
const BENITO = "44444444-4444-4444-8444-444444444444";
const OTRO = "55555555-5555-4555-8555-555555555555";
const BORRADO = "77777777-7777-4777-8777-777777777777";
const AJENO = "88888888-8888-4888-8888-888888888888";
const NO_EXISTE = "44444444-4444-4444-8444-0000000000ff";

const NO_ENCONTRADO = "Ese transportista ya no está activo. Recarga la página y vuelve a intentarlo.";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

let db: ReturnType<typeof postgrestOffline>;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { saveCarrierAction, setDefaultCarrierAction, deleteCarrierAction } = await import(
  "../carrier-actions"
);

function transportista(id: string, tenant: string, extra: Fila = {}): Fila {
  return {
    id,
    tenant_id: tenant,
    name: `T-${id.slice(0, 4)}`,
    legal_name: null,
    tax_id: null,
    contact: null,
    notes: null,
    is_default: false,
    active: true,
    deleted_at: null,
    ...extra,
  };
}

/** Un solo predeterminado vivo por tenant (`freight_carriers_one_default_per_tenant`). */
function unPredeterminado(store: Record<string, Fila[]>): string | null {
  const vivos = (store.freight_carriers ?? []).filter((f) => f.is_default && f.deleted_at == null);
  const tenants = vivos.map((f) => f.tenant_id);
  return new Set(tenants).size === tenants.length
    ? null
    : 'duplicate key value violates unique constraint "freight_carriers_one_default_per_tenant"';
}

type Siembra = {
  role?: string;
  trasLeer?: (s: Record<string, Fila[]>) => void;
  insertDevuelve?: "filas" | "vacio";
  falla?: { tabla: string; method: "GET" | "PATCH" | "POST"; mensaje: string };
};

function sembrar(opciones: Siembra = {}) {
  db = postgrestOffline(
    {
      user_tenants: [{ user_id: USER, tenant_id: TENANT, role: opciones.role ?? "admin", disabled_at: null }],
      freight_carriers: [
        transportista(BENITO, TENANT, { name: "Benito", is_default: true }),
        transportista(OTRO, TENANT, { name: "Otro" }),
        transportista(BORRADO, TENANT, { name: "Borrado", deleted_at: "2026-10-01T00:00:00Z" }),
        transportista(AJENO, OTRO_TENANT, { name: "Ajeno", is_default: true }),
      ],
    },
    {
      usuario: USER,
      // RLS de 0330: el admin sólo ve y escribe filas de su tenant.
      rls: { freight_carriers: (f) => f.tenant_id === TENANT },
      restricciones: unPredeterminado,
      insertDevuelve: opciones.insertDevuelve,
      falla: opciones.falla,
      trasLeer: opciones.trasLeer
        ? { tabla: "freight_carriers", hacer: opciones.trasLeer }
        : undefined,
    },
  );
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const carrier = (id: string) => db.fila("freight_carriers", id)!;
const foto = () => JSON.stringify(db.store.freight_carriers);
const predeterminados = () =>
  db.store.freight_carriers
    .filter((f) => f.tenant_id === TENANT && f.is_default && f.deleted_at == null)
    .map((f) => f.id);

beforeEach(() => {
  revalidatePath.mockClear();
  sembrar();
});

describe("saveCarrierAction · editar", () => {
  it("guarda los datos de la fila exacta, acotada a tenant y viva, sin reescribir el tenant", async () => {
    const res = await saveCarrierAction(
      {},
      form({ id: OTRO, name: "Otro Express", contact: "0414-0000000", notes: "Sólo de lunes a jueves" }),
    );

    expect(res).toEqual({ ok: true });
    expect(carrier(OTRO)).toMatchObject({ name: "Otro Express", contact: "0414-0000000" });
    expect(carrier(BENITO).name).toBe("Benito");
    const [w] = db.escrituras();
    expect(w.method).toBe("PATCH");
    expect(w.body).not.toHaveProperty("tenant_id");
    expect(w.body).not.toHaveProperty("is_default");
    expect(w.params).toEqual(
      expect.arrayContaining([
        ["id", `eq.${OTRO}`],
        ["tenant_id", `eq.${TENANT}`],
        ["deleted_at", "is.null"],
      ]),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/tarifas");
  });

  it.each([
    ["ya borrado", BORRADO],
    ["de otro tenant (la RLS no lo deja tocar)", AJENO],
    ["inexistente", NO_EXISTE],
  ])("un transportista %s devuelve error y no ok", async (_caso, id) => {
    const antes = foto();

    const res = await saveCarrierAction({}, form({ id, name: "Cambiado" }));

    expect(res).toEqual({ error: NO_ENCONTRADO });
    expect(foto()).toBe(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("si lo pidieron como el que cotiza la web, lo marca y baja al anterior", async () => {
    const res = await saveCarrierAction({}, form({ id: OTRO, name: "Otro", isDefault: "on" }));

    expect(res).toEqual({ ok: true });
    expect(predeterminados()).toEqual([OTRO]);
  });

  it("un borrado con isDefault no toca al que cotiza la web", async () => {
    const res = await saveCarrierAction({}, form({ id: BORRADO, name: "Borrado", isDefault: "on" }));

    expect(res).toEqual({ error: NO_ENCONTRADO });
    expect(predeterminados()).toEqual([BENITO]);
  });
});

describe("saveCarrierAction · alta", () => {
  it("da de alta con el tenant del gate", async () => {
    const res = await saveCarrierAction({}, form({ name: "Nuevo" }));

    expect(res).toEqual({ ok: true });
    const [w] = db.escrituras();
    expect(w).toMatchObject({ method: "POST", body: { tenant_id: TENANT, name: "Nuevo" } });
  });

  it("si el alta no devuelve la fila, no responde ok ni toca al que cotiza la web", async () => {
    sembrar({ insertDevuelve: "vacio" });

    const res = await saveCarrierAction({}, form({ name: "Nuevo", isDefault: "on" }));

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/no se pudo marcar como el que cotiza la web/);
    expect(predeterminados()).toEqual([BENITO]);
    expect(db.escrituras().map((w) => w.method)).toEqual(["POST"]);
  });
});

describe("setDefaultCarrierAction · cambiar el que cotiza la web", () => {
  it("marca el nuevo y baja al anterior", async () => {
    const res = await setDefaultCarrierAction({}, form({ id: OTRO }));

    expect(res).toEqual({ ok: true });
    expect(predeterminados()).toEqual([OTRO]);
    expect(carrier(AJENO).is_default).toBe(true);
  });

  it.each([
    ["ya borrado", BORRADO],
    ["de otro tenant", AJENO],
    ["inexistente", NO_EXISTE],
  ])("con uno %s no baja al que cotiza la web y devuelve error", async (_caso, id) => {
    const antes = foto();

    const res = await setDefaultCarrierAction({}, form({ id }));

    expect(res).toEqual({ error: PREDETERMINADO_NO_ENCONTRADO });
    expect(predeterminados()).toEqual([BENITO]);
    expect(foto()).toBe(antes);
    expect(db.escrituras()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("si lo borran entre la comprobación y el UPDATE, no responde ok", async () => {
    sembrar({
      trasLeer: (store) =>
        Object.assign(store.freight_carriers.find((f) => f.id === OTRO)!, {
          deleted_at: "2026-10-16T08:00:00Z",
        }),
    });

    const res = await setDefaultCarrierAction({}, form({ id: OTRO }));

    expect(res).toEqual({ error: PREDETERMINADO_NO_ENCONTRADO });
    expect(carrier(OTRO).is_default).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("si no se puede leer el transportista, lo dice y no baja a nadie", async () => {
    sembrar({ falla: { tabla: "freight_carriers", method: "GET", mensaje: "statement timeout" } });

    const res = await setDefaultCarrierAction({}, form({ id: OTRO }));

    expect(res).toEqual({ error: "No se pudo comprobar el transportista: statement timeout" });
    expect(predeterminados()).toEqual([BENITO]);
    expect(db.escrituras()).toEqual([]);
  });

  it("volver a marcar al que ya cotiza es ok y no cambia nada", async () => {
    const res = await setDefaultCarrierAction({}, form({ id: BENITO }));

    expect(res).toEqual({ ok: true });
    expect(predeterminados()).toEqual([BENITO]);
  });
});

describe("deleteCarrierAction · quitar un transportista", () => {
  it("borra en blando sólo ese y, si cotizaba la web, deja de hacerlo", async () => {
    const res = await deleteCarrierAction({}, form({ id: BENITO }));

    expect(res).toEqual({ ok: true });
    expect(typeof carrier(BENITO).deleted_at).toBe("string");
    expect(carrier(BENITO).is_default).toBe(false);
    expect(carrier(OTRO).deleted_at).toBeNull();
    expect(db.escrituras()[0].params).toEqual(
      expect.arrayContaining([
        ["tenant_id", `eq.${TENANT}`],
        ["deleted_at", "is.null"],
      ]),
    );
  });

  it.each([
    ["ya borrado", BORRADO],
    ["de otro tenant", AJENO],
    ["inexistente", NO_EXISTE],
  ])("uno %s devuelve error y no ok", async (_caso, id) => {
    const antes = foto();

    const res = await deleteCarrierAction({}, form({ id }));

    expect(res).toEqual({ error: NO_ENCONTRADO });
    expect(foto()).toBe(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("el gate sigue primero", () => {
  it.each([
    ["saveCarrierAction", () => saveCarrierAction({}, form({ id: OTRO, name: "X" }))],
    ["setDefaultCarrierAction", () => setDefaultCarrierAction({}, form({ id: OTRO }))],
    ["deleteCarrierAction", () => deleteCarrierAction({}, form({ id: OTRO }))],
  ])("%s con un rol que no es admin no escribe", async (_nombre, invocar) => {
    sembrar({ role: "commercial" });

    const res = await invocar();

    expect(res.error).toBe("Solo un administrador puede editar los transportistas.");
    expect(db.escrituras()).toEqual([]);
  });
});
