// @vitest-environment node
/**
 * SDD-0676 · La migración 0566 («Vincular a cliente»: unión primero, teléfono después) corrida de verdad
 * sobre PostgreSQL embebido, con el contrato `supabase/tests/0566_…test.sql` y las migraciones reales
 * (0503, 0504, 0505, 0506, 0513, 0554 y la 0566 dos veces) inlineadas.
 *
 * CONTROL ROJO: sin la 0566 el contrato cae en su primera aserción. MUTANTES: cada uno quita una barrera
 * (actor, tenant de la ficha, confirmación para mover, unión antes que teléfono, soltar la tarjeta, permisos)
 * y el contrato tiene que caer en la aserción que la cuida. El mismo contrato corre en Postgres 17 con Docker
 * en «Contratos SQL».
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0566_chatwoot_vincular_canal.test.sql");
const MIGRACION = "0566_chatwoot_vincular_canal.sql";
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const ARCHIVO = read(resolve(ROOT, "supabase/migrations", MIGRACION));
const DESARME = read(resolve(ROOT, "supabase/desarmes/0566_desarme.sql"));
const RELLENO = read(resolve(ROOT, "supabase/cargas/portal-uniones-0566/uniones-portal.sql"));
const CONTEO = read(resolve(ROOT, "supabase/cargas/portal-uniones-0566/conteo.sql"));
const SLOW = 180_000;

/** psql → SQL plano: quita \set e inlinea \ir. `replace` sustituye un archivo por el final de su ruta. */
function inline(replace: Record<string, string> = {}): string {
  const out: string[] = [];
  const source = (path: string) => {
    const key = Object.keys(replace).find((name) => path.replace(/\\/g, "/").endsWith(name));
    return key !== undefined ? replace[key] : read(path);
  };
  function run(path: string) {
    for (const line of source(path).split("\n")) {
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
  run(CONTRACT);
  return out.join("\n");
}

async function correr(sql: string): Promise<{ error: string | null; verde: string | undefined }> {
  const db = await pgliteLimpio();
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const verde = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0566 GREEN"));
    return { error: null, verde };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), verde: undefined };
  } finally {
    await db.close();
  }
}

/** Un único cambio sobre la migración; falla si lo que se cambia no aparece exactamente una vez. */
function mutar(buscar: string, poner: string): string {
  const partes = ARCHIVO.split(buscar);
  if (partes.length !== 2) throw new Error(`el mutante esperaba una sola aparición y hay ${partes.length - 1}: ${buscar.slice(0, 60)}`);
  return partes.join(poner);
}

