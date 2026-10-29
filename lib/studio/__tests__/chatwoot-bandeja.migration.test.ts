// @vitest-environment node
/**
 * SDD-0585 · La migración 0503 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0503_chatwoot_bandeja.test.sql` aplica la 0337
 * REAL (catálogo, siembra y trigger) y después la 0503 REAL, y escribe como la
 * Server Action (rol authenticated con el JWT de cada usuario). PGlite lo corre
 * con los `.sql` inlineados: lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0503 el contrato cae en la primera aserción.
 * MUTANTES: cada uno es una 0503 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * PENDIENTE: la 0503 está declarada en migrations-baseline.json hasta que Sam
 * la autorice y se aplique.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0503_chatwoot_bandeja.test.sql");
const M0503 = "0503_chatwoot_bandeja.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0503 = read(resolve(ROOT, "supabase/migrations", M0503));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0503"));
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

describe("SDD-0585 · 0503 flag chatwoot_inbox y vínculos de agentes (PGlite)", () => {
  it("el contrato pasa entero con la 0503", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0503 GREEN: 26 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0503 el catálogo no tiene el flag y el contrato cae", async () => {
    const run = await contract({ [M0503]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0503: el catálogo tiene chatwoot_inbox apagado/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "SELECT sin el filtro por usuario",
      "    and (user_id = (select auth.uid()) or (select public.is_tenant_admin()))\n",
      "",
      /TEST 0503: otro usuario del tenant no ve el vínculo ajeno/,
    ],
    [
      "INSERT sin exigir admin",
      "    and (select public.is_tenant_admin())\n    and created_by",
      "    and created_by",
      /TEST 0503: quien no es admin no crea vínculos/,
    ],
    [
      "INSERT sin created_by = auth.uid()",
      "    and created_by = (select auth.uid())\n",
      "",
      /TEST 0503: created_by tiene que ser quien crea/,
    ],
    [
      "sin unicidad del agente por tenant",
      ",\n  unique (tenant_id, chatwoot_user_id)",
      "",
      /TEST 0503: un agente de Chatwoot no se vincula a dos usuarios/,
    ],
    [
      "DELETE sin exigir admin",
      "    and (select public.is_tenant_admin())\n  );\n\ncreate policy chatwoot_agent_links_service_role_all",
      "  );\n\ncreate policy chatwoot_agent_links_service_role_all",
      /TEST 0503: quien no es admin no borra/,
    ],
    [
      "UPDATE concedido",
      "grant select, insert, delete on public.chatwoot_agent_links to authenticated;",
      "grant select, insert, update, delete on public.chatwoot_agent_links to authenticated;",
      /TEST 0503: nadie edita un vínculo/,
    ],
    [
      "sin la siembra en los tenants existentes",
      "where c.key = 'chatwoot_inbox'\non conflict (tenant_id, key) do nothing;",
      "where false\non conflict (tenant_id, key) do nothing;",
      /TEST 0503: los dos tenants existentes reciben chatwoot_inbox/,
    ],
    [
      "catálogo que pierde una fila de 0337",
      "    ('sso',                   false, 'Single Sign-On'),\n",
      "",
      /TEST 0503: la 0503 conserva todas las filas/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0503]: once(FILE_0503, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si la tabla ya existe", async () => {
    const run = await contract({ [M0503]: `${FILE_0503}\n${FILE_0503}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0503: (public\.chatwoot_agent_links ya existe|el catálogo ya tiene chatwoot_inbox)/);
  }, SLOW);

  it("la 0503 queda declarada pendiente hasta que Sam la autorice", () => {
    expect(BASELINE.pendingBelowCutoff["0503_chatwoot_bandeja"]).toMatch(/SDD-0585/);
    expect(FILE_0503).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
