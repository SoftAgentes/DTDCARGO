// @vitest-environment node
/**
 * SDD-0622 · Las migraciones 0526 y 0527 corridas de verdad sobre PostgreSQL
 * embebido, más el anti-drift entre la copia SQL de la matriz y `rbac.ts`.
 *
 * - Contratos `supabase/tests/0526_*.test.sql` y `0527_*.test.sql` con los `.sql`
 *   REALES inlineados (lo que se prueba es el texto que se aplicará).
 * - CONTROL ROJO: sin la migración, el contrato cae.
 * - MUTANTES: cada uno rompe UN candado y el contrato tiene que caer con la
 *   aserción que lo nombra.
 * - PARIDAD (§7.8): para cada rol, módulo y combinación de extras, el mismo
 *   (rol, desvío, extra, scope) da el mismo resultado en `canAccessModule` /
 *   `canEditModule` (+ `scopeAllowsModule`) y en `user_has_module`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import {
  LOCKED_MODULES,
  ROLE_MODULE_ACCESS,
  SENSITIVE_MODULE_EFFECTS,
  SUPERADMIN_ONLY_MODULES,
  canAccessModule,
  canEditModule,
  scopeAllowsModule,
  type RoleModuleOverrides,
  type UserModuleGrants,
} from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const M0526 = "0526_studio_user_module_grants.sql";
const M0527 = "0527_comercial_acepta_accesos_por_persona.sql";
const FILE_0526 = read(resolve(ROOT, "supabase/migrations", M0526));
const FILE_0527 = read(resolve(ROOT, "supabase/migrations", M0527));
const C0526 = resolve(ROOT, "supabase/tests/0526_studio_user_module_grants.test.sql");
const C0527 = resolve(ROOT, "supabase/tests/0527_comercial_acepta_accesos_por_persona.test.sql");
const SLOW = 180_000;

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

async function contract(file: string, tag: string, replace: Record<string, string> = {}) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(file, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith(tag));
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

// ─── Anti-drift: la copia SQL de la matriz = rbac.ts ─────────────────────
describe("SDD-0622 · la 0526 copia exacta de rbac.ts", () => {
  it("studio_module_default_roles = ROLE_MODULE_ACCESS (mismos módulos, mismos roles)", () => {
    const body = FILE_0526.slice(
      FILE_0526.indexOf("create function public.studio_module_default_roles"),
      FILE_0526.indexOf("comment on function public.studio_module_default_roles"),
    );
    const sql: Record<string, string[]> = {};
    for (const m of body.matchAll(/\('([a-z-]+)', array\[([^\]]*)\]::text\[\]\)/g)) {
      sql[m[1]] = m[2] ? m[2].split(",").map((r) => r.trim().replace(/'/g, "")) : [];
    }
    const code = Object.fromEntries(
      Object.entries(ROLE_MODULE_ACCESS).map(([id, roles]) => [id, [...roles]]),
    );
    expect(Object.keys(sql).length).toBeGreaterThanOrEqual(50);
    expect(sql).toEqual(code);
  });

  it("los sensibles de la 0526 = LOCKED_MODULES, en la función y en el CHECK", () => {
    const locked = [...LOCKED_MODULES].sort();
    const fn = FILE_0526.slice(
      FILE_0526.indexOf("create function public.studio_module_is_sensitive"),
      FILE_0526.indexOf("comment on function public.studio_module_is_sensitive"),
    );
    const check = FILE_0526.slice(
      FILE_0526.indexOf("constraint studio_user_module_grants_sensitive_confirmed"),
      FILE_0526.indexOf("constraint studio_user_module_grants_keystone_read_only"),
    );
    const ids = (s: string) => [...s.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(ids(fn)).toEqual(locked);
    expect(ids(check)).toEqual(locked);
  });

  it("los del superadministrador de la 0526 = SUPERADMIN_ONLY_MODULES", () => {
    const fn = FILE_0526.slice(
      FILE_0526.indexOf("create function public.studio_module_is_superadmin_only"),
      FILE_0526.indexOf("comment on function public.studio_module_is_superadmin_only"),
    );
    const ids = [...fn.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(ids).toEqual([...SUPERADMIN_ONLY_MODULES].sort());
  });

  it("cada módulo sensible tiene su lista de efectos para el doble aviso", () => {
    for (const id of LOCKED_MODULES) {
      expect(SENSITIVE_MODULE_EFFECTS[id]?.length ?? 0, id).toBeGreaterThan(0);
    }
  });
});

// ─── Contratos ───────────────────────────────────────────────────────────
const MUTANTES_0526: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "cualquier miembro concede",
    sql: () => once(FILE_0526, "  if v_actor_role is distinct from 'admin' then\n    raise exception 'Solo un administrador concede", "  if false then\n    raise exception 'Solo un administrador concede"),
    cae: "TEST 0526: 1: contabilidad no concede",
  },
  {
    nombre: "sin doble aviso en la RPC",
    sql: () => once(FILE_0526, "if v_sensitive and p_confirm_sensitive is distinct from true then", "if false then"),
    cae: "TEST 0526: 4a: tesorería sin confirmación rechazada",
  },
  {
    nombre: "support edita con extra",
    sql: () => once(FILE_0526, "  if v_edit and v_role = 'support' then\n    return false;\n  end if;\n", ""),
    cae: "TEST 0526: 6b: support nunca edita",
  },
  {
    nombre: "el vencimiento no cuenta",
    sql: () => once(FILE_0526, "      and (g.expires_at is null or g.expires_at > pg_catalog.now())\n      and (not public", "      and (not public"),
    cae: "TEST 0526: 6d: vencido",
  },
  {
    nombre: "el extra salta el scope de almacén",
    sql: () => once(FILE_0526, "  if v_side is not null and coalesce(v_scope, 'all') not in ('all', v_side) then\n    return false;\n  end if;\n", ""),
    cae: "TEST 0526: 6e: un extra no salta el scope",
  },
  {
    nombre: "auto-concesión",
    sql: () => once(FILE_0526, "if p_user_id is null or p_user_id = v_actor then", "if p_user_id is null then"),
    cae: "TEST 0526: 3e: nadie se concede a sí mismo",
  },
  {
    nombre: "cualquier admin concede módulos del superadmin",
    sql: () => once(FILE_0526, "if public.studio_module_is_superadmin_only(v_module) and not (select public.is_platform_admin()) then", "if false then"),
    cae: "TEST 0526: 5e:",
  },
  {
    nombre: "la RPC acepta Usuarios con edición",
    sql: () => once(FILE_0526, "if coalesce(p_can_edit, false) and v_module in ('users', 'admin') then", "if false then"),
    cae: "TEST 0526: 5a: Usuarios no se concede con edición",
  },
];

const MUTANTES_0527: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "la escritura de tarjetas solo pide ver",
    sql: () =>
      once(
        FILE_0527,
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()) and fuente = 'manual');",
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()) and fuente = 'manual');",
      ).replace("<> 5 then\n    raise exception '0527: las 5 policies", "<> 4 then\n    raise exception '0527: las 5 policies"),
    cae: "TEST 0527: 4b: con solo ver no crea tarjetas",
  },
  {
    nombre: "document_entity_authorized ignora el extra",
    sql: () => once(FILE_0527, "        or coalesce(d.grant_view, false)\n", "\n"),
    cae: "TEST 0527: 6e:",
  },
];

describe("SDD-0622 · contratos 0526 y 0527 (PGlite)", () => {
  it("el contrato de la 0526 pasa entero", async () => {
    const run = await contract(C0526, "TEST 0526");
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0526: \d+ aserciones OK$/);
    expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(50);
  }, SLOW);

  it("CONTROL ROJO: sin la 0526 cae en la primera aserción", async () => {
    const run = await contract(C0526, "TEST 0526", { [M0526]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain("TEST 0526: 1: contabilidad no concede");
  }, SLOW);

  it("la 0526 no se aplica dos veces (preflight)", async () => {
    const run = await contract(C0526, "TEST 0526", { [M0526]: `${FILE_0526}\n${FILE_0526}` });
    expect(run.error).toContain("0526 no aplica");
  }, SLOW);

  it.each(MUTANTES_0526)("MUTANTE 0526 «$nombre» cae", async ({ sql, cae }) => {
    const run = await contract(C0526, "TEST 0526", { [M0526]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it("el contrato de la 0527 pasa entero (caso Alejandro de punta a punta)", async () => {
    const run = await contract(C0527, "TEST 0527");
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0527: \d+ aserciones OK$/);
    expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(30);
  }, SLOW);

  it("CONTROL ROJO: sin la 0527 la base le cierra el CRM a contabilidad con extra", async () => {
    const run = await contract(C0527, "TEST 0527", { [M0527]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0527: 3a|TEST 0527: 3b/);
  }, SLOW);

  it.each(MUTANTES_0527)("MUTANTE 0527 «$nombre» cae", async ({ sql, cae }) => {
    const run = await contract(C0527, "TEST 0527", { [M0527]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it("hay mutantes de cada candado (piso)", () => {
    expect(MUTANTES_0526.length).toBeGreaterThanOrEqual(8);
    expect(MUTANTES_0527.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Paridad código ↔ base (§7.8) ─────────────────────────────────────────
const ROLES: StudioUserRole[] = ["commercial", "operations", "accounting", "warehouse", "support", "marketing"];
/** Extras de prueba: uno de cada clase (normal editar, normal ver, sensible, keystone, con lado). */
const EXTRAS: { module: string; edit: boolean }[] = [
  { module: "kommo", edit: true },
  { module: "quotes", edit: false },
  { module: "treasury", edit: true },
  { module: "users", edit: false },
  { module: "cn", edit: false },
  { module: "academia", edit: true },
];
/** Un desvío por rol para que la paridad cubra también la 0357. */
const OVERRIDE = { role: "warehouse" as const, module: "clients", view: true, edit: false };

