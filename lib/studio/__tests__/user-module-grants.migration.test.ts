// @vitest-environment node
/**
 * SDD-0622 · Las migraciones 0538 y 0539 corridas de verdad sobre PostgreSQL
 * embebido, más el anti-drift entre la copia SQL de la matriz y `rbac.ts`.
 *
 * - Contratos `supabase/tests/0538_*.test.sql` y `0539_*.test.sql` con los `.sql`
 *   REALES inlineados (lo que se prueba es el texto que se aplicará).
 * - CONTROL ROJO: sin la migración, el contrato cae.
 * - MUTANTES: cada uno rompe UN candado y el contrato tiene que caer con la
 *   aserción que lo nombra.
 * - PARIDAD (§7.8): para cada rol, módulo y combinación de extras, el mismo
 *   (rol, desvío, extra, scope) da el mismo resultado en `canAccessModule` /
 *   `canEditModule` (+ `scopeAllowsModule`) y en `user_has_module`.
 */
import { readdirSync, readFileSync } from "node:fs";
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
import { MODULES } from "@/lib/studio/modules";
import { moduleCoverage } from "@/lib/studio/user-module-grants";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const M0538 = "0538_studio_user_module_grants.sql";
const M0539 = "0539_comercial_acepta_accesos_por_persona.sql";
const FILE_0538 = read(resolve(ROOT, "supabase/migrations", M0538));
const FILE_0539 = read(resolve(ROOT, "supabase/migrations", M0539));
const C0538 = resolve(ROOT, "supabase/tests/0538_studio_user_module_grants.test.sql");
const C0539 = resolve(ROOT, "supabase/tests/0539_comercial_acepta_accesos_por_persona.test.sql");
const M0540 = "0540_comercial_rls_por_modulo.sql";
const FILE_0540 = read(resolve(ROOT, "supabase/migrations", M0540));
const C0540 = resolve(ROOT, "supabase/tests/0540_comercial_rls_por_modulo.test.sql");
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
describe("SDD-0622 · la 0538 copia exacta de rbac.ts", () => {
  it("studio_module_default_roles = ROLE_MODULE_ACCESS (mismos módulos, mismos roles)", () => {
    const body = FILE_0538.slice(
      FILE_0538.indexOf("create function public.studio_module_default_roles"),
      FILE_0538.indexOf("comment on function public.studio_module_default_roles"),
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

  it("los sensibles de la 0538 = LOCKED_MODULES, en la función y en el CHECK", () => {
    const locked = [...LOCKED_MODULES].sort();
    const fn = FILE_0538.slice(
      FILE_0538.indexOf("create function public.studio_module_is_sensitive"),
      FILE_0538.indexOf("comment on function public.studio_module_is_sensitive"),
    );
    const check = FILE_0538.slice(
      FILE_0538.indexOf("constraint studio_user_module_grants_sensitive_confirmed"),
      FILE_0538.indexOf("constraint studio_user_module_grants_keystone_read_only"),
    );
    const ids = (s: string) => [...s.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(ids(fn)).toEqual(locked);
    expect(ids(check)).toEqual(locked);
  });

  it("los del superadministrador de la 0538 = SUPERADMIN_ONLY_MODULES", () => {
    const fn = FILE_0538.slice(
      FILE_0538.indexOf("create function public.studio_module_is_superadmin_only"),
      FILE_0538.indexOf("comment on function public.studio_module_is_superadmin_only"),
    );
    const ids = [...fn.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    expect(ids).toEqual([...SUPERADMIN_ONLY_MODULES].sort());
  });

  it("cada módulo sensible tiene su lista de efectos para el doble aviso", () => {
    for (const id of LOCKED_MODULES) {
      expect(SENSITIVE_MODULE_EFFECTS[id]?.length ?? 0, id).toBeGreaterThan(0);
    }
  });

  // SDD-0675: la lista vigente es la ÚLTIMA migración que (re)define la función
  // (hoy la 0565, que suma bandeja), no la de la 0538.
  it("los concedibles vigentes de la base (studio_module_is_grantable) = COVERED de user-module-grants.ts", () => {
    const MARCA = /create (?:or replace )?function public\.studio_module_is_grantable/;
    const ultima = readdirSync(resolve(ROOT, "supabase/migrations"))
      .filter((f) => /^\d{4}_.*\.sql$/.test(f))
      .sort()
      .map((f) => read(resolve(ROOT, "supabase/migrations", f)))
      .filter((t) => MARCA.test(t))
      .at(-1)!;
    const inicio = ultima.search(MARCA);
    const fn = ultima.slice(inicio, ultima.indexOf("comment on function public.studio_module_is_grantable", inicio));
    const sql = [...fn.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
    const code = MODULES.map((m) => m.id).filter((id) => moduleCoverage(id) === "covered").sort();
    expect(code.length).toBeGreaterThanOrEqual(5);
    expect(sql).toEqual(code);
    // Ni el panel de administración ni Usuarios se conceden por la RPC.
    expect(sql).not.toContain("admin");
    expect(sql).not.toContain("users");
  });
});

// ─── Contratos ───────────────────────────────────────────────────────────
const MUTANTES_0538: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "cualquier miembro concede",
    sql: () => once(FILE_0538, "  if v_actor_role is distinct from 'admin' then\n    raise exception 'Solo un administrador concede", "  if false then\n    raise exception 'Solo un administrador concede"),
    cae: "TEST 0538: 1: contabilidad no concede",
  },
  {
    nombre: "sin doble aviso en la RPC",
    sql: () => once(FILE_0538, "if v_sensitive and p_confirm_sensitive is distinct from true then", "if false then"),
    cae: "TEST 0538: 4a: tesorería sin confirmación rechazada",
  },
  {
    nombre: "support edita con extra",
    sql: () => once(FILE_0538, "  if v_edit and v_role = 'support' then\n    return false;\n  end if;\n", ""),
    cae: "TEST 0538: 6b: support nunca edita",
  },
  {
    nombre: "el vencimiento no cuenta",
    sql: () => once(FILE_0538, "      and (g.expires_at is null or g.expires_at > pg_catalog.now())\n      and (not public", "      and (not public"),
    cae: "TEST 0538: 6d: vencido",
  },
  {
    nombre: "el extra salta el scope de almacén",
    sql: () => once(FILE_0538, "  if v_side is not null and coalesce(v_scope, 'all') not in ('all', v_side) then\n    return false;\n  end if;\n", ""),
    cae: "TEST 0538: 6e: un extra no salta el scope",
  },
  {
    nombre: "auto-concesión",
    sql: () => once(FILE_0538, "if p_user_id is null or p_user_id = v_actor then", "if p_user_id is null then"),
    cae: "TEST 0538: 3e: nadie se concede a sí mismo",
  },
  {
    nombre: "cualquier admin concede módulos del superadmin",
    sql: () => once(FILE_0538, "if public.studio_module_is_superadmin_only(v_module) and not (select public.is_platform_admin()) then", "if false then"),
    cae: "TEST 0538: 5e:",
  },
  {
    nombre: "la RPC acepta Usuarios con edición",
    sql: () => once(FILE_0538, "if coalesce(p_can_edit, false) and v_module in ('users', 'admin') then", "if false then"),
    cae: "TEST 0538: 5a: Usuarios no se concede con edición",
  },
  {
    nombre: "la RPC concede módulos que la base no cubre (Tesorería, admin)",
    sql: () =>
      once(
        FILE_0538,
        "  if not public.studio_module_is_grantable(v_module) then\n    raise exception 'Ese módulo todavía no se puede conceder",
        "  if false then\n    raise exception 'Ese módulo todavía no se puede conceder",
      ),
    cae: "TEST 0538: 4c: con confirmación, la RPC tampoco da Tesorería",
  },
];

const MUTANTES_0539: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "la escritura de tarjetas solo pide ver",
    sql: () =>
      once(
        FILE_0539,
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_editar()) and fuente = 'manual');",
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()) and fuente = 'manual');",
      ).replace("<> 5 then\n    raise exception '0539: las 5 policies", "<> 4 then\n    raise exception '0539: las 5 policies"),
    cae: "TEST 0539: 4b: con solo ver no crea tarjetas",
  },
  {
    nombre: "document_entity_authorized ignora el extra",
    sql: () => once(FILE_0539, "        or coalesce(d.grant_view, false)\n", "\n"),
    cae: "TEST 0539: 6e:",
  },
];

