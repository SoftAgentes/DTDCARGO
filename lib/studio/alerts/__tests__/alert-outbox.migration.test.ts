// @vitest-environment node
/**
 * SDD-0606 · La migración 0515 (cola de avisos) corrida de verdad sobre
 * PostgreSQL embebido, con el contrato `supabase/tests/0515_…test.sql` y el
 * `.sql` real inlineado.
 *
 * CONTROLES ROJOS: sin la migración, y con la migración sin el CHECK que deja
 * fuera del aviso todo lo que no sea mínimo. En los dos casos tiene que fallar.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0515_studio_alert_outbox.test.sql");
const MIGRATION = "0515_studio_alert_outbox.sql";

function inline(
  file: string,
  opts: { omit?: boolean; transform?: (sql: string) => string } = {},
): string {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (!include[1].endsWith(MIGRATION)) {
          throw new Error(`\\ir inesperado en el contrato: ${include[1]}`);
        }
        if (opts.omit) return "";
        const sql = readFileSync(resolve(dirname(file), include[1]), "utf8");
        return opts.transform ? opts.transform(sql) : sql;
      }
      return /^\\(set|echo)\s/.test(line) ? "" : line;
    })
    .join("\n");
}

async function run(sql: string): Promise<string | null> {
  const db = await pgliteLimpio();
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await db.close();
  }
}

describe("0515 · cola de avisos a Discord (PGlite)", () => {
  it("el contrato completo pasa con la migración real", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla", async () => {
    expect(await run(inline(CONTRACT, { omit: true }))).toMatch(/studio_alert_outbox/);
  }, 60_000);

  it("mutante: sin la barrera del aviso mínimo, entra una clave de más", async () => {
    const sinBarrera = (sql: string) => {
      const mutado = sql.replace(
        "and (payload - array['titulo', 'codigo', 'url', 'conteos']) = '{}'::jsonb",
        "",
      );
      if (mutado === sql) throw new Error("el mutante no encontró la barrera");
      return mutado;
    };
    expect(await run(inline(CONTRACT, { transform: sinBarrera }))).toMatch(
      /CONTRATO 1\/2: entró una fila inválida \(clave de más\)/,
    );
  }, 60_000);

  it("mutante: con privilegios para authenticated, el contrato lo detecta", async () => {
    const conGrant = (sql: string) =>
      `${sql}\ngrant select on public.studio_alert_outbox to authenticated;\n`;
    expect(await run(inline(CONTRACT, { transform: conGrant }))).toMatch(
      /CONTRATO 3: authenticated pudo ejecutar/,
    );
  }, 60_000);
});
