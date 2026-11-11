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
const MIGRATION = "0535_bcv_rates_system_audit.sql";
const SQL = readFileSync(resolve(ROOT, "supabase/migrations", MIGRATION), "utf8");
const SLOW = 240_000;
const INSTALL_CATALOG = `select pg_catalog.jsonb_build_object(
  'audit', (select pg_catalog.to_jsonb(p) from pg_catalog.pg_proc p
    where p.oid=pg_catalog.to_regprocedure('public.audit_fx_rate_change()')),
  'append', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.oid) from pg_catalog.pg_proc p
    where p.oid in (
      'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure,
      'public.append_audit_event_v1(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure)),
  'table', (select pg_catalog.to_jsonb(c) from pg_catalog.pg_class c where c.oid='public.fx_rates'::regclass),
  'triggers', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid='public.fx_rates'::regclass),
  'capability', pg_catalog.to_regprocedure('public.bcv_rates_write_capability()')::text
) as snapshot`;

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
    return { error: null, green: rows.map(row => String(row.resultado ?? "")).find(value => /^(TEST BCV0535 GREEN|TEST 0495 GREEN)/.test(value)),
      initialContext: rows.find(row => row.fixture_initial_context)?.fixture_initial_context,
      restoredContext: rows.find(row => row.fixture_restored_context)?.fixture_restored_context };
  } catch (error) { return { error: error instanceof Error ? error.message : String(error), green: undefined,
    initialContext: undefined, restoredContext: undefined }; }
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

describe("R1–R10 · auditoríaBCV0535 real en PGlite, HTTP separado", () => {
  it("contrato real confirma SYSTEM/job/motivo/rollback y drift", async () => {
    const result = await contract(); expect(result.error).toBeNull(); expect(result.green).toMatch(/^TEST BCV0535 GREEN: \d+ aserciones$/);
    expect(result.initialContext).toMatchObject({ effective_user: "postgres", login_user: "postgres", superuser: "on" });
    expect(result.restoredContext).toMatchObject({ effective_user: "postgres", login_user: "postgres", superuser: "on" });
    console.info("Contexto inicial/restaurado de fixture:", JSON.stringify({ initial: result.initialContext, restored: result.restoredContext }));
  }, SLOW);
  it("ausencia0535 cae en aserción funcional, no en missing-import", async () => {
    expect((await contract({ applyFix: false })).error).toContain("capability0535 instalada, no fallback");
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
  it("R2 · fallo después de reemplazar/crear revierte catálogo en la mismaDB comprometida", async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    try {
      // COMMIT de la fixture previo al BEGIN de instalación: cerrar una DB no prueba rollback.
      await db.exec(inline(CONTRACT, { apply_fix: "false", fixture_only: "true" }));
      const before = (await db.query<{ snapshot: Record<string, unknown> }>(INSTALL_CATALOG)).rows[0].snapshot;
      expect(before.capability).toBeNull(); expect(before.audit).not.toBeNull(); expect(before.append).not.toBeNull();
      const anchor = "  grant execute on function public.bcv_rates_write_capability() to service_role;";
      expect(SQL.split(anchor)).toHaveLength(2);
      const rejected = SQL.replace(anchor, anchor + `
  -- Inyección SOLO de esta fixture: ambos DDL ya ocurrieron dentro del DO/BEGIN.
  if pg_catalog.to_regprocedure('public.bcv_rates_write_capability()') is null
     or (select pg_catalog.md5(p.prosrc) from pg_catalog.pg_proc p
         where p.oid='public.audit_fx_rate_change()'::regprocedure)='b08dabd9181839c55d879e27a1e35608' then
    raise exception 'BCV_TEST_INJECTION_NOT_AFTER_CREATION';
  end if;
  raise exception 'BCV_TEST_POSTCREATE_ABORT';`);
      await expect(db.exec("begin;\n" + rejected + "\ncommit;")).rejects.toThrow("BCV_TEST_POSTCREATE_ABORT");
      await db.exec("rollback;");
      const after = (await db.query<{ snapshot: Record<string, unknown> }>(INSTALL_CATALOG)).rows[0].snapshot;
      // Filas pg_proc completas incluyen OID/owner/ACL/prosrc; tabla/trigger/cadena exactos.
      expect(after).toEqual(before); expect(after.capability).toBeNull();
    } finally { await db.close(); }
  }, SLOW);
  it.each([
    { from: "v_source := 'job';", to: "v_source := 'rpc';", assertion: "alta R3: un evento SYSTEM/job, motivo fijo, cuatro campos" },
    { from: "end || pg_catalog.to_char(new.valid_on,'YYYY-MM-DD') || '.';", to: "end || pg_catalog.to_char(new.valid_on,'YYYY-MM-DD') || '.';\n    v_reason := null;", assertion: "alta R3: un evento SYSTEM/job, motivo fijo, cuatro campos" },
    { from: "or v_claims->>'role' is distinct from 'service_role' or v_claims ? 'sub'", to: "or v_claims->>'role' is distinct from 'service_role'", assertion: "sub null no equivale a ausencia" },
    { from: "if v_claims ? 'sub' then", to: "if false then -- mutación sintética: omite el guard de sub del trigger", assertion: "sub null DML no habilita SYSTEM/job" },
    { from: "'ready',coalesce(v_ready,false)", to: "'ready',true", assertion: "trigger disabled cierra capability" },
  ])("mutante funcional $assertion", async ({ from, to, assertion }) => {
    expect(SQL.split(from)).toHaveLength(2);
    const changed = reapproveMutant(SQL, SQL.replace(from, to));
    expect((await contract({ migration: changed })).error).toContain(assertion);
  }, SLOW);
});
