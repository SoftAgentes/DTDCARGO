// @vitest-environment node
/**
 * SDD-0529 · La migración 0480 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0480_operarios_editar_por_region.test.sql` corre
 * en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre
 * ese MISMO contrato con los `.sql` reales inlineados: lo que se prueba es el
 * texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0480 el contrato cae en su primera aserción (el camionero
 * de Venezuela no se puede pasar a bodeguero). PREFLIGHT: un ANTES con drift
 * aborta sin cambiar nada. MUTANTES: cada uno es una 0480 coherente (con el md5
 * de sus propios cuerpos en el preflight y el postflight) y cae en la aserción
 * de la regla que rompe.
 *
 * PROPIEDAD: para cada rol del Studio, sin desvío y con cada desvío posible de
 * 0357, admin_update_operario decide lo mismo que `moduleEditDenial` de
 * rbac-guard.ts, que es lo que usa la app.
 *
 * LA APP Y LA BASE: lo que devuelve operario_roles_por_region() pasa por
 * `parseOperarioRolesPorRegion` y `operarioRolOpciones` (lo que ve el cajón) y,
 * para cada región y cada rol, el cajón lo ofrece si y sólo si la RPC lo acepta.
 *
 * TEXTO: las copias verbatim del contrato siguen iguales a sus archivos; 0480
 * reescribe admin_update_operario desde su última definición (0351) sin perder
 * más líneas que las que cambia a propósito.
 *
 * DESEMPATE (SDD-0536): en PGlite clock_timestamp() no tiene microsegundos, así
 * que dos guardados seguidos del mismo operario pueden dejar dos eventos con la
 * misma hora. last_event elige por xmin; con los guardados del bloque 8 a la
 * misma hora el contrato sigue verde, y con el orden por hora cae donde cayó el
 * CI de la PR #239.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canEditModule, type ModuleAccessOverride } from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { operarioRolOpciones, parseOperarioRolesPorRegion } from "@/lib/studio/operario-edicion";
import type { OperarioRegion, OperarioRol } from "@/lib/studio/operario-pin";

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
const { moduleEditDenial } = await import("@/lib/studio/rbac-guard");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const CONTRACT = resolve(ROOT, "supabase/tests/0480_operarios_editar_por_region.test.sql");
const CONTRACT_0475 = resolve(ROOT, "supabase/tests/0475_pin_operarios_endurecer.test.sql");
const M0480 = "0480_operarios_editar_por_region.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
// Una lectura por migración en todo el archivo: la prueba (texto) del preflight
// recorre las 485 migraciones tres veces y, sin caché, eran ~1.450 lecturas
// (SDD-0550). Los archivos no cambian durante la corrida.
const MIG_LEIDAS = new Map<string, string>();
const mig = (name: string) => {
  if (!MIG_LEIDAS.has(name)) MIG_LEIDAS.set(name, read(resolve(MIGRATIONS, name)));
  return MIG_LEIDAS.get(name)!;
};
const FILE_0480 = mig(M0480);
const FILE_CONTRACT = read(CONTRACT);
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const DECLARATIONS = JSON.parse(read(resolve(ROOT, "supabase/pending-migration-symbol-declarations.json"))) as {
  degradations: { id: string; migration: string; primarySymbol: string; symbols: { name: string; callSites: string[] }[] }[];
};
const SLOW = 240_000;
/**
 * ⏱️ I/O: las pruebas (texto) leen migraciones del disco. Aislada, la del
 * preflight tardaba ~0,8 s; dentro de `pnpm verify` tardó 20,8 s contra el tope
 * global de 20 s (SDD-0550). Con la caché de `mig` lee cada archivo una vez, y
 * el bloque lleva su propio tope.
 */
const TEXTO = 120_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif, \ir y \quit. `replace` sustituye el texto de un archivo, por
 * el final de su ruta: una migración (mutante) o el propio contrato.
 */
