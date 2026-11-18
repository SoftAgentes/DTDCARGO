// @vitest-environment node
/**
 * SDD-0653 fase A2b · La migración 0556 (reglas de nómina con vigencia, monedas, aportes patronales y
 * escalas) corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0556_nomina_reglas_vigencia_y_aportes.test.sql` aplica las migraciones REALES
 * 0160, 0162 y 0556 sobre un fixture sintético. PGlite lo corre con los `.sql` inlineados: lo que se prueba
 * es el texto que se aplicará.
 *
 * CONTROL ROJO: sin la 0556 el contrato cae.
 * PREFLIGHT: aborta con utilidades fuera de 30 a 120 y sin la policy de la 0162.
 * DESARME: la vuelta vive solo aquí (el control C4 del CI no copia supabase/desarmes/): se mete el desarme
 * REAL antes del cierre del contrato y otra aserción prueba que la 0556 se puede volver a aplicar.
 * MUTANTES: cada uno es una 0556 con UN defecto y tiene que caer con el mensaje que lo nombra.
 * GEMELA: las columnas de la migración son exactamente las que el código lee (COLUMNAS_0556).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";
import { COLUMNAS_0556 } from "../payroll-rules-queries";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0556_nomina_reglas_vigencia_y_aportes.test.sql");
const M0556 = "0556_nomina_reglas_vigencia_y_aportes.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0556 = read(resolve(ROOT, "supabase/migrations", M0556));
const DESARME = read(resolve(ROOT, "supabase/desarmes/0556_desarme.sql"));
const SLOW = 180_000;

/** psql → SQL plano: quita \set e inlinea \ir. `replace` sustituye un archivo por el final de su ruta. */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key !== undefined ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    for (const line of source(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        out.push(line);
      } else if (meta[1] === "ir") {
        run(resolve(dirname(path), meta[2].trim()));
      } else if (meta[1] !== "set") {
        throw new Error("metaorden psql no soportada: \\" + meta[1]);
      }
    }
  }
  run(file);
  return out.join("\n");
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const CIERRE =
  "rollback;\nselect to_regclass('public.nomina_payroll_rules') is null as nomina_0556_fixture_rolled_back;";

async function contract(opts: { replace?: Record<string, string>; antesDelCierre?: string } = {}) {
  const db = await pgliteLimpio();
  try {
    let sql = inline(CONTRACT, opts.replace ?? {});
    if (opts.antesDelCierre !== undefined) sql = once(sql, CIERRE, opts.antesDelCierre + "\n" + CIERRE);
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const verde = rows.some((row) => row.nomina_0556_fixture_rolled_back === true);
    return { error: null as string | null, verde };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), verde: false };
  } finally {
    await db.close();
  }
}

const conMigracion = (sql: string) => ({ replace: { [M0556]: sql } });

