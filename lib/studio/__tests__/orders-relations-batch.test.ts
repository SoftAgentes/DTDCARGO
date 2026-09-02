import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listPurchaseOrderItemsByOrder } from "../purchase-orders/queries";
import {
  listInvoicesBySalesOrder,
  listPrealertasBySalesOrder,
} from "../sales-orders/queries";

type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

function makeClient(rowsByTable: Record<string, Record<string, unknown>[]>) {
  const calls: QueryCall[] = [];
  const client = {
    from: vi.fn((table: string) => {
      let inColumn: string | null = null;
      let inValues: unknown[] = [];
      const chain: Record<string, unknown> = {};

      for (const method of ["select", "is", "order"]) {
        chain[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return chain;
        };
      }
      chain.in = (column: string, values: unknown[]) => {
        calls.push({ table, method: "in", args: [column, values] });
        inColumn = column;
        inValues = values;
        return chain;
      };
      chain.range = (from: number, to: number) => {
        calls.push({ table, method: "range", args: [from, to] });
        const matching = (rowsByTable[table] ?? []).filter(
          (row) => !inColumn || inValues.includes(row[inColumn]),
        );
        return Promise.resolve({ data: matching.slice(from, to + 1), error: null });
      };

      return chain;
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("relaciones de órdenes en lote", () => {
  it("agrupa los ítems de compra con el conjunto completo de ids en cada página", async () => {
    const { client, calls } = makeClient({
      purchase_order_items: [
        {
          id: "item-1",
          tenant_id: "tenant-1",
          purchase_order_id: "po-1",
          description: "Caja",
          qty: "2",
          unit_cost_usd: "12.5",
          position: 1,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "item-2",
          tenant_id: "tenant-1",
          purchase_order_id: "po-2",
          description: "Flete",
          qty: 1,
          unit_cost_usd: 20,
          position: 1,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
    });

    const grouped = await listPurchaseOrderItemsByOrder(client, ["po-1", "po-2"]);

    expect(grouped["po-1"]).toMatchObject([
      { id: "item-1", qty: 2, unit_cost_usd: 12.5 },
    ]);
    expect(grouped["po-2"]).toMatchObject([{ id: "item-2" }]);
    const filters = calls.filter(
      (call) => call.table === "purchase_order_items" && call.method === "in",
    );
    expect(filters).toHaveLength(2); // página con datos + página vacía terminal
    expect(filters.every((call) => call.args[0] === "purchase_order_id")).toBe(true);
    for (const filter of filters) {
      expect(filter.args[1]).toEqual(expect.arrayContaining(["po-1", "po-2"]));
    }
  });

  it("agrupa prealertas y facturas de venta sin una consulta por orden", async () => {
    const { client, calls } = makeClient({
      prealertas: [
        {
          id: "pre-1",
          tenant_id: "tenant-1",
          client_markbox: "DTD-0001",
          code: "DTD-0001-1-1",
          description: "Compra",
          boxes: 1,
          status: "anunciada",
          sales_order_id: "so-1",
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      invoices: [
        {
          id: "inv-1",
          sales_order_id: "so-2",
          invoice_code: "FAC-0001",
          total_amount: "125.50",
          status: "emitida",
          issued_at: "2026-09-01",
          created_at: "2026-09-01T00:00:00Z",
        },
      ],
    });

    const [prealertas, invoices] = await Promise.all([
      listPrealertasBySalesOrder(client, ["so-1", "so-2"]),
      listInvoicesBySalesOrder(client, ["so-1", "so-2"]),
    ]);

    expect(prealertas["so-1"][0]).toMatchObject({
      id: "pre-1",
      sales_order_id: "so-1",
    });
    expect(prealertas["so-2"]).toEqual([]);
    expect(invoices["so-1"]).toEqual([]);
    expect(invoices["so-2"][0]).toMatchObject({
      id: "inv-1",
      total_amount: 125.5,
    });

    for (const table of ["prealertas", "invoices"]) {
      const filters = calls.filter(
        (call) => call.table === table && call.method === "in",
      );
      expect(filters).toHaveLength(2); // datos + terminación, independiente de N órdenes
      expect(filters.every((call) => call.args[0] === "sales_order_id")).toBe(true);
      for (const filter of filters) {
        expect(filter.args[1]).toEqual(expect.arrayContaining(["so-1", "so-2"]));
      }
    }
  });

  it("las páginas de listado consumen los helpers batch y no mapean queries por orden", () => {
    const purchasePage = readFileSync(
      resolve(process.cwd(), "app/studio/(app)/ordenes-compra/page.tsx"),
      "utf8",
    );
    const salesPage = readFileSync(
      resolve(process.cwd(), "app/studio/(app)/ordenes-venta/page.tsx"),
      "utf8",
    );

    expect(purchasePage).toContain("listPurchaseOrderItemsByOrder");
    expect(purchasePage).not.toMatch(/orders\.map\(async/);
    expect(salesPage).toContain("listPrealertasBySalesOrder");
    expect(salesPage).toContain("listInvoicesBySalesOrder");
    expect(salesPage).not.toMatch(/orders\.map\(async/);
  });
});
