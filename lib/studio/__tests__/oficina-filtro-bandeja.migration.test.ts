// @vitest-environment node
/**
 * SDD-0626 §3.3 · La migración 0544 (el filtro nivel 1 de la bandeja) corrida de verdad
 * sobre PostgreSQL embebido, con el contrato `supabase/tests/0544_…test.sql` y los `.sql`
 * reales inlineados (la 0541 de la que depende, la 0544 y su desarme).
 *
 * CONTROL ROJO: sin la 0544 el contrato falla. MUTANTES: cada uno quita una barrera de la
 * 0544 y el contrato tiene que caer. El mismo contrato corre en Postgres 17 con Docker en
 * el workflow «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0544_oficina_filtro_bandeja.test.sql");
const M0541 = "0541_oficina_cable_tablas.sql";
const M0544 = "0544_oficina_filtro_bandeja.sql";

type Transform = (sql: string) => string;

/** El contrato con los `\ir` resueltos. `migracion` transforma solo la 0544. */
function inline(opts: { sin0544?: boolean; migracion?: Transform; contrato?: Transform } = {}): string {
  const texto = readFileSync(CONTRACT, "utf8");
  return (opts.contrato ? opts.contrato(texto) : texto)
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (nombre !== M0541 && nombre !== M0544) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0544 && opts.sin0544) return "";
        const leida = readFileSync(resolve(ROOT, "supabase/migrations", nombre), "utf8");
        return nombre === M0544 && opts.migracion ? opts.migracion(leida) : leida;
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

function mutar(buscar: string, poner: string): Transform {
  return (sql: string) => {
    const mutado = sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0544 · filtro nivel 1 de la bandeja (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 60_000);

  it("CONTROL ROJO: sin la 0544 el contrato falla", async () => {
    expect(await run(inline({ sin0544: true }))).not.toBeNull();
  }, 60_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "sin la cuenta de lo de la última hora, la cuota no se respeta",
      mutar("v_libres := greatest(p_cuota - v_usados, 0);", "v_libres := p_cuota;"),
      "CONTRATO",
    ],
    [
      "sin la pausa, el filtro mueve filas con la oficina pausada",
      mutar("if public.office_esta_pausada() then\n    return 0;\n  end if;", ""),
      "CONTRATO 4",
    ],
    [
      "sin ordenar por prioridad, no pasa primero el dinero",
      mutar("order by e.prioridad desc, e.ts asc, e.id asc", "order by e.ts asc, e.id asc"),
      "CONTRATO 2",
    ],
    [
      "sin la hora de triaje, no hay cuota por hora",
      mutar("triaje_en = pg_catalog.now()", "triaje_en = null"),
      "CONTRATO",
    ],
    [
      "un filtro que descarta lo que no cabe",
      mutar("where e.estado = 'nuevo'\n     order by", "where e.estado = 'nuevo' and e.prioridad > 1\n     order by"),
      "CONTRATO",
    ],
    [
      "authenticated ejecuta el filtro",
      mutar(
        "grant execute on function public.office_filtrar_bandeja(integer) to service_role;",
        "grant execute on function public.office_filtrar_bandeja(integer) to service_role, authenticated;",
      ),
      "",
    ],
    [
      "service_role escribe triaje_en",
      mutar(
        "grant execute on function public.office_filtrar_bandeja(integer) to service_role;",
        "grant execute on function public.office_filtrar_bandeja(integer) to service_role;\ngrant update (triaje_en) on public.event_inbox to service_role;",
      ),
      "",
    ],
    [
      "acepta una cuota fuera de rango",
      mutar("if p_cuota is null or p_cuota not between 0 and 1000 then", "if false then"),
      "CONTRATO 5",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      if (esperado) expect(error).toContain(esperado);
    }, 60_000);
  }

  it("desarme: quita la función, el índice y la columna, deja las filas, y repetirlo no falla", async () => {
    const mig41 = readFileSync(resolve(ROOT, "supabase/migrations", M0541), "utf8");
    const mig44 = readFileSync(resolve(ROOT, "supabase/migrations", M0544), "utf8");
    const desarme = readFileSync(resolve(ROOT, "supabase/desarmes/0544_desarme.sql"), "utf8");
    const base = `
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      do $r$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
      end $r$;
      create table public.platform_admins (user_id uuid primary key);
      create function public.is_platform_admin() returns boolean language sql security definer stable
        set search_path = public as $$ select false $$;
    `;
    const comprobar = `
      do $c$ begin
        if to_regprocedure('public.office_filtrar_bandeja(integer)') is not null
           or to_regclass('public.event_inbox_triaje_en_idx') is not null
           or exists (select 1 from information_schema.columns where table_schema = 'public'
                       and table_name = 'event_inbox' and column_name = 'triaje_en') then
          raise exception 'el desarme dejó objetos de la 0544';
        end if;
        if (select count(*) from public.event_inbox) <> 1 or to_regprocedure('public.office_esta_pausada()') is null then
          raise exception 'el desarme tocó lo que no es de la 0544';
        end if;
      end $c$;
    `;
    const sql = [
      base,
      mig41,
      mig44,
      "insert into public.event_inbox (tipo, origen, clave_dedupe) values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:1:msg:1');",
      desarme,
      desarme,
      comprobar,
      // Y vuelve a subir.
      mig44,
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 60_000);
});
