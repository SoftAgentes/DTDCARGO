// @vitest-environment node
/**
 * SDD-0588 · paso 3.4 · La migración 0509 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0509_chatwoot_version_analyses.test.sql` aplica la
 * 0507 y la 0509 REALES y escribe como la acción de Studio (service_role) y como
 * un usuario de Studio (authenticated con su JWT). PGlite lo corre con los `.sql`
 * inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0509 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0509 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * APLICADA: la 0509 salió de la espera el 2026-11-04 (runbook §6); la última
 * prueba lo fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0509_chatwoot_version_analyses.test.sql");
const M0509 = "0509_chatwoot_version_analyses.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0509 = read(resolve(ROOT, "supabase/migrations", M0509));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0509"));
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

describe("SDD-0588 · 0509 análisis de versiones de Chatwoot (PGlite)", () => {
  it("el contrato pasa entero con la 0509", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0509 GREEN: 21 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0509 la tabla no existe y el contrato cae", async () => {
    const run = await contract({ [M0509]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0509: existe chatwoot_version_analyses/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "análisis legibles por cualquiera del tenant",
      "    tenant_id = (select public.get_user_tenant_id())\n    and (select public.is_tenant_admin())\n  );",
      "    tenant_id = (select public.get_user_tenant_id())\n  );",
      /TEST 0509: quien no es admin no ve los análisis/,
    ],
    [
      "análisis legibles entre tenants",
      "    tenant_id = (select public.get_user_tenant_id())\n    and (select public.is_tenant_admin())",
      "    (select public.is_tenant_admin())",
      /TEST 0509: el admin de T1 ve solo el análisis de T1/,
    ],
    [
      "INSERT concedido a authenticated",
      "grant select on public.chatwoot_version_analyses to authenticated;",
      "grant select, insert on public.chatwoot_version_analyses to authenticated;\ncreate policy chatwoot_version_analyses_insert on public.chatwoot_version_analyses for insert to authenticated with check (true);",
      /TEST 0509: ni el admin escribe análisis/,
    ],
    [
      "UPDATE concedido a authenticated",
      "grant select on public.chatwoot_version_analyses to authenticated;",
      "grant select, update on public.chatwoot_version_analyses to authenticated;\ncreate policy chatwoot_version_analyses_update on public.chatwoot_version_analyses for update to authenticated using (true);",
      /TEST 0509: nadie edita un análisis/,
    ],
    [
      "sin IA puede decir no actualizar",
      "  check (engine = 'glm' or recommendation <> 'no_actualizar')",
      "  check (true)",
      /TEST 0509: sin IA el informe nunca dice no actualizar/,
    ],
    [
      "respaldo sin motivo",
      "  check ((engine = 'sin_ia') = (fallback_reason is not null)),\n",
      "",
      /TEST 0509: un análisis sin IA dice por qué/,
    ],
    [
      "con IA sin modelo",
      "  check ((engine = 'glm') = (model is not null)),\n",
      "",
      /TEST 0509: un análisis con IA dice qué modelo/,
    ],
    [
      "sin tope de tamaño del informe",
      " and pg_catalog.pg_column_size(report) <= 65536",
      "",
      /TEST 0509: el informe tiene tope de tamaño/,
    ],
    [
      "salto a la misma versión",
      "  check (from_version <> to_version),\n",
      "",
      /TEST 0509: no se analiza el salto a la misma versión/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0509]: once(FILE_0509, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si la tabla ya existe", async () => {
    const run = await contract({ [M0509]: `${FILE_0509}\n${FILE_0509}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0509: chatwoot_version_analyses ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la 0507 la 0509 no se aplica", async () => {
    const run = await contract({ "0507_chatwoot_versiones.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0509 requiere .*la 0507/);
  }, SLOW);

  it("la 0509 salió de la espera al aplicarse, y su cabecera no se corrige (runbook §6)", () => {
    expect(BASELINE.pendingBelowCutoff["0509_chatwoot_version_analyses"]).toBeUndefined();
    expect(FILE_0509).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
