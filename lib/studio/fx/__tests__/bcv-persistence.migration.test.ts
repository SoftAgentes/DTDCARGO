// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/bcv_rates_system_audit.test.sql");
const MIGRATION = "0501_bcv_rates_system_audit.sql";
const SQL = readFileSync(resolve(ROOT, "supabase/migrations", MIGRATION), "utf8");
const SLOW = 240_000;

/** Mismas metaórdenes nativas ya usadas por el contrato0495, sin ejecutar psql. */
function inline(file: string, variables: Record<string, string>, replacements: Record<string, string> = {}): string {
  const state = { ...variables }, out: string[] = [];
  function run(path: string) {
    const replacement = Object.keys(replacements).find(key => path.endsWith(key));
    const source = replacement ? replacements[replacement] : readFileSync(path, "utf8");
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every(frame => frame.active);
    for (const line of source.split(/\r?\n/)) {
      const meta = /^\\(\w+)\s*(.*)$/.exec(line);
      if (!meta) { if (active()) out.push(line); continue; }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = /^:\{\?(\w+)\}$/.exec(rest);
          const value = defined ? String(defined[1] in state) : rest.startsWith(":") ? state[rest.slice(1)] : rest;
          if (!/^(true|false|t|f|on|off|yes|no|1|0)$/i.test(value ?? "")) throw new Error("if no booleano");
          taken = /^(true|t|on|yes|1)$/i.test(value);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack.at(-1); if (!frame) throw new Error("else sin if"); frame.active = !frame.taken;
      } else if (command === "endif") {
        if (!stack.pop()) throw new Error("endif sin if");
      } else if (!active()) continue;
      else if (command === "set") {
        const [name, value] = rest.split(/\s+/); if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") run(resolve(dirname(path), rest));
      else throw new Error("metaorden no soportada: " + command);
    }
    if (stack.length) throw new Error("if sin cerrar");
  }
  run(file); return out.join("\n");
}

async function contract(options: { file?: string; applyFix?: boolean; migration?: string; replace?: Record<string, string> } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(inline(options.file ?? CONTRACT, { apply_fix: String(options.applyFix ?? true), fixture_only: "false" },
      { ...(options.migration ? { [MIGRATION]: options.migration } : {}), ...options.replace }));
    const rows = results.flatMap(result => result.rows as Record<string, unknown>[]);
    return { error: null, green: rows.map(row => String(row.resultado ?? "")).find(value => /^(TEST BCV0501 GREEN|TEST 0495 GREEN)/.test(value)) };
  } catch (error) { return { error: error instanceof Error ? error.message : String(error), green: undefined }; }
  finally { await db.close(); }
}

/** Solo para mutación de fixture: permite llegar a la aserción de comportamiento.
 * No deriva confianza desde DB ni modifica la SQL original/huellas productivas. */
function reapproveMutant(original: string, changed: string): string {
  const body = (source: string, tag: string) => {
    const match = new RegExp(`as \\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$;`).exec(source);
    if (!match) throw new Error("cuerpo de fixture ausente: " + tag);
    return createHash("md5").update(match[1].replaceAll("\r\n", "\n")).digest("hex");
  };
  let result = changed.replaceAll(body(original, "audit"), body(changed, "audit"));
  result = result.replaceAll(body(original, "capability"), body(result, "capability"));
  return result;
}

describe("R1–R10 · auditoríaBCV0501 real en PGlite, HTTP separado", () => {
  it("contrato real confirma SYSTEM/job/motivo/rollback y drift", async () => {
    const result = await contract(); expect(result.error).toBeNull(); expect(result.green).toMatch(/^TEST BCV0501 GREEN: \d+ aserciones$/);
  }, SLOW);
  it("ausencia0501 cae en aserción funcional, no en missing-import", async () => {
    expect((await contract({ applyFix: false })).error).toContain("capability0501 instalada, no fallback");
  }, SLOW);
  it("R7 · contrato0495 original intacto sobre la cadena nueva conserva manual/CNY/frozen", async () => {
    const old = readFileSync(resolve(ROOT, "supabase/migrations/0495_fx_rates_conversor_usd.sql"), "utf8");
    const result = await contract({ file: resolve(ROOT, "supabase/tests/0495_fx_rates_conversor_usd.test.sql"),
      replace: { "0495_fx_rates_conversor_usd.sql": old + "\n" + SQL } });
    expect(result.error).toBeNull(); expect(result.green).toMatch(/^TEST 0495 GREEN: \d+ aserciones$/);
  }, SLOW);
  it("preflight rechaza cuerpo previo distinto", async () => {
    const old = readFileSync(resolve(ROOT, "supabase/migrations/0495_fx_rates_conversor_usd.sql"), "utf8");
    const changed = old.replace("v_actor_id uuid := (select auth.uid());", "v_actor_id uuid := (select auth.uid()); -- drift sintético");
    expect(changed).not.toBe(old);
    expect((await contract({ replace: { "0495_fx_rates_conversor_usd.sql": changed } })).error).toContain("auditoría previa distinta de0495");
  }, SLOW);
  it("reaplicación/instalación parcial no se sobreescribe", async () => {
    expect((await contract({ migration: SQL + "\n" + SQL })).error).toContain("capability ya existe");
  }, SLOW);
  it.each([
    { from: "v_source := 'job';", to: "v_source := 'rpc';", assertion: "alta R3: un evento SYSTEM/job, motivo fijo, cuatro campos" },
    { from: "end || pg_catalog.to_char(new.valid_on,'YYYY-MM-DD') || '.';", to: "end || pg_catalog.to_char(new.valid_on,'YYYY-MM-DD') || '.';\n    v_reason := null;", assertion: "alta R3: un evento SYSTEM/job, motivo fijo, cuatro campos" },
    { from: "or v_claims->>'role' is distinct from 'service_role' or v_claims ? 'sub'", to: "or v_claims->>'role' is distinct from 'service_role'", assertion: "sub null no equivale a ausencia" },
  ])("mutante funcional $assertion", async ({ from, to, assertion }) => {
    expect(SQL.split(from)).toHaveLength(2);
    const changed = reapproveMutant(SQL, SQL.replace(from, to));
    expect((await contract({ migration: changed })).error).toContain(assertion);
  }, SLOW);
});
