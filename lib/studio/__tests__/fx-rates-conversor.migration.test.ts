// @vitest-environment node
/**
 * SDD-0569 · La migración 0495 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0495_fx_rates_conversor_usd.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato, con los `.sql` reales de las migraciones inlineados.
 *
 * CONTROL ROJO: sin 0495 el contrato falla en la primera aserción. MUTANTES: sin
 * cada regla del conversor y de la tabla, el contrato (o el postflight) cae en
 * esa regla. Además: el preflight con filas en tenant_fx_history y la reaplicación.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0495_fx_rates_conversor_usd.test.sql");
const CONTRACT_NAME = "0495_fx_rates_conversor_usd.test.sql";
const M0495 = "0495_fx_rates_conversor_usd.sql";
const FILE_0495 = readFileSync(resolve(ROOT, "supabase/migrations", M0495), "utf8");
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

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

async function contract(options: { applyFix?: boolean; migration?: string; replace?: Record<string, string> } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    { ...(options.migration ? { [M0495]: options.migration } : {}), ...(options.replace ?? {}) });
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0495 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0495 con un único cambio; falla si el texto a cambiar no aparece una sola vez. */
function mutant(from: string, to: string): string {
  expect(FILE_0495.split(from)).toHaveLength(2);
  return FILE_0495.split(from).join(to);
}