/**
 * Deriva del estado de partida (revisión de la #509): se cambia la 0506 del
 * fixture, no la 0539. Su preflight tiene que abortar sin tocar nada.
 */
const M0506 = "0506_crm_modelo.sql";
const FILE_0506 = read(resolve(ROOT, "supabase/migrations", M0506));
const DERIVAS_0539: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "crm_tarjetas_insert ya no exige fuente manual",
    sql: () =>
      once(
        FILE_0506,
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()) and fuente = 'manual');",
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));",
      ),
    cae: "0539: las policies del CRM que se recrean no son las de la 0506 (drift): crm_tarjetas::crm_tarjetas_insert",
  },
  {
    nombre: "crm_mover_etapa con otro cuerpo",
    sql: () =>
      once(
        FILE_0506,
        "raise exception 'crm_mover_etapa: tablero desconocido'",
        "raise exception 'crm_mover_etapa: tablero no reconocido'",
      ),
    cae: "0539: crm_mover_etapa no tiene el cuerpo de la 0506 (drift)",
  },
];

const MUTANTES_0540: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "crear cotizaciones solo pide ver",
    sql: () =>
      once(
        FILE_0540,
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('quotes', true)));",
        "with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('quotes', false)));",
      ),
    cae: "TEST 0540: 1b: support no crea cotizaciones",
  },
  {
    nombre: "marketing lee tarifas (lectura sin módulo)",
    sql: () =>
      once(
        FILE_0540,
        "and (select public.user_has_any_module(array['rates', 'quotes', 'clients', 'sales-orders', 'cn'])));",
        ");",
      ),
    // La postcondición de la propia 0540 ya lo frena antes de las aserciones.
    cae: "0540: quedan policies de authenticated sin módulo: rates::rates_select_por_modulo",
  },
  {
    nombre: "la CN no lee tarifas (rompe la propuesta de la recepción)",
    sql: () => once(FILE_0540, "array['rates', 'quotes', 'clients', 'sales-orders', 'cn']", "array['rates', 'quotes', 'clients', 'sales-orders']"),
    cae: "TEST 0540: 3a: almacén CN lee tarifas",
  },
  {
    nombre: "mensajes sin candado de edición",
    sql: () =>
      once(
        FILE_0540,
        "create policy conversation_messages_insert_por_modulo on public.conversation_messages\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', true)));",
        "create policy conversation_messages_insert_por_modulo on public.conversation_messages\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('conversaciones', false)));",
      ),
    cae: "TEST 0540: 1f: support no escribe mensajes",
  },
  {
    nombre: "borrar cotizaciones solo pide ver",
    sql: () =>
      once(
        FILE_0540,
        "  for delete to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('quotes', true)));",
        "  for delete to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.user_has_module('quotes', false)));",
      ),
    cae: "TEST 0540: 6d: support no borra cotizaciones",
  },
  {
    nombre: "crear órdenes de compra solo pide ver",
    sql: () =>
      once(
        FILE_0540,
        "create policy purchase_orders_insert_por_modulo on public.purchase_orders\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', true)));",
        "create policy purchase_orders_insert_por_modulo on public.purchase_orders\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('purchase-orders', false)));",
      ),
    cae: "TEST 0540: 6b: support no crea órdenes de compra",
  },
  {
    nombre: "crear órdenes de venta solo pide ver",
    sql: () =>
      once(
        FILE_0540,
        "create policy sales_orders_insert_por_modulo on public.sales_orders\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('sales-orders', true)));",
        "create policy sales_orders_insert_por_modulo on public.sales_orders\n  for insert to authenticated\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.user_has_module('sales-orders', false)));",
      ),
    cae: "TEST 0540: 6c: support no crea órdenes de venta",
  },
  {
    nombre: "la lectura de tarifas vuelve a filtrar lo borrado (reabre el bug de la 0230)",
    sql: () =>
      once(
        FILE_0540,
        "create policy rates_select_por_modulo on public.rates\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id())\n",
        "create policy rates_select_por_modulo on public.rates\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null\n",
      ),
    cae: "TEST 0540: 7a: comercial borra lógico una tarifa con la sesión",
  },
  {
    nombre: "la lectura de cotizaciones vuelve a filtrar lo borrado",
    sql: () =>
      once(
        FILE_0540,
        "create policy quotes_select_por_modulo on public.quotes\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id())\n",
        "create policy quotes_select_por_modulo on public.quotes\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null\n",
      ),
    // Cae antes, en 3d2 (la RLS ya no muestra lo borrado), que también defiende la 0230.
    cae: "TEST 0540: 3d2:",
  },
  ...(
    [
      ["conversations", "7c: contabilidad con Conversaciones borra lógico una conversación con la sesión (error: new row violates"],
      ["purchase_orders", "7d: comercial borra lógico una orden de compra con la sesión (error: new row violates"],
      ["sales_orders", "7e: contabilidad borra lógico una orden de venta con la sesión (error: new row violates"],
    ] as const
  ).map(([tabla, cae]) => ({
    nombre: `la lectura de ${tabla} vuelve a filtrar lo borrado`,
    sql: () =>
      once(
        FILE_0540,
        `create policy ${tabla}_select_por_modulo on public.${tabla}\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id())\n`,
        `create policy ${tabla}_select_por_modulo on public.${tabla}\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null\n`,
      ),
    cae: `TEST 0540: ${cae}`,
  })),
  {
    nombre: "una policy TO public sin módulo se cuela",
    sql: () =>
      once(
        FILE_0540,
        "-- ─── Postcondiciones",
        "create policy rates_abierta_public on public.rates for select using (true);\n-- ─── Postcondiciones",
      ),
    cae: "0540: quedan policies de authenticated sin módulo: rates::rates_abierta_public",
  },
  {
    nombre: "una policy con «portal» en el nombre se cuela",
    sql: () =>
      once(
        FILE_0540,
        "-- ─── Postcondiciones",
        "create policy \"rates portal abierta\" on public.rates for select to authenticated using (true);\n-- ─── Postcondiciones",
      ),
    cae: "0540: quedan policies de authenticated sin módulo: rates::rates portal abierta",
  },
];

