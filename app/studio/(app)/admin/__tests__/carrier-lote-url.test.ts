// @vitest-environment node
/**
 * SDD-0539 · El cambio en lote ya no manda la selección en la URL.
 *
 * Antes, la cuenta previa y el UPDATE filtraban con `in.(id,…)`. PostgREST
 * lleva los filtros en la URL, y 300 uuids miden 11.709 bytes: un proxy nginx
 * corta en 8 KB y responde 414, así que el lote más grande no llegaba nunca.
 *
 * Estas pruebas usan el cliente REAL de supabase-js con un PostgREST en
 * memoria (`postgrest-offline.ts`) que mide cada petición y responde 414 por
 * encima de `LIMITE_URL`. Las ciudades salen del tarifario real sembrado
 * (0332), con sus slugs tal cual.
 *
 * CONTROL ROJO: con la acción de main, el lote de 300 cae en 414 y el de 169
 * manda los ids en la URL.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITE_URL, postgrestOffline, type Fila } from "./postgrest-offline";
import { MAX_BYTES_FILTRO_LOTE, MAX_LOTE } from "@/lib/studio/freight-carriers/types";

const USER = "11111111-1111-4111-8111-111111111111";
const TENANT = "33333333-3333-4333-8333-333333333333";
const BENITO = "44444444-4444-4444-8444-444444444444";
const OTRO = "55555555-5555-4555-8555-555555555555";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/studio/role-module-overrides-queries", () => ({
  getRoleModuleOverrides: async () => ({}),
}));

let db: ReturnType<typeof postgrestOffline>;
vi.mock("@/lib/db/server", () => ({ createClient: async () => db.client }));

const { bulkUpdateTariffPricesAction } = await import("../carrier-actions");

/** Las 169 rutas que la 0332 le sembró a Benito, con sus slugs reales. */
const SLUGS_0332 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0332_seed_tarifario_benito.sql"),
  "utf8",
)
  .split(/\r?\n/)
  .map((l) => l.match(/^ {2}\('([a-z0-9-]+)', \d+\.\d{2}, /)?.[1])
  .filter((s): s is string => s !== undefined);

const uuid = (n: number) => `66666666-6666-4666-8666-${String(n).padStart(12, "0")}`;

function sembrar(slugs: readonly string[], extra: Fila[] = []) {
  db = postgrestOffline(
    {
      user_tenants: [{ user_id: USER, tenant_id: TENANT, role: "admin", disabled_at: null }],
      carrier_tariffs: [
        ...slugs.map((city_slug, i) => ({
          id: uuid(i + 1),
          tenant_id: TENANT,
          carrier_id: BENITO,
          city_slug,
          cost_usd_cbm: 80,
          price_usd_cbm: 123.6,
          deleted_at: null,
        })),
        ...extra,
      ],
    },
    { usuario: USER, rls: { carrier_tariffs: (f) => f.tenant_id === TENANT } },
  );
}

function lote(ids: string[], campos: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set("carrierId", BENITO);
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  for (const id of ids) fd.append("ids", id);
  return fd;
}

const todas = () => db.store.carrier_tariffs.map((f) => f.id as string);
const tarifas = () => db.peticiones.filter((p) => p.tabla === "carrier_tariffs");
const update = () => tarifas().find((p) => p.method === "PATCH")!;

beforeEach(() => {
  revalidatePath.mockClear();
});

describe("el doble mide la URL y sabe disparar", () => {
  it("una lectura con 300 uuids en un in.(…) recibe el 414 del proxy", async () => {
    sembrar([]);
    const ids = Array.from({ length: 300 }, (_, i) => uuid(i + 1));
    const { error } = await db.client.from("carrier_tariffs").select("id").in("id", ids);

    expect(error?.message).toMatch(/414 Request-URI Too Large/);
    expect(db.peticiones[0].largo).toBeGreaterThan(LIMITE_URL);
  });

  it("aplica los filtros y rechaza un operador que no conoce", async () => {
    sembrar(["valencia", "merida"]);
    const { data } = await db.client
      .from("carrier_tariffs")
      .select("id")
      .in("city_slug", ["merida"])
      .eq("carrier_id", BENITO);
    expect(data).toEqual([{ id: uuid(2) }]);

    await expect(
      db.client.from("carrier_tariffs").select("id").ilike("city_slug", "m%"),
    ).resolves.toMatchObject({ error: { message: expect.stringMatching(/no soportado por el doble/) } });
  });
});

describe("bulkUpdateTariffPricesAction · la URL no crece con los ids (SDD-0539)", () => {
  it("el fixture son las 169 rutas sembradas por la 0332", () => {
    expect(SLUGS_0332).toHaveLength(169);
    expect(new Set(SLUGS_0332).size).toBe(169);
  });

  it("las 169 rutas de Benito elegidas a la vez: ningún id viaja en la URL", async () => {
    sembrar(SLUGS_0332);
    const ids = todas();

    const res = await bulkUpdateTariffPricesAction({}, lote(ids, { costUsdCbm: "90" }));

    expect(res).toEqual({ ok: true, updated: 169 });
    expect(db.store.carrier_tariffs.every((f) => f.cost_usd_cbm === 90)).toBe(true);
    const urls = tarifas().map((p) => p.params.map(([k, v]) => `${k}=${v}`).join("&"));
    for (const url of urls) for (const id of ids) expect(url).not.toContain(id);
    // La lectura no lleva lista: mide lo mismo con 1 o con 300 ciudades.
    expect(tarifas()[0]).toMatchObject({ method: "GET" });
    expect(tarifas()[0].largo).toBeLessThan(250);
    // El UPDATE filtra por ciudad, dentro del transportista y vivas.
    expect(update().params).toEqual(
      expect.arrayContaining([
        ["tenant_id", `eq.${TENANT}`],
        ["carrier_id", `eq.${BENITO}`],
        ["deleted_at", "is.null"],
        ["city_slug", `in.(${SLUGS_0332.join(",")})`],
      ]),
    );
    expect(update().params.map(([k]) => k)).not.toContain("id");
    expect(update().largo).toBeLessThan(2600);
  });

  it("sólo cambian las ciudades elegidas, aunque el filtro ya no use los ids", async () => {
    sembrar(SLUGS_0332);
    const elegidas = [uuid(5), uuid(80)];

    const res = await bulkUpdateTariffPricesAction({}, lote(elegidas, { priceUsdCbm: "140" }));

    expect(res).toEqual({ ok: true, updated: 2 });
    const cambiadas = db.store.carrier_tariffs.filter((f) => f.price_usd_cbm === 140).map((f) => f.id);
    expect(cambiadas).toEqual(elegidas);
    expect(update().params).toContainEqual(["city_slug", `in.(${SLUGS_0332[4]},${SLUGS_0332[79]})`]);
  });

  it(`el tope del lote (${MAX_LOTE} ciudades) cabe con slugs del largo real`, async () => {
    const slugs = Array.from({ length: MAX_LOTE }, (_, i) =>
      i < SLUGS_0332.length ? SLUGS_0332[i] : `${SLUGS_0332[i - SLUGS_0332.length]}-2`,
    );
    sembrar(slugs);

    const res = await bulkUpdateTariffPricesAction({}, lote(todas(), { priceUsdCbm: "130" }));

    expect(res).toEqual({ ok: true, updated: MAX_LOTE });
    expect(Math.max(...db.peticiones.map((p) => p.largo))).toBeLessThan(LIMITE_URL);
    expect(db.store.carrier_tariffs.every((f) => f.price_usd_cbm === 130)).toBe(true);
  });

  /** n slugs distintos de `largo` caracteres: el filtro mide 16 + n·(largo + 3) bytes. */
  const slugsDe = (n: number, largo: number) =>
    Array.from({ length: n }, (_, i) => `c${String(i).padStart(3, "0")}`.padEnd(largo, "x"));

  it(`un filtro de exactamente ${MAX_BYTES_FILTRO_LOTE} bytes se aplica`, async () => {
    // 187 × (29 + 3) + 16 = 6.000
    sembrar(slugsDe(187, 29));

    const res = await bulkUpdateTariffPricesAction({}, lote(todas(), { costUsdCbm: "90" }));

    expect(res).toEqual({ ok: true, updated: 187 });
    const filtro = update().params.find(([k]) => k === "city_slug")!;
    expect(new URLSearchParams([filtro]).toString()).toHaveLength(MAX_BYTES_FILTRO_LOTE);
    expect(update().largo).toBeLessThan(LIMITE_URL);
  });

  it("un byte más y no se escribe nada: todo o nada", async () => {
    const slugs = slugsDe(187, 29);
    slugs[0] += "y";
    sembrar(slugs);
    const antes = JSON.stringify(db.store.carrier_tariffs);

    const res = await bulkUpdateTariffPricesAction({}, lote(todas(), { costUsdCbm: "90" }));

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/Son demasiadas ciudades.*No se cambió ninguna/);
    expect(db.escrituras()).toEqual([]);
    expect(JSON.stringify(db.store.carrier_tariffs)).toBe(antes);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("con el cliente real, una ruta de otro transportista en la selección no deja cambiar ninguna", async () => {
    sembrar(SLUGS_0332.slice(0, 3), [
      {
        id: uuid(999),
        tenant_id: TENANT,
        carrier_id: OTRO,
        city_slug: SLUGS_0332[0],
        cost_usd_cbm: 60,
        price_usd_cbm: 90,
        deleted_at: null,
      },
    ]);

    const res = await bulkUpdateTariffPricesAction({}, lote([uuid(1), uuid(999)], { costUsdCbm: "1" }));

    expect(res.error).toMatch(/No se cambió ninguna/);
    expect(db.escrituras()).toEqual([]);
    expect(db.fila("carrier_tariffs", uuid(999))?.cost_usd_cbm).toBe(60);
  });
});
