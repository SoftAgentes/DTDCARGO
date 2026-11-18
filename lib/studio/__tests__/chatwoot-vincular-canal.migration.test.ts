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
      () => mutar("    v_cliente := public.chatwoot_ficha_de_contacto(p_tenant_id, p_contact_id);\n  end if;", "    v_cliente := null;\n  end if;"),
      "TEST 0566: 4e",
    ],
    [
      "el evento conserva el cruce viejo de un contacto sin unión",
      () =>
        mutar(
          "    client_id         = case when v_telefono or v_contacto then excluded.client_id else cc.client_id end,",
          "    client_id         = case when v_telefono then excluded.client_id else cc.client_id end,",
        ),
      "TEST 0566: 4i",
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
          "  v_tarjeta := public.crm_soltar_tarjeta_de_contacto(p_tenant_id, p_contact_id);\n\n  perform public.append_audit_event(",
          "  v_tarjeta := null;\n\n  perform public.append_audit_event(",
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
      () => mutar("          'tarjetas_soltadas', coalesce(pg_catalog.to_jsonb(v_tarjetas), '[]'::jsonb)),", "          'tarjetas_soltadas', '[]'::jsonb),"),
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
      "create temporary table antes_del_desarme as select count(*) as uniones from public.chatwoot_contact_links;",
      // Hay uniones con canal: el desarme solo corre si se acepta perderlo (ver la prueba de abajo).
      "set local dtd.desarme_0566_perder_canal = 'si';",
      DESARME,
      DESARME,
      `do $c$
      declare r record;
      begin
        if (select count(*) from public.chatwoot_contact_links) <> (select uniones from antes_del_desarme) then
          raise exception 'DESARME: tocó las uniones';
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

  it("desarme: con uniones que guardan canal se niega, salvo que se acepte perderlo", async () => {
    const contrato = inline();
    const sinCierre = contrato.slice(0, contrato.lastIndexOf("select 'TEST 0566 GREEN"));
    const r = await correr([sinCierre, DESARME, "rollback;"].join("
"));
    expect(r.error).toContain("desarme 0566: hay");
    expect(r.error).toContain("dtd.desarme_0566_perder_canal");
  }, SLOW);
});
