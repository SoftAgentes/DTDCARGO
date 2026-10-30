// @vitest-environment node
/**
 * SDD-0587 · La migración 0506 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0506_crm_modelo.test.sql` aplica la 0505 y la
 * 0506 REALES y usa el modelo como lo harán Studio (authenticated, por rol) y
 * los manejadores (service_role). PGlite lo corre con los `.sql` inlineados: lo
 * que se prueba es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0506 el contrato cae en la primera aserción (el núcleo no existe).
 * MUTANTES: cada uno es una 0506 coherente con un defecto y tiene que caer en
 * la aserción que lo nombra.
 * PENDIENTE: la 0506 está declarada en migrations-baseline.json hasta que Sam
 * la autorice y se aplique.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0506_crm_modelo.test.sql");
const M0506 = "0506_crm_modelo.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const FILE_0506 = read(resolve(ROOT, "supabase/migrations", M0506));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0506"));
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

describe("SDD-0587 · 0506 modelo de datos del CRM (PGlite)", () => {
  it("el contrato pasa entero con la 0506", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toBe("TEST 0506 GREEN: 78 aserciones");
  }, SLOW);

  it("CONTROL ROJO: sin la 0506 el núcleo no existe y el contrato cae", async () => {
    const run = await contract({ [M0506]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/crm_segmento_cliente/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // Regla de segmentos (núcleo único).
    [
      "ficha borrada tiene segmento",
      "      and c.deleted_at is null\n  ), familia",
      "  ), familia",
      /TEST 0506: ficha borrada no tiene segmento/,
    ],
    [
      "sin historial",
      "      on h.client_id = f.miembro and h.tenant_id = p_tenant_id",
      "      on false",
      /TEST 0506: envío con un código del historial cuenta/,
    ],
    ["sin fichas fusionadas", "    where f.nivel < 10", "    where false", /TEST 0506: envío con el código de una ficha fusionada cuenta/],
    ["fusión de un solo salto", "    where f.nivel < 10", "    where f.nivel < 1", /TEST 0506: recibo con el código de una fusionada a dos saltos cuenta/],
    [
      "códigos sin normalizar",
      "on pg_catalog.upper(pg_catalog.btrim(s.client_markbox)) = k.codigo",
      "on s.client_markbox = k.codigo",
      /TEST 0506: envío con un código del historial cuenta, normalizado/,
    ],
    ["borrador cuenta", "not in ('draft', 'cancelled')", "not in ('cancelled')", /TEST 0506: borrador, cancelado/],
    ["cancelado cuenta", "not in ('draft', 'cancelled')", "not in ('draft')", /TEST 0506: borrador, cancelado/],
    ["envío borrado cuenta", "                  and s.deleted_at is null\n", "", /TEST 0506: borrador, cancelado, envío borrado/],
    ["recibo borrado cuenta", "                  and r.deleted_at is null\n", "", /TEST 0506: borrador, cancelado, envío borrado y recibo borrado/],
    ["huérfano cuenta", "                  and not r.is_orphan\n", "", /TEST 0506: recibo huérfano no cuenta/],
    [
      "envíos de otro tenant",
      "                  and s.tenant_id = p_tenant_id\n",
      "",
      /TEST 0506: sin envíos propios es lead registrado: el envío de otro tenant con su código no cuenta/,
    ],
    [
      "la 0505 no delega",
      "  return public.crm_segmento_cliente(p_tenant_id, v_cliente);",
      "  return 'lead_registrado';",
      /TEST 0506: el segmento por teléfono de la 0505 coincide con el núcleo/,
    ],
    ["ambiguo que adivina", "  if v_cruces <> 1 then", "  if v_cruces < 1 then", /TEST 0506: el segmento por teléfono de la 0505 coincide/],
    // Etapas.
    ["sin trigger de tenant nuevo", "  after insert on public.tenants", "  after update on public.tenants", /TEST 0506: un tenant nuevo recibe sus etapas/],
    ["etapa de sistema se apaga", "  check (activa or not sistema)\n", "  check (true)\n", /TEST 0506: una etapa de sistema no se apaga/],
    [
      "comercial renombra etapas",
      "create policy crm_etapas_update_admin on public.crm_etapas\n  for update to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()))\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      "create policy crm_etapas_update_admin on public.crm_etapas\n  for update to authenticated\n  using (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()))\n  with check (tenant_id = (select public.get_user_tenant_id()) and (select public.crm_puede_usar()));",
      /TEST 0506: un comercial no renombra etapas/,
    ],
    [
      "se borra una etapa de sistema",
      "  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()) and not sistema);",
      "  using (tenant_id = (select public.get_user_tenant_id()) and (select public.is_tenant_admin()));",
      /TEST 0506: el admin crea y borra una etapa propia, pero no borra una de sistema/,
    ],
    // Tarjetas y acceso.
    [
      "operaciones ve el CRM",
      "(select public.current_studio_role()) in ('admin', 'commercial')",
      "(select public.current_studio_role()) is not null",
      /TEST 0506: quien no tiene el módulo CRM no ve tarjetas ni etapas/,
    ],
    [
      "fuente libre desde Studio",
      " and (select public.crm_puede_usar()) and fuente = 'manual');",
      " and (select public.crm_puede_usar()));",
      /TEST 0506: desde Studio solo se crean tarjetas con fuente manual/,
    ],
    [
      "etapa por UPDATE",
      "grant update (client_id, nombre_visible, phone_last10, asesor_id) on public.crm_tarjetas",
      "grant update (client_id, nombre_visible, phone_last10, asesor_id, etapa_leads) on public.crm_tarjetas",
      /TEST 0506: la etapa no se cambia con UPDATE/,
    ],
    ["la fuente se pisa", "    if (new.fuente, new.fuente_detalle,", "    if false and (new.fuente, new.fuente_detalle,", /TEST 0506: la fuente y la atribución no se pisan/],
    [
      "ficha de otro tenant",
      "    select 1 from public.clients c where c.id = new.client_id and c.tenant_id = new.tenant_id",
      "    select 1 from public.clients c where c.id = new.client_id",
      /TEST 0506: una ficha de otro tenant no se liga/,
    ],
    [
      "asesor de otro tenant",
      "     and not exists (\n       select 1 from public.user_tenants ut",
      "     and false and not exists (\n       select 1 from public.user_tenants ut",
      /TEST 0506: el asesor tiene que ser del tenant/,
    ],
    [
      "con ficha copia el nombre",
      "  check (client_id is null or (nombre_visible is null and phone_last10 is null)),\n",
      "",
      /TEST 0506: con ficha, la tarjeta no copia nombre ni teléfono/,
    ],
    [
      "tablero de otro tenant",
      "    where t.tenant_id = v_tenant and t.id = any (p_tarjeta_ids);",
      "    where t.id = any (p_tarjeta_ids);",
      /TEST 0506: el tablero sale del segmento en el momento y no ve tarjetas de otro tenant/,
    ],
    // Movimientos.
    ["cierre sin motivo", "  if v_terminal and v_motivo is null then", "  if false then", /TEST 0506: pasar a «Perdido» pide motivo/],
    [
      "el motivo se queda",
      "        motivo_perdida = case when v_terminal then v_motivo end,",
      "        motivo_perdida = coalesce(v_motivo, motivo_perdida),",
      /TEST 0506: al salir de «Perdido» se borra el motivo/,
    ],
    [
      "el automático repite",
      "  if exists (\n    select 1 from public.crm_historial_etapas h\n    where h.tenant_id = p_tenant_id and h.clave_evento = p_clave_evento\n  ) then",
      "  if false then",
      /TEST 0506: un evento automático repetido no mueve dos veces/,
    ],
    [
      "el automático pisa al manual",
      "  if v_manual is not null and v_manual > p_ocurrio_at then",
      "  if false then",
      /TEST 0506: un movimiento manual posterior al evento gana/,
    ],
    [
      "automático abierto a authenticated",
      "grant execute on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) to service_role;",
      "grant execute on function public.crm_mover_etapa_auto(uuid, uuid, text, text, text, timestamptz) to service_role, authenticated;",
      /TEST 0506: las funciones internas son solo de service_role: public.crm_mover_etapa_auto/,
    ],
    // Tareas.
    [
      "tarea a nombre ajeno",
      " and origen = 'manual' and created_by = (select auth.uid()));",
      " and origen = 'manual');",
      /TEST 0506: una tarea se crea a nombre propio/,
    ],
    // Retención (D6).
    [
      "anonimiza fichas",
      "    and t.client_id is null\n    and t.anonimizada_at is null",
      "    and t.anonimizada_at is null",
      /TEST 0506: se anonimiza solo el lead sin ficha/,
    ],
    ["anonimiza a los 6 meses", "interval '12 months'", "interval '6 months'", /TEST 0506: se anonimiza solo el lead sin ficha/],
    [
      "anonimizar deja las notas",
      "  delete from public.crm_notas n where n.tarjeta_id = any (v_ids);\n",
      "",
      /TEST 0506: al anonimizar se borran sus notas/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [M0506]: once(FILE_0506, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si el modelo ya existe", async () => {
    const run = await contract({ [M0506]: `${FILE_0506}\n${FILE_0506}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0506: el modelo del CRM ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la 0505 aborta sin crear nada", async () => {
    const run = await contract({ "0505_chatwoot_segmento.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0506 requiere la 0505/);
  }, SLOW);

  it("la 0506 queda declarada pendiente hasta que Sam la autorice", () => {
    expect(BASELINE.pendingBelowCutoff["0506_crm_modelo"]).toMatch(/SDD-0587/);
    expect(FILE_0506).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
