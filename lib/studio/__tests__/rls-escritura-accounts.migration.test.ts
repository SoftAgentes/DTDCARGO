// @vitest-environment node
/**
 * SDD-0591 · La migración 0510 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0510_rls_escritura_accounts.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0510, el comercial puede crear una cuenta.
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
const CONTRACT = resolve(ROOT, "supabase/tests/0510_rls_escritura_accounts.test.sql");
const M0510 = "0510_rls_escritura_accounts.sql";
const FILE_0510 = readFileSync(resolve(ROOT, "supabase/migrations", M0510), "utf8");
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
    options.migration ? { [M0510]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0510 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

const TENANT = "tenant_id = (select public.get_user_tenant_id())";
const ROL = "\n    and (select public.current_studio_role()) in ('accounting', 'admin')";
const BORRADO = `create policy accounts_accounting_delete
  on public.accounts for delete
  to authenticated
  using (
    ${TENANT}${ROL}
  );`;
const USING_UPDATE = (rol: string) => `for update
  to authenticated
  using (
    ${TENANT}${rol}
  )`;
const CHECK_UPDATE = (tenant: string) => `  with check (
    ${tenant}${ROL}
  );
create policy accounts_accounting_delete`;

/**
 * 0510 con esos cambios. `veces` fija cuántas apariciones tiene que encontrar,
 * así una mutación que no matchea falla en vez de pasar como superviviente.
 * `conPostflight` en false le quita a la copia su propio autochequeo.
 */
function mutant(cambios: [from: string, to: string, veces: number][], conPostflight = false): string {
  let text = FILE_0510;
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

const SIN_ROL: [string, string, number][] = [[ROL, "", 4]];

describe("SDD-0591 · 0510 cambiar el plan de cuentas es de accounting y admin (PGlite)", () => {
  it("el contrato pasa con 0510", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0510 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0510 el comercial da de alta una cuenta", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0510: commercial-A pudo dar de alta en accounts (sin error)");
  }, SLOW);

  const MUTANTS: { name: string; cambios: [string, string, number][]; fails: string }[] = [
    {
      name: "la escritura sin el rol, sólo el tenant",
      cambios: SIN_ROL,
      fails: "TEST 0510: commercial-A pudo dar de alta en accounts (sin error)",
    },
    {
      name: "con marketing en la lista",
      cambios: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'marketing')", 4]],
      fails: "TEST 0510: marketing-A pudo dar de alta en accounts (sin error)",
    },
    {
      name: "sin soltar la policy FOR ALL heredada",
      cambios: [['drop policy "accounts by tenant" on public.accounts;\n', "", 1]],
      fails: "TEST 0510: commercial-A pudo dar de alta en accounts (sin error)",
    },
    {
      name: "el USING de UPDATE sin el rol",
      cambios: [[USING_UPDATE(ROL), USING_UPDATE(""), 1]],
      fails: "TEST 0510: commercial-A cambió is_postable de la 4.5 (42501)",
    },
    {
      name: "el WITH CHECK de UPDATE sin el tenant",
      cambios: [[CHECK_UPDATE(TENANT), CHECK_UPDATE("true"), 1]],
      fails: "TEST 0510: accounting-A movió cuentas al tenant B sin filtro (sin error)",
    },
    {
      name: "el DELETE sin el rol",
      cambios: [[BORRADO, BORRADO.replace(ROL, ""), 1]],
      fails: "TEST 0510: commercial-A borró de accounts (1)",
    },
    {
      name: "sin policy de DELETE: deleteAccount deja de poder borrar",
      cambios: [[BORRADO, "", 1]],
      fails: "TEST 0510: accounting-A no pudo borrar una cuenta (0)",
    },
    {
      name: "revocando el DELETE de authenticated, como la 0470",
      cambios: [[BORRADO, `${BORRADO}\nrevoke delete on public.accounts from authenticated;`, 1]],
      fails: "TEST 0510: accounting-A no pudo borrar una cuenta (42501)",
    },
    {
      name: "la lectura también pide rol",
      cambios: [[`for select
  to authenticated
  using (
    ${TENANT}
  )`, `for select
  to authenticated
  using (
    ${TENANT}${ROL}
  )`, 1]],
      fails: "TEST 0510: commercial-A dejó de leer el plan de cuentas",
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
    expect(result.error).toBe(
      "0510 postflight: alta, edición o borrado de public.accounts no pide accounting o admin",
    );
  }, SLOW);

  it("el preflight aborta sin cambiar nada si accounts ya no tiene sólo la policy heredada", async () => {
    const extra = "create policy accounts_extra on public.accounts for select to authenticated using (true);\n";
    const result = await contract({ migration: extra + FILE_0510 });
    expect(result.error).toBe(
      "0510 abortado: public.accounts no tiene sólo «accounts by tenant» (FOR ALL, sólo tenant)",
    );
  }, SLOW);
});
