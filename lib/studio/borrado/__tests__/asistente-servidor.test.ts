/**
 * SDD-0560 · `leerEntradaPlan` / `leerPlanDeBorrado`: qué lee el asistente.
 *
 * El doble (`listados-double.ts`) APLICA `eq/neq/is/in`, devuelve copias y
 * lanza si un filtro va antes de `select()`. La fixture es infeliz a
 * propósito: junto a cada dependencia viva hay su contraparte que la guarda de
 * la 0476 NO cuenta (anulada, eliminada, cancelada, asiento anulado), así que
 * sólo los filtros correctos dejan que la lista cuadre con el conteo de la base.
 *
 * Control del doble: el mismo store con todo «vivo» (`todoVivo`) o sin los
 * filtros de estado hace que las listas NO cuadren, y el plan se bloquea.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dobleListados, todoVivo, type Fila } from "@/lib/studio/__tests__/listados-double";
import { leerEntradaPlan, leerPlanDeBorrado } from "../asistente-servidor";

const S = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const ELIMINADO = "2026-10-10T00:00:00Z";

function fila(blockers: Record<string, number>, warnings: Record<string, number> = {}): Fila {
  return { shipment_id: S, code: "S-2026-0042", blockers, warnings };
}

/** Store con UNA dependencia viva de cada tipo, y su contraparte que no cuenta. */
function store(): Record<string, Fila[]> {
  return {
    shipment_delete_blockers: [
      fila({ invoices: 2, expenses: 1, supplier_bills: 1, tms_routes: 1, naviera_consolidations: 1, cn_receipts: 1, purchases: 1 }),
    ],
    invoices: [
      { id: "f-borrador", invoice_code: "F-2026-0002", status: "borrador", paid_amount: 0, shipment_id: S, deleted_at: null },
      { id: "f-emitida", invoice_code: "F-2026-0001", status: "emitida", paid_amount: 0, shipment_id: S, deleted_at: null },
      { id: "f-anulada", invoice_code: "F-2026-0003", status: "anulada", paid_amount: 0, shipment_id: S, deleted_at: null },
      { id: "f-eliminada", invoice_code: "F-2026-0004", status: "borrador", paid_amount: 0, shipment_id: S, deleted_at: ELIMINADO },
      { id: "f-otro", invoice_code: "F-2026-0005", status: "emitida", paid_amount: 0, shipment_id: OTRO, deleted_at: null },
    ],
    journal_entries: [
      // El asiento de la emitida está ANULADO: no cuenta como vivo.
      { id: "a-1", invoice_id: "f-emitida", status: "anulado", deleted_at: null },
      // Uno vivo pero eliminado: tampoco.
      { id: "a-2", invoice_id: "f-emitida", status: "asentado", deleted_at: ELIMINADO },
      // Vivo, de otra factura: no le toca.
      { id: "a-3", invoice_id: "f-otro", status: "asentado", deleted_at: null },
    ],
    expenses: [
      { id: "g-vivo", expense_code: "EXP-1", shipment_id: S, deleted_at: null },
      { id: "g-anulado", expense_code: "EXP-2", shipment_id: S, deleted_at: ELIMINADO },
    ],
    supplier_bills: [
      { id: "c-viva", bill_code: "CXP-1", status: "pendiente", paid_amount: 0, shipment_id: S, deleted_at: null },
      { id: "c-anulada", bill_code: "CXP-2", status: "anulada", paid_amount: 0, shipment_id: S, deleted_at: null },
    ],
    tms_routes: [
      { id: "r-viva", route_code: "R-1", status: "planificado", shipment_id: S, deleted_at: null },
      { id: "r-cancelada", route_code: "R-2", status: "cancelado", shipment_id: S, deleted_at: null },
    ],
    consolidation_items: [
      { consolidation_id: "n-viva", shipment_id: S },
      { consolidation_id: "n-viva", shipment_id: S },
      { consolidation_id: "n-eliminada", shipment_id: S },
    ],
    consolidations: [
      { id: "n-viva", ref: "DTD-CONSOL-1", deleted_at: null },
      { id: "n-eliminada", ref: "DTD-CONSOL-2", deleted_at: ELIMINADO },
    ],
    warehouse_receipts_cn: [
      { id: "w-viva", receipt_code: "WR-1", shipment_id: S, deleted_at: null },
      { id: "w-eliminada", receipt_code: "WR-2", shipment_id: S, deleted_at: ELIMINADO },
    ],
    prealertas: [
      { id: "p-viva", code: "DTD-1-1-1", status: "en_camino", shipment_id: S, deleted_at: null },
      { id: "p-cancelada", code: "DTD-1-1-2", status: "cancelada", shipment_id: S, deleted_at: null },
    ],
  };
}

