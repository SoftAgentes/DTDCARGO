// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  listInvoicesBySalesOrder,
  listInvoicesForSalesOrder,
} from "../sales-orders/queries";

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

function makeClient(rowsByTable: Record<string, Record<string, unknown>[]>, rpcError?: string) {
  const calls: QueryCall[] = [];
  const client = {
    from: vi.fn((table: string) => {
      calls.push({ table, method: "from", args: [] });
      throw new Error(`Lectura directa no permitida: ${table}`);
    }),
    rpc: vi.fn((fn: string, args: { p_sales_order_ids: string[] }) => {
      calls.push({ table: fn, method: "rpc", args: [args] });
      const chain: Record<string, unknown> = {};
      chain.order = (...orderArgs: unknown[]) => {
        calls.push({ table: fn, method: "order", args: orderArgs });
        return chain;
      };
      chain.range = (from: number, to: number) => {
        calls.push({ table: fn, method: "range", args: [from, to] });
        const matching = (rowsByTable[fn] ?? []).filter((row) =>
          args.p_sales_order_ids.includes(String(row.sales_order_id)),
        );
        return Promise.resolve({
          data: matching.slice(from, to + 1),
          error: rpcError ? { message: rpcError } : null,
        });
      };
      return chain;
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("referencias de facturas por orden de venta (SDD-0356)", () => {
  it("agrupa las facturas de venta con la RPC mínima, sin una consulta por orden", async () => {
    const { client, calls } = makeClient({
      sales_order_invoice_refs: [
        {
          id: "inv-1",
          sales_order_id: "so-2",
          invoice_code: "FAC-0001",
          total_amount: "125.50",
          status: "emitida",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    });

    const invoices = await listInvoicesBySalesOrder(client, ["so-1", "so-2"]);

    expect(invoices["so-1"]).toEqual([]);
    expect(invoices["so-2"][0]).toMatchObject({
      id: "inv-1",
      total_amount: 125.5,
    });

    const rpcCalls = calls.filter((call) => call.method === "rpc");
    expect(rpcCalls).toHaveLength(2); // página con datos + página vacía terminal
    for (const call of rpcCalls) {
      expect(call.table).toBe("sales_order_invoice_refs");
      expect(call.args).toEqual([{ p_sales_order_ids: ["so-1", "so-2"] }]);
    }
    expect(calls.some((call) => call.table === "invoices")).toBe(false);
    expect(invoices["so-2"][0]).not.toHaveProperty("created_at");
    expect(invoices["so-2"][0]).not.toHaveProperty("issued_at");
  });

  it("el helper de una orden delega en la misma RPC", async () => {
    const { client, calls } = makeClient({
      sales_order_invoice_refs: [
        {
          id: "inv-2",
          sales_order_id: "so-9",
          invoice_code: "FAC-0002",
          total_amount: 80,
          status: "borrador",
          created_at: "2026-09-02T00:00:00Z",
        },
      ],
    });

    expect(await listInvoicesForSalesOrder(client, "so-9")).toEqual([
      { id: "inv-2", invoice_code: "FAC-0002", total_amount: 80, status: "borrador" },
    ]);
    expect(calls.some((call) => call.method === "from")).toBe(false);
  });

  it("un error de la RPC no se convierte en una lista vacía de facturas", async () => {
    const { client } = makeClient({}, "No autorizado");
    await expect(listInvoicesBySalesOrder(client, ["so-1"])).rejects.toThrow("No autorizado");
    await expect(listInvoicesForSalesOrder(client, "so-1")).rejects.toThrow("No autorizado");
  });

  it("sin órdenes no consulta la RPC", async () => {
    const { client, calls } = makeClient({});
    expect(await listInvoicesBySalesOrder(client, [])).toEqual({});
    expect(calls).toEqual([]);
  });
});
