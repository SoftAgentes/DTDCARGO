// @vitest-environment node
/**
 * SDD-0611 · La migración 0525 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0525_noticias_ajustes_antes_de_encender.test.sql`
 * monta el fixture de la 0518, emula los privilegios por defecto de Supabase y
 * aplica las migraciones REALES 0053, 0055, 0057, 0140, 0518 y 0525. PGlite lo
 * corre con los `.sql` inlineados: lo que se prueba es el texto que se aplicará.
 *
 * CONTROL ROJO: sin 0525 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0525 con UN defecto y tiene que caer con el mensaje
 * que lo nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0525_noticias_ajustes_antes_de_encender.test.sql");
const M0525 = "0525_noticias_ajustes_antes_de_encender.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0525 = read(resolve(ROOT, "supabase/migrations", M0525));
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
      if (!meta) {
        out.push(line);
      } else if (meta[1] === "ir") {
        run(resolve(dirname(path), meta[2].trim()));
      } else if (meta[1] !== "set") {
        throw new Error("metaorden psql no soportada: \\" + meta[1]);
      }
    }
  }
  run(file);
  return out.join("\n");
}

async function contract(replace: Record<string, string> = {}) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0525"));
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

/** Cada mutante: la 0525 con un defecto y el texto con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "sin revoke a anon sobre news_huella",
    sql: () =>
      once(
        once(FILE_0525, "revoke execute on function public.news_huella(jsonb) from anon;", ""),
        "if pg_catalog.has_function_privilege('anon', 'public.news_huella(jsonb)', 'execute')\n     or ",
        "if ",
      ),
    cae: "TEST 0525: 12: anon no ejecuta news_huella",
  },
  {
    nombre: "sin revoke a anon sobre news_texto_tiene_marca",
    sql: () =>
      once(
        once(FILE_0525, "revoke execute on function public.news_texto_tiene_marca(text) from anon;", ""),
        "\n     or pg_catalog.has_function_privilege('anon', 'public.news_texto_tiene_marca(text)', 'execute')",
        "",
      ),
    cae: "TEST 0525: 12: anon no ejecuta news_texto_tiene_marca",
  },
  {
    nombre: "el disparador no recalcula la huella",
    sql: () => once(FILE_0525, "new.content_sha256 := public.news_huella(pg_catalog.to_jsonb(new));", "null;"),
    cae: "TEST 0525: 13: editar el cuerpo recalcula content_sha256",
  },
  {
    nombre: "el disparador corre antes que la guarda",
    sql: () =>
      once(
        once(FILE_0525, "create trigger news_posts_huella_al_editar_trg", "create trigger news_posts_a_huella_trg"),
        "tgname = 'news_posts_huella_al_editar_trg'",
        "tgname = 'news_posts_a_huella_trg'",
      ),
    cae: "el origen de una noticia no se cambia a mano",
  },
  {
    nombre: "el disparador también toca las manuales",
    sql: () => once(FILE_0525, "if new.publish_via = 'automatica' and (", "if (new.publish_via = 'automatica' or true) and ("),
    cae: "TEST 0525: 13: una manual editada sigue sin huella",
  },
  {
    nombre: "created_by sigue en cascada",
    sql: () =>
      once(
        once(
          FILE_0525,
          "foreign key (created_by) references auth.users(id) on delete set null;",
          "foreign key (created_by) references auth.users(id) on delete cascade;",
        ),
        "is distinct from 'FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL' then",
        "is distinct from 'FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE' then",
      ),
    cae: "TEST 0525: C2: se puede borrar en Auth",
  },
  {
    nombre: "created_by sigue NOT NULL",
    sql: () => once(FILE_0525, "alter table public.seo_drafts alter column created_by drop not null;", ""),
    cae: "TEST 0525: C2: se puede borrar en Auth",
  },
  {
    nombre: "news_salida_motivo queda ejecutable por anon",
    sql: () =>
      once(
        FILE_0525,
        "-- ─── 3. anon sin EXECUTE sobre las funciones de marca y huella ───────────────",
        "grant execute on function public.news_salida_motivo(uuid, text, text) to anon;\n-- ─── 3. anon sin EXECUTE sobre las funciones de marca y huella ───────────────",
      ),
    cae: "TEST 0525: 11: authenticated ejecuta news_salida_motivo y anon no",
  },
  {
    nombre: "news_salida_motivo acepta un motivo nulo",
    sql: () => once(FILE_0525, "if p_motivo is null or p_motivo not in (", "if p_motivo not in ("),
    cae: "TEST 0525: 11: un motivo nulo se rechaza",
  },
  {
    nombre: "news_salida_motivo acepta «otro» sin nota",
    sql: () =>
      once(
        FILE_0525,
        "  if p_motivo = 'otro' and coalesce(pg_catalog.btrim(p_nota), '') = '' then\n    raise exception 'SDD-0611: con «otro» la nota es obligatoria' using errcode = '22023';\n  end if;\n",
        "",
      ),
    cae: "TEST 0525: 11: «otro» sin nota se rechaza",
  },
];

describe("SDD-0611 · 0525 ajustes antes de encender (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0525",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0525 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(20);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0525 cae en la primera aserción",
    async () => {
      const run = await contract({ [M0525]: "select 1;" });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("TEST 0525: 12: anon no ejecuta news_huella");
    },
    SLOW,
  );

  it(
    "la 0525 no se aplica dos veces (preflight)",
    async () => {
      const run = await contract({ [M0525]: `${FILE_0525}\n${FILE_0525}` });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(/0525: news_salida_motivo no tiene el cuerpo de la 0518|0525 ya aplicada/);
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract({ [M0525]: sql() });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(10);
  });
});
