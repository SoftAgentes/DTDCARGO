// @vitest-environment node
/**
 * SDD-0608 · La migración 0516 corrida de verdad sobre PostgreSQL embebido,
 * con el contrato `supabase/tests/0516_…test.sql` y el `.sql` real inlineado.
 *
 * CONTROL ROJO: sin la migración el contrato falla. MUTANTES: cada uno quita
 * una barrera de la migración y el contrato tiene que caer en el punto que la
 * protege.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0516_discord_consulta_clientes.test.sql");
const MIGRATION = "0516_discord_consulta_clientes.sql";

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

function mutar(buscar: string, poner: string, todas = false) {
  return (sql: string) => {
    const mutado = todas ? sql.split(buscar).join(poner) : sql.replace(buscar, poner);
    if (mutado === sql) throw new Error(`el mutante no encontró: ${buscar}`);
    return mutado;
  };
}

describe("0516 · consulta de clientes desde Discord (PGlite)", () => {
  it("el contrato completo pasa con la migración real", async () => {
    expect(await run(inline(CONTRACT))).toBeNull();
  }, 60_000);

  it("control rojo: sin la migración el contrato falla", async () => {
    expect(await run(inline(CONTRACT, { omit: true }))).toMatch(/discord_buscar_clientes/);
  }, 60_000);

  it("mutante: sin escapar `%`, «%%» devuelve clientes", async () => {
    const sinEscape = mutar(`'%', '\\%'`, `'%', '%'`);
    expect(await run(inline(CONTRACT, { transform: sinEscape }))).toMatch(
      /CONTRATO 1\/2: búsqueda «%%» \(%% literal\)/,
    );
  }, 60_000);

  it("mutante: sin escapar `_`, «ana_luisa» también trae a AnaXLuisa", async () => {
    const sinEscape = mutar(`'_', '\\_'`, `'_', '_'`);
    expect(await run(inline(CONTRACT, { transform: sinEscape }))).toMatch(
      /CONTRATO 1\/2: búsqueda «ana_luisa»/,
    );
  }, 60_000);

  it("mutante: sin exigir una palabra, «%» de una letra devuelve todos", async () => {
    const sinPiso = mutar("and exists (select 1 from palabras)", "");
    expect(await run(inline(CONTRACT, { transform: sinPiso }))).toMatch(/CONTRATO 1\/2: búsqueda «%» \(% solo\)/);
  }, 60_000);

  it("mutante: sin filtrar eliminados, aparece el Pedro Pérez borrado", async () => {
    const conBorrados = mutar("and c.deleted_at is null", "");
    expect(await run(inline(CONTRACT, { transform: conBorrados }))).toMatch(
      /CONTRATO 1\/2: búsqueda «pedro perez»/,
    );
  }, 60_000);

  it("mutante: la búsqueda devuelve también el teléfono", async () => {
    const conTelefono = (sql: string) =>
      mutar("returns table (markbox text, name text)", "returns table (markbox text, name text, phone text)")(
        mutar("select c.markbox, c.name", "select c.markbox, c.name, c.phone")(sql),
      );
    expect(await run(inline(CONTRACT, { transform: conTelefono }))).toMatch(
      /CONTRATO 3: la búsqueda devuelve otras columnas/,
    );
  }, 60_000);

  it("mutante: tope con <= deja pasar una consulta de más", async () => {
    const tope = mutar("v_recientes < greatest", "v_recientes <= greatest");
    expect(await run(inline(CONTRACT, { transform: tope }))).toMatch(/CONTRATO 4: la cuarta consulta/);
  }, 60_000);

  it("mutante: sin retención, la fila de 200 días se queda", async () => {
    const sinRetencion = mutar("interval '180 days'", "interval '1000 days'");
    expect(await run(inline(CONTRACT, { transform: sinRetencion }))).toMatch(/CONTRATO 5/);
  }, 60_000);

  it("mutante: con EXECUTE para authenticated, el contrato lo detecta", async () => {
    const conGrant = (sql: string) =>
      `${sql}\ngrant execute on function public.discord_buscar_clientes(uuid, text, integer) to authenticated;\n`;
    expect(await run(inline(CONTRACT, { transform: conGrant }))).toMatch(
      /CONTRATO 6: authenticated pudo ejecutar: select \* from public\.discord_buscar_clientes/,
    );
  }, 60_000);
});
