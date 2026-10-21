// @vitest-environment node
/**
 * SDD-0571 · PARIDAD: la RPC `congelar_tarifa_recepcion` (0496) clasifica una
 * fila del tarifario con la misma regla que `resolveRateForClient`
 * (lib/studio/price-books/price-book-queries.ts): propia → pactada → descuento
 * → casa, con el mismo precio y el mismo mínimo.
 *
 * Las dos corren sobre la MISMA base PGlite (esquema mínimo de la 0496 + la
 * 0496 real). `resolveRateForClient` recibe un adaptador que traduce sus
 * llamadas de supabase-js a SQL y lo ejecuta en esa base: filtra de verdad,
 * devuelve filas nuevas en cada consulta y falla ante cualquier método que no
 * conoce (un doble que no filtra no prueba el filtro).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveRateForClient } from "../../price-books/price-book-queries";
import { aplicarDescuento } from "../../price-books/price-book-types";
import type { Rate } from "../../rate-types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SCHEMA = readFileSync(resolve(ROOT, "supabase/tests/_0496_tarifa_congelada_schema.sql"), "utf8");
const FILE_0496 = readFileSync(resolve(ROOT, "supabase/migrations/0496_tarifa_congelada_por_embarque.sql"), "utf8");
const SLOW = 120_000;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const T = id(1);
const ADMIN = id(2);

const FIXTURE = `
insert into public.tenants (id, slug, display_name) values ('${T}', 't-0571', 'T 0571');
insert into auth.users (id) values ('${ADMIN}');
insert into public.user_tenants (user_id, tenant_id, role) values ('${ADMIN}', '${T}', 'admin');
insert into public.aliados (id, tenant_id, parent_aliado_id) values
  ('${id(10)}', '${T}', null), ('${id(11)}', '${T}', null), ('${id(12)}', '${T}', null),
  ('${id(13)}', '${T}', null), ('${id(14)}', '${T}', null), ('${id(15)}', '${T}', '${id(12)}');
insert into public.price_books (id, tenant_id, aliado_id, name, is_house, discount_pct, base_per_cbm) values
  ('${id(20)}', '${T}', null,        'Casa',        true,  null, null),
  ('${id(21)}', '${T}', '${id(10)}', 'Propia',      false, null, null),
  ('${id(22)}', '${T}', '${id(11)}', 'Pactada',     false, null, 700),
  ('${id(23)}', '${T}', '${id(12)}', 'Descuento',   false, 12.5, null),
  ('${id(24)}', '${T}', '${id(13)}', 'Descuento 7', false, 7,    null),
  ('${id(25)}', '${T}', '${id(14)}', 'Nada',        false, null, null);
insert into public.rates (id, tenant_id, service, destination, per_cbm, min_charge, valid_until, price_book_id) values
  ('${id(30)}', '${T}', 'puerta_a_puerta_DDP', 'Valencia', 850,    50,   null,         '${id(20)}'),
  ('${id(31)}', '${T}', 'puerta_a_puerta_DDP', 'Caracas',  333.33, null, '2099-01-01', '${id(20)}'),
  ('${id(32)}', '${T}', 'puerta_a_puerta_DDP', 'Valencia', 800,    40,   null,         '${id(21)}'),
  ('${id(33)}', '${T}', 'puerta_a_puerta_DDP', 'Valencia', 1,      0,    '2000-01-01', '${id(20)}');
insert into public.clients (id, tenant_id, markbox, name, aliado_id) values
  ('${id(40)}', '${T}', 'DTD-0040', 'Directo',          null),
  ('${id(41)}', '${T}', 'DTD-0041', 'Aliado propia',    '${id(10)}'),
  ('${id(42)}', '${T}', 'DTD-0042', 'Aliado pactado',   '${id(11)}'),
  ('${id(43)}', '${T}', 'DTD-0043', 'Aliado descuento', '${id(12)}'),
  ('${id(44)}', '${T}', 'DTD-0044', 'Aliado 7 %',       '${id(13)}'),
  ('${id(45)}', '${T}', 'DTD-0045', 'Aliado nada',      '${id(14)}'),
  ('${id(46)}', '${T}', 'DTD-0046', 'Subaliado',        '${id(15)}');
`;

type Filter = { sql: string; value?: unknown };

/**
 * supabase-js → SQL sobre PGlite, solo para lo que usa resolveRateForClient:
 * select, eq, is(null), ilike, or("col.gte.v,col.is.null"), order, limit,
 * maybeSingle y la RPC resolve_price_book. Cualquier otra cosa revienta.
 */