describe("SDD-0569 · 0495 conversor a USD y tabla de tasas (PGlite)", () => {
  it("el contrato pasa con 0495", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0495 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0495 falla en la primera aserción", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0495: existe public.to_usd(numeric,text,numeric)");
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "la versión no cambia al actualizar",
      from: "  new.write_version := old.write_version + 1;",
      to: "  new.write_version := old.write_version;",
      fails: "TEST 0495: la versión distingue dos escrituras dentro de la misma transacción",
    },
    {
      name: "la versión enviada por el cliente se acepta",
      from: "  new.write_version := old.write_version + 1;",
      to: "  new.write_version := new.write_version + 1;",
      fails: "TEST 0495: cualquier cambio de factura incrementa versión e ignora la versión propuesta",
    },
    {
      name: "el trigger solo protege cambios de moneda",
      from: "  before update on public.invoices\n  for each row execute function public.increment_invoice_write_version();",
      to: "  before update of currency on public.invoices\n  for each row execute function public.increment_invoice_write_version();",
      fails: "0495: postflight — falta el trigger de versión en todo UPDATE de invoices",
    },
    {
      name: "los documentos nacen como override sin decisión expresa",
      from: "  add column fx_rate_is_override boolean not null default false;",
      to: "  add column fx_rate_is_override boolean not null default true;",
      fails: "0495: postflight — intención de tasa o versión sin tipo/default esperado",
    },
    {
      name: "sin tasa devuelve null en vez de fallar cerrado",
      from: "    if p_rate is null or p_rate <= 0 or p_rate >= 1000000000000 then\n      raise exception 'FX_RATE_MISSING'",
      to: "    if false then\n      raise exception 'FX_RATE_MISSING'",
      fails: "TEST 0495: VES sin tasa falla cerrado (no el nominal)",
    },
    {
      name: "sin el tope, NaN e Infinity pasan como tasa",
      from: "    if p_rate is null or p_rate <= 0 or p_rate >= 1000000000000 then\n      raise exception 'FX_RATE_MISSING'",
      to: "    if p_rate is null or p_rate <= 0 then\n      raise exception 'FX_RATE_MISSING'",
      fails: "TEST 0495: NaN e Infinity no son una tasa",
    },
    {
      name: "USDT no vale 1:1",
      from: "  if v_moneda in ('USD', 'USDT') then",
      to: "  if v_moneda in ('USD') then",
      fails: "TEST 0495: USD y USDT valen 1:1, sin tasa (decisión 1 de Sam)",
    },
    {
      name: "RMB no se normaliza a CNY",
      from: "when 'RMB' then 'CNY'",
      to: "when 'XXX' then 'CNY'",
      fails: "TEST 0495: CNY se divide por la tasa, y RMB es CNY",
    },
    {
      name: "una moneda desconocida devuelve el monto",
      from: "  raise exception 'FX_CURRENCY_UNKNOWN' using errcode = '22023', hint = 'dtd-fx';",
      to: "  return p_amount;",
      fails: "TEST 0495: una moneda desconocida falla cerrado",
    },
    {
      name: "to_usd no es IMMUTABLE",
      from: "returns numeric\nlanguage plpgsql\nimmutable\nset search_path = ''",
      to: "returns numeric\nlanguage plpgsql\nvolatile\nset search_path = ''",
      fails: "0495: postflight — to_usd tiene que ser IMMUTABLE y fx_rate_on STABLE",
    },
    {
      name: "ese día no gana la del BCV",
      from: "case f.source when 'bcv' then 0 when 'manual' then 1 else 2 end",
      to: "case f.source when 'bcv' then 2 when 'manual' then 1 else 0 end",
      fails: "TEST 0495: ese día gana la del BCV",
    },
    {
      name: "fx_rate_on sin tasa no falla cerrado",
      from: "  if not found then\n    raise exception 'FX_RATE_MISSING'",
      to: "  if false then\n    raise exception 'FX_RATE_MISSING'",
      fails: "TEST 0495: sin ninguna tasa anterior, falla cerrado",
    },
    {
      name: "commercial registra tasas",
      from: "      and ut.disabled_at is null and pg_catalog.lower(pg_catalog.btrim(ut.role)) in ('admin', 'accounting')",
      to: "      and ut.disabled_at is null",
      fails: "TEST 0495: commercial no registra tasas",
    },
    {
      name: "una tasa con fecha futura se registra",
      from: "  if p_valid_on is null or p_valid_on > v_hoy then",
      to: "  if p_valid_on is null then",
      fails: "TEST 0495: una tasa no se registra con fecha futura",
    },
    {
      name: "la auditoría no registra la corrección",
      from: "  after insert or update or delete on public.fx_rates",
      to: "  after insert or delete on public.fx_rates",
      fails: "TEST 0495: la auditoría D2 guarda la tasa anterior y la nueva",
    },
    {
      name: "authenticated escribe la tabla",
      from: "grant select on public.fx_rates to authenticated;",
      to: "grant select, insert on public.fx_rates to authenticated;",
      fails: "0495: postflight — authenticated solo lee fx_rates",
    },
    {
      name: "la fuente de la tasa de la factura acepta cualquier texto",
      from: "alter table public.invoices\n  alter column fx_rate type numeric(20,8),\n  add column fx_rate_source   text check (fx_rate_source is null or fx_rate_source in ('bcv', 'manual', 'operacion')),",
      to: "alter table public.invoices\n  alter column fx_rate type numeric(20,8),\n  add column fx_rate_source   text,",
      fails: "TEST 0495: la fuente de la tasa del documento es bcv, manual u operacion",
    },
    {
      name: "fx_rate_on sin filtro de tenant en la consulta",
      from: "    where f.tenant_id = p_tenant_id and f.currency = v_moneda and f.valid_on <= p_on",
      to: "    where f.currency = v_moneda and f.valid_on <= p_on",
      fails: "TEST 0495: fx_rate_on filtra por el tenant pedido también sin RLS",
    },
    {
      name: "la RLS de fx_rates no filtra por tenant",
      from: "  for select to authenticated using (tenant_id = public.get_user_tenant_id());",
      to: "  for select to authenticated using (true);",
      fails: "TEST 0495: otro tenant no ve las tasas del tenant A",
    },
    {
      name: "la auditoría guarda la nota",
      from: "'valid_on', v_new->'valid_on', 'source', v_new->'source') end;",
      to: "'valid_on', v_new->'valid_on', 'source', v_new->'source', 'note', v_new->'note') end;",
      fails: "TEST 0495: la auditoría D2 de fx_rates no guarda datos personales: solo moneda, tasa, día y fuente",
    },
    {
      name: "borrar una tasa sin motivo (revisión, hallazgo 1)",
      from: "\n    when 'DELETE' then 'Tasa de cambio eliminada de la base, fuera del Studio.' end;",
      to: " end;",
      fails: "TEST 0495: una tasa se puede borrar",
    },
    {
      name: "la RPC acepta más de 8 decimales (hallazgo 14)",
      from: "  if p_rate <> pg_catalog.round(p_rate, 8) then",
      to: "  if false then",
      fails: "TEST 0495: una tasa con más de 8 decimales se rechaza",
    },
    {
      name: "la tasa de la factura sigue en numeric(14,4) (hallazgo 6)",
      from: "alter table public.invoices\n  alter column fx_rate type numeric(20,8),\n",
      to: "alter table public.invoices\n",
      fails: "0495: postflight — fx_rate de invoices y supplier_bills no quedó en numeric(20,8)",
    },
    {
      name: "fx_rates sin RLS (hallazgo 14)",
      from: "alter table public.fx_rates enable row level security;\n",
      to: "",
      fails: "0495: postflight — fx_rates sin RLS o legible por anon",
    },
    {
      name: "el tope de to_usd distinto del de TS (hallazgo 12)",
      from: "p_amount >= 1000000000000 or p_amount <= -1000000000000",
      to: "p_amount > 1000000000000 or p_amount < -1000000000000",
      fails: "TEST 0495: el tope es el mismo que en TS: |monto| < 1e12",
    },
    {
      name: "un monto nulo vuelve nulo (hallazgo 12)",
      from: "  if p_amount is null or p_amount",
      to: "  if p_amount",
      fails: "TEST 0495: un monto nulo falla cerrado, como en TS",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }

  it("el preflight aborta si tenant_fx_history tiene filas (no hay backfill)", async () => {
    const contrato = readFileSync(CONTRACT, "utf8");
    const antes = "\\if :apply_fix\n\\ir ../migrations/0495_fx_rates_conversor_usd.sql";
    expect(contrato.split(antes)).toHaveLength(2);
    const conFila = contrato.split(antes).join(
      "insert into public.tenants (id, slug, display_name) values ('00000000-0000-0000-0000-0000000000aa', 'x', 'X');\n" +
        "insert into public.tenant_fx_history (tenant_id, currency_pair, rate) values ('00000000-0000-0000-0000-0000000000aa', 'VES/USD', 36);\n" +
        antes,
    );
    const result = await contract({ replace: { [CONTRACT_NAME]: conFila } });
    expect(result.error).toBe(
      "0495 abortado: tenant_fx_history tiene 1 fila(s); el Director midió 0 el 2026-10-20 y no hay backfill. Revisar antes de aplicar",
    );
  }, SLOW);

  it("aplicada dos veces, la segunda aborta con «ya existe»", async () => {
    const result = await contract({ migration: FILE_0495 + "\n" + FILE_0495 });
    expect(result.error).toBe("0495 abortado: la tabla de tasas ya existe");
  }, SLOW);

  it("el preflight aborta ante una instalación parcial de la versión de factura", async () => {
    const contrato = readFileSync(CONTRACT, "utf8");
    const antes = "\\if :apply_fix\n\\ir ../migrations/0495_fx_rates_conversor_usd.sql";
    expect(contrato.split(antes)).toHaveLength(2);
    const parcial = contrato.replace(antes, "alter table public.invoices add column write_version bigint;\n" + antes);
    const result = await contract({ replace: { [CONTRACT_NAME]: parcial } });
    expect(result.error).toBe("0495 abortado: intención de tasa o versión de factura ya existe; revisar instalación parcial");
  }, SLOW);

  it("aplicada al servidor propio el 2026-10-20: ya no es una espera y la cabecera «NO APLICADA» no se corrige", () => {
    const baseline = JSON.parse(readFileSync(resolve(ROOT, "supabase/migrations-baseline.json"), "utf8")) as {
      pendingBelowCutoff: Record<string, string>;
    };
    expect(baseline.pendingBelowCutoff["0495_fx_rates_conversor_usd"]).toBeUndefined();
    expect(FILE_0495).toContain(
      "⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff",
    );
  });
});
