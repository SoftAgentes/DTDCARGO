// @vitest-environment node
/**
 * SDD-0506 · La migración 0473 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0473_document_entity_bitacora_task.test.sql` corre
 * en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato con el `.sql` real de la migración inlineado: lo que se prueba es
 * el texto que el runbook aplicará a producción, no un doble.
 *
 * CONTROL ROJO: sin 0473 (la función como la dejó 0314, que es la que corre en
 * producción) el contrato pasa las once ramas viejas y cae en la primera
 * aserción de Bitácora. MUTANTES: cada uno es una 0473 coherente (con el md5 de
 * su propio cuerpo en el preflight y el postflight) y cae en la aserción de la
 * regla que rompe.
 *
 * LÍNEA A LÍNEA: 0473 promete copiar el cuerpo de 0314 (13-38) más una rama, y
 * el contrato promete que su ANTES es la copia exacta de 0314, 0097, 0215 y
 * 0209. Las promesas se miden contra los archivos. Y como 0314 perdió la rama
 * por reescribir la función desde una copia vieja, la última definición de la
 * función en supabase/migrations tiene que cubrir todos los valores del enum.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const CONTRACT = resolve(ROOT, "supabase/tests/0473_document_entity_bitacora_task.test.sql");
const M0473 = resolve(MIGRATIONS, "0473_document_entity_bitacora_task.sql");
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0473 = read(M0473);
const FILE_0314 = read(resolve(MIGRATIONS, "0314_expenses_document_adapter.sql"));
const FILE_0215 = read(resolve(MIGRATIONS, "0215_bitacora_enums.sql"));
const FILE_0209 = read(resolve(MIGRATIONS, "0209_revoke_anon_rpc_sweep.sql"));
const FILE_0210 = read(resolve(MIGRATIONS, "0210_pin_search_path_triggers.sql"));
const FILE_0097 = read(resolve(MIGRATIONS, "0097_documentos_hub.sql"));
const FILE_CONTRACT = read(CONTRACT);
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const SLOW = 120_000;

/** md5(prosrc) de document_entity_in_tenant leído en Cloud y en el servidor propio el 2026-10-14. */
const PROD_0314_MD5 = "fe0e86178dfd646dc7d58b46ef404949";
const BRANCH = "    when 'bitacora_task' then select exists(select 1 from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;\n";

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de un archivo por su ruta
 * absoluta: la migración (mutante) o el propio contrato (drift del ANTES).
 */
function inline(file: string, vars: Record<string, string>, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  const readSql = (path: string) => replace[resolve(path)] ?? readFileSync(path, "utf8");
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of readSql(path).split(/\r?\n/)) {
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

async function contract(options: { applyFix?: boolean; migration?: string; contract?: string } = {}) {
  const replace: Record<string, string> = {};
  if (options.migration) replace[M0473] = options.migration;
  if (options.contract) replace[CONTRACT] = options.contract;
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, replace);
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0473 GREEN"));
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
  expect(parts, `«${from.slice(0, 40)}…» debe aparecer una sola vez`).toHaveLength(2);
  return parts.join(to);
}

/** El bloque `create or replace function public.<name>(… $$;` de un archivo. */
function block(text: string, name: string): string {
  const head = `create or replace function public.${name}(`;
  const start = text.indexOf(head);
  expect(start, `${name} en el texto`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n$$;", start);
  expect(end, `cierre $$; de ${name}`).toBeGreaterThan(start);
  return text.slice(start, end + "\n$$;".length);
}

/** El prosrc que guardará Postgres: lo que va entre `$$` y `$$;`. */
function prosrc(fn: string): string {
  return fn.slice(fn.indexOf("$$") + 2, fn.lastIndexOf("$$;"));
}

const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");
const MD5_0473 = md5(prosrc(block(FILE_0473, "document_entity_in_tenant")));

/** 0473 con un único cambio y el md5 de su nuevo cuerpo donde estaba el suyo. */
function mutant(from: string, to: string): string {
  const text = once(FILE_0473, from, to);
  const own = md5(prosrc(block(text, "document_entity_in_tenant")));
  return text.split(MD5_0473).join(own);
}

/** La sentencia completa que empieza en `head` y termina en el primer `;\n`. */
function statement(text: string, head: string): string {
  const start = text.indexOf(head);
  expect(start, `«${head}» en el texto`).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf(";\n", start) + 1);
}