function adaptador(db: PGlite): SupabaseClient {
  const from = (table: string) => {
    const filters: Filter[] = [];
    let orderBy = "";
    let limit = "";
    const builder = {
      select: () => builder,
      eq: (col: string, value: unknown) => (filters.push({ sql: `${col} = ?`, value }), builder),
      is: (col: string, value: null) => {
        if (value !== null) throw new Error("is() solo con null");
        filters.push({ sql: `${col} is null` });
        return builder;
      },
      ilike: (col: string, value: string) => (filters.push({ sql: `${col} ilike ?`, value }), builder),
      or: (expr: string) => {
        const partes = expr.split(",").map((p) => {
          const [col, op, ...resto] = p.split(".");
          const v = resto.join(".");
          if (op === "gte") return { sql: `${col} >= ?`, value: v };
          if (op === "is" && v === "null") return { sql: `${col} is null` };
          throw new Error("or() no soportado: " + p);
        });
        const values = partes.filter((p) => "value" in p).map((p) => p.value);
        filters.push({ sql: "(" + partes.map((p) => p.sql).join(" or ") + ")", value: values });
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orderBy = ` order by ${col} ${opts?.ascending === false ? "desc" : "asc"}`;
        return builder;
      },
      limit: (n: number) => ((limit = ` limit ${Number(n)}`), builder),
      maybeSingle: async () => {
        const params: unknown[] = [];
        const where = filters.map((f) => {
          const vals = Array.isArray(f.value) ? f.value : f.value === undefined ? [] : [f.value];
          let sql = f.sql;
          for (const v of vals) {
            params.push(v);
            sql = sql.replace("?", `$${params.length}`);
          }
          return sql;
        });
        const sql = `select * from public.${table}${where.length ? " where " + where.join(" and ") : ""}${orderBy}${limit}`;
        const r = await db.query<Record<string, unknown>>(sql, params);
        if (r.rows.length > 1) return { data: null, error: { code: "PGRST116", message: "varias filas" } };
        const row = r.rows[0];
        if (!row) return { data: null, error: null };
        const copy: Record<string, unknown> = { ...row };
        for (const k of ["per_cbm", "min_charge", "flat_rate", "discount_pct", "base_per_cbm"]) {
          if (copy[k] != null) copy[k] = Number(copy[k]);
        }
        return { data: copy, error: null };
      },
    };
    return builder;
  };
  const rpc = async (fn: string, args: { p_client_id: string }) => {
    if (fn !== "resolve_price_book") throw new Error("rpc no soportada: " + fn);
    const r = await db.query<{ r: string | null }>("select public.resolve_price_book($1) as r", [args.p_client_id]);
    return { data: r.rows[0]?.r ?? null, error: null };
  };
  return new Proxy({ from, rpc } as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      throw new Error("adaptador: método no soportado " + String(prop));
    },
  }) as unknown as SupabaseClient;
}

let db: PGlite;
let receipt = 100;

/** Una recepción nueva del cliente y destino, congelada en vista previa con la fila dada. */
async function vistaPrevia(clientMarkbox: string, destination: string, rateId: string) {
  const r = await intentar(clientMarkbox, destination, rateId);
  if ("error" in r) throw new Error(r.error);
  return r.row;
}

/** Lo mismo, pero devuelve el error de la RPC en vez de lanzarlo. */
async function intentar(
  clientMarkbox: string,
  destination: string,
  rateId: string,
): Promise<{ row: Record<string, unknown> } | { error: string }> {
  const rid = id(receipt++);
  await db.query(
    `insert into public.warehouse_receipts_cn (id, tenant_id, receipt_code, client_markbox, total_cbm, destination_city)
     values ($1, $2, $3, $4, 1, $5)`,
    [rid, T, "WR-" + rid.slice(-4), clientMarkbox, destination],
  );
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ADMIN]);
  await db.exec("set role authenticated");
  try {
    const r = await db.query<Record<string, unknown>>(
      `select source, rate_origin, per_cbm::text as per_cbm, min_charge::text as min_charge
       from public.congelar_tarifa_recepcion($1, 'tarifario', $2, p_dry_run => true)`,
      [rid, rateId],
    );
    return { row: r.rows[0] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SCHEMA + "\n" + FILE_0496 + "\n" + FIXTURE);
}, SLOW);

afterAll(async () => {
  await db?.close();
});

