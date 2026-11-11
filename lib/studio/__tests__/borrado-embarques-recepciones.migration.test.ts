// @vitest-environment node
/**
 * SDD-0522 · La migración 0476 corrida de verdad sobre PostgreSQL embebido.
 *
 * El contrato `supabase/tests/0476_borrado_embarques_recepciones.test.sql`
 * corre en `verify` con Docker, pero el CI de calidad no tiene Docker. PGlite
 * corre ese MISMO contrato, con los `.sql` reales de las migraciones
 * inlineados: lo que se prueba es el texto que el runbook aplicará a
 * producción, no un doble.
 *
 * CONTROL ROJO: sin 0476, el equipo borra físicamente un embarque por la API.
 *
 * DRIFT: cada caso rompe el catálogo antes de aplicar y la 0476 aborta en el
 * preflight con su mensaje, sin ids ni códigos.
 *
 * MUTANTES: cada uno se corre SIN el postflight de la propia migración (y con
 * su huella limpia, para que no muera por la huella que dejaría en la sesión),
 * así lo tiene que cazar el comportamiento que mide el contrato y no el
 * autochequeo. Los del postflight se corren con él. Cada mutante dice con qué
 * aserción muere: si muriera por otra, la prueba falla.
 *
 * EQUIVALENTES (sobreviven por construcción, documentados en la spec):
 * quitar `ut.disabled_at is null` del helper de admin (get_user_tenant_id ya
 * sólo devuelve la membresía activa) y quitar el tenant del UPDATE (sólo se
 * aplica si todos los ids se encontraron en el tenant).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pgliteLimpio } from "@/vitest/pglite-limpio";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CONTRACT = resolve(ROOT, "supabase/tests/0476_borrado_embarques_recepciones.test.sql");
const M0476 = "0476_borrado_embarques_recepciones.sql";
const FILE_0476 = readFileSync(resolve(ROOT, "supabase/migrations", M0476), "utf8");
const SLOW = 300_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes del contrato: \set, \if :{?v} / :v,
 * \else, \endif e \ir. `replace` sustituye el texto de una migración (mutante).
 */
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

async function contract(options: { applyFix?: boolean; migration?: string; vars?: Record<string, string> } = {}) {
  const sql = inline(CONTRACT, { apply_fix: String(options.applyFix ?? true), ...(options.vars ?? {}) },
    options.migration ? { [M0476]: options.migration } : {});
  const db = await pgliteLimpio({ pgcrypto });
  try {
    const results = await db.exec(sql);
    const rows = results.flatMap((result) => result.rows as Record<string, unknown>[]);
    const green = rows.map((row) => String(row.resultado ?? "")).find((text) => text.startsWith("TEST 0476 GREEN"));
    return { error: null as string | null, green };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), green: undefined };
  } finally {
    await db.close();
  }
}

type Cambio = [from: string, to: string, veces: number];

/**
 * 0476 con esos cambios. `veces` fija cuántas apariciones tiene que encontrar,
 * así una mutación que no matchea falla en vez de pasar como superviviente.
 * Sin postflight, la huella se limpia igual que la limpiaría él.
 */
function mutant(cambios: Cambio[], conPostflight = false): string {
  let text = FILE_0476;
  for (const [from, to, veces] of cambios) {
    expect(text.split(from), `apariciones de: ${from.slice(0, 90)}`).toHaveLength(veces + 1);
    text = text.split(from).join(to);
  }
  if (!conPostflight) {
    const ini = text.indexOf("do $postflight$");
    const fin = text.indexOf("$postflight$;", ini + 1);
    expect(ini).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(ini);
    text = text.slice(0, ini) + "select pg_catalog.set_config('dtd.huella_0476', '', false);"
      + text.slice(fin + "$postflight$;".length);
  }
  return text;
}

/** La guarda de embarques de esa tabla, neutralizada. */
const sinGuardaEmbarque = (tabla: string, sangria = 8): Cambio => [
  `from public.${tabla} x\n${" ".repeat(sangria)}where x.shipment_id = s.id`,
  `from public.${tabla} x\n${" ".repeat(sangria)}where false and x.shipment_id = s.id`,
  1,
];
const guardaTrigger = (tabla: string, nombre: string, momento: string, fn: string) =>
  `    create trigger ${nombre}\n      ${momento} update on public.${tabla}\n      for each row\n      when (old.deleted_at is null and new.deleted_at is not null)\n      execute function public.${fn}();\n`;
