// @vitest-environment node
/**
 * SDD-0513 · El espejo TS del formato de PIN contra la función SQL REAL.
 *
 * POR QUÉ PGLITE Y NO UN DOBLE: `operarioPinProblem` (lib/studio/operario-pin.ts)
 * copia la lista de PIN comunes de `public.validate_operario_pin_format`. Si la
 * base cambia la lista y el espejo no, el generador podría proponer un PIN que
 * la RPC rechaza, o el Studio aceptaría a mano uno que la base tumba con su
 * mensaje en voseo. Un doble afirmaría lo que yo escriba en él; acá corre el
 * texto SQL de la migración contra un Postgres desechable.
 *
 * QUÉ DEFINICIÓN: la ÚLTIMA que aparece en `supabase/migrations/` por orden de
 * archivo (hoy la que reafirma 0288 dentro de su historial de reparación, con
 * el mismo cuerpo que 0037). Si una migración futura la redefine, esta prueba
 * la toma sola y vuelve a comparar.
 *
 * QUÉ SE AFIRMA:
 *  1. sobre los 10.000 PIN de 4 dígitos, TS y SQL aceptan exactamente el mismo
 *     conjunto (9.976);
 *  2. sobre entradas mal formadas, lo que TS acepta SQL también lo acepta (TS
 *     puede ser más estricto, nunca más permisivo);
 *  3. 5.000 PIN del generador real pasan la función SQL sin una sola excepción.
 *
 * CONTROL ROJO: un espejo al que le falta un común («2580») tiene que hacer
 * fallar la comparación 1. Sin ese control, un verde no probaría que la
 * comparación mira la lista.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OPERARIO_PIN_BLACKLIST, operarioPinProblem } from "../operario-pin";
import { generateOperarioPin } from "../operario-pin-generator";

const MIGRATIONS = new URL("../../../supabase/migrations/", import.meta.url);
const SIGNATURE = "create or replace function public.validate_operario_pin_format";

/** Última definición (por orden de archivo) del validador, con su archivo. */
function lastValidatorDefinition(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let found: { file: string; sql: string } | null = null;
  for (const file of files) {
    const text = readFileSync(new URL(file, MIGRATIONS), "utf8");
    const at = text.lastIndexOf(SIGNATURE);
    if (at < 0) continue;
    // La etiqueta del cuerpo varía por archivo ($$ en 0021, $func$ en 0037…).
    const opener = /\bas\s+(\$[A-Za-z0-9_]*\$)/.exec(text.slice(at));
    const tag = opener?.[1];
    const bodyStart = opener ? at + opener.index + opener[0].length : -1;
    const close = tag ? text.indexOf(`${tag};`, bodyStart) : -1;
    if (!tag || close < 0) {
      throw new Error(`No pude aislar el cuerpo del validador en ${file}`);
    }
    // Archivos en orden: el último que la define gana.
    found = { file, sql: text.slice(at, close + tag.length + 1) };
  }
  if (!found) throw new Error("No hay definición de validate_operario_pin_format");
  return found;
}

const VALIDATOR = lastValidatorDefinition();

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(VALIDATOR.sql);
  // Envoltorio de prueba: true si la función real NO levanta excepción.
  await db.exec(`
    create function public.pin_ok(p text) returns boolean
    language plpgsql as $t$
    begin
      perform public.validate_operario_pin_format(p);
      return true;
    exception when others then
      return false;
    end;
    $t$;
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

/** PIN de 4 dígitos que la función SQL real rechaza. */
async function sqlRejectedFourDigit(): Promise<string[]> {
  const r = await db.query<{ pin: string }>(`
    select lpad(g::text, 4, '0') as pin
      from generate_series(0, 9999) as g
     where not public.pin_ok(lpad(g::text, 4, '0'))
     order by 1
  `);
  return r.rows.map((x) => x.pin);
}

function tsRejectedFourDigit(problem: (pin: string) => unknown): string[] {
  const out: string[] = [];
  for (let n = 0; n < 10_000; n++) {
    const pin = String(n).padStart(4, "0");
    if (problem(pin) !== null) out.push(pin);
  }
  return out;
}

describe(`validate_operario_pin_format real (${VALIDATOR.file})`, () => {
  it("toma la definición de una migración de reparación o posterior a 0037", () => {
    // Si alguien borra las reafirmaciones, la prueba seguiría usando 0037; lo
    // que importa es que sea la última. Se deja visible cuál es.
    expect(VALIDATOR.file >= "0037_harden_operario_pin_validator.sql").toBe(true);
    expect(VALIDATOR.sql).toContain("'1234'");
  });

  it("sobre los 10.000 PIN de 4 dígitos, TS y SQL rechazan exactamente los mismos", async () => {
    const sql = await sqlRejectedFourDigit();
    const ts = tsRejectedFourDigit(operarioPinProblem);
    expect(sql).toHaveLength(24);
    expect(ts).toEqual(sql);
    expect([...OPERARIO_PIN_BLACKLIST].sort()).toEqual(sql);
  });

  it("control rojo: un espejo al que le falta un común NO coincide con la base", async () => {
    const sql = await sqlRejectedFourDigit();
    const broken = (pin: string) =>
      pin === "2580" ? null : operarioPinProblem(pin);
    expect(tsRejectedFourDigit(broken)).not.toEqual(sql);
  });

  it("fuera de los 4 dígitos ASCII, TS nunca acepta lo que SQL rechaza", async () => {
    const malformed = ["", "123", "12345", "12a4", " 123", "123 ", "-123", "12.3", "１２３４", "٤٨٢٧", "48\n7"];
    const wellFormed = ["4827", "0429", "9998"];
    for (const pin of [...malformed, ...wellFormed]) {
      const r = await db.query<{ ok: boolean }>("select public.pin_ok($1) as ok", [pin]);
      const sqlOk = r.rows[0].ok;
      const tsOk = operarioPinProblem(pin) === null;
      // La propiedad: TS ⇒ SQL. TS puede ser más estricto (dígitos no ASCII),
      // nunca más permisivo.
      if (tsOk) expect(sqlOk, JSON.stringify(pin)).toBe(true);
      expect(tsOk, JSON.stringify(pin)).toBe(wellFormed.includes(pin));
    }
    // Y NULL, que la RPC también podría recibir: la base lo rechaza.
    const nul = await db.query<{ ok: boolean }>("select public.pin_ok(null) as ok");
    expect(nul.rows[0].ok).toBe(false);
  });

  it("5.000 PIN del generador real pasan la función SQL sin excepción", async () => {
    const pins = Array.from({ length: 5_000 }, () => generateOperarioPin());
    const r = await db.query<{ total: number; bad: string[] | null }>(
      `select count(*)::int as total,
              array_agg(p) filter (where not public.pin_ok(p)) as bad
         from json_array_elements_text($1::json) as p`,
      [JSON.stringify(pins)],
    );
    expect(r.rows[0].total).toBe(5_000);
    expect(r.rows[0].bad).toBeNull();
  });
});
