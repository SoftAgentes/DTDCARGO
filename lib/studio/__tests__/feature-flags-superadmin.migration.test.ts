// @vitest-environment node
/**
 * SDD-0634 · La 0543 corrida de verdad sobre PostgreSQL embebido (PGlite).
 *
 * - Contrato `supabase/tests/0543_*.test.sql` con el `.sql` REAL inlineado.
 * - ANTI-DRIFT: la guarda y la rama `feature_flag.toggle` que el contrato copia
 *   como doble de `audit_d1_execute` siguen siendo las de la 0289.
 * - CONTROL ROJO: sin la migración, el contrato cae en «(a)».
 * - MUTANTES: cada uno rompe UNA pieza de la 0543 y el contrato cae con el
 *   mensaje que la nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const M0543 = "0543_feature_flags_exige_superadmin.sql";
const FILE_0543 = read(resolve(ROOT, "supabase/migrations", M0543));
const FILE_0289 = read(resolve(ROOT, "supabase/migrations/0289_audit_d1_access_configuration.sql"));
const C0543 = resolve(ROOT, "supabase/tests/0543_feature_flags_exige_superadmin.test.sql");
const CONTRATO = read(C0543);
const SLOW = 120_000;
const VERDE = "TEST 0543: 25 aserciones OK";

/** psql → SQL plano: quita \set e inlinea \ir. `replace` sustituye un archivo por el final de su ruta. */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key !== undefined ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    for (const line of source(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) out.push(line);
      else if (meta[1] === "ir") run(resolve(dirname(path), meta[2].trim()));
      else if (meta[1] !== "set") throw new Error("metaorden psql no soportada: \\" + meta[1]);
    }
  }
  run(file);
  return out.join("\n");
}

