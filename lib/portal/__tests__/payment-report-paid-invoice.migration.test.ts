// @vitest-environment node
/**
 * SDD-0484 · La migración 0464 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0464_…test.sql` sólo corre en `verify` con Docker
 * y el CI de calidad no lo ejecuta. PGlite corre ese MISMO contrato —con los
 * `.sql` reales de 0421, 0422, 0423 y 0464 inlineados— así que lo que se prueba
 * es el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: el contrato también corre SIN 0464 y tiene que fallar en la
 * factura pagada. MUTANTES: sin cada regla (o con `>=` en el saldo) el contrato
 * falla en la aserción de esa regla, no en otra.
 *
 * L14: 0422 y 0423 esperan en pendingBelowCutoff. Con 0464 aplicada antes,
 * entre ellas o después, sus contratos completos siguen en verde.
 *
 * PGlite tiene UNA conexión: la carrera de dos confirmaciones se prueba con
 * sesiones reales en `scripts/qa/payment-report-confirm-race.mjs`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const TESTS = resolve(ROOT, "supabase/tests");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const M0464 = "0464_reporte_pago_factura_pagada.sql";
const FILE_0464 = readFileSync(resolve(MIGRATIONS, M0464), "utf8");
const SLOW = 240_000;

type Vars = Record<string, string>;
type Options = { vars?: Vars; inject?: Record<string, string[]>; replace?: Record<string, string> };

const TRUE = /^(t|tr|tru|true|on|y|ye|yes|1)$/i;
const FALSE = /^(f|fa|fal|fals|false|of|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes que usan estos contratos: \set, \unset,
 * \if :{?v} / :v, \else, \endif, \ir y \quit. `inject` inlinea migraciones justo
 * después del `\ir` de otra; `replace` sustituye el texto de una migración (un
 * mutante). `pg_read_file('/sb/…')` —el montaje de Docker— se inlinea como
 * literal con el mismo texto.
 */
