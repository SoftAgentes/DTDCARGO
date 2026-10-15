// @vitest-environment node
/**
 * SDD-0515 · La migración 0475 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0475_pin_operarios_endurecer.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato con los `.sql` reales inlineados: lo que se prueba es el texto
 * que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0475 el contrato cae en su primera aserción (pin_hash
 * legible por authenticated). PREFLIGHT: un ANTES con drift aborta sin cambiar
 * nada. MUTANTES: cada uno es una 0475 coherente (con el md5 de sus propios
 * cuerpos en el preflight y el postflight) y cae en la aserción de la regla que
 * rompe.
 *
 * PROPIEDAD: para cada rol del Studio, sin desvío y con cada desvío posible de
 * 0357, la base (la policy, el helper, las dos RPC de escritura y «Ver PIN»)
 * decide lo mismo que `moduleViewDenial`/`moduleEditDenial` de rbac-guard.ts,
 * que es lo que usa la app. Y el mutante que vuelve al rol escrito a mano rompe
 * exactamente los casos donde la matriz y la lista a mano no coinciden.
 *
 * TEXTO: las copias verbatim del contrato siguen iguales a sus archivos; 0475
 * se reescribió desde la última definición de cada función (0351 y 0037) sin
 * perder más líneas que las que cambia a propósito; y el default
 * `['operations']` duplicado en SQL es el de ROLE_MODULE_ACCESS.operarios
 * (rbac.test.ts es la fuente).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  LOCKED_MODULES,
  ROLE_MODULE_ACCESS,
  SUPERADMIN_ONLY_MODULES,
  WAREHOUSE_SCOPED_MODULES,
  canAccessModule,
  canEditModule,
  type ModuleAccessOverride,
} from "@/lib/studio/rbac";
import { STUDIO_USER_ROLES, type StudioUserRole } from "@/lib/studio/user-types";
import { OPERARIO_MOTIVOS, OPERARIO_MOTIVO_MESSAGE, operarioMotivoProblem } from "@/lib/studio/operario-pin";

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
const { moduleEditDenial, moduleViewDenial } = await import("@/lib/studio/rbac-guard");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const CONTRACT = resolve(ROOT, "supabase/tests/0475_pin_operarios_endurecer.test.sql");
const M0475 = "0475_pin_operarios_endurecer.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const mig = (name: string) => read(resolve(MIGRATIONS, name));
const FILE_0475 = mig(M0475);
const FILE_CONTRACT = read(CONTRACT);
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const DECLARATIONS = JSON.parse(read(resolve(ROOT, "supabase/pending-migration-symbol-declarations.json"))) as {
  degradations: { migration: string }[];
};
const SLOW = 240_000;

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
  if (options.migration) replace[M0475] = options.migration;
  const sql = psql(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replace);
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0475 GREEN"));
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

const FUNCTIONS = [
  "admin_create_operario",
  "admin_reset_operario_pin",
  "admin_set_operario_active",
  "validate_operario_pin_format",
  "admin_ver_operario_pin",
  "operarios_module_authorized",
  "operario_pin_assert_available",
  "operario_pin_cifrar",
  "operario_pin_descifrar",
  "operario_motivo_valido",
  "operario_password_reciente",
] as const;

/**
 * El prosrc VIVO de validate_operario_pin_format en producción (md5
 * 2c22a7b2b639e69464ced0e77173bbaf, leído por el Director el 2026-10-14
 * 20:05:15Z), reconstruido a partir de sus diferencias con 0037 hasta dar ese
 * md5 exacto: sin «+ patrones» en el comentario, sin subcomentarios, sin '0987'
 * y con '7777' dos veces. Es el ANTES real del validador en producción.
 */
const LIVE_VALIDATOR_BODY = [
  "",
  "begin",
  "  -- Format: exactamente 4 dígitos numéricos",
  "  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\\d{4}$' then",
  "    raise exception 'PIN debe ser 4 dígitos numéricos' using errcode = 'P0010';",
  "  end if;",
  "",
  "  -- Blacklist: PINs débiles más comunes (top 10 + secuenciales obvios)",
  "  if p_pin in (",
  "    '0000', '1111', '2222', '3333', '4444',",
  "    '5555', '6666', '7777', '8888', '9999',",
  "    '1234', '4321', '0123', '1212', '2121',",
  "    '0101', '1010', '1313', '6969', '7777',",
  "    '2580', '1357', '2468', '1379'",
  "  ) then",
  "    raise exception 'PIN demasiado común. Elegí uno menos predecible.'",
  "      using errcode = 'P0010';",
  "  end if;",
  "end;",
  "",
].join("\n");
const LIVE_VALIDATOR_MD5 = "2c22a7b2b639e69464ced0e77173bbaf";