/** Envuelve el doble para que `tabla` (o la RPC) responda con error. */
function conFallo(client: SupabaseClient, tabla: string): SupabaseClient {
  const fallo = { data: null, error: { code: "XX000", message: "caída" }, count: null };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "is", "in"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(fallo).then(resolve);
  return {
    from: (t: string) => (t === tabla ? chain : client.from(t)),
    rpc: (fn: string, args: unknown) =>
      fn === tabla ? Promise.resolve(fallo) : (client.rpc as (f: string, a: unknown) => unknown)(fn, args),
  } as unknown as SupabaseClient;
}

describe("leerEntradaPlan · las listas con el predicado de cada guarda", () => {
  it("cada lista trae SÓLO lo que la 0476 cuenta, con su código", async () => {
    const { client } = dobleListados(store());
    const e = await leerEntradaPlan(client, S);

    expect(e.embarque).toEqual({ id: S, codigo: "S-2026-0042" });
    expect(e.facturas?.map((f) => f.id).sort()).toEqual(["f-borrador", "f-emitida"]);
    expect(e.facturas?.find((f) => f.id === "f-emitida")).toEqual({
      id: "f-emitida",
      codigo: "F-2026-0001",
      estado: "emitida",
      pagado: 0,
      asientoVivo: false,
    });
    expect(e.gastos).toEqual([{ id: "g-vivo", codigo: "EXP-1" }]);
    expect(e.cxp).toEqual([{ id: "c-viva", codigo: "CXP-1", estado: "pendiente", pagado: 0 }]);
    expect(e.rutas).toEqual([{ id: "r-viva", codigo: "R-1", estado: "planificado" }]);
    expect(e.consolidaciones).toEqual([{ id: "n-viva", codigo: "DTD-CONSOL-1" }]);
    expect(e.recepciones).toEqual([{ id: "w-viva", codigo: "WR-1" }]);
    expect(e.compras).toEqual([{ id: "p-viva", codigo: "DTD-1-1-1" }]);
  });

  it("con todo eso, el plan sale en curso y empieza por el Almacén CN", async () => {
    const { client } = dobleListados(store());
    const plan = await leerPlanDeBorrado(client, S);
    expect(plan.estado).toBe("en_curso");
    if (plan.estado === "en_curso") expect(plan.siguiente.clave).toBe("modulo:cn_receipts");
  });

  it("un asiento vivo de la factura la marca, y ya no bloquea a la emitida (SDD-0573)", async () => {
    const t = store();
    t.journal_entries.push({ id: "a-4", invoice_id: "f-emitida", status: "asentado", deleted_at: null });
    const { client } = dobleListados(t);
    const e = await leerEntradaPlan(client, S);
    expect(e.facturas?.find((f) => f.id === "f-emitida")?.asientoVivo).toBe(true);
    const plan = await leerPlanDeBorrado(dobleListados(t).client, S);
    expect(plan.estado).toBe("en_curso");
  });

  it("un asiento en borrador también es vivo (no anulado, no borrado)", async () => {
    const t = store();
    t.journal_entries.push({ id: "a-5", invoice_id: "f-borrador", status: "borrador", deleted_at: null });
    const e = await leerEntradaPlan(dobleListados(t).client, S);
    expect(e.facturas?.find((f) => f.id === "f-borrador")?.asientoVivo).toBe(true);
  });

  it("sólo lee lo que la base cuenta", async () => {
    const t = store();
    t.shipment_delete_blockers = [fila({ expenses: 1 })];
    const { client, filtros } = dobleListados(t);
    await leerEntradaPlan(client, S);
    expect([...new Set(filtros.map((f) => f.table))]).toEqual(["expenses"]);
  });
});

