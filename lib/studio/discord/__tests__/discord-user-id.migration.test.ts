// @vitest-environment node
/**
 * SDD-0606 · La migración 0514 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0514_…test.sql` sólo corre en `verify` con
 * Docker, y el CI de calidad no lo ejecuta. PGlite corre ese MISMO contrato con
 * el `.sql` real inlineado: lo que se prueba es el texto que el runbook
 * aplicará a producción, no un doble.
 *
 * CONTROLES ROJOS: el contrato se corre también sin la migración, y con la
 * migración sin su CHECK de formato. En los dos casos tiene que fallar; sin
 * eso, un verde no demostraría que el contrato mira lo que dice mirar.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0514_user_profiles_discord_user_id.test.sql");
const MIGRATION = "0514_user_profiles_discord_user_id.sql";

/**
 * psql → SQL plano: inlinea `\ir` y quita `\set` y `\echo`. `transform` permite
 * alterar el texto de la migración (para el mutante) y `omit` la deja fuera.
 */
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

describe("0514 · ID de Discord en el perfil (PGlite)", () => {
  it("el contrato completo pasa con la migración real", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla porque no existe la columna", async () => {
    expect(await run(inline(CONTRACT, { omit: true }))).toMatch(/discord_user_id/);
  }, 60_000);

  it("mutante: sin el CHECK de formato, el contrato detecta que entra un ID inválido", async () => {
    const sinCheck = (sql: string) => {
      const mutado = sql.replace(
        "check (discord_user_id is null or discord_user_id ~ '^[0-9]{17,20}$')",
        "check (true)",
      );
      // Base limpia: si el reemplazo no cambió nada, el mutante no mide nada.
      if (mutado === sql) throw new Error("el mutante no encontró el CHECK");
      return mutado;
    };
    expect(await run(inline(CONTRACT, { transform: sinCheck }))).toMatch(
      /CONTRATO 2: entró un ID inválido/,
    );
  }, 60_000);
});