function psql(file: string, vars: Record<string, string> = {}, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  let quit = false;
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source(path).split(/\r?\n/)) {
      if (quit) return;
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
      } else if (command === "quit") {
        quit = true;
        return;
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0 && !quit) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; migration?: string; replace?: Record<string, string> } = {}) {
  const replace = { ...(options.replace ?? {}) };
  if (options.migration) replace[M0480] = options.migration;
  const sql = psql(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replace);
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0480 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/**
 * Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola
 * vez. Con split/join y no con replace: en un reemplazo de String.replace, `$$`
 * significa un `$` y rompería el dollar quoting de cualquier cuerpo.
 */
function once(text: string, from: string, to: string): string {
  const parts = text.split(from);
  expect(parts, `«${from.slice(0, 50)}…» debe aparecer una sola vez`).toHaveLength(2);
  return parts.join(to);
}

/** El bloque `create [or replace] function public.<name>(… <tag>;` de un archivo (la última). */
function block(text: string, name: string, head = "create or replace function"): string {
  const signature = `${head} public.${name}(`;
  const start = text.lastIndexOf(signature);
  expect(start, `${name} en el texto`).toBeGreaterThanOrEqual(0);
  const opener = /\bas\s+(\$[A-Za-z0-9_]*\$)/.exec(text.slice(start));
  expect(opener, `etiqueta de ${name}`).not.toBeNull();
  const bodyStart = start + opener!.index + opener![0].length;
  const end = text.indexOf(`${opener![1]};`, bodyStart);
  expect(end, `cierre de ${name}`).toBeGreaterThan(bodyStart);
  return text.slice(start, end + opener![1].length + 1);
}

/** El prosrc que guardará Postgres: lo que va entre las dos etiquetas. */
function prosrc(fn: string): string {
  const opener = /\bas\s+(\$[A-Za-z0-9_]*\$)/.exec(fn)!;
  const bodyStart = opener.index + opener[0].length;
  return fn.slice(bodyStart, fn.lastIndexOf(opener[1]));
}

const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");
const bodyMd5 = (text: string, name: string, head?: string) => md5(prosrc(block(text, name, head)));

const FUNCTIONS = ["admin_update_operario", "operario_roles_por_region"] as const;

/** 0480 con cambios y el md5 de cada cuerpo que cambió en lugar del suyo. */
function mutant(...changes: [string, string][]): string {
  let text = FILE_0480;
  for (const [from, to] of changes) text = once(text, from, to);
  for (const name of FUNCTIONS) {
    const before = bodyMd5(FILE_0480, name);
    const after = bodyMd5(text, name);
    if (before !== after) text = text.split(before).join(after);
  }
  return text;
}

/** La sentencia completa que empieza en `head` y termina en el primer `;\n`. */
function statement(text: string, head: string): string {
  const start = text.indexOf(head);
  expect(start, `«${head}» en el texto`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf(";\n", start) + 1);
}

/** ¿`needle` es subsecuencia de `haystack`, línea por línea y en orden? */
function missingLines(haystack: string, needle: string): string[] {
  const lines = haystack.split("\n");
  const missing: string[] = [];
  let at = 0;
  for (const line of needle.split("\n")) {
    const found = lines.indexOf(line, at);
    if (found < 0) missing.push(line);
    else at = found + 1;
  }
  return missing;
}

describe("SDD-0529 · 0480 (texto)", { timeout: TEXTO }, () => {
  it("las copias verbatim del contrato siguen iguales a sus archivos", () => {
    expect(block(FILE_CONTRACT, "get_user_tenant_id")).toBe(
      block(mig("0453_portal_helpers_principal_determinista.sql"), "get_user_tenant_id"));
    expect(block(FILE_CONTRACT, "current_studio_role")).toBe(
      block(mig("0200_rbac_disabled_enforcement.sql"), "current_studio_role"));
    const file0012 = mig("0012_rls_perf_and_rpc_guards.sql");
    expect(block(FILE_CONTRACT, "assert_tenant_match")).toBe(block(file0012, "assert_tenant_match"));
    for (const head of ["revoke execute on function public.assert_tenant_match(uuid)",
      "grant execute on function public.assert_tenant_match(uuid)"]) {
      expect(FILE_CONTRACT).toContain(statement(file0012, head));
    }
    const file0211 = mig("0211_revoke_authenticated_rpc_sweep.sql");
    for (const head of ["revoke execute on function public.assert_tenant_match(",
      "grant execute on function public.assert_tenant_match("]) {
      expect(FILE_CONTRACT).toContain(statement(file0211, head));
    }
    expect(FILE_CONTRACT).toContain(statement(mig("0200_rbac_disabled_enforcement.sql"),
      'create policy "users see their own user_tenants"'));
    const file0020 = mig("0020_operario_pins.sql");
    for (const head of ["revoke all on public.operario_pins from", "grant select, insert, update, delete on public.operario_pins",
      "alter table public.operario_pins enable row level security"]) {
      expect(FILE_CONTRACT).toContain(statement(file0020, head));
    }
    expect(FILE_CONTRACT).toContain("  warehouse_id uuid references public.warehouses_cn(id) on delete restrict,\n");
    expect(file0020).toContain("references public.warehouses_cn(id) on delete restrict,");
    expect(FILE_CONTRACT).toContain(statement(mig("0023_operario_region.sql"), "create type operario_region"));
    expect(FILE_CONTRACT).toContain(statement(mig("0210_pin_search_path_triggers.sql"),
      "alter function public.validate_operario_pin_format("));
    // Lo que suma este contrato: el catálogo de almacenes y las constraints de
    // las que sale la regla del rol, copiadas de sus archivos.
    expect(FILE_CONTRACT).toContain(statement(mig("0008_warehouses_cn.sql"), "create table public.warehouses_cn ("));
    expect(FILE_CONTRACT).toContain(statement(mig("0025_operario_roles_extend.sql"),
      "alter table public.operario_pins\n  add constraint operario_pins_ve_role_requires_ve_region"));
    expect(FILE_CONTRACT).toContain(statement(mig("0066_foundation_v3.sql"),
      "alter table public.operario_pins\n      add constraint operario_pins_roles_check"));
  });

  it("el ANTES es el de 0475 con 0475 aplicada: mismas migraciones reales y mismo fixture de base", () => {
    const contract0475 = read(CONTRACT_0475);
    const includes = (text: string) => text.split("\n").filter((line) => line.startsWith("\\ir ../migrations/"));
    expect(includes(FILE_CONTRACT)).toEqual([
      ...includes(contract0475).filter((line) => !line.includes("0475_pin_operarios_endurecer")),
      "\\ir ../migrations/0475_pin_operarios_endurecer.sql",
      `\\ir ../migrations/${M0480}`,
      `\\ir ../migrations/${M0480}`,
    ]);
    for (const head of ["create table public.user_tenants (", "create table public.entity_audit_log (",
      "create function auth.uid()", "create function auth.jwt()", "create table public.tenants (",
      "create policy entity_audit_log_tenant_select", "alter publication supabase_realtime"]) {
      expect(FILE_CONTRACT, head).toContain(statement(contract0475, head));
    }
    // 0475 se aplica sin condición: es producción desde el 2026-10-14.
    const at0475 = FILE_CONTRACT.indexOf("\\ir ../migrations/0475_pin_operarios_endurecer.sql");
    expect(FILE_CONTRACT.lastIndexOf("\\if :apply_fix", at0475)).toBe(-1);
  });

  it("el preflight espera el md5 de la última definición de cada función, y el de 0480", () => {
    const file0351 = mig("0351_operario_rpc_exige_rol.sql");
    const expected: [string, string][] = [
      [bodyMd5(file0351, "admin_update_operario"), "0351"],
      [bodyMd5(mig("0475_pin_operarios_endurecer.sql"), "operarios_module_authorized"), "0475"],
      [bodyMd5(mig("0453_portal_helpers_principal_determinista.sql"), "get_user_tenant_id"), "0453"],
      [bodyMd5(mig("0012_rls_perf_and_rpc_guards.sql"), "assert_tenant_match"), "0012"],
    ];
    for (const [hash, origin] of expected) {
      expect(FILE_0480.split(`'${hash}'`), `md5 de ${origin} en el preflight`).toHaveLength(2);
    }
    // Las dos de 0480: una vez en el preflight y otra en el postflight.
    for (const name of FUNCTIONS) {
      expect(FILE_0480.split(`'${bodyMd5(FILE_0480, name)}'`), `md5 de ${name}`).toHaveLength(3);
    }
    // 0351 es la última definición de admin_update_operario antes de 0480, y
    // 0480 la última de todas; operario_roles_por_region sólo vive en 0480.
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
    const defines = (name: string) => files.filter((file) => mig(file).includes(`create or replace function public.${name}(`));
    expect(defines("admin_update_operario").slice(-2)).toEqual(["0351_operario_rpc_exige_rol.sql", M0480]);
    expect(defines("operario_roles_por_region")).toEqual([M0480]);
    expect(files.filter((file) => mig(file).includes("function public.operario_roles_por_region("))).toEqual([M0480]);
  });

  it("admin_update_operario se reescribió desde 0351 sin perder más líneas que las que cambian a propósito", () => {
    const old = block(mig("0351_operario_rpc_exige_rol.sql"), "admin_update_operario");
    const now = block(FILE_0480, "admin_update_operario");
    // Cada línea de 0351 que falta en 0480 está acá con su motivo; cualquier
    // otra que se pierda rompe la prueba.
    expect(missingLines(now, old)).toEqual([
      "set search_path = public", // search_path vacío
      "as $$", // etiqueta $function$
      "  v_tenant_id uuid;", // la fila entera en v_op
      "  perform public.assert_studio_role(array['admin', 'operations']);", // la matriz
      "  select op.tenant_id into v_tenant_id", // la fila entera, FOR UPDATE
      "    from public.operario_pins op where op.id = p_operario_id;",
      "  if v_tenant_id is null then", // v_op.tenant_id
      "  perform public.assert_tenant_match(v_tenant_id);",
      "  if p_display_name is null or length(trim(p_display_name)) = 0 then", // v_nombre recortado
      "    raise exception 'Nombre requerido' using errcode = 'P0011';", // tuteo
      "  if p_role not in ('operario', 'supervisor') then", // los roles de la región
      "    raise exception 'Rol inválido' using errcode = 'P0012';",
      "  update public.operario_pins", // dentro del bloque que traduce el nombre repetido
      "     set display_name = trim(p_display_name),",
      "         display_name_cn = nullif(trim(coalesce(p_display_name_cn, '')), ''),",
      "         role = p_role,",
      "         warehouse_id = p_warehouse_id",
      "   where id = p_operario_id;",
      "$$;",
    ]);
    expect(now).not.toContain("assert_studio_role");
    expect(now).toContain("  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then");
    expect(now).toContain("public.operario_roles_por_region() -> (v_op.region::text)");
    expect(now).toContain("v_event := public.append_audit_event(");
    // Misma firma: create or replace, sin drop ni sobrecarga nueva.
    expect(FILE_0480).not.toMatch(/drop function/i);
    expect(statement(now, "create or replace function public.admin_update_operario(")).toContain(
      "  p_operario_id uuid,\n  p_display_name text,\n  p_display_name_cn text,\n  p_role text,\n  p_warehouse_id uuid\n)");
  });

  it("aplicada al servidor propio el 2026-10-15: ya no es una espera ni una degradación declarada", () => {
    // Aplicada con el OK nominal de Sam; el ledger guarda el archivo entero. La
    // cabecera «NO APLICADA» no se corrige: editarla rompería la identidad.
    expect(FILE_0480).toContain("-- ⚠️ NO APLICADA A PRODUCCIÓN.");
    expect(BASELINE.pendingBelowCutoff["0480_operarios_editar_por_region"]).toBeUndefined();
    expect(DECLARATIONS.degradations.some((d) => d.migration === "0480_operarios_editar_por_region")).toBe(false);
  });
});

describe("SDD-0529 · 0480 (PGlite)", () => {
  it("el contrato pasa con 0480 aplicada dos veces", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0480 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0480 cae en la primera aserción, el camionero de Venezuela no se edita", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe(
      "TEST 0480: operations cambia el rol de un camionero de Venezuela a bodeguero, sin almacén (P0012: Rol inválido)");
  }, SLOW);

  const DRIFT = (signature: string) =>
    `0480 abortado: ${signature} tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)`;
  const UPDATE = "public.admin_update_operario(uuid,text,text,text,uuid)";
  const AFTER_0475 = "\\ir ../migrations/0475_pin_operarios_endurecer.sql\n";
  const CONTRACT_NAME = "0480_operarios_editar_por_region.test.sql";
  const PREFLIGHTS: { name: string; file: string; from: string; to: string; fails: string }[] = [
    {
      name: "admin_update_operario con un espacio de más",
      file: "0351_operario_rpc_exige_rol.sql",
      from: "         warehouse_id = p_warehouse_id\n   where id = p_operario_id;",
      to: "         warehouse_id = p_warehouse_id\n    where id = p_operario_id;",
      fails: DRIFT(UPDATE),
    },
    {
      name: "una base sin 0475 (sin la matriz)",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: "",
      fails: DRIFT("public.operarios_module_authorized(uuid,text)"),
    },
    {
      name: "una entidad operario que no está activa",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: AFTER_0475 + "update public.audit_entity_types set status = 'deprecated', deprecated_at = now() where entity_type = 'operario';\n",
      fails: "0480 abortado: falta la entidad de auditoría operario de 0475",
    },
    {
      name: "una sobrecarga de admin_update_operario",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: AFTER_0475 + "create function public.admin_update_operario(p_operario_id uuid) returns void language sql as $x$ select $x$;\n",
      fails: "0480 abortado: hay sobrecargas inesperadas de admin_update_operario u operario_roles_por_region",
    },
    {
      name: "una operario_roles_por_region que no puso 0480",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: AFTER_0475 + "create function public.operario_roles_por_region() returns jsonb language sql immutable as $x$ select '{}'::jsonb $x$;\n",
      fails: DRIFT(UPDATE),
    },
    {
      name: "anon con EXECUTE sobre admin_update_operario",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: AFTER_0475 + "grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to anon;\n",
      fails: "0480 abortado: EXECUTE de admin_update_operario no es el esperado",
    },
    {
      name: "una tercera región",
      file: CONTRACT_NAME,
      from: AFTER_0475,
      to: AFTER_0475 + "alter type operario_region add value 'co';\n",
      fails: "0480 abortado: falta operario_pins o el enum operario_region no es (cn, ve)",
    },
    {
      name: "un quinto rol en operario_pins_role_check",
      file: CONTRACT_NAME,
      from: "    check (role in ('operario', 'supervisor', 'bodeguero', 'camionero')),\n",
      to: "    check (role in ('operario', 'supervisor', 'bodeguero', 'camionero', 'chofer')),\n",
      fails: "0480 abortado: la constraint operario_pins_role_check de operario_pins no es la esperada",
    },
    {
      name: "sin la constraint de rol por región de 0025",
      file: CONTRACT_NAME,
      from: "alter table public.operario_pins\n  add constraint operario_pins_ve_role_requires_ve_region\n  check (\n    region = 've'\n    or role not in ('bodeguero', 'camionero')\n  );\n",
      to: "",
      fails: "0480 abortado: la constraint operario_pins_ve_role_requires_ve_region de operario_pins no es la esperada",
    },
    {
      name: "sin la constraint de almacén de China de 0023",
      file: CONTRACT_NAME,
      from: "  unique (warehouse_id, display_name),\n  constraint operario_pins_cn_requires_warehouse check (region <> 'cn' or warehouse_id is not null)\n",
      to: "  unique (warehouse_id, display_name)\n",
      fails: "0480 abortado: la constraint operario_pins_cn_requires_warehouse de operario_pins no es la esperada",
    },
    {
      name: "sin la constraint de modos de 0066",
      file: CONTRACT_NAME,
      from: "alter table public.operario_pins\n      add constraint operario_pins_roles_check\n      check (\n        roles <@ ARRAY['operario','supervisor','bodeguero','camionero']::text[]\n      );\n",
      to: "",
      fails: "0480 abortado: la constraint operario_pins_roles_check de operario_pins no es la esperada",
    },
  ];
  for (const p of PREFLIGHTS) {
    it(`preflight con ${p.name}: aborta sin cambiar nada`, async () => {
      const original = p.file === CONTRACT_NAME ? FILE_CONTRACT : mig(p.file);
      const result = await contract({ replace: { [p.file]: once(original, p.from, p.to) } });
      expect(result.error).toBe(p.fails);
    }, SLOW);
  }

  const GUARD =
    "  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n" +
    "    raise exception 'No tienes permiso para realizar esta acción'\n" +
    "      using errcode = '42501';\n" +
    "  end if;\n";
  const NOT_FOUND = "    raise exception 'Operario no encontrado' using errcode = 'P0014';\n  end if;\n";
  const AUDIT = (() => {
    const start = FILE_0480.indexOf("  -- AUD-01: el evento nace en esta transacción. Los nombres no se copian: basta el id.\n");
    const tail = "    raise exception 'No se pudo auditar la edición del operario' using errcode = 'P0001';\n  end if;\n";
    const end = FILE_0480.indexOf(tail, start) + tail.length;
    expect(start).toBeGreaterThan(0);
    return FILE_0480.slice(start, end);
  })();
  const NO_SAVE = (label: string, state = "ok", message = "") => `TEST 0480: ${label} (${state}: ${message})`;

  const MUTANTS: { name: string; changes: [string, string][]; fails: string }[] = [
    {
      name: "que acepta cualquier rol de los cuatro",
      changes: [["  if not coalesce((public.operario_roles_por_region() -> (v_op.region::text)) ? p_role, false) then",
        "  if p_role is null then"]],
      fails: NO_SAVE("China no acepta bodeguero", "23514",
        'new row for relation "operario_pins" violates check constraint "operario_pins_ve_role_requires_ve_region"'),
    },
    {
      name: "que ofrece «operario» también en Venezuela",
      changes: [['"ve": ["bodeguero", "camionero", "supervisor"]', '"ve": ["operario", "bodeguero", "camionero", "supervisor"]']],
      fails: "TEST 0480: operario_roles_por_region(): China operario y supervisor; Venezuela bodeguero, camionero y supervisor, en ese orden",
    },
    {
      name: "con «operario» por defecto si no llega rol",
      changes: [["begin\n  -- De primero, como alta", "begin\n  p_role := coalesce(nullif(p_role, ''), 'operario');\n  -- De primero, como alta"]],
      fails: NO_SAVE("sin rol no hay rol por defecto (China, donde «operario» sería válido)"),
    },
    {
      name: "que deja un almacén a uno de Venezuela",
      changes: [["  elsif p_warehouse_id is not null then\n    raise exception 'Los operarios de Venezuela no llevan almacén: son de despacho.' using errcode = 'P0023';\n", ""]],
      fails: NO_SAVE("Venezuela con almacén"),
    },
    {
      name: "que deja a uno de China sin almacén",
      changes: [["    if p_warehouse_id is null then\n      raise exception 'Elige el almacén de China del operario.' using errcode = 'P0023';\n    end if;\n", ""]],
      fails: NO_SAVE("China sin almacén", "P0023", "Ese almacén no existe o ya no está activo. Elige otro."),
    },
    {
      name: "que asigna un almacén desactivado",
      changes: [[" where w.id = p_warehouse_id and w.active)", " where w.id = p_warehouse_id)"]],
      fails: NO_SAVE("China con un almacén desactivado"),
    },
    {
      name: "que no deja conservar el almacén desactivado que ya tenía",
      changes: [["    if p_warehouse_id is distinct from v_op.warehouse_id\n       and not exists", "    if not exists"]],
      fails: NO_SAVE("uno de China conserva su almacén aunque se haya desactivado", "P0023",
        "Ese almacén no existe o ya no está activo. Elige otro."),
    },
    {
      name: "que cambia el rol y deja los modos como estaban",
      changes: [["    v_roles := array[p_role];", "    v_roles := v_op.roles;"]],
      fails: "TEST 0480: el rol y sus modos cambian juntos; sigue de Venezuela y sin almacén",
    },
    {
      name: "que pisa los modos de uno con varios",
      changes: [["  elsif p_role = any (v_modos) then\n    v_roles := v_op.roles;", "  elsif p_role = any (v_modos) then\n    v_roles := array[p_role];"]],
      fails: "TEST 0480: y los modos no cambian",
    },
    {
      name: "que acepta un rol fuera de los modos de uno con varios",
      changes: [["  elsif p_role = any (v_modos) then", "  elsif true then"]],
      fails: NO_SAVE("con dos modos, un rol fuera de ellos no"),
    },
    {
      name: "con el rol del Studio escrito a mano",
      changes: [[GUARD, "  perform public.assert_studio_role(array['admin', 'operations']);\n"]],
      fails: NO_SAVE("commercial con el desvío (ver y editar) edita", "42501", "No tienes permiso para realizar esta acción"),
    },
    {
      name: "con la matriz después de buscar el operario (oráculo de ids)",
      changes: [[GUARD, ""], [NOT_FOUND, NOT_FOUND + GUARD]],
      fails: "TEST 0480: sin permiso, un id que no existe también da 42501",
    },
    {
      name: "sin comprobar el tenant",
      changes: [["  perform public.assert_tenant_match(v_op.tenant_id);\n", ""]],
      fails: NO_SAVE("operations de otro tenant no edita un operario de A"),
    },
    {
      name: "sin evento",
      changes: [[AUDIT, ""]],
      fails: "TEST 0480: el cambio de rol deja un evento operario_updated con quién, antes, después y qué cambió",
    },
    {
      name: "que copia el nombre al evento",
      changes: [["    p_after_data => pg_catalog.jsonb_build_object('region', v_op.region, 'role', p_role,",
        "    p_after_data => pg_catalog.jsonb_build_object('nombre', v_nombre, 'region', v_op.region, 'role', p_role,"]],
      fails: "TEST 0480: el cambio de rol deja un evento operario_updated con quién, antes, después y qué cambió",
    },
    {
      name: "que deja pasar el motivo de otra operación al evento",
      changes: [["  perform pg_catalog.set_config('dtd.audit_reason', '', true);\n", ""]],
      fails: "TEST 0480: el cambio de rol deja un evento operario_updated con quién, antes, después y qué cambió",
    },
    {
      name: "que escribe y deja evento aunque nada cambie",
      changes: [["  if pg_catalog.cardinality(v_cambios) = 0 then\n    return;\n  end if;\n", ""]],
      fails: "TEST 0480: los guardados sin cambios de la matriz no dejaron evento",
    },
    {
      name: "que no traduce el nombre repetido",
      changes: [["  exception\n    when unique_violation then\n      raise exception 'Ya hay un operario con ese nombre en ese almacén.' using errcode = 'P0013';\n", ""]],
      fails: NO_SAVE("el nombre de otro operario del mismo almacén", "23505",
        'duplicate key value violates unique constraint "operario_pins_warehouse_id_display_name_key"'),
    },
    {
      name: "sin bloquear la fila",
      changes: [["   where op.id = p_operario_id\n     for update;", "   where op.id = p_operario_id;"]],
      fails: "TEST 0480: pero sí bloqueó la fila mientras comparaba",
    },
    {
      name: "con EXECUTE para anon",
      changes: [["grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to authenticated;",
        "grant execute on function public.admin_update_operario(uuid, text, text, text, uuid) to authenticated, anon;"]],
      fails: `0480: postflight — EXECUTE de ${UPDATE} no es el esperado`,
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(...m.changes) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});

describe("SDD-0536 · last_event elige el último guardado aunque la hora empate", () => {
  const CONTRACT_NAME = "0480_operarios_editar_por_region.test.sql";
  // La disposición infeliz, sin esperar a que el reloj la arme: desde el bloque 8
  // todo evento nace con la misma hora. Los dos guardados de cn-viejo empatan y el
  // viejo está primero en la tabla, como en el CI.
  const MODOS = "-- 8. Los modos de la app";
  const MISMA_HORA =
    "create function pg_temp.misma_hora() returns trigger language plpgsql as $x$\n" +
    "begin new.occurred_at := '2100-01-01 00:00:00+00'; return new; end;\n" +
    "$x$;\n" +
    "create trigger misma_hora before insert on public.entity_audit_log\n" +
    "  for each row execute function pg_temp.misma_hora();\n";
  const POR_XMIN = "  order by e.xmin::text::bigint desc limit 1\n";
  const POR_HORA = "  order by e.occurred_at desc limit 1\n";
  const empatado = (text: string) => once(text, MODOS, MISMA_HORA + MODOS);

  it("con los guardados del bloque 8 a la misma hora, el contrato sigue verde", async () => {
    const result = await contract({ replace: { [CONTRACT_NAME]: empatado(FILE_CONTRACT) } });
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0480 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: ordenando por hora, cae donde cayó el CI (run 38771102511)", async () => {
    const result = await contract({ replace: { [CONTRACT_NAME]: empatado(once(FILE_CONTRACT, POR_XMIN, POR_HORA)) } });
    expect(result.error).toBe("TEST 0480: le da el modo del rol nuevo");
  }, SLOW);

  it("control rojo de la premisa: dos ediciones en la misma subtransacción hacen caer el bloque 12", async () => {
    // Sin run_as en medio, los dos eventos nacen con el xid de la transacción.
    const PREMISA = "-- 12. La premisa de last_event";
    const mismoXmin =
      "do $mismo_xmin$\nbegin\n" +
      "  perform set_config('request.jwt.claim.sub', pg_temp.fixture_id('operations-A')::text, true);\n" +
      "  execute 'set local role authenticated';\n" +
      "  perform public.admin_update_operario(pg_temp.fixture_id('ve-quieto'), 'Quieto Uno', null, 'camionero', null);\n" +
      "  perform public.admin_update_operario(pg_temp.fixture_id('ve-quieto'), 'Quieto Dos', null, 'camionero', null);\n" +
      "  reset role;\n" +
      "end;\n$mismo_xmin$;\n";
    const result = await contract({ replace: { [CONTRACT_NAME]: once(FILE_CONTRACT, PREMISA, mismoXmin + PREMISA) } });
    expect(result.error).toBe(
      "TEST 0480: cada evento de edición nació en su propio guardado (xmin distinto): last_event no depende de la hora");
  }, SLOW);
});

// ─── Propiedad: la base decide igual que la app ──────────────────────────────

type Override = ModuleAccessOverride | null;
const OVERRIDES: Override[] = [null, { view: false, edit: false }, { view: true, edit: false }, { view: true, edit: true }];
const CASES: { role: StudioUserRole; override: Override }[] = STUDIO_USER_ROLES.flatMap((role) =>
  // 0357 no admite desvíos para admin (studio_role_module_overrides_role_check).
  (role === "admin" ? [null] : OVERRIDES).map((override) => ({ role, override })));
const label = ({ role, override }: { role: StudioUserRole; override: Override }) =>
  override ? `${role}:${override.view ? "v" : "-"}${override.edit ? "e" : "-"}` : `${role}:default`;

const USER = "20000000-0000-4000-8000-000000000529";
const TENANT = "10000000-0000-4000-8000-000000000529";

/** Doble de PostgREST que aplica `.eq()`/`.is()`, devuelve copias y conoce `.returns()`. */
function studioClient(role: StudioUserRole, override: Override) {
  const tables: Record<string, Record<string, unknown>[]> = {
    user_tenants: [{ user_id: USER, tenant_id: TENANT, role, disabled_at: null, warehouse_scope: "all" }],
    studio_role_module_overrides: override
      ? [{ role, module_id: "operarios", can_view: override.view, can_edit: override.edit }]
      : [],
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) },
    from(table: string) {
      const filters: [string, unknown][] = [];
      let selected = false;
      const rows = () => {
        if (!(table in tables)) throw new Error(`el gate no debe leer ${table}`);
        return tables[table].filter((row) => filters.every(([k, v]) => row[k] === v)).map((row) => ({ ...row }));
      };
      const builder = {
        select() { selected = true; return builder; },
        eq(k: string, v: unknown) { if (!selected) throw new Error(".eq() antes de .select()"); filters.push([k, v]); return builder; },
        is(k: string, v: unknown) { if (!selected) throw new Error(".is() antes de .select()"); filters.push([k, v]); return builder; },
        limit() { return builder; },
        async maybeSingle() { return { data: rows()[0] ?? null, error: null }; },
        returns() { return Promise.resolve({ data: rows(), error: null }); },
      };
      return builder;
    },
  } as unknown as Parameters<typeof moduleEditDenial>[0];
}