/**
 * Deriva del estado de partida de la 0540 (revisión de la #509): se cambia el
 * fixture (la copia literal del repo), no la 0540. El preflight exacto tiene
 * que abortar.
 */
const C0540_NOMBRE = "0540_comercial_rls_por_modulo.test.sql";
const FIXTURE_0540 = read(C0540);
const DERIVAS_0540: { nombre: string; fixture: () => string; cae: string }[] = [
  {
    nombre: "falta la policy de service_role de conversaciones",
    fixture: () =>
      once(
        FIXTURE_0540,
        "create policy \"conversations service_role all\" on public.conversations\n  for all to service_role using (true) with check (true);\n",
        "",
      ),
    cae: "conversations::conversations service_role all",
  },
  {
    // El estado real (después de la 0230, que el fixture aplica) pasa: es el
    // contrato verde. Una deriva VERDADERA es otra expresión de tenant.
    nombre: "«rates by tenant» con otra expresión (no la de la 0230)",
    fixture: () =>
      once(
        FIXTURE_0540,
        "create policy \"rates by tenant\" on public.rates for all to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)",
        "create policy \"rates by tenant\" on public.rates for all to authenticated\n  using (tenant_id is not null and deleted_at is null)",
      ),
    cae: "0540: faltan las policies que reemplaza o no son las del repo (drift o ya aplicada): rates::rates by tenant",
  },
  {
    nombre: "sin la 0230 (estado viejo, con el filtro de borrado en la FOR ALL)",
    fixture: () =>
      once(
        FIXTURE_0540,
        "\\ir ../migrations/0230_fix_rls_soft_delete_blocked.sql\n",
        "",
      ),
    cae: "rates::rates by tenant",
  },
  {
    nombre: "una policy de más en cotizaciones",
    fixture: () =>
      once(
        FIXTURE_0540,
        "-- service_role y portal: la 0540 no las toca, pero su preflight las cuenta.\n",
        "-- service_role y portal: la 0540 no las toca, pero su preflight las cuenta.\ncreate policy quotes_extra on public.quotes for select to authenticated using (true);\n",
      ),
    cae: "quotes::quotes_extra",
  },
  {
    nombre: "RLS con FORCE en tarifas",
    fixture: () =>
      once(
        FIXTURE_0540,
        "alter table public.rates enable row level security;\n",
        "alter table public.rates enable row level security;\nalter table public.rates force row level security;\n",
      ),
    cae: "0540 abortado: public.rates no es de postgres con RLS activa y sin FORCE",
  },
  {
    nombre: "authenticated sin DELETE en órdenes de venta",
    fixture: () =>
      once(
        FIXTURE_0540,
        "grant select on public.chatwoot_conversations to authenticated;\n",
        "grant select on public.chatwoot_conversations to authenticated;\nrevoke delete on public.sales_orders from authenticated;\n",
      ),
    cae: "0540 abortado: el DELETE de authenticated sobre public.sales_orders no es el esperado",
  },
];

