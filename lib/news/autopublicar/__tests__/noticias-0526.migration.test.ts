// @vitest-environment node
/**
 * SDD-0611 (N1) · La migración 0526 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0526_noticias_anon_solo_columnas_publicas.test.sql`
 * monta el fixture de la 0518 y aplica las migraciones REALES 0053, 0055, 0057,
 * 0140, 0518, 0525 y 0526. PGlite lo corre con los `.sql` inlineados: lo que se
 * prueba es el texto que se aplicará.
 *
 * CONTROL ROJO: sin 0526 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0526 con UN defecto (y su postflight ciego a él) y
 * tiene que caer con el mensaje que lo nombra.
 * GEMELA: las columnas que la 0526 da a anon son exactamente COLUMNAS_PUBLICAS
 * de `lib/public/news-queries.ts`; si el sitio pide una más, /noticias quedaría
 * vacía en producción.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0526_noticias_anon_solo_columnas_publicas.test.sql");
const M0526 = "0526_noticias_anon_solo_columnas_publicas.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0526 = read(resolve(ROOT, "supabase/migrations", M0526));
const QUERIES = read(resolve(ROOT, "lib/public/news-queries.ts"));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0526"));
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

const POSTFLIGHT_TABLA =
  "  if pg_catalog.has_table_privilege('anon', 'public.news_posts', 'select') then\n" +
  "    raise exception '0526 postflight: anon sigue con SELECT de tabla';\n" +
  "  end if;\n";
const GRANT = "grant select (\n  id, slug,";

/** Cada mutante: la 0526 con un defecto y el texto con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "sin revoke del SELECT de tabla",
    sql: () =>
      once(
        once(once(FILE_0526, "revoke select on public.news_posts from anon;", ""), POSTFLIGHT_TABLA, ""),
        "array[\n    'created_by', 'publish_via', 'seo_draft_id', 'content_sha256', 'tenant_id', 'source']",
        "array[]::text[]",
      ),
    cae: "TEST 0526: N1: anon no lee created_by",
  },
  {
    nombre: "el grant incluye created_by",
    sql: () =>
      once(
        once(FILE_0526, GRANT, "grant select (\n  created_by, id, slug,"),
        "    'created_by', 'publish_via', 'seo_draft_id'",
        "    'publish_via', 'seo_draft_id'",
      ),
    cae: "TEST 0526: N1: anon no lee created_by",
  },
  {
    nombre: "el grant incluye publish_via",
    sql: () =>
      once(
        once(FILE_0526, GRANT, "grant select (\n  publish_via, id, slug,"),
        "    'created_by', 'publish_via', 'seo_draft_id'",
        "    'created_by', 'seo_draft_id'",
      ),
    cae: "TEST 0526: N1: anon no lee publish_via",
  },
  {
    nombre: "el grant incluye tenant_id",
    sql: () =>
      once(
        once(FILE_0526, GRANT, "grant select (\n  tenant_id, id, slug,"),
        "'content_sha256', 'tenant_id', 'source'] loop",
        "'content_sha256', 'source'] loop",
      ),
    cae: "TEST 0526: N1: anon no lee tenant_id",
  },
  {
    nombre: "el grant olvida body_markdown",
    sql: () => {
      const sinGrant = once(FILE_0526, "title, excerpt, body_markdown,\n  author_name", "title, excerpt,\n  author_name");
      // El postflight de las públicas también deja de mirarla.
      const partes = sinGrant.split("'excerpt', 'body_markdown',");
      expect(partes).toHaveLength(3); // preflight y postflight
      return partes[0] + "'excerpt', 'body_markdown'," + partes[1] + "'excerpt'," + partes[2];
    },
    cae: "TEST 0526: L: listPublishedPosts lee las 18 columnas",
  },
  {
    nombre: "también le quita el SELECT a authenticated",
    sql: () =>
      once(
        once(FILE_0526, "revoke select on public.news_posts from anon;", "revoke select on public.news_posts from anon, authenticated;"),
        "  if not pg_catalog.has_table_privilege('authenticated', 'public.news_posts', 'select') then\n" +
          "    raise exception '0526 postflight: authenticated perdió el SELECT de tabla';\n" +
          "  end if;\n",
        "",
      ),
    cae: "TEST 0526: S: authenticated sigue leyendo created_by y publish_via",
  },
];

/** Columnas del `grant select (…)` de la 0526. */
function columnasDelGrant(sql: string): string[] {
  const m = sql.match(/grant select \(([^)]*)\) on public\.news_posts to anon;/);
  expect(m, "la 0526 tiene un grant select (…) a anon").not.toBeNull();
  return m![1].split(",").map((c) => c.trim()).filter(Boolean);
}

/** Columnas del literal COLUMNAS_PUBLICAS. */
function columnasPublicas(src: string): string[] {
  const m = src.match(/const COLUMNAS_PUBLICAS =\s*"([^"]+)"/);
  expect(m, "news-queries.ts declara COLUMNAS_PUBLICAS").not.toBeNull();
  return m![1].split(",").map((c) => c.trim());
}

describe("SDD-0611 · 0526 anon solo columnas públicas (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0526",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0526 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(16);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0526 cae en la primera aserción",
    async () => {
      const run = await contract({ [M0526]: "select 1;" });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("TEST 0526: N1: anon no lee created_by");
    },
    SLOW,
  );

  it(
    "la 0526 no se aplica dos veces (preflight)",
    async () => {
      const run = await contract({ [M0526]: `${FILE_0526}\n${FILE_0526}` });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("0526 ya aplicada");
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract({ [M0526]: sql() });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(6);
  });

  it("GEMELA: el grant de anon es exactamente COLUMNAS_PUBLICAS", () => {
    const grant = columnasDelGrant(FILE_0526);
    const publicas = columnasPublicas(QUERIES);
    expect(publicas).toHaveLength(18);
    expect([...grant].sort()).toEqual([...publicas].sort());
    for (const interna of ["created_by", "publish_via", "seo_draft_id", "content_sha256", "tenant_id", "source"]) {
      expect(grant).not.toContain(interna);
    }
  });
});
