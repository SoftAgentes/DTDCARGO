// @vitest-environment node
/**
 * SDD-0636 · La 0545 corrida de verdad sobre PostgreSQL embebido (PGlite).
 *
 * - Contrato `supabase/tests/0545_*.test.sql` con el `.sql` REAL inlineado, y su
 *   desarme.
 * - ANTI-DRIFT: las funciones que el contrato copia siguen siendo la última
 *   definición en las migraciones, y la copia es literal.
 * - CONTROL ROJO: sin la migración, el contrato cae en «(a)».
 * - MUTANTES: cada uno rompe UNA pieza de la 0545 y el contrato cae con el
 *   mensaje que la nombra.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGS = resolve(ROOT, "supabase/migrations");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const M0545 = "0545_solo_superadmin_crea_admin.sql";
const FILE_0545 = read(resolve(MIGS, M0545));
const C0545 = resolve(ROOT, "supabase/tests/0545_solo_superadmin_crea_admin.test.sql");
const CONTRATO = read(C0545);
const SLOW = 120_000;
const VERDE = "TEST 0545: 49 aserciones OK";

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
    const results = await db.exec(fixture(inline(C0545, replace)));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((t) => t.startsWith("TEST 0545"));
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
const mig = (sql: string) => ({ [M0545]: sql });
const POSTFLIGHT = FILE_0545.slice(FILE_0545.indexOf("do $postflight$"));
const sinPostflight = (sql: string) => once(sql, POSTFLIGHT, "");

/** Reemplaza `from` solo dentro del cuerpo de una de las funciones nuevas. */
function enFuncion(nombre: string, from: string, to: string): string {
  const inicio = `create or replace function public.${nombre}()`;
  const i = FILE_0545.indexOf(inicio);
  const j = FILE_0545.indexOf("$function$;", i);
  expect(i, inicio).toBeGreaterThanOrEqual(0);
  return FILE_0545.slice(0, i) + once(FILE_0545.slice(i, j), from, to) + FILE_0545.slice(j);
}
const INV = "user_invitations_exige_superadmin";
const UT = "user_tenants_exige_superadmin";
const PASA = "  if v_rol = 'service_role' or (v_rol is null and v_sub is null) then";
const ALWAYS_INV = "alter table public.user_invitations enable always trigger user_invitations_exige_superadmin;";
const ALWAYS_UT = "alter table public.user_tenants enable always trigger user_tenants_exige_superadmin;";
const TRIGGER_INV =
  "create trigger user_invitations_exige_superadmin\n  before insert or update of role on public.user_invitations\n  for each row execute function public.user_invitations_exige_superadmin();";
const TRIGGER_UT =
  "create trigger user_tenants_exige_superadmin\n  before insert or update on public.user_tenants\n  for each row execute function public.user_tenants_exige_superadmin();";
const TRIGGER_ALTA =
  "create trigger user_tenants_audit_alta\n  after insert on public.user_tenants\n  for each row execute function public.audit_user_tenants_alta();";
const REVOKE_SIU =
  "revoke execute on function public.studio_invite_user(text, text, text) from public, anon, authenticated;";

