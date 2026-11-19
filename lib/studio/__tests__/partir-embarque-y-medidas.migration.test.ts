// @vitest-environment node
/**
 * SDD-0673 · La migración 0563 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0563_partir_embarque_y_medidas.test.sql` corre en
 * `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite corre ese
 * MISMO contrato con los `.sql` reales de las migraciones inlineados: lo que se
 * prueba es el texto que el runbook aplicará, no un doble.
 *
 * CONTROL ROJO: sin 0563, operaciones no puede corregir las medidas.
 *
 * MUTANTES: cada uno cambia la 0563 y tiene que morir con la aserción que lo
 * caza; si muriera por otra, la prueba falla. PGlite tiene una sola conexión:
 * los FOR UPDATE no se prueban acá.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0563_partir_embarque_y_medidas.test.sql");
const M0563 = "0563_partir_embarque_y_medidas.sql";
const FILE_0563 = readFileSync(resolve(ROOT, "supabase/migrations", M0563), "utf8");
const SLOW = 300_000;
const M0241 = "0241_estiba_por_zonas.sql";
const FILE_0241 = readFileSync(resolve(ROOT, "supabase/migrations", M0241), "utf8");

/** La 0241 con el cuerpo de sync_boxes_for_receipt cambiado por `cambiar`. */
function con0241(cambiar: (cuerpo: string) => string): string {
  const inicio = FILE_0241.indexOf("create or replace function public.sync_boxes_for_receipt(");
  const desde = FILE_0241.indexOf("as $$", inicio) + "as $$".length;
  const hasta = FILE_0241.indexOf("$$;", desde);
  expect(inicio).toBeGreaterThan(0);
  const cuerpo = cambiar(FILE_0241.slice(desde, hasta));
  return FILE_0241.slice(0, desde) + cuerpo + FILE_0241.slice(hasta);
}
const ASERCIONES = 91;

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

async function contract(options: { applyFix?: boolean; migration?: string; m0241?: string } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true) }, {
    ...(options.migration ? { [M0563]: options.migration } : {}),
    ...(options.m0241 ? { [M0241]: options.m0241 } : {}),
  });
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0563 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

/** 0563 con un cambio que tiene que aparecer exactamente `veces` veces. */
function mutant(from: string, to: string, veces = 1): string {
  expect(FILE_0563.split(from), `apariciones de: ${from.slice(0, 90)}`).toHaveLength(veces + 1);
  return FILE_0563.split(from).join(to);
}

