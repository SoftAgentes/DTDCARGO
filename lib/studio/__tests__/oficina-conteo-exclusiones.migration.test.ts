// @vitest-environment node
/**
 * SDD-0626 · La migración 0567 (exclusiones del conteo y corrección de cierres, de solo agregar) corrida de verdad
 * sobre PostgreSQL embebido, con el contrato `supabase/tests/0567_…test.sql` y los `.sql` reales inlineados (la
 * 0541, la 0544, la 0548, la 0549, la 0558 y la 0560 de las que depende, la 0567 y su desarme).
 *
 * CONTROL ROJO: sin la 0567 el contrato falla. MUTANTES: cada uno afloja una regla de la 0567 y el contrato tiene que
 * caer. PREFLIGHT: con un conteo vivo que no es el de la 0560 (ni el de la 0567), la migración no se aplica. El
 * contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0567_oficina_conteo_exclusiones.test.sql");
const PERMITIDAS = new Set([
  "0541_oficina_cable_tablas.sql",
  "0544_oficina_filtro_bandeja.sql",
  "0548_oficina_despachador.sql",
  "0549_oficina_revisiones_envio.sql",
  "0558_oficina_casillas_tres_estados.sql",
  "0560_oficina_acuse_en_escalados.sql",
  "0567_oficina_conteo_exclusiones.sql",
]);
const M0558 = "0558_oficina_casillas_tres_estados.sql";
const M0560 = "0560_oficina_acuse_en_escalados.sql";
const M0567 = "0567_oficina_conteo_exclusiones.sql";
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Transform = (sql: string) => string;

function inline(opts: { sin0567?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (!PERMITIDAS.has(nombre)) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0567 && opts.sin0567) return "";
        const leida = leer(`supabase/migrations/${nombre}`);
        return nombre === M0567 && opts.migracion ? opts.migracion(leida) : leida;
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
    if (sql.split(buscar).length !== 2) throw new Error(`el mutante no encontró UNA vez: ${buscar}`);
    return sql.replace(buscar, poner);
  };
}

/** Lo previo del contrato hasta las migraciones de las que depende la 0567 (con la 0560), sin el resto. */
function base(): string {
  const contrato = inline({ sin0567: true });
  return contrato.slice(0, contrato.indexOf("insert into public.platform_admins")).replace(/^begin;$/m, "");
}

/** El prosrc de una función tal como lo escribe el archivo (lo que queda entre los $function$). */
function prosrc(sql: string, fn: string): string {
  const inicio = sql.indexOf(`create or replace function public.${fn}(`);
  if (inicio < 0) throw new Error(`no está ${fn}`);
  const a = sql.indexOf("$function$", inicio) + "$function$".length;
  return sql.slice(a, sql.indexOf("$function$", a));
}
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

