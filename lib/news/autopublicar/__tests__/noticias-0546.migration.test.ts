// @vitest-environment node
/**
 * SDD-0611 §11.4.1 · La migración 0546 (purga de actor_id a los 12 meses) corrida de verdad
 * sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0546_noticias_purga_actor_id.test.sql` monta el fixture de la 0518 y
 * aplica las migraciones REALES 0053, 0055, 0057, 0140, 0518, 0525 y 0546. PGlite lo corre con los
 * `.sql` inlineados: lo que se prueba es el texto que se aplicará.
 *
 * CONTROL ROJO: sin 0546 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0546 con UN defecto y tiene que caer con el mensaje que lo nombra.
 * DESARME: 0546 → desarme → 0546 (el contrato no lo incluye: el control C4 del CI no copia
 * supabase/desarmes). Y el desarme PARA si la purga ya vació uuid.
 * GEMELA: las cuatro columnas que vacía la función son las que lista la spec §11.4.1.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0546_noticias_purga_actor_id.test.sql");
const M0546 = "0546_noticias_purga_actor_id.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0546 = read(resolve(ROOT, "supabase/migrations", M0546));
const DESARME = read(resolve(ROOT, "supabase/desarmes/0546_desarme.sql"));
const SPEC = read(resolve(ROOT, "docs/specs/0611-noticias-publicacion-automatica/spec.md"));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0546"));
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

/** Cada mutante: la 0546 con un defecto y el texto con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "frontera no estricta en las salidas (<=)",
    sql: () => once(FILE_0546, "where actor_id is not null and created_at < v_corte;", "where actor_id is not null and created_at <= v_corte;"),
    cae: "TEST 0546: F: la purga cuenta exactamente",
  },
  {
    nombre: "plazo de 11 meses",
    sql: () => once(FILE_0546, "pg_catalog.now() - interval '12 months'", "pg_catalog.now() - interval '11 months'"),
    cae: "TEST 0546: F: la purga cuenta exactamente",
  },
  {
    nombre: "plazo de 13 meses",
    sql: () => once(FILE_0546, "pg_catalog.now() - interval '12 months'", "pg_catalog.now() - interval '13 months'"),
    cae: "TEST 0546: F: la purga cuenta exactamente",
  },
  {
    nombre: "no vacía news_post_exits",
    sql: () => once(FILE_0546, "where actor_id is not null and created_at < v_corte;", "where false and created_at < v_corte;"),
    cae: "TEST 0546: F: la purga cuenta exactamente",
  },
  {
    nombre: "no vacía news_autopublish_settings",
    sql: () => once(FILE_0546, "where updated_by is not null and updated_at < v_corte;", "where false;"),
    cae: "TEST 0546: F: la purga cuenta exactamente",
  },
  {
    nombre: "la auditoría se vacía sin su marca",
    sql: () => once(FILE_0546, "set actor_id = null, actor_purged_at = v_ahora", "set actor_id = null"),
    cae: "news_audit_manual_con_persona",
  },
  {
    nombre: "authenticated ejecuta la purga",
    sql: () =>
      once(
        FILE_0546,
        "grant execute on function public.news_purgar_actor_id() to service_role;",
        "grant execute on function public.news_purgar_actor_id() to service_role, authenticated;",
      ),
    cae: "0546 postflight: anon o authenticated pueden ejecutar la purga",
  },
  {
    nombre: "sin SECURITY DEFINER",
    sql: () => once(FILE_0546, "security definer\n", ""),
    cae: "0546 postflight: la purga no es SECURITY DEFINER",
  },
  {
    nombre: "sin lock_timeout en la función",
    sql: () => once(FILE_0546, "set lock_timeout = '5s'\n", ""),
    cae: "0546 postflight: la purga necesita search_path vacío y lock_timeout",
  },
  {
    nombre: "el CHECK de persona se afloja para filas nuevas",
    sql: () => once(FILE_0546, "via = 'automatica' or actor_id is not null or actor_purged_at is not null)", "true)"),
    cae: "TEST 0546: M: una fila manual nueva sin uuid y sin marca se rechaza",
  },
  {
    nombre: "uuid y marca pueden convivir en la auditoría",
    sql: () => once(FILE_0546, "actor_purged_at is null or actor_id is null) not valid;", "true) not valid;"),
    cae: "TEST 0546: M: uuid y marca de purga a la vez se rechazan (auditoría)",
  },
  {
    nombre: "el log queda NOT NULL",
    sql: () => once(FILE_0546, "alter column changed_by drop not null;", "alter column changed_by set not null;"),
    cae: "0546 postflight: changed_by sigue NOT NULL",
  },
];

describe("SDD-0611 §11.4.1 · 0546 purga de actor_id (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0546",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0546 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(30);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0546 cae en la primera aserción",
    async () => {
      const run = await contract({ [M0546]: "select 1;" });
      expect(run.green).toBeUndefined();
      expect(run.error).toBeTruthy();
    },
    SLOW,
  );

  it(
    "la 0546 no se aplica dos veces (preflight)",
    async () => {
      const run = await contract({ [M0546]: `${FILE_0546}\n${FILE_0546}` });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("0546 ya aplicada");
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract({ [M0546]: sql() });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(12);
  });

  it(
    "DESARME: 0546 → desarme → 0546 y el contrato pasa",
    async () => {
      const run = await contract({ [M0546]: `${FILE_0546}\n${DESARME}\n${FILE_0546}` });
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0546 GREEN: \d+ aserciones$/);
    },
    SLOW,
  );

  it(
    "DESARME: para si la purga ya vació uuid (lo vaciado no vuelve)",
    async () => {
      const run = await contract({ [M0546]: `${FILE_0546}\nselect public.news_purgar_actor_id();\n${DESARME}` });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("la purga ya vació uuid");
    },
    SLOW,
  );

  it("GEMELA: la función vacía las cuatro columnas de la spec §11.4.1 (y solo esas)", () => {
    const listadas = [...SPEC.slice(SPEC.indexOf("#### 11.4.1")).split("#### 11.4.2")[0].matchAll(/^- `(news_\w+)\.(\w+)`;?\.?$/gm)].map(
      (m) => `${m[1]}.${m[2]}`,
    );
    expect(listadas.sort()).toEqual([
      "news_autopublish_settings.updated_by",
      "news_autopublish_settings_log.changed_by",
      "news_post_exits.actor_id",
      "news_publication_audit.actor_id",
    ]);
    for (const columna of listadas) {
      const [tabla, col] = columna.split(".");
      expect(FILE_0546, columna).toMatch(new RegExp(`update public\\.${tabla}\\s+set ${col} = null`));
    }
    // Cuatro UPDATE en la función y ninguno más: no borra filas.
    const funcion = FILE_0546.slice(FILE_0546.indexOf("create or replace function public.news_purgar_actor_id()"));
    expect(funcion.match(/^\s*update public\./gm)).toHaveLength(4);
    expect(funcion).not.toMatch(/\bdelete\s+from\b/i);
  });
});
