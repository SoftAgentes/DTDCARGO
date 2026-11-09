// @vitest-environment node
/**
 * SDD-0608 · La migración 0516 corrida de verdad sobre PostgreSQL embebido,
 * con el contrato `supabase/tests/0516_…test.sql` y el `.sql` real inlineado.
 *
 * CONTROL ROJO: sin la migración el contrato falla. MUTANTES: cada uno quita
 * una barrera de la migración y el contrato tiene que caer en el punto que la
 * protege.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0516_discord_consulta_clientes.test.sql");
const MIGRATION = "0516_discord_consulta_clientes.sql";

function inline(
  file: string,
  opts: { omit?: boolean; transform?: (sql: string) => string } = {},
): string {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (!include[1].endsWith(MIGRATION)) {
          throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        }
        if (opts.omit) return "";
        const sql = readFileSync(resolve(dirname(file), include[1]), "utf8");
        return opts.transform ? opts.transform(sql) : sql;
      }
      return /^\\(set|echo)\s/.test(line) ? "" : line;
    })
    .join("\n");
}

async function run(sql: string): Promise<string | null> {
  const db = await pgliteLimpio();
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

function mutar(buscar: string, poner: string, todas = false) {
  return (sql: string) => {
    const mutado = todas ? sql.split(buscar).join(poner) : sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0516 · consulta de clientes desde Discord (PGlite)", () => {
  it("el contrato completo pasa con la migración real", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla", async () => {
    expect(await run(inline(CONTRACT, { omit: true }))).toMatch(/discord_buscar_clientes/);
  }, 60_000);

  it("mutante: sin escapar `%`, «%%» devuelve clientes", async () => {
    const sinEscape = mutar(`'%', '\\%'`, `'%', '%'`);
    expect(await run(inline(CONTRACT, { transform: sinEscape }))).toMatch(
      /CONTRATO 1\/2: búsqueda «%%» \(%% literal\)/,
    );
  }, 60_000);

  it("mutante: sin escapar `_`, «ana_luisa» también trae a AnaXLuisa", async () => {
    const sinEscape = mutar(`'_', '\\_'`, `'_', '_'`);
    expect(await run(inline(CONTRACT, { transform: sinEscape }))).toMatch(
      /CONTRATO 1\/2: búsqueda «ana_luisa»/,
    );
  }, 60_000);

  it("mutante: sin exigir una palabra, «%» de una letra devuelve todos", async () => {
    const sinPiso = mutar("exists (select 1 from palabras) and not exists", "not exists");
    expect(await run(inline(CONTRACT, { transform: sinPiso }))).toMatch(/CONTRATO 1\/2: búsqueda «%» \(% solo\)/);
  }, 60_000);

  it("mutante: sin el camino por código, el código no encuentra al cliente", async () => {
    const sinCodigo = mutar("where k.por_codigo\n      or (", "where false\n      or (");
    expect(await run(inline(CONTRACT, { transform: sinCodigo }))).toMatch(
      /CONTRATO 1\/2: búsqueda «DTD-0001» \(código exacto\)/,
    );
  }, 60_000);

  // Con un prefijo en vez de igualdad, el término vacío ya coincide con todos y
  // el contrato cae en «% solo», el primer caso que lo nota.
  it("mutante: el código por prefijo en vez de igualdad", async () => {
    const conComodin = mutar(
      "= (select limpio from codigo)",
      "like (select limpio from codigo) || '%'",
    );
    expect(await run(inline(CONTRACT, { transform: conComodin }))).toMatch(
      /CONTRATO 1\/2: búsqueda «%» \(% solo\)/,
    );
  }, 60_000);

  it("mutante: sin poner primero el código, gana el orden por nombre", async () => {
    const sinOrden = mutar("order by k.por_codigo desc, k.name", "order by k.name");
    expect(await run(inline(CONTRACT, { transform: sinOrden }))).toMatch(/CONTRATO 1\/2: el código no fue primero/);
  }, 60_000);

  // Revisión independiente de la #387: el filtro de tenant (`0516…sql:221`) no
  // tenía mutante. Sin él, el Pedro Pérez del tenant 2 sale en la búsqueda del 1.
  it("mutante: sin filtrar por tenant, aparece el cliente de otro tenant", async () => {
    const sinTenant = mutar("where c.tenant_id = p_tenant_id\n", "where true\n");
    expect(await run(inline(CONTRACT, { transform: sinTenant }))).toMatch(
      /CONTRATO 1\/2: búsqueda «pedro perez» \(palabras sin acento\) dio \[DTD-0001,DTD-0002,DTD-0003,DTD-0010\]/,
    );
  }, 60_000);

  it("mutante: sin filtrar eliminados, aparece el Pedro Pérez borrado", async () => {
    const conBorrados = mutar("and c.deleted_at is null", "");
    expect(await run(inline(CONTRACT, { transform: conBorrados }))).toMatch(
      /CONTRATO 1\/2: búsqueda «pedro perez»/,
    );
  }, 60_000);

  it("mutante: la búsqueda devuelve también el teléfono", async () => {
    const conTelefono = (sql: string) =>
      mutar("returns table (markbox text, name text)", "returns table (markbox text, name text, phone text)")(
        mutar("select c.markbox, c.name,", "select c.markbox, c.name, c.phone,")(
          mutar("select k.markbox, k.name\n", "select k.markbox, k.name, k.phone\n")(sql),
        ),
      );
    expect(await run(inline(CONTRACT, { transform: conTelefono }))).toMatch(
      /CONTRATO 3: la búsqueda devuelve otras columnas/,
    );
  }, 60_000);

  it("mutante: tope con <= deja pasar una consulta de más", async () => {
    const tope = mutar("v_recientes < greatest", "v_recientes <= greatest");
    expect(await run(inline(CONTRACT, { transform: tope }))).toMatch(/CONTRATO 4: la cuarta consulta/);
  }, 60_000);

  it("mutante: sin retención, la fila de 200 días se queda", async () => {
    const sinRetencion = mutar("interval '180 days'", "interval '1000 days'");
    expect(await run(inline(CONTRACT, { transform: sinRetencion }))).toMatch(/CONTRATO 5/);
  }, 60_000);

  // Las funciones son SECURITY INVOKER: con EXECUTE, authenticated igual cae al
  // leer `clients`. El contrato tiene que ver el privilegio en sí (en la #387 el
  // primer intento pasaba por esa otra razón).
  it.each<[string, string, RegExp]>([
    [
      "EXECUTE de la búsqueda para authenticated",
      "grant execute on function public.discord_buscar_clientes(uuid, text, integer) to authenticated;",
      /CONTRATO 6: authenticated tiene EXECUTE sobre discord_buscar_clientes/,
    ],
    [
      "EXECUTE del registro para anon",
      "grant execute on function public.discord_consulta_registrar(text, uuid, uuid, text, text, integer) to anon;",
      /CONTRATO 6: anon tiene EXECUTE sobre discord_consulta_registrar/,
    ],
    [
      "SELECT del registro para authenticated",
      "grant select on public.discord_consultas_clientes to authenticated;",
      /CONTRATO 6: authenticated tiene privilegios sobre discord_consultas_clientes/,
    ],
  ])("mutante: %s, el contrato lo detecta", async (_n, grant, error) => {
    const conGrant = (sql: string) => `${sql}\n${grant}\n`;
    expect(await run(inline(CONTRACT, { transform: conGrant }))).toMatch(error);
  }, 60_000);
});

// La vuelta atrás (supabase/desarmes/0516_desarme.sql): quita lo de la 0516 y nada más.
describe("0516 · desarme (PGlite)", () => {
  const FIXTURE = `
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
    end $r$;
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create table public.tenants (id uuid primary key);
    create table public.clients (id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null references public.tenants(id), markbox text not null, name text not null,
      deleted_at timestamptz);
    insert into public.tenants values ('00000000-0000-4000-8000-000000000001');
    insert into public.clients (tenant_id, markbox, name) values ('00000000-0000-4000-8000-000000000001', 'DTD-0001', 'Pedro Pérez');
  `;
  const MIG = readFileSync(resolve(ROOT, "supabase/migrations", MIGRATION), "utf8");
  const DESARME = readFileSync(resolve(ROOT, "supabase/desarmes/0516_desarme.sql"), "utf8");
  const QUEDA = `
    select (to_regclass('public.discord_consultas_clientes') is not null)::int
         + (to_regprocedure('public.discord_buscar_clientes(uuid, text, integer)') is not null)::int
         + (to_regprocedure('public.discord_consulta_registrar(text, uuid, uuid, text, text, integer)') is not null)::int
         as objetos,
         (select count(*) from public.clients)::int as clientes
  `;

  async function medir(sql: string) {
    const db = await pgliteLimpio();
    try {
      await db.exec(`begin; ${sql}`);
      const { rows } = await db.query<{ objetos: number; clientes: number }>(QUEDA);
      await db.exec("rollback");
      return rows[0];
    } finally {
      await db.close();
    }
  }

  it("control: con la 0516 sola quedan sus tres objetos", async () => {
    expect(await medir(`${FIXTURE}\n${MIG}`)).toEqual({ objetos: 3, clientes: 1 });
  }, 60_000);

  it("el desarme quita los tres y no toca clientes; repetirlo no falla", async () => {
    expect(await medir(`${FIXTURE}\n${MIG}\n${DESARME}\n${DESARME}`)).toEqual({ objetos: 0, clientes: 1 });
  }, 60_000);
});
