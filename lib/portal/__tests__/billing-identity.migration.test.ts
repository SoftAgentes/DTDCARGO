// @vitest-environment node
/**
 * SDD-0487 · La migración 0466 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0466_…test.sql` parte de la fixture REAL de 0421
 * (facturas, reportes de pago, anulación 0294 y auditoría 0267) y aplica la
 * cadena 0464 → 0392 → 0445 → 0462 → 0466. PGlite corre ese mismo contrato, con
 * los `.sql` reales inlineados, así el CI de calidad —que no tiene Docker— lo
 * ejecuta igual.
 *
 * CONTROL ROJO: sin 0466 el contrato falla.
 * MUTANTES: cada regla rota rompe el contrato en SU aserción, no en otra.
 *
 * PGlite tiene UNA conexión: los locks y la contención se midieron aparte en
 * PostgreSQL 17 (cabecera de la migración).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TESTS = resolve(ROOT, "supabase/tests");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const M0466 = "0466_client_billing_identity.sql";
const FILE_0466 = readFileSync(resolve(MIGRATIONS, M0466), "utf8");
const CONTRACT = resolve(TESTS, "0466_client_billing_identity.test.sql");
const SLOW = 240_000;

type Vars = Record<string, string>;
type Options = { vars?: Vars; replace?: Record<string, string> };

const TRUE = /^(t|tr|tru|true|on|y|ye|yes|1)$/i;
const FALSE = /^(f|fa|fal|fals|false|of|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes de estos contratos: \set, \unset,
 * \if :{?v} / :v, \else, \endif, \ir y \quit. `replace` sustituye el texto de
 * una migración (un mutante). Mismo expansor que el contrato de 0464.
 */
function psql(file: string, { vars = {}, replace = {} }: Options = {}): string {
  const state: Vars = { ...vars };
  const out: string[] = [];
  let quit = false;
  const value = (token: string) => (token.startsWith(":") ? state[token.slice(1)] : token);
  const source = (path: string) => {
    const name = Object.keys(replace).find((key) => path.endsWith(key));
    return name ? replace[name] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source(path).split(/\r?\n/)) {
      if (quit) return;
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
          const text = defined ? String(defined[1] in state) : String(value(rest.trim()));
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
        const [name, ...values] = rest.trim().split(/\s+/);
        state[name] = values.map(value).join("");
      } else if (command === "unset") {
        delete state[rest.trim()];
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else if (command === "quit") {
        quit = true;
        return;
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n").replace(/pg_read_file\('\/sb\/([^']+)'\)/g, (_, relative: string) => {
    const text = source(resolve(ROOT, "supabase", relative));
    if (text.includes("$sbfile$")) throw new Error("delimitador presente en " + relative);
    return "$sbfile$" + text + "$sbfile$";
  });
}

async function run(sql: string): Promise<{ error: string | null; notices: string[] }> {
  const db = await pgliteLimpio({ pgcrypto });
  const notices: string[] = [];
  try {
    await db.exec(sql, { onNotice: (notice) => notices.push(notice.message ?? "") });
    return { error: null, notices };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), notices };
  } finally {
    await db.close();
  }
}

function mutant(from: string, to: string): string {
  expect(FILE_0466.split(from)).toHaveLength(2);
  return FILE_0466.replace(from, to);
}

describe("0466 · identidad de facturación y sello del titular (PGlite)", () => {
  it("el contrato completo pasa con la cadena real 0421 → 0466", async () => {
    const { error, notices } = await run(psql(CONTRACT));
    expect(error).toBeNull();
    expect(notices.join("\n")).toMatch(/TEST 0466 GREEN: 45 aserciones/);
  }, SLOW);

  it("control rojo: sin 0466 el contrato falla", async () => {
    const { error } = await run(psql(CONTRACT, { vars: { apply_billing: "false" } }));
    expect(error).toMatch(/portal_get_my_billing_profile\(\) does not exist/);
  }, SLOW);

  it("preflight: sin la entidad client de 0293 aborta sin crear nada", async () => {
    const row =
      "insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)\n" +
      "values ('client', 'active', 'commercial', 1, 'migration:0293')\n" +
      "on conflict (entity_type) do nothing;";
    const original = readFileSync(CONTRACT, "utf8");
    expect(original.split(row)).toHaveLength(2);
    const contract = original.replace(row, "-- Sin la fila de 0293.");
    const sql = psql(CONTRACT, { replace: { "0466_client_billing_identity.test.sql": contract } });
    const { error } = await run(sql);
    expect(error).toMatch(/0466 requiere las entidades de auditoría client \(0293\) e invoice activas/);
  }, SLOW);

  it.each<[string, string, string, RegExp]>([
    ["sin inmutabilidad", "if tg_op = 'UPDATE' and old.status <> 'borrador' then", "if false then",
      /no se cambia el nombre de una factura emitida: se esperaba rechazo/],
    ["el RIF emitido no queda congelado", "       or new.client_rif is distinct from old.client_rif\n", "",
      /no se cambia el RIF de una factura emitida: se esperaba rechazo/],
    ["sólo sella en INSERT",
      "    or (tg_op = 'UPDATE' and old.status = 'borrador' and new.status = 'emitida')\n", "",
      /borrador → emitida sella la persona elegida en el Studio/],
    ["ignora la elección del borrador",
      "v_kind := coalesce(new.bill_to_kind, v_preferred_kind);", "v_kind := v_preferred_kind;",
      /borrador → emitida sella la persona elegida en el Studio/],
    ["el trigger de clients mira su propia fila",
      "      and identity.client_id <> new.id\n", "      and identity.client_id = new.id\n",
      /otra ficha no puede tomar el RIF de una empresa secundaria: se esperaba rechazo/],
    ["la RPC no mira clients.rif", "      and public.billing_doc_norm(other.rif) = v_norm\n", "      and false\n",
      /el RIF de otra ficha se bloquea/],
    ["límite anti-enumeración flojo",
      "    if v_blocked >= 5 then\n      return query select 'rate_limited'::text;",
      "    if v_blocked >= 50 then\n      return query select 'rate_limited'::text;",
      /con 5 bloqueos en 24 h un documento libre también se frena/],
    ["marketing lee identidades", "in ('accounting', 'admin', 'commercial')",
      "in ('accounting', 'admin', 'commercial', 'marketing')", /el Studio lee por tenant y rol/],
    ["la auditoría guarda el documento",
      "pg_catalog.jsonb_build_object('kind', v_kind, 'document_changed', v_doc_changed,",
      "pg_catalog.jsonb_build_object('kind', v_kind, 'doc', v_doc, 'document_changed', v_doc_changed,",
      /la auditoría registra el cambio sin el documento/],
  ])("mutante %s: el contrato lo detecta", async (_label, from, to, expected) => {
    const { error } = await run(psql(CONTRACT, { replace: { [M0466]: mutant(from, to) } }));
    expect(error).toMatch(expected);
  }, SLOW);
});
