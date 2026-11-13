// @vitest-environment node
/**
 * SDD-0631 · La migración 0536 corrida de verdad sobre PostgreSQL embebido.
 *
 * PGlite corre el contrato `supabase/tests/0536_…test.sql` con el `.sql` real
 * inlineado: lo que se prueba es el texto que el runbook aplicaría a
 * producción, no un doble.
 *
 * CONTROL ROJO: sin la migración el contrato falla. MUTANTES: cada regla del
 * trigger y el CHECK se quitan de a una, y el contrato tiene que cazarlas.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0536_cxp_ligada_contenedor.test.sql");
const MIGRATION = "0536_cxp_ligada_contenedor.sql";
const SOURCE = readFileSync(resolve(ROOT, "supabase/migrations", MIGRATION), "utf8").replaceAll("\r\n", "\n");

function inline(opts: { omit?: boolean; transform?: (sql: string) => string } = {}): string {
  return readFileSync(CONTRACT, "utf8")
    .split(/\r?\n/)
    .map((line) => {
      const include = line.match(/^\\ir\s+(\S+)/);
      if (include) {
        if (!include[1].endsWith(MIGRATION)) throw new Error(`\\ir inesperado: ${include[1]}`);
        if (opts.omit) return "";
        return opts.transform ? opts.transform(SOURCE) : SOURCE;
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

/** Reemplaza un ancla que tiene que aparecer exactamente una vez. */
function mutate(anchor: string, replacement: string) {
  return (sql: string) => {
    expect(sql.split(anchor).length - 1, `ancla exacta: ${anchor}`).toBe(1);
    return sql.replace(anchor, () => replacement);
  };
}

describe("0536 · CxP ligada a contenedor (PGlite)", () => {
  it("el contrato completo pasa con la migración real, aplicada dos veces", async () => {
    expect(await run(inline())).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla", async () => {
    expect(await run(inline({ omit: true }))).toMatch(/consolidation_id|cost_category/);
  }, 60_000);

  it.each([
    [
      "contenedor de otro tenant",
      "if not public.consolidation_in_tenant(new.consolidation_id, new.tenant_id) then",
      "if false then",
      /CONTRATO 3a/,
    ],
    [
      "embarque de otro tenant",
      "if not public.shipment_in_tenant(new.shipment_id, new.tenant_id) then",
      "if false then",
      /CONTRATO 3c/,
    ],
    [
      "embarque fuera del contenedor",
      "if new.consolidation_id is not null and new.shipment_id is not null\n     and not exists (",
      "if false\n     and not exists (",
      /CONTRATO 3d/,
    ],
    [
      "vínculo sin categoría",
      "and new.cost_category is null then",
      "and false then",
      /CONTRATO 3e/,
    ],
    [
      "trigger que no mira la categoría en UPDATE",
      "before insert or update of consolidation_id, shipment_id, cost_category, tenant_id",
      "before insert or update of consolidation_id, shipment_id, tenant_id",
      /CONTRATO 3f/,
    ],
    [
      "CHECK de categoría ausente",
      "check (cost_category is null or cost_category in",
      "check (cost_category is null or true or cost_category in",
      /CONTRATO 3g/,
    ],
    [
      "función del trigger con search_path público",
      "security definer\nset search_path = ''\nas $$",
      "security definer\nset search_path = public\nas $$",
      /CONTRATO 6: la función del trigger/,
    ],
    [
      "EXECUTE sin revocar a authenticated",
      "revoke execute on function public.supplier_bills_validate_cost_link() from public, anon, authenticated;",
      "revoke execute on function public.supplier_bills_validate_cost_link() from anon;",
      /CONTRATO 6: anon o authenticated/,
    ],
    [
      "trigger en cualquier UPDATE (bloquea la CxP legada)",
      "before insert or update of consolidation_id, shipment_id, cost_category, tenant_id",
      "before insert or update",
      /cost_category/,
    ],
  ])("mutante: %s", async (_name, anchor, replacement, expected) => {
    expect(await run(inline({ transform: mutate(anchor, replacement) }))).toMatch(expected);
  }, 60_000);
});