describe("SDD-0571 · la RPC clasifica la fila como resolveRateForClient", () => {
  const CASOS: { client: string; markbox: string; destination: string; origen: string; per: number; min: number }[] = [
    { client: id(40), markbox: "DTD-0040", destination: "Valencia", origen: "casa", per: 850, min: 50 },
    { client: id(41), markbox: "DTD-0041", destination: "Valencia", origen: "propia", per: 800, min: 40 },
    { client: id(41), markbox: "DTD-0041", destination: "Caracas", origen: "casa", per: 333.33, min: 0 },
    { client: id(42), markbox: "DTD-0042", destination: "Valencia", origen: "pactada", per: 700, min: 50 },
    { client: id(43), markbox: "DTD-0043", destination: "Valencia", origen: "descuento", per: 743.75, min: 50 },
    { client: id(44), markbox: "DTD-0044", destination: "Caracas", origen: "descuento", per: 310, min: 0 },
    { client: id(45), markbox: "DTD-0045", destination: "Valencia", origen: "casa", per: 850, min: 50 },
    { client: id(46), markbox: "DTD-0046", destination: "Valencia", origen: "descuento", per: 743.75, min: 50 },
  ];

  for (const c of CASOS) {
    it(`${c.markbox} a ${c.destination}: ${c.origen}`, async () => {
      const ts = await resolveRateForClient(adaptador(db), {
        service: "puerta_a_puerta_DDP",
        destination: c.destination,
        clientId: c.client,
      });
      expect(ts).not.toBeNull();
      // El caso está bien armado: el resolver de la app da lo esperado.
      expect(ts!.origen).toBe(c.origen);
      expect(Number(ts!.rate.per_cbm)).toBeCloseTo(c.per, 2);
      // La vencida del 2000 no se elige: la búsqueda filtra por vigencia.
      expect(ts!.rateId).not.toBe(id(33));

      const sql = await vistaPrevia(c.markbox, c.destination, ts!.rateId);
      expect(sql.source).toBe(ts!.origen === "casa" ? "casa" : "lista");
      expect(sql.rate_origin).toBe(ts!.origen === "casa" ? null : ts!.origen);
      expect(Number(sql.per_cbm)).toBe(Number(ts!.rate.per_cbm));
      expect(Number(sql.min_charge)).toBe(Number(ts!.rate.min_charge ?? 0));
    }, SLOW);
  }

  // El rechazo también es paridad: una fila que resolveRateForClient nunca
  // elegiría para esa recepción, la base no la congela (revisión de seguridad 2).
  it("rechaza la casa cuando la lista del aliado tiene su tarifa para la ruta (el resolver elige la propia)", async () => {
    const ts = await resolveRateForClient(adaptador(db), {
      service: "puerta_a_puerta_DDP", destination: "Valencia", clientId: id(41),
    });
    expect(ts?.origen).toBe("propia");
    const r = await intentar("DTD-0041", "Valencia", id(30));
    expect(r).toEqual({ error: expect.stringContaining("TARIFA_FILA_NO_APLICA") });
  }, SLOW);

  it("rechaza una fila vencida (el resolver no la ve)", async () => {
    const r = await intentar("DTD-0040", "Valencia", id(33));
    expect(r).toEqual({ error: expect.stringContaining("TARIFA_FILA_VENCIDA") });
  }, SLOW);

  it("rechaza una fila de otro destino (el resolver busca por el de la recepción)", async () => {
    const ts = await resolveRateForClient(adaptador(db), {
      service: "puerta_a_puerta_DDP", destination: "Caracas", clientId: id(40),
    });
    expect(ts?.rateId).toBe(id(31));
    const r = await intentar("DTD-0040", "Caracas", id(30));
    expect(r).toEqual({ error: expect.stringContaining("TARIFA_FILA_OTRO_DESTINO") });
  }, SLOW);

  it("propiedad: el descuento redondea igual en la base y en la app (semilla fija)", async () => {
    let seed = 571;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 40; i++) {
      const per = Math.round((1 + rnd() * 1999) * 100) / 100;
      const pct = Math.round((0.01 + rnd() * 99.98) * 100) / 100;
      await db.query("update public.rates set per_cbm = $1 where id = $2", [per, id(30)]);
      await db.query("update public.price_books set discount_pct = $1 where id = $2", [pct, id(23)]);
      const app = aplicarDescuento({ per_cbm: per, flat_rate: null } as Rate, pct).per_cbm;
      const base = Math.round(per * (1 - pct / 100) * 100) / 100;
      if (base <= 0) continue; // un precio que redondea a 0 no se congela (lo prueba el contrato)
      const sql = await vistaPrevia("DTD-0043", "Valencia", id(30));
      expect({ per, pct, sql: Number(sql.per_cbm) }).toEqual({ per, pct, sql: app });
    }
  }, SLOW);
});
