// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0500_annual_billing_caracas.test.sql");
const NAME = "0500_annual_billing_caracas.sql";
const MIGRATION = readFileSync(resolve(ROOT, "supabase/migrations", NAME), "utf8");
const SLOW = 240_000;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const ORIGINAL_HASH = sha256(MIGRATION);
type Group = "v1" | "v2" | "portal" | "permissions";
const GROUPS: Group[] = ["v1", "v2", "portal", "permissions"];

/** Includes explícitos y variables psql. No descubre ni aplica otra migración. */
function inline(vars: Record<string, string>, migration = MIGRATION): string {
  const state = { ...vars }, out: string[] = [];
  function run(file: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    const source = file.endsWith(NAME) ? migration : readFileSync(file, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) { if (active()) out.push(line); continue; }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const text = defined ? String(defined[1] in state) : rest.startsWith(":") ? state[rest.slice(1).trim()] : rest.trim();
          if (!/^(true|false|on|off|1|0)$/i.test(text ?? "")) throw new Error("booleano psql inválido: " + rest);
          taken = /^(true|on|1)$/i.test(text);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack.at(-1); if (!frame) throw new Error("else sin if"); frame.active = !frame.taken;
      } else if (command === "endif") {
        if (!stack.pop()) throw new Error("endif sin if");
      } else if (!active()) { continue;
      } else if (command === "set") {
        const [name, value] = rest.trim().split(/\s+/); if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        run(resolve(dirname(file), rest.trim()));
      } else { throw new Error("metaorden psql no soportada: " + command); }
    }
    if (stack.length) throw new Error("if sin cerrar: " + file);
  }
  run(CONTRACT);
  return out.join("\n").replace(/pg_read_file\('\/sb\/migrations\/([a-z0-9_]+\.sql)'\)/g, (_match, name: string) =>
    "'" + readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8").replaceAll("\r\n", "\n").replaceAll("'", "''") + "'");
}

async function contract(options: { apply?: boolean; groups?: Group[]; migration?: string } = {}) {
  const groups = options.groups ?? GROUPS;
  const vars = Object.fromEntries(GROUPS.map((name) => ["test_" + name, String(groups.includes(name))]));
  const sql = inline({ ...vars, apply_fix: String(options.apply ?? true) }, options.migration);
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((r) => r.rows as Record<string, unknown>[]);
    return { error: null as string | null, rows, green: rows.find((r) => String(r.resultado).startsWith("TEST 0500 GREEN"))?.resultado };
  } catch (error) { return { error: error instanceof Error ? error.message : String(error), rows: [], green: undefined };
  } finally { await db.close(); }
}

const functions = {
  v1: /create or replace function public\.studio_client_annual_billing\(p_as_of date\)[\s\S]*?\n\$\$;/,
  v2: /create or replace function public\.studio_client_annual_billing_v2\(p_as_of date\)[\s\S]*?\n\$\$;/,
  portal: /create or replace function public\.get_portal_referral_program\(\)[\s\S]*?\n\$function\$;/,
};
function mutate(group: keyof typeof functions, anchor: string, replacement: string, count: number) {
  const original = MIGRATION.match(functions[group])?.[0];
  if (!original) throw new Error("función ausente: " + group);
  expect(original.split(anchor).length - 1, "ancla exacta " + group).toBe(count);
  return MIGRATION.replace(original, () => original.replaceAll(anchor, replacement));
}
const temporalFailure = (group: Group) => group === "portal" ? /^TEST 0500: portal legado lower calendario/ : new RegExp("^TEST 0500: " + group + " lower y upper inclusivos");
const realFailure = (group: Group) => "TEST 0500: fase real " + (group === "portal" ? "Portal conserva futuro" : group === "v1" ? "v1 legada compatible" : "v2 completa compatible");

