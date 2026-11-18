// @vitest-environment node
/**
 * SDD-0482 · La migración 0462 corrida de verdad sobre PostgreSQL embebido.
 *
 * Corre el contrato `supabase/tests/0462_…test.sql` (cadena real 0445 → 0462)
 * en PGlite, así el CI de calidad —que no tiene Docker— lo ejecuta igual.
 *
 * CONTROLES ROJOS:
 *  - sin 0462 el contrato falla;
 *  - cada mutante del texto de la migración rompe el contrato que lo vigila.
 *    Si un mutante sobreviviera, el contrato no estaría mirando esa regla.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0462_portal_profile_direct_edit.test.sql");
const MIGRATION = "0462_portal_profile_direct_edit.sql";

type Options = {
  omit?: string[];
  /** Reemplazos sobre el texto de la migración 0462 (mutantes). */
  mutate?: Array<[string, string]>;
};

/** psql → SQL plano: inlinea `\ir` (con omisiones/mutantes) y quita `\set`. */
function inline(file: string, options: Options = {}): string {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (options.omit?.some((name) => include[1].endsWith(name))) return "";
        const path = resolve(dirname(file), include[1]);
        let sql = inline(path, options);
        if (include[1].endsWith(MIGRATION)) {
          for (const [from, to] of options.mutate ?? []) {
            if (!sql.includes(from)) throw new Error(`mutante inválido: ${from}`);
            sql = sql.replace(from, to);
          }
        }
        return sql;
      }
      return /^\\set\s/.test(line) ? "" : line;
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

describe("0462 · edición directa del perfil (PGlite)", () => {
  it("el contrato completo pasa con la cadena real 0445 → 0462", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin 0462 el contrato falla", async () => {
    expect(await run(inline(CONTRACT, { omit: [MIGRATION] }))).not.toBeNull();
  }, 60_000);

  it("preflight: sin el cupo de 0445 aborta", async () => {
    const error = await run(
      inline(CONTRACT, { omit: ["0445_portal_profile_edit_limit.sql"] }),
    );
    expect(error).toMatch(/0462 requiere clients, el índice 0095, el cupo de 0445/);
  }, 60_000);

  it.each<[string, Array<[string, string]>, RegExp]>([
    [
      "sin límite anti-enumeración",
      [["if v_blocked >= 5 then", "if v_blocked >= 500 then"]],
      /CONTRATO 5 ROTO/,
    ],
    [
      "sin bloqueo por teléfono",
      [["and other.phone_last10 = pg_catalog.\"right\"(v_new_phone, 10)", "and false"]],
      /CONTRATO 4 ROTO/,
    ],
    [
      "sin bloqueo por documento",
      [[
        "      v_field := 'document';\n    end if;\n  end if;",
        "      v_field := null;\n    end if;\n  end if;",
      ]],
      /CONTRATO 4 ROTO|CONTRATO 5 ROTO|unique/i,
    ],
    [
      "reinicia la verificación",
      [["phone = coalesce(v_new_phone, phone)", "phone = coalesce(v_new_phone, phone), doc_verify_status = null"]],
      /CONTRATO 3 ROTO/,
    ],
    [
      "no reemplaza la solicitud pendiente",
      [["and status = 'pending'\n      and source = 'client';", "and false;"]],
      /CONTRATO 6 ROTO|duplicate key|unique/i,
    ],
    [
      "el formato cuenta como cambio",
      [[
        "is distinct from\n         pg_catalog.upper(pg_catalog.regexp_replace(coalesce(v_cur_rif, ''), '[^A-Za-z0-9]', '', 'g'))",
        "is distinct from coalesce(v_cur_rif, '')",
      ]],
      /CONTRATO 3 ROTO/,
    ],
    [
      "la carrera del índice no se atrapa",
      [["    when unique_violation then", "    when division_by_zero then"]],
      /duplicate key|unique/i,
    ],
  ])("mutante «%s» rompe el contrato", async (_name, mutate, expected) => {
    const error = await run(inline(CONTRACT, { mutate }));
    expect(error).toMatch(expected);
  }, 60_000);
});
