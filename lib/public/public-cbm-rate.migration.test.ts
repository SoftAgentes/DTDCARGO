// @vitest-environment node
/**
 * SDD-0476 · La migración 0458 corrida de verdad sobre PostgreSQL embebido.
 *
 * POR QUÉ ESTE TEST Y NO UNO DE MOCKS: lo que cambia acá es un WHERE de SQL. Un
 * doble de `supabase.rpc()` afirmaría lo que yo escriba en el doble, no lo que
 * hace la base. PGlite (dependencia del repo desde SDD-0473) corre el archivo
 * `.sql` REAL —el mismo texto que el runbook aplicará a producción— contra un
 * Postgres desechable.
 *
 * La disposición de datos NO es la feliz: reproduce lo que hay en producción
 * hoy (verificado 2026-09-17), incluidas las DOS filas DDP públicas con
 * `per_cbm` en NULL que el índice único tolera y que la RPC tiene que seguir
 * descartando.
 *
 * Y hay CONTROL ROJO: el caso central se corre primero contra el cuerpo real de
 * la migración 0255 (el que corre hoy en producción) para comprobar que ahí
 * devuelve cero filas. Sin ese control, un verde no demostraría que el test
 * ejercita el defecto.
 *
 * Las fechas son RELATIVAS a `current_date` dentro de SQL: un fixture con
 * fechas escritas a mano se pondría rojo solo con que pase el calendario.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";

const migration = (name: string) =>
  readFileSync(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8");

/** Extrae el cuerpo `create or replace function …$$;` de una migración real. */
function fn(sql: string, name: string) {
  const start = sql.indexOf("create or replace function public." + name);
  if (start < 0) throw new Error("Falta la función real " + name);
  const end = sql.indexOf("$$;", sql.indexOf("as $$", start));
  return sql.slice(start, end + 3);
}

const FILE_0458 = migration("0458_tarifa_lectura_sin_vigencia.sql");
const RPC_0458 = fn(FILE_0458, "public_cbm_rate");
/** El cuerpo que HOY corre en producción: filtra por vigencia. */
const RPC_0255 = fn(migration("0255_rates_public_calc_modo.sql"), "public_cbm_rate");

type RateRow = { per_cbm: string | null; min_charge: string | null; valid_until: string | null };

let db: PGlite;

/** Llama la RPC igual que `lib/public/rates-queries.ts`: sin argumentos = ddp. */
async function rpc(modo?: string): Promise<RateRow[]> {
  // `::text` a propósito: numeric y date llegarían como objetos del driver y la
  // aserción mediría el driver, no la migración.
  const select = "select per_cbm::text, min_charge::text, valid_until::text from public.public_cbm_rate";
  const r =
    modo === undefined
      ? await db.query<RateRow>(`${select}()`)
      : await db.query<RateRow>(`${select}($1)`, [modo]);
  return r.rows;
}

/** Resuelve una expresión de fecha SQL a texto, para comparar sin adivinar. */
async function fecha(expr: string): Promise<string> {
  const r = await db.query<{ d: string }>(`select (${expr})::text as d`);
  return r.rows[0].d;
}

/**
 * La fila pública DDP con precio. `from`/`until` son EXPRESIONES SQL de fecha
 * (`current_date - 1`, `null`, …), no literales.
 */
function ddp(opts: { perCbm?: number; from?: string; until?: string; status?: string } = {}) {
  const { perCbm = 850, from = "current_date - 14", until = "null", status = "published" } = opts;
  return db.query(
    `insert into public.rates (tenant_id, per_cbm, min_charge, is_public, public_calc_modo, status, valid_from, valid_until)
     select id, $1, 50.00, true, 'ddp', $2, (${from})::date, (${until})::date
     from public.tenants where slug = 'dtd'`,
    [perCbm, status],
  );
}

/** Una fila pública DDP SIN precio: las dos que existen hoy en producción. */
function ddpSinPrecio() {
  return db.query(
    `insert into public.rates (tenant_id, per_cbm, is_public, public_calc_modo, status, valid_from, valid_until)
     select id, null, true, 'ddp', 'published', current_date - 116, current_date + 105
     from public.tenants where slug = 'dtd'`,
  );
}

