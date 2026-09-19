// @vitest-environment node
/**
 * SDD-0489 · La migración 0468 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0468_pago_proveedor_atomico.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0468 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla, el contrato cae en la aserción de esa regla y no en otra.
 *
 * PGlite tiene UNA conexión: que el FOR UPDATE alcance lo prueban dos sesiones
 * reales en `supabase/tests/0468_pago_proveedor_carrera.test.sql`. Acá los
 * mutantes sin FOR UPDATE sólo los caza el centinela textual del contrato.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0468_pago_proveedor_atomico.test.sql");
const M0468 = "0468_pago_proveedor_atomico.sql";
const FILE_0468 = readFileSync(resolve(ROOT, "supabase/migrations", M0468), "utf8");
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
    options.migration ? { [M0468]: options.migration } : {});
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0468 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0468 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0468.split(from)).toHaveLength(2);
  return FILE_0468.replace(from, to);
}

describe("SDD-0489 · 0468 pago y anulación de órdenes de pago atómicos (PGlite)", () => {
  it("el contrato pasa con 0468", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0468 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0468 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe(
      "TEST 0468: existe public.register_supplier_payment_order(uuid,numeric,uuid,text,date,text,text)",
    );
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "con la tolerancia de 0,01 que tenía la app",
      from: "if p_amount > v_bill.total_amount - v_bill.paid_amount then",
      to: "if p_amount > v_bill.total_amount - v_bill.paid_amount + 0.01 then",
      fails: "TEST 0468: un centavo sobre el saldo: se esperaba rechazo PAYMENT_EXCEEDS_BALANCE",
    },
    {
      name: "que revive la CxP anulada",
      from: "    when v_bill.status = 'anulada' then v_bill.status\n",
      to: "",
      fails: "TEST 0468: la CxP anulada conserva su estado y sólo baja el pagado",
    },
    {
      name: "sin la regla de CxP pagada",
      from: "  if v_bill.status = 'pagada' then\n    raise exception 'PAYMENT_BILL_PAID' using errcode = '23514';\n  end if;\n",
      to: "",
      fails: "TEST 0468: CxP pagada: se esperaba PAYMENT_BILL_PAID (23514), llegó PAYMENT_EXCEEDS_BALANCE (23514)",
    },
    {
      name: "sin la regla de CxP anulada",
      from: "  if v_bill.deleted_at is not null or v_bill.status = 'anulada' then\n",
      to: "  if v_bill.deleted_at is not null then\n",
      fails: "TEST 0468: CxP anulada: se esperaba rechazo PAYMENT_STATE",
    },
    {
      name: "sin el FOR UPDATE de la orden al anular",
      from: "  where sp.id = p_payment_id and sp.tenant_id = v_tenant\n  for update;\n",
      to: "  where sp.id = p_payment_id and sp.tenant_id = v_tenant;\n",
      fails: "TEST 0468: void_supplier_payment_order toma la orden y la CxP FOR UPDATE",
    },
    {
      name: "sin el FOR UPDATE de la CxP al pagar",
      from: "  where b.id = p_bill_id and b.tenant_id = v_tenant\n  for update;\n",
      to: "  where b.id = p_bill_id and b.tenant_id = v_tenant;\n",
      fails: "TEST 0468: register_supplier_payment_order toma la CxP FOR UPDATE",
    },
    {
      name: "sin el FOR UPDATE de la CxP al anular",
      from: "  where b.id = v_payment.bill_id and b.tenant_id = v_tenant\n  for update;\n",
      to: "  where b.id = v_payment.bill_id and b.tenant_id = v_tenant;\n",
      fails: "TEST 0468: void_supplier_payment_order toma la orden y la CxP FOR UPDATE",
    },
    {
      name: "sin el lock consultivo del código OP-",
      from: "  perform pg_catalog.pg_advisory_xact_lock(489, pg_catalog.hashtext(v_tenant::text));\n",
      to: "",
      fails: "TEST 0468: el pago toma el lock consultivo 489 del tenant hasta el COMMIT",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: cae en su aserción`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});