describe("0566 · vincular un contacto de Chatwoot a un cliente (PGlite)", () => {
  it("el contrato completo pasa con la migración real aplicada dos veces", async () => {
    const r = await correr(inline());
    expect(r.error).toBeNull();
    expect(r.verde).toMatch(/^TEST 0566 GREEN: \d+ aserciones$/);
  }, SLOW);

  it("CONTROL ROJO: sin la 0566 el contrato cae en su primera aserción", async () => {
    const r = await correr(inline({ [MIGRACION]: "" }));
    expect(r.error).toContain("TEST 0566: 1a");
  }, SLOW);

  const mutantes: Array<[string, () => string, string]> = [
    [
      "vincular no comprueba al actor",
      () =>
        mutar(
          "  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then\n    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';\n  end if;\n  if p_contact_id is null or p_contact_id <= 0 then\n    raise exception 'chatwoot_vincular_contacto: contacto inválido'",
          "  if p_contact_id is null or p_contact_id <= 0 then\n    raise exception 'chatwoot_vincular_contacto: contacto inválido'",
        ),
      "TEST 0566: 2a",
    ],
    [
      "vincular acepta una ficha de otro tenant",
      () =>
        mutar(
          "    where c.id = p_client_id and c.tenant_id = p_tenant_id and c.deleted_at is null\n  ) then\n    raise exception 'chatwoot_vincular_contacto: ficha inexistente'",
          "    where c.id = p_client_id and c.deleted_at is null\n  ) then\n    raise exception 'chatwoot_vincular_contacto: ficha inexistente'",
        ),
      "TEST 0566: 2d",
    ],
    [
      "vincular acepta una ficha borrada",
      () =>
        mutar(
          "    where c.id = p_client_id and c.tenant_id = p_tenant_id and c.deleted_at is null\n  ) then\n    raise exception 'chatwoot_vincular_contacto: ficha inexistente'",
          "    where c.id = p_client_id and c.tenant_id = p_tenant_id\n  ) then\n    raise exception 'chatwoot_vincular_contacto: ficha inexistente'",
        ),
      "TEST 0566: 2e",
    ],
    [
      "un chat unido a otra ficha se mueve sin confirmación",
      () => mutar("    if not coalesce(p_mover, false) then", "    if false then"),
      "TEST 0566: 5a",
    ],
    [
      "vincular no guarda el canal",
      () => mutar("  values (p_tenant_id, p_client_id, p_contact_id, 'manual', p_actor_user_id, p_canal);", "  values (p_tenant_id, p_client_id, p_contact_id, 'manual', p_actor_user_id, null);"),
      "TEST 0566: 3d",
    ],
    [
      "vincular no absorbe la tarjeta del lead",
      () =>
        mutar(
          "  v_tarjeta := public.crm_absorber_tarjeta_de_contacto(p_tenant_id, p_client_id, p_contact_id);\n\n  perform public.append_audit_event(",
          "  v_tarjeta := null;\n\n  perform public.append_audit_event(",
        ),
      "TEST 0566: 3c",
    ],
    [
      "absorber borra el nombre del lead (deshacer no lo devolvería)",
      () => mutar("      absorbida_at = pg_catalog.now(),\n      phone_last10 = null", "      absorbida_at = pg_catalog.now(),\n      nombre_visible = null,\n      phone_last10 = null"),
      "TEST 0566: 3g",
    ],
    [
      "el evento no mira la unión del contacto",
      () => mutar("    v_cliente := public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id);\n    if v_cliente is not null then", "    v_cliente := null;\n    if v_cliente is not null then"),
      "TEST 0566: 4e",
    ],
    [
      "un evento sin ficha le quita el cliente a la conversación",
      () =>
        mutar(
          "    client_id         = coalesce(\n                          excluded.client_id,\n                          (select c.id from public.clients c\n                           where c.id = cc.client_id and c.tenant_id = cc.tenant_id and c.deleted_at is null)),",
          "    client_id         = excluded.client_id,",
        ),
      "TEST 0566: 4h",
    ],
    [
      "un evento con contacto, sin unión ni teléfono, le quita el cliente (el fallo que rompía el portal)",
      () =>
        mutar(
          "    client_id         = coalesce(\n                          excluded.client_id,\n                          (select c.id from public.clients c\n                           where c.id = cc.client_id and c.tenant_id = cc.tenant_id and c.deleted_at is null)),",
          "    client_id         = case when v_telefono or v_contacto then excluded.client_id else cc.client_id end,",
        ),
      "TEST 0566: 4i",
    ],
    [
      "un cliente que solo se conservó se informa como si hubiera cruzado por teléfono (el webhook lo uniría)",
      () => mutar("    v_origen := 'conservado';", "    v_origen := 'telefono';"),
      "TEST 0566: 4q",
    ],
    [
      "una unión se informa como cruce por teléfono",
      () => mutar("      v_origen := 'union';", "      v_origen := 'telefono';"),
      "TEST 0566: 4o",
    ],
    [
      "el evento conserva una ficha borrada",
      () =>
        mutar(
          "                           where c.id = cc.client_id and c.tenant_id = cc.tenant_id and c.deleted_at is null)),",
          "                           where c.id = cc.client_id and c.tenant_id = cc.tenant_id)),",
        ),
      "TEST 0566: 8h",
    ],
    [
      "el evento no guarda de qué contacto es la conversación",
      () => mutar("    case when v_contacto then p_contact_id end\n  )", "    null\n  )"),
      "TEST 0566: 4n",
    ],
    [
      "mover no lleva las conversaciones del contacto a la ficha nueva",
      () => mutar("    and cc.client_id is distinct from p_client_id;\n", "    and false;\n"),
      "TEST 0566: 5g",
    ],
    [
      "quitar la unión no deja sin ficha las conversaciones del contacto",
      () => mutar("    and cc.client_id = p_client_id;\n  get diagnostics v_convs = row_count;", "    and false;\n  get diagnostics v_convs = row_count;"),
      "TEST 0566: 6f",
    ],
    [
      "borrar la ficha no deja sin ficha sus conversaciones",
      () => mutar("    where cc.tenant_id = new.tenant_id and cc.client_id = new.id;", "    where cc.tenant_id = new.tenant_id and cc.client_id = new.id and false;"),
      "TEST 0566: 8e",
    ],
    [
      "el chat del portal no deja su unión en el registro único",
      () =>
        mutar(
          "  values (p_tenant_id, v_client, p_contacto_id, 'portal', null, 'portal')\n  on conflict (chatwoot_contact_id) do nothing;",
          "  select p_tenant_id, v_client, p_contacto_id, 'portal', null, 'portal' where false\n  on conflict (chatwoot_contact_id) do nothing;",
        ),
      "TEST 0566: 11a",
    ],
    [
      "la unión del portal se deja quitar a mano",
      () => mutar("      and l.origen = 'portal'\n  ) then", "      and false\n  ) then"),
      "TEST 0566: 11f",
    ],
    [
      "la unión del portal se deja mover a otra ficha",
      () => mutar("    if v_origen = 'portal' then", "    if false then"),
      "TEST 0566: 11g",
    ],
    [
      "la ficha de un contacto cruza de tenant",
      () =>
        mutar(
          "  where l.tenant_id = p_tenant_id\n    and l.chatwoot_contact_id = p_contact_id\n    and c.tenant_id = p_tenant_id\n    and c.deleted_at is null;",
          "  where l.chatwoot_contact_id = p_contact_id\n    and c.deleted_at is null;",
        ),
      "TEST 0566: 4l",
    ],
    [
      "quitar la unión no suelta la tarjeta del lead",
      () =>
        mutar(
          "  v_tarjeta := public.crm_soltar_tarjeta_de_contacto(p_tenant_id, p_contact_id);\n\n  -- Quitar la unión es la decisión",
          "  v_tarjeta := null;\n\n  -- Quitar la unión es la decisión",
        ),
      "TEST 0566: 6b",
    ],
    [
      "borrar la ficha no suelta la tarjeta del lead",
      () => mutar("          and t.chatwoot_contact_id = any (v_contactos)\n", "          and false\n"),
      "TEST 0566: 8b",
    ],
    [
      "la auditoría del borrado de ficha no nombra las tarjetas soltadas",
      () => mutar("          'tarjetas_soltadas', coalesce(pg_catalog.to_jsonb(v_tarjetas), '[]'::jsonb),\n", "          'tarjetas_soltadas', '[]'::jsonb,\n"),
      "TEST 0566: 8d",
    ],
    [
      "la absorción de una unión que ya existía no se audita",
      () => mutar("    if v_tarjeta is not null then\n      -- La unión ya existía", "    if false then\n      -- La unión ya existía"),
      "TEST 0566: 10b",
    ],
    [
      "vincular abierta a las sesiones (llamada directa por la API)",
      () =>
        mutar(
          "grant execute on function public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean) to service_role;",
          "grant execute on function public.chatwoot_vincular_contacto(uuid, uuid, uuid, bigint, text, text, boolean) to service_role, authenticated;",
        ),
      "0566: una función quedó abierta a una sesión",
    ],
  ];

  for (const [nombre, migracion, esperado] of mutantes) {
    it(`MUTANTE: ${nombre} → el contrato cae`, async () => {
      const r = await correr(inline({ [MIGRACION]: migracion() }));
      expect(r.error).not.toBeNull();
      expect(r.error).toContain(esperado);
    }, SLOW);
  }

  it("MUTANTE: la entrada ni mira la unión ni sigue a la tarjeta que absorbió → cae en 4a", async () => {
    // Las dos barreras se cubren entre sí: quitando una sola, la otra sostiene el caso.
    const sinUnion = mutar(
      "  v_ficha := coalesce(\n    public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id),\n    public.crm_ficha_por_telefono(p_tenant_id, v_telefono));\n  v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);\n\n  if v_tarjeta is null then",
      "  v_ficha := public.crm_ficha_por_telefono(p_tenant_id, v_telefono);\n  v_tarjeta := public.crm_buscar_tarjeta(p_tenant_id, v_ficha, p_contact_id, p_bsuid, v_telefono);\n\n  if v_tarjeta is null then",
    );
    const puntero =
      "  -- SDD-0676: una tarjeta absorbida no se toca; la actividad va a la del cliente.\n  select coalesce(t.absorbida_en, t.id) into v_tarjeta\n  from public.crm_tarjetas t\n  where t.id = v_tarjeta;\n";
    if (sinUnion.split(puntero).length !== 2) throw new Error("el mutante no encontró el puntero de la tarjeta absorbida");
    const r = await correr(inline({ [MIGRACION]: sinUnion.replace(puntero, "") }));
    expect(r.error).toContain("TEST 0566: 4a");
  }, SLOW);

  it("desarme: vuelven las funciones de antes, se van las columnas y las tarjetas absorbidas quedan sueltas; repetirlo no falla", async () => {
    const contrato = inline();
    // El contrato termina en rollback: se corta antes y se sigue en la misma transacción.
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("select 'TEST 0566 GREEN"));
    const sql = [
      sinCierre,
      // Una tarjeta absorbida al momento del desarme (el contrato dejó la del contacto 700).
      `do $c$ begin
        if not exists (select 1 from public.crm_tarjetas where chatwoot_contact_id = 700 and absorbida_en is not null) then
          raise exception 'DESARME: la fixture no dejó una tarjeta absorbida';
        end if;
      end $c$;`,
      // Una unión del portal viva al momento del desarme: es la única que el desarme borra.
      `insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
       values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 630, 'portal', null, 'portal');`,
      "create temporary table antes_del_desarme as select count(*) as uniones from public.chatwoot_contact_links where origen <> 'portal';",
      // Hay uniones con canal: el desarme solo corre si se acepta perderlo (ver la prueba de abajo).
      "set local dtd.desarme_0566_perder_canal = 'si';",
      DESARME,
      DESARME,
      `do $c$
      declare r record;
      begin
        if (select count(*) from public.chatwoot_contact_links) <> (select uniones from antes_del_desarme) then
          raise exception 'DESARME: tocó las uniones que no son del portal';
        end if;
        if exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 630) then
          raise exception 'DESARME: quedó una unión del portal';
        end if;
        -- El origen vuelve a sus tres valores: «portal» ya no cabe.
        begin
          insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
          values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 631, 'portal', null);
          raise exception 'DESARME: el origen «portal» sigue permitido';
        exception when check_violation then
          null;
        end;
        if coalesce(obj_description('public.chatwoot_portal_vincular(uuid,uuid,bigint,text,bigint,bigint)'::regprocedure, 'pg_proc'), '') not like 'SDD-0586 E10-D35:%'
           or pg_catalog.pg_get_functiondef('public.chatwoot_portal_vincular(uuid,uuid,bigint,text,bigint,bigint)'::regprocedure) like '%chatwoot_contact_links%' then
          raise exception 'DESARME: chatwoot_portal_vincular no volvió a la de la 0519';
        end if;
        if not exists (select 1 from public.crm_tarjetas where chatwoot_contact_id = 700) then
          raise exception 'DESARME: perdió la tarjeta del lead';
        end if;
        -- Los comentarios vuelven a ser los de antes (0554, 0513 y 0504), sin rastro de esta SDD.
        if exists (
          select 1 from (values
            ('public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'SDD-0650 F2 (D4)%'),
            ('public.crm_entrada_chatwoot(uuid,bigint,text,text,text,text,bigint,text,timestamptz)', 'SDD-0587 (6.4, §5.1, §5.2)%'),
            ('public.crm_asesor_desde_chatwoot(uuid,bigint,text,text,bigint)', 'SDD-0587 (6.4, §5.4)%'),
            ('public.chatwoot_registrar_evento(uuid,text,text,bigint,bigint,text,integer,bigint,text,timestamptz,double precision,bigint,boolean)', 'SDD-0585 E2-D18%')
          ) as f(firma, empieza)
          where coalesce(obj_description(f.firma::regprocedure, 'pg_proc'), '') not like f.empieza
             or obj_description(f.firma::regprocedure, 'pg_proc') like '%0676%'
        ) then
          raise exception 'DESARME: un comentario no volvió al de antes';
        end if;
        -- El evento vuelve a cruzar solo por teléfono, con los 13 parámetros de la 0504.
        select * into r from public.chatwoot_registrar_evento(
          '10000000-0000-0000-0000-000000000001', 'message_created:9000', 'message_created',
          90, 3, 'open', 0, null, '4125550202', null, 100, null, false);
        if r.client_id is distinct from '30000000-0000-0000-0000-000000000002'::uuid then
          raise exception 'DESARME: el evento no cruza por teléfono';
        end if;
        -- La entrada vuelve a la regla de la 0513: el contacto 700 cae en SU tarjeta de lead.
        select * into r from public.crm_entrada_chatwoot(
          '10000000-0000-0000-0000-000000000001', 700, null, null, 'Lead Messenger', 'messenger', null, 'message_created:9001', now());
        if r.tarjeta_id is distinct from (select id from public.crm_tarjetas where chatwoot_contact_id = 700) then
          raise exception 'DESARME: la entrada no volvió a la tarjeta del lead';
        end if;
      end $c$;`,
      "rollback;",
    ].join("\n");
    const r = await correr(sql);
    expect(r.error).toBeNull();
  }, SLOW);

  it("relleno de uniones del portal: crea las que faltan, respeta las demás, es idempotente y aborta si el número no cuadra", async () => {
    const contrato = inline();
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("select 'TEST 0566 GREEN"));
    const T1 = "10000000-0000-0000-0000-000000000001";
    const K01 = "30000000-0000-0000-0000-000000000001";
    const K02 = "30000000-0000-0000-0000-000000000002";
    const K06 = "30000000-0000-0000-0000-000000000006"; // borrada en la fixture
    const HILO = "50000000-0000-0000-0000-000000000009";
    const preparar = [
      // Tres contactos del portal de ANTES de la 0566: el de K02 (falta su unión), el de K01
      // (alguien lo unió a mano a K02) y el de una ficha borrada.
      `insert into public.chatwoot_portal_contactos (tenant_id, client_id, chatwoot_contact_id, chatwoot_source_id) values
         ('${T1}', '${K02}', 640, 'src-640'), ('${T1}', '${K01}', 641, 'src-641'), ('${T1}', '${K06}', 642, 'src-642');`,
      `insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
         values ('${T1}', '${K02}', 641, 'webhook', null);`,
      // Una conversación del portal de K02, como la dejó la 0519: con cliente y sin contacto anotado.
      `insert into public.conversations (id, tenant_id, client_id, channel) values ('${HILO}', '${T1}', '${K02}', 'portal');`,
      `insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id) values ('${HILO}', '${T1}', 97);`,
      `insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id) values ('${T1}', 97, 4, 'open', '${K02}');`,
      RELLENO,
    ];
    const comprobar = `do $c$
      declare n bigint;
      begin
        if not exists (select 1 from public.chatwoot_contact_links
                       where chatwoot_contact_id = 640 and client_id = '${K02}' and origen = 'portal' and canal_chat = 'portal') then
          raise exception 'RELLENO: no creó la unión que faltaba';
        end if;
        if (select client_id from public.chatwoot_contact_links where chatwoot_contact_id = 641) <> '${K02}'
           or (select origen from public.chatwoot_contact_links where chatwoot_contact_id = 641) <> 'webhook' then
          raise exception 'RELLENO: tocó una unión que ya existía';
        end if;
        if exists (select 1 from public.chatwoot_contact_links where chatwoot_contact_id = 642) then
          raise exception 'RELLENO: unió el contacto de una ficha borrada';
        end if;
        if (select chat_contact_id from public.chatwoot_conversations where tenant_id = '${T1}' and conversation_id = 97) is distinct from 640
           or (select client_id from public.chatwoot_conversations where tenant_id = '${T1}' and conversation_id = 97) <> '${K02}' then
          raise exception 'RELLENO: no anotó el contacto en la conversación del portal, o le cambió el cliente';
        end if;
        select count(*) into n from public.entity_audit_log a
        where a.tenant_id = '${T1}' and a.event_type = 'chatwoot_contact_linked' and a.actor_type = 'system'
          and (a.after_data ->> 'chatwoot_contact_id')::bigint = 640 and a.payload ->> 'relleno' = '0566';
        if n <> 1 then
          raise exception 'RELLENO: la unión creada debe quedar auditada una sola vez (hay %)', n;
        end if;
      end $c$;`;
    const conteo = (dato: string, esperado: number) => `do $c$ begin
        if (select cuantos from pg_temp.contar_uniones_portal('${T1}') where dato like '${dato}%') <> ${esperado} then
          raise exception 'RELLENO: el conteo «${dato}» no dio ${esperado}';
        end if;
      end $c$;`;

    // Camino feliz: el conteo dice 1, el relleno crea 1 y la segunda corrida (0 esperadas) no hace nada.
    const feliz = await correr(
      [
        sinCierre,
        ...preparar,
        // 640, 641, 642 y el 620 que dejó el bloque 11 del contrato (su ficha se borró).
        conteo("1.", 4),
        conteo("3.", 1),
        conteo("4.", 2),
        conteo("5.", 1),
        conteo("6.", 1),
        `select * from pg_temp.rellenar_uniones_portal('${T1}', 1);`,
        comprobar,
        conteo("5.", 0),
        conteo("6.", 0),
        `select * from pg_temp.rellenar_uniones_portal('${T1}', 0);`,
        comprobar,
        "rollback;",
      ].join("\n"),
    );
    expect(feliz.error).toBeNull();

    // Si el número esperado no es el que sale, aborta y lo dice.
    const descuadre = await correr([sinCierre, ...preparar, `select * from pg_temp.rellenar_uniones_portal('${T1}', 5);`, "rollback;"].join("\n"));
    expect(descuadre.error).toContain("relleno 0566: se esperaban 5 uniones y salieron 1");
  }, SLOW);

  it("conteo.sql: solo lectura, sin funciones ni datos personales, y da lo mismo que la función del relleno", async () => {
    // Forma: una transacción de solo lectura que termina en rollback, sin crear nada ni escribir.
    expect(CONTEO).toContain("begin read only;");
    expect(CONTEO.trimEnd().endsWith("rollback;")).toBe(true);
    const sentencias = CONTEO.split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join("\n");
    expect(sentencias).not.toMatch(/\b(create|insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
    // Ninguna columna de datos personales en lo que se lee.
    expect(sentencias).not.toMatch(/\b(name|phone|email|nombre|telefono|texto|body)\b/i);

    const contrato = inline();
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("select 'TEST 0566 GREEN"));
    const T1 = "10000000-0000-0000-0000-000000000001";
    const K01 = "30000000-0000-0000-0000-000000000001";
    const K02 = "30000000-0000-0000-0000-000000000002";
    const K03 = "30000000-0000-0000-0000-000000000003";
    const K06 = "30000000-0000-0000-0000-000000000006"; // borrada en la fixture
    const HILO = "50000000-0000-0000-0000-000000000009";
    const preparar = [
      // Contactos del portal de ANTES de la 0566: el de K02 (falta su unión), el de K01 (alguien
      // lo unió a mano a K02: es de OTRA ficha) y el de una ficha borrada.
      `insert into public.chatwoot_portal_contactos (tenant_id, client_id, chatwoot_contact_id, chatwoot_source_id) values
         ('${T1}', '${K02}', 640, 'src-640'), ('${T1}', '${K01}', 641, 'src-641'), ('${T1}', '${K06}', 642, 'src-642');`,
      `insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
         values ('${T1}', '${K02}', 641, 'webhook', null);`,
      // Una ficha del portal todavía sin contacto de Chatwoot (dato 8) y una unión de origen portal ya hecha (dato 7).
      `insert into public.chatwoot_portal_contactos (tenant_id, client_id) values ('${T1}', '${K03}');`,
      `insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
         values ('${T1}', '${K01}', 650, 'portal', null, 'portal');`,
      // Una conversación del portal de K02 sin contacto anotado (dato 6).
      `insert into public.conversations (id, tenant_id, client_id, channel) values ('${HILO}', '${T1}', '${K02}', 'portal');`,
      `insert into public.chatwoot_portal_hilos (conversation_id, tenant_id, chatwoot_conversation_id) values ('${HILO}', '${T1}', 97);`,
      `insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id) values ('${T1}', 97, 4, 'open', '${K02}');`,
      RELLENO,
    ];
    // La consulta tal cual, sin su transacción propia (el ensayo ya corre dentro de una) y con el tenant puesto.
    const cuerpo = CONTEO.slice(CONTEO.indexOf("begin read only;") + "begin read only;".length, CONTEO.lastIndexOf("rollback;"))
      .split(":'tenant'")
      .join(`'${T1}'`)
      .trim()
      .replace(/;$/, "");
    const comparar = `create temporary table conteo_sql as ${cuerpo};
      do $c$
      declare r record;
      begin
        if (select count(*) from conteo_sql) <> 8 then
          raise exception 'CONTEO: debe devolver 8 filas';
        end if;
        -- Los datos 1 a 6 son los mismos que da la función del relleno.
        if exists (
          (select dato, cuantos from conteo_sql where left(dato, 1) in ('1','2','3','4','5','6')
           except select dato, cuantos from pg_temp.contar_uniones_portal('${T1}'))
          union all
          (select dato, cuantos from pg_temp.contar_uniones_portal('${T1}')
           except select dato, cuantos from conteo_sql where left(dato, 1) in ('1','2','3','4','5','6'))
        ) then
          raise exception 'CONTEO: conteo.sql y la función del relleno no dan lo mismo';
        end if;
        -- Valores de la fixture: cuatro contactos del portal con contacto de Chatwoot (los tres de arriba y el
        -- 620 que dejó el bloque 11 del contrato, de una ficha ya borrada), ninguno unido a su ficha, uno
        -- unido a OTRA, dos de ficha borrada y uno por crear.
        for r in select dato, cuantos from conteo_sql loop
          if left(r.dato, 1) = '1' and r.cuantos <> 4 then raise exception 'CONTEO 1: %', r.cuantos; end if;
          if left(r.dato, 1) = '2' and r.cuantos <> 0 then raise exception 'CONTEO 2: %', r.cuantos; end if;
          if left(r.dato, 1) = '3' and r.cuantos <> 1 then raise exception 'CONTEO 3: %', r.cuantos; end if;
          if left(r.dato, 1) = '4' and r.cuantos <> 2 then raise exception 'CONTEO 4: %', r.cuantos; end if;
          if left(r.dato, 1) = '5' and r.cuantos <> 1 then raise exception 'CONTEO 5: %', r.cuantos; end if;
          if left(r.dato, 1) = '6' and r.cuantos <> 1 then raise exception 'CONTEO 6: %', r.cuantos; end if;
          if left(r.dato, 1) = '7' and r.cuantos <> 1 then raise exception 'CONTEO 7: %', r.cuantos; end if;
          if left(r.dato, 1) = '8' and r.cuantos <> 1 then raise exception 'CONTEO 8: %', r.cuantos; end if;
        end loop;
      end $c$;`;
    const r = await correr([sinCierre, ...preparar, comparar, "rollback;"].join("\n"));
    expect(r.error).toBeNull();
  }, SLOW);

  it("desarme: con uniones que guardan canal se niega, salvo que se acepte perderlo", async () => {
    const contrato = inline();
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("select 'TEST 0566 GREEN"));
    const r = await correr([sinCierre, DESARME, "rollback;"].join("\n"));
    expect(r.error).toContain("desarme 0566: hay");
    expect(r.error).toContain("dtd.desarme_0566_perder_canal");

    // Las uniones del portal no cuentan en esa guarda: con una más, el número que da es el mismo.
    const conPortal = await correr(
      [
        sinCierre,
        `insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
         values ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 632, 'portal', null, 'portal');`,
        DESARME,
        "rollback;",
      ].join("\n"),
    );
    expect(conPortal.error).toBe(r.error);
  }, SLOW);
});
