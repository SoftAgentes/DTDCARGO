// @vitest-environment node
/**
 * SDD-0675 · La migración 0565 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0565_bandeja_concedible_por_persona.test.sql`
 * monta lo mismo que el de la 0538, aplica la 0357, la 0538 y la 0565 REALES y
 * concede, mide y revoca un extra de `bandeja` como lo hará Usuarios.
 *
 * CONTROL ROJO: sin 0565 cae en la primera aserción.
 * MUTANTES: cada uno es una 0565 coherente con un defecto y cae en la aserción
 * que lo nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0565_bandeja_concedible_por_persona.test.sql");
const M0565 = "0565_bandeja_concedible_por_persona.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0565 = read(resolve(ROOT, "supabase/migrations", M0565));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0565"));
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

describe("SDD-0675 · 0565 la Bandeja se concede por persona (PGlite)", () => {
  it("el contrato pasa entero con la 0565", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0565 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0565 bandeja no es concedible y el contrato cae", async () => {
    const run = await contract({ [M0565]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0565: 1: la 0565 deja conceder bandeja/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "abre un módulo no cubierto",
      "    'bandeja'\n  ]::text[])\n$$;",
      "    'bandeja', 'cn'\n  ]::text[])\n$$;",
      /TEST 0565: 4: la lista no se abrió de más/,
    ],
    [
      "pierde un módulo de la 0538",
      "'rates', 'suppliers',\n    'bandeja'",
      "'rates',\n    'bandeja'",
      /0565: la lista de módulos concedibles no quedó|TEST 0565/,
    ],
    [
      "abre admin",
      "    'bandeja'\n  ]::text[])\n$$;",
      "    'bandeja', 'admin'\n  ]::text[])\n$$;",
      /0565: la lista de módulos concedibles no quedó como se esperaba/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0565]: once(FILE_0565, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si bandeja ya es concedible", async () => {
    const run = await contract({ [M0565]: `${FILE_0565}\n${FILE_0565}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565: bandeja ya es concedible/);
  }, SLOW);

  it("PREFLIGHT: sin la 0538 aborta sin crear nada", async () => {
    const run = await contract({ "0538_studio_user_module_grants.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0565 requiere la 0538/);
  }, SLOW);

  it("la 0565 está declarada como espera hasta que Sam la apruebe", () => {
    expect(BASELINE.pendingBelowCutoff["0565_bandeja_concedible_por_persona"]).toMatch(/PENDIENTE DE APLICAR/);
    expect(FILE_0565).toMatch(/NO APLICADA EN NINGÚN ENTORNO/);
  });
});