/** Cada mutante: la 0556 con un defecto y el texto con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "la contribución de pensiones sin el tope legal de 15",
    sql: () => once(FILE_0556, "pension_contrib_pct between 0 and 15", "pension_contrib_pct between 0 and 100"),
    cae: "el CHECK aceptó «contribución de pensiones en 15,01»",
  },
  {
    nombre: "el CHECK de utilidades acepta cualquier cantidad",
    sql: () => once(FILE_0556, "check (utilidades_days between 30 and 120)", "check (utilidades_days between 0 and 1000)"),
    cae: "el CHECK aceptó «utilidades en 29»",
  },
  {
    nombre: "rellena vigente_desde de las versiones anteriores (UPDATE)",
    sql: () =>
      once(
        FILE_0556,
        "alter column vigente_desde set default current_date;",
        "alter column vigente_desde set default current_date;\nupdate public.nomina_payroll_rules set vigente_desde = created_at::date;",
      ),
    cae: "TEST 0556: la migración tocó una fila existente",
  },
  {
    nombre: "las monedas anteriores se reinterpretan como USD",
    sql: () =>
      once(
        FILE_0556,
        "add column if not exists cestaticket_moneda          text not null default 'VES'",
        "add column if not exists cestaticket_moneda          text not null default 'USD'",
      ),
    cae: "TEST 0556: una versión anterior no quedó en bolívares",
  },
  {
    nombre: "los aportes patronales con otro default",
    sql: () =>
      once(
        FILE_0556,
        "add column if not exists sso_patronal_pct            numeric(5,2) not null default 9",
        "add column if not exists sso_patronal_pct            numeric(5,2) not null default 11",
      ),
    cae: "TEST 0556: los defaults de aportes y escalas no son los de la spec",
  },
  {
    nombre: "una policy abierta: cualquier admin ve todos los tenants",
    sql: () =>
      FILE_0556 +
      '\ndrop policy "nomina_payroll_rules by tenant and role" on public.nomina_payroll_rules;\n' +
      'create policy "nomina_payroll_rules by tenant and role" on public.nomina_payroll_rules for all to authenticated\n' +
      "  using ((select public.nomina_can_access())) with check ((select public.nomina_can_access()));",
    cae: "TEST 0556: el admin del tenant 1 ve",
  },
  {
    nombre: "anon recibe SELECT",
    sql: () => FILE_0556 + "\ngrant select on public.nomina_payroll_rules to anon;",
    cae: "TEST 0556: anon ganó SELECT sobre nomina_payroll_rules",
  },
  {
    nombre: "la migración no es idempotente (ADD COLUMN sin IF NOT EXISTS)",
    sql: () => once(FILE_0556, "add column if not exists vigente_desde               date,", "add column vigente_desde               date,"),
    cae: "already exists",
  },
];

const BLOQUE_DESARME = `-- (Z) El desarme quita todo lo de la 0556 y conserva las filas; la 0556 se puede volver a aplicar.
create temp table filas_antes_desarme as select id, version, min_salary, notes from public.nomina_payroll_rules;
${DESARME}
do $desarme$
declare
  v_c text;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nomina_payroll_rules'
              and column_name in ('vigente_desde', 'fuente_legal', 'ingreso_minimo_integral_usd', 'cestaticket_moneda',
                                  'bono_guerra_moneda', 'sso_patronal_pct', 'rpe_patronal_pct', 'faov_patronal_pct',
                                  'inces_patronal_pct', 'inces_utilidades_pct', 'pension_contrib_pct',
                                  'vacaciones_extra_max', 'bono_vacacional_max_days')) then
    raise exception 'TEST 0556 (Z): el desarme dejó columnas de la 0556';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.nomina_payroll_rules'::regclass
              and conname in ('nomina_payroll_rules_fuente_legal_corta', 'nomina_payroll_rules_imi_no_negativo',
                              'nomina_payroll_rules_cestaticket_moneda', 'nomina_payroll_rules_bono_guerra_moneda',
                              'nomina_payroll_rules_aportes_patronales_rango', 'nomina_payroll_rules_pension_contrib_tope',
                              'nomina_payroll_rules_escalas_no_negativas', 'nomina_payroll_rules_utilidades_rango')) then
    raise exception 'TEST 0556 (Z): el desarme dejó restricciones de la 0556';
  end if;
  if (select count(*) from public.nomina_payroll_rules) <> (select count(*) from filas_antes_desarme)
     or exists (select 1 from public.nomina_payroll_rules r join filas_antes_desarme f on f.id = r.id
                 where r.version is distinct from f.version or r.min_salary is distinct from f.min_salary
                    or r.notes is distinct from f.notes) then
    raise exception 'TEST 0556 (Z): el desarme tocó las filas';
  end if;
  if (select count(*) from pg_policy where polrelid = 'public.nomina_payroll_rules'::regclass) <> 1 then
    raise exception 'TEST 0556 (Z): el desarme tocó la policy';
  end if;
end;
$desarme$;
${FILE_0556}
do $reaplicada$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nomina_payroll_rules'
                  and column_name = 'vigente_desde') then
    raise exception 'TEST 0556 (Z): la 0556 no se pudo volver a aplicar tras el desarme';
  end if;
end;
$reaplicada$;`;

describe("SDD-0653 A2b · 0556 reglas de nómina con vigencia y aportes (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0556",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.verde).toBe(true);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0556 el contrato cae",
    async () => {
      const run = await contract(conMigracion("select 1;"));
      expect(run.verde).toBe(false);
      expect(run.error).toContain("vigente_desde");
    },
    SLOW,
  );

  it(
    "el preflight aborta si una versión tiene utilidades fuera de 30 a 120",
    async () => {
      const run = await contract(
        conMigracion(
          "insert into public.nomina_payroll_rules (tenant_id, version, status, utilidades_days)\n" +
            "values ('10000000-0653-0000-0000-000000000001', 7, 'archivada', 20);\n" +
            FILE_0556,
        ),
      );
      expect(run.verde).toBe(false);
      expect(run.error).toContain("0556 abortada: 1 versión(es) de reglas con utilidades_days fuera de 30 a 120");
    },
    SLOW,
  );

  it(
    "el preflight aborta sin la policy de la 0162",
    async () => {
      const run = await contract(
        conMigracion(
          'drop policy "nomina_payroll_rules by tenant and role" on public.nomina_payroll_rules;\n' + FILE_0556,
        ),
      );
      expect(run.verde).toBe(false);
      expect(run.error).toContain("0556 requiere la policy");
    },
    SLOW,
  );

  it(
    "DESARME: quita columnas y restricciones, conserva filas y policy, y la 0556 se vuelve a aplicar",
    async () => {
      const run = await contract({ antesDelCierre: BLOQUE_DESARME });
      expect(run.error).toBeNull();
      expect(run.verde).toBe(true);
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract(conMigracion(sql()));
      expect(run.verde).toBe(false);
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("GEMELA: las columnas que agrega la migración son exactamente las que el código lee", () => {
    const delSql = [...FILE_0556.matchAll(/add column if not exists (\w+)/g)].map((m) => m[1]).sort();
    expect(delSql).toHaveLength(13);
    expect([...COLUMNAS_0556].sort()).toEqual(delSql);
  });
});