describe("0563 · corregir medidas y partir un embarque (contrato en PGlite)", () => {
  it("verde: el contrato pasa entero con la 0563 real", async () => {
    const { error, green } = await contract();
    expect(error).toBeNull();
    expect(green).toBe(`TEST 0563 GREEN: ${ASERCIONES} aserciones`);
  }, SLOW);

  it("rojo: sin la 0563, operaciones no puede corregir las medidas", async () => {
    const { error } = await contract({ applyFix: false });
    expect(error).toContain("TEST 0563: operaciones no pudo ver la vista previa de la corrección");
  }, SLOW);

  // Producción (aplicada desde Supabase Cloud) guarda el cuerpo de la 0241 sin sus
  // líneas de solo comentario: md5 7cb66f72…, 2004 caracteres. El preflight lo acepta.
  it("el cuerpo de la 0241 sin líneas de comentario (como quedó en Cloud) pasa el preflight", async () => {
    const m0241 = con0241((c) => c.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"));
    expect(m0241).not.toBe(FILE_0241);
    const { error, green } = await contract({ m0241 });
    expect(error).toBeNull();
    expect(green).toBe(`TEST 0563 GREEN: ${ASERCIONES} aserciones`);
  }, SLOW);

  it("otro cuerpo de sync_boxes_for_receipt aborta la 0563", async () => {
    const m0241 = con0241((c) => c.replace("order by b2.seq desc", "order by b2.seq asc"));
    expect(m0241).not.toBe(FILE_0241);
    const { error } = await contract({ m0241 });
    expect(error).toContain("0563 abortada: sync_boxes_for_receipt no es la de la 0241");
  }, SLOW);

  const MUTANTES: [nombre: string, from: string, to: string, muere: string, veces?: number][] = [
    ["comercial también puede (D1)",
      "ut.role in ('admin', 'operations')", "ut.role in ('admin', 'operations', 'commercial')",
      "commercial-A pudo corregir", 2],
    ["el embarque se busca sin el tenant",
      "where s.id = p_shipment_id and s.tenant_id = v_tenant", "where s.id = p_shipment_id",
      "un admin de otro tenant corrigió un embarque ajeno", 4],
    ["corregir no toca la línea del contenedor",
      "set cbm = coalesce(p_cbm, ci.cbm), weight_kg = coalesce(p_weight_kg, ci.weight_kg),\n           pieces = coalesce(p_boxes, ci.pieces)",
      "set cbm = ci.cbm",
      "la corrección no alineó las tres tablas"],
    ["corregir no toca la recepción",
      "set boxes = coalesce(p_boxes, r.boxes), total_cbm = coalesce(p_cbm, r.total_cbm),",
      "set boxes = r.boxes, total_cbm = coalesce(p_cbm, r.total_cbm),",
      "la corrección no alineó las tres tablas"],
    ["corregir sin el bloqueo de entregado",
      "  if v_ship.status in ('delivered', 'cancelled') then", "  if false then",
      "corrigió un embarque entregado"],
    ["corregir sin el bloqueo de Venezuela",
      "v_blockers := v_blockers || pg_catalog.jsonb_build_object('caja_en_recepcion_ve', v_m);", "null;",
      "bajó una caja que ya está en Venezuela"],
    ["corregir sin el bloqueo de estiba",
      "v_blockers := v_blockers || pg_catalog.jsonb_build_object('cajas_estibadas', v_excess - v_n);", "null;",
      "bajó una caja estibada"],
    ["corregir acepta 4 decimales",
      "(p_cbm < 0 or p_cbm <> pg_catalog.round(p_cbm, 3)) then\n    raise exception 'corregir medidas",
      "(p_cbm < 0) then\n    raise exception 'corregir medidas",
      "corregir aceptó 4 decimales"],
    ["las facturas emitidas no bloquean",
      "if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('factura_emitida', v_n); end if;",
      "", "corrigió con factura emitida", 2],
    ["partir sin el bloqueo de medidas desalineadas",
      "v_blockers := v_blockers || pg_catalog.jsonb_build_object('medidas_desalineadas', 1);", "null;",
      "partió un embarque con medidas desalineadas"],
    ["partir sin el bloqueo de caja escaneada",
      "if v_n > 0 then v_blockers := v_blockers || pg_catalog.jsonb_build_object('caja_escaneada_ve', v_n); end if;", "",
      "partió moviendo una caja escaneada en Venezuela"],
    ["partir sin el bloqueo de entregado",
      "  if v_ship.status::text in ('delivered', 'cancelled') then", "  if false then",
      "partió un embarque entregado"],
    ["partir no resta en el original",
      "set volume_m3 = v_rec.total_cbm - p_cbm, weight_kg = v_rec.total_weight_kg - p_weight_kg,",
      "set volume_m3 = s.volume_m3, weight_kg = s.weight_kg,",
      "el original no quedó con el resto"],
    ["partir no mueve la caja a Venezuela",
      "   where ve.id = vb.receipt_id and ve.deleted_at is null\n     and vb.code = any(v_box_codes) and vb.scanned_at is null;",
      "   where false;",
      "la caja esperada en Venezuela no siguió al dueño nuevo"],
    ["partir no copia la línea de tiempo",
      "   where e.shipment_id = v_ship.id and e.deleted_at is null;",
      "   where false;",
      "la parte nueva no heredó la línea de tiempo"],
    ["partir usa -B aunque esté ocupado",
      "where not exists (select 1 from public.shipments s\n                        where s.tenant_id = v_tenant and s.code = v_ship.code || '-' || x.l)\n       and not exists",
      "where true\n       and not exists",
      "la vista previa de partir no calculó las dos partes"],
    ["partir sin evento de salida",
      "v_actor, 'shipment_split_out'", "v_actor, 'shipment_split_otro'",
      "falta el evento shipment_split_out"],
    ["la vista previa de partir escribe",
      "    'box_codes', pg_catalog.to_jsonb(coalesce(v_box_codes, '{}'))) end;\n\n  if v_blockers <> '{}'::jsonb or v_dry then",
      "    'box_codes', pg_catalog.to_jsonb(coalesce(v_box_codes, '{}'))) end;\n\n  if v_blockers <> '{}'::jsonb then",
      "operaciones no pudo ver la vista previa de partir"],
    ["sin el revoke: queda el EXECUTE por defecto de Supabase",
      "revoke all on function public.split_shipment(uuid, uuid, integer, numeric, numeric, text, text[], boolean)\n  from public, anon, authenticated, service_role;\n",
      "",
      "0563 postflight: EXECUTE de public.split_shipment"],
    ["partir: la línea nueva no suma lo mismo (postcondición del total)",
      "p_cbm, p_weight_kg, p_boxes)\n  returning id into v_new_item;",
      "p_cbm, p_weight_kg, p_boxes + 1)\n  returning id into v_new_item;",
      "partir embarque: el total del contenedor cambió"],
    ["partir: la recepción nueva sin su conteo (postcondición de cajas)",
      "  update public.warehouse_receipts_cn r set boxes = p_boxes where r.id = v_new_rec;\n", "",
      "partir embarque: las cajas físicas no quedaron alineadas"],
    ["corregir sin evento",
      "'shipment_measures_corrected',\n    'rpc',", "'shipment_measures_otro',\n    'rpc',",
      "el evento de corrección no tiene entidad, actor o motivo"],
    ["corregir sin el aviso de borrador",
      "  if v_m > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('borrador_factura', v_m); end if;\n\n  if v_rec.id is not null then",
      "\n  if v_rec.id is not null then",
      "el borrador de factura no avisó al corregir"],
    ["partir sin el aviso de borrador",
      "  if v_m > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('borrador_factura', v_m); end if;\n\n  select pg_catalog.count(*) into v_n from public.client_claims",
      "\n  select pg_catalog.count(*) into v_n from public.client_claims",
      "el borrador de factura no avisó al partir"],
    ["corregir sin el aviso de tarifa congelada",
      "    if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;\n  end if;\n\n  -- Cajas físicas",
      "  end if;\n\n  -- Cajas físicas",
      "corregir no avisó la tarifa congelada"],
    ["partir sin el aviso de tarifa congelada",
      "    if v_n > 0 then v_warnings := v_warnings || pg_catalog.jsonb_build_object('tarifa_congelada', v_n); end if;\n  end if;\n\n  select pg_catalog.count(*) filter",
      "  end if;\n\n  select pg_catalog.count(*) filter",
      "partir no avisó la tarifa congelada"],
    ["partir copia las notas",
      "v_ship.vehicle_category, null, coalesce(", "v_ship.vehicle_category, v_ship.notes, coalesce(",
      "la parte nueva heredó las notas del original"],
    ["partir no copia la planificación",
      "v_ship.arrived_destination_at, v_ship.planned_departure_at, v_ship.planned_arrival_at,",
      "v_ship.arrived_destination_at, v_ship.planned_departure_at, null,",
      "la parte nueva no heredó la llegada, la planificación o el GPS"],
    ["el preflight no mira el cuerpo de sync_boxes_for_receipt",
      "not in ('a6e9542fee29b37e015277696433a125', '7cb66f72fc71ea058d7f46fb0551eb05') then",
      "not in ('00000000000000000000000000000000', '7cb66f72fc71ea058d7f46fb0551eb05') then",
      "0563 abortada: sync_boxes_for_receipt no es la de la 0241"],
    ["el grupo de WeChat sin el check",
      "or pg_catalog.char_length(pg_catalog.btrim(group_reference)) between 1 and 120) not valid;",
      "or true) not valid;",
      "el grupo de WeChat aceptó texto vacío"],
  ];

  it.each(MUTANTES)("mutante «%s» muere", async (_nombre, from, to, muere, veces) => {
    const { error, green } = await contract({ migration: mutant(from, to, veces ?? 1) });
    expect(green).toBeUndefined();
    expect(error).toContain(muere);
  }, SLOW);
});