async function appEdit(role: StudioUserRole, override: Override): Promise<boolean> {
  const allowed = (await moduleEditDenial(studioClient(role, override), "operarios")) === null;
  const map = override ? { [`${role}:operarios`]: override } : {};
  expect(allowed).toBe(canEditModule(role, "operarios", map));
  return allowed;
}

async function openFixture(migration?: string) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(psql(CONTRACT, { fixture_only: "true" }, migration ? { [M0480]: migration } : {}));
  return db;
}

/** Los casos en que la base y la app no coinciden al editar, con la 0480 dada. */
async function editMismatches(db: PGlite): Promise<string[]> {
  const mismatches: string[] = [];
  for (const c of CASES) {
    const app = await appEdit(c.role, c.override);
    await db.exec("savepoint desvio");
    try {
      await db.query("select pg_temp.set_override($1::text, $2::boolean, $3::boolean)",
        [c.role, c.override?.view ?? null, c.override?.edit ?? null]);
      const result = await editAs(db, `${c.role}-A`, "cn-ana", "Ana China", "安娜", "operario", "wh-yiw");
      if (!result.ok && result.state !== "42501") throw new Error(`${label(c)}: ${result.state} ${result.message}`);
      if (result.ok !== app) mismatches.push(label(c));
    } finally {
      await db.exec("rollback to savepoint desvio");
    }
  }
  return mismatches;
}