const RPC_EMBARQUES_DEFINER =
  "returns table (shipment_id uuid, code text, outcome text, blockers jsonb)\nlanguage plpgsql\nvolatile\nsecurity definer";
const GRANT_BORRADO = "grant execute on function public.soft_delete_shipments_with_audit_reason(uuid[], text) to authenticated;";
const TODO_O_NADA_EMBARQUES =
  "left join public.shipment_delete_blockers_internal(v_tenant, v_ids) as b on b.shipment_id = r.id;\n\n  -- Todo o nada.\n  v_apply := not exists (";
const TODO_O_NADA_RECEPCIONES =
  "left join public.warehouse_receipt_cn_delete_blockers_internal(v_tenant, v_ids) as b on b.receipt_id = q.id;\n\n  v_apply := not exists (";

/**
 * Borrado PARCIAL: aplica siempre, salta los bloqueados (y sus efectos) y no
 * compara el conteo. Un lote de un solo bloqueado no borra nada, así que la
 * sección 5 pasa: sólo el lote mixto de la sección 6 lo distingue del todo o
 * nada.
 */
function parcial(alias: "s" | "r"): Cambio[] {
  const embarques = alias === "s";
  const noBloqueado = (col: string) =>
    `\n       and not exists (select 1 from pg_catalog.jsonb_array_elements(v_rows) as e(v)\n                        where (e.v ->> 'id')::uuid = ${col} and e.v -> 'blockers' <> '{}'::jsonb)`;
  return [
    embarques
      ? [TODO_O_NADA_EMBARQUES, TODO_O_NADA_EMBARQUES.replace("v_apply := not", "v_apply := true or not"), 1]
      : [TODO_O_NADA_RECEPCIONES, TODO_O_NADA_RECEPCIONES.replace("v_apply := not", "v_apply := true or not"), 1],
    [`     where ${alias}.tenant_id = v_tenant and ${alias}.id = any(v_ids) and ${alias}.deleted_at is null;\n    get diagnostics`,
      `     where ${alias}.tenant_id = v_tenant and ${alias}.id = any(v_ids) and ${alias}.deleted_at is null${noBloqueado(`${alias}.id`)};\n    get diagnostics`, 1],
    [`      raise exception 'borrado: conflicto al eliminar ${embarques ? "embarques" : "recepciones"}' using errcode = '40001';\n`,
      "      null;\n", 1],
    embarques
      ? ["     where n.shipment_id = any(v_ids) and n.status = 'scheduled';",
        `     where n.shipment_id = any(v_ids) and n.status = 'scheduled'${noBloqueado("n.shipment_id")};`, 1]
      : ["     where b.receipt_id = any(v_ids) and b.deleted_at is null;",
        `     where b.receipt_id = any(v_ids) and b.deleted_at is null${noBloqueado("b.receipt_id")};`, 1],
  ];
}

const LOTE_EMBARQUES = "el lote borrable no se borró completo";
const LOTE_RECEPCIONES = "el lote borrable de recepciones no se borró completo";

