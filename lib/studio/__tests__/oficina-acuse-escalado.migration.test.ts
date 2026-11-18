// @vitest-environment node
/**
 * SDD-0626 · La migración 0560 («Acuse» en los escalados) corrida de verdad sobre PostgreSQL embebido, con el
 * contrato `supabase/tests/0560_…test.sql` y los `.sql` reales inlineados (la 0541, la 0544, la 0548, la 0549 y la
 * 0558 de las que depende, la 0560 y su desarme).
 *
 * CONTROL ROJO: sin la 0560 el contrato falla. MUTANTES: cada uno afloja la regla de la 0560 y el contrato tiene que
 * caer. PREFLIGHT: con un escalado de criterio 2 con «Acuse» sin evaluar ANTES de la 0560, la migración no se
 * aplica (y el mensaje solo dice cuántas filas). El contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0560_oficina_acuse_en_escalados.test.sql");
const PERMITIDAS = new Set([
  "0541_oficina_cable_tablas.sql",
  "0544_oficina_filtro_bandeja.sql",
  "0548_oficina_despachador.sql",
  "0549_oficina_revisiones_envio.sql",
  "0558_oficina_casillas_tres_estados.sql",
  "0560_oficina_acuse_en_escalados.sql",
]);
const M0558 = "0558_oficina_casillas_tres_estados.sql";
const M0560 = "0560_oficina_acuse_en_escalados.sql";
const leer = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

type Transform = (sql: string) => string;

function inline(opts: { sin0560?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const nombre = include[1].replace("../migrations/", "");
        if (!PERMITIDAS.has(nombre)) throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        if (nombre === M0560 && opts.sin0560) return "";
        const leida = leer(`supabase/migrations/${nombre}`);
        return nombre === M0560 && opts.migracion ? opts.migracion(leida) : leida;
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
    // Una sola vez: el postflight busca la regla en el cuerpo vivo, así que solo se muta el cuerpo.
    if (sql.split(buscar).length !== 2) throw new Error(`el mutante no encontró UNA vez: ${buscar}`);
    return sql.replace(buscar, poner);
  };
}

/** Lo previo del contrato hasta las migraciones de las que depende la 0560, sin el resto. */
function base(): string {
  const contrato = inline({ sin0560: true });
  return contrato.slice(0, contrato.indexOf("insert into public.platform_admins")).replace(/^begin;$/m, "");
}