describe("0567 · exclusiones del conteo y corrección de cierres (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 120_000);

  it("CONTROL ROJO: sin la 0567 el contrato falla", async () => {
    expect(await run(inline({ sin0567: true }))).not.toBeNull();
  }, 120_000);

  it("APLICADA en producción (2026-11-18 23:43:42Z): fuera de las esperas y sellada con el md5 del ledger", () => {
    const baseline = JSON.parse(leer("supabase/migrations-baseline.json"));
    expect(Object.keys(baseline.pendingBelowCutoff)).not.toContain("0567_oficina_conteo_exclusiones");
    const candado = JSON.parse(leer("supabase/migrations.lock.json"));
    expect(candado.selladas["0567_oficina_conteo_exclusiones"]).toMatchObject({
      md5: "92701f0d57da88cd437d8ea44b5662a0",
      bytes: 25780,
      ledger: { forma: "exacta" },
    });
    expect(md5(leer(`supabase/migrations/${M0567}`))).toBe("92701f0d57da88cd437d8ea44b5662a0");
  });

  it("los md5 del preflight son los de los cuerpos de la 0560, la 0558 y la propia 0567", () => {
    const m0567 = leer(`supabase/migrations/${M0567}`);
    expect(m0567).toContain(md5(prosrc(leer(`supabase/migrations/${M0560}`), "office_conteo_revisiones")));
    expect(m0567).toContain(md5(prosrc(leer(`supabase/migrations/${M0558}`), "office_conversaciones_por_cerrar")));
    expect(m0567).toContain(md5(prosrc(m0567, "office_conteo_revisiones")));
    expect(m0567).toContain(md5(prosrc(m0567, "office_conversaciones_por_cerrar")));
  });

  const mutantes: Array<[string, Transform, string]> = [
    [
      "el conteo no mira las exclusiones",
      mutar(
        "where e.conversacion = p.conv and e.etapa = p_etapa)",
        "where e.conversacion = p.conv and false)",
      ),
      "CONTRATO 1",
    ],
    [
      "la exclusión vale para todas las etapas",
      mutar("where e.conversacion = p.conv and e.etapa = p_etapa)", "where e.conversacion = p.conv)"),
      "CONTRATO 1",
    ],
    [
      "por cerrar sigue listando las excluidas",
      mutar(
        "and not exists (select 1 from public.office_conteo_exclusiones e where e.conversacion = x.conv and e.etapa = p_etapa)",
        "and true",
      ),
      "CONTRATO 1",
    ],
    [
      "por cerrar mira las exclusiones de todas las etapas",
      mutar("where e.conversacion = x.conv and e.etapa = p_etapa)", "where e.conversacion = x.conv)"),
      "CONTRATO 1",
    ],
    [
      "el conteo no mira las correcciones de cierre",
      mutar(
        "where k2.conversacion = p.conv and k2.etapa = p_etapa",
        "where false and k2.conversacion = p.conv and k2.etapa = p_etapa",
      ),
      "CONTRATO 2",
    ],
    [
      "manda la primera corrección y no la última",
      mutar("order by k2.orden desc", "order by k2.orden asc"),
      "CONTRATO 2",
    ],
    [
      "las exclusiones se pueden borrar (sin el disparador de DELETE)",
      mutar(
        "before update or delete on public.office_conteo_exclusiones",
        "before update on public.office_conteo_exclusiones",
      ),
      "CONTRATO 3",
    ],
    [
      "las correcciones se pueden cambiar (sin el disparador de UPDATE)",
      mutar(
        "before update or delete on public.office_cierres_correcciones",
        "before delete on public.office_cierres_correcciones",
      ),
      "CONTRATO 3",
    ],
    [
      "la corrección no exige el cierre original",
      mutar(
        "  if not exists (select 1 from public.office_cierres c where c.conversacion = p_conversacion and c.etapa = p_etapa) then\n",
        "  if false then\n",
      ),
      "CONTRATO 4",
    ],
    [
      "authenticated puede excluir",
      mutar(
        "revoke all on function public.office_excluir_conversacion(text, smallint, text, text) from public, anon, authenticated, service_role;",
        "revoke all on function public.office_excluir_conversacion(text, smallint, text, text) from public, anon, service_role;\ngrant execute on function public.office_excluir_conversacion(text, smallint, text, text) to authenticated;",
      ),
      "0567 postflight",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      expect(error).toContain(esperado);
    }, 120_000);
  }

  it("MUTANTE de postflight: sin él, un EXECUTE de más para authenticated lo ve el contrato", async () => {
    const sinPostflight = (sql: string) =>
      mutar(
        "      if pg_catalog.has_function_privilege(v_rol, v_firma, 'EXECUTE') then\n",
        "      if false then\n",
      )(
        mutar(
          "revoke all on function public.office_excluir_conversacion(text, smallint, text, text) from public, anon, authenticated, service_role;",
          "revoke all on function public.office_excluir_conversacion(text, smallint, text, text) from public, anon, service_role;\ngrant execute on function public.office_excluir_conversacion(text, smallint, text, text) to authenticated;",
        )(sql),
      );
    const error = await run(inline({ migracion: sinPostflight }));
    expect(error).toContain("CONTRATO 4");
  }, 120_000);

  it("PREFLIGHT: con un conteo vivo que no es el de la 0560, la 0567 no se aplica", async () => {
    const m0560 = leer(`supabase/migrations/${M0560}`);
    const cuerpo = m0560.slice(
      m0560.indexOf("create or replace function public.office_conteo_revisiones"),
      m0560.indexOf("alter function public.office_conteo_revisiones"),
    );
    const otro = cuerpo.replace("#variable_conflict use_column", "#variable_conflict use_column\n-- cambiado por fuera");
    expect(otro).not.toBe(cuerpo);
    const error = await run([base(), otro, leer(`supabase/migrations/${M0567}`)].join("\n"));
    expect(error).toContain("0567: el conteo vivo no es el de la 0560 ni el de la 0567");
  }, 120_000);

  it("PREFLIGHT: con una lista de por cerrar que no es la de la 0558, la 0567 no se aplica", async () => {
    const m0558 = leer(`supabase/migrations/${M0558}`);
    const cuerpo = m0558.slice(
      m0558.indexOf("create or replace function public.office_conversaciones_por_cerrar"),
      m0558.indexOf("-- LA consulta de conteo de AC-1"),
    );
    const otro = cuerpo.replace("#variable_conflict use_column", "#variable_conflict use_column\n-- cambiado por fuera");
    expect(otro).not.toBe(cuerpo);
    const error = await run([base(), otro, leer(`supabase/migrations/${M0567}`)].join("\n"));
    expect(error).toContain("0567: la lista de por cerrar viva no es la de la 0558 ni la de la 0567");
  }, 120_000);

  it("desarme: vuelve el conteo a la 0560 y por cerrar a la 0558, quita la escritura, deja las tablas, repetirlo no falla y la 0567 vuelve a aplicarse", async () => {
    const md5Conteo0560 = md5(prosrc(leer(`supabase/migrations/${M0560}`), "office_conteo_revisiones"));
    const md5PorCerrar0558 = md5(prosrc(leer(`supabase/migrations/${M0558}`), "office_conversaciones_por_cerrar"));
    const desarme = leer("supabase/desarmes/0567_desarme.sql");
    const sql = [
      base(),
      leer(`supabase/migrations/${M0567}`),
      desarme,
      desarme,
      `do $c$ begin
        if md5((select prosrc from pg_proc where oid = 'public.office_conteo_revisiones(smallint)'::regprocedure)) <> '${md5Conteo0560}' then
          raise exception 'el desarme no volvió el conteo al cuerpo de la 0560';
        end if;
        if md5((select prosrc from pg_proc where oid = 'public.office_conversaciones_por_cerrar(smallint)'::regprocedure)) <> '${md5PorCerrar0558}' then
          raise exception 'el desarme no volvió por cerrar al cuerpo de la 0558';
        end if;
        if to_regprocedure('public.office_excluir_conversacion(text, smallint, text, text)') is not null
           or to_regprocedure('public.office_corregir_cierre(text, smallint, boolean, text, text)') is not null then
          raise exception 'el desarme dejó la vía de escritura';
        end if;
        if to_regclass('public.office_conteo_exclusiones') is null or to_regclass('public.office_cierres_correcciones') is null then
          raise exception 'el desarme borró las tablas de solo agregar';
        end if;
        if has_function_privilege('anon', 'public.office_conteo_revisiones(smallint)', 'EXECUTE')
           or not has_function_privilege('authenticated', 'public.office_conteo_revisiones(smallint)', 'EXECUTE')
           or not has_function_privilege('authenticated', 'public.office_conversaciones_por_cerrar(smallint)', 'EXECUTE') then
          raise exception 'el desarme dejó mal el EXECUTE';
        end if;
        if obj_description('public.office_conteo_revisiones(smallint)'::regprocedure, 'pg_proc') like '%0567%'
           or obj_description('public.office_conversaciones_por_cerrar(smallint)'::regprocedure, 'pg_proc') like '%0567%' then
          raise exception 'el desarme no volvió los comentarios';
        end if;
      end $c$;`,
      leer(`supabase/migrations/${M0567}`),
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 90_000);
});
