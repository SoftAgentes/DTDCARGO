// @vitest-environment node
/**
 * SDD-0478 · La migración 0459 corrida de verdad sobre PostgreSQL embebido.
 *
 * Lo que cambia es esquema y una función plpgsql: un doble de `supabase` sólo
 * afirmaría lo que yo escriba en el doble. PGlite corre el archivo `.sql` REAL
 * —el mismo texto que el runbook aplicará a producción— sobre las piezas REALES
 * de las que depende: el índice singleton de 0255, el guard de listas de 0382 y
 * el cuerpo de `public_cbm_rate` de 0458 (aplicado en producción el 2026-09-18).
 * `pg_cron` no existe en PGlite: se reemplaza por un `cron.schedule` mínimo que
 * registra el job, para poder afirmar qué programa la migración.
 *
 * CONTROL ROJO: el primer caso corre SIN la ranura programada y muestra el
 * hueco — hoy no se puede cargar la próxima tarifa pública sin despublicar la
 * vigente, y al despublicarla la RPC se queda sin fila.
 *
 * Las fechas son RELATIVAS al día de Caracas dentro de SQL: un literal se
 * pondría rojo solo con que pase el calendario.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(new URL("../../supabase/migrations/" + name, import.meta.url), "utf8");

/** Extrae el `create or replace function …$$;` de una migración real. */
function fn(sql: string, name: string) {
  const start = sql.indexOf("create or replace function public." + name);
  if (start < 0) throw new Error("Falta la función real " + name);
  const end = sql.indexOf("$$;", sql.indexOf("as $$", start));
  return sql.slice(start, end + 3);
}

const FILE_0459 = migration("0459_tarifa_programada_a_futuro.sql");
const RPC_0458 = fn(migration("0458_tarifa_lectura_sin_vigencia.sql"), "public_cbm_rate");
const GUARD_0382 = fn(migration("0382_price_books.sql"), "rates_guard_price_book");

/** El día de Caracas, como lo calcula la función de relevo. */
const HOY = "((now() at time zone 'America/Caracas')::date)";

let db: PGlite;

type Fila = {
  per_cbm: string | null;
  is_public: boolean;
  publica_programada: boolean;
  public_calc_modo: string;
};

/** La RPC del sitio, igual que la llama `lib/public/rates-queries.ts`. */
async function sitio(modo = "ddp"): Promise<number | null> {
  const r = await db.query<{ per_cbm: string }>(
    "select per_cbm::text from public.public_cbm_rate($1)",
    [modo],
  );
  return r.rows.length ? Number(r.rows[0].per_cbm) : null;
}

async function promover(): Promise<{ hoy_caracas: string; promovidas: { per_cbm: number; relevadas: number; modo: string }[] }> {
  const r = await db.query<{ r: { hoy_caracas: string; promovidas: { per_cbm: number; relevadas: number; modo: string }[] } }>(
    "select public.promover_tarifas_programadas() as r",
  );
  return r.rows[0].r;
}

async function filas(): Promise<Fila[]> {
  const r = await db.query<Fila>(
    `select per_cbm::text, is_public, publica_programada, public_calc_modo
       from public.rates order by per_cbm nulls first`,
  );
  return r.rows;
}

/**
 * Inserta una tarifa. `from`/`until` son EXPRESIONES SQL de fecha. `book` es
 * 'casa' o 'aliado'.
 */