function psql(file: string, { vars = {}, inject = {}, replace = {} }: Options = {}): string {
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
        const target = resolve(dirname(path), rest.trim());
        run(target);
        for (const [after, extra] of Object.entries(inject)) {
          if (target.endsWith(after)) extra.forEach((name) => run(resolve(MIGRATIONS, name)));
        }
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

const contract = (name: string) => resolve(TESTS, name + ".test.sql");

async function run(sql: string): Promise<{ error: string | null; notices: string[] }> {
  const db = new PGlite({ extensions: { pgcrypto } });
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

/** Cuerpo de run_report_command tal como queda en prosrc. */
function body(sql: string): string {
  const start = sql.indexOf("function payment_private.run_report_command(");
  const from = sql.indexOf("$function$", start) + "$function$".length;
  return sql.slice(from, sql.indexOf("$function$;", from));
}
const md5 = (text: string) => createHash("md5").update(text).digest("hex");

/** Mutante de 0464 con la huella del postflight recalculada: sólo cambia la regla. */
function mutant(from: string, to: string): string {
  expect(FILE_0464.split(from)).toHaveLength(2);
  const mutated = FILE_0464.replace(from, to);
  return mutated.replace(`md5(prosrc) = '${md5(body(FILE_0464))}'`, `md5(prosrc) = '${md5(body(mutated))}'`);
}

describe("0464 · reportes de pago sobre facturas pagadas (PGlite)", () => {
  it("el postflight fija la huella del cuerpo de este archivo", () => {
    expect(FILE_0464).toContain(`pg_catalog.md5(prosrc) = '${md5(body(FILE_0464))}'`);
    // El preflight exige el cuerpo exacto de 0421, aplicado en producción.
    const file0421 = readFileSync(resolve(MIGRATIONS, "0421_payment_report_commands.sql"), "utf8");
    expect(md5(file0421)).toBe("6944ffddf61f4d20514ff78aad7f983f");
    expect(FILE_0464).toContain(`'${md5(body(file0421))}'`);
    expect(FILE_0464).toContain(`'${md5(body(file0421).replace(/[ \t\n\r\f\v]/g, ""))}'`);
  });

  it("el contrato completo pasa con la cadena real 0421 → 0464", async () => {
    const { error, notices } = await run(psql(contract("0464_reporte_pago_factura_pagada")));
    expect(error).toBeNull();
    expect(notices.join("\n")).toMatch(/TEST 0464 GREEN: 45 aserciones/);
  }, SLOW);

  it("control rojo: sin 0464 el contrato falla en la factura pagada", async () => {
    const { error } = await run(psql(contract("0464_reporte_pago_factura_pagada"), { vars: { apply_fix: "false" } }));
    expect(error).toMatch(/TEST 0464: confirmar sobre factura pagada: se esperaba rechazo PAYMENT_INVOICE_PAID/);
  }, SLOW);

  const PAID_RULE = `  if p_kind = 'confirm' and v_inv.status = 'pagada' then
    raise exception 'PAYMENT_INVOICE_PAID' using errcode = '23514';
  end if;
`;
  const BALANCE_RULE = `  if p_kind = 'confirm'
     and v_rep.amount > v_inv.total_amount - coalesce(v_inv.paid_amount, 0) then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = '23514';
  end if;
`;
  const CANCEL_REASON = `cancelled_by = v_actor,
        resolution_reason = v_reason
      where id = p_report_id`;
  it.each([
    ["sin la regla de factura pagada", PAID_RULE, "",
      /confirmar sobre factura pagada esperaba 23514 PAYMENT_INVOICE_PAID, obtuvo 23514 PAYMENT_EXCEEDS_BALANCE/],
    ["sin la regla del saldo", BALANCE_RULE, "",
      /emitida: un centavo sobre el saldo: se esperaba rechazo PAYMENT_EXCEEDS_BALANCE/],
    ["saldo comparado con >=", BALANCE_RULE, BALANCE_RULE.replace("v_rep.amount >", "v_rep.amount >="),
      /^PAYMENT_EXCEEDS_BALANCE$/],
    ["cancelar sin guardar el motivo", CANCEL_REASON, `cancelled_by = v_actor
      where id = p_report_id`, /el motivo de la cancelación queda en el reporte, recortado/],
    ["guardar el motivo sin recortar", CANCEL_REASON, CANCEL_REASON.replace("= v_reason", "= p_input ->> 'reason'"),
      /el motivo de la cancelación queda en el reporte, recortado/],
  ])("mutante %s: el contrato lo detecta", async (_label, from, to, expected) => {
    const { error } = await run(psql(contract("0464_reporte_pago_factura_pagada"), {
      replace: { [M0464]: mutant(from, to) },
    }));
    expect(error).toMatch(expected);
  }, SLOW);
});

describe("0464 no bloquea L14: 0422 y 0423 siguen pasando (PGlite)", () => {
  it("0464 antes de 0422: el contrato completo de 0422, preflight incluido, pasa", async () => {
    const { error, notices } = await run(psql(contract("0422_payment_report_command_boundary"), {
      inject: { "0421_payment_report_commands.sql": [M0464] },
    }));
    expect(error).toBeNull();
    expect(notices.join("\n")).toMatch(/TEST0422 GREEN: 301 aserciones/);
  }, SLOW);

  it.each([
    ["antes de 0422", "0421_payment_report_commands.sql", "0423_payment_report_historical_identity"],
    ["entre 0422 y 0423", "0422_payment_report_command_boundary.sql", "0423_payment_report_historical_identity"],
    ["antes de 0422, con el validador 0195 medido en Cloud", "0421_payment_report_commands.sql",
      "0423_payment_report_historical_identity_cloud"],
  ])("0464 %s: el contrato completo de 0423 pasa", async (_label, after, name) => {
    const { error } = await run(psql(contract(name), { inject: { [after]: [M0464] } }));
    expect(error).toBeNull();
  }, SLOW);

  it("0464 después de 0422 y 0423: aplica sobre el estado final y sus reglas rigen", async () => {
    const sql = psql(contract("0423_payment_report_historical_identity"));
    const end = sql.lastIndexOf("\nrollback;");
    const { error, notices } = await run(sql.slice(0, end) + "\n" + FILE_0464 + "\n" + AFTER_L14 + sql.slice(end));
    expect(error).toBeNull();
    expect(notices).toContain("L14 + 0464: confirmar sobre pagada rechazado y motivo guardado");
  }, SLOW);
});

// El rename de 0423 cambia el Shipping Mark del cliente A: se lee el vigente.
const AFTER_L14 = `
do $after_l14$
declare v_markbox text; v_message text;
begin
  select markbox into strict v_markbox from public.clients where id = pg_temp.fixture_id('client-A');
  insert into public.invoices (id, tenant_id, invoice_code, client_markbox, client_name, base_amount, total_amount, paid_amount, status, currency)
  values (pg_temp.fixture_id('l14-paid'), pg_temp.fixture_id('tenant-A'), 'F-L14-PAGADA', v_markbox, 'synthetic', 1000, 1000, 1000, 'pagada', 'USD');
  insert into public.payment_reports (id, tenant_id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, note, proof_path)
  select pg_temp.fixture_id(r), pg_temp.fixture_id('tenant-A'), pg_temp.fixture_id('l14-paid'), 'F-L14-PAGADA', v_markbox,
    100, 'USD', 'transferencia', current_date - 1, 'Nota sintética', pg_temp.proof_path('tenant-A', 'l14-paid', r)
  from unnest(array['l14-confirm', 'l14-cancel']) r;
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('accounting-A')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.resolve_payment_report(pg_temp.fixture_id('l14-req-confirm'), pg_temp.fixture_id('l14-confirm'),
      'confirmado', 'Pago cotejado por finanzas');
    v_message := 'aceptado';
  exception when others then
    get stacked diagnostics v_message = message_text;
  end;
  execute 'reset role';
  if v_message <> 'PAYMENT_INVOICE_PAID' then
    raise exception 'L14 + 0464: confirmar sobre factura pagada dio %', v_message;
  end if;
  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('portal-A')::text, true);
  execute 'set local role authenticated';
  perform public.cancel_portal_payment_report(pg_temp.fixture_id('l14-req-cancel'), pg_temp.fixture_id('l14-cancel'),
    'F-L14-PAGADA', 'Motivo después de L14');
  execute 'reset role';
  if (select resolution_reason from public.payment_reports where id = pg_temp.fixture_id('l14-cancel'))
     is distinct from 'Motivo después de L14' then
    raise exception 'L14 + 0464: la cancelación no guardó su motivo';
  end if;
  raise notice 'L14 + 0464: confirmar sobre pagada rechazado y motivo guardado';
end;
$after_l14$;
`;

describe("0464 · preflight y locks sobre la fixture de 0421 (PGlite)", () => {
  /** Un caso por transacción sobre la misma fixture confirmada; siempre rollback. */
  async function withFixture(check: (attempt: (sql: string) => Promise<string | null>, db: PGlite) => Promise<void>) {
    const db = new PGlite({ extensions: { pgcrypto } });
    try {
      await db.exec(psql(contract("0421_payment_report_commands"), { vars: { fixture_only: "true" } }));
      const attempt = async (sql: string) => {
        try {
          await db.exec("begin;\n" + sql);
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        } finally {
          await db.exec("rollback");
        }
      };
      await check(attempt, db);
    } finally {
      await db.close();
    }
  }

  it("aborta si ya se aplicó, si cambió la ACL o si falta el guard; acepta el mismo cuerpo con otros saltos", async () => {
    await withFixture(async (attempt) => {
      expect(await attempt(FILE_0464)).toBeNull();
      expect(await attempt(FILE_0464 + "\n" + FILE_0464)).toMatch(
        /0464 abortado: run_report_command no es el cuerpo de 0421 \(md5 [0-9a-f]{32}, sin espacios [0-9a-f]{32}\)/);
      expect(await attempt("grant execute on function payment_private.run_report_command(uuid,uuid,text,jsonb) to anon;\n"
        + FILE_0464)).toMatch(/0464 abortado: run_report_command sin el owner, la seguridad o la ACL de 0421/);
      expect(await attempt("drop trigger payment_reports_command_fields on public.payment_reports;\n" + FILE_0464))
        .toMatch(/0464 requiere resolution_reason, su CHECK de 4 a 500 y el guard de columnas de 0421/);
      // El cuerpo de 0421 con CRLF: md5 exacto distinto, igual sin espacios.
      const file0421 = readFileSync(resolve(MIGRATIONS, "0421_payment_report_commands.sql"), "utf8");
      const definition = file0421.slice(file0421.indexOf("create function payment_private.run_report_command("),
        file0421.indexOf("$function$;", file0421.indexOf("as $function$", file0421.indexOf("run_report_command("))) + 11);
      const crlf = definition.replace("create function", "create or replace function").replace(/\n/g, "\r\n");
      expect(await attempt(crlf + "\n" + FILE_0464)).toBeNull();
    });
  }, SLOW);

  it("no toma locks de tabla sobre invoices ni recibos; payment_reports sólo SHARE UPDATE EXCLUSIVE", async () => {
    await withFixture(async (_attempt, db) => {
      await db.exec("begin;\n" + FILE_0464);
      const { rows } = await db.query<{ relation: string; mode: string }>(`
        select c.oid::regclass::text as relation, l.mode
        from pg_locks l join pg_class c on c.oid = l.relation
        join pg_namespace n on n.oid = c.relnamespace
        where l.pid = pg_backend_pid() and n.nspname in ('public', 'payment_private', 'storage', 'auth')
        order by 1, 2`);
      await db.exec("rollback");
      expect(rows).toEqual([{ relation: "payment_reports", mode: "ShareUpdateExclusiveLock" }]);
    });
  }, SLOW);
});
