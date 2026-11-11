// @vitest-environment node
/**
 * SDD-0625 · La migración 0532 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0532_noticias_edicion_auditada.test.sql` monta el
 * writer AUD-01 real (0267 + 0294) y las migraciones reales de noticias (0053,
 * 0055, 0057, 0140, 0518, 0525) y aplica la 0532. PGlite lo corre con los `.sql`
 * inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0532 el contrato cae en la primera aserción de evento.
 * MUTANTES: cada uno es una 0532 con UN defecto y tiene que caer con el mensaje
 * que lo nombra.
 * ESPERA: la 0532 está declarada en migrations-baseline.json › pendingBelowCutoff.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0532_noticias_edicion_auditada.test.sql");
const M0532 = "0532_noticias_edicion_auditada.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0532 = read(resolve(ROOT, "supabase/migrations", M0532));
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  pendingBelowCutoff: Record<string, string>;
};
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0532"));
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

const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "el actor sale del formulario y no del JWT (siempre system)",
    sql: () => once(FILE_0532, "v_actor_id uuid := auth.uid();", "v_actor_id uuid := null;"),
    cae: "TEST 0532: E1: el evento lleva al admin como actor",
  },
  {
    nombre: "la bitácora copia el titular",
    sql: () =>
      once(
        FILE_0532,
        "    'published', v_new -> 'published',\n",
        "    'published', v_new -> 'published',\n    'title', v_new -> 'title',\n",
      ),
    cae: "TEST 0532: E1: el evento no copia el texto de la noticia",
  },
  {
    nombre: "un UPDATE sin cambios igual deja evento",
    sql: () => once(FILE_0532, "  if v_changed = '[]'::jsonb then\n    return new;\n  end if;\n", ""),
    cae: "TEST 0532: E2: un UPDATE que no cambia nada no deja evento",
  },
  {
    nombre: "el retiro no distingue la salida",
    sql: () => once(FILE_0532, "    v_event_type := 'news_post_withdrawn';", "    v_event_type := 'news_post_updated';"),
    cae: "TEST 0532: E3: retirar deja un news_post_withdrawn",
  },
  {
    nombre: "el retiro no lleva el motivo",
    sql: () =>
      once(
        FILE_0532,
        "else 'Noticia retirada del sitio. Motivo: ' || v_motivo || '.' end;",
        "else 'Noticia retirada del sitio.' end;",
      ),
    cae: "TEST 0532: E3: el retiro lleva el motivo y el actor",
  },
  {
    nombre: "volver a publicar no deja evento propio",
    sql: () => once(FILE_0532, "    v_event_type := 'news_post_republished';", "    v_event_type := 'news_post_updated';"),
    cae: "TEST 0532: E5: volver a publicar deja un news_post_republished",
  },
  {
    nombre: "el disparador queda ejecutable por la API",
    sql: () =>
      once(
        once(
          FILE_0532,
          "revoke all on function public.audit_news_post_change() from public, anon, authenticated;",
          "grant execute on function public.audit_news_post_change() to anon, authenticated;",
        ),
        "  if pg_catalog.has_function_privilege('authenticated', 'public.audit_news_post_change()', 'EXECUTE')\n     or pg_catalog.has_function_privilege('anon', 'public.audit_news_post_change()', 'EXECUTE') then\n    raise exception '0532 postflight: audit_news_post_change quedó ejecutable por la API';\n  end if;\n",
        "",
      ),
    cae: "TEST 0532: E7: la API no ejecuta la función del disparador",
  },
];

describe("SDD-0625 · 0532 edición de noticias auditada (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0532",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0532 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(17);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0532 cae en la primera aserción de evento",
    async () => {
      const run = await contract({ [M0532]: "select 1;" });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("TEST 0532: E1: corregir deja un news_post_updated");
    },
    SLOW,
  );

  it(
    "la 0532 no se aplica dos veces (preflight)",
    async () => {
      const run = await contract({ [M0532]: `${FILE_0532}\n${FILE_0532}` });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("0532 ya aplicada");
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract({ [M0532]: sql() });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(7);
  });

  it("la 0532 está declarada como espera y su cabecera dice que no está aplicada", () => {
    expect(BASELINE.pendingBelowCutoff).toHaveProperty("0532_noticias_edicion_auditada");
    expect(FILE_0532).toContain("NO APLICADA A PRODUCCIÓN");
  });
});
