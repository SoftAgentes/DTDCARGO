// @vitest-environment node
/**
 * SDD-0652 fase 2 · La migración 0555 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0555_nomina_ficha_empleado_identidad_foto.test.sql`
 * monta el writer AUD-01 real (0267 y 0294), una fixture mínima de Nómina y la
 * 0555 REAL. PGlite lo corre con los `.sql` inlineados: lo que se prueba es el
 * texto que se aplicará.
 *
 * CONTROL ROJO: sin la 0555 el contrato cae en la primera aserción.
 * PREFLIGHT: cada caso de la spec §F2 punto 2 aborta con su mensaje.
 * MUTANTES: cada uno es una 0555 con UN defecto y cae con la aserción que lo nombra.
 *
 * Lo que PGlite no prueba: dos enlaces en paralelo (una sola conexión). El
 * contrato mide el segundo intento en serie.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0555_nomina_ficha_empleado_identidad_foto.test.sql");
const M0555 = "0555_nomina_ficha_empleado_identidad_foto.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0555 = read(resolve(ROOT, "supabase/migrations", M0555));
const SLOW = 180_000;

/** psql → SQL plano: quita \set e inlinea \ir. `replace` sustituye un archivo por el final de su ruta. */
function inline(file: string, replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key !== undefined ? replace[key]! : readFileSync(path, "utf8");
  };
  function run(path: string) {
    for (const line of source(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        out.push(line);
      } else if (meta[1] === "ir") {
        run(resolve(dirname(path), meta[2]!.trim()));
      } else if (meta[1] !== "set") {
        throw new Error("metaorden psql no soportada: \\" + meta[1]);
      }
    }
  }
  run(file);
  return out.join("\n");
}

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

async function contract(migracion: string = FILE_0555) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, { [M0555]: migracion }));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0555"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Preflight: lo que hay ANTES de la 0555 y el mensaje con que tiene que abortar. */
const PREFLIGHT: { nombre: string; antes: string; aborta: string }[] = [
  {
    nombre: "la columna photo_path ya existe",
    antes: "alter table public.nomina_employees add column photo_path text;",
    aborta: "0555 abortada: nomina_employees ya tiene photo_path",
  },
  {
    nombre: "el bucket ya existe",
    antes: "insert into storage.buckets (id, name) values ('employee-photos', 'employee-photos');",
    aborta: "0555 abortada: el bucket employee-photos ya existe",
  },
  {
    nombre: "un tipo del catálogo ya existe con otro dominio",
    antes:
      "insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref) values ('nomina_employee_photo', 'active', 'operations', 1, 'fixture');",
    aborta: "0555 abortada: el tipo nomina_employee_photo ya existe con el dominio operations",
  },
  {
    nombre: "falta el índice único del enlace",
    antes: "drop index public.nomina_employees_auth_user_uniq;",
    aborta: "0555 requiere el índice único nomina_employees_auth_user_uniq",
  },
  {
    nombre: "falta la columna auth_user_id",
    antes: "alter table public.nomina_employees drop column auth_user_id;",
    aborta: "0555 requiere la columna public.nomina_employees.auth_user_id",
  },
  {
    nombre: "falta el catálogo de clientes del portal",
    antes: "drop table public.client_users;",
    aborta: "0555 requiere la columna public.client_users.auth_user_id",
  },
  {
    nombre: "falta la FK del catálogo de auditoría",
    antes: "alter table public.entity_audit_log drop constraint entity_audit_log_entity_type_fkey;",
    aborta: "0555 requiere la FK entity_audit_log_entity_type_fkey",
  },
  {
    nombre: "una de sus funciones ya existe",
    antes:
      "create function public.nomina_reveal_bank_account(p_employee_id uuid, p_reason text) returns text language sql as $$ select null::text $$;",
    aborta: "0555 abortada: public.nomina_reveal_bank_account(uuid,text) ya existe",
  },
];