function tarifa(o: {
  perCbm?: number | null;
  modo?: "ddp" | "consolidado";
  publica?: boolean;
  programada?: boolean;
  from?: string;
  until?: string;
  status?: string;
  book?: "casa" | "aliado";
}) {
  const {
    perCbm = 850,
    modo = "ddp",
    publica = false,
    programada,
    from = `${HOY} - 14`,
    until = "null",
    status = "published",
    book = "casa",
  } = o;
  // Sin `programada` no se nombra la columna: el control rojo corre ANTES de
  // que la 0459 la cree.
  const col = programada === undefined ? "" : ", publica_programada";
  const val = programada === undefined ? "" : `, ${programada}`;
  return db.query(
    `insert into public.rates
       (tenant_id, price_book_id, per_cbm, flat_rate, min_charge, is_public${col},
        public_calc_modo, status, valid_from, valid_until)
     select t.id, pb.id, $1::numeric, case when $1::numeric is null then 4500 end, 50.00, $2${val}, $3, $4,
            (${from})::date, (${until})::date
       from public.tenants t
       join public.price_books pb on pb.tenant_id = t.id and pb.is_house = ($5 = 'casa')
      where t.slug = 'dtd'`,
    [perCbm, publica, modo, status, book],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create role tercero;
    -- Como Supabase: toda función nueva de public nace ejecutable por estos
    -- roles. Sin esto, olvidar el revoke de authenticated pasaría en verde.
    alter default privileges in schema public
      grant execute on functions to anon, authenticated, service_role;
    create table public.tenants (id uuid primary key default gen_random_uuid(), slug text unique not null);
    create table public.price_books (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references public.tenants(id),
      is_house boolean not null default false,
      deleted_at timestamptz);
    create table public.rates (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references public.tenants(id),
      price_book_id uuid references public.price_books(id),
      per_cbm numeric(10,2), flat_rate numeric(10,2), min_charge numeric(10,2),
      valid_from date, valid_until date,
      is_public boolean not null default false,
      status text not null default 'published',
      public_calc_modo text not null default 'ddp',
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      check (per_cbm is not null or flat_rate is not null));
    insert into public.tenants (slug) values ('dtd');
    insert into public.price_books (tenant_id, is_house) select id, true from public.tenants;
    insert into public.price_books (tenant_id, is_house) select id, false from public.tenants;
    -- pg_cron mínimo: registra el job por nombre, como el real (upsert).
    create schema cron;
    create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
    create function cron.schedule(job_name text, schedule text, command text) returns bigint
      language sql as $$
        insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
        on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
        returning jobid
      $$;
  `);
  // Las piezas REALES en las que se apoya 0459.
  await db.exec(`create unique index rates_one_public_cbm_per_tenant_modo
    on public.rates (tenant_id, public_calc_modo)
    where is_public and deleted_at is null and per_cbm is not null;`);
  await db.exec(GUARD_0382);
  await db.exec(`create trigger rates_guard_price_book_t
    before insert or update of price_book_id, is_public, tenant_id on public.rates
    for each row execute function public.rates_guard_price_book();`);
  await db.exec(RPC_0458);
}, 60000);

afterAll(async () => {
  await db?.close();
});

describe("sin la 0459 · el hueco que esta SDD cierra", () => {
  it("CONTROL ROJO: no se puede cargar la próxima pública sin despublicar la vigente, y al despublicarla el sitio se queda sin tarifa", async () => {
    await db.exec("delete from public.rates;");
    await tarifa({ publica: true });
    // La que rige desde dentro de un mes, marcada pública: el singleton la rechaza.
    await expect(
      tarifa({ perCbm: 900, publica: true, from: `${HOY} + 30` }),
    ).rejects.toThrow(/rates_one_public_cbm_per_tenant_modo/);
    // El único camino de hoy: desmarcar la vigente. Y ahí está el hueco.
    await db.exec("update public.rates set is_public = false;");
    await tarifa({ perCbm: 900, publica: true, from: `${HOY} + 30` });
    expect(await sitio()).toBeNull();
  });
});

describe("0459 · programar la próxima tarifa pública sin hueco", () => {
  beforeAll(async () => {
    await db.exec("delete from public.rates;");
    // El archivo ENTERO: preflight, columna, check, índice, guard, función,
    // grants y el job, tal como los va a correr el runbook.
    await db.exec(FILE_0459);
  });

  beforeEach(async () => {
    await db.exec("set timezone to 'UTC'; delete from public.rates;");
  });

  it("la programada convive con la pública y el sitio sigue con la vigente hasta el día de arranque", async () => {
    await tarifa({ publica: true });
    await tarifa({ perCbm: 900, programada: true, from: `${HOY} + 30` });
    expect(await sitio()).toBe(850);
    expect((await promover()).promovidas).toEqual([]);
    expect(await sitio()).toBe(850);
  });

  it("el día de arranque (día de Caracas) entra sola y releva a la vigente", async () => {
    await tarifa({ publica: true, until: `${HOY} - 1` }); // vencida: la 0458 la sigue sirviendo
    await tarifa({ perCbm: 900, programada: true, from: HOY });
    const r = await promover();
    expect(r.hoy_caracas).toBe(
      (await db.query<{ d: string }>(`select ${HOY}::text as d`)).rows[0].d,
    );
    expect(r.promovidas).toHaveLength(1);
    expect(r.promovidas[0]).toMatchObject({ per_cbm: 900, relevadas: 1, modo: "ddp" });
    expect(await sitio()).toBe(900);
    expect(await filas()).toEqual([
      { per_cbm: "850.00", is_public: false, publica_programada: false, public_calc_modo: "ddp" },
      { per_cbm: "900.00", is_public: true, publica_programada: false, public_calc_modo: "ddp" },
    ]);
  });

  it("la de mañana NO entra hoy", async () => {
    await tarifa({ publica: true });
    await tarifa({ perCbm: 900, programada: true, from: `${HOY} + 1` });
    expect((await promover()).promovidas).toEqual([]);
    expect(await sitio()).toBe(850);
  });

  it("cuenta el día de Caracas aunque la sesión esté en otra zona (el job de pg_cron no fija la suya)", async () => {
    // Una función que usara current_date dependería de la zona de la sesión.
    // Ninguna zona difiere de Caracas en fecha las 24 horas, así que se usan
    // dos, y a cualquier hora al menos una delata el error:
    // · Kiritimati (UTC+14) va 18 h adelante: desde las 06:00 de Caracas su
    //   fecha ya es MAÑANA → la de mañana se promovería antes de tiempo.
    // · Etc/GMT+12 (UTC−12) va 8 h atrás: hasta las 08:00 de Caracas su fecha
    //   todavía es AYER → la de hoy no entraría.
    await db.exec("set timezone to 'Pacific/Kiritimati';");
    await tarifa({ publica: true });
    await tarifa({ perCbm: 900, programada: true, from: `${HOY} + 1` });
    expect((await promover()).promovidas).toEqual([]);

    await db.exec("set timezone to 'Etc/GMT+12'; update public.rates set valid_from = " + HOY + " where publica_programada;");
    expect((await promover()).promovidas).toHaveLength(1);
    await db.exec("set timezone to 'UTC';");
    expect(await sitio()).toBe(900);
  });

  it("es idempotente: la segunda corrida no toca nada", async () => {
    await tarifa({ publica: true });
    await tarifa({ perCbm: 900, programada: true, from: HOY });
    await promover();
    const antes = await filas();
    expect((await promover()).promovidas).toEqual([]);
    expect(await filas()).toEqual(antes);
    expect(await sitio()).toBe(900);
  });

  it("el relevo es UNA transacción: si falla a mitad, la vigente sigue pública", async () => {
    await tarifa({ publica: true });
    // Una programada de aliado no puede nacer (lo prueba otro caso); se fuerza
    // saltando el guard nuevo para que el de 0382 frene la promoción.
    await db.exec("alter table public.rates disable trigger rates_guard_publica_programada_t;");
    await tarifa({ perCbm: 900, programada: true, from: HOY, book: "aliado" });
    await db.exec("alter table public.rates enable trigger rates_guard_publica_programada_t;");
    await expect(promover()).rejects.toThrow(/puede ser la pública del sitio/);
    expect(await sitio()).toBe(850);
    expect((await filas()).find((f) => f.per_cbm === "850.00")?.is_public).toBe(true);
  });

  it("la alerta de SEGUNDA pública sigue viva: el singleton no se tocó", async () => {
    await tarifa({ publica: true });
    // `isPublicRateConflict` de actions.ts busca 23505 + «rates_one_public_cbm».
    await expect(tarifa({ perCbm: 900, publica: true, from: `${HOY} + 30` })).rejects.toThrow(
      /rates_one_public_cbm_per_tenant_modo/,
    );
  });

  it("una sola programada por modalidad; otra modalidad sí puede tener la suya", async () => {
    await tarifa({ perCbm: 900, programada: true, from: `${HOY} + 30` });
    await expect(
      tarifa({ perCbm: 950, programada: true, from: `${HOY} + 60` }),
    ).rejects.toThrow(/rates_one_programada_per_tenant_modo/);
    await tarifa({ perCbm: 600, modo: "consolidado", programada: true, from: `${HOY} + 30` });
  });

  it("una programada tiene precio por CBM y fecha de arranque, y no es pública a la vez", async () => {
    await expect(tarifa({ perCbm: 900, programada: true, publica: true, from: `${HOY} + 30` })).rejects.toThrow(
      /rates_publica_programada_check/,
    );
    await expect(tarifa({ perCbm: null, programada: true, from: `${HOY} + 30` })).rejects.toThrow(
      /rates_publica_programada_check/,
    );
    await expect(tarifa({ perCbm: 900, programada: true, from: "null" })).rejects.toThrow(
      /rates_publica_programada_check/,
    );
  });

  it("un borrador o una tarifa de aliado no se programan", async () => {
    await expect(
      tarifa({ perCbm: 900, programada: true, from: `${HOY} + 30`, status: "draft" }),
    ).rejects.toThrow(/borrador/);
    await expect(
      tarifa({ perCbm: 900, programada: true, from: `${HOY} + 30`, book: "aliado" }),
    ).rejects.toThrow(/puede programarse/);
  });

  it("archivar o borrar suelta la programación y libera la ranura", async () => {
    await tarifa({ perCbm: 900, programada: true, from: `${HOY} + 30` });
    await db.exec("update public.rates set status = 'archived';");
    expect((await filas())[0].publica_programada).toBe(false);
    await tarifa({ perCbm: 910, programada: true, from: `${HOY} + 30` });
    await db.exec("update public.rates set deleted_at = now() where per_cbm = 910;");
    expect((await filas()).find((f) => f.per_cbm === "910.00")?.publica_programada).toBe(false);
    await tarifa({ perCbm: 920, programada: true, from: `${HOY} + 30` });
  });

  it("las modalidades no se cruzan: la del consolidado releva sólo al consolidado", async () => {
    await tarifa({ publica: true });
    await tarifa({ perCbm: 580, modo: "consolidado", publica: true, from: "null" });
    await tarifa({ perCbm: 600, modo: "consolidado", programada: true, from: HOY });
    const r = await promover();
    expect(r.promovidas).toHaveLength(1);
    expect(r.promovidas[0]).toMatchObject({ modo: "consolidado", relevadas: 1 });
    expect(await sitio("consolidado")).toBe(600);
    expect(await sitio()).toBe(850);
  });

  it("no toca las públicas SIN precio que existen en producción, ni una borrada", async () => {
    await tarifa({ perCbm: null, publica: true });
    await tarifa({ perCbm: null, publica: true });
    // Una pública con precio YA BORRADA (soft delete): no ocupa el singleton y
    // el relevo no tiene por qué reescribirla.
    await tarifa({ perCbm: 700, publica: true });
    await db.exec("update public.rates set deleted_at = now() where per_cbm = 700;");
    await tarifa({ publica: true });
    await tarifa({ perCbm: 900, programada: true, from: HOY });
    expect((await promover()).promovidas[0].relevadas).toBe(1);
    const sinPrecio = (await filas()).filter((f) => f.per_cbm === null);
    expect(sinPrecio).toHaveLength(2);
    expect(sinPrecio.every((f) => f.is_public)).toBe(true);
    expect((await filas()).find((f) => f.per_cbm === "700.00")?.is_public).toBe(true);
    expect(await sitio()).toBe(900);
  });

  it("el job no promueve un borrador aunque lo encuentre marcado (datos cargados saltando el guard)", async () => {
    await tarifa({ publica: true });
    await db.exec("alter table public.rates disable trigger rates_guard_publica_programada_t;");
    await tarifa({ perCbm: 900, programada: true, from: HOY, status: "draft" });
    await db.exec("alter table public.rates enable trigger rates_guard_publica_programada_t;");
    // La RPC no sirve borradores: promoverlo dejaría el sitio SIN tarifa.
    expect((await promover()).promovidas).toEqual([]);
    expect(await sitio()).toBe(850);
  });

  it("el job no promueve una programada borrada aunque conserve la marca (datos cargados saltando el guard)", async () => {
    await tarifa({ publica: true });
    await db.exec("alter table public.rates disable trigger rates_guard_publica_programada_t;");
    await tarifa({ perCbm: 900, programada: true, from: HOY });
    await db.exec("update public.rates set deleted_at = now() where per_cbm = 900;");
    await db.exec("alter table public.rates enable trigger rates_guard_publica_programada_t;");
    expect((await promover()).promovidas).toEqual([]);
    expect(await sitio()).toBe(850);
  });

  it("sin pública vigente, la programada entra igual el día de arranque", async () => {
    await tarifa({ perCbm: 900, programada: true, from: HOY });
    expect((await promover()).promovidas[0].relevadas).toBe(0);
    expect(await sitio()).toBe(900);
  });

  it("contrato de seguridad: definer, search_path vacío y EXECUTE sólo para service_role", async () => {
    const priv = await db.query<{ anon: boolean; auth: boolean; tercero: boolean; svc: boolean }>(
      `select has_function_privilege('anon', 'public.promover_tarifas_programadas()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.promover_tarifas_programadas()', 'execute') as auth,
              has_function_privilege('tercero', 'public.promover_tarifas_programadas()', 'execute') as tercero,
              has_function_privilege('service_role', 'public.promover_tarifas_programadas()', 'execute') as svc`,
    );
    expect(priv.rows[0]).toEqual({ anon: false, auth: false, tercero: false, svc: true });
    const guard = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.rates_guard_publica_programada()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.rates_guard_publica_programada()', 'execute') as auth`,
    );
    expect(guard.rows[0]).toEqual({ anon: false, auth: false });
    const def = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] }>(
      `select proname, prosecdef, proconfig from pg_proc
        where proname in ('promover_tarifas_programadas', 'rates_guard_publica_programada')
        order by proname`,
    );
    expect(def.rows.map((d) => [d.proname, d.prosecdef, d.proconfig])).toEqual([
      ["promover_tarifas_programadas", true, ['search_path=""']],
      ["rates_guard_publica_programada", true, ['search_path=""']],
    ]);
  });

  it("programa el job cada hora al minuto 5, y re-aplicar el archivo no lo duplica", async () => {
    await db.exec(FILE_0459);
    const jobs = await db.query<{ jobname: string; schedule: string; command: string }>(
      "select jobname, schedule, command from cron.job",
    );
    expect(jobs.rows).toEqual([
      {
        jobname: "tarifas-programadas-relevo",
        schedule: "5 * * * *",
        command: "select public.promover_tarifas_programadas();",
      },
    ]);
  });
});
