// @vitest-environment node
/**
 * SDD-0491 · La migración 0469 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0469_recepcion_codigo_wr.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de la 0449 y la 0469 inlineados: lo que
 * se prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0469 la primera alta del Studio choca con el NOT NULL de
 * receipt_code, porque nadie lo llena. MUTANTES: sin cada regla, el contrato
 * cae en la aserción de esa regla.
 *
 * PGlite tiene UNA conexión: que el lock consultivo serialice dos altas a la
 * vez lo prueban sesiones reales en
 * `supabase/tests/0469_recepcion_codigo_wr_carrera.test.sql`. Acá el contrato
 * comprueba que el alta deja tomado el lock 491 de su tenant.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0469_recepcion_codigo_wr.test.sql");
const M0469 = "0469_recepcion_codigo_wr.sql";
const FILE_0469 = readFileSync(resolve(ROOT, "supabase/migrations", M0469), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
 */
function inline(file: string, vars: Record<string, string>, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  const read = (path: string) => {
    const key = Object.keys(replace).find((name) => path.endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of read(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        if (active()) out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const text = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
          if (!TRUE.test(text) && !FALSE.test(text)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(text);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack[stack.length - 1];
        frame.active = !frame.taken;
      } else if (command === "endif") {
        stack.pop();
      } else if (!active()) {
        continue;
      } else if (command === "set") {
        const [name, value] = rest.trim().split(/\s+/);
        if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; migration?: string } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    options.migration ? { [M0469]: options.migration } : {});
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0469 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0469 con esos cambios; falla si un texto a cambiar no aparece una sola vez. */
function mutant(changes: [from: string, to: string][]): string {
  let text = FILE_0469;
  for (const [from, to] of changes) {
    expect(text.split(from)).toHaveLength(2);
    text = text.replace(from, () => to);
  }
  return text;
}

const LOCK = "TEST 0469: el alta del Studio toma el lock consultivo 491 de su tenant hasta el COMMIT";
const DELETED = "TEST 0469: el Studio reusó el número de una recepción borrada";
const PAD = "pg_catalog.lpad(v_next::text, greatest(4, pg_catalog.char_length(v_next::text)), '0');";

describe("SDD-0491 · 0469 numera la recepción que llega sin código (PGlite)", () => {
  it("el contrato pasa con 0469", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toBe("TEST 0469 GREEN: 15 aserciones");
  }, SLOW);

  it("control rojo: sin 0469 la primera alta del Studio choca con el NOT NULL", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe(
      'null value in column "receipt_code" of relation "warehouse_receipts_cn" violates not-null constraint',
    );
  }, SLOW);

  const MUTANTS: { name: string; changes: [string, string][]; fails: string }[] = [
    {
      name: "sin el lock consultivo",
      changes: [["  perform pg_catalog.pg_advisory_xact_lock(491, pg_catalog.hashtext(new.tenant_id::text));\n", ""]],
      fails: LOCK,
    },
    {
      name: "con un lock global en vez de uno por tenant",
      changes: [["pg_catalog.pg_advisory_xact_lock(491, pg_catalog.hashtext(new.tenant_id::text))",
        "pg_catalog.pg_advisory_xact_lock(491, 0)"]],
      fails: LOCK,
    },
    {
      // El postflight exige DEFINER: se neutraliza para ver qué pasa en el alta.
      name: "SECURITY INVOKER, que no ve las borradas por la RLS",
      changes: [["language plpgsql\nsecurity definer\n", "language plpgsql\nsecurity invoker\n"],
        ["       and p.prosecdef\n", ""]],
      fails: DELETED,
    },
    {
      // Pisa también el código de la borrada del fixture, y cae ahí.
      name: "que pisa el código que llega hecho",
      changes: [["  if new.receipt_code is not null and pg_catalog.btrim(new.receipt_code) <> '' then\n    return new;\n  end if;\n", ""]],
      fails: DELETED,
    },
    {
      name: "que no numera un código en blanco",
      changes: [["  if new.receipt_code is not null and pg_catalog.btrim(new.receipt_code) <> '' then",
        "  if new.receipt_code is not null then"]],
      fails: "TEST 0469: un código en blanco no se numeró",
    },
    {
      name: "que numera la huérfana en la serie WR-",
      changes: [["  if new.is_orphan then\n", "  if false then\n"]],
      fails: "TEST 0469: la primera huérfana no salió SIN-CODIGO-0001",
    },
    {
      name: "con lpad(…, 4), que trunca pasado 9999",
      changes: [[`${PAD}\n  else`, "pg_catalog.lpad(v_next::text, 4, '0');\n  else"],
        [`${PAD}\n  end if;`, "pg_catalog.lpad(v_next::text, 4, '0');\n  end if;"]],
      fails: "TEST 0469: pasado 9999 el código no siguió (lpad trunca)",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: cae en su aserción`, async () => {
      const result = await contract({ migration: mutant(m.changes) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});