async function contract(
  replace: Record<string, string> = {},
  fixture: (sql: string) => string = (sql) => sql,
) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(fixture(inline(C0543, replace)));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((t) => t.startsWith("TEST 0543"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}
const mig = (sql: string) => ({ [M0543]: sql });
const POSTFLIGHT = FILE_0543.slice(FILE_0543.indexOf("do $postflight$"));
const sinPostflight = (sql: string) => once(sql, POSTFLIGHT, "");
const TRIGGER = "create trigger feature_flags_exige_superadmin\n  before update on public.feature_flags\n  for each row execute function public.feature_flags_exige_superadmin();";

describe("SDD-0634 · el doble del contrato sigue siendo la 0289", () => {
  /** Bloque entre dos marcas, sin la sangría común. */
  const bloque = (text: string, desde: string, hasta: string) => {
    const i = text.indexOf(desde);
    const j = text.indexOf(hasta, i + desde.length);
    expect(i, desde).toBeGreaterThanOrEqual(0);
    expect(j, hasta).toBeGreaterThan(i);
    return text.slice(i, j + hasta.length);
  };

  it("la guarda audit_d1_admin_tenant es copia literal", () => {
    const desde = "create function public.audit_d1_admin_tenant()";
    const hasta = "$function$;";
    expect(bloque(CONTRATO, desde, hasta)).toBe(bloque(FILE_0289, desde, hasta));
  });

  it("la rama feature_flag.toggle es copia literal (y sigue sin is_platform_admin)", () => {
    const desde = "    when 'feature_flag.toggle' then";
    const hasta = "      where id = v_entity_id;";
    const rama = bloque(FILE_0289, desde, hasta);
    expect(bloque(CONTRATO, desde, hasta)).toBe(rama);
    expect(rama).not.toMatch(/is_platform_admin/);
  });

  it("la firma y el ACL del doble son los de la 0289", () => {
    expect(FILE_0289).toContain(
      "grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text)\n  to authenticated;",
    );
    expect(CONTRATO).toContain("grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to authenticated;");
  });
});

describe("SDD-0634 · la 0543 en PGlite", () => {
  /** Mete `extra` justo antes de la 0543 inlineada (después del bloque (0), que necesita el fixture sano). */
  const antesDeLa0543 = (extra: string) => (sql: string) => {
    const i = sql.indexOf("-- 0543 · SDD-0634 · encender");
    expect(i).toBeGreaterThan(sql.indexOf("(0) antes de la 0543, el admin enciende"));
    return sql.slice(0, i) + extra + "\n" + sql.slice(i);
  };
  const PASA = "  if v_rol = 'service_role' or (v_rol is null and v_sub is null) then";
  const NIEGA = "  if v_rol = 'anon' or not public.is_platform_admin() then";
  const ALWAYS = "alter table public.feature_flags enable always trigger feature_flags_exige_superadmin;";

  it(`el contrato pasa con la 0543 real (${VERDE})`, async () => {
    const r = await contract();
    expect(r.error).toBeNull();
    expect(r.green).toBe(VERDE);
  }, SLOW);

  it("CONTROL ROJO: sin la 0543, cae en (a)", async () => {
    expect((await contract(mig(""))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  // ── Condición 2 del DG: mutantes (a) a (e) ────────────────────────────
  it("MUTANTE (a) disparador apagado: cae el postflight, y sin él cae (a)", async () => {
    const mut = once(FILE_0543, ALWAYS,
      ALWAYS + "\nalter table public.feature_flags disable trigger feature_flags_exige_superadmin;");
    expect((await contract(mig(mut))).error).toMatch(/0543: el disparador feature_flags_exige_superadmin no quedó ENABLE ALWAYS/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE (b) sin el disparador: cae el postflight, y sin él cae (a)", async () => {
    const mut = once(once(FILE_0543, TRIGGER, ""), ALWAYS, "");
    expect((await contract(mig(mut))).error).toMatch(/0543: no quedó el disparador/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE (b) condición invertida: cae (a)", async () => {
    const mut = once(FILE_0543, NIEGA, "  if v_rol = 'anon' or public.is_platform_admin() then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE (c) sin la regla de anon: cae «anon, aunque traiga el sub del superadmin»", async () => {
    const mut = once(FILE_0543, NIEGA, "  if not public.is_platform_admin() then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(c\) anon, aunque traiga/);
  }, SLOW);

  it("MUTANTE (c) detectar la sesión con auth.uid() is null: cae «anon sin sub»", async () => {
    const mut = once(FILE_0543, PASA, "  if (select auth.uid()) is null then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(c\) anon sin sub/);
  }, SLOW);

  it("MUTANTE (d) que frena también sin claims: cae «sin claims»", async () => {
    const mut = once(FILE_0543, PASA, "  if v_rol = 'service_role' then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(d\) sin claims/);
  }, SLOW);

  it("MUTANTE (d) que frena también a service_role: cae (d)", async () => {
    const mut = once(FILE_0543, PASA, "  if v_rol is null and v_sub is null then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(d\) service_role \(claims JSON\)/);
  }, SLOW);

  // ── Condición 4: ENABLE ALWAYS ───────────────────────────────────────
  it("MUTANTE sin ENABLE ALWAYS: cae el postflight, y sin él cae (f) en modo réplica", async () => {
    const mut = once(FILE_0543, ALWAYS, "");
    expect((await contract(mig(mut))).error).toMatch(/0543: el disparador feature_flags_exige_superadmin no quedó ENABLE ALWAYS/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(f\)/);
  }, SLOW);

  // ── Condición 5: postflight ──────────────────────────────────────────
  it("MUTANTE AFTER en vez de BEFORE: cae el postflight", async () => {
    const mut = once(FILE_0543, "  before update on public.feature_flags", "  after update on public.feature_flags");
    expect((await contract(mig(mut))).error).toMatch(/0543: no quedó el disparador BEFORE UPDATE/);
  }, SLOW);

  it("MUTANTE sin search_path vacío: cae el postflight", async () => {
    const mut = once(FILE_0543, "security definer\nset search_path = ''\nas $function$\ndeclare\n  v_claims",
      "security definer\nset search_path = public\nas $function$\ndeclare\n  v_claims");
    expect((await contract(mig(mut))).error).toMatch(/0543: feature_flags_exige_superadmin\(\) no quedó DEFINER de postgres con search_path vacío/);
  }, SLOW);

  it("MUTANTE que concede la función: cae el postflight, y sin él cae (g)", async () => {
    const mut = once(FILE_0543,
      "revoke all on function public.feature_flags_exige_superadmin() from public, anon, authenticated, service_role;",
      "grant execute on function public.feature_flags_exige_superadmin() to authenticated;");
    expect((await contract(mig(mut))).error).toMatch(/0543: (authenticated|anon) puede ejecutar|0543: PUBLIC tiene EXECUTE/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(g\)/);
  }, SLOW);

  it("MUTANTE que toca el ACL de audit_d1_execute: cae el postflight", async () => {
    // Con «\n» delante: la cabecera cita el mismo drop en su vuelta atrás.
    const mut = once(FILE_0543,
      "\ndrop trigger if exists feature_flags_exige_superadmin on public.feature_flags;",
      "\ndrop trigger if exists feature_flags_exige_superadmin on public.feature_flags;\n" +
        "grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to service_role;");
    expect((await contract(mig(mut))).error).toMatch(/0543: cambió el ACL de audit_d1_execute/);
  }, SLOW);

  // ── Preflight (incluida la condición 3: INSERT y DELETE) ─────────────
  it("PREFLIGHT: aborta si falta la 0542 (authenticated sin EXECUTE de is_platform_admin)", async () => {
    const r = await contract({}, antesDeLa0543(
      "revoke execute on function public.is_platform_admin() from authenticated;"));
    expect(r.error).toMatch(/0543 requiere la 0542/);
  }, SLOW);

  it("PREFLIGHT: aborta si audit_d1_execute no es DEFINER", async () => {
    const r = await contract({}, antesDeLa0543(
      "alter function public.audit_d1_execute(uuid,text,uuid,jsonb,text) security invoker;"));
    expect(r.error).toMatch(/0543 requiere public.audit_d1_execute DEFINER/);
  }, SLOW);

  it("PREFLIGHT: aborta si authenticated puede insertar o borrar flags (el disparador solo cubre UPDATE)", async () => {
    for (const priv of ["insert", "delete"]) {
      const r = await contract({}, antesDeLa0543(`grant ${priv} on public.feature_flags to authenticated;`));
      expect(r.error, priv).toMatch(/0543: authenticated puede insertar, borrar o vaciar feature_flags/);
    }
  }, SLOW);
});
