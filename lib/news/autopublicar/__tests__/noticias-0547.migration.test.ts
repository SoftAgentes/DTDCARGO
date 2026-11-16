// @vitest-environment node
/**
 * SDD-0611 §11.5 · La migración 0547 (portada con licencia) corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0547_noticias_portada_licencia.test.sql` monta el fixture de la 0518 y
 * aplica las migraciones REALES 0053, 0055, 0057, 0140, 0518, 0525, 0526 y 0547. PGlite lo corre con
 * los `.sql` inlineados: lo que se prueba es el texto que se aplicará.
 *
 * CONTROL ROJO: sin 0547 el contrato cae en la primera aserción.
 * DESARME: la vuelta vive solo aquí (el control C4 del CI no copia supabase/desarmes/): se mete el
 * desarme REAL y sus aserciones justo antes del conteo final, y otra prueba comprueba que aborta
 * mientras haya portadas guardadas.
 * MUTANTES: cada uno es una 0547 con UN defecto y tiene que caer con el mensaje que lo nombra.
 * GEMELAS: la lista de columnas que anon lee y la marca anterior coinciden con el código.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";
import { MARCA_ANTERIOR_RE } from "@/lib/news/portada";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0547_noticias_portada_licencia.test.sql");
const M0547 = "0547_noticias_portada_licencia.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0547 = read(resolve(ROOT, "supabase/migrations", M0547));
const DESARME = read(resolve(ROOT, "supabase/desarmes/0547_desarme.sql"));
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

/** Un único cambio sobre un texto; falla si lo que se cambia no aparece una sola vez. */
function once(text: string, from: string, to: string): string {
  expect(text.split(from), `«${from.slice(0, 60)}…» debe aparecer una sola vez`).toHaveLength(2);
  return text.split(from).join(to);
}

const CONTEO_FINAL = "select 'TEST 0547 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;";

/** El desarme, con las portadas de la prueba ya borradas (si no, aborta a propósito). */
const BLOQUE_DESARME = `-- (Z) El desarme deja todo como antes de la 0547.
update public.news_posts set cover_image_url = null, cover_alt = null, cover_origin = null,
  cover_credit = null, cover_license = null, cover_source_url = null, cover_license_verified_at = null;
update public.seo_drafts set autopub_cover_origin = null, autopub_cover_source_url = null;
${DESARME}
select pg_temp.assert_true(
  not exists (select 1 from information_schema.columns where table_schema = 'public'
                and table_name = 'news_posts' and column_name like 'cover\\_%')
  and not exists (select 1 from information_schema.columns where table_schema = 'public'
                and table_name = 'seo_drafts' and column_name in
                ('autopub_cover_alt', 'autopub_cover_origin', 'autopub_cover_credit', 'autopub_cover_license',
                 'autopub_cover_source_url', 'autopub_cover_license_verified_at'))
  and exists (select 1 from information_schema.columns where table_schema = 'public'
                and table_name = 'seo_drafts' and column_name = 'autopub_cover_image_url'),
  '(Z) el desarme quita las columnas de la 0547 y deja la de la 0518');
select pg_temp.assert_true(
  not exists (select 1 from pg_constraint where conname in
    ('news_posts_portada_con_permiso', 'news_posts_portada_campos', 'seo_drafts_portada_forma'))
  and position('cover' in pg_get_functiondef('public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)'::regprocedure)) = 0
  and not has_function_privilege('anon', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.news_insertar_post(uuid,text,uuid,jsonb,text,uuid)', 'execute'),
  '(Z) el desarme quita los CHECK, devuelve el cuerpo de la 0518 y conserva los privilegios');
select pg_temp.assert_true(
  (select count(*) from public.news_posts where published) >= 20
  and public.news_insertar_post('10000000-0000-4000-8000-000000000001', 'manual', null,
    '{"slug":"despues-del-desarme","tipo":"informativo","categoria":"importa-sin-perder-plata","title":"t","excerpt":"e","body_markdown":"b"}'::jsonb,
    repeat('a', 64), '20000000-0000-4000-8000-000000000001') is not null,
  '(Z) las filas se conservan y la función vuelve a publicar sin portada');
`;

