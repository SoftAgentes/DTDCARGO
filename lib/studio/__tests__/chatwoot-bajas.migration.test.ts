// @vitest-environment node
/**
 * SDD-0585 · paso 2.7 · La migración 0508 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0508_chatwoot_bajas_purga.test.sql` aplica la 0504
 * REAL y encima la 0508 REAL, y llama la purga y las vencidas como el cron
 * (service_role).
 *
 * CONTROL ROJO: sin 0508 el contrato cae en la primera aserción (la purga no existe).
 * MUTANTES: cada uno es una 0508 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * APLICADA: la 0508 salió de la espera el 2026-11-04 (runbook §6); una prueba lo
 * fija.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0508_chatwoot_bajas_purga.test.sql");
const M0508 = "0508_chatwoot_bajas_purga.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0508 = read(resolve(ROOT, "supabase/migrations", M0508));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0508"));
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

describe("SDD-0585 · 0508 bajas de agentes y purga por plazo (PGlite)", () => {
  it("el contrato pasa entero con la 0508", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0508 GREEN: 12 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0508 la purga no existe y el contrato cae", async () => {
    const run = await contract({ [M0508]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_agent_bajas|chatwoot_purgar_bandeja/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "purga eventos que todavía pueden reintentarse",
      "  where e.status in ('procesado', 'descartado')\n",
      "  where true\n",
      /TEST 0508: la purga borra 3 eventos viejos/,
    ],
    [
      "eventos a 30 días",
      "e.received_at < pg_catalog.now() - interval '90 days'",
      "e.received_at < pg_catalog.now() - interval '30 days'",
      /TEST 0508: la purga borra 3 eventos viejos/,
    ],
    [
      "conversaciones por fecha de registro",
      "coalesce(c.last_activity_at, c.updated_at) < pg_catalog.now() - interval '12 months'",
      "c.updated_at < pg_catalog.now() - interval '12 months'",
      /TEST 0508: quedan la de actividad reciente/,
    ],
    [
      "conversaciones sin actividad nunca se purgan",
      "coalesce(c.last_activity_at, c.updated_at) < pg_catalog.now() - interval '12 months'",
      "c.last_activity_at < pg_catalog.now() - interval '12 months'",
      /TEST 0508: la purga borra 3 conversaciones/,
    ],
    [
      "vencidas a 6 meses",
      "b.baja_at < pg_catalog.now() - interval '12 months'",
      "b.baja_at < pg_catalog.now() - interval '6 months'",
      /TEST 0508: vencidas: las bajas de más de 12 meses/,
    ],
    [
      "bajas legibles para authenticated",
      "grant all on public.chatwoot_agent_bajas to service_role;",
      "grant all on public.chatwoot_agent_bajas to service_role, authenticated;",
      /TEST 0508: las bajas son solo de service_role/,
    ],
    [
      "purga abierta a authenticated",
      "grant execute on function public.chatwoot_purgar_bandeja() to service_role;",
      "grant execute on function public.chatwoot_purgar_bandeja() to service_role, authenticated;",
      /TEST 0508: la purga es solo de service_role/,
    ],
    [
      "bajas sin RLS",
      "alter table public.chatwoot_agent_bajas enable row level security;",
      "select 1;",
      /TEST 0508: las bajas tienen RLS/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0508]: once(FILE_0508, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si las bajas ya existen", async () => {
    const run = await contract({ [M0508]: `${FILE_0508}\n${FILE_0508}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0508: las bajas de Chatwoot ya existen/);
  }, SLOW);

  it("la 0508 salió de la espera al aplicarse, y su cabecera no se corrige (runbook §6)", () => {
    expect(BASELINE.pendingBelowCutoff["0508_chatwoot_bajas_purga"]).toBeUndefined();
    expect(FILE_0508).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