beforeAll(async () => {
  db = new PGlite();
  // Roles de Supabase: la migración les revoca/otorga EXECUTE. `tercero` es un
  // rol sin ningún grant: si PUBLIC conservara EXECUTE, lo vería a través suyo.
  await db.exec(`create role anon; create role authenticated; create role tercero;
    create table public.tenants (id uuid primary key default gen_random_uuid(), slug text unique not null);
    create table public.rates (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references public.tenants(id),
      per_cbm numeric(10,2), min_charge numeric(10,2),
      valid_from date, valid_until date,
      is_public boolean not null default false,
      status text not null default 'published',
      public_calc_modo text not null default 'ddp',
      updated_at timestamptz not null default now(),
      deleted_at timestamptz);
    insert into public.tenants (slug) values ('dtd');`);
  // El índice REAL de 0255: es la invariante en la que se apoya el diseño.
  await db.exec(`create unique index rates_one_public_cbm_per_tenant_modo
    on public.rates (tenant_id, public_calc_modo)
    where is_public and deleted_at is null and per_cbm is not null;`);
  // El archivo ENTERO, no sólo el cuerpo: así se ejercitan también el comment,
  // el revoke y los grants tal como los va a correr el runbook.
  await db.exec(FILE_0458);
}, 60000);

beforeEach(async () => {
  await db.exec("delete from public.rates;");
  // Restaura el cuerpo de 0458 (el control rojo instala el de 0255).
  // `create or replace` conserva la ACL que dejó el archivo completo.
  await db.exec(RPC_0458);
});

afterAll(async () => {
  await db?.close();
});

