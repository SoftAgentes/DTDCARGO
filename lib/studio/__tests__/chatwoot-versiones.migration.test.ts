// @vitest-environment node
/**
 * SDD-0588 · La migración 0507 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0507_chatwoot_versiones.test.sql` aplica la 0507
 * REAL y escribe como la Server Action (rol authenticated con el JWT de cada
 * usuario) y como el cron (service_role). PGlite lo corre con los `.sql`
 * inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0507 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0507 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * PENDIENTE: la 0507 está declarada en migrations-baseline.json hasta que Sam
 * la autorice y se aplique.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0507_chatwoot_versiones.test.sql");
const M0507 = "0507_chatwoot_versiones.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0507 = read(resolve(ROOT, "supabase/migrations", M0507));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0507"));
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

describe("SDD-0588 · 0507 revisiones y pedidos de versiones de Chatwoot (PGlite)", () => {
  it("el contrato pasa entero con la 0507", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0507 GREEN: 26 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0507 la tabla no existe y el contrato cae", async () => {
    const run = await contract({ [M0507]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0507: existe chatwoot_version_checks/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "revisiones legibles por cualquiera del tenant",
      "    tenant_id = (select public.get_user_tenant_id())\n    and (select public.is_tenant_admin())\n  );\n\ncreate policy chatwoot_version_checks_service_role_all",
      "    tenant_id = (select public.get_user_tenant_id())\n  );\n\ncreate policy chatwoot_version_checks_service_role_all",
      /TEST 0507: quien no es admin no ve las revisiones/,
    ],
    [
      "INSERT de revisiones concedido a authenticated",
      "grant select on public.chatwoot_version_checks to authenticated;",
      "grant select, insert on public.chatwoot_version_checks to authenticated;\ncreate policy chatwoot_version_checks_insert on public.chatwoot_version_checks for insert to authenticated with check (true);",
      /TEST 0507: ni el admin escribe revisiones/,
    ],
    [
      "sin el formato de versión",
      "  installed_version text check (installed_version ~ '^[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,4}$'),",
      "  installed_version text,",
      /TEST 0507: una versión sin el formato X\.Y\.Z no entra/,
    ],
    [
      "sin amarrar el error a su código",
      "  check ((status = 'error') = (error_code is not null)),\n",
      "",
      /TEST 0507: un error sin código no entra/,
    ],
    [
      "pedido sin exigir admin",
      "    and (select public.is_tenant_admin())\n    and requested_by",
      "    and requested_by",
      /TEST 0507: quien no es admin no pide actualizaciones/,
    ],
    [
      "pedido sin requested_by = auth.uid()",
      "    and requested_by = (select auth.uid())\n",
      "",
      /TEST 0507: requested_by tiene que ser quien pide/,
    ],
    [
      "pedido sin comprobar la revisión citada",
      "    and (check_id is null or exists (\n      select 1 from public.chatwoot_version_checks c where c.id = check_id\n    ))\n",
      "",
      /TEST 0507: el pedido no se amarra a la revisión de otro tenant/,
    ],
    [
      "sin un pedido por versión",
      ",\n  unique (tenant_id, to_version)",
      "",
      /TEST 0507: la misma versión no se pide dos veces/,
    ],
    [
      "UPDATE de pedidos concedido",
      "grant select, insert on public.chatwoot_update_requests to authenticated;",
      "grant select, insert, update on public.chatwoot_update_requests to authenticated;\ncreate policy chatwoot_update_requests_update on public.chatwoot_update_requests for update to authenticated using (true);",
      /TEST 0507: nadie edita un pedido/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0507]: once(FILE_0507, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si las tablas ya existen", async () => {
    const run = await contract({ [M0507]: `${FILE_0507}\n${FILE_0507}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0507: las tablas de versiones de Chatwoot ya existen/);
  }, SLOW);

  it("la 0507 queda declarada pendiente hasta que Sam la autorice", () => {
    expect(BASELINE.pendingBelowCutoff["0507_chatwoot_versiones"]).toMatch(/SDD-0588/);
    expect(FILE_0507).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