describe("SDD-0506 · 0473 devuelve la rama bitacora_task a document_entity_in_tenant (texto)", () => {
  it("el cuerpo de 0314 es el que se midió en producción", () => {
    expect(md5(prosrc(block(FILE_0314, "document_entity_in_tenant")))).toBe(PROD_0314_MD5);
    expect(FILE_0473.split(`'${PROD_0314_MD5}'`)).toHaveLength(2);
  });

  it("0473 es 0314:13-38 más la rama bitacora_task, y nada más", () => {
    expect(once(block(FILE_0473, "document_entity_in_tenant"), BRANCH, ""))
      .toBe(block(FILE_0314, "document_entity_in_tenant"));
  });

  it("el preflight y el postflight esperan el md5 del cuerpo de 0473", () => {
    expect(FILE_0473.split(`'${MD5_0473}'`)).toHaveLength(3);
  });

  it("el ANTES del contrato es la copia exacta de 0314, 0215, 0209, 0097 y 0210", () => {
    expect(block(FILE_CONTRACT, "document_entity_in_tenant")).toBe(block(FILE_0314, "document_entity_in_tenant"));
    expect(FILE_CONTRACT).toContain(statement(FILE_0215, "comment on function public.document_entity_in_tenant is"));
    for (const head of ["revoke execute on function public.document_entity_in_tenant(",
      "grant execute on function public.document_entity_in_tenant("]) {
      expect(FILE_CONTRACT).toContain(statement(FILE_0209, head));
    }
    expect(block(FILE_CONTRACT, "documents_validate_entity")).toBe(block(FILE_0097, "documents_validate_entity"));
    expect(FILE_CONTRACT).toContain(statement(FILE_0210, "alter function public.documents_validate_entity()"));
  });

  it("la última definición de la función cubre todos los valores del enum", () => {
    // 0314 perdió la rama de 0215 por reescribir la función desde una copia
    // vieja. Si una migración futura suma un valor al enum, o vuelve a
    // reescribir la función, sin su rama, falla acá y no en producción.
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();
    const texts = files.map((name) => ({ name, text: read(resolve(MIGRATIONS, name)) }));
    const created = statement(FILE_0097, "create type document_entity_type as enum (");
    const values = new Set([...created.matchAll(/'(\w+)'/g)].map((match) => match[1]));
    for (const { text } of texts) {
      for (const match of text.matchAll(/alter type (?:public\.)?document_entity_type add value (?:if not exists )?'(\w+)'/g)) {
        values.add(match[1]);
      }
    }
    expect([...values].sort()).toEqual(["bitacora_task", "booking", "client", "consolidation", "expense",
      "invoice", "journal_entry", "none", "shipment", "supplier", "supplier_bill", "supplier_payment"]);
    const last = texts.filter(({ text }) => text.includes("create or replace function public.document_entity_in_tenant(")).at(-1);
    expect(last?.name).toBe("0473_document_entity_bitacora_task.sql");
    const fn = block(last!.text, "document_entity_in_tenant");
    for (const value of values) {
      if (value !== "none") expect(fn, `rama ${value}`).toContain(`when '${value}' then`);
    }
  });

  it("no toca filas ni tablas: sólo la función, su comentario y su ACL", () => {
    // La cabecera nombra tablas para explicar el defecto; se mide el código.
    const code = FILE_0473.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
    expect(code).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+|truncate)\b/i);
    expect(code.match(/create or replace function/g)).toHaveLength(1);
  });

  it("sigue siendo una espera: el baseline la declara y la cabecera pide el OK de Sam", () => {
    const wait = BASELINE.pendingBelowCutoff["0473_document_entity_bitacora_task"];
    expect(wait).toBeDefined();
    expect(wait).toContain("PENDIENTE DE APLICAR");
    expect(wait).toContain("name exacto 0473_document_entity_bitacora_task");
    expect(FILE_0473).toContain("⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en\n--    supabase/migrations-baseline.json › pendingBelowCutoff");
  });
});

