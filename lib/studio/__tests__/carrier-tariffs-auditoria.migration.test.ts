// @vitest-environment node
/**
 * SDD-0537 · La migración 0490 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0490_carrier_tariffs_auditoria.test.sql` monta
 * el writer AUD-01 real (0267 + 0294), la tabla real (0330) y la 0490, y
 * escribe como la Server Action (rol authenticated con JWT de admin). PGlite
 * lo corre con los `.sql` inlineados: lo que se prueba es el texto que el
 * runbook aplicará.
 *
 * CONTROL ROJO: sin 0490 el contrato cae (ninguna escritura deja evento).
 * MUTANTES: cada uno es una 0490 coherente con un defecto y tiene que caer.
 * DRIFT: si la función ya existe, el preflight aborta sin cambiar nada.
 * APLICADA: la 0490 salió de las esperas de migrations-baseline.json; la
 * cabecera «NO APLICADA» se conserva porque el ledger guarda el texto exacto.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0490_carrier_tariffs_auditoria.test.sql");
const M0490 = "0490_carrier_tariffs_auditoria.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0490 = read(resolve(ROOT, "supabase/migrations", M0490));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0490"));
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

describe("SDD-0537 · 0490 auditoría del tarifario (PGlite)", () => {
  it("el contrato pasa entero con la 0490", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0490 GREEN: 29 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0490 ninguna escritura deja evento y el contrato cae", async () => {
    const run = await contract({ [M0490]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0490: cada alta de tarifa deja un carrier_tariff_created/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "un UPDATE sin cambio escribe evento",
      "  elsif v_before = v_after then\n",
      "  elsif false then\n",
      /TEST 0490: tocar sólo updated_at/,
    ],
    [
      "quitar no se distingue de editar",
      "    'active', pg_catalog.to_jsonb((v_new->>'deleted_at') is null)\n",
      "    'active', pg_catalog.to_jsonb(true)\n",
      /TEST 0490: quitar la ruta deja carrier_tariff_deleted/,
    ],
    [
      "el actor se pierde y queda como system",
      "    case when v_actor_id is null then 'system' else 'user' end,\n    v_actor_id,\n",
      "    'system',\n    null,\n",
      /TEST 0490: el actor es el usuario del JWT/,
    ],
    [
      "before_data no trae el costo",
      "    'cost_usd_cbm', v_old->'cost_usd_cbm',\n",
      "",
      /TEST 0490: before_data trae costo/,
    ],
    [
      "after_data no trae la venta",
      "    'price_usd_cbm', v_new->'price_usd_cbm',\n",
      "",
      /TEST 0490: after_data trae los nuevos/,
    ],
    [
      "el borrado físico no se audita",
      "  after insert or update or delete on public.carrier_tariffs\n",
      "  after insert or update on public.carrier_tariffs\n",
      /TEST 0490: un DELETE físico deja carrier_tariff_deleted/,
    ],
    [
      "sensibilidad interna en vez de restringida",
      "    1,\n    'restricted'\n",
      "    1,\n    'internal'\n",
      /TEST 0490: fuente, resultado y sensibilidad/,
    ],
    [
      "la función queda ejecutable por la API",
      "revoke all on function public.audit_carrier_tariff_change() from public, anon, authenticated;\n",
      "",
      /0490: audit_carrier_tariff_change quedó ejecutable por la API/,
    ],
    [
      "el tipo de entidad no se registra",
      "values ('carrier_tariff', 'active', 'configuration', 1, 'migration:0490')\n",
      "values ('carrier_tariff_x', 'active', 'configuration', 1, 'migration:0490')\n",
      /0490: falta el tipo de entidad carrier_tariff activo/,
    ],
  ];

  for (const [nombre, from, to, cae] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0490]: once(FILE_0490, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(cae);
    }, SLOW);
  }

  it("DRIFT: si la función ya existe, el preflight aborta antes de tocar nada", async () => {
    const previa =
      "create function public.audit_carrier_tariff_change() returns trigger\n" +
      "language plpgsql as $$ begin return new; end $$;\n";
    const run = await contract({ [M0490]: previa + FILE_0490 });
    expect(run.error).toMatch(/0490 abortado: audit_carrier_tariff_change ya existe/);
  }, SLOW);

  it("DRIFT: sin el writer AUD-01 el preflight aborta", async () => {
    const sinWriter =
      "drop function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text);\n";
    const run = await contract({ [M0490]: sinWriter + FILE_0490 });
    expect(run.error).toMatch(/0490 requiere append_audit_event/);
  }, SLOW);
});

describe("SDD-0537 · 0490 aplicada al servidor propio (texto)", () => {
  it("la cabecera «NO APLICADA» no se corrige: el ledger guarda el texto exacto", () => {
    expect(FILE_0490).toContain("NO APLICADA A PRODUCCIÓN");
    expect(FILE_0490).toContain("docs/runbooks/aplicar-migraciones-prod.md");
  });

  it("aplicada el 2026-10-15 con el OK nominal de Sam: ya no es una espera", () => {
    expect(BASELINE.pendingBelowCutoff["0490_carrier_tariffs_auditoria"]).toBeUndefined();
  });
});
