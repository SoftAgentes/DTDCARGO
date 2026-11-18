// @vitest-environment node
/**
 * SDD-0626 · La migración 0558 (las casillas de la revisión con tres estados y el cierre por conversación) corrida
 * de verdad sobre PostgreSQL embebido, con el contrato `supabase/tests/0558_…test.sql` y los `.sql` reales
 * inlineados (la 0541, la 0544, la 0548 y la 0549 de las que depende, la 0558 y su desarme).
 *
 * CONTROL ROJO: sin la 0558 el contrato falla. MUTANTES: cada uno quita una barrera de la 0558 (sobre todo
 * «null ≠ false») y el contrato tiene que caer. El mismo contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0558_oficina_casillas_tres_estados.test.sql");
const PERMITIDAS = new Set([
  "0541_oficina_cable_tablas.sql",
  "0544_oficina_filtro_bandeja.sql",
  "0548_oficina_despachador.sql",
  "0549_oficina_revisiones_envio.sql",
  "0558_oficina_casillas_tres_estados.sql",
]);
const M0558 = "0558_oficina_casillas_tres_estados.sql";
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Transform = (sql: string) => string;

function inline(opts: { sin0558?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (!PERMITIDAS.has(nombre)) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0558 && opts.sin0558) return "";
        const leida = leer(`supabase/migrations/${nombre}`);
        return nombre === M0558 && opts.migracion ? opts.migracion(leida) : leida;
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

// Apaga un check de la 0558 sin cambiarle el nombre (el postflight solo mira que exista).
const sinCheck = (inicio: string): Transform => mutar(`'check (${inicio}`, `'check (true or ${inicio}`);

describe("0558 · casillas con tres estados y cierre por conversación (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 120_000);

  it("CONTROL ROJO: sin la 0558 el contrato falla", async () => {
    expect(await run(inline({ sin0558: true }))).not.toBeNull();
  }, 120_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "aprueba sin evaluar «cero inventados» (null basta)",
      (sql) =>
        sinCheck("regla_casillas <> 2 or not (veredicto")(
          mutar(
            "     and not (p_cero_inventados is true and p_pii_no_repetida is true) then",
            "     and (p_cero_inventados is false or p_pii_no_repetida is false) then",
          )(sql),
        ),
      "CONTRATO 2",
    ],
    [
      "rechaza sin marcar un fallo",
      (sql) =>
        sinCheck("regla_casillas <> 2 or veredicto <> ''rechazado''")(
          mutar("  if p_veredicto = 'rechazado' and v_fallos = 0 then", "  if false then")(sql),
        ),
      "CONTRATO 2",
    ],
    [
      "un «no evaluado» cuenta como dato inventado (null = false)",
      mutar("pg_catalog.bool_or(r.c_cero_inventados is false) as inventada", "pg_catalog.bool_or(r.c_cero_inventados is not true) as inventada"),
      "CONTRATO 3",
    ],
    [
      "un «no evaluado» cuenta como cumple",
      mutar("r.veredicto = 'aprobado' and r.c_acuse is true", "r.veredicto = 'aprobado' and r.c_acuse is not false"),
      "CONTRATO 3",
    ],
    [
      "el conteo mira las filas viejas (criterio 1)",
      mutar("       where r.etapa = p_etapa and r.regla_casillas = 2\n       group by 1", "       where r.etapa = p_etapa\n       group by 1"),
      "CONTRATO 3",
    ],
    [
      "un cierre que falló no resta",
      mutar("p.correcta_mensajes and c.cumple is distinct from false\n", "p.correcta_mensajes\n"),
      "CONTRATO 3",
    ],
    [
      "la etapa 2 cuenta conversaciones sin cierre",
      mutar("select * from con_cierre where p_etapa = 1 or cierre is not null", "select * from con_cierre"),
      "CONTRATO 5",
    ],
    [
      "los cierres se pueden cambiar (sin el disparador)",
      mutar(
        "create or replace trigger office_cierres_solo_insertar\n  before update or delete on public.office_cierres\n  for each row",
        "create or replace trigger office_cierres_solo_insertar\n  before update or delete on public.office_cierres\n  for each row when (false)",
      ),
      "CONTRATO 4",
    ],
    [
      "dos cierres por conversación",
      (sql) =>
        mutar("  on conflict (conversacion, etapa) do nothing\n  returning id into v_id;", "  returning id into v_id;")(
          mutar(",\n  constraint office_cierres_uno_por_conversacion unique (conversacion, etapa)", "")(sql),
        ),
      "CONTRATO 4",
    ],
    [
      "service_role llama a las funciones de la página",
      mutar(
        "    execute pg_catalog.format('grant execute on function %s to authenticated', v_firma);",
        "    execute pg_catalog.format('grant execute on function %s to authenticated, service_role', v_firma);",
      ),
      "",
    ],
    [
      "authenticated lee los cierres",
      mutar(
        "grant select on public.office_cierres to service_role;",
        "grant select on public.office_cierres to service_role, authenticated;",
      ),
      "",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      if (esperado) expect(error).toContain(esperado);
    }, 120_000);
  }

  it("desarme: quita lo de la 0558, vuelve el conteo de la 0549, deja las revisiones, y repetirlo no falla", async () => {
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
    const m0549 = leer("supabase/migrations/0549_oficina_revisiones_envio.sql");
    const cuerpo0549 = m0549.slice(
      m0549.indexOf("create or replace function public.office_conteo_revisiones"),
      m0549.indexOf("-- ─── 5. Funciones para el ERP"),
    );
    // El cuerpo vivo, sin espacios, igual al de la 0549 (lo que preparar.mjs compara como deriva).
    const huella = (s: string) => s.replace(/\s+/g, " ").trim();
    const prosrc0549 = huella(cuerpo0549.slice(cuerpo0549.indexOf("$function$") + 10, cuerpo0549.lastIndexOf("$function$")));
    const sql = [
      base,
      leer("supabase/migrations/0541_oficina_cable_tablas.sql"),
      leer("supabase/migrations/0544_oficina_filtro_bandeja.sql"),
      leer("supabase/migrations/0548_oficina_despachador.sql"),
      m0549,
      leer(`supabase/migrations/${M0558}`),
      leer("supabase/desarmes/0558_desarme.sql"),
      leer("supabase/desarmes/0558_desarme.sql"),
      `do $c$ begin
        if to_regclass('public.office_cierres') is not null
           or to_regprocedure('public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint)') is not null
           or to_regprocedure('public.office_registrar_cierre(text, boolean, text, smallint)') is not null
           or to_regprocedure('public.office_conversaciones_por_cerrar(smallint)') is not null then
          raise exception 'el desarme dejó cosas de la 0558';
        end if;
        if to_regclass('public.office_revisiones') is null
           or to_regprocedure('public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint)') is null
           or to_regprocedure('public.office_conteo_revisiones(smallint)') is null then
          raise exception 'el desarme tocó lo que es de la 0549';
        end if;
        if btrim(regexp_replace((select prosrc from pg_proc where oid = 'public.office_conteo_revisiones(smallint)'::regprocedure), '\\s+', ' ', 'g'))
           <> ${"$q$"}${prosrc0549}${"$q$"} then
          raise exception 'el desarme no volvió el conteo al cuerpo de la 0549';
        end if;
        if has_function_privilege('anon', 'public.office_conteo_revisiones(smallint)', 'EXECUTE')
           or not has_function_privilege('authenticated', 'public.office_conteo_revisiones(smallint)', 'EXECUTE') then
          raise exception 'el desarme dejó mal el EXECUTE del conteo';
        end if;
      end $c$;`,
      leer(`supabase/migrations/${M0558}`),
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 90_000);
});
