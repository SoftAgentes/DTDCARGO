/**
 * SDD-0560 · Lo que el asistente de borrado lee de la base para armar el plan.
 *
 * Recibe el cliente de SESIÓN (`@/lib/db/server`): la RPC de la 0476 decide con
 * el `auth.uid()` de quien llama (sólo admin) y las listas respetan la RLS.
 *
 * QUÉ BLOQUEA no se decide acá: viene de `shipment_delete_blockers` (migr
 * 0476), la misma función que usa el borrado. Las listas de abajo sólo ponen
 * código y estado a cada dependencia, con el MISMO predicado que la guarda. Si
 * una lista no cuadra con el conteo de la base, `calcularPlan` bloquea: un
 * predicado que se desvíe de la 0476 no abre nada, cierra.
 *
 * Una lista que no se pudo leer es `null`. Sólo se lee lo que la base cuenta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AVISOS_EMBARQUE, BLOQUEOS_EMBARQUE, parseAvisos, parseBloqueos } from "./reglas";
import {
  calcularPlan,
  type CxpDep,
  type EntradaPlan,
  type FacturaDep,
  type PlanBorrado,
  type RefDep,
  type RutaDep,
} from "./asistente";

type Fila = Record<string, unknown>;

const texto = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** `paid_amount` ilegible queda NaN: `calcularPlan` lo trata como cobrado. */
const monto = (v: unknown): number => (v === null || v === undefined || v === "" ? Number.NaN : Number(v));

function filas(data: unknown): Fila[] | null {
  if (!Array.isArray(data)) return null;
  return data.every((f) => typeof f === "object" && f !== null) ? (data as Fila[]) : null;
}

function falla(origen: string, error: { code?: string; message?: string } | null): null {
  // El mensaje crudo va al log del servidor, nunca a la pantalla.
  if (error) console.error(`[asistente-borrado] ${origen}`, error.code, error.message);
  return null;
}

/** id + código de cada fila; `null` si alguna no los trae. */
function refs(lista: Fila[], columnaCodigo: string): RefDep[] | null {
  const out: RefDep[] = [];
  for (const f of lista) {
    const id = texto(f.id);
    const codigo = texto(f[columnaCodigo]);
    if (!id || !codigo) return null;
    out.push({ id, codigo });
  }
  return out;
}

async function leerFacturas(supabase: SupabaseClient, shipmentId: string): Promise<FacturaDep[] | null> {
  // Guarda `invoices` de la 0476: viva y no `anulada` (borrador incluido).
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_code, status, paid_amount")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null)
    .neq("status", "anulada");
  const lista = filas(data);
  if (error || !lista) return falla("invoices", error);

  const base = refs(lista, "invoice_code");
  if (!base) return null;
  if (base.length === 0) return [];

  // B1: el asiento vivo de cada factura (no anulado, no borrado). Si la lectura
  // falla, `asientoVivo` queda `null` y el plan no ofrece anularla.
  const asientos = await supabase
    .from("journal_entries")
    .select("id, invoice_id")
    .in(
      "invoice_id",
      base.map((f) => f.id),
    )
    .neq("status", "anulado")
    .is("deleted_at", null);
  const filasAsiento = filas(asientos.data);
  let vivos: Set<unknown> | null = null;
  if (asientos.error || !filasAsiento) falla("journal_entries", asientos.error);
  else vivos = new Set(filasAsiento.map((a) => a.invoice_id));

  return lista.map((f, i) => ({
    id: base[i].id,
    codigo: base[i].codigo,
    estado: texto(f.status) ?? "",
    pagado: monto(f.paid_amount),
    asientoVivo: vivos === null ? null : vivos.has(base[i].id),
  }));
}

async function leerGastos(supabase: SupabaseClient, shipmentId: string): Promise<RefDep[] | null> {
  // Guarda `expenses`: gasto vivo (anular lo marca con `deleted_at`, 0340).
  const { data, error } = await supabase
    .from("expenses")
    .select("id, expense_code")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null);
  const lista = filas(data);
  if (error || !lista) return falla("expenses", error);
  return refs(lista, "expense_code");
}

async function leerCxp(supabase: SupabaseClient, shipmentId: string): Promise<CxpDep[] | null> {
  // Guarda `supplier_bills`: viva y no `anulada`.
  const { data, error } = await supabase
    .from("supplier_bills")
    .select("id, bill_code, status, paid_amount")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null)
    .neq("status", "anulada");
  const lista = filas(data);
  if (error || !lista) return falla("supplier_bills", error);
  const base = refs(lista, "bill_code");
  if (!base) return null;
  return lista.map((f, i) => ({ ...base[i], estado: texto(f.status) ?? "", pagado: monto(f.paid_amount) }));
}