/** Corre una edición como `user` dentro de un savepoint que se deshace; devuelve {ok, state}. */
async function editAs(db: PGlite, user: string, operario: string, name: string, nameCn: string | null,
  role: string, warehouse: string | null) {
  await db.exec("savepoint caso");
  try {
    const { rows } = await db.query<{ r: string }>(
      "select pg_temp.run_as('authenticated', $1::text, pg_temp.update_sql($2::text, $3::text, $4::text, $5::text, $6::text))::text as r",
      [user, operario, name, nameCn, role, warehouse]);
    return JSON.parse(rows[0].r) as { ok: boolean; state: string | null; message: string | null };
  } finally {
    await db.exec("rollback to savepoint caso");
  }
}

describe("SDD-0529 · propiedad: la base y moduleEditDenial deciden lo mismo al editar", () => {
  let db: PGlite;
  beforeAll(async () => { db = await openFixture(); }, SLOW);
  afterAll(async () => { await db?.close(); });

  it("para cada rol, sin desvío y con cada desvío, editar coincide", async () => {
    expect(await editMismatches(db)).toEqual([]);
    expect(CASES).toHaveLength(25);
  }, SLOW);

  it("con el candado de 0351 escrito a mano, fallan justo los casos donde la lista a mano y la matriz difieren", async () => {
    const hand = mutant([
      "  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n" +
      "    raise exception 'No tienes permiso para realizar esta acción'\n" +
      "      using errcode = '42501';\n" +
      "  end if;\n",
      "  perform public.assert_studio_role(array['admin', 'operations']);\n",
    ]);
    const handDb = await openFixture(hand);
    try {
      expect((await editMismatches(handDb)).sort()).toEqual([
        "accounting:ve", "commercial:ve", "marketing:ve", "operations:--", "operations:v-", "warehouse:ve",
      ]);
    } finally {
      await handDb.close();
    }
  }, SLOW);

  it("los casos cubren las dos direcciones del desvío", async () => {
    expect(await appEdit("commercial", null)).toBe(false);
    expect(await appEdit("commercial", { view: true, edit: true })).toBe(true);
    expect(await appEdit("operations", null)).toBe(true);
    expect(await appEdit("operations", { view: true, edit: false })).toBe(false);
    expect(await appEdit("support", { view: true, edit: true })).toBe(false);
  });
});

