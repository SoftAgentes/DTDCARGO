// @vitest-environment node
/**
 * SDD-0537 · Acciones del tarifario: editar, agregar y quitar rutas.
 *
 * El doble de PostgREST de este archivo APLICA los filtros también en las
 * escrituras: un `update().eq().is().select()` sólo toca —y sólo devuelve— las
 * filas que cumplen TODOS los filtros, y devuelve copias. Con el doble
 * compartido (`user-tenants-double.ts`), que ignora los filtros del UPDATE y
 * siempre devuelve la fila, no se puede distinguir una edición que guardó de
 * una que no tocó nada, que es justo el defecto que esta tarea corrige.
 *
 * El índice único parcial de 0330 (una tarifa viva por transportista y ciudad)
 * se simula en el INSERT para poder probar el 23505.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const OTRO_TENANT = "99999999-9999-4999-8999-999999999999";
const BENITO = "44444444-4444-4444-8444-444444444444";
const OTRO = "55555555-5555-4555-8555-555555555555";
const T_VALENCIA = "66666666-6666-4666-8666-000000000001";
const T_MERIDA = "66666666-6666-4666-8666-000000000002";
const T_OTRO = "66666666-6666-4666-8666-000000000003";
const T_QUITADA = "66666666-6666-4666-8666-000000000004";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

type Row = Record<string, unknown>;
type Filtro = { campo: string; op: "eq" | "is" | "in"; valor: unknown };
interface Escritura {
  tabla: string;
  op: "insert" | "update";
  fila: Row;
  filtros: Filtro[];
}

function cumple(fila: Row, filtros: Filtro[]): boolean {
  return filtros.every((f) =>
    f.op === "in"
      ? (f.valor as unknown[]).includes(fila[f.campo])
      : fila[f.campo] === f.valor,
  );
}

function doble(tablas: Record<string, Row[]>, opciones: { fallaUpdate?: string } = {}) {
  const escrituras: Escritura[] = [];
  const store: Record<string, Row[]> = Object.fromEntries(
    Object.entries(tablas).map(([k, filas]) => [k, filas.map((f) => ({ ...f }))]),
  );

  function from(tabla: string) {
    const filtros: Filtro[] = [];
    let patch: Row | null = null;
    let nueva: Row | null = null;
    let conSelect = false;

    const resolver = (): { data: unknown; error: { code?: string; message: string } | null } => {
      if (nueva) {
        if (tabla === "carrier_tariffs") {
          const choca = (store[tabla] ?? []).some(
            (f) =>
              f.deleted_at == null &&
              f.tenant_id === nueva!.tenant_id &&
              f.carrier_id === nueva!.carrier_id &&
              f.city_slug === nueva!.city_slug,
          );
          if (choca) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const conId = { id: `nueva-${escrituras.length}`, deleted_at: null, ...nueva };
        (store[tabla] ??= []).push(conId);
        return { data: conSelect ? [{ id: conId.id }] : null, error: null };
      }
      if (patch) {
        if (opciones.fallaUpdate) return { data: null, error: { message: opciones.fallaUpdate } };
        const tocadas = (store[tabla] ?? []).filter((f) => cumple(f, filtros));
        for (const f of tocadas) Object.assign(f, patch);
        return { data: conSelect ? tocadas.map((f) => ({ id: f.id })) : null, error: null };
      }
      return { data: (store[tabla] ?? []).filter((f) => cumple(f, filtros)).map((f) => ({ ...f })), error: null };
    };

    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => {
        conSelect = true;
        return b;
      },
      eq: (campo: string, valor: unknown) => {
        filtros.push({ campo, op: "eq", valor });
        return b;
      },
      is: (campo: string, valor: unknown) => {
        filtros.push({ campo, op: "is", valor });
        return b;
      },
      in: (campo: string, valor: unknown[]) => {
        filtros.push({ campo, op: "in", valor: [...valor] });
        return b;
      },
      neq: () => b,
      order: () => b,
      limit: () => b,
      update: (fila: Row) => {
        patch = { ...fila };
        escrituras.push({ tabla, op: "update", fila: { ...fila }, filtros });
        return b;
      },
      insert: (fila: Row) => {
        nueva = { ...fila };
        escrituras.push({ tabla, op: "insert", fila: { ...fila }, filtros });
        return b;
      },
      maybeSingle: async () => {
        const r = resolver();
        return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
      },
      then: (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve(resolver()).then(ok, ko),
    });
    return b;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    from,
  };
  return { client, escrituras, store };
}

let db: ReturnType<typeof doble>;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { saveTariffAction, deleteTariffAction, bulkUpdateTariffPricesAction } = await import(
  "../carrier-actions"
);

function tarifa(id: string, carrier: string, city: string, extra: Row = {}): Row {
  return {
    id,
    tenant_id: TENANT,
    carrier_id: carrier,
    city_slug: city,
    cost_usd_cbm: 80,
    price_usd_cbm: 123.6,
    deleted_at: null,
    ...extra,
  };
}

function sembrar(role = "admin", opciones: { fallaUpdate?: string } = {}) {
  db = doble(
    {
      user_tenants: [{ user_id: USER, tenant_id: TENANT, role, disabled_at: null }],
      calculator_cities: [
        { tenant_id: TENANT, slug: "valencia", deleted_at: null },
        { tenant_id: TENANT, slug: "merida", deleted_at: null },
        { tenant_id: TENANT, slug: "coro", deleted_at: null },
        { tenant_id: TENANT, slug: "borrada", deleted_at: "2026-10-01T00:00:00Z" },
        { tenant_id: OTRO_TENANT, slug: "ajena", deleted_at: null },
      ],
      carrier_tariffs: [
        tarifa(T_VALENCIA, BENITO, "valencia"),
        tarifa(T_MERIDA, BENITO, "merida"),
        tarifa(T_OTRO, OTRO, "valencia"),
        tarifa(T_QUITADA, BENITO, "coro", { deleted_at: "2026-10-01T00:00:00Z" }),
      ],
    },
    opciones,
  );
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const fila = (id: string) => db.store.carrier_tariffs.find((f) => f.id === id)!;

beforeEach(() => {
  revalidatePath.mockClear();
  sembrar();
});

describe("saveTariffAction · editar una ciudad", () => {
  it("guarda costo, venta, frecuencia y días de la fila exacta y refresca /tarifas", async () => {
    const res = await saveTariffAction(
      {},
      form({
        id: T_VALENCIA,
        carrierId: BENITO,
        citySlug: "valencia",
        costUsdCbm: "85",
        priceUsdCbm: "130,50",
        dispatchFrequencyDays: "15",
        departureFrequency: "cada 15 días · jueves",
      }),
    );

    expect(res).toEqual({ ok: true });
    expect(fila(T_VALENCIA)).toMatchObject({
      cost_usd_cbm: 85,
      price_usd_cbm: 130.5,
      dispatch_frequency_days: 15,
      departure_frequency: "cada 15 días · jueves",
    });
    // Las demás filas quedan intactas: el UPDATE va acotado al id.
    expect(fila(T_MERIDA)).toMatchObject({ cost_usd_cbm: 80, price_usd_cbm: 123.6 });
    expect(fila(T_OTRO)).toMatchObject({ cost_usd_cbm: 80, price_usd_cbm: 123.6 });
    expect(revalidatePath).toHaveBeenCalledWith("/tarifas");
    expect(revalidatePath).toHaveBeenCalledWith("/studio/admin");
  });

  it("la edición no cambia el transportista, la ciudad ni el tenant", async () => {
    await saveTariffAction(
      {},
      form({ id: T_VALENCIA, carrierId: BENITO, citySlug: "merida", costUsdCbm: "1", priceUsdCbm: "2" }),
    );

    const [w] = db.escrituras;
    expect(w.op).toBe("update");
    expect(w.fila).not.toHaveProperty("carrier_id");
    expect(w.fila).not.toHaveProperty("city_slug");
    expect(w.fila).not.toHaveProperty("tenant_id");
    expect(fila(T_VALENCIA).city_slug).toBe("valencia");
  });

  it("no guarda la venta como un múltiplo del costo: guarda los dos números tal cual", async () => {
    await saveTariffAction(
      {},
      form({ id: T_VALENCIA, carrierId: BENITO, citySlug: "valencia", costUsdCbm: "100", priceUsdCbm: "90" }),
    );
    expect(fila(T_VALENCIA)).toMatchObject({ cost_usd_cbm: 100, price_usd_cbm: 90 });
  });

  it.each([
    ["de otro transportista", T_OTRO],
    ["ya quitada", T_QUITADA],
    ["inexistente", "66666666-6666-4666-8666-0000000000ff"],
  ])("una tarifa %s devuelve error y no ok", async (_caso, id) => {
    const antes = JSON.stringify(db.store.carrier_tariffs);

    const res = await saveTariffAction(
      {},
      form({ id, carrierId: BENITO, citySlug: "valencia", costUsdCbm: "1", priceUsdCbm: "2" }),
    );

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/ya no está activa/);
    expect(JSON.stringify(db.store.carrier_tariffs)).toBe(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un error de la base se informa y no se anuncia éxito", async () => {
    sembrar("admin", { fallaUpdate: "permission denied" });
    const res = await saveTariffAction(
      {},
      form({ id: T_VALENCIA, carrierId: BENITO, citySlug: "valencia", costUsdCbm: "1", priceUsdCbm: "2" }),
    );
    expect(res).toEqual({ error: "No se pudo guardar la tarifa: permission denied" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("los errores del validador vuelven por campo y no escriben", async () => {
    const res = await saveTariffAction(
      {},
      form({ id: T_VALENCIA, carrierId: BENITO, citySlug: "valencia", costUsdCbm: "-1", priceUsdCbm: "" }),
    );
    expect(res.fieldErrors).toMatchObject({
      costUsdCbm: "No puede ser negativo.",
      priceUsdCbm: expect.stringMatching(/precio de venta/),
    });
    expect(db.escrituras).toEqual([]);
  });

  it("un rol que no es admin no escribe", async () => {
    sembrar("commercial");
    const res = await saveTariffAction(
      {},
      form({ id: T_VALENCIA, carrierId: BENITO, citySlug: "valencia", costUsdCbm: "1", priceUsdCbm: "2" }),
    );
    expect(res.error).toBe("Solo un administrador puede editar los transportistas.");
    expect(db.escrituras).toEqual([]);
  });
});

describe("saveTariffAction · agregar una ciudad", () => {
  it("agrega una ciudad viva del catálogo con el tenant del gate", async () => {
    // «coro» tuvo una tarifa quitada: volver a agregarla es válido.
    const res = await saveTariffAction(
      {},
      form({ carrierId: BENITO, citySlug: "coro", costUsdCbm: "80", priceUsdCbm: "176,57" }),
    );

    expect(res).toEqual({ ok: true });
    const insert = db.escrituras.find((w) => w.op === "insert")!;
    expect(insert.fila).toMatchObject({
      tenant_id: TENANT,
      carrier_id: BENITO,
      city_slug: "coro",
      cost_usd_cbm: 80,
      price_usd_cbm: 176.57,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarifas");
  });

  it.each([
    ["que no existe", "inventada"],
    ["borrada del catálogo", "borrada"],
    ["de otro tenant", "ajena"],
  ])("rechaza una ciudad %s sin insertar", async (_caso, slug) => {
    const res = await saveTariffAction(
      {},
      form({ carrierId: BENITO, citySlug: slug, costUsdCbm: "80", priceUsdCbm: "120" }),
    );
    expect(res.fieldErrors).toEqual({ citySlug: "Esa ciudad no está en el catálogo de la calculadora." });
    expect(db.escrituras).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("una ciudad que ya tiene tarifa viva con ese transportista devuelve el 23505 legible", async () => {
    const res = await saveTariffAction(
      {},
      form({ carrierId: BENITO, citySlug: "merida", costUsdCbm: "80", priceUsdCbm: "120" }),
    );
    expect(res.fieldErrors?.citySlug).toMatch(/Ya hay una tarifa viva/);
    expect(res.ok).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sin transportista no escribe", async () => {
    const res = await saveTariffAction({}, form({ citySlug: "coro", costUsdCbm: "80", priceUsdCbm: "120" }));
    expect(res.error).toBe("Falta el transportista.");
    expect(db.escrituras).toEqual([]);
  });
});

describe("deleteTariffAction · quitar una ruta", () => {
  it("borra en blando sólo la ruta indicada de ese transportista", async () => {
    const res = await deleteTariffAction({}, form({ id: T_VALENCIA, carrierId: BENITO }));

    expect(res).toEqual({ ok: true });
    expect(typeof fila(T_VALENCIA).deleted_at).toBe("string");
    expect(fila(T_MERIDA).deleted_at).toBeNull();
    expect(fila(T_OTRO).deleted_at).toBeNull();
    expect(db.escrituras.map((w) => w.op)).toEqual(["update"]);
    expect(revalidatePath).toHaveBeenCalledWith("/tarifas");
  });

  it.each([
    ["con el id de otro transportista", T_OTRO],
    ["ya quitada", T_QUITADA],
  ])("una ruta %s devuelve error y no ok", async (_caso, id) => {
    const antes = fila(id).deleted_at;
    const res = await deleteTariffAction({}, form({ id, carrierId: BENITO }));
    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/ya no está activa/);
    expect(fila(id).deleted_at).toBe(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exige el transportista", async () => {
    const res = await deleteTariffAction({}, form({ id: T_VALENCIA }));
    expect(res.error).toBe("Falta el transportista.");
    expect(db.escrituras).toEqual([]);
  });
});

describe("bulkUpdateTariffPricesAction · cambio en lote", () => {
  function lote(ids: string[], campos: Record<string, string>): FormData {
    const fd = form({ carrierId: BENITO, ...campos });
    for (const id of ids) fd.append("ids", id);
    return fd;
  }

  it("pone el mismo costo nuevo en todas las elegidas y deja la venta como estaba", async () => {
    const res = await bulkUpdateTariffPricesAction({}, lote([T_VALENCIA, T_MERIDA], { costUsdCbm: "90" }));

    expect(res).toEqual({ ok: true, updated: 2 });
    expect(fila(T_VALENCIA)).toMatchObject({ cost_usd_cbm: 90, price_usd_cbm: 123.6 });
    expect(fila(T_MERIDA)).toMatchObject({ cost_usd_cbm: 90, price_usd_cbm: 123.6 });
    expect(fila(T_OTRO)).toMatchObject({ cost_usd_cbm: 80 });
    const update = db.escrituras.find((w) => w.op === "update")!;
    expect(update.fila).toEqual({ cost_usd_cbm: 90 });
    expect(revalidatePath).toHaveBeenCalledWith("/tarifas");
  });

  it("con los dos valores escribe los dos tal cual, sin derivar uno del otro", async () => {
    const res = await bulkUpdateTariffPricesAction(
      {},
      lote([T_VALENCIA], { costUsdCbm: "95", priceUsdCbm: "140,25" }),
    );
    expect(res.ok).toBe(true);
    expect(fila(T_VALENCIA)).toMatchObject({ cost_usd_cbm: 95, price_usd_cbm: 140.25 });
  });

  it.each([
    ["una ruta de otro transportista", T_OTRO],
    ["una ruta ya quitada", T_QUITADA],
  ])("si la selección incluye %s no cambia ninguna", async (_caso, ajena) => {
    const antes = JSON.stringify(db.store.carrier_tariffs);
    const res = await bulkUpdateTariffPricesAction({}, lote([T_VALENCIA, ajena], { priceUsdCbm: "1" }));

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/No se cambió ninguna/);
    expect(JSON.stringify(db.store.carrier_tariffs)).toBe(antes);
    expect(db.escrituras).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each<[string, string[], Record<string, string>, RegExp]>([
    ["sin ningún valor", [T_VALENCIA], {}, /Escribe el costo nuevo, la venta nueva o los dos/],
    ["sin ciudades", [], { costUsdCbm: "90" }, /Selecciona al menos una ciudad/],
    ["con un id que no es uuid", ["no-es-uuid"], { costUsdCbm: "90" }, /La selección no es válida/],
  ])("rechaza un lote %s sin escribir", async (_caso, ids, campos, msg) => {
    const res = await bulkUpdateTariffPricesAction({}, lote(ids, campos));
    expect(res.error).toMatch(msg);
    expect(db.escrituras).toEqual([]);
  });

  it("los montos negativos o ilegibles vuelven por campo", async () => {
    const res = await bulkUpdateTariffPricesAction(
      {},
      lote([T_VALENCIA], { costUsdCbm: "-5", priceUsdCbm: "abc" }),
    );
    expect(res.fieldErrors).toEqual({
      costUsdCbm: "No puede ser negativo.",
      priceUsdCbm: "No es un monto válido.",
    });
    expect(db.escrituras).toEqual([]);
  });

  it("un rol que no es admin no cambia nada", async () => {
    sembrar("commercial");
    const res = await bulkUpdateTariffPricesAction({}, lote([T_VALENCIA], { costUsdCbm: "90" }));
    expect(res.error).toBe("Solo un administrador puede editar los transportistas.");
    expect(db.escrituras).toEqual([]);
  });

  it("un error de la base se informa y no se anuncia éxito", async () => {
    sembrar("admin", { fallaUpdate: "lock timeout" });
    const res = await bulkUpdateTariffPricesAction({}, lote([T_VALENCIA], { costUsdCbm: "90" }));
    expect(res).toEqual({ error: "No se pudieron cambiar los precios: lock timeout" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