describe("SDD-0636 · las copias del contrato siguen siendo la última definición", () => {
  /** Migraciones de historial de replay: guardan definiciones viejas como texto, no las ejecutan. */
  const LEDGER = new Set(["0271", "0280", "0287", "0288"]);
  const archivos = readdirSync(MIGS).filter((f) => f.endsWith(".sql")).sort();

  /** El último archivo (sin los de historial) que crea o reemplaza esa función. */
  const ultima = (crea: RegExp) =>
    archivos.filter((f) => !LEDGER.has(f.slice(0, 4)) && crea.test(read(resolve(MIGS, f)))).at(-1);

  /** Bloque entre dos marcas, inclusive. */
  const bloque = (text: string, desde: string, hasta: string) => {
    const i = text.indexOf(desde);
    const j = text.indexOf(hasta, i + desde.length);
    expect(i, desde).toBeGreaterThanOrEqual(0);
    expect(j, hasta).toBeGreaterThan(i);
    return text.slice(i, j + hasta.length);
  };

  const COPIAS: Array<[string, string, string, RegExp]> = [
    ["0202_warehouse_scope.sql", "create or replace function public.audit_user_tenants_changes()", "$$;",
      /create (or replace )?function public\.audit_user_tenants_changes\(/],
    ["0203_fix_studio_invite_user_region.sql", "create or replace function public.studio_invite_user(", "$$;",
      /create (or replace )?function public\.studio_invite_user\(/],
    ["0352_invitacion_nominal.sql", "create or replace function public.studio_accept_invitation(", "$$;",
      /create (or replace )?function public\.studio_accept_invitation\(/],
    ["0355_superadmin_llaves_del_sistema.sql", "create or replace function public.studio_set_user_disabled(", "$function$;",
      /create (or replace )?function public\.studio_set_user_disabled\(/],
    ["0355_superadmin_llaves_del_sistema.sql", "create or replace function public.studio_change_user_role(", "$function$;",
      /create (or replace )?function public\.studio_change_user_role\(/],
    ["0289_audit_d1_access_configuration.sql", "create function public.audit_d1_admin_tenant()", "$function$;",
      /create (or replace )?function public\.audit_d1_admin_tenant\(/],
  ];

  for (const [file, desde, hasta, crea] of COPIAS) {
    it(`${desde.replace(/^create (or replace )?function public\./, "")} es copia literal de la ${file.slice(0, 4)}, su última definición`, () => {
      expect(ultima(crea)).toBe(file);
      expect(bloque(CONTRATO, desde, hasta)).toBe(bloque(read(resolve(MIGS, file)), desde, hasta));
    });
  }

  it("las ramas membership.invite y membership.role_change son copia literal de la 0289", () => {
    const FILE_0289 = read(resolve(MIGS, "0289_audit_d1_access_configuration.sql"));
    const desde = "    when 'membership.invite' then";
    const hasta = "      v_result := pg_catalog.jsonb_build_object('entity_id', p_target_id);";
    expect(ultima(/create (or replace )?function public\.audit_d1_execute\(/)).toBe("0289_audit_d1_access_configuration.sql");
    expect(bloque(CONTRATO, desde, hasta)).toBe(bloque(FILE_0289, desde, hasta));
  });

  it("el mensaje del raise de la 0545 es el que busca la server action", () => {
    const ACTION = read(resolve(ROOT, "app/studio/(app)/usuarios/actions.ts"));
    const MSG = "Solo el superadministrador puede crear o reactivar administradores";
    // Uno por disparador guardián, los dos con 42501.
    expect(FILE_0545.match(new RegExp(`raise exception '${MSG}'\\s+using errcode = '42501';`, "g"))).toHaveLength(2);
    expect(ACTION).toContain(`"${MSG}"`);
  });

  it("la app ya no llama studio_invite_user directo", () => {
    const fuentes = ["lib", "app", "components"].flatMap((dir) =>
      (readdirSync(resolve(ROOT, dir), { recursive: true }) as string[])
        .filter((f) => /\.(ts|tsx)$/.test(f) && !/__tests__|\.test\./.test(f))
        .map((f) => resolve(ROOT, dir, f)),
    );
    const llamadas = fuentes.filter((f) => /rpc\(\s*["']studio_invite_user["']/.test(read(f)));
    expect(llamadas).toEqual([]);
  });
});

describe("SDD-0636 · la 0545 en PGlite", () => {
  /** Mete `extra` justo antes de la 0545 inlineada (después del bloque (0)). */
  const antesDeLa0545 = (extra: string) => (sql: string) => {
    const i = sql.indexOf("-- 0545 · SDD-0636 · política de roles");
    expect(i).toBeGreaterThan(sql.indexOf("(0) Antes de la 0545"));
    return sql.slice(0, i) + extra + "\n" + sql.slice(i);
  };

  it(`el contrato pasa con la 0545 real (${VERDE})`, async () => {
    const r = await contract();
    expect(r.error).toBeNull();
    expect(r.green).toBe(VERDE);
  }, SLOW);

  it("CONTROL ROJO: sin la 0545, cae en (a)", async () => {
    expect((await contract(mig(""))).error).toMatch(/TEST 0545: \(a\)/);
  }, SLOW);

  // ── Invitar ─────────────────────────────────────────────────────────
  it("MUTANTE sin el disparador de invitaciones: cae el postflight, y sin él cae (a)", async () => {
    const mut = once(once(FILE_0545, TRIGGER_INV, ""), ALWAYS_INV, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: no quedó el disparador BEFORE INSERT OR UPDATE OF role/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(a\) el admin que no es superadmin recibe 42501/);
  }, SLOW);

  it("MUTANTE condición invertida en invitaciones: cae (a)", async () => {
    const mut = once(FILE_0545, "  if v_rol = 'anon' or not public.is_platform_admin() then",
      "  if v_rol = 'anon' or public.is_platform_admin() then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(a\) el admin que no es superadmin recibe 42501/);
  }, SLOW);

  it("MUTANTE sin «OF role»: cae el postflight, y sin él no se acepta ni la invitación del superadmin (b)", async () => {
    const mut = once(FILE_0545, "  before insert or update of role on public.user_invitations",
      "  before insert or update on public.user_invitations");
    expect((await contract(mig(mut))).error).toMatch(/0545: no quedó el disparador BEFORE INSERT OR UPDATE OF role/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(b\) la invitación de admin de un superadmin se acepta/);
  }, SLOW);

  it("MUTANTE sin quitar el EXECUTE de studio_invite_user: cae el postflight, y sin él cae (a)", async () => {
    const mut = once(FILE_0545, REVOKE_SIU, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: authenticated o anon siguen ejecutando studio_invite_user/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(a\) authenticated ya no ejecuta studio_invite_user/);
  }, SLOW);

  // ── Membresías ──────────────────────────────────────────────────────
  it("MUTANTE sin el disparador de membresías: cae el postflight, y sin él se acepta una invitación de admin ajena (b)", async () => {
    const mut = once(once(FILE_0545, TRIGGER_UT, ""), ALWAYS_UT, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: no quedó el disparador BEFORE INSERT OR UPDATE user_tenants_exige_superadmin/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(b\) una invitación de admin que no emitió un superadmin/);
  }, SLOW);

  it("MUTANTE condición invertida en membresías: cae (b)", async () => {
    const mut = enFuncion(UT, "    if public.is_platform_admin() then", "    if not public.is_platform_admin() then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(b\) una invitación de admin que no emitió un superadmin/);
  }, SLOW);

  it("MUTANTE la excepción del invitado sin pedir que lo emita un superadmin: cae (b)", async () => {
    const mut = enFuncion(UT, "         join public.platform_admins pa on pa.user_id = ui.invited_by\n", "");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(b\) una invitación de admin que no emitió un superadmin/);
  }, SLOW);

  it("MUTANTE la excepción del invitado para cualquier sesión: cae (b)", async () => {
    const mut = enFuncion(UT, "       and v_sub = new.user_id::text\n", "");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(b\) la excepción del invitado no la usa otra sesión/);
  }, SLOW);

  it("MUTANTE la excepción del invitado también para reactivar: cae (c)", async () => {
    const mut = enFuncion(UT, "    if v_crea and not v_reactiva\n", "    if v_crea\n");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(c\) un comercial suspendido no vuelve como admin/);
  }, SLOW);

  it("MUTANTE que no mira la reactivación: cae (c)", async () => {
    const mut = enFuncion(UT,
      "  v_reactiva := tg_op = 'UPDATE' and old.disabled_at is not null and new.disabled_at is null;",
      "  v_reactiva := false;");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(c\)/);
  }, SLOW);

  it("MUTANTE sin el alta en la bitácora: cae el postflight, y sin él cae (b)", async () => {
    const mut = once(FILE_0545, TRIGGER_ALTA, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: no quedó el disparador AFTER INSERT user_tenants_audit_alta/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(b\) el alta queda en user_role_audit/);
  }, SLOW);

  // ── La sesión por los claims ────────────────────────────────────────
  it("MUTANTE sin la regla de anon en invitaciones: cae «anon, aunque traiga el sub del superadmin»", async () => {
    const mut = once(FILE_0545, "  if v_rol = 'anon' or not public.is_platform_admin() then",
      "  if not public.is_platform_admin() then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(e\) anon, aunque traiga/);
  }, SLOW);

  it("MUTANTE sin la regla de anon en membresías: cae «anon, aunque traiga el sub del superadmin»", async () => {
    const mut = enFuncion(UT, "  if v_rol is distinct from 'anon' then", "  if true then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(e\) anon, aunque traiga/);
  }, SLOW);

  it("MUTANTE detectar la sesión con auth.uid() is null: cae «anon sin sub»", async () => {
    for (const fn of [INV, UT]) {
      const mut = enFuncion(fn, PASA, "  if (select auth.uid()) is null then");
      expect((await contract(mig(mut))).error, fn).toMatch(/TEST 0545: \(e\) anon sin sub/);
    }
  }, SLOW * 2);

  it("MUTANTE que frena también sin claims: cae (e)", async () => {
    const mut = enFuncion(UT, PASA, "  if v_rol = 'service_role' then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(e\) sin claims/);
  }, SLOW);

  it("MUTANTE que frena también a service_role: cae (e)", async () => {
    const mut = enFuncion(INV, PASA, "  if v_rol is null and v_sub is null then");
    expect((await contract(mig(mut))).error).toMatch(/TEST 0545: \(e\) service_role \(claims JSON\)/);
  }, SLOW);

  // ── ENABLE ALWAYS y postflight ──────────────────────────────────────
  it("MUTANTE sin ENABLE ALWAYS en invitaciones: cae el postflight, y sin él cae (f)", async () => {
    const mut = once(FILE_0545, ALWAYS_INV, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: un disparador guardián no quedó ENABLE ALWAYS/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(f\) con session_replication_role = replica, invitar/);
  }, SLOW);

  it("MUTANTE sin ENABLE ALWAYS en membresías: cae el postflight, y sin él cae (f)", async () => {
    const mut = once(FILE_0545, ALWAYS_UT, "");
    expect((await contract(mig(mut))).error).toMatch(/0545: un disparador guardián no quedó ENABLE ALWAYS/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(f\) con session_replication_role = replica, subir/);
  }, SLOW);

  it("MUTANTE sin search_path vacío: cae el postflight", async () => {
    const mut = enFuncion(UT, "security definer\nset search_path = ''", "security definer\nset search_path = public");
    expect((await contract(mig(mut))).error).toMatch(
      // regprocedure imprime el nombre sin «public.» cuando public está en el search_path.
      /0545: (public\.)?user_tenants_exige_superadmin\(\) no quedó DEFINER de postgres con search_path vacío/,
    );
  }, SLOW);

  it("MUTANTE que concede una función nueva: cae el postflight, y sin él cae (g)", async () => {
    const mut = once(FILE_0545,
      "revoke all on function public.user_tenants_exige_superadmin() from public, anon, authenticated, service_role;",
      "grant execute on function public.user_tenants_exige_superadmin() to authenticated;");
    expect((await contract(mig(mut))).error).toMatch(/0545: (authenticated|anon) puede ejecutar|0545: PUBLIC tiene EXECUTE/);
    expect((await contract(mig(sinPostflight(mut)))).error).toMatch(/TEST 0545: \(g\)/);
  }, SLOW);

  it("MUTANTE que toca el ACL de audit_d1_execute: cae el postflight", async () => {
    const mut = once(FILE_0545, REVOKE_SIU,
      REVOKE_SIU + "\ngrant execute on function public.audit_d1_execute(uuid,text,uuid,jsonb,text) to service_role;");
    expect((await contract(mig(mut))).error).toMatch(/0545: cambió el ACL de audit_d1_execute/);
  }, SLOW);

  // ── Preflight ───────────────────────────────────────────────────────
  it("PREFLIGHT: aborta si falta la 0542 (authenticated sin EXECUTE de is_platform_admin)", async () => {
    const r = await contract({}, antesDeLa0545("revoke execute on function public.is_platform_admin() from authenticated;"));
    expect(r.error).toMatch(/0545 requiere la 0542/);
  }, SLOW);

  it("PREFLIGHT: aborta si studio_invite_user no es DEFINER de postgres", async () => {
    const r = await contract({}, antesDeLa0545(
      "alter function public.studio_invite_user(text,text,text) security invoker;"));
    expect(r.error).toMatch(/0545 requiere public\.studio_invite_user\(text,text,text\) \(0203\) DEFINER de postgres/);
  }, SLOW);

  it("PREFLIGHT: aborta si anon ejecuta studio_accept_invitation", async () => {
    const r = await contract({}, antesDeLa0545(
      "grant execute on function public.studio_accept_invitation(text,text,text) to anon;"));
    expect(r.error).toMatch(/0545: anon puede ejecutar public\.studio_accept_invitation/);
  }, SLOW);
});
