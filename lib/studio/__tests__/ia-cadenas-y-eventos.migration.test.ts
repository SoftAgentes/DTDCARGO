// @vitest-environment node
/**
 * SDD-0704 F1-B · La migración 0571 (cadena de hasta tres modelos por función y registro de intentos) corrida de
 * verdad sobre PostgreSQL embebido, con el contrato `supabase/tests/0571_…test.sql` y los `.sql` reales inlineados
 * (la 0541, la 0570, la 0571 y su desarme).
 *
 * CONTROL ROJO: sin la 0571 el contrato falla. MUTANTES: cada uno quita una barrera de la 0571 y el contrato tiene que
 * caer. El mismo contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0571_ia_cadenas_y_eventos.test.sql");
const M0571 = "../migrations/0571_ia_cadenas_y_eventos.sql";
const PERMITIDAS = new Set([
  "../migrations/0541_oficina_cable_tablas.sql",
  "../migrations/0570_ia_catalogo_y_costo.sql",
  M0571,
  "../desarmes/0571_desarme.sql",
]);

type Transform = (sql: string) => string;

function inline(opts: { sin0571?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const ruta = include[1];
        if (!PERMITIDAS.has(ruta)) throw new Error(`\\ir inesperado en el contrato: ${ruta}`);
        if (ruta === M0571 && opts.sin0571) return "";
        const leida = readFileSync(resolve(ROOT, "supabase/tests", ruta), "utf8");
        return ruta === M0571 && opts.migracion ? opts.migracion(leida) : leida;
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

/** Como `mutar`, pero cambia la ÚLTIMA aparición (el texto se repite en dos funciones). */
function mutarLaUltima(buscar: string, poner: string): Transform {
  return (sql: string) => {
    const i = sql.lastIndexOf(buscar);
    if (i < 0 || sql.indexOf(buscar) === i) throw new Error(`el mutante esperaba dos apariciones de: ${buscar}`);
    return sql.slice(0, i) + poner + sql.slice(i + buscar.length);
  };
}

/** La lista fija del disparador (funciones con datos de clientes), sin una de ellas. */
const LISTA_CON_DATOS =
  "  new.datos_clientes := new.funcion in (\n    'oficina', 'a3_actas', 'a4a_resumen_interno', 'a4b_resumen_portal', 'a5_documentos', 'a6_agentes');";
function quitarDeLaListaConDatos(funcion: string): Transform {
  return mutar(LISTA_CON_DATOS, LISTA_CON_DATOS.replace(`'${funcion}'`, "'quitada'"));
}

describe("0571 · cadena de modelos y registro de intentos (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 60_000);

  it("CONTROL ROJO: sin la 0571 el contrato falla", async () => {
    expect(await run(inline({ sin0571: true }))).not.toBeNull();
  }, 60_000);

  const mutantes: Array<[string, Transform, string]> = [
    ["un admin normal guarda la cadena", mutar("  v_tenant uuid := public.ia_contexto_de_escritura(p_motivo);", "  v_tenant uuid := public.get_user_tenant_id();"), "CONTRATO 2"],
    ["la Oficina se edita en la F1-B", mutar("p_funcion not in ('a1_noticias', 'a2_brief')", "p_funcion not in ('a1_noticias', 'a2_brief', 'oficina')"), "CONTRATO 2"],
    ["un cuarto puesto pasa la función", mutar("  if v_n not between 1 and 3", "  if v_n not between 1 and 4"), "CONTRATO 2"],
    ["sin llave foránea al catálogo", mutar("  constraint ia_cadenas_modelo_del_catalogo foreign key (proveedor, modelo)\n    references public.ia_catalogo_modelos (proveedor, modelo),\n", ""), "CONTRATO 2"],
    ["un modelo se repite", mutar(",\n  constraint ia_cadenas_sin_repetir unique (tenant_id, funcion, proveedor, modelo)", ""), "CONTRATO 2"],
    ["guardar no reemplaza", mutar("  delete from public.ia_cadenas c where c.tenant_id = v_tenant and c.funcion = p_funcion;\n", ""), "CONTRATO 2"],
    ["sin auditoría", mutar("'ia_cadena_guardada'", "'otro_evento'"), "CONTRATO 3"],
    ["D-2 sin CHECK", mutar("check (not (datos_clientes and proveedor in ('zai', 'deepseek')))", "check (true)"), "CONTRATO 4"],
    ["la marca la elige quien escribe", mutar("  new.datos_clientes := new.funcion in (", "  perform 1 where new.funcion in ("), "CONTRATO 4"],
    ["la cuenta puede ser de otro proveedor", mutar("    if v_cuenta.proveedor <> new.proveedor then", "    if false then"), "CONTRATO 5"],
    ["la cuenta puede ser de otro tenant", mutar(" or v_cuenta.tenant_id <> new.tenant_id", ""), "CONTRATO 5"],
    ["A1 lee la cadena de otro tenant", mutar("     where c.tenant_id = v_tenant and c.funcion = p_funcion\n     order by c.puesto;", "     where c.funcion = p_funcion\n     order by c.puesto;"), "CONTRATO 6"],
    ["se anotan eventos de cualquier función", mutarLaUltima("p_funcion not in ('a1_noticias')", "p_funcion not in ('a1_noticias', 'a2_brief')"), "CONTRATO 6"],
    [
      "cualquiera con tenant anota eventos",
      mutar("  if not public.is_tenant_admin() then\n    raise exception 'ia:sin_permiso' using errcode = '42501';\n  end if;\n", ""),
      "CONTRATO 6",
    ],
    ["un 429 cuenta como salto", mutar("    'falta_de_pago', 'cuenta_suspendida', 'llave_invalida', 'proveedor_caido')),\n  constraint ia_eventos_tokens_validos", "    'falta_de_pago', 'cuenta_suspendida', 'llave_invalida', 'proveedor_caido', 'limite_de_uso')),\n  constraint ia_eventos_tokens_validos"), "CONTRATO 6"],
    ...["a4a_resumen_interno", "a4b_resumen_portal", "a6_agentes", "oficina", "a3_actas", "a5_documentos"].map(
      (f): [string, Transform, string] => [
        `${f} sale de la lista con datos`,
        quitarDeLaListaConDatos(f),
        "CONTRATO 4",
      ],
    ),
    ["el código admite texto", mutar("codigo is null or codigo ~ '^[a-z0-9_.:-]{1,64}$'", "true"), "CONTRATO 6"],
    ["authenticated escribe las tablas", mutar("grant select on public.ia_cadenas, public.ia_eventos to authenticated;", "grant select, insert on public.ia_cadenas, public.ia_eventos to authenticated;"), "0571 postflight"],
    ["service_role borra eventos", mutar("grant select, insert on public.ia_eventos to service_role;", "grant all on public.ia_eventos to service_role;"), "0571 postflight"],
    ["eventos sin RLS", mutar("alter table public.ia_eventos enable row level security;\n", ""), "0571 postflight"],
    [
      "la RLS no mira el tenant",
      mutar("create policy ia_cadenas_lee_superadmin on public.ia_cadenas\n  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());", "create policy ia_cadenas_lee_superadmin on public.ia_cadenas\n  for select to authenticated using (public.is_platform_admin());"),
      "CONTRATO 7",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const error = await run(inline({ migracion }));
      expect(error).not.toBeNull();
      if (esperado) expect(error).toContain(esperado);
    }, 60_000);
  }
});