// ─── La app y la base: el cajón ofrece exactamente lo que la RPC acepta ──────

describe("SDD-0529 · el cajón ofrece los roles que la base acepta, y sólo esos", () => {
  let db: PGlite;
  beforeAll(async () => { db = await openFixture(); }, SLOW);
  afterAll(async () => { await db?.close(); });

  it("lo que devuelve operario_roles_por_region() para el Studio pasa la validación de la app", async () => {
    await db.exec("savepoint leer; set local role authenticated");
    const { rows } = await db.query<{ roles: unknown }>("select public.operario_roles_por_region() as roles");
    await db.exec("rollback to savepoint leer");
    expect(parseOperarioRolesPorRegion(rows[0].roles)).toEqual({
      cn: ["operario", "supervisor"],
      ve: ["bodeguero", "camionero", "supervisor"],
    });
  }, SLOW);

  it("para cada región y cada rol, el cajón lo ofrece si y sólo si admin_update_operario lo acepta", async () => {
    const { rows } = await db.query<{ roles: unknown }>("select public.operario_roles_por_region() as roles");
    const roles = parseOperarioRolesPorRegion(rows[0].roles);
    expect(roles).not.toBeNull();
    // Un operario de un solo modo por región: Carla (bodeguera de Venezuela) y Bruno (supervisor de China).
    const fixture: Record<OperarioRegion, { label: string; name: string; warehouse: string | null; role: OperarioRol }> = {
      cn: { label: "cn-bruno", name: "Bruno Supervisor", warehouse: "wh-yiw", role: "supervisor" },
      ve: { label: "ve-carla", name: "Carla Bodega", warehouse: null, role: "bodeguero" },
    };
    const mismatches: string[] = [];
    for (const region of ["cn", "ve"] as const) {
      const op = fixture[region];
      const { opciones, actualValido } = operarioRolOpciones(roles, region, op.role);
      expect(actualValido).toBe(true);
      for (const role of ["operario", "supervisor", "bodeguero", "camionero"] as const) {
        const result = await editAs(db, "operations-A", op.label, op.name, null, role, op.warehouse);
        if (!result.ok && result.state !== "P0012") throw new Error(`${region}:${role}: ${result.state} ${result.message}`);
        if (result.ok !== opciones.includes(role)) mismatches.push(`${region}:${role} base=${result.ok} cajón=${opciones.includes(role)}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, SLOW);
});
