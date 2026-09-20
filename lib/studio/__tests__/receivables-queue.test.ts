/**
 * SDD-0465 · `receivablesQueue` no cobra ni recuerda una factura borrada.
 *
 * `payment.test.ts` cubre la capa pura (`buildReceivablesQueue`). Acá se prueba
 * el LECTOR: lo que pide a la base y lo que deja entrar a la cola. Importa
 * porque esta cola alimenta la pantalla de Cobranzas, el export operativo y
 * los recordatorios por correo (SDD-0306): lo que entra acá se cobra y se le
 * escribe al cliente.
 *
 * El doble APLICA `is("deleted_at", null)` sobre las filas, como PostgREST: si
 * el lector deja de pedirlo, la factura borrada del fixture entra a la cola
 * (con más días vencidos que la viva, así que subiría al tope) y la aserción
 * lo delata.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Invoice } from "../invoice-types";
import { collectionKpis, receivablesQueue } from "../payment-queries";
import {
  intersectarPedido,
  seleccionarParaRecordatorio,
  type ContextoEnvio,
} from "../collections/recordatorios";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

const TODAY = "2026-06-01";

function inv(partial: Partial<Invoice> & { id: string }): Invoice {
  return {
    tenant_id: "t1",
    invoice_code: "F-2026-0001",
    client_markbox: "DTD-1001",
    client_name: "Cliente Demo",
    client_rif: null,
    client_doc_kind: null,
    shipment_id: null,
    shipment_code: null,
    currency: "USD",
    fx_rate: null,
    iva_rate: 0,
    iva_mode: null,
    base_amount: 0,
    iva_amount: 0,
    total_amount: 1000,
    status: "emitida",
    issued_at: "2026-04-01",
    due_date: "2026-05-01",
    paid_amount: 0,
    last_payment_at: null,
    lines: [],
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  };
}

/** Viva: vencida 31 días, saldo 1000. */
const VIVA = inv({
  id: "i-viva",
  invoice_code: "F-2026-0001",
  client_markbox: "DTD-1001",
  due_date: "2026-05-01",
  total_amount: 1000,
});

/** Borrada: vencida 61 días, saldo 9000 — sin el filtro subiría al tope. */
const BORRADA = inv({
  id: "i-borrada",
  invoice_code: "F-2026-0002",
  client_markbox: "DTD-1002",
  due_date: "2026-04-01",
  total_amount: 9000,
  deleted_at: "2026-05-15T00:00:00Z",
});

/** Filtros que el doble vio, por tabla (para afirmar sobre ellos). */
let filtros: { table: string; op: string; col: string; val: unknown }[] = [];

beforeEach(() => {
  filtros = [];
});