async function contract(opts: { replace?: Record<string, string>; despues?: string } = {}) {
  const db = await pgliteLimpio();
  try {
    let sql = inline(CONTRACT, opts.replace ?? {});
    if (opts.despues !== undefined) sql = once(sql, CONTEO_FINAL, opts.despues + "\n" + CONTEO_FINAL);
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0547"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

const conMigracion = (sql: string) => ({ replace: { [M0547]: sql } });

/** Cada mutante: la 0547 con un defecto y el texto con que tiene que caer. */
const MUTANTES: { nombre: string; sql: () => string; cae: string }[] = [
  {
    nombre: "el CHECK no exige la comprobación de la licencia",
    sql: () => once(FILE_0547, "        and cover_license_verified_at is not null\n", ""),
    cae: "TEST 0547: N: sin-comprobar se publica sin portada",
  },
  {
    nombre: "el CHECK deja pasar la marca anterior",
    sql: () =>
      once(FILE_0547, "        and cover_image_url !~* 'door.{0,6}t[uo].{0,6}door|door.{0,6}2.{0,6}door'\n", ""),
    cae: "TEST 0547: N: doortudoor se publica sin portada",
  },
  {
    nombre: "una foto de la fuente sin enlace de origen",
    sql: () => once(FILE_0547, "        and (cover_origin = 'propia' or cover_source_url is not null)\n", ""),
    cae: "TEST 0547: N: fuente-sin-enlace se publica sin portada",
  },
  {
    nombre: "cualquier host https vale",
    sql: () => once(FILE_0547, "'^https://[a-z0-9-]+\\.supabase\\.co/storage", "'^https://[a-z0-9.-]+/storage"),
    cae: "TEST 0547: N: host-parecido se publica sin portada",
  },
  {
    nombre: "la función no reintenta sin portada (retiene la noticia)",
    sql: () =>
      once(
        FILE_0547,
        "      if v_intento = 2 or v_cons is null\n         or v_cons not in ('news_posts_portada_con_permiso', 'news_posts_portada_campos') then\n        raise;\n      end if;\n",
        "      raise;\n",
      ),
    cae: "news_posts_portada_con_permiso",
  },
  {
    nombre: "anon lee también la fecha de comprobación",
    sql: () => {
      const conGrant = once(
        FILE_0547,
        "grant select (cover_image_url, cover_alt, cover_origin, cover_credit, cover_license, cover_source_url)",
        "grant select (cover_image_url, cover_alt, cover_origin, cover_credit, cover_license, cover_source_url, cover_license_verified_at)",
      );
      // El postflight también deja de mirarla: así solo el contrato la atrapa.
      return once(conGrant, "    'cover_license_verified_at', 'created_by', 'publish_via',", "    'created_by', 'publish_via',");
    },
    cae: "TEST 0547: A2: anon no lee cover_license_verified_at",
  },
];

/** Columnas del `grant select (…)` de la 0547. */
function columnasDelGrant(sql: string): string[] {
  const m = sql.match(/grant select \(([^)]*)\)\s+on public\.news_posts to anon;/);
  expect(m, "la 0547 tiene un grant select (…) a anon").not.toBeNull();
  return m![1].split(",").map((c) => c.trim()).filter(Boolean);
}

describe("SDD-0611 §11.5 · 0547 portada con licencia (PGlite)", () => {
  it(
    "el contrato pasa entero con la 0547",
    async () => {
      const run = await contract();
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0547 GREEN: \d+ aserciones$/);
      expect(Number(run.green!.match(/(\d+) aserciones/)![1])).toBeGreaterThanOrEqual(40);
    },
    SLOW,
  );

  it(
    "CONTROL ROJO: sin la 0547 cae en la primera aserción",
    async () => {
      const run = await contract(conMigracion("select 1;"));
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("TEST 0547: C0: news_posts tiene las 7 columnas de portada");
    },
    SLOW,
  );

  it(
    "la 0547 no se aplica dos veces (preflight)",
    async () => {
      const run = await contract(conMigracion(`${FILE_0547}\n${FILE_0547}`));
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("0547 ya aplicada");
    },
    SLOW,
  );

  it.each(MUTANTES)(
    "MUTANTE «$nombre» cae",
    async ({ sql, cae }) => {
      const run = await contract(conMigracion(sql()));
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(cae);
    },
    SLOW,
  );

  it("hay un mutante por defecto protegido (piso)", () => {
    expect(MUTANTES.length).toBeGreaterThanOrEqual(6);
  });

  it(
    "DESARME: deja la base como antes de la 0547, con sus filas",
    async () => {
      const run = await contract({ despues: BLOQUE_DESARME });
      expect(run.error).toBeNull();
      expect(run.green).toMatch(/^TEST 0547 GREEN: \d+ aserciones$/);
    },
    SLOW,
  );

  it(
    "DESARME: aborta, sin cambiar nada, mientras haya portadas guardadas",
    async () => {
      const run = await contract({ despues: DESARME });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain("Desarme abortado: hay noticias con portada propia");
    },
    SLOW,
  );

  it("GEMELA: anon lee seis columnas de portada, ninguna interna, y el sitio las pide aparte", () => {
    const grant = columnasDelGrant(FILE_0547);
    expect(grant).toEqual(["cover_image_url", "cover_alt", "cover_origin", "cover_credit", "cover_license", "cover_source_url"]);
    const m = QUERIES.match(/const COLUMNAS_PORTADA =\s*"([^"]+)"/);
    expect(m, "news-queries.ts declara COLUMNAS_PORTADA").not.toBeNull();
    const pedidas = m![1].split(",").map((c) => c.trim());
    expect(pedidas.filter((c) => c !== "slug").sort()).toEqual([...grant].sort());
    expect(pedidas).not.toContain("cover_license_verified_at");
  });

  it("GEMELA: la marca anterior de la base es la misma expresión que la del código", () => {
    const m = FILE_0547.match(/!~\* '([^']+)'/);
    expect(m, "la 0547 tiene el CHECK de la marca anterior").not.toBeNull();
    expect(m![1]).toBe(MARCA_ANTERIOR_RE.source);
  });
});
