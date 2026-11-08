// @vitest-environment node
/**
 * SDD-0586 (10.7) · La migración 0524 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0524_chatwoot_portal_puerta4.test.sql` aplica la 0519, la 0520, la 0523, la
 * 0508 y la 0524 REALES y corre el contrato de la 0523 entero (que sigue valiendo con la 0524 encima),
 * más los puntos 4 (la cola no tocó lo que se carga), 5 (contactos completos y fichas vivas) y 6 (la
 * purga de 12 meses no borra el espejo de un hilo del portal; WhatsApp sí).
 *
 * CONTROL ROJO: sin 0524 el contrato cae en el punto 4.
 * MUTANTES: la 0524 redefine carga_lineas y vincular_carga copiando su lógica de la 0523, así que los
 * mutantes de la 0523 sobre esas dos funciones se corren otra vez sobre la 0524. Se suman los de los
 * puntos 4 a 6. Los de reservar_contactos y carga_hilos, que la 0524 no toca, siguen en el envoltorio de
 * la 0523.
 * EN ESPERA: la 0524 se aplica antes de fusionar (migrate-first), con OK nominal de Sam en cada
 * entorno. La última prueba fija que es una espera declarada.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0524_chatwoot_portal_puerta4";
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0524"));
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

describe("SDD-0586 · 0524 las condiciones de la puerta 4 (PGlite)", () => {
  it("el contrato pasa entero con la 0524", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0524 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0524 una fila de la cola sobre un hilo sin vínculo no frena y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0524: una fila pendiente sobre un hilo sin vínculo frena las líneas/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // ── La reserva (riesgo 1) ──
    // ── Las líneas (la foto y la minimización) ──
    [
      "las líneas fuera de solo lectura",
      "  if pg_catalog.current_setting('transaction_read_only') <> 'on' then",
      "  if false then",
      /TEST 0524: fuera de una transacción de solo lectura las líneas se niegan/,
    ],
    [
      "las líneas con el flag encendido",
      "  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then\n    raise exception 'chatwoot_portal_carga_lineas: apagar",
      "  if false then\n    raise exception 'chatwoot_portal_carga_lineas: apagar",
      /TEST 0524: con el flag encendido las líneas se niegan/,
    ],
    ["el corte sin margen", "(pg_catalog.transaction_timestamp() - interval '5 minutes')", "(pg_catalog.transaction_timestamp())", /TEST 0524: el corte va 5 minutos antes de la foto/],
    [
      "las líneas sin exigir la reserva",
      "    raise exception 'chatwoot_portal_carga_lineas: falta reservar los contactos (chatwoot_portal_reservar_contactos)' using errcode = '55000';",
      "    null;",
      /TEST 0524: sin reserva las líneas se niegan/,
    ],
    [
      "lleva lo que vino de Chatwoot",
      "  where m.external_msg_id is null or m.external_msg_id not like 'chatwoot:%'\n  order by m.conversation_id, m.sent_at, m.id;",
      "  order by m.conversation_id, m.sent_at, m.id;",
      /TEST 0524: los conteos de la cabecera son los de las líneas/,
    ],
    [
      "el archivado con su estado",
      "      when c.deleted_at is not null then 'resolved'\n      when c.status = 'abierto' then 'open'",
      "      when c.status = 'abierto' then 'open'",
      /TEST 0524: el archivado va resolved/,
    ],
    ["pendiente como open", "      when c.status = 'pendiente' then 'pending'\n      else 'resolved'\n    end,\n    'creada_at'", "      when c.status = 'pendiente' then 'open'\n      else 'resolved'\n    end,\n    'creada_at'", /TEST 0524: pendiente pasa a pending/],
    ["los mensajes al revés", "  order by m.conversation_id, m.sent_at, m.id;", "  order by m.conversation_id, m.sent_at desc, m.id;", /TEST 0524: los mensajes de hA en el orden de sent_at/],
    ["el contacto con el teléfono", "    'tipo', 'contacto', 'cliente', k.client_id, 'identificador', k.identificador, 'nombre', cl.name\n", "    'tipo', 'contacto', 'cliente', k.client_id, 'identificador', k.identificador, 'nombre', cl.name, 'telefono', cl.phone\n", /TEST 0524: el contacto no lleva más campos que los del formato/],
    ["la nota del archivado sin source_id", "      'source_id', 'dtd:archivado:' || c.id::text,", "      'source_id', 'dtd:archivado',", /TEST 0524: el archivado va resolved, con su nota/],
    // ── La vinculación ──
    [
      "la vinculación con el flag encendido",
      "  if not public.chatwoot_portal_carga_apagado(p_tenant_id) then\n    raise exception 'chatwoot_portal_vincular_carga: apagar",
      "  if false then\n    raise exception 'chatwoot_portal_vincular_carga: apagar",
      /TEST 0524: con el flag encendido la vinculación se niega/,
    ],
    ["no compara el corte", "\n     or (v_cab ->> 'corte') is distinct from (p_preparado ->> 'corte') then", " then", /TEST 0524: otra cabecera se rechaza/],
    [
      // Quita la comparación de los mensajes (el caso que prueba el contrato). No sirve anteponer
      // `false and`: AND va antes que OR y las otras dos comparaciones seguirían.
      "no compara los conteos de mensajes",
      "\n     or (v_cab ->> 'mensajes')::integer is distinct from\n       (select pg_catalog.count(*)::integer from pg_catalog.jsonb_array_elements(p_vinculos) e where e ->> 'tipo' = 'mensaje') then",
      " then",
      /TEST 0524: conteos que no cuadran se rechazan/,
    ],
    [
      "acepta vínculos con menos contactos que el preparado",
      "(v_cab ->> 'contactos')::integer is distinct from (p_preparado ->> 'contactos')::integer\n     or ",
      "",
      /TEST 0524: un vinculos al que le falta un contacto se rechaza/,
    ],
    [
      "acepta vínculos con menos conversaciones que el preparado",
      "\n     or (v_cab ->> 'conversaciones')::integer is distinct from (p_preparado ->> 'conversaciones')::integer",
      "",
      /TEST 0524: un vinculos al que le falta una conversación se rechaza/,
    ],
    [
      "acepta vínculos con menos mensajes que el preparado",
      "\n     or (v_cab ->> 'mensajes')::integer is distinct from (p_preparado ->> 'mensajes')::integer",
      "",
      /TEST 0524: un vinculos al que le falta un mensaje se rechaza/,
    ],
    [
      "un identificador cualquiera",
      "    if v_ident::text is distinct from v_linea ->> 'identificador' then",
      "    if false then",
      /TEST 0524: un identificador que no es el reservado se rechaza/,
    ],
    ["pisa un enviado", "\n      where s.estado <> 'enviado';", ";", /TEST 0524: un mensaje ya enviado no se pisa/],
    ["mueve el corte", "    set corte = coalesce(e.corte, excluded.corte),", "    set corte = excluded.corte,", /TEST 0524: un corte que ya existe no se mueve/],
    [
      "un mensaje de un hilo sin vincular",
      "    join public.chatwoot_portal_hilos hl on hl.conversation_id = m.conversation_id and hl.tenant_id = p_tenant_id\n",
      "",
      /TEST 0524: un mensaje de un hilo que no se vinculó se rechaza/,
    ],
    ["el espejo sin client_id", "      v_client, v_ultimo\n    )", "      null, v_ultimo\n    )", /TEST 0524: una fila del espejo por hilo, con su client_id/],
    [
      "marca enviado en vez de cargado",
      "    values ((v_linea ->> 'mensaje')::uuid, p_tenant_id, v_hilo, 'cargado', (v_linea ->> 'mensaje_id')::bigint)",
      "    values ((v_linea ->> 'mensaje')::uuid, p_tenant_id, v_hilo, 'enviado', (v_linea ->> 'mensaje_id')::bigint)",
      /TEST 0524: los demás mensajes cargados quedan cargado/,
    ],
    // ── Punto 4 (0524): la cola no tocó lo que se carga ──
    ...["pendiente", "enviando", "atascado", "enviado"].map((estado): [string, string, string, RegExp] => [
      `la cola en ${estado} no frena`,
      "    where s.estado in ('pendiente', 'enviando', 'atascado', 'enviado')",
      "    where s.estado in ('pendiente', 'enviando', 'atascado', 'enviado')".replace(`'${estado}', `, "").replace(`, '${estado}'`, ""),
      new RegExp(`TEST 0524: una fila ${estado} sobre un hilo sin vínculo frena las líneas`),
    ]),
    [
      "la cola de todo el tenant frena",
      "    from public.chatwoot_portal_carga_hilos(p_tenant_id) h\n    join public.conversation_messages m on m.conversation_id = h.conversation_id and m.tenant_id = p_tenant_id\n    join public.chatwoot_portal_salida s on s.message_id = m.id and s.tenant_id = p_tenant_id\n    where s.estado in (",
      "    from public.chatwoot_portal_salida s\n    where s.tenant_id = p_tenant_id and s.estado in (",
      /TEST 0524: las filas de la cola en hilos ya vinculados \(c1 en hC\) no frenan las líneas/,
    ],
    // ── Punto 5 (0524): contactos completos y fichas vivas ──
    [
      // Sin el chequeo, el primer caso que cae es el de los dos nulos, que el check de la 0519 deja pasar
      // y la 0523 guardaba (uno solo nulo ya lo frena ese check, con 23514).
      "un contacto sin contacto_id",
      "    if v_contacto is null or v_contacto <= 0 or v_contacto > 2147483647 then",
      "    if false then",
      /TEST 0524: un contacto sin contacto_id ni source_id se rechaza/,
    ],
    [
      "un contacto sin contacto_id ni source_id",
      "    if v_contacto is null or v_contacto <= 0 or v_contacto > 2147483647 then",
      "    if v_contacto <= 0 or v_contacto > 2147483647 then",
      /TEST 0524: un contacto sin contacto_id ni source_id se rechaza/,
    ],
    [
      "un contacto con contacto_id 0",
      "    if v_contacto is null or v_contacto <= 0 or v_contacto > 2147483647 then",
      "    if v_contacto is null or v_contacto > 2147483647 then",
      /TEST 0524: un contacto con contacto_id 0 se rechaza/,
    ],
    [
      "un contacto sin source_id",
      "    if coalesce(v_linea ->> 'source_id', '') = '' then",
      "    if false then",
      /TEST 0524: un contacto con source_id nulo se rechaza/,
    ],
    [
      "un contacto con source_id vacío",
      "    if coalesce(v_linea ->> 'source_id', '') = '' then",
      "    if v_linea ->> 'source_id' is null then",
      /TEST 0524: un contacto con source_id vacío se rechaza/,
    ],
    [
      "el contacto de una ficha borrada",
      "    if exists (select 1 from public.clients cl where cl.id = (v_linea ->> 'cliente')::uuid and cl.deleted_at is not null) then",
      "    if false then",
      /TEST 0524: la ficha de un contacto borrada después de la extracción se rechaza/,
    ],
    [
      "el hilo de una ficha borrada",
      "    if v_borrada is not null then",
      "    if false then",
      /TEST 0524: el hilo de una ficha borrada después de la extracción se rechaza/,
    ],
    // ── Punto 6 (0524): la purga ──
    [
      "la purga borra el espejo del portal",
      "\n    -- Punto 6 (0524): el espejo de un hilo del portal sigue el plazo de la ficha, no el de 12 meses.\n    and not exists (\n      select 1 from public.chatwoot_portal_hilos hl\n      where hl.tenant_id = c.tenant_id and hl.chatwoot_conversation_id = c.conversation_id\n    );",
      ";",
      /TEST 0524: el espejo de un hilo del portal de 13 meses no se purga/,
    ],
    [
      "la purga deja también WhatsApp",
      "    and not exists (\n      select 1 from public.chatwoot_portal_hilos hl",
      "    and false and not exists (\n      select 1 from public.chatwoot_portal_hilos hl",
      /TEST 0524: WhatsApp de 13 meses se purga/,
    ],
    [
      "la purga deja los eventos",
      "  where e.status in ('procesado', 'descartado')\n    and e.received_at < pg_catalog.now() - interval '90 days';",
      "  where false;",
      /TEST 0524: los eventos de 90 días se siguen borrando/,
    ],
    // ── Acceso (el postflight) ──
    [
      "la vinculación para authenticated",
      "revoke all on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) from public, anon, authenticated;",
      "revoke all on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) from public, anon;\ngrant execute on function public.chatwoot_portal_vincular_carga(uuid, jsonb, jsonb) to authenticated;",
      /0524: public\.chatwoot_portal_vincular_carga\(uuid, jsonb, jsonb\) tiene que ser solo de service_role/,
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
    expect(run.error).toMatch(/0524: las condiciones de la puerta 4 ya están/);
  }, SLOW);

  it("PREFLIGHT: sin la purga de la 0508 aborta sin redefinir nada", async () => {
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split(`\\ir ../migrations/${MIGRACION}`)
        .join(
          `drop function public.chatwoot_purgar_bandeja();\n\\ir ../migrations/${MIGRACION}`,
        ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0524 requiere 0523/);
  }, SLOW);

  // Como la 0523: sin código de app/ ni lib/ que llame a sus funciones (la purga la llama purga.ts, que
  // ya existe y no cambia de firma), no lleva declaración de símbolos.
  it("en espera: declarada en migrations-baseline.json", () => {
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/^PENDIENTE DE APLICAR/);
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/antes de fusionar/i);
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
