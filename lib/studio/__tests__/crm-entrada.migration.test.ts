// @vitest-environment node
/**
 * SDD-0587 · La migración 0513 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0513_crm_entrada_leads.test.sql` aplica la 0503,
 * 0504, 0505, 0506 y 0513 REALES y llama las RPC como service_role, igual que el
 * webhook y /registro. PGlite lo corre con los `.sql` inlineados: lo que se prueba
 * es el texto que el runbook aplicará.
 *
 * CONTROL ROJO: sin 0513 el evento nuevo no entra y el contrato cae en su primera
 * aserción. MUTANTES: cada uno es una 0513 coherente con un defecto y tiene que
 * caer en la aserción que lo nombra. PGlite tiene una sola conexión: la carrera se
 * simula con un trigger (ver el contrato), no prueba bloqueos.
 * PENDIENTE: la 0513 está declarada en migrations-baseline.json hasta que Sam la
 * autorice y se aplique.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0513_crm_entrada_leads.test.sql");
const MIGRACION = "0513_crm_entrada_leads.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const ARCHIVO = read(resolve(ROOT, "supabase/migrations", MIGRACION));
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
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0513"));
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

describe("SDD-0587 · 0513 entrada de leads (PGlite)", () => {
  it("el contrato pasa entero con la 0513", async () => {
    const run = await contract();
    expect(run.error).toBeNull();
    expect(run.green).toMatch(/^TEST 0513 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0513 el evento nuevo no entra y el contrato cae", async () => {
    const run = await contract({ [MIGRACION]: "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/chatwoot_webhook_events_event_check/);
  }, SLOW);

  const MUTANTES: [string, string, string, RegExp][] = [
    // Eventos.
    [
      "sin conversation_updated",
      "'conversation_created', 'conversation_updated'));",
      "'conversation_created'));",
      /chatwoot_webhook_events_event_check/,
    ],
    [
      "check abierto",
      "  check (event in ('message_created', 'conversation_status_changed', 'conversation_created', 'conversation_updated'));",
      "  check (true);",
      /TEST 0513: el registro sigue rechazando un evento desconocido/,
    ],
    // Idempotencia del alta.
    [
      "la entrada sin on conflict",
      "           p_fuente, v_ocurrio\n    on conflict do nothing\n",
      "           p_fuente, v_ocurrio\n",
      /crm_tarjetas_contacto_uq|duplicate key/,
    ],
    [
      "la web sin on conflict",
      "  )\n  on conflict do nothing\n  returning t.id into v_tarjeta;\n  if v_tarjeta is not null then\n    return query select v_tarjeta, 'creada'::text;",
      "  )\n  returning t.id into v_tarjeta;\n  if v_tarjeta is not null then\n    return query select v_tarjeta, 'creada'::text;",
      /crm_tarjetas_client_uq|duplicate key/,
    ],
    [
      "tras el conflicto no se vuelve a buscar",
      "    -- Otra entrega la creó entre la búsqueda y la inserción.\n    v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);\n",
      "",
      /conflicto sin tarjeta/,
    ],
    [
      "no busca por contacto",
      "         or t.chatwoot_contact_id = p_contact_id\n",
      "",
      /conflicto sin tarjeta/,
    ],
    ["no busca por BSUID", "         or t.bsuid = p_bsuid\n", "", /conflicto sin tarjeta/],
    [
      "no encuentra la manual por teléfono",
      "         or (t.phone_last10 = p_phone_last10 and t.client_id is null and t.chatwoot_contact_id is null))",
      "         )",
      /TEST 0513: la tarjeta manual con ese teléfono toma el contacto/,
    ],
    [
      "la manual por teléfono le quita la de un contacto",
      "and t.client_id is null and t.chatwoot_contact_id is null))",
      "and t.client_id is null))",
      /TEST 0513: un contacto nuevo con el mismo teléfono no le quita la tarjeta a otro/,
    ],
    [
      "la ficha no manda en la búsqueda",
      "             when t.client_id = p_client_id then 0\n",
      "",
      /crm_tarjetas_client_uq/,
    ],
    [
      "le copia un contacto que es de otra tarjeta",
      "      chatwoot_contact_id = coalesce(t.chatwoot_contact_id, case when not exists (\n        select 1 from public.crm_tarjetas x\n        where x.tenant_id = p_tenant_id and x.chatwoot_contact_id = p_contact_id and x.id <> v_tarjeta\n      ) then p_contact_id end),",
      "      chatwoot_contact_id = coalesce(t.chatwoot_contact_id, p_contact_id),",
      /crm_tarjetas_contacto_uq/,
    ],
    // Segmento y etapa.
    [
      "todo entra en Nuevo",
      "           case when v_segmento = 'lead_nuevo' then 'nuevo' else 'registrado_recontacto' end,",
      "           'nuevo',",
      /TEST 0513: lead registrado: en «Registrado \/ recontacto»/,
    ],
    [
      "todo entra en recontacto",
      "           case when v_segmento = 'lead_nuevo' then 'nuevo' else 'registrado_recontacto' end,",
      "           'registrado_recontacto',",
      /TEST 0513: lead nuevo: en «Nuevo»/,
    ],
    [
      "copia el nombre con ficha",
      "           case when v_ficha is null then v_nombre end,",
      "           v_nombre,",
      /crm_tarjetas_check|violates check/,
    ],
    [
      "adivina con un teléfono ambiguo",
      "  select case when pg_catalog.count(*) = 1 then (pg_catalog.array_agg(c.id))[1] end",
      "  select (pg_catalog.array_agg(c.id))[1]",
      /TEST 0513: teléfono ambiguo: no adivina/,
    ],
    [
      "cruza con una ficha borrada",
      "    and c.phone_last10 = p_phone_last10\n    and c.deleted_at is null;",
      "    and c.phone_last10 = p_phone_last10;",
      /TEST 0513: una ficha borrada no cruza/,
    ],
    [
      "cruza de tenant",
      "  where c.tenant_id = p_tenant_id\n    and c.phone_last10 = p_phone_last10",
      "  where c.phone_last10 = p_phone_last10",
      /TEST 0513/,
    ],
    // Completar sin pisar.
    [
      "no se liga cuando cruza",
      "  set client_id = v_ficha,\n      nombre_visible = case when v_ficha is null then coalesce(t.nombre_visible, v_nombre) end,\n      phone_last10 = case when v_ficha is null then coalesce(t.phone_last10, v_telefono) end,",
      "  set nombre_visible = coalesce(t.nombre_visible, v_nombre),\n      phone_last10 = coalesce(t.phone_last10, v_telefono),",
      /TEST 0513: cuando el teléfono cruza, se liga/,
    ],
    [
      "el nombre nuevo pisa",
      "coalesce(t.nombre_visible, v_nombre) end",
      "coalesce(v_nombre, t.nombre_visible) end",
      /TEST 0513: un nombre nuevo no pisa/,
    ],
    [
      "una ficha borrada no suelta la tarjeta",
      "  if v_actual is not null and exists (\n    select 1 from public.clients c where c.id = v_actual and c.deleted_at is null\n  ) then",
      "  if v_actual is not null then",
      /TEST 0513: una ficha fusionada no esconde la tarjeta/,
    ],
    [
      "la actividad no sube",
      "      ultima_actividad_at = greatest(t.ultima_actividad_at, v_ocurrio)\n  where t.id = v_tarjeta;",
      "      updated_at = t.updated_at\n  where t.id = v_tarjeta;",
      /TEST 0513: cada mensaje sube la actividad/,
    ],
    [
      "un evento viejo baja la actividad",
      "      ultima_actividad_at = greatest(t.ultima_actividad_at, v_ocurrio)\n  where t.id = v_tarjeta;",
      "      ultima_actividad_at = v_ocurrio\n  where t.id = v_tarjeta;",
      /TEST 0513: un evento viejo no baja la actividad/,
    ],
    // Asesor.
    [
      "el agente manda sobre la ficha",
      "             (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha),\n             v_agente),\n           p_fuente, v_ocurrio",
      "             v_agente,\n             (select public.crm_asesor_activo(p_tenant_id, c.advisor_id) from public.clients c where c.id = v_ficha)),\n           p_fuente, v_ocurrio",
      /TEST 0513: cliente: el asesor de la ficha manda/,
    ],
    [
      "asesor desactivado rompe el alta",
      "  select ut.user_id\n  from public.user_tenants ut\n  where ut.user_id = p_user_id\n    and ut.tenant_id = p_tenant_id\n    and ut.disabled_at is null\n  limit 1;",
      "  select ut.user_id\n  from public.user_tenants ut\n  where ut.user_id = p_user_id\n    and ut.tenant_id = p_tenant_id\n  limit 1;",
      /el asesor no es del tenant/,
    ],
    [
      "el vínculo cruza de tenant",
      "  where l.tenant_id = p_tenant_id\n    and l.chatwoot_user_id = p_chatwoot_user_id;",
      "  where l.chatwoot_user_id = p_chatwoot_user_id;",
      /more than one row|TEST 0513/,
    ],
    [
      "un segundo agente pisa al primero",
      "  where t.id = v_tarjeta\n    and t.asesor_id is null;",
      "  where t.id = v_tarjeta;",
      /TEST 0513: dos veces no hace nada la segunda/,
    ],
    // Quien vuelve.
    [
      "una conversación nueva saca de Perdido",
      "  if p_clave_mensaje is not null\n     and v_etapa = 'perdido'",
      "  if v_etapa = 'perdido'",
      /crm_mover_etapa_auto|TEST 0513: una conversación nueva/,
    ],
    [
      "cualquier etapa vuelve a recontacto",
      "     and v_etapa = 'perdido'\n     and public.crm_segmento_cliente",
      "     and public.crm_segmento_cliente",
      /TEST 0513: escribir no mueve una tarjeta que no estaba perdida/,
    ],
    [
      "el cliente también se mueve",
      "     and public.crm_segmento_cliente(p_tenant_id, v_ficha) <> 'cliente' then",
      "     then",
      /TEST 0513: un cliente que escribe no mueve su etapa de leads/,
    ],
    [
      "al volver se queda el motivo",
      "  update public.crm_tarjetas t set motivo_perdida = null where t.id = p_tarjeta_id;\n",
      "",
      /TEST 0513: al volver se borra el motivo/,
    ],
    [
      "vuelve sin tarea",
      "  select p_tenant_id, p_tarjeta_id, 'Volvió a escribir: recontactar', t.asesor_id, 'automatico', p_clave\n  from public.crm_tarjetas t\n  where t.id = p_tarjeta_id\n",
      "  select p_tenant_id, p_tarjeta_id, 'Volvió a escribir: recontactar', t.asesor_id, 'automatico', p_clave\n  from public.crm_tarjetas t\n  where false\n",
      /TEST 0513: con una tarea para su asesor/,
    ],
    // Alta web.
    [
      "la web copia la etapa por segmento",
      "    p_tenant_id, p_client_id, 'nuevo', v_asesor, 'web_registro',",
      "    p_tenant_id, p_client_id, 'registrado_recontacto', v_asesor, 'web_registro',",
      /TEST 0513: la web crea la tarjeta en «Nuevo»/,
    ],
    [
      "la web sin el origen",
      "    nullif(pg_catalog.btrim(pg_catalog.left(pg_catalog.btrim(coalesce(p_origen, '')), 120)), ''),\n",
      "    null,\n",
      /TEST 0513: guarda el origen y los UTM/,
    ],
    [
      "la web crea otra en vez de existente",
      "  where t.tenant_id = p_tenant_id and t.client_id = p_client_id;\n  if v_tarjeta is not null then\n    return query select v_tarjeta, 'existente'::text;\n    return;\n  end if;\n\n  if public.crm_ficha_por_telefono(p_tenant_id, v_telefono) = p_client_id then",
      "  where false;\n\n  if public.crm_ficha_por_telefono(p_tenant_id, v_telefono) = p_client_id then",
      /crm_tarjetas_client_uq/,
    ],
    [
      "la web no liga",
      "  if public.crm_ficha_por_telefono(p_tenant_id, v_telefono) = p_client_id then",
      "  if false then",
      /TEST 0513: la web liga la tarjeta del lead que ya escribió/,
    ],
    [
      "la web liga con un teléfono ambiguo",
      "  if public.crm_ficha_por_telefono(p_tenant_id, v_telefono) = p_client_id then",
      "  if v_telefono is not null then",
      /TEST 0513: con el teléfono en dos fichas, no adivina/,
    ],
    [
      "ligar deja el nombre",
      "          nombre_visible = null,\n          phone_last10 = null,\n          asesor_id = coalesce(t.asesor_id, v_asesor),",
      "          asesor_id = coalesce(t.asesor_id, v_asesor),",
      /crm_tarjetas_check|violates check/,
    ],
    [
      "el perdido que se registra se queda",
      "      if v_etapa = 'perdido' then\n        perform public.crm_volver_a_recontacto(",
      "      if false then\n        perform public.crm_volver_a_recontacto(",
      /TEST 0513: el perdido que se registra vuelve/,
    ],
    [
      "liga la más nueva",
      "      and t.phone_last10 = v_telefono\n    order by t.created_at, t.id\n",
      "      and t.phone_last10 = v_telefono\n    order by t.created_at desc, t.id\n",
      /TEST 0513: con dos tarjetas de ese teléfono se liga la más vieja/,
    ],
    [
      "alta con ficha borrada",
      "    and c.tenant_id = p_tenant_id\n    and c.deleted_at is null;\n  if not found then",
      "    and c.tenant_id = p_tenant_id;\n  if not found then",
      /TEST 0513: una ficha borrada no crea tarjeta/,
    ],
    [
      "alta con ficha de otro tenant",
      "  where c.id = p_client_id\n    and c.tenant_id = p_tenant_id\n",
      "  where c.id = p_client_id\n",
      /la ficha es de otro tenant|TEST 0513: una ficha de otro tenant/,
    ],
    // Permisos.
    [
      "alta abierta a authenticated",
      "grant execute on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) to service_role;",
      "grant execute on function public.crm_alta_tarjeta_web(uuid, uuid, text, text, text, text, text, text) to service_role, authenticated;",
      /TEST 0513: anon y authenticated no ejecutan public\.crm_alta_tarjeta_web/,
    ],
    [
      "entrada sin revocar",
      "revoke all on function public.crm_entrada_chatwoot(uuid, bigint, text, text, text, text, bigint, text, timestamptz) from public;\n",
      "",
      /TEST 0513: anon y authenticated no ejecutan public\.crm_entrada_chatwoot/,
    ],
  ];

  for (const [nombre, from, to, espera] of MUTANTES) {
    it(`MUTANTE «${nombre}» cae`, async () => {
      const run = await contract({ [MIGRACION]: once(ARCHIVO, from, to) });
      expect(run.green).toBeUndefined();
      expect(run.error).toMatch(espera);
    }, SLOW);
  }

  it("REAPLICAR: el preflight aborta si la entrada ya existe", async () => {
    const run = await contract({ [MIGRACION]: `${ARCHIVO}\n${ARCHIVO}` });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0513: la entrada de leads ya existe/);
  }, SLOW);

  it("PREFLIGHT: sin la 0506 aborta sin crear nada", async () => {
    const run = await contract({ "0506_crm_modelo.sql": "select 1;" });
    expect(run.green).toBeUndefined();
    expect(run.error).toMatch(/0513 requiere la 0503/);
  }, SLOW);

  it("la 0513 queda declarada pendiente hasta que Sam la autorice", () => {
    expect(BASELINE.pendingBelowCutoff["0513_crm_entrada_leads"]).toMatch(/SDD-0587/);
    expect(ARCHIVO).toMatch(/NO APLICADA A PRODUCCIÓN/);
  });
});
