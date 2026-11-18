// @vitest-environment node
/**
 * SDD-0633 · La 0542 corrida de verdad sobre PostgreSQL embebido (PGlite).
 *
 * - Contrato `supabase/tests/0542_*.test.sql` con el `.sql` REAL inlineado.
 * - CONTROL ROJO: sin la migración, el contrato cae en «(a)».
 * - MUTANTES: cada uno rompe UNA pieza de la 0542 (el grant, el revoke, el
 *   postflight o el preflight) y el contrato tiene que caer con el mensaje que
 *   la nombra.
 * - BARRIDO: ninguna migración posterior a la 0542 vuelve a revocar el EXECUTE
 *   de authenticated. Así se perdió la primera vez (0211:27).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const M0542 = "0542_is_platform_admin_execute_authenticated.sql";
const FILE_0542 = readFileSync(resolve(MIGRATIONS, M0542), "utf8").replace(/\r\n/g, "\n");
const C0542 = resolve(ROOT, "supabase/tests/0542_is_platform_admin_execute_authenticated.test.sql");
const SLOW = 120_000;

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

/** Corre el contrato; `fixture` muta el texto del contrato (no la migración). */
async function contract(
  replace: Record<string, string> = {},
  fixture: (sql: string) => string = (sql) => sql,
) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(fixture(inline(C0542, replace)));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((t) => t.startsWith("TEST 0542"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const GRANT = "grant execute on function public.is_platform_admin() to authenticated, service_role;";
const REVOKE = "revoke execute on function public.is_platform_admin() from public, anon;";
const POSTFLIGHT = FILE_0542.slice(FILE_0542.indexOf("do $postflight$"));
const sinPostflight = (sql: string) => once(sql, POSTFLIGHT, "");
const conMigracion = (sql: string) => ({ [M0542]: sql });

describe("SDD-0633 · la 0542 en PGlite", () => {
  it("el contrato pasa con la 0542 real (14 aserciones)", async () => {
    const r = await contract();
    expect(r.error).toBeNull();
    expect(r.green).toBe("TEST 0542: 14 aserciones OK");
  }, SLOW);

  it("CONTROL ROJO: sin la 0542, cae en (a)", async () => {
    const r = await contract(conMigracion(""));
    expect(r.error).toMatch(/TEST 0542: \(a\)/);
  }, SLOW);

  it("MUTANTE sin el grant a authenticated: cae el postflight", async () => {
    const r = await contract(conMigracion(once(FILE_0542, GRANT,
      "grant execute on function public.is_platform_admin() to service_role;")));
    expect(r.error).toMatch(/0542: authenticated sigue sin EXECUTE/);
  }, SLOW);

  it("MUTANTE sin el grant y sin el postflight: cae el contrato en (a)", async () => {
    const r = await contract(conMigracion(sinPostflight(once(FILE_0542, GRANT,
      "grant execute on function public.is_platform_admin() to service_role;"))));
    expect(r.error).toMatch(/TEST 0542: \(a\)/);
  }, SLOW);

  it("MUTANTE que también se lo da a anon: cae el postflight, y sin él cae (d)", async () => {
    const mut = once(FILE_0542, GRANT,
      "grant execute on function public.is_platform_admin() to authenticated, service_role, anon;");
    expect((await contract(conMigracion(mut))).error).toMatch(/0542: anon puede ejecutar/);
    expect((await contract(conMigracion(sinPostflight(mut)))).error).toMatch(/TEST 0542: \(d\) anon/);
  }, SLOW);

  it("MUTANTE sin el revoke explícito, con PUBLIC por defecto: cae el postflight", async () => {
    // El fixture deja el ACL por defecto de una función recién creada (PUBLIC=X):
    // solo el revoke de la 0542 lo cierra. Con PUBLIC=X, authenticated ya la
    // ejecuta antes de la 0542, así que el bloque (0) no aplica y se quita.
    const fixture = (sql: string) => {
      const acl = once(sql, "revoke all on function public.is_platform_admin() from public, anon, authenticated;",
        "revoke all on function public.is_platform_admin() from authenticated;");
      const desde = acl.indexOf("-- (0) Antes de la 0542");
      // Ya inlineado: el `\ir` es el texto de la 0542, que empieza por su cabecera.
      const hasta = acl.indexOf("-- 0542 · SDD-0633", desde);
      expect(desde).toBeGreaterThan(0);
      expect(hasta).toBeGreaterThan(desde);
      return acl.slice(0, desde) + acl.slice(hasta);
    };
    expect((await contract({}, fixture)).green).toBe("TEST 0542: 12 aserciones OK");
    const r = await contract(conMigracion(once(FILE_0542, REVOKE, "")), fixture);
    expect(r.error).toMatch(/0542: (anon puede ejecutar|PUBLIC tiene EXECUTE)/);
  }, SLOW);

  it("PREFLIGHT: aborta si la función viva no es SECURITY DEFINER", async () => {
    const r = await contract({}, (sql) => once(sql, "  language sql\n  security definer\n  stable\n  set search_path = public\nas $$\n  select exists (",
      "  language sql\n  security invoker\n  stable\n  set search_path = public\nas $$\n  select exists ("));
    expect(r.error).toMatch(/0542: is_platform_admin\(\) no es SECURITY DEFINER/);
  }, SLOW);

  it("PREFLIGHT: aborta si el cuerpo vivo no es el de la 0058", async () => {
    const r = await contract({}, (sql) => once(sql,
      "    select 1 from public.platform_admins where user_id = (select auth.uid())\n  );",
      "    select 1 from public.platform_admins\n  );"));
    expect(r.error).toMatch(/0542: el cuerpo vivo de is_platform_admin\(\) no es el de la 0058/);
  }, SLOW);

  it("PREFLIGHT: aborta sin search_path fijo", async () => {
    const r = await contract({}, (sql) => once(sql,
      "  stable\n  set search_path = public\nas $$\n  select exists (",
      "  stable\nas $$\n  select exists ("));
    expect(r.error).toMatch(/0542: is_platform_admin\(\) no tiene un search_path fijo/);
  }, SLOW);
});

describe("SDD-0633 · la deriva no se repite", () => {
  const numero = (f: string) => Number.parseInt(f.slice(0, 4), 10);
  const posteriores = readdirSync(MIGRATIONS)
    .filter((f) => /^\d{4}[a-z]?_.*\.sql$/.test(f) && numero(f) > 542);
  // Una sentencia (sin cruzar «;»), sin comentarios de línea: la cabecera de la
  // 0542 cita el revoke de su vuelta atrás y no cuenta.
  const REVOCA = /revoke\s+(execute|all)[^;]*?on\s+function\s+public\.is_platform_admin\s*\(\s*\)[^;]*?\bfrom\b[^;]*\bauthenticated\b/i;
  const TODAS = /revoke\s+(execute|all)[^;]*?on\s+all\s+functions\s+in\s+schema\s+public[^;]*?\bfrom\b[^;]*\bauthenticated\b/i;
  const sinComentarios = (sql: string) => sql.replace(/--[^\n]*/g, "");
  const revoca = (sql: string) => REVOCA.test(sinComentarios(sql)) || TODAS.test(sinComentarios(sql));

  it("el detector ve el revoke de la 0211 y no ve la 0542", () => {
    const m0211 = readFileSync(resolve(MIGRATIONS, "0211_revoke_authenticated_rpc_sweep.sql"), "utf8");
    expect(revoca(m0211)).toBe(true);
    expect(revoca(FILE_0542)).toBe(false);
    expect(revoca("revoke execute on all functions in schema public from anon, authenticated;")).toBe(true);
    expect(revoca("revoke all on function public.is_platform_admin() from public, authenticated;")).toBe(true);
    expect(revoca("-- revoke execute on function public.is_platform_admin() from authenticated;")).toBe(false);
  });

  it("ninguna migración posterior a la 0542 le quita el EXECUTE a authenticated", () => {
    const culpables = posteriores.filter((f) => revoca(readFileSync(resolve(MIGRATIONS, f), "utf8")));
    expect(culpables, "si es a propósito, cambia lib/studio/platform-admin.ts y esta prueba en la misma PR").toEqual([]);
  });
});