/** 0475 con cambios y el md5 de cada cuerpo que cambió en lugar del suyo. */
function mutant(...changes: [string, string][]): string {
  let text = FILE_0475;
  for (const [from, to] of changes) text = once(text, from, to);
  for (const name of FUNCTIONS) {
    const before = bodyMd5(FILE_0475, name);
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

describe("SDD-0515 · 0475 (texto)", () => {
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
    expect(FILE_CONTRACT).toContain(statement(mig("0023_operario_region.sql"), "create type operario_region"));
    expect(FILE_CONTRACT).toContain(statement(mig("0210_pin_search_path_triggers.sql"),
      "alter function public.validate_operario_pin_format("));
  });

  it("el preflight espera el md5 de la última definición de cada función, y el de 0475", () => {
    const expected: [string, string][] = [
      [bodyMd5(mig("0351_operario_rpc_exige_rol.sql"), "admin_create_operario"), "0351"],
      [bodyMd5(mig("0351_operario_rpc_exige_rol.sql"), "admin_reset_operario_pin"), "0351"],
      [bodyMd5(mig("0351_operario_rpc_exige_rol.sql"), "admin_set_operario_active"), "0351"],
      [bodyMd5(mig("0037_harden_operario_pin_validator.sql"), "validate_operario_pin_format"), "0037"],
      [bodyMd5(mig("0453_portal_helpers_principal_determinista.sql"), "get_user_tenant_id"), "0453"],
      [bodyMd5(mig("0012_rls_perf_and_rpc_guards.sql"), "assert_tenant_match"), "0012"],
      [bodyMd5(mig("0325_operario_pin_login_hardening.sql"), "verify_operario_pin", "create function"), "0325"],
    ];
    for (const [hash, origin] of expected) {
      expect(FILE_0475.split(`'${hash}'`), `md5 de ${origin} en el preflight`).toHaveLength(2);
    }
    // Las diez de 0475: una vez en el preflight y otra en el postflight.
    for (const name of FUNCTIONS) {
      expect(FILE_0475.split(`'${bodyMd5(FILE_0475, name)}'`), `md5 de ${name}`).toHaveLength(3);
    }
    // 0453 es la del preflight de 0456, medida en producción.
    expect(bodyMd5(mig("0453_portal_helpers_principal_determinista.sql"), "get_user_tenant_id"))
      .toBe("5ff0c51c26a49419c34abc78f1d95c37");
    // El validador vivo: la reconstrucción da el md5 que se leyó en producción,
    // y el preflight lo acepta junto al del repo.
    expect(md5(LIVE_VALIDATOR_BODY)).toBe(LIVE_VALIDATOR_MD5);
    expect(FILE_0475.split(`'${LIVE_VALIDATOR_MD5}'`)).toHaveLength(2);
  });

  it("el cuerpo vivo del validador es el drift descrito: sin '0987' y con '7777' dos veces", () => {
    const repo = prosrc(block(mig("0037_harden_operario_pin_validator.sql"), "validate_operario_pin_format"));
    const pins = (body: string) => [...body.matchAll(/'(\d{4})'/g)].map((m) => m[1]);
    const live = pins(LIVE_VALIDATOR_BODY);
    expect(live).toHaveLength(24);
    expect(new Set(live).size).toBe(23);
    expect(live.filter((pin) => pin === "7777")).toHaveLength(2);
    expect(live).not.toContain("0987");
    expect(new Set(pins(repo))).toEqual(new Set([...new Set(live), "0987"]));
    // 0475 instala la lista del repo, que es la que espeja operario-pin.ts.
    expect(new Set(pins(prosrc(block(FILE_0475, "validate_operario_pin_format"))))).toEqual(new Set(pins(repo)));
  });

  it("las RPC se reescribieron desde 0351 sin perder más líneas que las que cambian a propósito", () => {
    const file0351 = mig("0351_operario_rpc_exige_rol.sql");
    const GUARD = "  perform public.assert_studio_role(array['admin', 'operations']);";
    // Cada línea de 0351 que falta en 0475 está acá con su motivo; cualquier
    // otra que se pierda rompe la prueba.
    const replaced: Record<string, string[]> = {
      admin_create_operario: [
        "  p_role text", // ahora `p_role text,` + p_motivo
        GUARD, // la matriz
        "    tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role", // + pin_cifrado
        "    p_role", // `p_role,` + el PIN cifrado
        "  returning id into v_id;", // + la región, para el PIN libre
      ],
      admin_reset_operario_pin: [
        "  p_pin text", // ahora `p_pin text,` + p_motivo y p_reactivar
        GUARD, // la matriz
        "  select op.tenant_id into v_tenant_id", // + región y estado
        "     set pin_hash = crypt(p_pin, gen_salt('bf'))", // + PIN cifrado y reactivación
      ],
      admin_set_operario_active: [
        "  select op.tenant_id into v_tenant_id", // + el estado, para no reactivar sin PIN
      ],
    };
    for (const [name, gone] of Object.entries(replaced)) {
      const old = block(file0351, name);
      const now = block(FILE_0475, name);
      expect(missingLines(now, old), name).toEqual(gone);
    }
    for (const name of ["admin_create_operario", "admin_reset_operario_pin"]) {
      const now = block(FILE_0475, name);
      expect(now, `${name} sin rol a mano`).not.toContain("assert_studio_role");
      expect(now).toContain("  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then");
      expect(now).toContain("public.operario_motivo_valido(p_motivo, p_motivo_texto, p_pin)");
      expect(now).toContain("perform public.operario_pin_assert_available(");
      expect(now).toContain("public.operario_pin_cifrar(p_pin)");
      expect(now).toContain("v_event := public.append_audit_event(");
      expect(now).toContain("    p_reason => v_motivo,");
    }
    // Activar/desactivar conserva su candado a mano: la matriz va en otra SDD.
    expect(block(FILE_0475, "admin_set_operario_active")).toContain(GUARD);
    // La firma vieja se quita antes de crear la nueva: si no, quedaría una
    // sobrecarga sin motivo.
    expect(FILE_0475).toContain("drop function if exists public.admin_create_operario(uuid, uuid, text, text, text, text);");
    expect(FILE_0475).toContain("drop function if exists public.admin_reset_operario_pin(uuid, text);");
  });

  it("el validador es 0037 con «Elige» y nada más, y 0475 es su última definición", () => {
    const old = block(mig("0037_harden_operario_pin_validator.sql"), "validate_operario_pin_format");
    const now = block(FILE_0475, "validate_operario_pin_format");
    // El único cambio de cuerpo es «Elegí» → «Elige»; la cabecera suma el
    // search_path que 0210 le puso con ALTER (create or replace lo borraría).
    const expected = once(once(old, "Elegí uno", "Elige uno"),
      "immutable\nas $func$", "immutable\nset search_path = public\nas $func$");
    expect(now).toBe(expected);
    // La extracción de operario-pin.migration.test.ts (SDD-0513) toma la
    // última definición por archivo: tiene que aparecer una sola vez aquí.
    expect(FILE_0475.split("create or replace function public.validate_operario_pin_format")).toHaveLength(2);
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
    for (const name of ["admin_create_operario", "admin_reset_operario_pin", "admin_set_operario_active",
      "validate_operario_pin_format", "admin_ver_operario_pin"]) {
      const last = files.filter((file) => mig(file).includes(`create or replace function public.${name}(`)).at(-1);
      expect(last, name).toBe(M0475);
    }
    // La cabecera cita «Elegí» para describir el defecto; el código no lo dice.
    expect(now).not.toContain("Elegí");
    expect(FILE_0475.split("Elegí")).toHaveLength(2);
  });

  it("el default duplicado en SQL es ROLE_MODULE_ACCESS.operarios, y la regla no necesita otra", () => {
    const helper = block(FILE_0475, "operarios_module_authorized");
    const match = helper.match(/select 'operarios'::text as module_id, array\[([^\]]*)\]::text\[\] as default_roles/);
    expect(match).not.toBeNull();
    const sqlDefaults = [...match![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(sqlDefaults).toEqual([...ROLE_MODULE_ACCESS.operarios]);
    // Premisas para que el helper sea la misma regla que moduleEditDenial:
    // sin candado de gobernanza, sin lado de almacén y sin superadmin.
    expect(LOCKED_MODULES.has("operarios")).toBe(false);
    expect("operarios" in WAREHOUSE_SCOPED_MODULES).toBe(false);
    expect(SUPERADMIN_ONLY_MODULES.has("operarios")).toBe(false);
  });

  it("aplicada al servidor propio el 2026-10-14: ya no es una espera y el archivo no se tocó", () => {
    // Aplicada el 2026-10-14 a las 23:32:24Z en el servidor propio, con OK nominal
    // de Sam. El ledger (20261014233224) guarda el archivo entero, con md5
    // 1273d8a4… y 61685 bytes: editar el archivo, aunque sea la cabecera
    // «NO APLICADA», rompería esa identidad. Lo que cambia es el baseline, y la
    // declaración de «Ver PIN» sale del gate de símbolos pendientes.
    expect(BASELINE.pendingBelowCutoff["0475_pin_operarios_endurecer"]).toBeUndefined();
    expect(md5(FILE_0475)).toBe("1273d8a483ccc504e296befe53a6bcac");
    expect(Buffer.byteLength(FILE_0475)).toBe(61685);
    expect(DECLARATIONS.degradations.some((d) => d.migration === "0475_pin_operarios_endurecer")).toBe(false);
  });
});

describe("SDD-0515 · 0475 (PGlite)", () => {
  it("el contrato pasa con 0475 aplicada dos veces", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0475 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin 0475 cae en la primera aserción, pin_hash legible", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0475: authenticated no tiene SELECT sobre pin_hash");
  }, SLOW);

  const PREFLIGHTS: { name: string; file: string; from: string; to: string; fails: string }[] = [
    {
      name: "admin_reset_operario_pin con un espacio de más",
      file: "0351_operario_rpc_exige_rol.sql",
      from: "   where id = p_operario_id;\nend;\n$$;\n\n-- ── 3/4",
      to: "   where id = p_operario_id;\n end;\n$$;\n\n-- ── 3/4",
      fails: "0475 abortado: public.admin_reset_operario_pin(uuid,text) tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)",
    },
    {
      name: "un login distinto del de 0325",
      file: "0325_operario_pin_login_hardening.sql",
      from: "  if v_recent_failures >= 10 then return; end if;",
      to: "  if v_recent_failures >= 100 then return; end if;",
      fails: "0475 abortado: public.verify_operario_pin(text,uuid,public.operario_region,text) tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)",
    },
    {
      name: "una policy de más en operario_pins",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "alter table public.operario_pins enable row level security;\n",
      to: "alter table public.operario_pins enable row level security;\ncreate policy abierta on public.operario_pins for select to authenticated using (true);\n",
      fails: "0475 abortado: operario_pins no tiene exactamente una policy",
    },
    {
      name: "una columna que no se revisó",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "  roles text[] not null default '{}',\n",
      to: "  roles text[] not null default '{}',\n  pin_recovery text,\n",
      fails: "0475 abortado: operario_pins no tiene exactamente sus columnas ({active,created_at,display_name,display_name_cn,id,last_login_at,pin_hash,pin_recovery,region,role,roles,tenant_id,tms_driver_id,updated_at,warehouse_id})",
    },
    {
      name: "una columna pin_cifrado que no puso 0475",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "  roles text[] not null default '{}',\n",
      to: "  roles text[] not null default '{}',\n  pin_cifrado bytea,\n",
      fails: "0475 abortado: operario_pins no tiene exactamente sus columnas ({active,created_at,display_name,display_name_cn,id,last_login_at,pin_cifrado,pin_hash,region,role,roles,tenant_id,tms_driver_id,updated_at,warehouse_id})",
    },
    {
      name: "una base sin Vault",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "  if to_regclass('vault.secrets') is null then\n",
      to: "  if false then\n",
      fails: "0475 abortado: falta Vault (vault.create_secret y vault.decrypted_secrets)",
    },
    {
      name: "una clave operario_pin_key que no creó 0475",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\n",
      to: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\nselect vault.create_secret(repeat('k', 44), 'operario_pin_key', 'de otro lado');\n",
      fails: "0475 abortado: la clave operario_pin_key de Vault ya existe sin venir de 0475, o falta al re-aplicar",
    },
    {
      name: "una sobrecarga de la RPC de restablecer",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\n",
      to: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\ncreate function public.admin_reset_operario_pin(p_operario_id uuid) returns void language sql as $x$ select $x$;\n",
      fails: "0475 abortado: hay sobrecargas inesperadas de las RPC de operario",
    },
    {
      name: "admin_set_operario_active distinto del de 0351",
      file: "0351_operario_rpc_exige_rol.sql",
      from: "  update public.operario_pins\n     set active = p_active\n   where id = p_operario_id;",
      to: "  update public.operario_pins\n     set active = coalesce(p_active, true)\n   where id = p_operario_id;",
      fails: "0475 abortado: public.admin_set_operario_active(uuid,boolean) tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)",
    },
    {
      name: "RLS forzada",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "alter table public.operario_pins enable row level security;\n",
      to: "alter table public.operario_pins enable row level security;\nalter table public.operario_pins force row level security;\n",
      fails: "0475 abortado: public.operario_pins no existe o su RLS no es la esperada",
    },
    {
      name: "la entidad operario ya registrada con otro dominio",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\n",
      to: "\\ir ../migrations/0294_audit_d2_human_reasons.sql\ninsert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref) values ('operario', 'active', 'operations', 1, 'migration:9999');\n",
      fails: "0475 abortado: el tipo de auditoría operario ya existe con otra forma; revisar su procedencia",
    },
    {
      name: "anon con SELECT sobre operario_pins",
      file: "0475_pin_operarios_endurecer.test.sql",
      from: "alter table public.operario_pins enable row level security;\n",
      to: "alter table public.operario_pins enable row level security;\ngrant select (id) on public.operario_pins to anon;\n",
      fails: "0475 abortado: la ACL de operario_pins no es la esperada",
    },
  ];
  for (const p of PREFLIGHTS) {
    it(`preflight con ${p.name}: aborta sin cambiar nada`, async () => {
      const original = p.file === "0475_pin_operarios_endurecer.test.sql" ? FILE_CONTRACT : mig(p.file);
      const result = await contract({ replace: { [p.file]: once(original, p.from, p.to) } });
      expect(result.error).toBe(p.fails);
    }, SLOW);
  }

  // El validador vivo en producción no es el del repo (drift del 2026-10-14):
  // el contrato corre con 0037 cambiado por el cuerpo vivo exacto.
  const FILE_0037 = mig("0037_harden_operario_pin_validator.sql");
  const REPO_VALIDATOR_BODY = prosrc(block(FILE_0037, "validate_operario_pin_format"));

  it("preflight con el validador VIVO de producción: lo acepta y 0475 instala el del repo", async () => {
    const result = await contract({
      replace: { "0037_harden_operario_pin_validator.sql": once(FILE_0037, REPO_VALIDATOR_BODY, LIVE_VALIDATOR_BODY) },
    });
    expect(result.error).toBeNull();
    // El contrato exige después de 0475 los 24 comunes del repo, con '0987'.
    expect(result.green).toMatch(/^TEST 0475 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("preflight con un tercer cuerpo del validador (el vivo sin '1379'): aborta", async () => {
    const third = once(LIVE_VALIDATOR_BODY, ",\n    '2580', '1357', '2468', '1379'\n", ",\n    '2580', '1357', '2468'\n");
    expect(md5(third)).not.toBe(LIVE_VALIDATOR_MD5);
    const result = await contract({
      replace: { "0037_harden_operario_pin_validator.sql": once(FILE_0037, REPO_VALIDATOR_BODY, third) },
    });
    expect(result.error).toBe(
      "0475 abortado: public.validate_operario_pin_format(text) tiene drift (md5 de prosrc, DEFINER, volatilidad o search_path)",
    );
  }, SLOW);

  const GUARD_RESET =
    "  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n" +
    "    raise exception 'No tienes permiso para realizar esta acción'\n" +
    "      using errcode = '42501';\n" +
    "  end if;\n\n  select op.tenant_id, op.region";
  const GUARD_CREATE =
    "  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n" +
    "    raise exception 'No tienes permiso para realizar esta acción'\n" +
    "      using errcode = '42501';\n" +
    "  end if;\n  perform public.assert_tenant_match(p_tenant_id);";
  const HAND_RESET = "  perform public.assert_studio_role(array['admin', 'operations']);\n\n  select op.tenant_id, op.region";
  const HAND_CREATE = "  perform public.assert_studio_role(array['admin', 'operations']);\n  perform public.assert_tenant_match(p_tenant_id);";
  const POLICY_MATRIX = "    and (select public.operarios_module_authorized((select public.get_user_tenant_id()), 'view'))\n";
  const POLICY_EXPECTED = "ANDSELECToperarios_module_authorizedSELECTget_user_tenant_idASget_user_tenant_id,''view''::textASoperarios_module_authorized";
  const RESET_AUDIT_START = "  -- AUD-01: el evento nace en esta transacción y sin el PIN ni el hash.\n  perform pg_catalog.set_config('dtd.audit_reason', '', true);\n  v_event := public.append_audit_event(\n    p_tenant_id => v_tenant_id,";
  const resetAudit = (() => {
    const start = FILE_0475.indexOf(RESET_AUDIT_START);
    const end = FILE_0475.indexOf("  end if;\nend;\n$$;", start) + "  end if;\n".length;
    return FILE_0475.slice(start, end);
  })();
  const CREATE_AUDIT_START = "  -- AUD-01: el evento nace en esta transacción y sin el PIN ni el hash.\n  perform pg_catalog.set_config('dtd.audit_reason', '', true);\n  v_event := public.append_audit_event(\n    p_tenant_id => p_tenant_id,";
  const createAudit = (() => {
    const start = FILE_0475.indexOf(CREATE_AUDIT_START);
    const end = FILE_0475.indexOf("  return v_id;", start);
    return FILE_0475.slice(start, end);
  })();
  const VER_AUDIT_START = "  -- AUD-01 / AUD-02: quién, a qué operario, el motivo y si había PIN; nunca el PIN.\n";
  const verAudit = (() => {
    const start = FILE_0475.indexOf(VER_AUDIT_START);
    const end = FILE_0475.indexOf("  return v_pin;", start);
    return FILE_0475.slice(start, end);
  })();
  const POSTFLIGHT_FUNCTION = (signature: string) =>
    `0475: postflight — ${signature} no quedó con el cuerpo, DEFINER, volatilidad o search_path de 0475`;

  const MUTANTS: { name: string; changes: [string, string][]; fails: string }[] = [
    {
      name: "que restablece con el rol escrito a mano",
      changes: [[GUARD_RESET, HAND_RESET]],
      fails: "TEST 0475: operations con el desvío (ver sí, editar no) no restablece",
    },
    {
      name: "que crea con el rol escrito a mano",
      changes: [[GUARD_CREATE, HAND_CREATE]],
      fails: "TEST 0475: operations con el desvío (ver sí, editar no) no crea operarios",
    },
    {
      name: "con el candado de rol después de buscar el operario (oráculo de ids)",
      changes: [
        [GUARD_RESET, "  select op.tenant_id, op.region"],
        ["    raise exception 'Operario no encontrado' using errcode = 'P0014';\n  end if;\n\n  perform public.assert_tenant_match(v_tenant_id);",
          "    raise exception 'Operario no encontrado' using errcode = 'P0014';\n  end if;\n  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n    raise exception 'No tienes permiso para realizar esta acción'\n      using errcode = '42501';\n  end if;\n\n  perform public.assert_tenant_match(v_tenant_id);"],
      ],
      fails: "TEST 0475: sin permiso, un id inexistente también da 42501",
    },
    {
      name: "cuyo helper ignora los desvíos de vista",
      changes: [["        coalesce(d.can_view, d.role = any(d.default_roles))", "        d.role = any(d.default_roles)"]],
      fails: "TEST 0475: un desvío que le da la vista a commercial la abre",
    },
    {
      name: "cuyo helper ignora los desvíos de edición",
      changes: [["        and coalesce(d.can_edit, d.role = any(d.default_roles))", "        and d.role = any(d.default_roles)"]],
      fails: "TEST 0475: operations con el desvío (ver sí, editar no) no restablece",
    },
    {
      name: "que deja editar a support",
      changes: [["        d.role <> 'support'\n        and coalesce(d.can_edit", "        coalesce(d.can_edit"]],
      fails: "TEST 0475: support no edita ni con un desvío que lo permita",
    },
    {
      name: "sin la excepción de admin",
      changes: [["      when d.role = 'admin' then true\n", ""]],
      fails: "TEST 0475: admin ve los operarios de su tenant",
    },
    {
      name: "cuyo helper cuenta membresías desactivadas",
      changes: [["      and ut.tenant_id = p_tenant_id\n      and ut.disabled_at is null\n", "      and ut.tenant_id = p_tenant_id\n"]],
      fails: "TEST 0475: el helper no autoriza una membresía desactivada aunque se nombre su tenant",
    },
    {
      name: "con la policy sin la matriz (y el preflight y el postflight a tono)",
      changes: [
        [POLICY_MATRIX, ""],
        [POLICY_EXPECTED + "')\n     ) then", "')\n     ) then"],
        [POLICY_EXPECTED + "') then\n    raise exception '0475: postflight", "') then\n    raise exception '0475: postflight"],
      ],
      fails: "TEST 0475: commercial no ve los operarios por default",
    },
    {
      name: "con la policy sin la matriz",
      changes: [[POLICY_MATRIX, ""]],
      fails: "0475: postflight — la policy de operario_pins no es la de 0475",
    },
    {
      name: "que concede pin_hash por columna",
      changes: [["grant select (id, tenant_id, warehouse_id,", "grant select (id, tenant_id, pin_hash, warehouse_id,"]],
      fails: "0475: postflight — pin_hash sigue legible o escribible desde la API",
    },
    {
      name: "que concede pin_cifrado por columna",
      changes: [["grant select (id, tenant_id, warehouse_id,", "grant select (id, tenant_id, pin_cifrado, warehouse_id,"]],
      fails: "0475: postflight — pin_cifrado sigue legible o escribible desde la API",
    },
    {
      name: "que deja a service_role escribir el PIN cifrado",
      changes: [["grant update (warehouse_id, region,", "grant update (pin_cifrado, warehouse_id, region,"]],
      fails: "0475: postflight — pin_cifrado sigue legible o escribible desde la API",
    },
    {
      name: "que sólo revoca el SELECT de authenticated",
      changes: [["revoke select, insert, update on table public.operario_pins from authenticated, service_role;", "revoke select, insert, update on table public.operario_pins from authenticated;"]],
      fails: "0475: postflight — pin_hash sigue legible o escribible desde la API",
    },
    {
      name: "que le deja a service_role el INSERT de tabla",
      changes: [["revoke select, insert, update on table public.operario_pins from authenticated, service_role;", "revoke select, update on table public.operario_pins from authenticated, service_role;"]],
      fails: "0475: postflight — pin_hash sigue legible o escribible desde la API",
    },
    {
      name: "cuyo chequeo de repetidos ignora la región",
      changes: [["      and op.region = p_region\n", ""]],
      fails: "TEST 0475: el mismo PIN en otra región del tenant se acepta",
    },
    {
      name: "cuyo chequeo de repetidos ignora el tenant",
      changes: [["    where op.tenant_id = p_tenant_id\n      and op.region = p_region", "    where op.region = p_region"]],
      fails: "TEST 0475: el mismo PIN en otro tenant se acepta",
    },
    {
      name: "cuyo chequeo de repetidos cuenta a los dados de baja",
      changes: [["      and op.active\n", ""]],
      fails: "TEST 0475: el PIN de un operario dado de baja no bloquea",
    },
    {
      name: "cuyo chequeo de repetidos no excluye al propio operario",
      changes: [["      and op.id is distinct from p_except_id\n", ""]],
      fails: "TEST 0475: un operario puede volver a su propio PIN",
    },
    {
      name: "sin el lock de (tenant, región)",
      changes: [["  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(\n    'operario_pin:' || p_tenant_id::text || ':' || p_region::text, 0));\n", ""]],
      fails: "TEST 0475: el restablecimiento toma el lock de (tenant, región) hasta el COMMIT",
    },
    {
      name: "cuya alta no chequea el PIN libre",
      changes: [["  perform public.operario_pin_assert_available(p_tenant_id, v_region, p_pin, v_id);\n", ""]],
      fails: "TEST 0475: el alta con el PIN de otro operario activo se rechaza",
    },
    {
      name: "cuyo restablecimiento no audita",
      changes: [[resetAudit, ""]],
      fails: "TEST 0475: queda un solo evento del restablecimiento",
    },
    {
      name: "que guarda el PIN en la auditoría",
      changes: [["'region', v_region,\n      'active', v_active or v_reactivado, 'recoverable', true),",
        "'region', v_region,\n      'active', v_active or v_reactivado, 'recoverable', true, 'value', p_pin),"]],
      fails: "TEST 0475: el before/after es el estado y la credencial rotada",
    },
    {
      name: "cuyo restablecimiento no pide motivo",
      changes: [["  v_motivo := public.operario_motivo_valido(p_motivo, p_motivo_texto, p_pin);\n  perform public.operario_pin_assert_available(v_tenant_id",
        "  v_motivo := coalesce(p_motivo, 'sin motivo declarado');\n  perform public.operario_pin_assert_available(v_tenant_id"]],
      fails: "TEST 0475: restablecer sin motivo se rechaza con P0020",
    },
    {
      name: "cuyo motivo acepta cualquier código",
      changes: [["  if v_codigo not in ('olvido', 'empleado_nuevo', 'revision_seguridad', 'otro') then\n    raise exception 'Elige un motivo de la lista.' using errcode = 'P0020';\n  end if;\n", ""]],
      fails: "TEST 0475: restablecer sin motivo se rechaza con P0020",
    },
    {
      name: "cuya lista de motivos gana un código",
      changes: [["  if v_codigo not in ('olvido', 'empleado_nuevo', 'revision_seguridad', 'otro') then",
        "  if v_codigo not in ('olvido', 'empleado_nuevo', 'revision_seguridad', 'otro', 'inventado') then"]],
      fails: "TEST 0475: restablecer con un código que no está en la lista se rechaza con P0020",
    },
    {
      name: "cuyo motivo puede llevar el PIN",
      changes: [["  if p_pin is not null and pg_catalog.strpos(v_texto, p_pin) > 0 then\n    raise exception 'No escribas el PIN en el motivo: queda en la auditoría.' using errcode = 'P0020';\n  end if;\n", ""]],
      fails: "TEST 0475: restablecer con el PIN en el texto de «Otro» se rechaza con P0020",
    },
    {
      name: "cuyo texto de «Otro» no tiene tope",
      changes: [["pg_catalog.char_length(v_texto) > 200 then", "pg_catalog.char_length(v_texto) > 2000 then"]],
      fails: "TEST 0475: restablecer con «Otro» de 201 letras se rechaza con P0020",
    },
    {
      name: "que guarda el texto de un código fijo",
      changes: [["  if v_codigo <> 'otro' then\n    return v_codigo;\n  end if;\n", "  if v_codigo <> 'otro' and v_texto = '' then\n    return v_codigo;\n  end if;\n"]],
      fails: "TEST 0475: con un código fijo la auditoría guarda sólo el código, no el texto",
    },
    {
      name: "cuyo «Ver PIN» no pide la contraseña",
      changes: [["  if not public.operario_password_reciente() then\n    raise exception 'Confirma tu contraseña para ver el PIN.'\n      using errcode = 'P0022';\n  end if;\n", ""]],
      fails: "TEST 0475: «Ver PIN» sin amr se rechaza con P0022",
    },
    {
      name: "cuya contraseña vale una hora",
      changes: [["::bigint - 300\n", "::bigint - 3600\n"]],
      fails: "TEST 0475: «Ver PIN» con la contraseña de hace 6 minutos se rechaza con P0022",
    },
    {
      name: "que acepta cualquier método de autenticación",
      changes: [["      and e.value->>'method' = 'password'\n", ""]],
      fails: "TEST 0475: «Ver PIN» con otro método (otp) se rechaza con P0022",
    },
    {
      name: "que acepta horas del futuro",
      changes: [["::bigint + 60)\n", "::bigint + 6000)\n"]],
      fails: "TEST 0475: «Ver PIN» con una hora futura se rechaza con P0022",
    },
    {
      name: "que deja chequear la contraseña desde la API",
      changes: [["revoke all on function public.operario_password_reciente() from public, anon, authenticated, service_role;",
        "revoke all on function public.operario_password_reciente() from public, anon, service_role;\ngrant execute on function public.operario_password_reciente() to authenticated;"]],
      fails: "0475: postflight — EXECUTE de public.operario_password_reciente() no es el esperado",
    },
    {
      name: "cuyo restablecimiento no guarda el PIN cifrado",
      changes: [["         pin_cifrado = public.operario_pin_cifrar(p_pin),\n", ""]],
      fails: "TEST 0475: el PIN nuevo queda cifrado con la clave de Vault",
    },
    {
      name: "cuya alta no guarda el PIN cifrado",
      changes: [["    p_role,\n    public.operario_pin_cifrar(p_pin)\n  )", "    p_role,\n    null\n  )"]],
      fails: "TEST 0475: el alta guarda el PIN cifrado",
    },
    {
      name: "que no crea la clave en Vault",
      changes: [["  if not exists (select 1 from vault.decrypted_secrets s where s.name = 'operario_pin_key') then\n    perform vault.create_secret(",
        "  if false then\n    perform vault.create_secret("]],
      fails: "0475: postflight — falta la clave operario_pin_key en Vault",
    },
    {
      name: "que deja descifrar desde la API",
      changes: [["revoke all on function public.operario_pin_descifrar(bytea) from public, anon, authenticated, service_role;",
        "revoke all on function public.operario_pin_descifrar(bytea) from public, anon, service_role;\ngrant execute on function public.operario_pin_descifrar(bytea) to authenticated;"]],
      fails: "0475: postflight — EXECUTE de public.operario_pin_descifrar(bytea) no es el esperado",
    },
    {
      name: "que no quita la firma vieja sin motivo",
      changes: [["drop function if exists public.admin_reset_operario_pin(uuid, text);\n", ""]],
      fails: "0475: postflight — quedaron firmas viejas o sobrecargas de las RPC de operario",
    },
    {
      name: "cuyo «Ver PIN» no tiene candado",
      changes: [["  -- De primero, como en restablecer: sin permiso no hay oráculo de ids.\n  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n    raise exception 'No tienes permiso para realizar esta acción'\n      using errcode = '42501';\n  end if;\n", ""]],
      fails: "TEST 0475: commercial-A no ve el PIN por default",
    },
    {
      name: "cuyo «Ver PIN» autoriza con la vista",
      changes: [["  -- De primero, como en restablecer: sin permiso no hay oráculo de ids.\n  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then",
        "  -- De primero, como en restablecer: sin permiso no hay oráculo de ids.\n  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'view') then"]],
      fails: "TEST 0475: con sólo la vista de Operarios no se ve el PIN",
    },
    {
      name: "cuyo «Ver PIN» no audita",
      changes: [[verAudit, ""]],
      fails: "TEST 0475: ver el PIN deja exactamente un evento pin_visto",
    },
    {
      name: "cuyo «Ver PIN» no pide motivo",
      changes: [["  v_motivo := public.operario_motivo_valido(p_motivo, p_motivo_texto, null);\n", "  v_motivo := coalesce(p_motivo, 'sin motivo declarado');\n"]],
      fails: "TEST 0475: con «Otro», pin_visto guarda el texto como motivo y el código en el payload",
    },
    {
      // Arma bien el motivo pero sólo lo valida con el PIN ya descifrado: un PIN
      // anterior a 0475 o un id inexistente pasan sin motivo.
      name: "cuyo «Ver PIN» valida el motivo sólo si hay PIN cifrado",
      changes: [["  v_motivo := public.operario_motivo_valido(p_motivo, p_motivo_texto, null);\n",
        "  v_motivo := case when pg_catalog.lower(pg_catalog.btrim(coalesce(p_motivo, ''))) = 'otro'\n    then pg_catalog.btrim(p_motivo_texto) else coalesce(p_motivo, 'sin motivo declarado') end;\n"]],
      fails: "TEST 0475: ver un PIN anterior a 0475 o un id inexistente sin un motivo válido se rechaza",
    },
    {
      name: "cuyo «Ver PIN» guarda el PIN en el evento",
      changes: [["pg_catalog.jsonb_build_object('credential', 'pin', 'recoverable', v_pin is not null),",
        "pg_catalog.jsonb_build_object('credential', 'pin', 'recoverable', v_pin is not null, 'value', v_pin),"]],
      fails: "TEST 0475: el evento pin_visto dice quién, a qué operario y por qué",
    },
    {
      name: "cuyo «Ver PIN» deja el PIN en el motivo",
      changes: [["    perform public.operario_motivo_valido(p_motivo, p_motivo_texto, v_pin);\n", ""]],
      fails: "TEST 0475: un motivo con el PIN se rechaza y no lo guarda",
    },
    {
      name: "cuyo «Ver PIN» no mira el tenant",
      changes: [["  perform public.assert_tenant_match(v_tenant_id);\n\n  -- NULL: PIN anterior a 0475", "\n  -- NULL: PIN anterior a 0475"]],
      fails: "TEST 0475: operations de otro tenant no ve el PIN",
    },
    {
      name: "cuyo toggle todavía reactiva",
      changes: [["  if p_active and not v_active then\n    raise exception 'Para reactivar a un operario dale un PIN nuevo con «Restablecer PIN»: así no vuelve con un PIN repetido.'\n      using errcode = 'P0019';\n  end if;\n", ""]],
      fails: "TEST 0475: activar a un operario de baja sin PIN nuevo se rechaza con P0019",
    },
    {
      name: "que ignora p_reactivar",
      changes: [["         active = active or v_reactivado\n", "         active = active\n"]],
      fails: "TEST 0475: restablecer con p_reactivar lo reactiva con un PIN nuevo que entra",
    },
    {
      name: "que reactiva aunque no se lo pidan",
      changes: [["  v_reactivado := coalesce(p_reactivar, false) and not v_active;", "  v_reactivado := not v_active;"]],
      fails: "TEST 0475: restablecer sin p_reactivar deja al operario de baja",
    },
    {
      name: "cuya alta no audita",
      changes: [[createAudit, ""]],
      fails: "TEST 0475: el alta deja su evento con el motivo y sin el PIN",
    },
    {
      name: "cuya alta audita con otro evento",
      changes: [["    p_event_type => 'operario_created',", "    p_event_type => 'operario_added',"]],
      fails: "TEST 0475: el alta deja su evento con el motivo y sin el PIN",
    },
    {
      name: "que conserva el voseo",
      changes: [["PIN demasiado común. Elige uno menos predecible.", "PIN demasiado común. Elegí uno menos predecible."]],
      fails: "TEST 0475: el PIN común se rechaza con «Elige»",
    },
    {
      name: "con el helper INVOKER",
      changes: [["language sql\nstable\nsecurity definer\nset search_path = ''\nas $function$\n  with normalized", "language sql\nstable\nsecurity invoker\nset search_path = ''\nas $function$\n  with normalized"]],
      fails: POSTFLIGHT_FUNCTION("public.operarios_module_authorized(uuid,text)"),
    },
    {
      name: "que deja el chequeo de PIN libre al alcance de authenticated",
      changes: [["revoke all on function public.operario_pin_assert_available(uuid, public.operario_region, text, uuid)\n  from public, anon, authenticated, service_role;",
        "revoke all on function public.operario_pin_assert_available(uuid, public.operario_region, text, uuid)\n  from public, anon, service_role;\ngrant execute on function public.operario_pin_assert_available(uuid, public.operario_region, text, uuid) to authenticated;"]],
      fails: "0475: postflight — EXECUTE de public.operario_pin_assert_available(uuid,public.operario_region,text,uuid) no es el esperado",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(...m.changes) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});

// ─── Propiedad: la base decide igual que la app ──────────────────────────────

type Override = ModuleAccessOverride | null;
type Decision = { view: boolean; edit: boolean };
const OVERRIDES: Override[] = [null, { view: false, edit: false }, { view: true, edit: false }, { view: true, edit: true }];
const CASES: { role: StudioUserRole; override: Override }[] = STUDIO_USER_ROLES.flatMap((role) =>
  // 0357 no admite desvíos para admin (studio_role_module_overrides_role_check).
  (role === "admin" ? [null] : OVERRIDES).map((override) => ({ role, override })));
const label = ({ role, override }: { role: StudioUserRole; override: Override }) =>
  override ? `${role}:${override.view ? "v" : "-"}${override.edit ? "e" : "-"}` : `${role}:default`;

const USER = "20000000-0000-4000-8000-000000000515";
const TENANT = "10000000-0000-4000-8000-000000000515";

/** Doble de PostgREST que aplica `.eq()`/`.is()` y conoce `.returns()`. */
function studioClient(role: StudioUserRole, override: Override, scope: string) {
  const tables: Record<string, Record<string, unknown>[]> = {
    user_tenants: [{ user_id: USER, tenant_id: TENANT, role, disabled_at: null, warehouse_scope: scope }],
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

/** Lo que decide la app: los gates reales de rbac-guard, con cada alcance de almacén. */
async function appDecision(role: StudioUserRole, override: Override): Promise<Decision> {
  const decisions: Decision[] = [];
  for (const scope of ["all", "cn", "ve"]) {
    const client = studioClient(role, override, scope);
    decisions.push({
      view: (await moduleViewDenial(client, "operarios")) === null,
      edit: (await moduleEditDenial(client, "operarios")) === null,
    });
  }
  // El alcance de almacén no cambia nada en Operarios (premisa del helper).
  expect(new Set(decisions.map((d) => JSON.stringify(d))).size).toBe(1);
  // Y es la matriz pura de rbac.ts.
  const map = override ? { [`${role}:operarios`]: override } : {};
  expect(decisions[0]).toEqual({ view: canAccessModule(role, "operarios", map), edit: canEditModule(role, "operarios", map) });
  return decisions[0];
}

/** Lo que decide la base: policy, helper, restablecer y crear; cada caso se deshace. */
async function baseDecision(db: PGlite, tenant: string, role: StudioUserRole, override: Override) {
  const user = `${role}-A`;
  const one = async (sql: string, params: unknown[]) =>
    String(Object.values((await db.query<Record<string, unknown>>(sql, params)).rows[0])[0]);
  await db.exec("savepoint caso");
  try {
    await db.query("select pg_temp.set_override($1::text, $2::boolean, $3::boolean)",
      [role, override?.view ?? null, override?.edit ?? null]);
    const rows = await one("select pg_temp.read_as('authenticated', $1::text, 'select count(*) from public.operario_pins')", [user]);
    const helper = async (access: string) => one(
      "select pg_temp.read_as('authenticated', $1::text, format('select public.operarios_module_authorized(%L::uuid, %L)', $2::text, $3::text))",
      [user, tenant, access]);
    const outcome = async (sql: string) => {
      const state = JSON.parse(await one(`select pg_temp.run_as('authenticated', $1::text, ${sql})::text`, [user])) as
        { ok: boolean; state: string | null; message: string | null };
      if (!state.ok && state.state !== "42501") throw new Error(`${role}: ${state.state} ${state.message}`);
      return state.ok;
    };
    return {
      view: rows !== "0",
      helperView: (await helper("view")) === "true",
      helperEdit: (await helper("edit")) === "true",
      reset: await outcome("pg_temp.reset_sql('cn-2', '7395')"),
      create: await outcome("pg_temp.create_sql('tenant-A', 'Propiedad', '2963')"),
      ver: await outcome("pg_temp.ver_sql('cn-2')"),
    };
  } finally {
    await db.exec("rollback to savepoint caso");
  }
}

async function openFixture(migration?: string) {
  const replace: Record<string, string> = migration ? { [M0475]: migration } : {};
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(psql(CONTRACT, { fixture_only: "true" }, replace));
  const tenant = String((await db.query<{ id: string }>("select pg_temp.fixture_id('tenant-A')::text as id")).rows[0].id);
  return { db, tenant };
}

describe("SDD-0515 · propiedad: la base y moduleEditDenial deciden lo mismo", () => {
  let fixture: { db: PGlite; tenant: string };
  beforeAll(async () => { fixture = await openFixture(); }, SLOW);
  afterAll(async () => { await fixture?.db.close(); });

  it("para cada rol, sin desvío y con cada desvío, vista y edición coinciden", async () => {
    const mismatches: string[] = [];
    for (const c of CASES) {
      const app = await appDecision(c.role, c.override);
      const base = await baseDecision(fixture.db, fixture.tenant, c.role, c.override);
      const expected = { view: app.view, helperView: app.view, helperEdit: app.edit, reset: app.edit, create: app.edit, ver: app.edit };
      if (JSON.stringify(base) !== JSON.stringify(expected)) mismatches.push(`${label(c)} base=${JSON.stringify(base)} app=${JSON.stringify(app)}`);
    }
    expect(mismatches).toEqual([]);
    expect(CASES).toHaveLength(25);
  }, SLOW);

  it("los casos cubren las dos direcciones del desvío", async () => {
    // Un desvío que abre lo que el default cierra y uno que cierra lo que abre;
    // sin ellos, la propiedad podría pasar con una base que ignora 0357.
    expect(await appDecision("commercial", null)).toEqual({ view: false, edit: false });
    expect(await appDecision("commercial", { view: true, edit: true })).toEqual({ view: true, edit: true });
    expect(await appDecision("operations", null)).toEqual({ view: true, edit: true });
    expect(await appDecision("operations", { view: false, edit: false })).toEqual({ view: false, edit: false });
    expect(await appDecision("support", { view: true, edit: true })).toEqual({ view: true, edit: false });
  });
});

describe("SDD-0515 · propiedad: el rol escrito a mano rompe la coincidencia", () => {
  it("con el candado de 0351 en el restablecimiento, fallan justo los casos donde la lista a mano y la matriz difieren", async () => {
    const hand = mutant([
      "  if not public.operarios_module_authorized(public.get_user_tenant_id(), 'edit') then\n" +
      "    raise exception 'No tienes permiso para realizar esta acción'\n" +
      "      using errcode = '42501';\n" +
      "  end if;\n\n  select op.tenant_id, op.region",
      "  perform public.assert_studio_role(array['admin', 'operations']);\n\n  select op.tenant_id, op.region",
    ]);
    const { db, tenant } = await openFixture(hand);
    try {
      const broken: string[] = [];
      for (const c of CASES) {
        const app = await appDecision(c.role, c.override);
        const base = await baseDecision(db, tenant, c.role, c.override);
        if (base.reset !== app.edit) broken.push(label(c));
      }
      expect(broken.sort()).toEqual([
        "accounting:ve", "commercial:ve", "marketing:ve", "operations:--", "operations:v-", "warehouse:ve",
      ]);
    } finally {
      await db.close();
    }
  }, SLOW);
});

// ─── Espejo del motivo: la función SQL real contra operarioMotivoProblem ─────

describe("SDD-0515 · el motivo se valida igual en el Studio y en la base", () => {
  const OTRO_TEXTOS = [
    "", "abc", "abcd", "   abc   ", "  abcd  ", "\tabc", "abc\n", "😀😀", "😀😀😀😀", "😀".repeat(200),
    "😀".repeat(201), "x".repeat(200), "x".repeat(201), `${" ".repeat(10)}${"x".repeat(200)}${" ".repeat(10)}`,
    `\t${"x".repeat(200)}`,
  ];
  const CASES: [string | null, string | null, string | null][] = [
    // Los códigos de la lista, con y sin mayúsculas o espacios, y los que no están.
    ...OPERARIO_MOTIVOS.map((m) => [m.value, null, null] as [string, null, null]),
    ["OLVIDO", null, null], ["  empleado_nuevo  ", null, null], ["Revision_Seguridad", null, null],
    [null, null, null], ["", null, null], ["inventado", null, null], ["olvido ya", null, null], ["olvidó", null, null],
    // Un código fijo ignora el texto, aunque lleve el PIN.
    ["olvido", "Le puse 4827 a pedido", "4827"],
    // «Otro»: el texto manda.
    ...OTRO_TEXTOS.map((t) => ["otro", t, null] as [string, string, null]),
    ["otro", "Le puse 4827 a pedido", "4827"], ["otro", "Le puse otro a pedido", "4827"],
    ["otro", "4827", "4827"], ["otro", "Le puse 4827 a pedido", null], ["otro", null, null],
  ];

  it("la lista de códigos es la misma en la base y en el Studio", () => {
    const fn = block(FILE_0475, "operario_motivo_valido");
    const match = fn.match(/if v_codigo not in \(([^)]*)\) then/);
    expect(match).not.toBeNull();
    const sqlCodes = [...match![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(sqlCodes).toEqual(OPERARIO_MOTIVOS.map((m) => m.value));
  });

  it("para cada caso, la base y el Studio aceptan y rechazan lo mismo, con el mismo mensaje", async () => {
    const db = new PGlite();
    try {
      await db.exec(block(FILE_0475, "operario_motivo_valido"));
      const mismatches: string[] = [];
      for (const [codigo, texto, pin] of CASES) {
        let sql: string | null;
        try {
          await db.query("select public.operario_motivo_valido($1, $2, $3)", [codigo, texto, pin]);
          sql = null;
        } catch (error) {
          sql = error instanceof Error ? error.message : String(error);
        }
        const problem = operarioMotivoProblem(codigo, texto, pin);
        const ts = problem ? OPERARIO_MOTIVO_MESSAGE[problem] : null;
        if (sql !== ts) {
          mismatches.push(`${JSON.stringify(codigo)}/${JSON.stringify((texto ?? "").slice(0, 20))}/${pin}: base=${sql} studio=${ts}`);
        }
      }
      expect(mismatches).toEqual([]);
    } finally {
      await db.close();
    }
  });
});
