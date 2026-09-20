// @vitest-environment node
/**
 * SDD-0492 · La migración 0470 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0470_rls_escritura_cobros_proveedores.test.sql`
 * corre en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite
 * corre ese MISMO contrato, con los `.sql` reales de las migraciones
 * inlineados: lo que se prueba es el texto que el runbook aplicará a
 * producción, no un doble.
 *
 * CONTROL ROJO: sin 0470, el comercial puede insertar un cobro.
 *
 * MUTANTES: cada uno se corre SIN el postflight de la propia migración, para
 * que lo tenga que cazar la matriz de roles del contrato y no el autochequeo.
 * Uno de ellos corre además con el postflight, para ver que ese también frena.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0470_rls_escritura_cobros_proveedores.test.sql");
const M0470 = "0470_rls_escritura_cobros_proveedores.sql";
const FILE_0470 = readFileSync(resolve(ROOT, "supabase/migrations", M0470), "utf8");
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
    options.migration ? { [M0470]: options.migration } : {});
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0470 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

const ROL = "\n    and (select public.current_studio_role()) in ('accounting', 'admin')";
const TABLAS = ["payment_receipts", "suppliers", "supplier_bills", "supplier_payments"];
const seleccion = (tabla: string, rol: string) => `on public.${tabla} for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())${rol}
  );`;
const alta = (tabla: string, rol: string) => `on public.${tabla} for insert
  to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())${rol}
  );`;

/**
 * 0470 con esos cambios. `veces` fija cuántas apariciones tiene que encontrar,
 * así una mutación que no matchea falla en vez de pasar como superviviente.
 * `conPostflight` en false le quita a la copia su propio autochequeo.
 */
function mutant(cambios: [from: string, to: string, veces: number][], conPostflight = false): string {
  let text = FILE_0470;
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

const SIN_ROL: [string, string, number][] = [[ROL, "", 12]];

describe("SDD-0492 · 0470 escribir cobros y CxP es de accounting y admin (PGlite)", () => {
  it("el contrato pasa con 0470", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toBe("TEST 0470 GREEN: 168 aserciones");
  }, SLOW);

  it("control rojo: sin 0470 el comercial da de alta un cobro", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0470: commercial-A pudo dar de alta en payment_receipts (sin error)");
  }, SLOW);

  const MUTANTS: { name: string; cambios: [string, string, number][]; fails: string }[] = [
    {
      name: "la escritura sin el rol, sólo el tenant",
      cambios: SIN_ROL,
      fails: "TEST 0470: commercial-A pudo dar de alta en payment_receipts (sin error)",
    },
    {
      name: "con el rol comercial en la lista",
      cambios: [["in ('accounting', 'admin')", "in ('accounting', 'admin', 'commercial')", 12]],
      fails: "TEST 0470: commercial-A pudo dar de alta en payment_receipts (sin error)",
    },
    {
      name: "aplicado a medias: payment_receipts sin el rol",
      cambios: [[alta("payment_receipts", ROL), alta("payment_receipts", ""), 1]],
      fails: "TEST 0470: commercial-A pudo dar de alta en payment_receipts (sin error)",
    },
    {
      name: "aplicado a medias: supplier_bills sin el rol",
      cambios: [[alta("supplier_bills", ROL), alta("supplier_bills", ""), 1]],
      fails: "TEST 0470: commercial-A pudo dar de alta en supplier_bills (sin error)",
    },
    {
      name: "sin revocar el DELETE de authenticated",
      cambios: TABLAS.map((t) => [`revoke delete on public.${t} from authenticated;\n`, "", 1]),
      fails: "TEST 0470: accounting-A borró de payment_receipts",
    },
    {
      name: "las envolturas de la 0294 sin el assert de rol",
      cambios: [["  perform public.assert_studio_role(array['accounting', 'admin']);\n\n", "", 3]],
      fails: "TEST 0470: el comercial pudo llamar a void_payment_receipt_with_audit_reason",
    },
    {
      name: "la lectura también pide rol",
      cambios: TABLAS.map((t) => [seleccion(t, ""), seleccion(t, ROL), 1]),
      fails: "TEST 0470: commercial-A dejó de leer payment_receipts del tenant A",
    },
    {
      name: "el USING de UPDATE sin el rol",
      cambios: [[`for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())${ROL}
  )`, `for update
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  )`, 4]],
      fails: "TEST 0470: commercial-A editó payment_receipts (42501 filas)",
    },
    {
      name: "sin soltar la policy FOR ALL heredada",
      cambios: [['drop policy "payment_receipts by tenant" on public.payment_receipts;\n', "", 1]],
      fails: "TEST 0470: commercial-A pudo dar de alta en payment_receipts (sin error)",
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
      "0470 postflight: alta o edición de public.payment_receipts no pide accounting o admin",
    );
  }, SLOW);
});
