// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1a) · La migración 0519 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0519_chatwoot_portal.test.sql` aplica la 0519 REAL sobre la
 * 0006, la 0106, la 0337, la 0503 y la 0504 reales, y llama sus funciones como el servidor de
 * Studio (service_role). PGlite lo corre con los `.sql` inlineados: lo que se prueba es el
 * texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0519 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0519 coherente con un defecto y tiene que caer en la aserción que
 * lo nombra. Los críticos de E10-D34: un envío por hilo, el orden y no saltarse al siguiente.
 * ESPERA: la 0519 está declarada como pendiente y no se aplica sin el OK nominal de Sam.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0519_chatwoot_portal";
const CONTRACT = resolve(ROOT, `supabase/tests/${NOMBRE}.test.sql`);
const MIGRACION = `${NOMBRE}.sql`;
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE = read(resolve(ROOT, "supabase/migrations", MIGRACION));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0519"));
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

describe("SDD-0586 · 0519 la ida del portal a Chatwoot (PGlite)", () => {
  it("el contrato pasa entero con la 0519", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0519 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0519 el catálogo no tiene el flag y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_portal/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // ── Críticos (E10-D34) ──
    [
      "orden: el más nuevo primero dentro del hilo",
      "      order by m.sent_at, m.id\n      limit 1",
      "      order by m.sent_at desc, m.id\n      limit 1",
      /TEST 0519: el más viejo primero|TEST 0519: después de a1 sale a2/,
    ],
    [
      "orden: se salta al siguiente mientras la cabeza espera",
      "        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by m.sent_at, m.id",
      "        and (s.estado is null or s.estado not in ('enviado', 'cargado', 'pendiente', 'atascado'))\n      order by m.sent_at, m.id",
      /TEST 0519: mientras a2 espera, a3 no sale/,
    ],
    [
      "un colgado no cuenta como incierto",
      "          verificar  = s.verificar or s.estado = 'enviando',",
      "          verificar  = s.verificar,",
      /TEST 0519: el colgado cuenta como incierto/,
    ],
    [
      "verificar se apaga en el siguiente fallo",
      "  set estado = 'pendiente', proximo_at = pg_catalog.now() + v_espera, error = p_error,\n      verificar = v_fila.verificar or coalesce(p_incierto, false),",
      "  set estado = 'pendiente', proximo_at = pg_catalog.now() + v_espera, error = p_error,\n      verificar = coalesce(p_incierto, false),",
      /TEST 0519: verificar no se apaga sin salir/,
    ],
    [
      "el intento viejo cierra el nuevo",
      "  if not found or v_fila.estado <> 'enviando' or v_fila.intentos <> p_intento then",
      "  if not found or v_fila.estado <> 'enviando' then",
      /TEST 0519: el intento viejo no escribe/,
    ],
    // ── Qué entra ──
    [
      "sin el flag",
      "  if not exists (\n    select 1 from public.feature_flags f\n    where f.tenant_id = p_tenant_id and f.key = 'chatwoot_portal' and f.enabled\n  ) then\n    return;\n  end if;\n  select e.corte into v_corte from public.chatwoot_portal_estado e where e.tenant_id = p_tenant_id;\n  if v_corte is null then\n    return;\n  end if;\n\n  for v_hilo in",
      "  select e.corte into v_corte from public.chatwoot_portal_estado e where e.tenant_id = p_tenant_id;\n  if v_corte is null then\n    return;\n  end if;\n\n  for v_hilo in",
      /TEST 0519: con el flag apagado no se toma nada/,
    ],
    [
      "sin el corte",
      "        and m.sent_at >= v_corte\n        and (m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%')\n        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by",
      "        and (m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%')\n        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by",
      /TEST 0519: el más viejo primero|TEST 0519: lo de antes del corte no se manda/,
    ],
    [
      "lo que vino de Chatwoot vuelve",
      "        and m.sent_at >= v_corte\n        and (m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%')\n        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by",
      "        and m.sent_at >= v_corte\n        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by",
      /TEST 0519: el más viejo primero|TEST 0519: lo que vino de Chatwoot no vuelve/,
    ],
    [
      "manda lo saliente",
      "        and m.direction = 'in'\n        and m.sent_at >= v_corte",
      "        and m.sent_at >= v_corte",
      /TEST 0519: después de a1 sale a2/,
    ],
    [
      "otro canal",
      "      and c.channel = 'portal'\n      and (p_conversation_id is null or c.id = p_conversation_id)",
      "      and (p_conversation_id is null or c.id = p_conversation_id)",
      /TEST 0519: uno por hilo: dos hilos del portal vivos/,
    ],
    [
      "ficha borrada",
      "        where cl.id = c.client_id and cl.tenant_id = p_tenant_id and cl.deleted_at is null\n      )\n      and (cab.estado",
      "        where cl.id = c.client_id and cl.tenant_id = p_tenant_id\n      )\n      and (cab.estado",
      /TEST 0519: uno por hilo: dos hilos del portal vivos/,
    ],
    // ── Reintentos ──
    [
      "espera fija",
      "    when 2 then interval '2 minutes'",
      "    when 2 then interval '1 minute'",
      /TEST 0519: la espera del intento 2 es 00:02:00/,
    ],
    [
      "sin tope de 15 minutos",
      "    else interval '15 minutes'",
      "    else interval '16 minutes'",
      /TEST 0519: la espera del intento 5 es 00:15:00/,
    ],
    [
      "nunca se atasca",
      "  if pg_catalog.now() - v_fila.created_at >= interval '24 hours' then",
      "  if pg_catalog.now() - v_fila.created_at >= interval '48 hours' then",
      /TEST 0519: a las 24 h del primer intento queda atascado/,
    ],
    [
      "un atascado se reintenta",
      "        and (s.estado is null or s.estado not in ('enviado', 'cargado'))\n      order by m.sent_at, m.id",
      "        and (s.estado is null or s.estado not in ('enviado', 'cargado', 'atascado'))\n      order by m.sent_at, m.id",
      /TEST 0519: un atascado detiene su hilo/,
    ],
    // ── Vínculo ──
    [
      "vincular no deja el client_id",
      "    set client_id = excluded.client_id,\n        inbox_id  = coalesce(cc.inbox_id, excluded.inbox_id);",
      "    set inbox_id  = coalesce(cc.inbox_id, excluded.inbox_id);",
      /TEST 0519: si el evento llegó antes, vincular completa el client_id/,
    ],
    [
      "una ficha con dos contactos",
      "  if v_actual is not null and v_actual <> p_contacto_id then",
      "  if false then",
      /TEST 0519: una ficha no tiene dos contactos/,
    ],
    [
      "un hilo con dos conversaciones",
      "  if v_actual is distinct from p_conversacion_id then",
      "  if v_actual is null then",
      /TEST 0519: un hilo no tiene dos conversaciones/,
    ],
    [
      "un teléfono como source_id",
      " and chatwoot_source_id !~ '^\\+?[0-9]+$'",
      "",
      /TEST 0519: un source_id que es un teléfono se rechaza/,
    ],
    // ── Aviso, flag y acceso ──
    [
      "el aviso cuenta lo reciente",
      "    and m.sent_at <= pg_catalog.now() - interval '15 minutes';",
      "    and m.sent_at <= pg_catalog.now();",
      /TEST 0519: el aviso cuenta lo del portal que lleva más de 15 min sin llegar/,
    ],
    [
      "el flag nace encendido",
      "    ('chatwoot_portal',       false, 'Conversaciones del portal en Chatwoot')",
      "    ('chatwoot_portal',       true, 'Conversaciones del portal en Chatwoot')",
      /0519: el catálogo no quedó con chatwoot_portal apagado/,
    ],
    [
      "tomar abierto a authenticated",
      "grant execute on function public.chatwoot_portal_tomar(uuid, integer, uuid) to service_role;",
      "grant execute on function public.chatwoot_portal_tomar(uuid, integer, uuid) to service_role, authenticated;",
      /0519: public\.chatwoot_portal_tomar\(uuid, integer, uuid\) tiene que ser solo de service_role/,
    ],
    [
      "la cola legible desde la API",
      "grant all on public.chatwoot_portal_salida to service_role;",
      "grant all on public.chatwoot_portal_salida to service_role;\ngrant select on public.chatwoot_portal_salida to authenticated;",
      /0519: public\.chatwoot_portal_salida tiene que tener RLS y ningún permiso/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(FILE, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  /**
   * Defensa doble: la cabeza del hilo y la guarda del upsert miran lo mismo, y el tenant se
   * filtra en el hilo, en el mensaje y en la ficha. Con una sola sesión cualquiera alcanza; la
   * guarda sola protege cuando dos sesiones leen la misma cabeza, y eso PGlite no lo reproduce.
   * Por eso el defecto real, y su mutante, rompe todos los lugares a la vez.
   */
  const MUTANTES_DOBLES: [string, [string, string][], RegExp][] = [
    [
      "dos envíos por hilo: un envío en curso se retoma enseguida",
      [
        [
          "           or (cab.estado = 'enviando' and cab.tomado_at <= pg_catalog.now() - interval '5 minutes'))",
          "           or (cab.estado = 'enviando'))",
        ],
        [
          "         or (s.estado = 'enviando' and s.updated_at <= pg_catalog.now() - interval '5 minutes')",
          "         or (s.estado = 'enviando')",
        ],
      ],
      /TEST 0519: un hilo con un envío en curso no da nada/,
    ],
    [
      "dos envíos por hilo: un colgado no espera sus 5 minutos",
      [
        [
          "           or (cab.estado = 'enviando' and cab.tomado_at <= pg_catalog.now() - interval '5 minutes'))",
          "           or (cab.estado = 'enviando' and cab.tomado_at <= pg_catalog.now() - interval '1 minute'))",
        ],
        [
          "         or (s.estado = 'enviando' and s.updated_at <= pg_catalog.now() - interval '5 minutes')",
          "         or (s.estado = 'enviando' and s.updated_at <= pg_catalog.now() - interval '1 minute')",
        ],
      ],
      /TEST 0519: un envío de 4 minutos sigue en curso/,
    ],
    [
      "otro tenant",
      [
        ["    where c.tenant_id = p_tenant_id\n      and c.channel = 'portal'", "    where c.channel = 'portal'"],
        ["        and m.tenant_id = p_tenant_id\n        and m.direction = 'in'", "        and m.direction = 'in'"],
        [
          "        where cl.id = c.client_id and cl.tenant_id = p_tenant_id and cl.deleted_at is null\n      )\n      and (cab.estado",
          "        where cl.id = c.client_id and cl.deleted_at is null\n      )\n      and (cab.estado",
        ],
      ],
      /TEST 0519: uno por hilo: dos hilos del portal vivos|TEST 0519: otro tenant no entra/,
    ],
  ];

  for (const [nombre, cambios, espera] of MUTANTES_DOBLES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const mutada = cambios.reduce((texto, [from, to]) => once(texto, from, to), FILE);
      const run = await contract({ [MIGRACION]: mutada });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si los objetos ya existen", async () => {
    const run = await contract({ [MIGRACION]: `${FILE}\n${FILE}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0519: los objetos del portal en Chatwoot ya existen/);
  }, SLOW);

  it("PREFLIGHT: sin la 0504 aborta sin crear nada", async () => {
    const run = await contract({ "0504_chatwoot_eventos.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0519 requiere 0106 .* 0504/);
  }, SLOW);

  it("PREFLIGHT: un catálogo distinto del de la 0503 aborta, no se le borra un flag", async () => {
    const run = await contract({
      // split/join y no replace: en el reemplazo de String.replace, «$$» vale «$».
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(
          "create or replace function public.feature_flag_catalog() returns table (key text, enabled boolean, description text)\n" +
            "language sql immutable as $$ select 'solo_uno'::text, false, 'otro catálogo'::text $$;\n" +
            `\\ir ../migrations/${MIGRACION}`,
        ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0519: feature_flag_catalog\(\) no es la de 0503/);
  }, SLOW);

  it("la 0519 está declarada como espera y su cabecera lo dice", () => {
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/^PENDIENTE DE APLICAR/);
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/OK nominal de Sam/);
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