function stub(
  tablas: Record<string, Record<string, unknown>[]>,
): SupabaseClient {
  return {
    from(table: string) {
      let visibles = tablas[table] ?? [];
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        is(col: string, val: unknown) {
          filtros.push({ table, op: "is", col, val });
          if (val === null) visibles = visibles.filter((r) => r[col] == null);
          return chain;
        },
        neq(col: string, val: unknown) {
          filtros.push({ table, op: "neq", col, val });
          visibles = visibles.filter((r) => r[col] !== val);
          return chain;
        },
        in(col: string, vals: unknown[]) {
          filtros.push({ table, op: "in", col, val: vals });
          visibles = visibles.filter((r) => vals.includes(r[col]));
          return chain;
        },
        order() {
          return chain;
        },
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST.
        range(desde: number, hasta: number) {
          const pedido = hasta - desde + 1;
          const trozo = visibles.slice(desde, desde + Math.min(pedido, SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const TABLAS = {
  invoices: [VIVA, BORRADA] as unknown as Record<string, unknown>[],
  collection_activities: [
    // Una gestión sobre la borrada: tampoco debe leerse (no hay fila que enriquecer).
    {
      id: "a1",
      tenant_id: "t1",
      invoice_id: "i-borrada",
      kind: "contacto",
      promised_amount: null,
      promised_date: null,
      next_followup: null,
      body: null,
      created_at: "2026-05-20T10:00:00Z",
      created_by: null,
    },
  ],
};

describe("receivablesQueue · SDD-0465", () => {
  it("excluye la borrada aunque tenga saldo y esté más vencida que la viva", async () => {
    const cola = await receivablesQueue(stub(TABLAS), TODAY);

    expect(cola.map((r) => r.invoice.invoice_code)).toEqual(["F-2026-0001"]);
    expect(cola[0].balance).toBe(1000);
    expect(cola[0].daysOverdue).toBe(31);
  });

  it("pide `deleted_at is null` a la base, además de `status ≠ anulada`", async () => {
    await receivablesQueue(stub(TABLAS), TODAY);

    expect(filtros).toContainEqual({ table: "invoices", op: "is", col: "deleted_at", val: null });
    expect(filtros).toContainEqual({ table: "invoices", op: "neq", col: "status", val: "anulada" });
  });

  it("no consulta las gestiones de la borrada", async () => {
    await receivablesQueue(stub(TABLAS), TODAY);

    const lotes = filtros.filter((f) => f.table === "collection_activities" && f.op === "in");
    expect(lotes.length).toBeGreaterThan(0);
    for (const lote of lotes) {
      expect(lote.val).toEqual(["i-viva"]);
    }
  });

  it("collectionKpis no la cuenta como caso ni como saldo", async () => {
    const kpis = await collectionKpis(stub(TABLAS), TODAY);

    expect(kpis.casos).toBe(1);
    expect(kpis.porCobrar).toBe(1000);
    expect(kpis.vencido).toBe(1000);
  });

  it("sin el filtro la borrada iría PRIMERA (control del doble)", async () => {
    // Prueba del propio fixture: si la borrada entrara, quedaría al tope por
    // 61 días vencidos. Así se sabe que la exclusión de arriba no es casualidad.
    const sinFiltro = stub({
      ...TABLAS,
      invoices: [VIVA, { ...BORRADA, deleted_at: null }] as unknown as Record<string, unknown>[],
    });
    const cola = await receivablesQueue(sinFiltro, TODAY);
    expect(cola.map((r) => r.invoice.invoice_code)).toEqual(["F-2026-0002", "F-2026-0001"]);
  });
});

describe("recordatorio de cobranza (SDD-0306) sobre la cola · SDD-0465", () => {
  function ctx(over: Partial<ContextoEnvio> = {}): ContextoEnvio {
    return {
      // Los dos clientes tienen correo: la borrada NO queda fuera por "sin correo",
      // queda fuera porque no existe para la cola.
      conCorreo: new Set(["DTD-1001", "DTD-1002"]),
      marcaronSpam: new Set<string>(),
      ultimoRecordatorio: new Map<string, string>(),
      ...over,
    };
  }

  it("el recordatorio no sale para una factura borrada: ni se envía ni aparece como omitida", async () => {
    const cola = await receivablesQueue(stub(TABLAS), TODAY);
    const sel = seleccionarParaRecordatorio(cola, TODAY, ctx());

    expect(sel.aEnviar.map((r) => r.invoice.invoice_code)).toEqual(["F-2026-0001"]);
    expect(sel.omitidos).toEqual([]);
  });

  it("aunque el navegador pida su código, la intersección con el servidor la descarta", async () => {
    const cola = await receivablesQueue(stub(TABLAS), TODAY);
    const { aEnviar } = seleccionarParaRecordatorio(cola, TODAY, ctx());

    expect(intersectarPedido(aEnviar, ["F-2026-0002"])).toEqual([]);
    expect(intersectarPedido(aEnviar, ["F-2026-0001", "F-2026-0002"]).map((r) => r.invoice.invoice_code)).toEqual([
      "F-2026-0001",
    ]);
  });
});
