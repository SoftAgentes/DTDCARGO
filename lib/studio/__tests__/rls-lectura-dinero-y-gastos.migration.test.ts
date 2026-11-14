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

/** La 0528 sin su bloque de postflight, para medir sola la matriz del contrato. */
function sinPostflight(text: string): string {
  const start = text.indexOf("\ndo $postflight$");
  const endTag = "\n$postflight$;\n";
  const end = text.indexOf(endTag, start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return text.slice(0, start) + text.slice(end + endTag.length);
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

  /**
   * `fails` es lo que caza la matriz del contrato con el postflight quitado;
   * `postflight`, lo que caza el postflight de la 0528 con la migración entera.
   * Así cada mutante prueba las dos capas por separado: si una se afloja, la
   * otra no la tapa en la prueba.
   */
  const MUTANTS: { name: string; cambios: [string, string, number][]; fails: string; postflight?: string }[] = [
    {
      name: "el helper deja pasar a operations",
      cambios: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'operations')", 1]],
      fails: "TEST 0528: operations-A lee journal_entries (2 filas)",
    },
    // Una lectura sin el helper, tabla por tabla. En journal_lines la matriz no
    // lo ve (el EXISTS lee journal_entries bajo SU RLS, que ya pide el helper):
    // lo cazan la aserción estructural del contrato y el postflight.
    ...(["journal_entries", "payment_receipts", "supplier_bills", "supplier_payments"] as const).map((t) => ({
      name: `la lectura de ${t} sin el helper`,
      cambios: [[`create policy ${t}_money_select
  on public.${t} for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.studio_can_read_money())
  );`, `create policy ${t}_money_select
  on public.${t} for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );`, 1]] as [string, string, number][],
      fails: `TEST 0528: commercial-A lee ${t} (`,
      postflight: "0528 postflight: una lectura del dinero no pide el tenant y studio_can_read_money()",
    })),
    {
      name: "la lectura de journal_lines sin el helper",
      cambios: [["    (select public.studio_can_read_money())\n    and exists (", "    exists (", 1]],
      fails: "TEST 0528: una lectura del dinero no pide studio_can_read_money()",
      postflight: "0528 postflight: una lectura del dinero no pide el tenant y studio_can_read_money()",
    },
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
      postflight: "0528 postflight: expenses_insert o expenses_update no cierran a support",
    },
    {
      name: "support sigue editando sus gastos",
      cambios: [["    and coalesce((select public.current_studio_role()) <> 'support', false)\n  );\n\ndo $postflight$",
        "  );\n\ndo $postflight$", 1]],
      fails: "TEST 0528: support-A editó su gasto",
      postflight: "0528 postflight: expenses_insert o expenses_update no cierran a support",
    },
    {
      name: "el helper como SECURITY INVOKER",
      cambios: [["security definer\nset search_path = ''\nas $$\n  select coalesce(",
        "security invoker\nset search_path = ''\nas $$\n  select coalesce(", 1]],
      fails: "studio_can_read_money() no es SECURITY DEFINER",
      postflight: "0528 postflight: studio_can_read_money() no quedó SQL, STABLE, DEFINER y con search_path vacío",
    },
    {
      name: "la RPC de reclamos con search_path public",
      cambios: [["set search_path = ''\nas $$\n  select je.claim_id", "set search_path = public\nas $$\n  select je.claim_id", 1]],
      fails: "no fija search_path vacío",
      postflight: "claim_indemnity_entry_codes(uuid[]) no quedó SQL, STABLE, DEFINER y con search_path vacío",
    },
    {
      name: "la RPC de reclamos sin revocar PUBLIC",
      cambios: [["revoke all on function public.claim_indemnity_entry_codes(uuid[]) from public, anon;\n", "", 1]],
      fails: "TEST 0528: anon puede ejecutar la RPC de reclamos",
      postflight: "0528 postflight: PUBLIC puede ejecutar",
    },
    {
      name: "el helper sin revocar PUBLIC",
      cambios: [["revoke all on function public.studio_can_read_money() from public, anon;\n", "", 1]],
      fails: "TEST 0528: PUBLIC puede ejecutar ",
      postflight: "0528 postflight: PUBLIC puede ejecutar",
    },
  ];
  for (const m of MUTANTS) {
    if (m.postflight) {
      it(`mutante ${m.name}: lo caza el postflight`, async () => {
        const result = await contract({ migration: mutant(m.cambios) });
        expect(result.error ?? "").toContain(m.postflight);
      }, SLOW);
    }
    it(`mutante ${m.name}: lo caza el contrato${m.postflight ? " sin el postflight" : ""}`, async () => {
      const text = mutant(m.cambios);
      const result = await contract({ migration: m.postflight ? sinPostflight(text) : text });
      expect(result.error ?? "").toContain(m.fails);
    }, SLOW);
  }

  it("el preflight aborta si la 0470/0511 no están (sin *_team_select)", async () => {
    const sinPrevias = "drop policy payment_receipts_team_select on public.payment_receipts;\n" + FILE_0528;
    const result = await contract({ migration: sinPrevias });
    expect(result.error).toContain("0528 abortado: faltan policies");
  }, SLOW);

  it("el preflight aborta con una policy de más en paralelo", async () => {
    const conExtra = "create policy supplier_bills_extra_select on public.supplier_bills for select to authenticated using (true);\n"
      + FILE_0528;
    const result = await contract({ migration: conExtra });
    expect(result.error).toContain("0528 abortado: las policies de dinero o gastos no son las que dejaron la 0470 y la 0511");
  }, SLOW);

  it("el preflight aborta si la lectura que reemplaza no tiene la huella del equipo", async () => {
    const otraHuella = "alter policy supplier_bills_team_select on public.supplier_bills using ("
      + "tenant_id = (select public.get_user_tenant_id()) and (select public.current_studio_role()) = 'admin');\n"
      + FILE_0528;
    const result = await contract({ migration: otraHuella });
    expect(result.error).toContain("0528 abortado: una lectura *_team_select no es la del equipo del tenant");
  }, SLOW);

  it("el preflight aborta si los gastos no son los del dueño de la 0047", async () => {
    const otraHuella = "alter policy expenses_update on public.expenses using (true);\n" + FILE_0528;
    const result = await contract({ migration: otraHuella });
    expect(result.error).toContain("0528 abortado: expenses_insert o expenses_update no son las del dueño de la 0047");
  }, SLOW);

  it("el preflight aborta si el helper ya existe", async () => {
    const yaExiste = "create function public.studio_can_read_money() returns boolean language sql as $$ select true $$;\n"
      + FILE_0528;
    const result = await contract({ migration: yaExiste });
    expect(result.error).toContain("0528 abortado: studio_can_read_money() o claim_indemnity_entry_codes(uuid[]) ya existen");
  }, SLOW);

  it("termina avisando a PostgREST", () => {
    expect(FILE_0528.trimEnd().endsWith("notify pgrst, 'reload schema';")).toBe(true);
  });
});