describe("SDD-0622 · contrato 0540 (RLS comercial por módulo, PGlite)", () => {
  it("el contrato de la 0540 pasa entero", async () => {
    const run = await contract(C0540, "TEST 0540");
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0540: \d+ aserciones OK$/);
    expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(45);
  }, SLOW);

  it("CONTROL ROJO: sin la 0540 support escribe cotizaciones", async () => {
    const run = await contract(C0540, "TEST 0540", { [M0540]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain("TEST 0540: 1b: support no crea cotizaciones");
  }, SLOW);

  it("la 0540 no se aplica dos veces (preflight)", async () => {
    const run = await contract(C0540, "TEST 0540", { [M0540]: `${FILE_0540}\n${FILE_0540}` });
    expect(run.error).toContain("0540: faltan las policies que reemplaza");
  }, SLOW);

  it.each(MUTANTES_0540)("MUTANTE 0540 «$nombre» cae", async ({ sql, cae }) => {
    const run = await contract(C0540, "TEST 0540", { [M0540]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it.each(DERIVAS_0540)("DERIVA del estado de partida «$nombre»: el preflight de la 0540 aborta", async ({ fixture, cae }) => {
    const run = await contract(C0540, "TEST 0540", { [C0540_NOMBRE]: fixture() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it("hay mutantes y derivas de la 0540 (piso)", () => {
    expect(MUTANTES_0540.length).toBeGreaterThanOrEqual(14);
    expect(DERIVAS_0540.length).toBeGreaterThanOrEqual(6);
  });
});

describe("SDD-0622 · contratos 0538 y 0539 (PGlite)", () => {
  it("el contrato de la 0538 pasa entero", async () => {
    const run = await contract(C0538, "TEST 0538");
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0538: \d+ aserciones OK$/);
    expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(50);
  }, SLOW);

  it("CONTROL ROJO: sin la 0538 cae en la primera aserción", async () => {
    const run = await contract(C0538, "TEST 0538", { [M0538]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain("TEST 0538: 1: contabilidad no concede");
  }, SLOW);

  it("la 0538 no se aplica dos veces (preflight)", async () => {
    const run = await contract(C0538, "TEST 0538", { [M0538]: `${FILE_0538}\n${FILE_0538}` });
    expect(run.error).toContain("0538 no aplica");
  }, SLOW);

  it.each(MUTANTES_0538)("MUTANTE 0538 «$nombre» cae", async ({ sql, cae }) => {
    const run = await contract(C0538, "TEST 0538", { [M0538]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it("el contrato de la 0539 pasa entero (contabilidad con CRM de punta a punta)", async () => {
    const run = await contract(C0539, "TEST 0539");
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0539: \d+ aserciones OK$/);
    expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(30);
  }, SLOW);

  it("CONTROL ROJO: sin la 0539 la base le cierra el CRM a contabilidad con extra", async () => {
    const run = await contract(C0539, "TEST 0539", { [M0539]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0539: 3a|TEST 0539: 3b/);
  }, SLOW);

  it.each(MUTANTES_0539)("MUTANTE 0539 «$nombre» cae", async ({ sql, cae }) => {
    const run = await contract(C0539, "TEST 0539", { [M0539]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it.each(DERIVAS_0539)("DERIVA de la 0506 «$nombre»: el preflight de la 0539 aborta", async ({ sql, cae }) => {
    const run = await contract(C0539, "TEST 0539", { [M0506]: sql() });
    expect(run.green).toBeUndefined();
    expect(run.error).toContain(cae);
  }, SLOW);

  it("hay mutantes de cada candado (piso)", () => {
    expect(MUTANTES_0538.length).toBeGreaterThanOrEqual(9);
    expect(MUTANTES_0539.length).toBeGreaterThanOrEqual(2);
    expect(DERIVAS_0539.length).toBeGreaterThanOrEqual(2);
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
      const setup = inline(C0538).split("create temporary sequence assertion_count;")[0];
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