const MUTANTS: { name: string; cambios: Cambio[]; fails: string; conPostflight?: boolean }[] = [
  // ── Frontera de la API ──────────────────────────────────────────────────
  { name: "sin revocar el DELETE de shipments", cambios: [["revoke delete on public.shipments from authenticated;\n", "", 1]],
    fails: "el equipo borró físicamente un embarque por la API" },
  { name: "sin revocar el DELETE de recepciones", cambios: [["revoke delete on public.warehouse_receipts_cn from authenticated;\n", "", 1]],
    fails: "el equipo borró físicamente una recepción por la API" },
  { name: "la guarda BEFORE deja pasar authenticated",
    cambios: [["if current_user in ('authenticated', 'anon') then", "if current_user in ('anon') then", 1]],
    fails: "un admin puso deleted_at directo en un embarque, sin la RPC" },
  { name: "sin la guarda BEFORE de embarques",
    cambios: [[guardaTrigger("shipments", "shipments_soft_delete_guard", "before", "soft_delete_requires_governed_rpc"), "    null;\n", 1]],
    fails: "un admin puso deleted_at directo en un embarque, sin la RPC" },
  { name: "sin la guarda BEFORE de recepciones",
    cambios: [[guardaTrigger("warehouse_receipts_cn", "warehouse_receipts_cn_soft_delete_guard", "before", "soft_delete_requires_governed_rpc"), "    null;\n", 1]],
    fails: "warehouse puso deleted_at directo en una recepción" },
  // ── Quién ───────────────────────────────────────────────────────────────
  { name: "sin exigir el rol admin", cambios: [["and ut.role = 'admin' and ut.disabled_at is null", "and ut.disabled_at is null", 1]],
    fails: "operations-A pudo borrar un embarque con la RPC" },
  { name: "sin exigir membresía", cambios: [["  if v_tenant is null or not exists (\n", "  if false and not exists (\n", 1]],
    fails: "operations-A pudo borrar un embarque con la RPC" },
  { name: "anon con EXECUTE del borrado", cambios: [[GRANT_BORRADO, GRANT_BORRADO.replace("to authenticated;", "to authenticated, anon;"), 1]],
    fails: "public.soft_delete_shipments_with_audit_reason(uuid[],text) ejecutable por anon" },
  { name: "el borrado de embarques SECURITY INVOKER",
    cambios: [[RPC_EMBARQUES_DEFINER, RPC_EMBARQUES_DEFINER.replace("security definer", "security invoker"), 1]],
    fails: "public.soft_delete_shipments_with_audit_reason(uuid[],text) sin la seguridad o el search_path esperados" },
  // ── Entrada ─────────────────────────────────────────────────────────────
  { name: "sin validar el motivo",
    cambios: [["  if v_reason is null or pg_catalog.char_length(v_reason) not between 4 and 1000 then\n", "  if false then\n", 2]],
    fails: "motivo nulo aceptado en embarques" },
  { name: "lote de hasta 1000", cambios: [["public.soft_delete_ids_internal(p_ids, 100)", "public.soft_delete_ids_internal(p_ids, 1000)", 2]],
    fails: "101 ids aceptados en embarques" },
  { name: "lectura de hasta 5000", cambios: [["public.soft_delete_ids_internal(p_ids, 500)", "public.soft_delete_ids_internal(p_ids, 5000)", 2]],
    fails: "501 ids aceptados en la lectura" },
  { name: "ids con nulos", cambios: [["  if pg_catalog.array_position(p_ids, null) is not null then\n", "  if false then\n", 1]],
    fails: "lista con nulos aceptada" },
  // ── Guardas de embarques ────────────────────────────────────────────────
  { name: "guarda: entregado", cambios: [["'delivered', case when s.status = 'delivered' then 1 end,", "'delivered', case when false then 1 end,", 1]],
    fails: "la lectura no ve la factura o la entrega" },
  { name: "guarda: ya eliminado",
    cambios: [["'already_deleted', case when s.deleted_at is not null then 1 end,", "'already_deleted', case when false then 1 end,", 1]],
    fails: "S-GONE no quedó bloqueado por already_deleted" },
  { name: "guarda: factura", cambios: [sinGuardaEmbarque("invoices")], fails: "la lectura no ve la factura o la entrega" },
  { name: "guarda: gasto", cambios: [sinGuardaEmbarque("expenses")], fails: "S-EXP no quedó bloqueado por expenses" },
  { name: "guarda: cuenta por pagar", cambios: [sinGuardaEmbarque("supplier_bills")], fails: "S-BILL no quedó bloqueado por supplier_bills" },
  { name: "guarda: costeo", cambios: [sinGuardaEmbarque("shipment_costs")], fails: "S-COST no quedó bloqueado por shipment_costs" },
  { name: "guarda: conversión de divisas", cambios: [sinGuardaEmbarque("currency_conversions", 12)],
    fails: "S-CNY1 no quedó bloqueado por china_finance" },
  { name: "guarda: libro de socios", cambios: [sinGuardaEmbarque("partner_ledger_entries", 12)],
    fails: "S-CNY2 no quedó bloqueado por china_finance" },
  { name: "guarda: compensación de reclamo", cambios: [sinGuardaEmbarque("supplier_claim_offsets", 12)],
    fails: "S-CNY3 no quedó bloqueado por china_finance" },
  { name: "guarda: aduana", cambios: [sinGuardaEmbarque("customs_filings")], fails: "S-CUS no quedó bloqueado por customs_filings" },
  { name: "guarda: ruta TMS", cambios: [sinGuardaEmbarque("tms_routes")], fails: "S-TMS no quedó bloqueado por tms_routes" },
  { name: "guarda: reclamo", cambios: [sinGuardaEmbarque("client_claims")], fails: "S-CLM no quedó bloqueado por client_claims" },
  { name: "guarda: consolidación naviera", cambios: [["where ci.shipment_id = s.id and co.deleted_at is null", "where false", 1]],
    fails: "S-NAV no quedó bloqueado por naviera_consolidations" },
  { name: "guarda: recepciones CN", cambios: [sinGuardaEmbarque("warehouse_receipts_cn")], fails: "S-REC no quedó bloqueado por cn_receipts" },
  { name: "guarda: compra", cambios: [sinGuardaEmbarque("prealertas")], fails: "S-PRE no quedó bloqueado por purchases" },
  // ── Contrapartes de embarques: lo anulado, cancelado o eliminado no bloquea
  { name: "contraparte: la factura anulada bloquea", cambios: [[
    "from public.invoices x\n        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'anulada'",
    "from public.invoices x\n        where x.shipment_id = s.id and x.deleted_at is null", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: la factura eliminada bloquea", cambios: [[
    "from public.invoices x\n        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'anulada'",
    "from public.invoices x\n        where x.shipment_id = s.id and x.status <> 'anulada'", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: el gasto anulado bloquea", cambios: [[
    "from public.expenses x\n        where x.shipment_id = s.id and x.deleted_at is null", "from public.expenses x\n        where x.shipment_id = s.id", 1]],
    fails: LOTE_EMBARQUES },
  { name: "contraparte: la cuenta por pagar anulada bloquea", cambios: [[
    "from public.supplier_bills x\n        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'anulada'",
    "from public.supplier_bills x\n        where x.shipment_id = s.id and x.deleted_at is null", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: la ruta cancelada bloquea", cambios: [["and x.status <> 'cancelado'", "", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: la consolidación eliminada bloquea",
    cambios: [["where ci.shipment_id = s.id and co.deleted_at is null", "where ci.shipment_id = s.id", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: la recepción eliminada bloquea", cambios: [[
    "from public.warehouse_receipts_cn x\n        where x.shipment_id = s.id and x.deleted_at is null",
    "from public.warehouse_receipts_cn x\n        where x.shipment_id = s.id", 1]], fails: LOTE_EMBARQUES },
  { name: "contraparte: la compra cancelada bloquea", cambios: [[
    "from public.prealertas x\n        where x.shipment_id = s.id and x.deleted_at is null and x.status <> 'cancelada'",
    "from public.prealertas x\n        where x.shipment_id = s.id and x.deleted_at is null", 1]], fails: LOTE_EMBARQUES },
  // ── Guardas de recepciones y sus contrapartes ───────────────────────────
  { name: "guarda: consolidada", cambios: [[
    "select 1 from public.shipments x where x.id = r.shipment_id and x.deleted_at is null", "select 1 from public.shipments x where false", 1]],
    fails: "la lectura de recepciones no coincide" },
  { name: "contraparte: consolidada en un embarque eliminado bloquea", cambios: [[
    "select 1 from public.shipments x where x.id = r.shipment_id and x.deleted_at is null",
    "select 1 from public.shipments x where x.id = r.shipment_id", 1]], fails: LOTE_RECEPCIONES },
  { name: "guarda: orden de despacho", cambios: [["where p.package_kind = 'warehouse_receipt_cn' and p.package_id = r.id", "where false", 1]],
    fails: "WR-OD no quedó bloqueada por dispatch_orders" },
  { name: "contraparte: la orden de despacho cancelada bloquea", cambios: [["          and o.status <> 'cancelada'), 0),", "          and true), 0),", 1]],
    fails: LOTE_RECEPCIONES },
  { name: "despacho sin mirar el tipo de paquete",
    cambios: [["where p.package_kind = 'warehouse_receipt_cn' and p.package_id = r.id", "where p.package_id = r.id", 1]],
    fails: LOTE_RECEPCIONES },
  { name: "guarda: compra de la recepción",
    cambios: [["where x.id = r.prealerta_id and x.deleted_at is null and x.status <> 'cancelada'", "where false", 1]],
    fails: "WR-PRE no quedó bloqueada por purchase" },
  { name: "contraparte: la compra cancelada de la recepción bloquea", cambios: [[
    "where x.id = r.prealerta_id and x.deleted_at is null and x.status <> 'cancelada'",
    "where x.id = r.prealerta_id and x.deleted_at is null", 1]], fails: LOTE_RECEPCIONES },
  { name: "contraparte: la compra eliminada de la recepción bloquea", cambios: [[
    "where x.id = r.prealerta_id and x.deleted_at is null and x.status <> 'cancelada'",
    "where x.id = r.prealerta_id and x.status <> 'cancelada'", 1]], fails: LOTE_RECEPCIONES },
  { name: "guarda: orden de venta",
    cambios: [["where x.id = r.sales_order_id and x.deleted_at is null and x.status <> 'cancelada'", "where false", 1]],
    fails: "WR-SO no quedó bloqueada por sales_order" },
  { name: "contraparte: la orden de venta cancelada bloquea", cambios: [[
    "where x.id = r.sales_order_id and x.deleted_at is null and x.status <> 'cancelada'",
    "where x.id = r.sales_order_id and x.deleted_at is null", 1]], fails: LOTE_RECEPCIONES },
  { name: "guarda: recepción en Venezuela", cambios: [["where vb.source_receipt_cn_id = r.id and v.deleted_at is null", "where false", 1]],
    fails: "WR-VE no quedó bloqueada por ve_receipts" },
  { name: "contraparte: la recepción de Venezuela eliminada bloquea",
    cambios: [["where vb.source_receipt_cn_id = r.id and v.deleted_at is null", "where vb.source_receipt_cn_id = r.id", 1]],
    fails: LOTE_RECEPCIONES },
  { name: "guarda: caja estibada",
    cambios: [["where b.receipt_id = r.id and cp.unstuffed_at is null and co.deleted_at is null", "where false", 1]],
    fails: "WR-STOW no quedó bloqueada por stowed_boxes" },
  { name: "contraparte: la caja desestibada bloquea", cambios: [[
    "where b.receipt_id = r.id and cp.unstuffed_at is null and co.deleted_at is null",
    "where b.receipt_id = r.id and co.deleted_at is null", 1]], fails: LOTE_RECEPCIONES },
  { name: "contraparte: la estiba en una consolidación eliminada bloquea", cambios: [[
    "where b.receipt_id = r.id and cp.unstuffed_at is null and co.deleted_at is null",
    "where b.receipt_id = r.id and cp.unstuffed_at is null", 1]], fails: LOTE_RECEPCIONES },
  // ── Semántica del lote ─────────────────────────────────────────────────
  { name: "sin todo o nada (embarques)",
    cambios: [[TODO_O_NADA_EMBARQUES, TODO_O_NADA_EMBARQUES.replace("v_apply := not", "v_apply := true or not"), 1]],
    fails: "100 ids inexistentes no dieron 100 not_found" },
  { name: "sin todo o nada (recepciones)",
    cambios: [[TODO_O_NADA_RECEPCIONES, TODO_O_NADA_RECEPCIONES.replace("v_apply := not", "v_apply := true or not"), 1]],
    fails: "WR-GONE no quedó bloqueada por already_deleted" },
  { name: "borrado parcial: los libres sí, los bloqueados no (embarques)", cambios: parcial("s"),
    fails: "el lote mixto no dio held + blocked" },
  { name: "borrado parcial: los libres sí, los bloqueados no (recepciones)", cambios: parcial("r"),
    fails: "el lote mixto de recepciones no dio held + blocked" },
  { name: "sin filtrar el tenant (embarques)", cambios: [["  where s.tenant_id = p_tenant\n    and s.id = any(p_ids)", "  where s.id = any(p_ids)", 1]],
    fails: "la lectura no devolvió sólo los 4 del tenant" },
  { name: "sin filtrar el tenant (recepciones)", cambios: [["  where r.tenant_id = p_tenant\n    and r.id = any(p_ids)", "  where r.id = any(p_ids)", 1]],
    fails: "la lectura de recepciones no coincide" },
  { name: "sin restaurar el motivo (embarques)", cambios: [[
    "     where n.shipment_id = any(v_ids) and n.status = 'scheduled';\n\n    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);",
    "     where n.shipment_id = any(v_ids) and n.status = 'scheduled';\n", 1]],
    fails: "la RPC no restauró el motivo previo del caller" },
  { name: "sin restaurar el motivo (recepciones)", cambios: [[
    "     where b.receipt_id = any(v_ids) and b.deleted_at is null;\n\n    perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);",
    "     where b.receipt_id = any(v_ids) and b.deleted_at is null;\n", 1]],
    fails: "la RPC de recepciones no restauró el motivo previo del caller" },
  { name: "sin cancelar los avisos programados", cambios: [[
    "       set status = 'canceled', error = 'envío eliminado'\n     where n.shipment_id = any(v_ids) and n.status = 'scheduled';",
    "       set status = status\n     where false;", 1]], fails: "el aviso programado no se canceló" },
  { name: "cancela también lo ya enviado",
    cambios: [["where n.shipment_id = any(v_ids) and n.status = 'scheduled';", "where n.shipment_id = any(v_ids);", 1]],
    fails: "el aviso enviado cambió" },
  { name: "sin retirar las cajas", cambios: [["     where b.receipt_id = any(v_ids) and b.deleted_at is null;", "     where false;", 1]],
    fails: "las cajas de una recepción borrada siguen vivas" },
  { name: "sin FOR UPDATE (embarques)", cambios: [["   order by s.id\n   for update of s;", "   order by s.id;", 1]],
    fails: "el borrado de embarques no bloquea las filas en orden de id" },
  { name: "sin FOR UPDATE (recepciones)", cambios: [["   order by r.id\n   for update of r;", "   order by r.id;", 1]],
    fails: "el borrado de recepciones no bloquea las filas en orden de id" },
  // ── Auditoría ──────────────────────────────────────────────────────────
  { name: "el evento con otro nombre", cambios: [["    'shipment_deleted',\n", "    'shipment_updated',\n", 1]],
    fails: "no hay exactamente 10 eventos shipment_deleted" },
  { name: "sin el trigger de auditoría de recepciones", cambios: [[
    guardaTrigger("warehouse_receipts_cn", "warehouse_receipts_cn_audit_soft_delete", "after", "warehouse_receipts_cn_audit_soft_delete"),
    "    null;\n", 1]], fails: "faltan los cuatro triggers de borrado con su condición" },
  { name: "el evento se traga su fallo", cambios: [[
    "  return null;\nend;\n$$;\n\ncomment on function public.shipments_audit_soft_delete is",
    "  return null;\nexception when others then return null;\nend;\n$$;\n\ncomment on function public.shipments_audit_soft_delete is", 1]],
    fails: "con el writer roto se borró un embarque" },
  { name: "antes con new", cambios: [[
    "pg_catalog.jsonb_build_object('deleted_at', old.deleted_at, 'status', old.status),",
    "pg_catalog.jsonb_build_object('deleted_at', new.deleted_at, 'status', new.status),", 2]],
    fails: "antes/después del evento no son los esperados" },
  { name: "el payload sin la permanencia", cambios: [[
    "      'permanence', 'P2',\n      'consequence', 'removed_from_studio", "      'consequence', 'removed_from_studio", 1]],
    fails: "payload del evento inesperado" },
  { name: "la correlación por fila y no por lote", cambios: [[
    "pg_catalog.concat('sdd-0522:shipments:', pg_catalog.txid_current()::text)", "pg_catalog.concat('sdd-0522:shipments:', new.id::text)", 1]],
    fails: "los eventos del lote no comparten una correlación" },
  { name: "el actor siempre es el sistema", cambios: [[
    "    case when v_actor is null then 'system' else 'user' end,\n    v_actor,\n    'shipment_deleted',", "    'system',\n    null,\n    'shipment_deleted',", 1]],
    fails: "el evento de S-OK-1 no tiene tenant, actor, motivo o fuente" },
  // ── El postflight, con él ──────────────────────────────────────────────
  { name: "postflight: sin revocar el DELETE", conPostflight: true,
    cambios: [["revoke delete on public.shipments from authenticated;\n", "", 1]],
    fails: "0476: authenticated o anon conservan DELETE sobre shipments o warehouse_receipts_cn" },
  { name: "postflight: anon con EXECUTE", conPostflight: true,
    cambios: [[GRANT_BORRADO, GRANT_BORRADO.replace("to authenticated;", "to authenticated, anon;"), 1]],
    fails: "0476: ACL inválida en public.soft_delete_shipments_with_audit_reason(uuid[],text)" },
  { name: "postflight: el borrado SECURITY INVOKER", conPostflight: true,
    cambios: [[RPC_EMBARQUES_DEFINER, RPC_EMBARQUES_DEFINER.replace("security definer", "security invoker"), 1]],
    fails: "0476: public.soft_delete_shipments_with_audit_reason(uuid[],text) no quedó con la forma final" },
  { name: "postflight: el trigger de auditoría con otra condición", conPostflight: true, cambios: [[
    "    create trigger shipments_audit_soft_delete\n      after update on public.shipments\n      for each row\n      when (old.deleted_at is null and new.deleted_at is not null)",
    "    create trigger shipments_audit_soft_delete\n      after update on public.shipments\n      for each row\n      when (new.deleted_at is not null)", 1]],
    fails: "0476: los triggers de borrado no quedaron vivos con su forma" },
  { name: "postflight: sin la guarda BEFORE", conPostflight: true,
    cambios: [[guardaTrigger("shipments", "shipments_soft_delete_guard", "before", "soft_delete_requires_governed_rpc"), "    null;\n", 1]],
    fails: "0476: los triggers de borrado no quedaron vivos con su forma" },
  { name: "postflight: toca el catálogo vecino", conPostflight: true, cambios: [[
    "revoke delete on public.warehouse_receipts_cn from authenticated;\n",
    "revoke delete on public.warehouse_receipts_cn from authenticated;\nrevoke update on public.warehouse_boxes from authenticated;\n", 1]],
    fails: "0476: cambió el catálogo dependiente" },
];

const DRIFT: { name: string; vars: string; fails: string }[] = [
  { name: "shipments sin RLS", vars: "drift_sin_rls", fails: "0476 requiere shipments y warehouse_receipts_cn con RLS" },
  { name: "una columna que leen las guardas", vars: "drift_sin_columna", fails: "0476 requiere la columna public.prealertas.shipment_id" },
  { name: "una etiqueta de enum renombrada", vars: "drift_enum", fails: "0476 requiere la etiqueta anulada del enum public.invoice_status" },
  { name: "el tipo de entidad inactivo", vars: "drift_tipo_inactivo",
    fails: "0476 abortada: los tipos de entidad shipment y warehouse_receipt_cn no están activos; cada borrado fallaría" },
  { name: "el writer sin SECURITY DEFINER", vars: "drift_writer",
    fails: "0476 requiere append_audit_event SECURITY DEFINER con search_path vacío (0267/0294)" },
  { name: "los avisos sin el estado canceled", vars: "drift_sin_canceled",
    fails: "0476 requiere que client_notification_schedule.status admita canceled" },
  { name: "una función ajena con el nombre de la migración", vars: "drift_funcion_ajena",
    fails: "0476 abortada: ya existe una función con el nombre de esta migración y otra forma o firma" },
  { name: "un trigger ajeno con el nombre de la migración", vars: "drift_trigger_ajeno",
    fails: "0476 abortada: ya existe un trigger con el nombre de esta migración y otra forma" },
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe("SDD-0522 · 0476 borrado auditado de embarques y recepciones (PGlite)", () => {
  it("el contrato pasa con 0476", async () => {
    const result = await contract();
    expect(result.error).toBeNull();
    expect(result.green).toBe("TEST 0476 GREEN: 215 aserciones");
  }, SLOW);

  it("control rojo: sin 0476 el equipo borra físicamente un embarque por la API", async () => {
    const result = await contract({ applyFix: false });
    expect(result.error).toContain("TEST 0476: el equipo borró físicamente un embarque por la API");
  }, SLOW);

  describe("drift: el preflight aborta con su mensaje, sin ids", () => {
    for (const drift of DRIFT) {
      it(drift.name, async () => {
        const result = await contract({ vars: { [drift.vars]: "true" } });
        expect(result.error).toContain(drift.fails);
        expect(result.error).not.toMatch(UUID);
        expect(result.error).not.toMatch(/S-[A-Z]|WR-[A-Z]|DTD-\d/);
      }, SLOW);
    }
  });

  describe("mutantes: cada uno muere con su aserción", () => {
    for (const m of MUTANTS) {
      it(m.name, async () => {
        const result = await contract({ migration: mutant(m.cambios, m.conPostflight ?? false) });
        expect(result.error).toContain(m.fails);
      }, SLOW);
    }
  });
});
