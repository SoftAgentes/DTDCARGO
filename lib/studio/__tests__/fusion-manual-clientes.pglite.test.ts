// @vitest-environment node
/**
 * SDD-0712 · La migración 0572 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0572_fusion_manual_clientes.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato con los `.sql` reales inlineados (cadena real de
 * `merge_clients`: 0341, 0351, 0358, 0361, y la 0572): lo que se prueba es el
 * texto que el runbook aplicará, no un doble.
 *
 * CONTROL ROJO: sin la 0572 no hay búsqueda ni fusión manual.
 * MUTANTES: cada uno cambia la 0572 y tiene que morir con la aserción que lo
 * caza; si muriera por otra, la prueba falla.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0572_fusion_manual_clientes.test.sql");
const M0572 = "0572_fusion_manual_clientes.sql";
const FILE_0572 = readFileSync(resolve(ROOT, "supabase/migrations", M0572), "utf8").replace(/\r\n/g, "\n");
const SLOW = 300_000;
const ASERCIONES = 58;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/** psql → SQL plano: \set, \if :{?v} / :v, \else, \endif e \ir. */
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
    options.migration ? { [M0572]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0572 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0572 con un cambio que tiene que aparecer exactamente `veces` veces. */
function mutant(from: string, to: string, veces = 1): string {
  expect(FILE_0572.split(from), `apariciones de: ${from.slice(0, 90)}`).toHaveLength(veces + 1);
  return FILE_0572.split(from).join(to);
}

describe("0572 · búsqueda y fusión manual de clientes (contrato en PGlite)", () => {
  it("verde: el contrato pasa entero con la 0572 real", async () => {
    const { error, green } = await contract();
    expect(error).toBeNull();
    expect(green).toMatch(/^TEST 0572 GREEN: \d+ aserciones$/);
    if (ASERCIONES) expect(green).toBe(`TEST 0572 GREEN: ${ASERCIONES} aserciones`);
  }, SLOW);

  it("rojo: sin la 0572 no hay búsqueda", async () => {
    const { error } = await contract({ applyFix: false });
    expect(error).toMatch(/client_search_for_merge/);
  }, SLOW);

  const MUTANTES: [nombre: string, from: string, to: string, muere: string, veces?: number][] = [
    ["la fusión no pide escribir el Shipping Mark",
      "is distinct from pg_catalog.upper(m.markbox) then", "is distinct from pg_catalog.upper(m.markbox) and false then",
      "escribir el Shipping Mark de la ficha que SE QUEDA debía rechazarse"],
    ["la fusión no fija el motivo humano",
      "perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);", "",
      "durante la fusión, dtd.audit_reason debía llevar el motivo humano"],
    ["la fusión deja el ajuste cambiado",
      "perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);", "",
      "el ajuste dtd.audit_reason debía quedar como estaba"],
    ["la búsqueda sin el tenant de la sesión",
      "       where c.tenant_id = v_tenant\n         and c.deleted_at is null",
      "       where c.deleted_at is null",
      "otro tenant no debía aparecer"],
    ["la búsqueda ofrece aliados",
      "         and c.aliado_id is null\n    ) f", "    ) f",
      "un cliente de aliado no debía aparecer"],
    ["los comodines valen como patrón",
      "pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(\n              v_q, '\\', '\\\\'), '%', '\\%'), '_', '\\_')", "v_q",
      "los comodines del usuario son texto"],
    ["la vista previa calla que nadie queda con acceso",
      "'portalLost', v_s_fila and (not v_s_activo) and v_m_activo,", "'portalLost', false,",
      "debía avisar que NADIE queda con acceso"],
    ["portalMoved mira si el acceso está activo y no si hay fila (se enciende junto con portalLost)",
      "'portalMoved', (not v_s_fila) and v_m_activo,", "'portalMoved', (not v_s_activo) and v_m_activo,",
      "debía avisar que NADIE queda con acceso"],
    ["dos fichas sin nada en común pasan sin aviso",
      "'nothingInCommon', not (v_mismo_nombre or v_mismo_doc or v_mismo_correo or v_mismo_tel)", "'nothingInCommon', false",
      "dos fichas sin nada en común (los esposos) debían avisarse"],
    ["contabilidad y soporte también fusionan",
      "perform public.assert_studio_role(array['admin', 'operations', 'commercial']);",
      "perform public.assert_studio_role(array['admin', 'operations', 'commercial', 'accounting', 'support']);",
      "accounting debía poder buscar pero no fusionar"],
    ["comercial se queda sin fusionar",
      "perform public.assert_studio_role(array['admin', 'operations', 'commercial']);",
      "perform public.assert_studio_role(array['admin', 'operations']);",
      "comercial debía poder fusionar"],
    ["operaciones se queda sin fusionar",
      "perform public.assert_studio_role(array['admin', 'operations', 'commercial']);",
      "perform public.assert_studio_role(array['admin', 'commercial']);",
      "operaciones debía poder fusionar"],
    ["una invitación sin usar cuenta como acceso",
      "where u.client_id = c.id and u.status = 'active'),",
      "where u.client_id = c.id and u.status <> 'revoked'),",
      "una invitación sin usar no es «con acceso»"],
    ["la búsqueda solo mira el código vigente (olvida renombrados y fusionados)",
      "from pg_catalog.unnest(public.client_codigos_familia(c.id, v_tenant)) as cod",
      "from pg_catalog.unnest(array[c.markbox]) as cod",
      "un código ANTERIOR debía llevar a la ficha vigente"],
    ["la fusión manual deja pasar un aliado",
      "if s.aliado_id is not null or m.aliado_id is not null\n     or exists (select 1 from public.aliados a\n                 where a.client_id in (s.id, m.id) and a.deleted_at is null) then\n    raise exception 'Un aliado o un cliente de aliado no se puede fusionar' using errcode = '23514';",
      "if false then\n    raise exception 'x';",
      "fusionar contra un aliado debía rechazarse", 1],
  ];

  it.each(MUTANTES)("mutante: %s", async (_nombre, from, to, muere, veces = 1) => {
    const { error } = await contract({ migration: mutant(from, to, veces) });
    expect(error).toContain(muere);
  }, SLOW);
});
