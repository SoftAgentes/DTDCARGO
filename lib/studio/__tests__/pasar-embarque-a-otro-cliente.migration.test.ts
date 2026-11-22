// @vitest-environment node
/**
 * SDD-0645 · La migración 0551 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0551_pasar_embarque_a_otro_cliente.test.sql`
 * corre en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite
 * corre ese MISMO contrato con los `.sql` reales de las migraciones inlineados:
 * lo que se prueba es el texto que el runbook aplicará, no un doble.
 *
 * CONTROL ROJO: sin 0551, operaciones no puede pasar el embarque.
 *
 * MUTANTES: cada uno cambia la 0551 y tiene que morir con la aserción que lo
 * caza; si muriera por otra, la prueba falla. PGlite tiene una sola conexión:
 * los FOR UPDATE no se prueban acá (ver la spec, §7).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0551_pasar_embarque_a_otro_cliente.test.sql");
const M0551 = "0551_pasar_embarque_a_otro_cliente.sql";
const FILE_0551 = readFileSync(resolve(ROOT, "supabase/migrations", M0551), "utf8");
const SLOW = 300_000;
const ASERCIONES = 82;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/** psql → SQL plano: \set, \if :{?v} / :v, \else, \endif e \ir. */
function inline(file: string, vars: Record<string, string>, replace: Record<string, string> = {}): string {
  const state = { ...vars };
  const out: string[] = [];
  const read = (path: string) => {
    const key = Object.keys(replace).find((name) => path.endsWith(name));
    return key ? replace[key] : readFileSync(path, "utf8");
  };
  function run(path: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of read(path).split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        if (active()) out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const text = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
          if (!TRUE.test(text) && !FALSE.test(text)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(text);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack[stack.length - 1];
        frame.active = !frame.taken;
      } else if (command === "endif") {
        stack.pop();
      } else if (!active()) {
        continue;
      } else if (command === "set") {
        const [name, value] = rest.trim().split(/\s+/);
        if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        run(resolve(dirname(path), rest.trim()));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar en " + path);
  }
  run(file);
  return out.join("\n");
}

async function contract(options: { applyFix?: boolean; migration?: string } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) },
    options.migration ? { [M0551]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0551 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0551 con un cambio que tiene que aparecer exactamente `veces` veces. */
function mutant(from: string, to: string, veces = 1): string {
  expect(FILE_0551.split(from), `apariciones de: ${from.slice(0, 90)}`).toHaveLength(veces + 1);
  return FILE_0551.split(from).join(to);
}

describe("0551 · pasar embarque a otro cliente (contrato en PGlite)", () => {
  it("verde: el contrato pasa entero con la 0551 real", async () => {
    const { error, green } = await contract();
    expect(error).toBeNull();
    expect(green).toBe(`TEST 0551 GREEN: ${ASERCIONES} aserciones`);
  }, SLOW);

  it("rojo: sin la 0551, operaciones no puede pasar el embarque", async () => {
    const { error } = await contract({ applyFix: false });
    expect(error).toContain("TEST 0551: operaciones no pudo ver la vista previa del cambio");
  }, SLOW);

  const MUTANTES: [nombre: string, from: string, to: string, muere: string, veces?: number][] = [
    ["warehouse también puede",
      "ut.role in ('admin', 'operations', 'commercial')", "ut.role in ('admin', 'operations', 'commercial', 'warehouse')",
      "warehouse-A pudo pasar el embarque"],
    ["sin commercial (D2 de Sam)",
      "ut.role in ('admin', 'operations', 'commercial')", "ut.role in ('admin', 'operations')",
      "comercial no pudo ver la vista previa"],
    ["el embarque se busca sin el tenant de la sesión (H-6)",
      "where s.id = p_shipment_id and s.tenant_id = v_tenant", "where s.id = p_shipment_id",
      // Las dos lecturas del embarque: la de la vista previa y la FOR UPDATE.
      "un admin de otro tenant pasó un embarque ajeno a su cliente", 2],
    ["sin el aviso de tarifa congelada (H-1)",
      "if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;", "",
      "la vista previa no avisó la tarifa congelada del cliente anterior"],
    ["la tarifa ya sustituida también avisa",
      "\n     and rs.superseded_at is null and rs.client_id <> v_client.id;", "\n     and rs.client_id <> v_client.id;",
      "la vista previa no avisó la tarifa congelada del cliente anterior"],
    ["el evento no guarda el aviso",
      "      'moved', v_moved,\n      'warnings', v_warnings),", "      'moved', v_moved),",
      "el evento no guardó el aviso de tarifa congelada"],
    ["sin el bloqueo de factura emitida",
      "pg_catalog.count(*) filter (where inv.status <> 'borrador'),",
      "pg_catalog.count(*) filter (where false),",
      "S-INV no quedó bloqueado sólo por factura_emitida"],
    ["sin el bloqueo de borrador de varios embarques",
      "pg_catalog.count(*) filter (where inv.status = 'borrador' and inv.otros)",
      "pg_catalog.count(*) filter (where false)",
      "S-MIX no quedó bloqueado sólo por factura_varios_embarques"],
    ["sin el bloqueo de reclamo",
      "if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('reclamo', v_n); end if;", "",
      "S-CLM no quedó bloqueado sólo por reclamo"],
    ["sin el bloqueo de prealerta",
      "if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('prealerta', v_n); end if;", "",
      "S-PRE no quedó bloqueado sólo por prealerta"],
    ["la prealerta cancelada también bloquea",
      "\n     and p.status <> 'cancelada';", ";",
      "S-PRE-CAN quedó bloqueado por algo anulado o cancelado"],
    ["sin el bloqueo de orden de despacho",
      "if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('orden_despacho', v_n); end if;", "",
      "S-OD no quedó bloqueado sólo por orden_despacho"],
    ["la anulada también cuenta",
      "and i.status <> 'anulada'", "and true",
      "operaciones no pudo ver la vista previa del cambio"],
    ["el borrador conserva el titular del viejo",
      "client_rif = null, client_doc_kind = null, client_fiscal_address = null, bill_to_kind = null",
      "client_rif = i.client_rif",
      "los borradores no se movieron o conservan el titular fiscal del viejo"],
    ["la recepción sigue huérfana",
      "client_name = v_client.name, is_orphan = false", "client_name = v_client.name",
      "las recepciones vivas no se movieron o siguen huérfanas"],
    ["mueve también los avisos enviados",
      "   where n.shipment_id = v_ship.id and n.status = 'scheduled';\n\n  perform public.append_audit_event",
      "   where n.shipment_id = v_ship.id;\n\n  perform public.append_audit_event",
      "los avisos no quedaron bien"],
    ["no mueve la consolidación",
      "update public.consolidation_items ci\n     set client_markbox = v_new, client_name = v_client.name\n   where ci.tenant_id",
      "update public.consolidation_items ci\n     set client_markbox = ci.client_markbox\n   where ci.tenant_id",
      "la consolidación no se movió"],
    ["no mueve los documentos del Portal",
      "update public.shipment_documents d\n     set client_markbox = v_new", "update public.shipment_documents d\n     set client_markbox = d.client_markbox",
      "el documento del Portal no se movió"],
    ["la vista previa escribe",
      "if v_blockers <> '{}'::jsonb or v_dry then", "if v_blockers <> '{}'::jsonb then",
      // Sale como cambio real: muere en la primera aserción, antes de medir la huella.
      "operaciones no pudo ver la vista previa del cambio"],
    ["el motivo no se valida",
      "if not v_dry and (v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000) then",
      "if false then",
      // Un motivo de 3 lo frena además el escritor de auditoría (0267); el vacío, no.
      "aceptó un motivo vacío"],
    ["acepta el mismo cliente",
      "if v_old is not distinct from v_new then", "if false then",
      "aceptó pasarlo al mismo cliente"],
    ["acepta una ficha fusionada",
      "if v_client.merged_into_client_id is not null then", "if false then",
      "aceptó una ficha fusionada"],
    ["el evento lleva el nombre",
      "pg_catalog.jsonb_build_object('client_markbox', v_new),",
      "pg_catalog.jsonb_build_object('client_markbox', v_new, 'client_name', v_client.name),",
      "antes/después no son sólo el Shipping Mark"],
    ["sin evento de auditoría",
      "  perform public.append_audit_event(\n    v_tenant,", "  perform pg_catalog.jsonb_build_array(\n    v_tenant,",
      "el evento no tiene la entidad o el actor"],
    ["sin el revoke: queda el EXECUTE por defecto de Supabase",
      "revoke all on function public.reassign_shipment_client(uuid, uuid, text, boolean)\n  from public, anon, authenticated, service_role;\n",
      "",
      "0551 postflight: EXECUTE de reassign_shipment_client debe ser sólo de authenticated"],
    ["anon puede ejecutar",
      "grant execute on function public.reassign_shipment_client(uuid, uuid, text, boolean) to authenticated;",
      "grant execute on function public.reassign_shipment_client(uuid, uuid, text, boolean) to authenticated, anon;",
      "0551 postflight: EXECUTE de reassign_shipment_client debe ser sólo de authenticated"],
  ];

  it.each(MUTANTES)("mutante «%s» muere", async (_nombre, from, to, muere, veces) => {
    const { error, green } = await contract({ migration: mutant(from, to, veces ?? 1) });
    expect(green).toBeUndefined();
    expect(error).toContain(muere);
  }, SLOW);
});
