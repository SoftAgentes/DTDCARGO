// @vitest-environment node
/**
 * SDD-0586 10.7 · Deshacer en Studio la carga P4 (sub-paso 4.6b), corrido de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/deshacer_vinculos_portal.test.sql` aplica las migraciones reales (0519, 0520,
 * 0523, 0508 y 0524 sobre la 0006, la 0106, la 0337, la 0503 y la 0504), hace una carga con las funciones
 * reales y corre `supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql` tal cual. En Actions
 * corre además en Postgres 17 (`sql-tests.yml`).
 *
 * CONTROL ROJO: sin el guion el contrato cae (la función no existe).
 * MUTANTES: cada uno es un guion coherente con un defecto y tiene que caer en la aserción que lo nombra.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/deshacer_vinculos_portal.test.sql");
const GUION_PATH = "cargas/portal-historial-deshacer/deshacer-vinculos.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const GUION = read(resolve(ROOT, "supabase", GUION_PATH));
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

async function contract(guion: string = GUION) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, { [GUION_PATH]: guion }));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST deshacer"));
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

describe("SDD-0586 10.7 · deshacer en Studio la carga P4 (PGlite)", () => {
  it("el contrato pasa entero con el guion real", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST deshacer GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin el guion el contrato cae", async () => {
    const run = await contract("select 1;");
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/TEST deshacer: existe deshacer_vinculos/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    [
      "borra los contactos en vez de vaciarlos",
      "  update public.chatwoot_portal_contactos k\n  set chatwoot_contact_id = null, chatwoot_source_id = null, updated_at = pg_catalog.now()\n  where k.tenant_id = p.tenant",
      "  delete from public.chatwoot_portal_contactos k\n  where k.tenant_id = p.tenant",
      /TEST deshacer: el contacto de B queda con su identificador/,
    ],
    [
      "no deja el corte en nulo",
      "  update public.chatwoot_portal_estado e\n  set corte = null, cargado_at = null, updated_at = pg_catalog.now()\n  where e.tenant_id = p.tenant;\n",
      "",
      /deshacer_vinculos: la verificación no cuadra|TEST deshacer: deshace e informa/,
    ],
    [
      "no mira el flag",
      "    raise exception 'deshacer_vinculos: chatwoot_portal está encendido' using errcode = '55000';",
      "    null;",
      /TEST deshacer: con el flag encendido se niega/,
    ],
    [
      "no mira la auditoría del flag",
      "    raise exception 'deshacer_vinculos: chatwoot_portal se encendió alguna vez' using errcode = '55000';",
      "    null;",
      /TEST deshacer: si el flag se encendió alguna vez se niega/,
    ],
    [
      "acepta una salida que no está cargado",
      "    raise exception 'deshacer_vinculos: la cola corrió (hay salidas que no están cargado)' using errcode = '55000';",
      "    null;",
      /TEST deshacer: con una salida que no está cargado se niega/,
    ],
    [
      "no mira los triggers",
      "    raise exception 'deshacer_vinculos: hay un trigger en las tablas que toca' using errcode = '55000';",
      "    null;",
      /TEST deshacer: con un trigger en las tablas que toca se niega/,
    ],
    [
      "no compara los conteos",
      "    raise exception 'deshacer_vinculos: los conteos no son los esperados (salida % hilos % contactos % espejo %)',\n      v_salida, v_hilos, v_contactos, v_espejo using errcode = '22023';",
      "    null;",
      /TEST deshacer: con conteos distintos de los esperados se niega/,
    ],
    [
      "no compara la bandeja",
      "    raise exception 'deshacer_vinculos: un espejo vinculado no es de la bandeja' using errcode = '22023';",
      "    null;",
      /TEST deshacer: con un espejo de otra bandeja se niega/,
    ],
    [
      "ignora el archivo de E5",
      "    and not exists (\n      select 1 from pg_temp.conservados c\n      where c.linea::jsonb ->> 'tipo' = 'contacto' and c.linea::jsonb ->> 'identificador' = k.identificador::text\n    );",
      ";",
      /deshacer_vinculos: la verificación no cuadra|TEST deshacer: el contacto conservado/,
    ],
    [
      "acepta un contacto conservado que Studio no tiene",
      "    raise exception 'deshacer_vinculos: un contacto conservado no es el que Studio tiene' using errcode = '22023';",
      "    null;",
      /TEST deshacer: con un identificador no reservado se niega/,
    ],
    [
      "no borra el espejo",
      "  delete from public.chatwoot_conversations cc\n  using public.chatwoot_portal_hilos hl\n  where hl.tenant_id = p.tenant and cc.tenant_id = p.tenant and cc.conversation_id = hl.chatwoot_conversation_id;\n  get diagnostics d_espejo = row_count;",
      "  d_espejo := p.esperados_espejo;",
      /TEST deshacer: no queda el espejo de los hilos vinculados/,
    ],
    // ── B2 ──
    [
      "acepta la marca copia solo en la sesión",
      "    if not v_guardada then\n      raise exception 'deshacer_vinculos: la marca copia no está guardada para la base (solo en la sesión)'\n        using errcode = '22023';\n    end if;\n",
      "",
      /TEST deshacer: copia con la marca solo en la sesión se niega/,
    ],
    // ── B3: el borrado se limita a lo cargado del tenant ──
    [
      "borra las salidas de todos los tenants",
      "  delete from public.chatwoot_portal_salida s where s.tenant_id = p.tenant and s.estado = 'cargado';",
      "  delete from public.chatwoot_portal_salida s where s.estado = 'cargado';",
      /TEST deshacer: (deshace e informa|no toca otro tenant)/,
    ],
    [
      "borra el espejo sin cruzarlo con los hilos",
      "  where hl.tenant_id = p.tenant and cc.tenant_id = p.tenant and cc.conversation_id = hl.chatwoot_conversation_id;",
      "  where hl.tenant_id = p.tenant and cc.tenant_id = p.tenant;",
      /TEST deshacer: (deshace e informa|no toca otro tenant)/,
    ],
    [
      // La huella de lo ajeno como detector: borra lo de otro tenant sin mover ningún conteo del tenant.
      // Ni la verificación ni el HECHO lo ven; solo «no toca otro tenant».
      "borra además las salidas de otro tenant, sin contarlas",
      "  get diagnostics d_salida = row_count;",
      "  get diagnostics d_salida = row_count;\n  delete from public.chatwoot_portal_salida s where s.tenant_id <> p.tenant;",
      /TEST deshacer: no toca otro tenant/,
    ],
    [
      "borra los hilos de todos los tenants",
      "  delete from public.chatwoot_portal_hilos hl where hl.tenant_id = p.tenant;",
      "  delete from public.chatwoot_portal_hilos hl;",
      /TEST deshacer: (deshace e informa|no toca otro tenant)/,
    ],
    // ── N3 ──
    [
      "no exige los parámetros",
      "    raise exception 'deshacer_vinculos: faltan los parámetros' using errcode = '22023';",
      "    null;",
      /TEST deshacer: sin parámetros se niega/,
    ],
    [
      "acepta un entorno que no es copia ni produccion",
      "    raise exception 'deshacer_vinculos: el entorno tiene que ser copia o produccion' using errcode = '22023';",
      "    null;",
      /TEST deshacer: con un entorno que no es copia ni produccion se niega/,
    ],
    [
      "no compara la cabecera de los conservados",
      "    raise exception 'deshacer_vinculos: la cabecera de los conservados no es la del tenant, la cuenta o la bandeja' using errcode = '22023';",
      "    null;",
      /TEST deshacer: con la cabecera de otro tenant se niega/,
    ],
    [
      "no compara el conteo de los conservados",
      "    raise exception 'deshacer_vinculos: el conteo de los conservados no cuadra' using errcode = '22023';",
      "    null;",
      /TEST deshacer: con el conteo de los conservados que no cuadra se niega/,
    ],
    [
      "no exige una sola cabecera",
      "    raise exception 'deshacer_vinculos: el archivo de los conservados lleva una sola cabecera' using errcode = '22023';",
      "    null;",
      /TEST deshacer: sin la cabecera de los conservados se niega/,
    ],
    [
      "no mira el entorno",
      "  if (p.entorno = 'copia' and v_marca <> 'copia') or (p.entorno = 'produccion' and v_marca <> '') then",
      "  if false then",
      /TEST deshacer: produccion en una base con la marca copia se niega/,
    ],
    [
      "produccion sin comparar el system_identifier",
      "    if p.sistema is null or v_sistema is distinct from p.sistema then",
      "    if false then",
      /TEST deshacer: produccion con otro system_identifier se niega/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract(once(GUION, from, to));
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("no es una migración y no deja objetos: define solo una función en pg_temp", () => {
    const sinComentarios = GUION.replace(/^\s*--.*$/gm, "");
    expect(sinComentarios).toMatch(/create or replace function pg_temp\.deshacer_vinculos\(\)/);
    expect(sinComentarios).not.toMatch(/create (or replace )?(function|table|trigger|view|index) public\./i);
    expect(sinComentarios).not.toMatch(/\b(alter|drop) (table|function)\b/i);
  });
});
