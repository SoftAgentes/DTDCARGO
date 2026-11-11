// @vitest-environment node
/**
 * SDD-0624 · La migración 0528 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0528_rls_lectura_dinero_y_gastos.test.sql` corre en
 * `verify` con Docker; el CI de calidad no tiene Docker, así que PGlite corre ese
 * MISMO contrato con los `.sql` reales de las migraciones inlineados.
 *
 * CONTROL ROJO: sin 0528, el comercial lee los asientos.
 * MUTANTES: cada uno rompe una pieza de la 0528 y lo tiene que cazar la matriz
 * de roles del contrato.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0528_rls_lectura_dinero_y_gastos.test.sql");
const M0528 = "0528_rls_lectura_dinero_y_gastos.sql";
const FILE_0528 = readFileSync(resolve(ROOT, "supabase/migrations", M0528), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/** psql → SQL plano: \set, \if :{?v} / :v, \else, \endif e \ir (igual que el de la 0511). */
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
    options.migration ? { [M0528]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0528 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0528 con esos cambios; `veces` exige que cada `from` aparezca justo esas veces. */
function mutant(cambios: [from: string, to: string, veces: number][]): string {
  let text = FILE_0528;
  for (const [from, to, veces] of cambios) {
    expect(text.split(from)).toHaveLength(veces + 1);
    text = text.split(from).join(to);
  }
  return text;
}

describe("SDD-0624 · 0528 lectura del dinero y gastos (PGlite)", () => {
  it("el contrato pasa con 0528", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0528 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0528 el comercial lee los asientos", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0528: commercial-A lee journal_entries (2 filas)");
  }, SLOW);

  const MUTANTS: { name: string; cambios: [string, string, number][]; fails: string }[] = [
    {
      name: "el helper deja pasar a operations",
      cambios: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'operations')", 1]],
      fails: "TEST 0528: operations-A lee journal_entries (2 filas)",
    },
    {
      name: "una policy de lectura sin el helper",
      cambios: [[`using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );

-- ── supplier_bills`, `using (
    tenant_id = (select public.get_user_tenant_id())
  );

-- ── supplier_bills`, 1]],
      fails: "TEST 0528: commercial-A lee payment_receipts (1 filas)",
    },
    // Sin mutante de «las líneas sin el helper»: sobrevive A PROPÓSITO. El EXISTS
    // de journal_lines lee journal_entries bajo SU RLS, que ya pide el helper, así
    // que las líneas quedan cerradas dos veces. El helper en las líneas es defensa
    // en profundidad por si un día el EXISTS se reescribe con una función DEFINER.
    {
      name: "la RPC de reclamos sin el filtro de rol",
      cambios: [["\n     and public.current_studio_role() in ('admin', 'commercial', 'operations', 'accounting', 'support')", "", 1]],
      fails: "TEST 0528: warehouse-A, que no ve Reclamos, recibió un código",
    },
    {
      name: "la RPC de reclamos sin el tenant",
      cambios: [["\n     and je.tenant_id = public.get_user_tenant_id()", "", 1]],
      fails: "TEST 0528: accounting-B ve el código de un reclamo del tenant A",
    },
    {
      name: "support sigue creando gastos",
      cambios: [["    and coalesce((select public.current_studio_role()) <> 'support', false)\n  );\n\ndrop policy expenses_update",
        "  );\n\ndrop policy expenses_update", 1]],
      fails: "TEST 0528: support-A pudo crear un gasto",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: lo caza el contrato`, async () => {
      const result = await contract({ migration: mutant(m.cambios) });
      expect(result.error ?? "").toContain(m.fails);
    }, SLOW);
  }

  it("el preflight aborta si la 0470/0511 no están (sin *_team_select)", async () => {
    const sinPrevias = "drop policy payment_receipts_team_select on public.payment_receipts;\n" + FILE_0528;
    const result = await contract({ migration: sinPrevias });
    expect(result.error).toContain("0528 abortado: faltan policies");
  }, SLOW);
});
