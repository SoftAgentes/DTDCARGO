// @vitest-environment node
/**
 * SDD-0611 · La migración 0518 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0518_noticias_publicacion_automatica.test.sql`
 * aplica las migraciones REALES de noticias (0053, 0055, 0057, 0140) y la 0518,
 * y escribe como la vía automática (service_role), como admins (Sam, Alejandro,
 * otro tenant) y como una cuenta sin permiso. PGlite lo corre con los `.sql`
 * inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0518 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0518 con UN defecto (un filtro de la base quitado) y
 * tiene que caer en la aserción que lo nombra.
 * GEMELAS: la marca [VERIFICAR y la huella dan lo mismo en TypeScript y en SQL.
 * ESPERA: la 0518 está declarada pendiente y no está sellada.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";
import { huellaDe } from "../huella";
import { contarMarcas } from "../marcas";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0518_noticias_publicacion_automatica.test.sql");
const M0518 = "0518_noticias_publicacion_automatica.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0518 = read(resolve(ROOT, "supabase/migrations", M0518));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0518"));
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

describe("SDD-0611 · 0518 publicación automática de noticias (PGlite)", () => {
  it("el contrato pasa entero con la 0518", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0518 GREEN: 63 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0518 cae en la primera aserción", async () => {
    const run = await contract({ [M0518]: "select 1;" });
    expect(run.error).toContain("existe la auditoría de publicaciones");
  }, SLOW);

  const MUTANTES: Array<[string, string, string, string]> = [
    [
      "F1 sin interruptor",
      "  if not found or not v_conf.enabled then\n    v_motivos := pg_catalog.array_append(v_motivos, 'interruptor_apagado');",
      "  if false then\n    v_motivos := pg_catalog.array_append(v_motivos, 'interruptor_apagado');",
      "F1: sin interruptor queda retenida",
    ],
    [
      "F3 sin huella",
      "  elsif v_draft.reviewer_verdict ->> 'huella' is distinct from v_huella\n",
      "  elsif false and v_draft.reviewer_verdict ->> 'huella' is distinct from v_huella\n",
      "F3: una coma cambiada después del veredicto lo vence",
    ],
    [
      "F3 sin veredicto aprobado",
      "     or coalesce(v_draft.reviewer_verdict ->> 'veredicto', '') <> 'aprobado' then\n    v_f3 := 'sin_revisor';",
      "     and false then\n    v_f3 := 'sin_revisor';",
      "F3: sin veredicto queda sin_revisor",
    ],
    [
      "F7 sin tope por día",
      "  if v_dia >= least(coalesce(v_conf.daily_cap, 0), 1) then",
      "  if false then",
      "F7: dos borradores distintos el mismo día publican uno solo",
    ],
    [
      "F7 cuenta también las manuales",
      "   where p.tenant_id = p_tenant_id and p.publish_via = 'automatica';",
      "   where p.tenant_id = p_tenant_id;",
      "F7: una publicada a mano el mismo día no frena a la automática",
    ],
    [
      "F7 sin tope por semana",
      "  elsif v_semana >= coalesce(v_conf.weekly_cap, 0) then",
      "  elsif false then",
      "F7: el tope por semana retiene",
    ],
    [
      "límite duro de 2 por día",
      "constraint news_autopublish_tope_dia check (daily_cap between 0 and 1)",
      "constraint news_autopublish_tope_dia check (daily_cap between 0 and 2)",
      "una configuración de 2 por día se rechaza",
    ],
    [
      "F10 sin slug ni borrador repetido",
      "  if exists (select 1 from public.news_posts where seo_draft_id = p_draft_id)\n     or exists (select 1 from public.news_posts where slug = p_post ->> 'slug') then",
      "  if false then",
      "F10",
    ],
    [
      "F9 sin auditoría completa",
      "    not (via = 'automatica' and decision = 'publicada')\n    or (post_id",
      "    true\n    or (post_id",
      "F9: sin modelo del Redactor la auditoría se rechaza",
    ],
    [
      "criterio 3 sin CHECK de marca",
      "    not published\n    or not (\n",
      "    true\n    or not (\n",
      "la vía manual directa no publica una marca vacía",
    ],
    [
      "guarda de origen apagada",
      "  if current_user in ('authenticated', 'anon', 'service_role') then",
      "  if false then",
      "un admin no escribe una automática por la tabla",
    ],
    [
      "guarda sin service_role",
      "  if current_user in ('authenticated', 'anon', 'service_role') then",
      "  if current_user in ('authenticated', 'anon') then",
      "la llave service_role tampoco escribe una automática por la tabla",
    ],
    [
      "retiro sin motivo",
      "  if p_motivo is null or p_motivo not in (",
      "  if false and p_motivo not in (",
      "sin motivo no se retira",
    ],
    [
      "retiro sin permiso",
      "    raise exception 'SDD-0611: solo un admin retira' using errcode = '42501';",
      "    null;",
      "una cuenta sin permiso no retira",
    ],
    [
      "salida sin registro",
      "  if old.published and not new.published then",
      "  if false then",
      "el retiro queda registrado con motivo, nota y quién",
    ],
    [
      "borrar una automática",
      "    if old.publish_via = 'automatica' and pg_catalog.pg_trigger_depth() = 1 then",
      "    if false then",
      "borrar una noticia publicada sola se rechaza",
    ],
    [
      "manual sin admin",
      "  if v_tenant is null or v_actor is null or not (select public.is_tenant_admin()) then\n    raise exception 'SDD-0611: solo un admin publica a mano'",
      "  if v_tenant is null or v_actor is null then\n    raise exception 'SDD-0611: solo un admin publica a mano'",
      "quien no es admin no publica un retenido",
    ],
    [
      "automática firma con escritor invitado",
      "    case when p_via = 'automatica' then 'DTD Cargo' else coalesce(p_post ->> 'author_name', 'DTD Cargo') end,",
      "    coalesce(p_post ->> 'author_name', 'DTD Cargo'),",
      "la noticia automática firma DTD Cargo",
    ],
    [
      "vía automática abierta a la API",
      "grant execute on function public.news_evaluacion_automatica(uuid, uuid, jsonb, jsonb, jsonb, text[]) to service_role;",
      "grant execute on function public.news_evaluacion_automatica(uuid, uuid, jsonb, jsonb, jsonb, text[]) to service_role, authenticated;",
      "authenticated no puede llamar a la vía automática",
    ],
  ];

  for (const [nombre, from, to, aserto] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae en «${aserto}»`, async () => {
      const run = await contract({ [M0518]: once(FILE_0518, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toContain(aserto);
    }, SLOW);
  }

  it("GEMELAS: la marca [VERIFICAR da lo mismo en TypeScript y en SQL", async () => {
    const MUESTRAS = [
      "[VERIFICAR]", "[VERIFICAR: ]", "[verificar: x]", "[ VERIFICAR algo]", "［VERIFICAR］",
      "[VERI​FICAR]", "[VERI­FICAR]", "x%5BVERIFICAR", "x%5bverificar", "sin marca",
      "verificar suelto", "[nota] normal", "", "[VERIFICAR: 30%]",
    ];
    const db = await pgliteLimpio();
    try {
      await db.exec(`create schema if not exists extensions;
        ${FILE_0518.slice(FILE_0518.indexOf("create function public.news_texto_tiene_marca"), FILE_0518.indexOf("comment on function public.news_texto_tiene_marca"))}`);
      for (const m of MUESTRAS) {
        const { rows } = await db.query<{ v: boolean }>("select public.news_texto_tiene_marca($1) as v", [m]);
        expect(rows[0].v, JSON.stringify(m)).toBe(contarMarcas(m) > 0);
      }
    } finally {
      await db.close();
    }
  }, SLOW);

  it("GEMELAS: la huella da lo mismo en TypeScript y en SQL", async () => {
    const post = {
      tipo: "informativo",
      categoria: "importa-sin-perder-plata",
      title: "Importa · Ñandú y acentos: «comillas»",
      focus_keyword: "importador",
      secondary_keywords: ["uno", "dos"],
      meta_description: "Descripción.",
      body_markdown: "Cuerpo con emoji 🚢 y salto\n\n## Subtítulo",
    };
    const db = await pgliteLimpio();
    try {
      await db.exec(FILE_0518.slice(
        FILE_0518.indexOf("create function public.news_huella"),
        FILE_0518.indexOf("comment on function public.news_huella"),
      ));
      for (const p of [post, { ...post, secondary_keywords: [] }, { ...post, focus_keyword: null, meta_description: null }]) {
        const { rows } = await db.query<{ h: string }>("select public.news_huella($1::jsonb) as h", [JSON.stringify(p)]);
        expect(rows[0].h).toBe(huellaDe(p));
      }
    } finally {
      await db.close();
    }
  }, SLOW);

  it("ESPERA: la 0518 está declarada pendiente y no está sellada", () => {
    const baseline = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
      pendingBelowCutoff: Record<string, string>;
    };
    const lock = JSON.parse(read(resolve(ROOT, "supabase/migrations.lock.json"))) as { selladas: Record<string, unknown> };
    expect(baseline.pendingBelowCutoff["0518_noticias_publicacion_automatica"]).toMatch(/PENDIENTE DE APLICAR/);
    expect(Object.keys(lock.selladas).some((k) => k.startsWith("0518"))).toBe(false);
  });
});
