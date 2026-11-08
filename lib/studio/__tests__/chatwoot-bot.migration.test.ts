// @vitest-environment node
/**
 * SDD-0618 (E7, 7.6 b) · La migración 0522 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0522_chatwoot_bot.test.sql` aplica la 0522 REAL sobre las 0006,
 * 0106, 0337, 0503, 0504 y 0519 reales, y llama sus funciones como el servidor de Studio
 * (service_role) y como un admin (authenticated). PGlite lo corre con los `.sql` inlineados.
 * El mismo contrato corre en Postgres con Docker en el paso «Contratos SQL» de Actions.
 *
 * CONTROL ROJO: sin 0522 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0522 coherente con un defecto, y tiene que caer en la aserción que
 * lo nombra. Los críticos: el portal nunca, contesta_solo sin IA-01, un turno abierto por
 * conversación, el lease ajeno y el watchdog.
 * PENDIENTE: la 0522 no está aplicada; es una espera en migrations-baseline.json (migrate-first).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const NOMBRE = "0522_chatwoot_bot";
const CONTRACT = resolve(ROOT, `supabase/tests/${NOMBRE}.test.sql`);
const MIGRACION = `${NOMBRE}.sql`;
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE = read(resolve(ROOT, "supabase/migrations", MIGRACION));
const BASELINE = JSON.parse(read(resolve(ROOT, "supabase/migrations-baseline.json"))) as {
  cutoff: number;
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0522"));
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

describe("SDD-0618 · 0522 la cola de dtd-bot (PGlite)", () => {
  it("el contrato pasa entero con la 0522", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0522 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0522 el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_bot/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "el portal entra",
      "    where h.tenant_id = p_tenant_id and h.chatwoot_conversation_id = p_conversation_id\n  ) then",
      "    where false\n  ) then",
      /TEST 0522: una conversación del portal no encola/,
    ],
    [
      "el portal de otro tenant corta",
      "    where h.tenant_id = p_tenant_id and h.chatwoot_conversation_id = p_conversation_id\n  ) then",
      "    where h.chatwoot_conversation_id = p_conversation_id\n  ) then",
      /TEST 0522: el hilo del portal es de su tenant/,
    ],
    [
      "apagado encola",
      "  if v_modo = 'apagado' then\n    return query select null::bigint, false, 'apagado'::text;",
      "  if false then\n    return query select null::bigint, false, 'apagado'::text;",
      /TEST 0522: apagado no encola/,
    ],
    [
      "la excluida encola",
      "    where x.tenant_id = p_tenant_id and x.inbox_id = p_inbox_id\n  ) then\n    return query select null::bigint, false, 'excluida'::text;",
      "    where false\n  ) then\n    return query select null::bigint, false, 'excluida'::text;",
      /TEST 0522: una bandeja excluida no encola/,
    ],
    [
      "contesta_solo sin IA-01",
      "  if new.modo = 'contesta_solo' and not exists (",
      "  if false and not exists (",
      /TEST 0522: contesta_solo sin excepción IA-01 se rechaza/,
    ],
    [
      "la excepción de otra bandeja alcanza",
      "    where e.tenant_id = new.tenant_id and e.revocada_at is null and new.inbox_id = any (e.inbox_ids)\n  ) then",
      "    where e.tenant_id = new.tenant_id and e.revocada_at is null\n  ) then",
      /TEST 0522: una excepción de otra bandeja no alcanza/,
    ],
    [
      "la excepción revocada sigue valiendo",
      "    where e.tenant_id = new.tenant_id and e.revocada_at is null and new.inbox_id = any (e.inbox_ids)\n  ) then",
      "    where e.tenant_id = new.tenant_id and new.inbox_id = any (e.inbox_ids)\n  ) then",
      /TEST 0522: una excepción revocada no alcanza/,
    ],
    [
      "revocar no baja a sugerir",
      "after update or delete on public.chatwoot_bot_excepciones",
      "after insert on public.chatwoot_bot_excepciones",
      /TEST 0522: revocar baja a sugerir/,
    ],
    // ── Revisión del DG de la #459 (2026-11-08) ──
    [
      "B1: el trigger solo mira revocada_at (la cabeza a45994da2)",
      "after update or delete on public.chatwoot_bot_excepciones",
      "after update of revocada_at or delete on public.chatwoot_bot_excepciones",
      /TEST 0522: sacar la bandeja de la excepción baja a sugerir/,
    ],
    [
      "B1: borrar la excepción no baja a sugerir",
      "after update or delete on public.chatwoot_bot_excepciones",
      "after update on public.chatwoot_bot_excepciones",
      /TEST 0522: borrar la excepción también baja a sugerir/,
    ],
    [
      "B1: al mover la excepción solo se recalcula el tenant nuevo",
      "    else array[old.tenant_id, new.tenant_id]",
      "    else array[new.tenant_id]",
      /TEST 0522: mover la excepción a otro tenant baja a sugerir/,
    ],
    [
      "B1: mover una exclusión no apaga",
      "after insert or update on public.chatwoot_bot_bandejas_excluidas",
      "after insert on public.chatwoot_bot_bandejas_excluidas",
      /TEST 0522: mover una exclusión a una bandeja encendida la apaga/,
    ],
    [
      "la purga borra lo de 1 día",
      "  delete from public.chatwoot_bot_turnos t where t.cerrado_at < pg_catalog.now() - interval '90 days';",
      "  delete from public.chatwoot_bot_turnos t where t.cerrado_at < pg_catalog.now() - interval '1 day';",
      /TEST 0522: un turno cerrado hace 30 días se queda|TEST 0522: purga un turno y una llamada vencidos/,
    ],
    [
      "el gasto del mes en UTC",
      "    and l.created_at >= (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Caracas') at time zone 'America/Caracas');",
      "    and l.created_at >= pg_catalog.date_trunc('month', pg_catalog.now());",
      /TEST 0522: gasto del mes/,
    ],
    [
      "anotar_llamada acepta el turno de otro tenant",
      "  if p_turno_id is not null and not exists (",
      "  if false and not exists (",
      /TEST 0522: anotar una llamada con el turno de otro tenant se rechaza/,
    ],
    [
      "postflight: authenticated ejecuta el gasto del mes",
      "grant execute on function public.chatwoot_bot_gasto_mes(uuid) to service_role;",
      "grant execute on function public.chatwoot_bot_gasto_mes(uuid) to service_role, authenticated;",
      /0522: public\.chatwoot_bot_gasto_mes\(uuid\) no puede ser de anon ni de authenticated/,
    ],
    [
      "postflight: la purga sin search_path",
      "create function public.chatwoot_bot_purgar() returns integer\nlanguage plpgsql security definer set search_path = '' as $fn$",
      "create function public.chatwoot_bot_purgar() returns integer\nlanguage plpgsql security definer as $fn$",
      /0522: public\.chatwoot_bot_purgar\(\) no quedó security definer con search_path vacío/,
    ],
    [
      "postflight: latidos sin RLS",
      "alter table public.chatwoot_bot_latidos enable row level security;",
      "",
      /0522: public\.chatwoot_bot_latidos sin RLS/,
    ],
    [
      "postflight: authenticated lee los latidos",
      "grant select on public.chatwoot_bot_llamadas to authenticated;",
      "grant select on public.chatwoot_bot_llamadas to authenticated;\ngrant select on public.chatwoot_bot_latidos to authenticated;",
      /0522: el SELECT de authenticated en public\.chatwoot_bot_latidos no es el esperado/,
    ],
    [
      "sin idempotencia por mensaje",
      "  if v_visto is not null and p_mensaje_id <= v_visto then",
      "  if false then",
      /TEST 0522: el mismo mensaje no encola dos veces/,
    ],
    [
      "la espera pasa del límite",
      "    v_listo := least(p_llegada + pg_catalog.make_interval(secs => p_inactividad_ms / 1000.0), v_turno.limite_at);",
      "    v_listo := p_llegada + pg_catalog.make_interval(secs => p_inactividad_ms / 1000.0);",
      /TEST 0522: la espera no pasa del límite|violates check constraint/,
    ],
    [
      "dos turnos abiertos",
      "create unique index chatwoot_bot_turnos_abierto_idx",
      "create index chatwoot_bot_turnos_abierto_idx",
      /TEST 0522: el índice impide un segundo turno abierto/,
    ],
    [
      "se reparte lo que no está listo",
      "      and (t.listo_desde <= pg_catalog.now() or t.limite_at <= pg_catalog.now())\n    order by",
      "    order by",
      /TEST 0522: se reparte solo lo listo|TEST 0522: el listo es el de la conversación 13/,
    ],
    [
      "un tomado se vuelve a repartir",
      "    where t.estado = 'pendiente'\n      and (t.listo_desde",
      "    where t.estado in ('pendiente', 'tomado')\n      and (t.listo_desde",
      /TEST 0522: un tomado no se vuelve a repartir|TEST 0522: se reparte solo lo listo|TEST 0522: un turno tomado no se vuelve a repartir/,
    ],
    [
      "otro trabajador cierra",
      "    and t.trabajador = p_trabajador\n    and t.lease_hasta > pg_catalog.now();",
      "    and t.lease_hasta > pg_catalog.now();",
      /TEST 0522: otro trabajador no cierra/,
    ],
    [
      "con el lease vencido se cierra",
      "    and t.trabajador = p_trabajador\n    and t.lease_hasta > pg_catalog.now();",
      "    and t.trabajador = p_trabajador;",
      /TEST 0522: con el lease vencido no se cierra/,
    ],
    [
      "el watchdog no mira el lease",
      "  where t.estado = 'tomado' and t.lease_hasta <= pg_catalog.now();",
      "  where false;",
      /TEST 0522: el watchdog cuenta lo vencido/,
    ],
    [
      "el watchdog no mira los pendientes vencidos",
      "  where t.estado = 'pendiente' and t.limite_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_gracia_s);",
      "  where false;",
      /TEST 0522: el watchdog cuenta lo vencido/,
    ],
    [
      "invalidar no mira el tenant",
      "  where t.tenant_id = p_tenant_id and t.conversation_id = p_conversation_id and t.estado in ('pendiente', 'tomado');\n  get diagnostics v = row_count;",
      "  where t.conversation_id = p_conversation_id and t.estado in ('pendiente', 'tomado');\n  get diagnostics v = row_count;",
      /TEST 0522: invalidar respeta el tenant/,
    ],
    [
      "el gasto del mes suma todo",
      "    and l.created_at >= (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Caracas') at time zone 'America/Caracas');",
      "    ;",
      /TEST 0522: gasto del mes/,
    ],
    [
      "el operador lee los turnos",
      "create policy chatwoot_bot_turnos_admin_lee on public.chatwoot_bot_turnos\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      "create policy chatwoot_bot_turnos_admin_lee on public.chatwoot_bot_turnos\n  for select to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()));",
      /TEST 0522: un operador no ve los turnos/,
    ],
    [
      "authenticated ejecuta encolar",
      "revoke all on function public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer) from public, anon, authenticated;",
      "revoke all on function public.chatwoot_bot_encolar(uuid, bigint, bigint, bigint, timestamptz, integer, integer) from anon;",
      /TEST 0522: las RPC son solo de service_role|0522: public\.chatwoot_bot_encolar\(.*no puede ser de anon ni de authenticated/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(FILE, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si las tablas ya existen", async () => {
    const run = await contract({ [MIGRACION]: `${FILE}\n${FILE}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0522: las tablas del bot ya existen/);
  }, SLOW);

  it("PREFLIGHT: sin la 0519 aborta sin crear nada", async () => {
    const run = await contract({
      [`${NOMBRE}.test.sql`]: read(CONTRACT)
        .split("\\ir ../migrations/0519_chatwoot_portal.sql")
        .join("select 1;")
        .split("insert into public.chatwoot_portal_hilos")
        .join("-- sin 0519: insert into public.chatwoot_portal_hilos"),
    });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0522 requiere .* 0519/);
  }, SLOW);

  it("es una espera migrate-first por encima del corte, con su motivo", () => {
    expect(Number(NOMBRE.slice(0, 4))).toBeGreaterThan(BASELINE.cutoff);
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/^PENDIENTE DE APLICAR — SDD-0618/);
    expect(BASELINE.pendingBelowCutoff[NOMBRE]).toMatch(/MIGRATE-FIRST/);
    expect(FILE).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });

  it("no guarda texto: ninguna columna de mensajes, nombres ni teléfonos en el SQL", () => {
    const columnas = [...FILE.matchAll(/^\s{2}([a-z_]+)\s+(uuid|bigint|text|jsonb|boolean|integer|timestamptz|numeric)/gm)].map((m) => m[1]);
    expect(columnas.length).toBeGreaterThan(30);
    for (const c of columnas) expect(c).not.toMatch(/texto|content|body|nombre|name|phone|telefono|email|prompt|respuesta/);
  });
});