describe("0500 · anuales Caracas, DDL real antes de copias de reloj", () => {
  it("las tres definiciones completas solo difieren en las seis expresiones de día y seis fallbacks", () => {
    for (const group of ["v1", "v2", "portal"] as const) {
      const file = group === "v1" ? "0411_client_annual_billing_facade.sql" : "0498_annual_billing_fx_v2.sql";
      const oldSource = readFileSync(resolve(ROOT, "supabase/migrations", file), "utf8").replaceAll("\r\n", "\n").replace("create function public.studio_client_annual_billing_v2", "create or replace function public.studio_client_annual_billing_v2");
      const oldDefinition = oldSource.match(functions[group])?.[0];
      const current = MIGRATION.match(functions[group])?.[0];
      expect(oldDefinition).toBeDefined(); expect(current).toBeDefined();
      const reversed = current!
        .replaceAll("(pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date", "current_date")
        .replaceAll("(i.created_at at time zone 'America/Caracas')::date", group === "portal" ? "i.created_at::date" : "(i.created_at at time zone 'UTC')::date");
      expect(reversed).toBe(oldDefinition);
    }
  });
  it("contrato íntegro, catálogo medido, IANA/calendario/DTO/seguridad y restauración", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0500 GREEN: \d+ aserciones$/);
    const catalog = result.rows.find((r) => r.catalogo_real)?.catalogo_real as {
      fase: string; antes: { proname: string; body_md5: string }[]; despues: { definition: string; body_md5: string }[];
    };
    expect(catalog.fase).toBe("DDL-real-intacta");
    expect(catalog.antes.map((r) => r.body_md5).sort()).toEqual([
      "7c2b0441e1de89bbf4f23054813acc5b", "6cf40c5a38865b2bba9b1bb5017cc620", "faa932bd5dac31bc560ed2085670432d",
    ].sort());
    for (const row of catalog.despues) {
      expect(row.definition.match(/pg_catalog.transaction_timestamp\(\)/g)).toHaveLength(2);
      expect(row.definition).not.toContain("current_date");
      expect(row.definition).not.toContain("statement_timestamp");
      expect(row.definition).not.toContain("clock_timestamp");
    }
    expect(sha256(readFileSync(resolve(ROOT, "supabase/migrations", NAME), "utf8"))).toBe(ORIGINAL_HASH);
  }, SLOW);

  it.each(["v1", "v2", "portal"] as const)("ROJO independiente %s sobre las fuentes anteriores, sin fallo de arranque", async (group) => {
    const result = await contract({ apply: false, groups: [group] });
    expect(result.error).toMatch(temporalFailure(group));
  }, SLOW);

  it.each(["v1", "v2", "portal"] as const)("VERDE independiente %s, sin interferencia de otro consumidor", async (group) => {
    const result = await contract({ groups: [group] });
    expect(result.error).toBeNull(); expect(result.green).toMatch(/^TEST 0500 GREEN:/);
  }, SLOW);

  it.each(["v1", "v2", "portal"] as const)("mata UTC en fallback de %s", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, "(i.created_at at time zone 'America/Caracas')::date", "(i.created_at at time zone 'UTC')::date", 2) });
    expect(result.error).toMatch(temporalFailure(group));
  }, SLOW);
  it.each(["v1", "v2", "portal"] as const)("mata zona de sesión en fallback de %s", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, "(i.created_at at time zone 'America/Caracas')::date", "i.created_at::date", 2) });
    expect(result.error).toMatch(temporalFailure(group));
  }, SLOW);
  it.each(["v1", "v2", "portal"] as const)("mata ignorar issued_at en %s", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, "i.issued_at,", "null::date,", 2) });
    expect(result.error).toBe(realFailure(group));
  }, SLOW);
  it.each(["v1", "v2", "portal"] as const)("mata365 días en %s por escenario bisiesto", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, "interval '1 year'", "interval '365 days'", group === "portal" ? 2 : 1) });
    expect(result.error).toMatch(temporalFailure(group));
    expect(result.error).toContain(" 5/");
  }, SLOW);
  it.each(["v2", "legado"] as const)("mata upper añadido solo al Portal %s", async (field) => {
    const expression = "and coalesce(i.issued_at, (i.created_at at time zone 'America/Caracas')::date) <= (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date and i.tenant_id = p.tenant_id";
    const definition = MIGRATION.match(functions.portal)![0];
    const parts = definition.split("where i.tenant_id = p.tenant_id");
    expect(parts).toHaveLength(3);
    const occurrence = field === "v2" ? 0 : 1;
    const changed = parts.map((part, n) => n < 2 ? part + (n === occurrence ? "where true " + expression : "where i.tenant_id = p.tenant_id") : part).join("");
    const result = await contract({ groups: ["portal"], migration: MIGRATION.replace(definition, () => changed) });
    expect(result.error).toBe(field === "v2" ? "TEST 0500: fase real Portal conserva futuro" : "TEST 0500: fase real Portal legado conserva futuro");
  }, SLOW);
  it.each(["v1", "v2"] as const)("mata quitar upper de Studio %s", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, ") <= p_as_of", ") <= date '9999-12-31'", 1) });
    expect(result.error).toBe(realFailure(group));
  }, SLOW);

  it.each(["v1", "v2", "portal"] as const)("mata reloj UTC de %s conservando fallback Caracas", async (group) => {
    const result = await contract({ groups: [group], migration: mutate(group, "(pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date", "(pg_catalog.transaction_timestamp() at time zone 'UTC')::date", 2) });
    expect(result.error).toMatch(group === "portal" ? temporalFailure(group) : new RegExp("^TEST 0500: " + group + " tolerancia extremo -1"));
  }, SLOW);
  it.each(["v1", "v2"] as const)("mata retirar validación ±1 de %s", async (group) => {
    const start = "if p_as_of is null\n     or p_as_of < (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date - 1\n     or p_as_of > (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date + 1 then";
    const removed = "if false\n     or (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date is null\n     or (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date is null then";
    const result = await contract({ groups: [group], migration: mutate(group, start, removed, 1) });
    expect(result.error).toMatch(new RegExp("^TEST 0500: " + group + " rechaza ±2"));
  }, SLOW);

  it("preflight falla ante deriva real de fachada previa", async () => {
    const migration = "create or replace function public.get_portal_referral_program() returns jsonb language sql stable security definer set search_path='' as $$select null::jsonb$$;\n" + MIGRATION;
    expect((await contract({ migration })).error).toBe("0500: fachada previa distinta de base 0411/0498: public.get_portal_referral_program()");
  }, SLOW);
});
