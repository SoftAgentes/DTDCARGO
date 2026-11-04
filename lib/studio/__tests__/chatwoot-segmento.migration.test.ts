// @vitest-environment node
/**
 * SDD-0586 · La migración 0505 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0505_chatwoot_segmento.test.sql` aplica la 0505
 * REAL y llama sus funciones como el manejador del webhook (service_role).
 * PGlite lo corre con los `.sql` inlineados: lo que se prueba es el texto que
 * el runbook aplicará.
 *
 * CONTROL ROJO: sin 0505 el contrato cae en la primera aserción (la función no existe).
 * MUTANTES: cada uno es una 0505 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * PENDIENTE: la 0505 está declarada en migrations-baseline.json hasta que Sam
 * la autorice y se aplique.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0505_chatwoot_segmento.test.sql");
const M0505 = "0505_chatwoot_segmento.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0505 = read(resolve(ROOT, "supabase/migrations", M0505));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0505"));
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

describe("SDD-0586 · 0505 segmento del contacto, respuestas del bot y BSUID (PGlite)", () => {
  it("el contrato pasa entero con la 0505", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0505 GREEN: 67 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0505 la función no existe y el contrato cae", async () => {
    const run = await contract({ [M0505]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_segmento_contacto/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    ["ambiguo que adivina", "  if v_cruces <> 1 then", "  if v_cruces < 1 then", /TEST 0505: teléfono ambiguo es lead nuevo/],
    [
      "ficha borrada cruza",
      "    and c.phone_last10 = p_phone_last10\n    and c.deleted_at is null;",
      "    and c.phone_last10 = p_phone_last10;",
      /TEST 0505: envío con el código de una ficha fusionada cuenta y la fusionada borrada no vuelve ambiguo/,
    ],
    ["borrador cuenta", "not in ('draft', 'cancelled')", "not in ('cancelled')", /TEST 0505: borrador, cancelado, envío borrado/],
    ["cancelado cuenta", "not in ('draft', 'cancelled')", "not in ('draft')", /TEST 0505: borrador, cancelado, envío borrado/],
    [
      "envío borrado cuenta",
      "        and s.deleted_at is null\n",
      "",
      /TEST 0505: borrador, cancelado, envío borrado/,
    ],
    [
      "recibo borrado cuenta",
      "        and r.deleted_at is null\n",
      "",
      /TEST 0505: borrador, cancelado, envío borrado y recibo borrado no cuentan/,
    ],
    ["huérfano cuenta", "        and not r.is_orphan\n", "", /TEST 0505: recibo huérfano no cuenta/],
    [
      "incidencia no cuenta",
      "        and not r.is_orphan\n",
      "        and not r.is_orphan\n        and r.status::text <> 'incidencia'\n",
      /TEST 0505: recibo en incidencia cuenta/,
    ],
    [
      "sin recibos en China",
      "      where r.tenant_id = p_tenant_id",
      "      where false and r.tenant_id = p_tenant_id",
      /TEST 0505: cliente solo por recibo en China/,
    ],
    [
      "sin historial",
      "      on h.client_id = f.miembro and h.tenant_id = p_tenant_id",
      "      on false",
      /TEST 0505: envío con un código del historial cuenta/,
    ],
    [
      "sin fichas fusionadas",
      "    where f.nivel < 10",
      "    where false",
      /TEST 0505: envío con el código de una ficha fusionada cuenta/,
    ],
    [
      "fusión de un solo salto",
      "    where f.nivel < 10",
      "    where f.nivel < 1",
      /TEST 0505: recibo con el código de una fusionada a dos saltos cuenta/,
    ],
    [
      "códigos sin normalizar",
      "pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = any (v_codigos)",
      "s.client_markbox = any (v_codigos)",
      /TEST 0505: envío con un código del historial cuenta/,
    ],
    [
      "envíos de otro tenant",
      "      where s.tenant_id = p_tenant_id",
      "      where true",
      /TEST 0505: un envío de otro tenant con el mismo código no cuenta/,
    ],
    // Sin mutante para la guarda `!~ '^[0-9]{10}$'`: es equivalente. phone_last10
    // es generada con 10 dígitos (0383), así que un teléfono inválido nunca
    // cruza y sale lead_nuevo igual; la guarda solo ahorra la consulta.
    [
      "reserva siempre",
      "    where (r.estado = 'enviada' and r.enviada_at < pg_catalog.now() - interval '24 hours')",
      "    where true or (r.estado = 'enviada' and r.enviada_at < pg_catalog.now() - interval '24 hours')",
      /TEST 0505: una reserva viva da en_curso/,
    ],
    [
      "sin ventana de 24 h",
      "    where (r.estado = 'enviada' and r.enviada_at < pg_catalog.now() - interval '24 hours')",
      "    where false and (r.estado = 'enviada' and r.enviada_at < pg_catalog.now() - interval '24 hours')",
      /TEST 0505: pasadas 24 h se puede responder otra vez/,
    ],
    [
      "incierta o colgada se reclama a los 10 min",
      "       or (r.estado <> 'enviada' and r.reservada_at < pg_catalog.now() - interval '24 hours');",
      "       or (r.estado <> 'enviada' and r.reservada_at < pg_catalog.now() - interval '10 minutes');",
      /TEST 0505: una incierta sigue bloqueada antes de las 24 h/,
    ],
    [
      "colgada da en_curso para siempre",
      "  elsif v_estado = 'incierta' or v_reserva < pg_catalog.now() - interval '10 minutes' then",
      "  elsif v_estado = 'incierta' then",
      /TEST 0505: una reserva colgada más de 10 min cuenta como incierta/,
    ],
    [
      "incierta reenvía",
      "  elsif v_estado = 'incierta' or v_reserva < pg_catalog.now() - interval '10 minutes' then\n    return 'incierta';",
      "  elsif v_estado = 'incierta' or v_reserva < pg_catalog.now() - interval '10 minutes' then\n    return 'enviar';",
      /TEST 0505: un envío incierto no habilita otro/,
    ],
    [
      "rechazo no libera",
      "    delete from public.chatwoot_respuestas_bot r\n    where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id and r.estado = 'reservada';",
      "    delete from public.chatwoot_respuestas_bot r\n    where false;",
      /TEST 0505: una reserva rechazada se libera/,
    ],
    [
      "cerrar reabre una enviada",
      "    where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id and r.estado = 'reservada';\n  else",
      "    where r.tenant_id = p_tenant_id and r.conversation_id = p_conversation_id;\n  else",
      /TEST 0505: una enviada no pasa a incierta/,
    ],
    [
      "BSUID acepta teléfonos",
      " and bsuid !~ '^[0-9]+$'",
      "",
      /TEST 0505: un teléfono no se guarda como BSUID/,
    ],
    [
      "BSUID duplicado",
      "  on conflict (tenant_id, bsuid) do update\n    set conversation_id = excluded.conversation_id, ultima_vez_at = pg_catalog.now();",
      "  on conflict (tenant_id, bsuid) do update\n    set ultima_vez_at = pg_catalog.now();",
      /TEST 0505: el mismo BSUID es una fila con su última conversación/,
    ],
    // Plazos de Sam (2026-10-30): BSUID «1 año», respuestas «30 días (Recomendado)».
    [
      "BSUID a 180 días",
      "  where b.ultima_vez_at < pg_catalog.now() - interval '365 days';",
      "  where b.ultima_vez_at < pg_catalog.now() - interval '180 days';",
      /TEST 0505: la purga informa cuántas filas borró/,
    ],
    [
      "BSUID que nunca se purga",
      "  where b.ultima_vez_at < pg_catalog.now() - interval '365 days';",
      "  where b.ultima_vez_at < pg_catalog.now() - interval '3650 days';",
      /TEST 0505: la purga informa cuántas filas borró/,
    ],
    [
      "respuestas a 24 h",
      "  where coalesce(r.enviada_at, r.reservada_at) < pg_catalog.now() - interval '30 days';",
      "  where coalesce(r.enviada_at, r.reservada_at) < pg_catalog.now() - interval '24 hours';",
      /TEST 0505: la purga informa cuántas filas borró/,
    ],
    [
      "respuestas que nunca se purgan",
      "  where coalesce(r.enviada_at, r.reservada_at) < pg_catalog.now() - interval '30 days';",
      "  where coalesce(r.enviada_at, r.reservada_at) < pg_catalog.now() - interval '300 days';",
      /TEST 0505: la purga informa cuántas filas borró/,
    ],
    [
      "plazo desde la reserva",
      "  where coalesce(r.enviada_at, r.reservada_at) < pg_catalog.now() - interval '30 days';",
      "  where r.reservada_at < pg_catalog.now() - interval '30 days';",
      /TEST 0505: la purga informa cuántas filas borró/,
    ],
    [
      "purga abierta a authenticated",
      "grant execute on function public.chatwoot_purgar_enrutamiento() to service_role;",
      "grant execute on function public.chatwoot_purgar_enrutamiento() to service_role, authenticated;",
      /TEST 0505: las funciones son solo de service_role: public.chatwoot_purgar_enrutamiento/,
    ],
    [
      "segmento abierto a authenticated",
      "grant execute on function public.chatwoot_segmento_contacto(uuid, text) to service_role;",
      "grant execute on function public.chatwoot_segmento_contacto(uuid, text) to service_role, authenticated;",
      /TEST 0505: las funciones son solo de service_role: public.chatwoot_segmento_contacto/,
    ],
    // Con RLS por tenant (pedido del Director) el admin lee: estos mutantes
    // abren la POLÍTICA, no solo el GRANT, y caen en la lectura real
    // (revisión de Codex: un GRANT sin política no cambia lo que se ve).
    [
      "BSUID de otro tenant",
      "  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      "  using ((select public.is_tenant_admin()));",
      /TEST 0505: el admin de T1 ve solo los BSUID de T1/,
    ],
    [
      "BSUID para cualquiera del tenant",
      "  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      "  using (tenant_id = (select public.get_user_tenant_id()));",
      /TEST 0505: quien no es admin no ve los BSUID/,
    ],
    [
      "BSUID escribible desde la API",
      "grant select on public.chatwoot_contactos_bsuid to authenticated;",
      "grant select, insert on public.chatwoot_contactos_bsuid to authenticated;",
      /TEST 0505: solo service_role escribe en las tablas nuevas/,
    ],
    [
      "respuestas legibles desde la API",
      "grant all on public.chatwoot_respuestas_bot to service_role;",
      "grant all on public.chatwoot_respuestas_bot to service_role;\ngrant select on public.chatwoot_respuestas_bot to authenticated;",
      /TEST 0505: las respuestas del bot no se leen desde la API/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0505]: once(FILE_0505, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si los objetos ya existen", async () => {
    const run = await contract({ [M0505]: `${FILE_0505}\n${FILE_0505}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0505: los objetos de segmento de Chatwoot ya existen/);
  }, SLOW);

  it("PREFLIGHT: sin una columna de la regla aborta sin crear nada", async () => {
    const run = await contract({
      "0505_chatwoot_segmento.test.sql": read(CONTRACT).replace(
        "\\ir ../migrations/0505_chatwoot_segmento.sql",
        "alter table public.warehouse_receipts_cn drop column is_orphan;\n\\ir ../migrations/0505_chatwoot_segmento.sql",
      ),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0505 requiere las columnas de la regla de segmentos/);
  }, SLOW);

  it("la 0505 queda declarada pendiente hasta que Sam la autorice", () => {
    expect(BASELINE.pendingBelowCutoff["0505_chatwoot_segmento"]).toMatch(/SDD-0586/);
    expect(FILE_0505).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