describe("leerEntradaPlan · falla cerrado", () => {
  it("si la RPC de la 0476 falla: no lee nada más y el plan no está disponible", async () => {
    const { client, filtros } = dobleListados(store());
    const plan = await leerPlanDeBorrado(conFallo(client, "shipment_delete_blockers"), S);
    expect(plan.estado).toBe("no_disponible");
    expect(filtros).toEqual([]);
  });

  it("si la fila no viene (otro tenant, inexistente): no_encontrado", async () => {
    const t = store();
    t.shipment_delete_blockers = [{ ...fila({}), shipment_id: OTRO }];
    expect((await leerPlanDeBorrado(dobleListados(t).client, S)).estado).toBe("no_encontrado");
  });

  it("si falla la lectura de asientos: no se sabe, y no se ofrece eliminar el borrador", async () => {
    const plan = await leerPlanDeBorrado(conFallo(dobleListados(store()).client, "journal_entries"), S);
    expect(plan.estado).toBe("bloqueado");
    if (plan.estado === "bloqueado") {
      // SDD-0573: la emitida se anula igual (anular revierte lo que haya); el
      // borrador, que el asistente elimina, no.
      expect(plan.bloqueos.map((b) => b.clave)).toEqual(["asiento_sin_comprobar:f-borrador"]);
    }
  });

  it.each(["invoices", "expenses", "supplier_bills", "tms_routes", "consolidation_items", "consolidations", "warehouse_receipts_cn", "prealertas"])(
    "si falla la lectura de %s: el plan se bloquea",
    async (tabla) => {
      const errores = vi.spyOn(console, "error").mockImplementation(() => {});
      const plan = await leerPlanDeBorrado(conFallo(dobleListados(store()).client, tabla), S);
      expect(plan.estado).toBe("bloqueado");
      // El error crudo va al log, con su origen.
      expect(errores.mock.calls.some((c) => String(c[0]).includes(tabla))).toBe(true);
      errores.mockRestore();
    },
  );

  it("una fila sin código no se inventa: la lista no vale", async () => {
    const t = store();
    t.expenses[0] = { ...t.expenses[0], expense_code: null };
    const e = await leerEntradaPlan(dobleListados(t).client, S);
    expect(e.gastos).toBeNull();
  });

  it("un `paid_amount` nulo cuenta como cobrado (NaN), no como cero", async () => {
    const t = store();
    t.invoices[1] = { ...t.invoices[1], paid_amount: null };
    const e = await leerEntradaPlan(dobleListados(t).client, S);
    expect(Number.isNaN(e.facturas?.find((f) => f.id === "f-emitida")?.pagado)).toBe(true);
  });
});

describe("control del doble: sin los filtros, la lista no cuadra y el plan se bloquea", () => {
  it("con todo «vivo» (sin `deleted_at`), sobran filas: bloqueado", async () => {
    const t = todoVivo(store());
    const plan = await leerPlanDeBorrado(dobleListados(t).client, S);
    expect(plan.estado).toBe("bloqueado");
    if (plan.estado === "bloqueado") {
      expect(plan.bloqueos.map((b) => b.clave)).toEqual(
        expect.arrayContaining(["sin_confirmar:invoices", "sin_confirmar:expenses", "sin_confirmar:cn_receipts"]),
      );
    }
  });

  it("los filtros que se aplicaron son los de las guardas", async () => {
    const { client, filtros } = dobleListados(store());
    await leerEntradaPlan(client, S);
    const de = (tabla: string) => filtros.filter((f) => f.table === tabla).map((f) => `${f.op}:${f.col}=${JSON.stringify(f.val)}`);
    expect(de("invoices")).toEqual([`eq:shipment_id="${S}"`, "is:deleted_at=null", 'neq:status="anulada"']);
    expect(de("journal_entries")).toEqual(['in:invoice_id=["f-borrador","f-emitida"]', 'neq:status="anulado"', "is:deleted_at=null"]);
    expect(de("supplier_bills")).toEqual([`eq:shipment_id="${S}"`, "is:deleted_at=null", 'neq:status="anulada"']);
    expect(de("tms_routes")).toEqual([`eq:shipment_id="${S}"`, "is:deleted_at=null", 'neq:status="cancelado"']);
    expect(de("prealertas")).toEqual([`eq:shipment_id="${S}"`, "is:deleted_at=null", 'neq:status="cancelada"']);
    expect(de("consolidations")).toEqual(['in:id=["n-viva","n-eliminada"]', "is:deleted_at=null"]);
  });
});
