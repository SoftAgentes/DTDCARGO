// @vitest-environment node
/**
 * SDD-0593 · La migración 0511 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0511_rls_escritura_asientos_y_bancos.test.sql` corre
 * en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0511, el comercial puede crear un asiento.
 *
 * MUTANTES: cada uno se corre SIN el postflight de la propia migración, para que
 * lo tenga que cazar la matriz de roles del contrato y no el autochequeo. Uno de
 * ellos corre además con el postflight, para ver que ese también frena.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0511_rls_escritura_asientos_y_bancos.test.sql");
const M0511 = "0511_rls_escritura_asientos_y_bancos.sql";
const FILE_0511 = readFileSync(resolve(ROOT, "supabase/migrations", M0511), "utf8");
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
    options.migration ? { [M0511]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0511 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

const TENANT = "tenant_id = (select public.get_user_tenant_id())";
const ROL = "\n    and (select public.current_studio_role()) in ('accounting', 'admin')";
const EXISTE = `exists (
      select 1 from public.journal_entries je
      where je.id = journal_lines.entry_id
        and je.tenant_id = (select public.get_user_tenant_id())
    )`;
const BORRADO = `create policy journal_entries_accounting_delete
  on public.journal_entries for delete
  to authenticated
  using (
    ${TENANT}${ROL}
  );`;
const USING_UPDATE = (rol: string) => `on public.journal_entries for update
  to authenticated
  using (
    ${TENANT}${rol}
  )`;
const CHECK_UPDATE = (tenant: string) => `  with check (
    ${tenant}${ROL}
  );
create policy journal_entries_accounting_delete`;
const ALTA_LINEA = (cuerpo: string) => `on public.journal_lines for insert
  to authenticated
  with check (
    ${cuerpo}
  );`;

/**
 * 0511 con esos cambios. `veces` fija cuántas apariciones tiene que encontrar,
 * así una mutación que no matchea falla en vez de pasar como superviviente.
 * `conPostflight` en false le quita a la copia su propio autochequeo.
 */
function mutant(cambios: [from: string, to: string, veces: number][], conPostflight = false): string {
  let text = FILE_0511;
  for (const [from, to, veces] of cambios) {
    expect(text.split(from)).toHaveLength(veces + 1);
    text = text.split(from).join(to);
  }
  if (!conPostflight) {
    const ini = text.indexOf("do $postflight$");
    const fin = text.indexOf("$postflight$;", ini + 1);
    expect(ini).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(ini);
    text = text.slice(0, ini) + text.slice(fin + "$postflight$;".length);
  }
  return text;
}

const SIN_ROL: [string, string, number][] = [[ROL, "", 5]];

