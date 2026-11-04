// @vitest-environment node
/**
 * SDD-0585 · La migración 0504 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0504_chatwoot_eventos.test.sql` aplica la 0504 REAL
 * y llama la RPC como la ruta del webhook (service_role); lee como authenticated.
 * PGlite lo corre con los `.sql` inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0504 el contrato cae en la primera aserción (la RPC no existe).
 * MUTANTES: cada uno es una 0504 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * APLICADA: la 0504 salió de la espera el 2026-11-04 (runbook §6); una prueba lo
 * fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0504_chatwoot_eventos.test.sql");
const M0504 = "0504_chatwoot_eventos.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0504 = read(resolve(ROOT, "supabase/migrations", M0504));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0504"));
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

describe("SDD-0585 · 0504 eventos de Chatwoot, estado y cruce (PGlite)", () => {
  it("el contrato pasa entero con la 0504", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0504 GREEN: 49 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0504 la RPC no existe y el contrato cae", async () => {
    const run = await contract({ [M0504]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_registrar_evento/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "sin idempotencia",
      "      if v_filas = 0 then\n        return query select false, false, null::uuid;",
      "      if false then\n        return query select false, false, null::uuid;",
      /TEST 0504: el mismo evento otra vez no hace nada/,
    ],
    [
      "un evento fallido no se reclama",
      "        and (e.status = 'fallido'\n",
      "        and (false\n",
      /TEST 0504: reintento: tras fallar, la reentrega se vuelve a procesar/,
    ],
    [
      "un evento procesado puede volver a fallido",
      "    and e.event_key = p_event_key\n    and e.status = 'procesando';",
      "    and e.event_key = p_event_key;",
      /TEST 0504: reintento: un evento procesado no vuelve a fallido/,
    ],
    [
      "sin el candado de orden",
      "  where cc.source_updated_at <= excluded.source_updated_at;",
      ";",
      /TEST 0504: un evento más viejo se registra pero no pisa/,
    ],
    ["cruce ambiguo que adivina", "    if v_cruces <> 1 then", "    if v_cruces < 1 then", /TEST 0504: un teléfono con dos clientes no cruza/],
    [
      "cruce con clientes borrados",
      "      and c.phone_last10 = p_phone_last10\n      and c.deleted_at is null;",
      "      and c.phone_last10 = p_phone_last10;",
      /TEST 0504: un cliente borrado no cruza/,
    ],
    [
      "sin teléfono borra el cruce",
      "case when p_phone_last10 ~ '^[0-9]{10}$' then excluded.client_id else cc.client_id end",
      "excluded.client_id",
      /TEST 0504: sin teléfono en el evento se conserva el cliente/,
    ],
    [
      "SELECT sin tenant",
      "  using (tenant_id = (select public.get_user_tenant_id()));",
      "  using (true);",
      /TEST 0504: un usuario de T1 ve las conversaciones de T1/,
    ],
    [
      "eventos legibles para cualquiera del tenant",
      "  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      "  using (tenant_id = (select public.get_user_tenant_id()));",
      /TEST 0504: quien no es admin no ve los eventos/,
    ],
    [
      "sin espera creciente",
      "make_interval(mins => power(2, e.attempts - 1)::integer)",
      "make_interval(mins => 1)",
      /TEST 0504: reproceso: el segundo fallo espera 2 minutos/,
    ],
    [
      "sin tope de intentos",
      "when not p_ok and e.attempts >= 5 then 'descartado'",
      "when false then 'descartado'",
      /TEST 0504: reproceso: al quinto intento fallido queda descartado/,
    ],
    [
      "toma antes de la espera",
      "(e.status = 'fallido' and e.next_attempt_at <= pg_catalog.now())",
      "(e.status = 'fallido')",
      /TEST 0504: reproceso: un fallido no se toma antes de su espera/,
    ],
    [
      "RPC abierta a authenticated",
      "double precision, bigint, boolean) to service_role;",
      "double precision, bigint, boolean) to service_role, authenticated;",
      /TEST 0504: la RPC es solo de service_role/,
    ],
    [
      "fuera de realtime",
      "    alter publication supabase_realtime add table public.chatwoot_conversations;",
      "    null;",
      /TEST 0504: chatwoot_conversations entra en supabase_realtime/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0504]: once(FILE_0504, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si las tablas ya existen", async () => {
    const run = await contract({ [M0504]: `${FILE_0504}\n${FILE_0504}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0504: las tablas de eventos de Chatwoot ya existen/);
  }, SLOW);

  it("la 0504 salió de la espera al aplicarse, y su cabecera no se corrige (runbook §6)", () => {
    expect(BASELINE.pendingBelowCutoff["0504_chatwoot_eventos"]).toBeUndefined();
    expect(FILE_0504).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
