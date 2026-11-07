// @vitest-environment node
/**
 * SDD-0589 · paso 9.3 · La migración 0517 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0517_user_guide_prefs.test.sql` aplica la 0517 REAL y
 * escribe como la acción de Studio (authenticated con el JWT del usuario) y como
 * service_role. PGlite lo corre con los `.sql` inlineados: lo que se prueba es el
 * texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0517 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0517 coherente con un defecto y tiene que caer en la
 * aserción que lo nombra.
 * ESPERA: la 0517 no está aplicada; la última prueba lo fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0517_user_guide_prefs.test.sql");
const M0517 = "0517_user_guide_prefs.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0517 = read(resolve(ROOT, "supabase/migrations", M0517));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0517"));
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

/** El mismo cambio en las dos ramas de la policy (`using` y `with check`). */
function both(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer dos veces`).toHaveLength(3);
  return text.split(from).join(to);
}

describe("SDD-0589 · 0517 estado de la guía por usuario (PGlite)", () => {
  it("el contrato pasa entero con la 0517", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0517 GREEN: 20 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0517 la tabla no existe y el contrato cae", async () => {
    const run = await contract({ [M0517]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0517: existe user_guide_prefs/);
  }, SLOW);

  const MUTANTES: [string, (f: string) => string, RegExp][] = [
    [
      "la policy no mira si el usuario está desactivado",
      (f) => both(f, " and ut.disabled_at is null", ""),
      /TEST 0517: un usuario desactivado no lee su fila/,
    ],
    [
      "la policy no mira el dueño",
      (f) => both(f, "    user_id = (select auth.uid())\n    and tenant_id in (", "    tenant_id in ("),
      /TEST 0517: un compañero del mismo tenant no ve la fila del dueño/,
    ],
    [
      "la policy no mira el tenant",
      (f) =>
        both(
          f,
          "    and tenant_id in (\n      select ut.tenant_id from public.user_tenants ut\n      where ut.user_id = (select auth.uid()) and ut.disabled_at is null\n    )\n",
          "\n",
        ),
      /TEST 0517: (nadie escribe en un tenant al que no pertenece|un usuario desactivado no lee su fila)/,
    ],
    [
      "anon con lectura",
      (f) => once(f, "grant all on public.user_guide_prefs to service_role;", "grant all on public.user_guide_prefs to service_role;\ngrant select on public.user_guide_prefs to anon;"),
      /TEST 0517: anon no lee el estado de la guía/,
    ],
    [
      "sin una fila por tenant y usuario",
      (f) => once(f, ",\n  unique (tenant_id, user_id)\n", "\n"),
      /TEST 0517: una sola fila por tenant y usuario/,
    ],
    [
      "el estado puede ser un arreglo",
      (f) => once(f, "jsonb_typeof(state) = 'object' and ", ""),
      /TEST 0517: el estado es un objeto/,
    ],
    [
      "sin tope de tamaño",
      (f) => once(f, " and pg_catalog.pg_column_size(state) <= 16384", ""),
      /TEST 0517: el estado tiene tope de tamaño/,
    ],
    [
      "sin trigger de updated_at",
      (f) => once(f, "create trigger user_guide_prefs_touch\n  before update on public.user_guide_prefs\n  for each row execute function public.touch_updated_at();\n", ""),
      /TEST 0517: updated_at se mueve con cada cambio/,
    ],
    [
      "sin borrado en cascada con el usuario",
      (f) => once(f, "references auth.users(id) on delete cascade", "references auth.users(id)"),
      /TEST 0517: al borrar el usuario se borra su fila|violates foreign key/,
    ],
  ];

  for (const [nombre, mutar, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0517]: mutar(FILE_0517) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si la tabla ya existe", async () => {
    const run = await contract({ [M0517]: `${FILE_0517}\n${FILE_0517}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0517: user_guide_prefs ya existe/);
  }, SLOW);

  it("la 0517 está declarada en espera y su cabecera dice que no está aplicada", () => {
    expect(BASELINE.pendingBelowCutoff["0517_user_guide_prefs"]).toMatch(/PENDIENTE DE APLICAR/);
    expect(FILE_0517).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
