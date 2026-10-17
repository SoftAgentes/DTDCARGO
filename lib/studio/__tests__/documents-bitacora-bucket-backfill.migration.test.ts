// @vitest-environment node
/**
 * SDD-0508 · La migración 0474 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0474_documents_bitacora_bucket_backfill.test.sql`
 * corre en `verify` con Docker; el CI de calidad no tiene Docker. PGlite corre
 * ese MISMO contrato con el `.sql` real de la migración inlineado.
 *
 * CONTROL ROJO: sin 0474 el contrato cae en el caso A (el adjunto medido en
 * producción). MUTANTES: cada uno quita una condición del filtro del UPDATE y
 * cae en el caso que esa condición protege. PREFLIGHT: sin la rama de la 0473
 * o sin storage.objects, aborta con su mensaje antes de tocar filas.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0474_documents_bitacora_bucket_backfill.test.sql");
const M0474 = resolve(ROOT, "supabase/migrations/0474_documents_bitacora_bucket_backfill.sql");
const NAME = "0474_documents_bitacora_bucket_backfill";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0474 = read(M0474);
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
const SLOW = 120_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/** psql → SQL plano: \set, \if :{?v} / :v, \else, \endif e \ir (como el envoltorio de 0473). */
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

async function contract(vars: Record<string, string> = {}, migration?: string) {
  const replace: Record<string, string> = migration ? { [M0474]: migration } : {};
  const sql = inline(CONTRACT, vars, replace);
  const db = new PGlite();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((t) => t.startsWith("TEST 0474 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** Reemplaza un fragmento que debe aparecer exactamente una vez. */
function mutate(from: string, to: string): string {
  const parts = FILE_0474.split(from);
  if (parts.length !== 2) throw new Error(`fragmento ${parts.length - 1} veces: ${from}`);
  return parts.join(to);
}

/** Cuerpo SQL sin comentarios de línea, para las comprobaciones de texto. */
const SQL_0474 = FILE_0474.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

const UPDATE_FILTER = /update public\.documents d\s+set bucket_id = 'bitacora'\s+(where[\s\S]*?);/;
const POST_FILTER = /select 1\s+from public\.documents d\s+(where[\s\S]*?)\n\s*\) then/;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("0474 · texto de la migración", () => {
  it("el postflight mide exactamente el mismo filtro que corrige el UPDATE", () => {
    const update = SQL_0474.match(UPDATE_FILTER)?.[1];
    const post = SQL_0474.match(POST_FILTER)?.[1];
    expect(update).toBeTruthy();
    expect(norm(post ?? "")).toBe(norm(update ?? ""));
  });

  it("sin DDL: no crea, altera ni borra objetos", () => {
    expect(SQL_0474).not.toMatch(/\b(create|alter|drop)\s+(table|function|policy|trigger|index|type|schema|role)\b/i);
    expect(SQL_0474).not.toMatch(/\b(delete\s+from|truncate|insert\s+into)\b/i);
  });

  it("fija lock_timeout y statement_timeout", () => {
    expect(SQL_0474).toMatch(/^set lock_timeout = '5s';$/m);
    expect(SQL_0474).toMatch(/^set statement_timeout = '30s';$/m);
  });

  it("aplicada al servidor propio el 2026-10-14: ya no es una espera y el archivo no se tocó", () => {
    // Aplicada el 2026-10-14 a las 04:02:18Z en el servidor propio, con OK nominal
    // de Sam. El ledger guarda el archivo entero, con md5 6f4bb32d… y 5786 bytes:
    // editar el archivo, aunque sea la cabecera «NO APLICADA», rompería esa
    // identidad. Lo que cambia es el baseline.
    const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");
    expect(BASELINE.pendingBelowCutoff[NAME]).toBeUndefined();
    expect(md5(FILE_0474)).toBe("6f4bb32df48a6e8851c8ced80ca02361");
    expect(Buffer.byteLength(FILE_0474)).toBe(5786);
  });
});

describe("0474 · contrato en PGlite", () => {
  it("green: corrige sólo el adjunto cuyo objeto está en bitacora, y es re-aplicable", { timeout: SLOW }, async () => {
    const r = await contract();
    expect(r.error).toBeNull();
    expect(r.green).toBe("TEST 0474 GREEN: 10 aserciones");
  });

  it("control rojo: sin 0474 cae en el caso A", { timeout: SLOW }, async () => {
    const r = await contract({ apply_fix: "false" });
    expect(r.error).toContain("TEST 0474: A: adjunto de Bitácora con objeto en bitacora pasa a bitacora");
  });

  it("preflight: sin la rama bitacora_task de la 0473 aborta con su mensaje", { timeout: SLOW }, async () => {
    const r = await contract({ sin_rama: "true" });
    expect(r.error).toContain("0474: document_entity_in_tenant sin la rama bitacora_task");
  });

  it("preflight: sin storage.objects aborta con su mensaje", { timeout: SLOW }, async () => {
    const r = await contract({ sin_storage: "true" });
    expect(r.error).toContain("0474: falta public.documents o storage.objects");
  });

  it("mutante del preflight sin chequeo de rama: falla igual, pero con el error críptico del trigger", { timeout: SLOW }, async () => {
    const sinChequeo = mutate("not like '%when ''bitacora_task'' then%'", "is null");
    const r = await contract({ sin_rama: "true" }, sinChequeo);
    expect(r.error).not.toContain("0474: document_entity_in_tenant");
    expect(r.error).toContain("documento sobre entidad inexistente");
  });

  const mutantes: [string, string, string, string][] = [
    [
      "sin exigir que el objeto NO esté en documents",
      "     and not exists (\n       select 1 from storage.objects o\n       where o.bucket_id = 'documents' and o.name = d.storage_path\n     );\n  get diagnostics",
      "     ;\n  get diagnostics",
      "TEST 0474: D: objeto en los dos buckets no se toca",
    ],
    [
      "sin exigir que el objeto esté en bitacora",
      "     and exists (\n       select 1 from storage.objects o\n       where o.bucket_id = 'bitacora' and o.name = d.storage_path\n     )\n     and not exists (\n       select 1 from storage.objects o\n       where o.bucket_id = 'documents' and o.name = d.storage_path\n     );\n  get diagnostics",
      "     and not exists (\n       select 1 from storage.objects o\n       where o.bucket_id = 'documents' and o.name = d.storage_path\n     );\n  get diagnostics",
      "TEST 0474: E: objeto en ningún bucket no se toca",
    ],
    [
      "sin filtro de entidad",
      "   where d.entity_type::text = 'bitacora_task'\n     and d.bucket_id = 'documents'\n     and exists",
      "   where d.bucket_id = 'documents'\n     and exists",
      "TEST 0474: F: otra entidad no se toca",
    ],
    [
      "sin filtro del bucket de origen",
      "   where d.entity_type::text = 'bitacora_task'\n     and d.bucket_id = 'documents'\n     and exists",
      "   where d.entity_type::text = 'bitacora_task'\n     and exists",
      "TEST 0474: H: otro bucket de origen no se toca",
    ],
    [
      "dejando fuera los borrados lógicos",
      "   where d.entity_type::text = 'bitacora_task'\n     and d.bucket_id = 'documents'\n     and exists",
      "   where d.entity_type::text = 'bitacora_task'\n     and d.deleted_at is null\n     and d.bucket_id = 'documents'\n     and exists",
      "0474: quedaron adjuntos de Bitácora con bucket_id documents",
    ],
  ];

  for (const [nombre, from, to, esperado] of mutantes) {
    it(`mutante ${nombre} → cae`, { timeout: SLOW }, async () => {
      const r = await contract({}, mutate(from, to));
      expect(r.green).toBeUndefined();
      expect(r.error).toContain(esperado);
    });
  }
});
