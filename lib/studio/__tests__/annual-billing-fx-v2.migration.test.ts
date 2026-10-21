// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0498_annual_billing_fx_v2.test.sql");
const M0498 = "0498_annual_billing_fx_v2.sql";
const MIGRATION = readFileSync(resolve(ROOT, "supabase/migrations", M0498), "utf8");
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
    { ...(options.migration ? { [M0498]: options.migration } : {}), ...(options.replace ?? {}) });
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const source0453 = readFileSync(resolve(ROOT, "supabase/migrations/0453_portal_helpers_principal_determinista.sql"), "utf8");
    const executable = sql.replace("pg_read_file('/sb/migrations/0453_portal_helpers_principal_determinista.sql')", () => "'" + source0453.replaceAll("'", "''") + "'");
    const results = await db.exec(executable);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0498 GREEN"));
    const measurement = rows.find((row) => row.medicion)?.medicion as { clasificaciones: number; facturas_elegibles: number } | undefined;
    return { error: null as string | null, green, measurement };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined, measurement: undefined };
  } finally {
    await db.close();
  }
}

describe("0498 annual billing v2 · contrato PostgreSQL embebido", () => {
  it("contrato real compatible, filtros y seguridad", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0498 GREEN: \d+ aserciones$/);
    expect(result.measurement?.facturas_elegibles).toBe(1201);
    expect(result.measurement?.clasificaciones).toBeGreaterThan(0);
    expect(result.measurement?.clasificaciones).toBeLessThanOrEqual(1201);
  }, SLOW);
  it("control sin expansión falla cerrado", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0498: existe RPC v2 sin retirar v1");
  }, SLOW);
  it.each([
    ["instalación parcial", "create schema annual_billing_private;\n" + MIGRATION, "0498: instalación previa o parcial; revisar antes de aplicar"],
    ["reaplicación", MIGRATION + "\n" + MIGRATION, "0498: instalación previa o parcial; revisar antes de aplicar"],
    ["frontera vieja", "drop policy invoices_accounting_select on public.invoices;\n" + MIGRATION, "0498: requiere frontera de lectura actual 0414"],
  ])("preflight aborta %s", async (_name, migration, message) => {
    const result = await contract({ migration });
    expect(result.error).toBe(message);
  }, SLOW);

  // Mutación en memoria: ni el SQL rastreado ni otros procesos ven producto mutado.
  it.each([
    ["CNY nominal", "public.to_usd(p_amount, p_currency, p_rate)", "public.to_usd(p_amount, case when p_currency='CNY' then 'USD' else p_currency end, p_rate)", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["usa base sin IVA", "convertir_factura_anual_usd(i.total_amount, i.currency::text, i.fx_rate)", "convertir_factura_anual_usd(i.base_amount, i.currency::text, i.fx_rate)", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["falta tasa nominal", "usd := null;", "usd := p_amount;", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["pierde contador", "count(*) filter (where c.fx_state = 'sin_tasa'),", "0::bigint,", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["omite tenant", "i.tenant_id = v_tenant and i.deleted_at is null", "i.deleted_at is null", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["incluye eliminada", "i.tenant_id = v_tenant and i.deleted_at is null", "i.tenant_id = v_tenant", "v2 convierte CNY y conserva parcial sin multiplicar"],
    ["solo positivos", "group by c.client_markbox order by c.client_markbox", "group by c.client_markbox having sum(c.usd)>0 order by c.client_markbox", "incluye cero negativo y solo sin tasa"],
    ["fallback zona sesión", "(i.created_at at time zone 'UTC')::date", "i.created_at::date", "fallbackUTC de Studio no depende de zona de sesión"],
    ["OR vuelve AND", "or coalesce((", "and coalesce((", "support por Fidelización y accounting autorizados"],
    ["Portal pierde futuro", "where i.tenant_id = p.tenant_id", "where coalesce(i.issued_at, i.created_at::date) <= current_date and i.tenant_id = p.tenant_id", "Portal conserva ventana futura sin cota superior"],
    ["captura mensaje ajeno", "v_hint is distinct from 'dtd-fx' or v_message not in ('FX_AMOUNT_INVALID', 'FX_RATE_MISSING', 'FX_CURRENCY_UNKNOWN')", "v_hint is distinct from 'dtd-fx'", "error SQL ajeno se relanza"],
    ["captura hint ajeno", "v_hint is distinct from 'dtd-fx' or ", "", "mensaje conocido con hint ajeno se relanza"],
    ["captura SQLSTATE ajeno", "exception when sqlstate '22023' then", "exception when others then", "mensaje y hint conocidos con SQLSTATE ajeno se relanza"],
  ])("mata mutante funcional: %s", async (_name, anchor, replacement, assertion) => {
    expect(MIGRATION).toContain(anchor);
    const result = await contract({ migration: MIGRATION.replace(anchor, replacement) });
    expect(result.error).toBe("TEST 0498: " + assertion);
  }, SLOW);
});