/** Cada mutante: la 0555 con un defecto y la aserción con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "quien llama no tiene que estar activo",
    sql: () => once(FILE_0555, "    and ut.disabled_at is null\n    and (ut.role = 'admin'", "    and (ut.role = 'admin'"),
    cae: "TEST 0555: L1: un admin suspendido no enlaza",
  },
  {
    nombre: "Contabilidad también enlaza",
    sql: () => {
      const firma = "create function public.nomina_link_employee_user(";
      const i = FILE_0555.indexOf(firma);
      const llamada = "public.nomina_ficha_actor_tenant(true)";
      const j = FILE_0555.indexOf(llamada, i);
      expect(i).toBeGreaterThan(0);
      expect(j).toBeGreaterThan(i);
      return FILE_0555.slice(0, j) + "public.nomina_ficha_actor_tenant(false)" + FILE_0555.slice(j + llamada.length);
    },
    cae: "TEST 0555: L1: Contabilidad no enlaza",
  },
  {
    nombre: "se enlaza a un usuario suspendido",
    sql: () =>
      once(
        FILE_0555,
        "where ut.user_id = p_user_id and ut.tenant_id = v_tenant and ut.disabled_at is null",
        "where ut.user_id = p_user_id and ut.tenant_id = v_tenant",
      ),
    cae: "TEST 0555: L3: usuario suspendido",
  },
  {
    nombre: "se enlaza a un cliente del portal",
    sql: () => once(FILE_0555, "where cu.auth_user_id = p_user_id", "where false"),
    cae: "TEST 0555: L3: cliente del portal",
  },
  {
    nombre: "el enlace sobrescribe uno existente",
    sql: () => once(FILE_0555, "  if v_ficha.auth_user_id is not null then\n    raise exception 'nomina: esta ficha ya está enlazada", "  if false then\n    raise exception 'nomina: esta ficha ya está enlazada"),
    cae: "TEST 0555: L7: una ficha ya enlazada no se sobrescribe",
  },
  {
    nombre: "una ficha egresada se enlaza",
    sql: () => once(FILE_0555, "    raise exception 'nomina: una ficha egresada no se enlaza' using errcode = '22023';", "    null;"),
    cae: "TEST 0555: L3: ficha egresada",
  },
  {
    nombre: "la ruta de la foto no lleva el tenant",
    sql: () => once(FILE_0555, "('^' || v_tenant::text || '/' || p_employee_id::text", "('^[0-9a-f-]{36}/' || p_employee_id::text"),
    cae: "TEST 0555: F1: ruta con otro tenant",
  },
  {
    nombre: "el evento de la foto guarda la ruta",
    sql: () =>
      once(
        FILE_0555,
        "    pg_catalog.jsonb_build_object('has_photo', v_path is not null),",
        "    pg_catalog.jsonb_build_object('has_photo', v_path is not null, 'path', v_path),",
      ),
    cae: "TEST 0555: F6: los eventos de la foto no guardan la ruta",
  },
  {
    nombre: "el evento del revelado guarda la cuenta",
    sql: () =>
      once(
        FILE_0555,
        "    pg_catalog.jsonb_build_object('field', 'bank_account'),",
        "    pg_catalog.jsonb_build_object('field', 'bank_account', 'valor', v_account),",
      ),
    cae: "TEST 0555: R5: ningún evento guarda el número de la cuenta",
  },
  {
    nombre: "el revelado no deja evento",
    sql: () => once(FILE_0555, "'bank_account_revealed', 'rpc', 'succeeded', v_reason,", "'bank_account_seen', 'rpc', 'succeeded', v_reason,"),
    cae: "TEST 0555: R4: queda un bank_account_revealed",
  },
  {
    nombre: "la línea de tiempo trae los eventos de todas las fichas",
    sql: () => once(FILE_0555, "         ) and log.entity_id = p_employee_id)", "         ))"),
    // La ficha Uno sigue viendo sus siete: el defecto se ve en la otra ficha, que recibe los ajenos.
    cae: "TEST 0555: T4: la otra ficha solo tiene su propio finiquito",
  },
  {
    nombre: "la línea de tiempo trae los finiquitos de otras fichas",
    sql: () => once(FILE_0555, "where s.tenant_id = v_tenant and s.employee_id = p_employee_id", "where s.tenant_id = v_tenant"),
    cae: "TEST 0555: T2: Contabilidad ve los siete eventos de la ficha",
  },
  {
    nombre: "el cursor no desempata por id",
    sql: () =>
      once(
        FILE_0555,
        "(log.occurred_at, log.id) < (v_cursor_at, v_cursor_id)",
        "log.occurred_at < v_cursor_at",
      ),
    cae: "TEST 0555: T7: con cuatro eventos, tres en el mismo instante",
  },
  {
    nombre: "anon ejecuta el revelado",
    sql: () =>
      once(
        FILE_0555,
        "grant execute on function public.nomina_reveal_bank_account(uuid, text) to authenticated;",
        "grant execute on function public.nomina_reveal_bank_account(uuid, text) to authenticated, anon;",
      ),
    cae: "0555 postflight: anon o service_role ejecutan public.nomina_reveal_bank_account(uuid,text)",
  },
];

describe("SDD-0652 fase 2 · 0555 ficha del empleado (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0555",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0555 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(80);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0555 cae en la primera aserción",
    async () => {
      const run = await contract("select 1;");
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("TEST 0555: C0: existe nomina_link_employee_user");
    },
    SLOW,
  );

  it(
    "la 0555 no se aplica dos veces",
    async () => {
      const run = await contract(`${FILE_0555}\n${FILE_0555}`);
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("0555 abortada: nomina_employees ya tiene photo_path");
    },
    SLOW,
  );

  it.each(PREFLIGHT)(
    "PREFLIGHT «$nombre» aborta",
    async ({ antes, aborta }) => {
      const run = await contract(`${antes}\n${FILE_0555}`);
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(aborta);
    },
    SLOW,
  );

  it(
    "PREFLIGHT: un tipo que ya existe con el MISMO dominio no estorba",
    async () => {
      const run = await contract(
        "insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref) values ('nomina_employee_access', 'active', 'access', 1, 'fixture');\n" +
          FILE_0555,
      );
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0555 GREEN/);
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract(sql());
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(14);
  });

  it("corre con lock_timeout y statement_timeout antes de tocar nada", () => {
    const primeraOrden = FILE_0555.split("\n").filter((l) => l.trim() && !l.startsWith("--"));
    expect(primeraOrden[0]).toBe("set local lock_timeout = '5s';");
    expect(primeraOrden[1]).toBe("set local statement_timeout = '30s';");
  });
});
