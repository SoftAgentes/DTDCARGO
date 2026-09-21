// @vitest-environment node
/**
 * SDD-0496 · La migración 0471 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0471_credito_referido_atomico.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0471 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla, el contrato cae en la aserción de esa regla y no en otra.
 *
 * PGlite tiene UNA conexión: que el FOR UPDATE alcance lo prueban tres sesiones
 * reales en `supabase/tests/0467_reversion_credito_carrera.test.sql` (escenarios
 * 5 y 6, las dos ventanas del riesgo residual de la SDD-0490). Acá los mutantes
 * sin FOR UPDATE sólo los caza el centinela textual del contrato.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0471_credito_referido_atomico.test.sql");
const M0471 = "0471_credito_referido_atomico.sql";
const FILE_0471 = readFileSync(resolve(ROOT, "supabase/migrations", M0471), "utf8");
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
    options.migration ? { [M0471]: options.migration } : {});
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0471 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0471 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0471.split(from)).toHaveLength(2);
  return FILE_0471.replace(from, to);
}

describe("SDD-0496 · 0471 crédito de referido aplicado y revertido atómicamente (PGlite)", () => {
  it("el contrato pasa con 0471", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0471 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0471 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0471: existe public.apply_referral_credit(uuid,uuid)");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "sin el FOR UPDATE de la factura al aplicar",
      from: "  where i.id = p_invoice_id and i.tenant_id = v_tenant\n  for update;\n  if not found or v_inv.deleted_at is not null then",
      to: "  where i.id = p_invoice_id and i.tenant_id = v_tenant;\n  if not found or v_inv.deleted_at is not null then",
      fails: "TEST 0471: apply_referral_credit toma la factura y el crédito FOR UPDATE",
    },
    {
      name: "sin el FOR UPDATE de los créditos al revertir",
      from: "    order by r.id\n    for update\n  loop",
      to: "    order by r.id\n  loop",
      fails: "TEST 0471: revert_referral_credits toma la factura y después los créditos FOR UPDATE",
    },
    {
      name: "que revive la factura anulada al revertir",
      from: "      when v_inv.status in ('borrador', 'anulada') then v_inv.status\n",
      to: "",
      fails: "TEST 0471: la factura anulada conserva su estado y sólo baja el crédito",
    },
    {
      name: "que deja pagada una factura con saldo",
      from: "      when v_new_paid <= 0 then 'emitida'\n      else 'parcial'",
      to: "      when v_new_paid <= 0 then 'emitida'\n      else v_inv.status",
      fails: "TEST 0471: una pagada a la que se le baja el crédito queda parcial, nunca pagada con saldo",
    },
    {
      name: "sin la regla de saldo (over-credit)",
      from: "  if v_amount > v_inv.total_amount - v_inv.paid_amount then",
      to: "  if v_amount > v_inv.total_amount then",
      fails: "TEST 0471: saldo menor que el crédito: se esperaba rechazo REFERRAL_CREDIT_EXCEEDS_BALANCE",
    },
    {
      name: "sin el claim por estado del crédito",
      from: "  if v_ref.status <> 'acreditado' then\n    raise exception 'REFERRAL_CREDIT_STATE' using errcode = '23514';\n  end if;\n",
      to: "",
      fails: "TEST 0471: crédito ya aplicado: se esperaba rechazo REFERRAL_CREDIT_STATE",
    },
    {
      name: "con la regla de compra nueva como «estrictamente posterior»",
      from: "     or v_inv.issued_at < (v_ref.accredited_at at time zone 'UTC')::date then",
      to: "     or v_inv.issued_at <= (v_ref.accredited_at at time zone 'UTC')::date then",
      fails: "TEST 0471: una factura del mismo día del crédito lo admite, y admin también aplica"
        + " (rechazada con REFERRAL_CREDIT_OLD_INVOICE)",
    },
    {
      name: "que no limpia applied_entry_id al revertir",
      from: "    set status = 'acreditado', applied_invoice_id = null, applied_entry_id = null, applied_at = null",
      to: "    set status = 'acreditado', applied_invoice_id = null, applied_at = null",
      // Lo mata el CHECK referrals_credit_applied_coherent de 0237, no una
      // aserción: la base rechaza el rastro incoherente antes de que se lea.
      fails: 'new row for relation "referrals" violates check constraint "referrals_credit_applied_coherent"',
    },
    {
      name: "que ignora p_referral_id y barre toda la factura",
      from: "      and (p_referral_id is null or r.id = p_referral_id)\n",
      to: "",
      fails: "TEST 0471: con p_referral_id se revierte sólo ese crédito",
    },
    {
      name: "sin el gate de rol de dinero",
      from: "      and ut.disabled_at is null and ut.role in ('admin', 'accounting')) then\n    raise exception 'REFERRAL_CREDIT_FORBIDDEN' using errcode = '42501';\n  end if;\n  if p_referral_id is null or p_invoice_id is null then",
      to: "      and ut.disabled_at is null) then\n    raise exception 'REFERRAL_CREDIT_FORBIDDEN' using errcode = '42501';\n  end if;\n  if p_referral_id is null or p_invoice_id is null then",
      // Sin el gate, la RLS de 0407 es la segunda línea: commercial no pasa el
      // FOR UPDATE de invoices, así que la factura «no existe» para él.
      fails: "TEST 0471: aplicar sin rol de dinero: se esperaba REFERRAL_CREDIT_FORBIDDEN (42501),"
        + " llegó REFERRAL_CREDIT_INVOICE_NOT_FOUND (P0002)",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});
