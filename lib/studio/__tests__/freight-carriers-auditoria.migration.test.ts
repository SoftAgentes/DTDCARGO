// @vitest-environment node
/**
 * SDD-0539 · La migración 0491 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0491_freight_carriers_auditoria.test.sql` monta
 * el writer AUD-01 real (0267 + 0294), la tabla real (0330), la 0490 que ya
 * está en producción y la 0491, y escribe como la Server Action (rol
 * authenticated con JWT de admin). PGlite lo corre con los `.sql` inlineados:
 * lo que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0491 el contrato cae (ninguna escritura deja evento).
 * MUTANTES: cada uno es una 0491 coherente con un defecto y tiene que caer.
 * DRIFT: si la función ya existe, el preflight aborta sin cambiar nada.
 * ESPERA: la 0491 está declarada en migrations-baseline.json y su cabecera
 * dice «NO APLICADA».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0491_freight_carriers_auditoria.test.sql");
const M0491 = "0491_freight_carriers_auditoria.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0491 = read(resolve(ROOT, "supabase/migrations", M0491));
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
  const db = new PGlite();
  try {
    const results = await db.exec(inline(CONTRACT, replace));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0491"));
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

describe("SDD-0539 · 0491 auditoría del registro de transportistas (PGlite)", () => {
  it("el contrato pasa entero con la 0491", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0491 GREEN: 35 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0491 ninguna escritura deja evento y el contrato cae", async () => {
    const run = await contract({ [M0491]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST 0491: cada alta de transportista deja un freight_carrier_created/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "un UPDATE sin cambio escribe evento",
      "    if v_changed = '[]'::jsonb then\n",
      "    if false then\n",
      /TEST 0491: tocar sólo updated_at/,
    ],
    [
      "quitar no se distingue de cambiar el predeterminado",
      "    'deleted', pg_catalog.to_jsonb((v_new->>'deleted_at') is not null),\n",
      "    'deleted', pg_catalog.to_jsonb(false),\n",
      /TEST 0491: quitar al que cotiza deja freight_carrier_deleted/,
    ],
    [
      "cambiar cuál cotiza la web queda como una edición cualquiera",
      "  elsif v_before->'is_default' is distinct from v_after->'is_default' then\n",
      "  elsif false then\n",
      /TEST 0491: el anterior deja freight_carrier_default_changed/,
    ],
    [
      "el actor se pierde y queda como system",
      "    case when v_actor_id is null then 'system' else 'user' end,\n    v_actor_id,\n",
      "    'system',\n    null,\n",
      /TEST 0491: el actor es el usuario del JWT/,
    ],
    [
      "before_data no trae is_default",
      "    'is_default', v_old->'is_default',\n",
      "",
      /TEST 0491: el anterior deja freight_carrier_default_changed de true a false/,
    ],
    [
      "after_data copia el contacto",
      "    'notes_present', pg_catalog.to_jsonb(nullif(v_new->>'notes', '') is not null)\n  ) end;\n",
      "    'notes_present', pg_catalog.to_jsonb(nullif(v_new->>'notes', '') is not null),\n    'contact', v_new->'contact'\n  ) end;\n",
      /TEST 0491: ni nombre, razón social, RIF, contacto ni notas se copian/,
    ],
    [
      "el payload no lista las columnas cambiadas",
      "    v_payload := pg_catalog.jsonb_build_object('changed_fields', v_changed);\n",
      "    v_payload := '{}'::jsonb;\n",
      /TEST 0491: entidad, tenant y columnas cambiadas del nuevo/,
    ],
    [
      "el nombre no se vigila",
      "        'name', 'legal_name', 'tax_id', 'contact', 'notes',\n",
      "        'legal_name', 'tax_id', 'contact', 'notes',\n",
      /TEST 0491: renombrar deja un evento/,
    ],
    [
      "quitar al que cotiza no lo dice en el motivo",
      "    v_reason := case when (v_before->>'is_default')::boolean\n",
      "    v_reason := case when false\n",
      /TEST 0491: quitar al que cotiza deja freight_carrier_deleted con el motivo/,
    ],
    [
      "el borrado físico no se audita",
      "  after insert or update or delete on public.freight_carriers\n",
      "  after insert or update on public.freight_carriers\n",
      /TEST 0491: un DELETE físico deja freight_carrier_deleted/,
    ],
    [
      "sensibilidad interna en vez de restringida",
      "    1,\n    'restricted'\n",
      "    1,\n    'internal'\n",
      /TEST 0491: fuente, resultado y sensibilidad/,
    ],
    [
      "la función queda ejecutable por la API",
      "revoke all on function public.audit_freight_carrier_change() from public, anon, authenticated;\n",
      "",
      /0491: audit_freight_carrier_change quedó ejecutable por la API/,
    ],
    [
      "el tipo de entidad no se registra",
      "values ('freight_carrier', 'active', 'configuration', 1, 'migration:0491')\n",
      "values ('freight_carrier_x', 'active', 'configuration', 1, 'migration:0491')\n",
      /0491: falta el tipo de entidad freight_carrier activo/,
    ],
  ];

  for (const [nombre, from, to, cae] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0491]: once(FILE_0491, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(cae);
    }, SLOW);
  }

  it("DRIFT: si la función ya existe, el preflight aborta antes de tocar nada", async () => {
    const previa =
      "create function public.audit_freight_carrier_change() returns trigger\n" +
      "language plpgsql as $$ begin return new; end $$;\n";
    const run = await contract({ [M0491]: previa + FILE_0491 });
    expect(run.error).toMatch(/0491 abortado: audit_freight_carrier_change ya existe/);
  }, SLOW);

  it("DRIFT: sin el writer AUD-01 el preflight aborta", async () => {
    const sinWriter =
      "drop function public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text);\n";
    const run = await contract({ [M0491]: sinWriter + FILE_0491 });
    expect(run.error).toMatch(/0491 requiere append_audit_event/);
  }, SLOW);
});

describe("SDD-0539 · 0491 NO APLICADA (texto y espera declarada)", () => {
  it("la cabecera dice que no está aplicada y nombra el runbook", () => {
    expect(FILE_0491).toContain("NO APLICADA A PRODUCCIÓN");
    expect(FILE_0491).toContain("docs/runbooks/aplicar-migraciones-prod.md");
  });

  it("está declarada como espera, con el OK nominal y el orden migrate-first", () => {
    const espera = BASELINE.pendingBelowCutoff["0491_freight_carriers_auditoria"];
    expect(espera).toMatch(/^PENDIENTE DE APLICAR — SDD-0539/);
    expect(espera).toContain("MIGRATE-FIRST COMPATIBLE");
    expect(espera).toContain("Requiere OK nominal de Sam");
    expect(espera).toContain("name exacto 0491_freight_carriers_auditoria");
    expect(BASELINE.cutoff).toBe(238);
  });
});