describe("0458 · la tarifa pública se lee de la base, vencida o no", () => {
  it("CONTROL ROJO: con el cuerpo de 0255 (el de producción) una tarifa vencida devuelve CERO filas", async () => {
    await db.exec(RPC_0255);
    await ddp({ until: "current_date - 1" }); // venció ayer
    expect(await rpc()).toHaveLength(0);
    // Ahí está el bug entero: el sitio se queda sin precio de la base y
    // `lib/public/rates-queries.ts` devuelve null → CONFIG.tarifaBaseCBM.
  });

  it("sirve la tarifa VENCIDA: el último precio que puso el founder", async () => {
    await ddp({ until: "current_date - 1" });
    const rows = await rpc();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].per_cbm)).toBe(850);
    expect(Number(rows[0].min_charge)).toBe(50);
    // `valid_until` sigue viajando: el consumidor deriva «vencida» de este dato
    // y no hace falta ni una señal nueva ni cambiar la firma.
    expect(rows[0].valid_until).toBe(await fecha("current_date - 1"));
  });

  it("sigue sirviendo la VIGENTE y la SIN FECHA DE CORTE (cero regresión)", async () => {
    await ddp({ until: "current_date + 73" }); // el estado de producción hoy
    expect(Number((await rpc())[0].per_cbm)).toBe(850);
    await db.exec("update public.rates set valid_until = null");
    const rows = await rpc();
    expect(rows).toHaveLength(1);
    expect(rows[0].valid_until).toBeNull();
  });

  it("NO adelanta una tarifa PROGRAMADA a futuro: valid_from se sigue respetando", async () => {
    await ddp({ perCbm: 900, from: "current_date + 30", until: "current_date + 120" });
    expect(await rpc()).toHaveLength(0);
    // Tampoco con vigencia abierta: lo que la frena es valid_from, no valid_until.
    await db.exec("update public.rates set valid_until = null");
    expect(await rpc()).toHaveLength(0);
    // Y el día que arranca, entra.
    await db.exec("update public.rates set valid_from = current_date");
    expect(Number((await rpc())[0].per_cbm)).toBe(900);
  });

  it("NO sirve una tarifa sin precio: las dos filas DDP públicas con per_cbm NULL de producción", async () => {
    // Existen de verdad (valid_from 2026-05-24, valid_until 2026-12-31) y el
    // índice único las tolera porque su predicado exige `per_cbm is not null`.
    await ddpSinPrecio();
    await ddpSinPrecio();
    // Sin fila con precio: cero filas. NUNCA una tarifa vacía.
    expect(await rpc()).toHaveLength(0);
    // Y con la fila con precio vencida al lado, gana la que tiene precio.
    await ddp({ until: "current_date - 230" });
    const rows = await rpc();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].per_cbm)).toBe(850);
  });

  it("un borrador NUNCA se sirve, ni vencido ni vigente (regla de 0255)", async () => {
    await ddp({ status: "draft", until: "current_date - 1" });
    expect(await rpc()).toHaveLength(0);
    await db.exec("update public.rates set valid_until = current_date + 73");
    expect(await rpc()).toHaveLength(0);
  });

  it("una fila despublicada o borrada no vuelve por la puerta de atrás", async () => {
    await ddp({ until: "current_date - 1" });
    await db.exec("update public.rates set is_public = false");
    expect(await rpc()).toHaveLength(0);
    await db.exec("update public.rates set is_public = true, deleted_at = now()");
    expect(await rpc()).toHaveLength(0);
  });

  it("el consolidado (valid_from y valid_until en NULL) sigue exactamente igual", async () => {
    await db.query(
      `insert into public.rates (tenant_id, per_cbm, min_charge, is_public, public_calc_modo, status, valid_from, valid_until)
       select id, 580.00, null, true, 'consolidado', 'published', null, null
       from public.tenants where slug = 'dtd'`,
    );
    await ddp({ until: "current_date - 1" });
    const consolidado = await rpc("consolidado");
    expect(consolidado).toHaveLength(1);
    expect(Number(consolidado[0].per_cbm)).toBe(580);
    expect(consolidado[0].min_charge).toBeNull();
    expect(consolidado[0].valid_until).toBeNull();
    // Y las modalidades no se cruzan.
    expect(Number((await rpc())[0].per_cbm)).toBe(850);
  });

  it("p_modo vacío o con espacios cae a ddp, como antes", async () => {
    await ddp({ until: "current_date - 1" });
    for (const modo of ["", "   ", "ddp"]) {
      expect(await rpc(modo)).toHaveLength(1);
    }
  });

  it("el índice único sigue prohibiendo dos públicas con precio por modalidad", async () => {
    // Es la invariante que vuelve inútil el diseño «si no hay vigente, la última
    // vencida»: nunca hay DOS candidatas entre las que elegir.
    await ddp({ until: "current_date - 1" });
    await expect(ddp({ perCbm: 900, until: "current_date + 120" })).rejects.toThrow(
      /rates_one_public_cbm_per_tenant_modo|duplicate key/,
    );
  });

  it("conserva el contrato de seguridad: definer, stable y EXECUTE sólo para anon y authenticated", async () => {
    const r = await db.query<{ anon: boolean; auth: boolean; tercero: boolean }>(
      `select has_function_privilege('anon', 'public.public_cbm_rate(text)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.public_cbm_rate(text)', 'execute') as auth,
              has_function_privilege('tercero', 'public.public_cbm_rate(text)', 'execute') as tercero`,
    );
    expect(r.rows[0].anon).toBe(true);
    expect(r.rows[0].auth).toBe(true);
    expect(r.rows[0].tercero).toBe(false); // el revoke de PUBLIC sigue puesto
    const def = await db.query<{ prosecdef: boolean; provolatile: string; args: string }>(
      `select prosecdef, provolatile, pg_get_function_identity_arguments(oid) as args
         from pg_proc where proname = 'public_cbm_rate'`,
    );
    expect(def.rows).toHaveLength(1);
    expect(def.rows[0].prosecdef).toBe(true);
    expect(def.rows[0].provolatile).toBe("s");
    // La firma NO cambia: hay consumidores desplegados que llaman sin argumentos.
    expect(def.rows[0].args).toBe("p_modo text");
  });
});
