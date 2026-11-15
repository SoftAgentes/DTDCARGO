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
const VERDE = "TEST 0543: 13 aserciones OK";

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
  it(`el contrato pasa con la 0543 real (${VERDE})`, async () => {
    const r = await contract();
    expect(r.error).toBeNull();
    expect(r.green).toBe(VERDE);
  }, SLOW);

  it("CONTROL ROJO: sin la 0543, cae en (a)", async () => {
    expect((await contract(mig(""))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE sin el disparador: cae el postflight, y sin él cae (a)", async () => {
    const mut = once(FILE_0543, TRIGGER, "");
    expect((await contract(mig(mut))).error).toMatch(/0543: no quedó el disparador/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE sin exigir is_platform_admin(): cae (a)", async () => {
    const mut = once(FILE_0543, "     and not public.is_platform_admin() then", "     and false then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(a\)/);
  }, SLOW);

  it("MUTANTE que también frena sin sesión: cae (d)", async () => {
    const mut = once(FILE_0543, "  if (select auth.uid()) is not null\n     and not", "  if true\n     and not");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0543: \(d\)/);
  }, SLOW);

  it("MUTANTE AFTER en vez de BEFORE: cae el postflight", async () => {
    const mut = once(FILE_0543, "  before update on public.feature_flags", "  after update on public.feature_flags");
    expect((await contract(mig(mut))).error).toMatch(/0543: no quedó el disparador BEFORE UPDATE/);
  }, SLOW);

  it("MUTANTE que concede la función a authenticated: cae el postflight, y sin él cae (e)", async () => {
    const mut = once(FILE_0543,
      "revoke all on function public.feature_flags_exige_superadmin() from public, anon, authenticated, service_role;",
      "grant execute on function public.feature_flags_exige_superadmin() to authenticated;");
    expect((await contract(mig(mut))).error).toMatch(/0543: (authenticated|anon) puede ejecutar|0543: PUBLIC tiene EXECUTE/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0543: \(e\)/);
  }, SLOW);

  it("MUTANTE que toca el ACL de audit_d1_execute: cae el postflight", async () => {
    // Con «\n» delante: la cabecera cita el mismo drop en su vuelta atrás.
    const mut = once(FILE_0543,
      "\ndrop trigger if exists feature_flags_exige_superadmin on public.feature_flags;",
      "\ndrop trigger if exists feature_flags_exige_superadmin on public.feature_flags;\n" +
        "grant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to service_role;");
    expect((await contract(mig(mut))).error).toMatch(/0543: cambió el ACL de audit_d1_execute/);
  }, SLOW);

  it("PREFLIGHT: aborta si falta la 0542 (authenticated sin EXECUTE de is_platform_admin)", async () => {
    const r = await contract({}, (sql) => once(sql,
      "grant execute on function public.is_platform_admin() to authenticated, service_role;",
      "grant execute on function public.is_platform_admin() to service_role;"));
    expect(r.error).toMatch(/0543 requiere la 0542/);
  }, SLOW);

  it("PREFLIGHT: aborta si audit_d1_execute no es DEFINER", async () => {
    const r = await contract({}, (sql) => once(sql,
      "returns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = ''\nas $function$\ndeclare\n  v_tenant_id uuid := public.audit_d1_admin_tenant();",
      "returns jsonb\nlanguage plpgsql\nsecurity invoker\nset search_path = ''\nas $function$\ndeclare\n  v_tenant_id uuid := public.audit_d1_admin_tenant();"));
    expect(r.error).toMatch(/0543 requiere public.audit_d1_execute DEFINER/);
  }, SLOW);
});
