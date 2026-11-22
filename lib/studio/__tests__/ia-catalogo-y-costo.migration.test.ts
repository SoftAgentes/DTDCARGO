// @vitest-environment node
/**
 * SDD-0704 F1-A · La migración 0570 (catálogo, cuentas, tarifas y topes de la pantalla «IA») corrida de verdad sobre
 * PostgreSQL embebido, con el contrato `supabase/tests/0570_…test.sql` y los `.sql` reales inlineados (la 0541, la
 * 0570 y su desarme).
 *
 * CONTROL ROJO: sin la 0570 el contrato falla. MUTANTES: cada uno quita una barrera de la 0570 y el contrato tiene que
 * caer. El mismo contrato corre en Postgres 17 con Docker en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0570_ia_catalogo_y_costo.test.sql");
const M0570 = "../migrations/0570_ia_catalogo_y_costo.sql";
const PERMITIDAS = new Set(["../migrations/0541_oficina_cable_tablas.sql", M0570, "../desarmes/0570_desarme.sql"]);

type Transform = (sql: string) => string;

function inline(opts: { sin0570?: boolean; migracion?: Transform } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        const ruta = include[1];
        if (!PERMITIDAS.has(ruta)) throw new Error(`\\ir inesperado en el contrato: ${ruta}`);
        if (ruta === M0570 && opts.sin0570) return "";
        const leida = readFileSync(resolve(ROOT, "supabase/tests", ruta), "utf8");
        return ruta === M0570 && opts.migracion ? opts.migracion(leida) : leida;
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

describe("0570 · catálogo y costo de la pantalla IA (PGlite)", () => {
  it("el contrato completo pasa con las migraciones reales (como en Postgres 17)", async () => {
    expect(await run(inline())).toBeNull();
  }, 60_000);

  it("CONTROL ROJO: sin la 0570 el contrato falla", async () => {
    expect(await run(inline({ sin0570: true }))).not.toBeNull();
  }, 60_000);

  const mutantes: Array<[string, Transform, string]> = [
    ["zai entra como no chino", mutar("    check ((proveedor in ('zai', 'deepseek')) = (origen = 'chino'))", "    check (true)"), "CONTRATO 1"],
    [
      "un admin normal escribe",
      mutar("  if not public.is_platform_admin() then\n    raise exception 'ia:solo_superadmin' using errcode = '42501';\n  end if;\n  v_tenant", "  v_tenant"),
      "CONTRATO 2",
    ],
    ["sin motivo", mutar("     or pg_catalog.char_length(p_motivo) not between 4 and 200 then", "     or false then"), "CONTRATO 2"],
    ["la Oficina china", mutar("check (not (uso = 'oficina' and proveedor in ('zai', 'deepseek')))", "check (true)"), "CONTRATO 3"],
    ["plan fijo sin tope", mutar("check (tipo_cobro <> 'plan_fijo' or tope_llamadas_mes is not null)", "check (true)"), "CONTRATO 3"],
    ["nadie pide AAL2", mutar("  raise exception 'ia:requiere_aal2' using errcode = '42501';\nend;", "  return 'sin_barrera';\nend;"), "CONTRATO"],
    ["una contraseña vieja vale", mutar("between v_ahora - 300 and v_ahora + 60", "between v_ahora - 3600 and v_ahora + 60"), "CONTRATO 13"],
    ["cualquier método vale", mutar("       and a.e ->> 'method' = 'password'\n", ""), "CONTRATO 13"],
    ["la contraseña no vale (solo AAL2)", mutar("    return 'contrasena_reciente';", "    raise exception 'ia:requiere_aal2' using errcode = '42501';"), "CONTRATO 13"],
    ["la auditoría no guarda el método", (sql) => sql.split("'metodo', v_metodo").join("'metodo', 'x'"), "CONTRATO 13"],
    ["alta en plan fijo sin AAL2", mutar("    v_afloja := p_tipo_cobro = 'plan_fijo';", "    v_afloja := false;"), "CONTRATO 4"],
    [
      "subir el tope de llamadas no afloja",
      mutar("      or (v_antes.tope_llamadas_mes is not null and p_tope_llamadas > v_antes.tope_llamadas_mes);", ";"),
      "CONTRATO 4",
    ],
    [
      "quitar el tope de llamadas no afloja",
      mutar("      or (v_antes.tope_llamadas_mes is not null and p_tope_llamadas is null)\n", ""),
      "CONTRATO 4",
    ],
    [
      "un alta con tarifa menor no afloja",
      mutar("      v_afloja := v_max_entrada is null\n                  or p_tarifa_entrada < v_max_entrada or p_tarifa_salida < v_max_salida;", "      v_afloja := v_max_entrada is null;"),
      "CONTRATO 5",
    ],
    [
      "la primera tarifa no pide AAL2",
      mutar(
        "      v_afloja := v_max_entrada is null\n                  or p_tarifa_entrada < v_max_entrada or p_tarifa_salida < v_max_salida;",
        "      v_afloja := coalesce(p_tarifa_entrada < v_max_entrada or p_tarifa_salida < v_max_salida, false);",
      ),
      "CONTRATO 5",
    ],
    [
      "bajar una tarifa no afloja",
      mutar("      v_afloja := p_tarifa_entrada < v_antes.tarifa_entrada_usd_mtok or p_tarifa_salida < v_antes.tarifa_salida_usd_mtok;", "      v_afloja := false;"),
      "CONTRATO 5",
    ],
    ["quitar un modelo no afloja", mutar("  v_metodo := public.ia_exigir_aal2_si(v_antes.tarifa_entrada_usd_mtok is not null);", ""), "CONTRATO 5"],
    ["un modelo fuera del catálogo", mutar("  foreign key (proveedor, modelo) references public.ia_catalogo_modelos (proveedor, modelo) on delete restrict,\n", ""), "CONTRATO 5"],
    ["por token sin tarifa", mutar("  if v_cuenta.tipo_cobro = 'por_token' and new.tarifa_entrada_usd_mtok is null then", "  if false then"), "CONTRATO 5"],
    ["subir el tope no afloja", mutar("  v_afloja := v_antes is null or p_tope_usd > v_antes;", "  v_afloja := v_antes is null;"), "CONTRATO 6"],
    ["el primer tope no pide AAL2", mutar("  v_afloja := v_antes is null or p_tope_usd > v_antes;", "  v_afloja := p_tope_usd > v_antes;"), "CONTRATO 6"],
    ["sin techo de la Oficina", mutar("check (funcion <> 'oficina' or tope_usd <= 15)", "check (true)"), "CONTRATO 6"],
    ["quitar el tope no afloja", mutar("  -- Volver al .env puede subir el tope: afloja.\n  v_metodo := public.ia_exigir_aal2_si(true);", ""), "CONTRATO 6"],
    ["la auto-pausa despausa", mutar("    values (true, null,\n            'Auto-pausa: las llamadas", "    values (false, null,\n            'Auto-pausa: las llamadas"), "CONTRATO 9"],
    ["la auto-pausa ignora el umbral", mutar("  if v_llamadas < p_tope * p_umbral then", "  if true then"), "CONTRATO 9"],
    ["el gasto lo ve cualquiera", mutar("  if not public.is_platform_admin() then\n    raise exception 'ia:solo_superadmin' using errcode = '42501';\n  end if;\n  return query", "  return query"), "CONTRATO 10"],
    [
      "authenticated escribe las tablas",
      mutar("grant select on public.ia_catalogo_modelos, public.ia_cuentas, public.ia_modelos, public.ia_topes to authenticated;", "grant select, insert, update on public.ia_catalogo_modelos, public.ia_cuentas, public.ia_modelos, public.ia_topes to authenticated;"),
      "CONTRATO 11",
    ],
    [
      "un admin normal lee la configuración",
      mutar("  for select to authenticated using (public.is_platform_admin() and tenant_id = public.get_user_tenant_id());\ndrop policy if exists ia_modelos_lee_superadmin", "  for select to authenticated using (true);\ndrop policy if exists ia_modelos_lee_superadmin"),
      "CONTRATO 11",
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