describe("SDD-0622 · paridad canAccessModule/canEditModule ↔ user_has_module", () => {
  it("mismo resultado en código y en base para cada rol × módulo × extra", async () => {
    const db = await pgliteLimpio();
    try {
      const setup = inline(C0526).split("create temporary sequence assertion_count;")[0];
      await db.exec(setup);
      const tenant = "11111111-1111-1111-1111-111111111111";
      const users = ROLES.map((role, i) => ({
        role,
        id: `b0000000-0000-0000-0000-00000000000${i}`,
        scope: role === "warehouse" ? "ve" : "all",
      }));
      const filas = users
        .map((u) => `('${u.id}')`)
        .join(",");
      await db.exec(`insert into auth.users values ${filas};`);
      await db.exec(
        `insert into public.user_tenants (user_id, tenant_id, role, warehouse_scope) values ${users
          .map((u) => `('${u.id}', '${tenant}', '${u.role}', '${u.scope}')`)
          .join(",")};`,
      );
      await db.exec(
        `insert into public.studio_role_module_overrides (tenant_id, role, module_id, can_view, can_edit)
         values ('${tenant}', '${OVERRIDE.role}', '${OVERRIDE.module}', ${OVERRIDE.view}, ${OVERRIDE.edit});`,
      );
      const extrasSql = users.flatMap((u) =>
        EXTRAS.map(
          (e) =>
            `('${tenant}', '${u.id}', '${e.module}', true, ${e.edit && !["users", "admin"].includes(e.module)}, 'Paridad de prueba', ${
              LOCKED_MODULES.has(e.module) ? "now(), '2026-11-11.1'" : "null, null"
            })`,
        ),
      );
      await db.exec(
        `insert into public.studio_user_module_grants (tenant_id, user_id, module_id, can_view, can_edit, reason, sensitive_confirmed_at, effects_version)
         values ${extrasSql.join(",")};`,
      );

      const overrides: RoleModuleOverrides = {
        [`${OVERRIDE.role}:${OVERRIDE.module}`]: { view: OVERRIDE.view, edit: OVERRIDE.edit },
      };
      const grants: UserModuleGrants = Object.fromEntries(
        EXTRAS.map((e) => [e.module, { view: true, edit: e.edit && !["users", "admin"].includes(e.module) }]),
      );
      const modules = Object.keys(ROLE_MODULE_ACCESS);
      const diffs: string[] = [];
      for (const u of users) {
        await db.exec(`set request.jwt.claim.sub = '${u.id}';`);
        const res = await db.query<{ module_id: string; v: boolean; e: boolean }>(
          `select m as module_id, public.user_has_module(m, false) as v, public.user_has_module(m, true) as e
           from unnest($1::text[]) as m`,
          [modules],
        );
        for (const row of res.rows) {
          const scopeOk = scopeAllowsModule(u.scope, row.module_id);
          const v = canAccessModule(u.role, row.module_id, overrides, grants) && scopeOk;
          const e = canEditModule(u.role, row.module_id, overrides, grants) && scopeOk;
          if (v !== row.v || e !== row.e) {
            diffs.push(`${u.role}×${row.module_id}: código ${v}/${e} · base ${row.v}/${row.e}`);
          }
        }
      }
      expect(diffs).toEqual([]);
      expect(modules.length * users.length).toBeGreaterThan(300);
    } finally {
      await db.close();
    }
  }, SLOW);
});
