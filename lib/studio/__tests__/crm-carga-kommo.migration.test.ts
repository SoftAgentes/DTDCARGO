// @vitest-environment node
/**
 * SDD-0582 · E6, paso 6.5 · El cargador de Kommo al CRM corrido de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/crm_carga_kommo.test.sql` aplica la 0503 a la 0506 y la 0513 REALES, arma un
 * espejo de Kommo con datos inventados y corre `supabase/cargas/crm-kommo/carga.sql` tal cual: en seco, de
 * verdad y otra vez con el mismo corte. En Actions corre además en Postgres 17 (`sql-tests.yml`).
 *
 * CONTROL ROJO: sin el cargador el contrato cae (la función no existe).
 * MUTANTES: cada uno es un cargador coherente con un defecto y tiene que caer en la aserción que lo nombra.
 * ESTÁTICA: el cargador no llama afuera, no escribe en el espejo ni en las fichas y no deja objetos.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/crm_carga_kommo.test.sql");
const CARGA_PATH = "cargas/crm-kommo/carga.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const CARGA = read(resolve(ROOT, "supabase", CARGA_PATH));
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

async function contract(carga: string = CARGA) {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(inline(CONTRACT, { [CARGA_PATH]: carga }));
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST CARGA KOMMO"));
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

describe("SDD-0582 6.5 · cargador de Kommo al CRM (PGlite)", () => {
  it("el contrato pasa entero con el cargador real", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST CARGA KOMMO GREEN: \d+ aserciones$/);
  }, SLOW);

  it("control rojo: sin el cargador el contrato cae", async () => {
    const run = await contract("select 1;");
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/crm_carga_kommo/);
  }, SLOW);

  const MUTANTES: Array<{ nombre: string; desde: string; hacia: string; cae: RegExp }> = [
    {
      nombre: "carga también los ganados",
      desde: "if l.status_id in (142, 143) or l.closed_at is not null then",
      hacia: "if l.status_id = 143 or l.closed_at is not null then",
      cae: /ganado, perdido y cerrado quedan fuera/,
    },
    {
      nombre: "ignora el corte de creación",
      desde: "if l.kommo_created_at > p_corte then",
      hacia: "if false then",
      cae: /el creado después del corte queda fuera/,
    },
    {
      nombre: "no mira la ventana",
      desde: "if v_act is null or v_act < v_desde then",
      hacia: "if v_act is null then",
      cae: /el quieto hace 200 días queda fuera/,
    },
    {
      nombre: "adivina entre dos tarjetas con el mismo teléfono",
      desde: "if v_n > 1 then",
      hacia: "if v_n > 99 then",
      cae: /no adivina|leads_|tarjeta/,
    },
    {
      nombre: "copia nombre y teléfono aunque haya ficha",
      desde: "case when v_client is null then v_nombre end",
      hacia: "v_nombre",
      cae: /./,
    },
    {
      nombre: "la carga pisa la etapa de la tarjeta que ya existe",
      desde: "where t.id = v_tarjeta and t.ultima_actividad_at < v_act;",
      hacia:
        "where t.id = v_tarjeta and t.ultima_actividad_at < v_act;\n" +
        "        update public.crm_tarjetas t set etapa_leads = v_etapa where t.id = v_tarjeta;",
      cae: /la tarjeta de Studio gana la etapa|el lead más reciente fija la etapa/,
    },
    {
      nombre: "pisa el asesor de la tarjeta que ya existe",
      desde: "where t.id = v_tarjeta and t.asesor_id is null;",
      hacia: "where t.id = v_tarjeta;",
      cae: /la tarjeta con dueño conserva su dueño|asesor en 2 nuevas y 1 existente/,
    },
    {
      nombre: "asesor sin exigir que esté activo",
      desde: "      v_asesor := public.crm_asesor_activo(p_tenant, v_asesor);\n",
      hacia: "",
      cae: /asesores: solo el correo de un usuario activo|asesor desactivado/,
    },
    {
      nombre: "correo sin normalizar",
      desde: "select u.id, pg_catalog.lower(pg_catalog.btrim(u.email)) as email",
      hacia: "select u.id, u.email as email",
      cae: /asesores: solo el correo|el 901 es el usuario 02/,
    },
    {
      nombre: "toma el contacto que no es el principal",
      desde: "order by lc.is_main desc, lc.contact_id limit 1;",
      hacia: "order by lc.is_main, lc.contact_id limit 1;",
      cae: /./,
    },
    {
      nombre: "el lead más viejo fija la etapa",
      desde: "order by act desc nulls last, kl.id",
      hacia: "order by act asc nulls last, kl.id",
      cae: /el lead más reciente fija la etapa|conteo por etapa/,
    },
    {
      nombre: "migra las tareas completadas",
      desde: "kt.entity_id = l.id and not kt.is_completed",
      hacia: "kt.entity_id = l.id",
      cae: /tareas abiertas|ni completadas/,
    },
    {
      nombre: "conserva el vencimiento en milisegundos",
      desde: "when k.complete_till > p_corte + interval '20 years' then null",
      hacia: "when false then null",
      cae: /dos sin vencimiento|vencimiento en milisegundos/,
    },
    {
      nombre: "repite las tareas en la segunda corrida",
      desde: "and x.tipo = 'tarea' and x.id_externo = kt.id)",
      hacia: "and x.tipo = 'tarea' and x.id_externo = -kt.id)",
      // Muere antes, en el insert del mapeo de la tarea repetida: la PK de crm_ids_externos lo frena.
      cae: /la segunda corrida no cambia crm_\*|todo ya migrado|duplicate key value violates unique constraint "crm_ids_externos_pkey"/,
    },
    {
      nombre: "no salta los leads ya migrados",
      desde: "where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'lead' and x.id_externo = l.id;",
      hacia: "where x.tenant_id = p_tenant and x.sistema = 'kommo' and x.tipo = 'lead' and x.id_externo = -l.id;",
      cae: /./,
    },
    {
      nombre: "ficha borrada cuenta",
      desde: "c.kommo_lead_id = l.id and c.deleted_at is null limit 1;",
      hacia: "c.kommo_lead_id = l.id limit 1;",
      cae: /la ficha borrada no recibe tarjeta|sin ficha viva ni teléfono|el seco cuenta lo mismo que la carga/,
    },
    {
      nombre: "acepta un corte en el futuro",
      desde: "if p_corte > pg_catalog.now() then",
      hacia: "if false then",
      cae: /un corte en el futuro se rechaza/,
    },
  ];

  for (const m of MUTANTES) {
    it(`mutante: ${m.nombre}`, async () => {
      const run = await contract(once(CARGA, m.desde, m.hacia));
      expect(run.green, "el mutante no puede dar verde").toBeUndefined();
      expect(run.error).toMatch(m.cae);
    }, SLOW);
  }

  it("estática: no llama afuera, no escribe fuera de crm_* y no deja objetos", () => {
    const sinComentarios = CARGA.replace(/--.*$/gm, "");
    expect(sinComentarios).not.toMatch(/\bnet\.|http|pg_notify|dblink|copy\s|\\!/i);
    const escrituras = [...sinComentarios.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+([a-z_.]+)/gi)].map((x) => x[1]);
    expect(escrituras.length).toBeGreaterThan(5);
    for (const tabla of escrituras) {
      expect(tabla, `escritura en ${tabla}`).toMatch(/^public\.crm_(tarjetas|historial_etapas|tareas|ids_externos)$/);
    }
    const creados = [...sinComentarios.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(\w+)\s+([a-z_.]+)/gi)];
    expect(creados.map((x) => `${x[1]} ${x[2]}`)).toEqual(["function pg_temp.crm_carga_kommo"]);
    expect(sinComentarios).not.toMatch(/\b(commit|rollback)\b/i);
  });
});