describe("SDD-0593 · 0511 escribir asientos y cuentas bancarias (PGlite)", () => {
  it("el contrato pasa con 0511", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0511 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0511 el comercial crea un asiento", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0511: commercial-A pudo crear un asiento (sin error)");
  }, SLOW);

  const MUTANTS: { name: string; cambios: [string, string, number][]; fails: string }[] = [
    {
      name: "las escrituras sin el rol, sólo el tenant",
      cambios: SIN_ROL,
      fails: "TEST 0511: commercial-A pudo crear un asiento (sin error)",
    },
    {
      name: "con marketing en la lista",
      cambios: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'marketing')", 5]],
      fails: "TEST 0511: marketing-A pudo crear un asiento (sin error)",
    },
    {
      name: "sin soltar la policy FOR ALL de journal_entries",
      cambios: [['drop policy "journal_entries by tenant" on public.journal_entries;\n', "", 1]],
      fails: "TEST 0511: commercial-A pudo crear un asiento (sin error)",
    },
    {
      name: "sin soltar la policy FOR ALL de journal_lines",
      cambios: [['drop policy "journal_lines by entry tenant" on public.journal_lines;\n', "", 1]],
      fails: "TEST 0511: commercial-A pudo agregar una línea (sin error)",
    },
    {
      name: "sin soltar la policy FOR ALL de company_bank_accounts",
      cambios: [['drop policy "company_bank_accounts by tenant" on public.company_bank_accounts;\n', "", 1]],
      fails: "TEST 0511: una tabla conserva una policy FOR ALL",
    },
    {
      name: "el USING de UPDATE sin el rol",
      cambios: [[USING_UPDATE(ROL), USING_UPDATE(""), 1]],
      fails: "TEST 0511: commercial-A anuló un asiento por PATCH (42501)",
    },
    {
      name: "el WITH CHECK de UPDATE sin el tenant",
      cambios: [[CHECK_UPDATE(TENANT), CHECK_UPDATE("true"), 1]],
      fails: "TEST 0511: accounting-A movió asientos al tenant B sin filtro (sin error)",
    },
    {
      name: "el DELETE sin el rol",
      cambios: [[BORRADO, BORRADO.replace(ROL, ""), 1]],
      fails: "TEST 0511: commercial-A borró un asiento (1)",
    },
    {
      name: "sin policy de DELETE: el rollback de createJournalEntry deja de borrar",
      cambios: [[BORRADO, "", 1]],
      fails: "TEST 0511: accounting-A no pudo borrar un asiento (0)",
    },
    {
      name: "la línea sin el rol",
      cambios: [[ALTA_LINEA(`${EXISTE}${ROL}`), ALTA_LINEA(EXISTE), 1]],
      fails: "TEST 0511: commercial-A pudo agregar una línea (sin error)",
    },
    {
      // Con membresía única, para que el de dos membresías no lo cace antes.
      name: "la línea sin atarse al tenant del asiento",
      cambios: [[ALTA_LINEA(`${EXISTE}${ROL}`), ALTA_LINEA(`(select public.get_user_tenant_id()) is not null${ROL}`), 1]],
      fails: "TEST 0511: accounting-A agregó una línea a un asiento del tenant B (sin error)",
    },
    {
      name: "la línea sin atarse a nada: el de dos membresías también escribe",
      cambios: [[ALTA_LINEA(`${EXISTE}${ROL}`), ALTA_LINEA(`true${ROL}`), 1]],
      fails: "TEST 0511: accounting-dos pudo agregar una línea (sin error)",
    },
    {
      name: "sin revocar UPDATE y DELETE de las líneas",
      cambios: [["revoke update, delete on public.journal_lines from authenticated;\n", "", 1]],
      fails: "TEST 0511: accounting-A editó una línea (sin error)",
    },
    {
      name: "sin revocar INSERT y UPDATE de las cuentas bancarias",
      cambios: [["revoke insert, update on public.company_bank_accounts from authenticated;\n", "", 1]],
      fails: "TEST 0511: accounting-A cambió un número de cuenta bancaria (sin error)",
    },
    {
      name: "la lectura de asientos también pide rol",
      cambios: [[`on public.journal_entries for select
  to authenticated
  using (
    ${TENANT}
  )`, `on public.journal_entries for select
  to authenticated
  using (
    ${TENANT}${ROL}
  )`, 1]],
      fails: "TEST 0511: commercial-A dejó de leer journal_entries",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: lo caza la matriz de roles`, async () => {
      const result = await contract({ migration: mutant(m.cambios) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  it("y el postflight de la propia migración también frena el mutante sin rol", async () => {
    const result = await contract({ migration: mutant(SIN_ROL, true) });
    expect(result.error).toBe("0511 postflight: una escritura de asientos no pide accounting o admin");
  }, SLOW);

  it("el preflight aborta sin cambiar nada si journal_lines ya no tiene sólo la policy heredada", async () => {
    const extra = "create policy lineas_extra on public.journal_lines for select to authenticated using (true);\n";
    const result = await contract({ migration: extra + FILE_0511 });
    expect(result.error).toBe(
      "0511 abortado: public.journal_lines no tiene sólo «journal_lines by entry tenant» (FOR ALL, sólo tenant)",
    );
  }, SLOW);

  it("el preflight aborta si la RPC de cuentas bancarias dejó de ser DEFINER", async () => {
    const invoker = "alter function public.audit_d1_execute(uuid, text, uuid, jsonb, text) security invoker;\n";
    const result = await contract({ migration: invoker + FILE_0511 });
    expect(result.error).toBe("0511 abortado: audit_d1_execute no es DEFINER de postgres; el revoke la frenaría");
  }, SLOW);
});
