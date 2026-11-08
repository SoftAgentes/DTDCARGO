// @vitest-environment node
/**
 * SDD-0586 (10.7, PR 2: P4) · La migración 0523 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0523_chatwoot_portal_carga.test.sql` aplica la 0519, la 0520 y la 0523
 * REALES sobre la 0006, la 0106, la 0337, la 0503 y la 0504 reales. Llama la reserva, las líneas de
 * preparado.ndjson (en una transacción de solo lectura) y la vinculación como el servidor de Studio
 * (service_role), y termina con la cola de la 0519: lo cargado no vuelve a salir y lo que cae en el
 * margen del corte sin estar en la foto sale una vez. PGlite lo corre con los `.sql` inlineados.
 *
 * CONTROL ROJO: sin 0523 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0523 coherente con un defecto y tiene que caer en la aserción que lo
 * nombra. Los críticos: la reserva antes de cargar (riesgo 1), el margen del corte (riesgo 2), la
 * minimización de las líneas, y que la vinculación compare las cabeceras, no pise un enviado ni
 * mueva un corte.
 * EN ESPERA: la 0523 se aplica antes de fusionar (migrate-first), con OK nominal de Sam en cada
 * entorno. La última prueba fija que es una espera declarada.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0523_chatwoot_portal_carga";
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0523"));
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

describe("SDD-0586 · 0523 la carga del portal a Chatwoot (PGlite)", () => {
  it("el contrato pasa entero con la 0523", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0523 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0523 la reserva no existe y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/existe chatwoot_portal_reservar_contactos/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // ── La reserva (riesgo 1) ──
    [
      "la reserva con el flag encendido",
      "  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then\n    raise exception 'chatwoot_portal_reservar_contactos: apagar",
      "  if false then\n    raise exception 'chatwoot_portal_reservar_contactos: apagar",
      /TEST 0523: con el flag encendido la reserva se niega/,
    ],
    ["carga fichas borradas", " and cl.tenant_id = c.tenant_id and cl.deleted_at is null\n", " and cl.tenant_id = c.tenant_id\n", /TEST 0523: reserva A y B/],
    ["carga hilos ya vinculados", "    and not exists (select 1 from public.chatwoot_portal_hilos h where h.conversation_id = c.id);", "    ;", /TEST 0523: conteos: 2 contactos/],
    // ── Las líneas (la foto y la minimización) ──
    [
      "las líneas fuera de solo lectura",
      "  if pg_catalog.current_setting('transaction_read_only') <> 'on' then",
      "  if false then",
      /TEST 0523: fuera de una transacción de solo lectura las líneas se niegan/,
    ],
    ["el corte sin margen", "(pg_catalog.transaction_timestamp() - interval '5 minutes')", "(pg_catalog.transaction_timestamp())", /TEST 0523: el corte va 5 minutos antes de la foto/],
    [
      "las líneas sin exigir la reserva",
      "    raise exception 'chatwoot_portal_carga_lineas: falta reservar los contactos (chatwoot_portal_reservar_contactos)' using errcode = '55000';",
      "    null;",
      /TEST 0523: sin reserva las líneas se niegan/,
    ],
    [
      "lleva lo que vino de Chatwoot",
      "  where m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%'\n  order by m.conversation_id, m.sent_at, m.id;",
      "  order by m.conversation_id, m.sent_at, m.id;",
      /TEST 0523: los conteos de la cabecera son los de las líneas/,
    ],
    [
      "el archivado con su estado",
      "      when c.deleted_at is not null then 'resolved'\n      when c.status = 'abierto' then 'open'",
      "      when c.status = 'abierto' then 'open'",
      /TEST 0523: el archivado va resolved/,
    ],
    ["pendiente como open", "      when c.status = 'pendiente' then 'pending'\n      else 'resolved'\n    end,\n    'creada_at'", "      when c.status = 'pendiente' then 'open'\n      else 'resolved'\n    end,\n    'creada_at'", /TEST 0523: pendiente pasa a pending/],
    ["los mensajes al revés", "  order by m.conversation_id, m.sent_at, m.id;", "  order by m.conversation_id, m.sent_at desc, m.id;", /TEST 0523: los mensajes de hA en el orden de sent_at/],
    ["el contacto con el teléfono", "    'tipo', 'contacto', 'cliente', k.client_id, 'identificador', k.identificador, 'nombre', cl.name\n", "    'tipo', 'contacto', 'cliente', k.client_id, 'identificador', k.identificador, 'nombre', cl.name, 'telefono', cl.phone\n", /TEST 0523: el contacto no lleva más campos que los del formato/],
    ["la nota del archivado sin source_id", "      'source_id', 'dtd:archivado:' || c.id::text,", "      'source_id', 'dtd:archivado',", /TEST 0523: el archivado va resolved, con su nota/],
    // ── La vinculación ──
    [
      "la vinculación con el flag encendido",
      "  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then\n    raise exception 'chatwoot_portal_vincular_carga: apagar",
      "  if false then\n    raise exception 'chatwoot_portal_vincular_carga: apagar",
      /TEST 0523: con el flag encendido la vinculación se niega/,
    ],
    ["no compara el corte", "\n     or (v_cab ->> 'corte') is distinct from (p_preparado ->> 'corte') then", " then", /TEST 0523: otra cabecera se rechaza/],
    [
      // Quita la comparación de los mensajes (el caso que prueba el contrato). No sirve anteponer
      // `false and`: AND va antes que OR y las otras dos comparaciones seguirían.
      "no compara los conteos de mensajes",
      "\n     or (v_cab ->> 'mensajes')::integer is distinct from\n       (select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'mensaje') then",
      " then",
      /TEST 0523: conteos que no cuadran se rechazan/,
    ],
    [
      "un identificador cualquiera",
      "    if v_ident::text is distinct from v_linea ->> 'identificador' then",
      "    if false then",
      /TEST 0523: un identificador que no es el reservado se rechaza/,
    ],
    ["pisa un enviado", "\n      where s.estado <> 'enviado';", ";", /TEST 0523: un mensaje ya enviado no se pisa/],
    ["mueve el corte", "    set corte = coalesce(e.corte, excluded.corte),", "    set corte = excluded.corte,", /TEST 0523: un corte que ya existe no se mueve/],
    [
      "un mensaje de un hilo sin vincular",
      "    join public.chatwoot_portal_hilos hl on hl.conversation_id = m.conversation_id and hl.tenant_id = p_tenant_id\n",
      "",
      /TEST 0523: un mensaje de un hilo que no se vinculó se rechaza/,
    ],
    ["el espejo sin client_id", "      v_client, v_ultimo\n    )", "      null, v_ultimo\n    )", /TEST 0523: una fila del espejo por hilo, con su client_id/],
    [
      "marca enviado en vez de cargado",
      "    values ((v_linea ->> 'mensaje')::uuid, p_tenant_id, v_hilo, 'cargado', (v_linea ->> 'mensaje_id')::bigint)",
      "    values ((v_linea ->> 'mensaje')::uuid, p_tenant_id, v_hilo, 'enviado', (v_linea ->> 'mensaje_id')::bigint)",
      /TEST 0523: los demás mensajes cargados quedan cargado/,
    ],
    // ── Acceso (el postflight) ──
    [
      "la vinculación para authenticated",
      "revoke all on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) from public, anon, authenticated;",
      "revoke all on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) from public, anon;\ngrant execute on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) to authenticated;",
      /0523: public\.chatwoot_portal_vincular_carga\(uuid, jsonb, jsonb\) tiene que ser solo de service_role/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(FILE, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si la carga ya existe", async () => {
    const run = await contract({ [MIGRACION]: `${FILE}\n${FILE}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0523: la carga del portal ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la vuelta de la 0520 aborta sin crear nada", async () => {
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(
          `drop function public.chatwoot_portal_respuesta(uuid, bigint, bigint, text, timestamptz, bigint);\n\\ir ../migrations/${MIGRACION}`,
        ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0523 requiere 0519/);
  }, SLOW);

  // Sin código de app/ ni lib/ que llame a sus funciones (los scripts son SQL de infra/ops), no lleva
  // declaración de símbolos: el gate no tiene sitios que vigilar.
  it("en espera: declarada en migrations-baseline.json", () => {
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/^PENDIENTE DE APLICAR/);
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/antes de fusionar/i);
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