describe("0560 · «Acuse» en los escalados (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 120_000);

  it("CONTROL ROJO: sin la 0560 el contrato falla", async () => {
    const error = await run(inline({ sin0560: true }));
    expect(error).toContain("CONTRATO 2");
  }, 120_000);

  const mutantes: Array<[string, Transform, string]> = [
    [
      "«Acuse» en null basta también en una respuesta (sin mirar el tipo)",
      mutar("and (r.c_acuse is true or (r.tipo_borrador = 'escalado' and r.c_acuse is null))", "and (r.c_acuse is true or r.c_acuse is null) /* r.tipo_borrador = 'escalado' and r.c_acuse is null */"),
      "CONTRATO 2",
    ],
    [
      "en un escalado, «Acuse» en false también basta",
      mutar("and (r.c_acuse is true or (r.tipo_borrador = 'escalado' and r.c_acuse is null))", "and (r.c_acuse is true or r.tipo_borrador = 'escalado') /* r.tipo_borrador = 'escalado' and r.c_acuse is null */"),
      "CONTRATO 2",
    ],
    [
      "en un escalado, otra casilla en null también basta",
      mutar("                                 and r.c_guion_o_escalado is true\n", "                                 and r.c_guion_o_escalado is not false\n"),
      "CONTRATO 2",
    ],
    [
      "el escalado se reconoce por algo que no es el tipo del borrador",
      mutar("and (r.c_acuse is true or (r.tipo_borrador = 'escalado' and r.c_acuse is null))", "and (r.c_acuse is true or (r.c_cierre_3 is null and r.c_acuse is null)) /* r.tipo_borrador = 'escalado' and r.c_acuse is null */"),
      "CONTRATO 2",
    ],
    [
      "un cierre que falló deja de restar",
      mutar("p.correcta_mensajes and c.cumple is distinct from false\n", "p.correcta_mensajes\n"),
      "CONTRATO 2",
    ],
    [
      "anon llama al conteo",
      mutar(
        "grant execute on function public.office_conteo_revisiones(smallint) to authenticated;",
        "grant execute on function public.office_conteo_revisiones(smallint) to authenticated, anon;",
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

  // Un escalado de criterio 2 con «Acuse» sin evaluar, guardado con la 0558 (antes de la 0560).
  const filaAntes = `
    insert into public.platform_admins (user_id) values ('00000000-0000-4000-8000-00000000a001');
    insert into public.office_paused (pausada, motivo) values (false, 'Preflight 0560.');
    do $f$
    declare r record; b uuid;
    begin
      insert into public.event_inbox (tipo, origen, clave_dedupe, prioridad, payload_ref, estado, triaje_en)
      values ('chatwoot.message_created', 'chatwoot', 'chatwoot:conv:7:msg:7', 2,
              'chatwoot:conversations/7/messages/7', 'triaje', now());
      perform public.office_convertir_triaje('soporte-chatwoot', 20);
      select * into r from public.office_tomar_tarea('soporte-chatwoot', 0, 300);
      perform public.office_entregar_corrida(r.task_id, r.run_id, 'escalado', null, null, 'dinero', 3::smallint,
        'sistema:despachador', 'Escalado.');
      b := (select id from public.office_borradores where run_id = r.run_id);
      perform set_config('test.uid', '00000000-0000-4000-8000-00000000a001', true);
      set local role authenticated;
      perform public.office_revisar_borrador_v2(b, 'aprobado', null, true, true, true, 'x', 1::smallint);
      reset role;
    end $f$;`;

  it("PREFLIGHT: con un escalado de criterio 2 con «Acuse» sin evaluar, la 0560 no se aplica y solo dice cuántas", async () => {
    const error = await run([base(), filaAntes, leer(`supabase/migrations/${M0560}`)].join("\n"));
    expect(error).toContain("0560: hay 1 revisiones de criterio 2 de escalados con «Acuse» sin evaluar");
    expect(error).not.toMatch(/chatwoot:|dinero|0000-4000/);
  }, 120_000);

  it("PREFLIGHT, control: sin esa fila (otro null, en una respuesta) la 0560 se aplica", async () => {
    const sinLaFila = filaAntes
      .replace("'escalado', null, null, 'dinero', 3::smallint", "'respuesta', 'Hola.', 'acuse-general', null, null");
    const sql = [base(), sinLaFila, leer(`supabase/migrations/${M0560}`)].join("\n");
    expect(await run(sql)).toBeNull();
  }, 120_000);

  it("PREFLIGHT: «ya aplicada» es el md5 exacto del cuerpo, no un texto: un conteo que solo trae la regla en un comentario no lo burla", async () => {
    const m0558 = leer(`supabase/migrations/${M0558}`);
    const cuerpo = m0558.slice(
      m0558.indexOf("create or replace function public.office_conteo_revisiones"),
      m0558.indexOf("-- ─── 4. Dueño, privilegios y comentarios"),
    );
    // El conteo de la 0558 con la marca de la 0560 en un comentario (lo que un strpos tomaría por «ya aplicada»).
    const falso = cuerpo.replace(
      "#variable_conflict use_column",
      "#variable_conflict use_column\n-- r.tipo_borrador = 'escalado' and r.c_acuse is null",
    );
    expect(falso).not.toBe(cuerpo);
    const error = await run([base(), filaAntes, falso, leer(`supabase/migrations/${M0560}`)].join("\n"));
    expect(error).toContain("0560: hay 1 revisiones de criterio 2 de escalados");
  }, 120_000);

  it("sin la comprobación de filas la 0560 se aplicaría encima: lo que frena es el preflight", async () => {
    const sinPreflight = mutar("  if v_n > 0 then\n", "  if false then\n")(leer(`supabase/migrations/${M0560}`));
    expect(await run([base(), filaAntes, sinPreflight].join("\n"))).toBeNull();
  }, 120_000);

  it("desarme: vuelve el conteo al cuerpo de la 0558, no toca filas, repetirlo no falla y la 0560 vuelve a aplicarse", async () => {
    const m0558 = leer(`supabase/migrations/${M0558}`);
    const cuerpo0558 = m0558.slice(
      m0558.indexOf("create or replace function public.office_conteo_revisiones"),
      m0558.indexOf("-- ─── 4. Dueño, privilegios y comentarios"),
    );
    const huella = (s: string) => s.replace(/\s+/g, " ").trim();
    const prosrc0558 = huella(cuerpo0558.slice(cuerpo0558.indexOf("$function$") + 10, cuerpo0558.lastIndexOf("$function$")));
    const sql = [
      base(),
      leer(`supabase/migrations/${M0560}`),
      leer("supabase/desarmes/0560_desarme.sql"),
      leer("supabase/desarmes/0560_desarme.sql"),
      `do $c$ begin
        if btrim(regexp_replace((select prosrc from pg_proc where oid = 'public.office_conteo_revisiones(smallint)'::regprocedure), '\\s+', ' ', 'g'))
           <> ${"$q$"}${prosrc0558}${"$q$"} then
          raise exception 'el desarme no volvió el conteo al cuerpo de la 0558';
        end if;
        if has_function_privilege('anon', 'public.office_conteo_revisiones(smallint)', 'EXECUTE')
           or not has_function_privilege('authenticated', 'public.office_conteo_revisiones(smallint)', 'EXECUTE') then
          raise exception 'el desarme dejó mal el EXECUTE del conteo';
        end if;
        if obj_description('public.office_conteo_revisiones(smallint)'::regprocedure, 'pg_proc') not like '%regla de la 0558: solo criterio 2;%'
           or obj_description('public.office_conteo_revisiones(smallint)'::regprocedure, 'pg_proc') like '%0560%' then
          raise exception 'el desarme no volvió el comentario de la 0558';
        end if;
        if to_regclass('public.office_cierres') is null
           or to_regprocedure('public.office_revisar_borrador_v2(uuid, text, boolean, boolean, boolean, boolean, text, smallint)') is null then
          raise exception 'el desarme de la 0560 tocó lo que es de la 0558';
        end if;
      end $c$;`,
      leer(`supabase/migrations/${M0560}`),
    ].join("\n");
    expect(await run(sql)).toBeNull();
  }, 90_000);
});
