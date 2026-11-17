// @vitest-environment node
/**
 * SDD-0647 · La migración 0553 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0553_crm_tarjetas_clientes_con_carga.test.sql`
 * monta el escenario de la 0506 (carga viva, entregada, cancelada, borrador,
 * borrada, huérfana, de otro tenant, por historial y por fusión), aplica la
 * 0505, la 0506 y la 0553 REALES y mide el alta inicial que la 0553 corre al
 * aplicarse (`crm_alta_tarjetas_clientes`, solo service_role: la vista no escribe).
 *
 * CONTROL ROJO: sin 0553 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0553 coherente con un defecto y cae en la aserción
 * que lo nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0553_crm_tarjetas_clientes_con_carga.test.sql");
const M0553 = "0553_crm_tarjetas_clientes_con_carga.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0553 = read(resolve(ROOT, "supabase/migrations", M0553));
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
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

async function contract(replace: Record<string, string> = {}) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0553"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

describe("SDD-0647 · 0553 tarjetas para los clientes con carga (PGlite)", () => {
  it("el contrato pasa entero con la 0553", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0553 GREEN: 16 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0553 la función no existe y el contrato cae", async () => {
    const run = await contract({ [M0553]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0553: la 0553 crea crm_alta_tarjetas_clientes/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    ["sin alta inicial", "    v_total := v_total + public.crm_alta_tarjetas_clientes(v_tenant);", "    v_total := v_total;", /TEST 0553: el alta inicial crea/],
    ["crea también a los leads", "  where s.segmento = 'cliente'\n", "\n", /TEST 0553: el alta inicial crea/],
    ["fusionada viva recibe tarjeta", "        and c.merged_into_client_id is null\n", "", /TEST 0553: el alta inicial crea|TEST 0553: una ficha fusionada viva/],
    ["aparenta actividad de hoy", ", timestamptz '2000-01-01 00:00:00+00'", ", pg_catalog.now()", /TEST 0553: la tarjeta nueva no aparenta actividad/],
    ["sin heredar el asesor", "'carga_erp', ut.user_id,", "'carga_erp', null,", /TEST 0553: hereda el asesor activo/],
    ["asesor desactivado", "   and ut.disabled_at is null\n", "", /el asesor no es del tenant|TEST 0553: hereda el asesor activo/],
    ["asesor de otro tenant", "   and ut.tenant_id = p_tenant_id\n", "", /el asesor no es del tenant|TEST 0553: hereda el asesor activo|TEST 0553: el alta inicial crea/],
    [
      "abierta a la sesión",
      "revoke all on function public.crm_alta_tarjetas_clientes(uuid) from anon, authenticated;",
      "grant execute on function public.crm_alta_tarjetas_clientes(uuid) to authenticated;",
      /TEST 0553: la ejecuta solo service_role/,
    ],
    ["fuente libre", "'kommo', 'manual', 'carga_erp'));", "'kommo', 'manual', 'carga_erp', 'inventada'));", /TEST 0553: una fuente fuera de la lista no entra/],
    // Sin mutante (equivalentes): quitar `c.deleted_at is null` o `c.tenant_id = p_tenant_id`
    // no cambia nada porque `crm_segmento_clientes` (0506) ya descarta fichas borradas y
    // de otro tenant (sus mutantes están en crm-modelo.migration.test.ts); quitar el
    // `not exists` tampoco, porque `on conflict do nothing` sobre crm_tarjetas_client_uq
    // ya impide la segunda tarjeta. Se conservan como filtro temprano.
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0553]: once(FILE_0553, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si ya existe", async () => {
    const run = await contract({ [M0553]: `${FILE_0553}\n${FILE_0553}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0553: crm_alta_tarjetas_clientes ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la 0506 aborta sin crear nada", async () => {
    const run = await contract({ "0506_crm_modelo.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0553 requiere la 0506/);
  }, SLOW);

  it("la 0553 ya no está en espera: se aplicó en producción con OK de Sam (2026-11-17)", () => {
    // La cabecera del archivo conserva «NO APLICADA…»: el blob está sellado y no se edita.
    expect(BASELINE.pendingBelowCutoff["0553_crm_tarjetas_clientes_con_carga"]).toBeUndefined();
  });
});