describe("SDD-0506 · 0473 devuelve la rama bitacora_task a document_entity_in_tenant (PGlite)", () => {
  it("el contrato pasa con 0473 aplicada dos veces", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toMatch(/^TEST 0473 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: con la función de 0314 pasa las once ramas viejas y cae en Bitácora", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toBe("TEST 0473: bitacora_task del mismo tenant se acepta");
  }, SLOW);

  const ANTES_0314 = block(FILE_CONTRACT, "document_entity_in_tenant");
  const DRIFT = "0473 abortado: document_entity_in_tenant tiene drift respecto a 0314 (md5 de prosrc, DEFINER, STABLE o search_path)";
  const PREFLIGHTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "una función como la dejó 0215 (sin expense, search_path public)",
      from: ANTES_0314,
      to: block(FILE_0215, "document_entity_in_tenant"),
      fails: DRIFT,
    },
    {
      name: "el cuerpo de 0314 con un espacio de más",
      from: "  return ok;\nend;\n$$;",
      to: "  return  ok;\nend;\n$$;",
      fails: DRIFT,
    },
    {
      name: "bitacora_tasks con deleted_at",
      from: "  estado text not null default 'pendiente'",
      to: "  deleted_at timestamptz,\n  estado text not null default 'pendiente'",
      fails: "0473 abortado: public.bitacora_tasks tiene deleted_at y la rama no lo filtra",
    },
    {
      name: "un enum sin bitacora_task",
      from: "'none', 'bitacora_task', 'expense'",
      to: "'none', 'expense'",
      fails: "0473 abortado: el enum document_entity_type no tiene bitacora_task (0215)",
    },
  ];
  for (const p of PREFLIGHTS) {
    it(`preflight con ${p.name}: aborta sin cambiar nada`, async () => {
      const result = await contract({ contract: once(FILE_CONTRACT, p.from, p.to) });
      expect(result.error).toBe(p.fails);
    }, SLOW);
  }

  it("mutante sin md5 en el preflight: el cuerpo con un espacio de más ya no aborta", async () => {
    // Lo que frena el drift es el md5, no la forma: sin él, el control de arriba
    // no sería rojo.
    const result = await contract({
      migration: mutant(`      and pg_catalog.md5(p.prosrc) in (\n        '${PROD_0314_MD5}',  -- 0314, medido en producción\n        '${MD5_0473}'))  -- esta migración: re-aplicar no cambia nada\n`, "  )\n"),
      contract: once(FILE_CONTRACT, "  return ok;\nend;\n$$;", "  return  ok;\nend;\n$$;"),
    });
    expect(result.error).toBeNull();
  }, SLOW);

  const MUTANTS: { name: string; from: string; to: string; fails: string }[] = [
    {
      name: "con la rama sin filtro de tenant",
      from: "from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;",
      to: "from public.bitacora_tasks where id=p_id) into ok;",
      fails: "TEST 0473: bitacora_task de otro tenant se rechaza",
    },
    {
      name: "con la rama sin filtro de id",
      from: "from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;",
      to: "from public.bitacora_tasks where tenant_id=p_tenant) into ok;",
      fails: "TEST 0473: bitacora_task inexistente se rechaza",
    },
    {
      name: "con otra etiqueta en la rama",
      from: "    when 'bitacora_task' then",
      to: "    when 'bitacora_tasks' then",
      fails: "TEST 0473: bitacora_task del mismo tenant se acepta",
    },
    {
      name: "que pierde la rama expense, como 0314 perdió la de Bitácora",
      from: "    when 'expense' then select exists(select 1 from public.expenses where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;\n",
      to: "",
      fails: "TEST 0473: expense del mismo tenant se acepta",
    },
    {
      name: "INVOKER en vez de DEFINER",
      from: "language plpgsql stable security definer set search_path = '' as $$",
      to: "language plpgsql stable set search_path = '' as $$",
      fails: "0473: postflight — document_entity_in_tenant no quedó con el cuerpo de 0473, DEFINER, STABLE, search_path vacío o la ACL esperada",
    },
    {
      name: "que le abre EXECUTE a anon",
      from: "p_tenant uuid) to authenticated, service_role;",
      to: "p_tenant uuid) to authenticated, service_role, anon;",
      fails: "0473: postflight — document_entity_in_tenant no quedó con el cuerpo de 0473, DEFINER, STABLE, search_path vacío o la ACL esperada",
    },
  ];
  for (const m of MUTANTS) {
    it(`mutante ${m.name}: muere donde debe`, async () => {
      const result = await contract({ migration: mutant(m.from, m.to) });
      expect(result.error).toBe(m.fails);
    }, SLOW);
  }
});
