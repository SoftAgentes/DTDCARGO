// @vitest-environment node
/**
 * SDD-0626 Paso 3a · La migración 0548 (el despachador mínimo) corrida de verdad sobre PostgreSQL
 * embebido, con el contrato `supabase/tests/0548_…test.sql` y los `.sql` reales inlineados (la 0541 y
 * la 0544 de las que depende, la 0548 y su desarme).
 *
 * CONTROL ROJO: sin la 0548 el contrato falla. MUTANTES: cada uno quita una barrera de la 0548 y el
 * contrato tiene que caer. El mismo contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0548_oficina_despachador.test.sql");
const PERMITIDAS = new Set(["0541_oficina_cable_tablas.sql", "0544_oficina_filtro_bandeja.sql", "0548_oficina_despachador.sql"]);
const M0548 = "0548_oficina_despachador.sql";

type Transform = (sql: string) => string;

function inline(opts: { sin0548?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (!PERMITIDAS.has(nombre)) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0548 && opts.sin0548) return "";
        const leida = readFileSync(resolve(ROOT, "supabase/migrations", nombre), "utf8");
        return nombre === M0548 && opts.migracion ? opts.migracion(leida) : leida;
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

describe("0548 · despachador mínimo del cable (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 60_000);

  it("CONTROL ROJO: sin la 0548 el contrato falla", async () => {
    expect(await run(inline({ sin0548: true }))).not.toBeNull();
  }, 60_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "convierte con la oficina pausada",
      mutar("  if public.office_esta_pausada() then\n    return 0;\n  end if;\n  for v_evento in", "  for v_evento in"),
      "CONTRATO 2",
    ],
    [
      "toma tareas con la oficina pausada",
      mutar("  if public.office_esta_pausada() then\n    return;\n  end if;\n  -- Una toma", "  -- Una toma"),
      "CONTRATO",
    ],
    [
      "dos corridas a la vez por agente",
      mutar("t.asignado_a = v_actor and t.estado = 'en-ejecución') then\n    return;", "false) then\n    return;"),
      "CONTRATO 4",
    ],
    [
      "sin la pausa entre corridas",
      mutar("and ev.ts > pg_catalog.now() - pg_catalog.make_interval(secs => p_pausa_s)", "and false"),
      "CONTRATO 4",
    ],
    [
      "entrega corridas que no son la vigente",
      mutar("  if not public.office_corrida_en_curso(p_tarea, p_run) then\n    return false;\n  end if;\n  insert into public.office_borradores", "  insert into public.office_borradores"),
      "CONTRATO 5",
    ],
    [
      "un evento da dos tareas (sin el índice único)",
      (sql) =>
        mutar("on conflict ((meta_datos ->> 'evento_id')) where origen = 'event_inbox' do nothing", "on conflict do nothing")(
          mutar("create unique index if not exists office_tasks_evento_unico", "create index if not exists office_tasks_evento_unico")(sql),
        ),
      "CONTRATO 3",
    ],
    [
      "la auto-pausa despausa",
      mutar("values (true, null,\n            'Auto-pausa", "values (false, null,\n            'Auto-pausa"),
      "CONTRATO 7",
    ],
    [
      "la auto-pausa ignora el umbral",
      mutar("if v_gasto < p_tope_usd * p_umbral then", "if false then"),
      "CONTRATO 7",
    ],
    [
      "la purga borra todo",
      mutar("   where creado_en < pg_catalog.now() - interval '90 days';\n  get diagnostics v_borrados", "   where true;\n  get diagnostics v_borrados"),
      "CONTRATO 8",
    ],
    [
      "service_role cambia borradores",
      mutar("grant select on public.office_borradores to service_role;", "grant select, update on public.office_borradores to service_role;"),
      "",
    ],
    [
      "authenticated ejecuta el despachador",
      mutar("execute pg_catalog.format('grant execute on function %s to service_role', v_firma);", "execute pg_catalog.format('grant execute on function %s to service_role, authenticated', v_firma);"),
      "",
    ],
    [
      "dos tandas a la vez",
      mutar("and (d.dueno is null or d.dueno = p_dueno or d.hasta is null or d.hasta < pg_catalog.now())", ""),
      "CONTRATO 10",
    ],
    [
      "recupera dos veces",
      mutar("     where t.asignado_a = v_actor and t.estado = 'en-ejecución'\n       and ini.ts", "     where t.asignado_a = v_actor\n       and ini.ts"),
      "CONTRATO 6",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      if (esperado) expect(error).toContain(esperado);
    }, 60_000);
  }

  it("desarme: quita lo de la 0548, deja las tareas y la bitácora, y repetirlo no falla", async () => {
    const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
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
        if to_regclass('public.office_borradores') is not null or to_regclass('public.office_despachador') is not null
           or to_regclass('public.office_tasks_evento_unico') is not null
           or to_regprocedure('public.office_tomar_tarea(text, integer, integer)') is not null then
          raise exception 'el desarme dejó objetos de la 0548';
        end if;
        if (select count(*) from public.office_tasks) <> 1 or to_regprocedure('public.office_filtrar_bandeja(integer)') is null then
          raise exception 'el desarme tocó lo que no es de la 0548';
        end if;
      end $c$;
    `;
    const sql = [
      base,
      leer("supabase/migrations/0541_oficina_cable_tablas.sql"),
      leer("supabase/migrations/0544_oficina_filtro_bandeja.sql"),
      leer("supabase/migrations/0548_oficina_despachador.sql"),
      "insert into public.office_tasks (titulo) values ('una');",
      leer("supabase/desarmes/0548_desarme.sql"),
      leer("supabase/desarmes/0548_desarme.sql"),
      comprobar,
      leer("supabase/migrations/0548_oficina_despachador.sql"),
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 60_000);
});