async function leerRutas(supabase: SupabaseClient, shipmentId: string): Promise<RutaDep[] | null> {
  // Guarda `tms_routes`: viva y no `cancelado`.
  const { data, error } = await supabase
    .from("tms_routes")
    .select("id, route_code, status")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null)
    .neq("status", "cancelado");
  const lista = filas(data);
  if (error || !lista) return falla("tms_routes", error);
  const base = refs(lista, "route_code");
  if (!base) return null;
  return lista.map((f, i) => ({ ...base[i], estado: texto(f.status) ?? "" }));
}

async function leerConsolidaciones(supabase: SupabaseClient, shipmentId: string): Promise<RefDep[] | null> {
  // Guarda `naviera_consolidations`: consolidaciones vivas (distintas) con una
  // pieza de este embarque.
  const items = await supabase.from("consolidation_items").select("consolidation_id").eq("shipment_id", shipmentId);
  const filasItems = filas(items.data);
  if (items.error || !filasItems) return falla("consolidation_items", items.error);
  const ids = [...new Set(filasItems.map((f) => texto(f.consolidation_id)))];
  if (ids.some((x) => x === null)) return null;
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("consolidations")
    .select("id, ref")
    .in("id", ids as string[])
    .is("deleted_at", null);
  const lista = filas(data);
  if (error || !lista) return falla("consolidations", error);
  return refs(lista, "ref");
}

async function leerRecepciones(supabase: SupabaseClient, shipmentId: string): Promise<RefDep[] | null> {
  // Guarda `cn_receipts`: recepciones CN vivas cuyo contenedor es este embarque.
  const { data, error } = await supabase
    .from("warehouse_receipts_cn")
    .select("id, receipt_code")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null);
  const lista = filas(data);
  if (error || !lista) return falla("warehouse_receipts_cn", error);
  return refs(lista, "receipt_code");
}

async function leerCompras(supabase: SupabaseClient, shipmentId: string): Promise<RefDep[] | null> {
  // Guarda `purchases`: compra (prealerta) viva y no `cancelada` que apunta acá.
  const { data, error } = await supabase
    .from("prealertas")
    .select("id, code")
    .eq("shipment_id", shipmentId)
    .is("deleted_at", null)
    .neq("status", "cancelada");
  const lista = filas(data);
  if (error || !lista) return falla("prealertas", error);
  return refs(lista, "code");
}

/**
 * La entrada del plan de un embarque. Si la RPC de la 0476 falla o no trae la
 * fila, no se lee nada más: el plan no ofrece pasos.
 */
export async function leerEntradaPlan(supabase: SupabaseClient, shipmentId: string): Promise<EntradaPlan> {
  const vacia = (info: "fallo" | "no_encontrado", codigo = ""): EntradaPlan => ({
    embarque: { id: shipmentId, codigo },
    info,
    facturas: [],
    gastos: [],
    cxp: [],
    rutas: [],
    consolidaciones: [],
    recepciones: [],
    compras: [],
  });

  const { data, error } = await supabase.rpc("shipment_delete_blockers", { p_ids: [shipmentId] });
  const lista = filas(data);
  if (error || !lista) {
    falla("shipment_delete_blockers", error);
    return vacia("fallo");
  }
  const fila = lista.find((f) => typeof f.shipment_id === "string" && f.shipment_id.toLowerCase() === shipmentId.toLowerCase());
  if (!fila) return vacia("no_encontrado");

  const info = {
    bloqueos: parseBloqueos(fila.blockers, BLOQUEOS_EMBARQUE),
    avisos: parseAvisos(fila.warnings, AVISOS_EMBARQUE),
  };
  const b = info.bloqueos;
  const hay = (n: number | undefined) => (n ?? 0) > 0;

  const [facturas, gastos, cxp, rutas, consolidaciones, recepciones, compras] = await Promise.all([
    hay(b.invoices) ? leerFacturas(supabase, shipmentId) : [],
    hay(b.expenses) ? leerGastos(supabase, shipmentId) : [],
    hay(b.supplier_bills) ? leerCxp(supabase, shipmentId) : [],
    hay(b.tms_routes) ? leerRutas(supabase, shipmentId) : [],
    hay(b.naviera_consolidations) ? leerConsolidaciones(supabase, shipmentId) : [],
    hay(b.cn_receipts) ? leerRecepciones(supabase, shipmentId) : [],
    hay(b.purchases) ? leerCompras(supabase, shipmentId) : [],
  ]);

  return {
    embarque: { id: shipmentId, codigo: texto(fila.code) ?? "" },
    info,
    facturas,
    gastos,
    cxp,
    rutas,
    consolidaciones,
    recepciones,
    compras,
  };
}

/** El plan de borrado de un embarque, recalculado desde la base. */
export async function leerPlanDeBorrado(supabase: SupabaseClient, shipmentId: string): Promise<PlanBorrado> {
  return calcularPlan(await leerEntradaPlan(supabase, shipmentId));
}
