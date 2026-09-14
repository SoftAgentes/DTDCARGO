import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "../conversations-queries";

function stub(opts: {
  context?: { client_id: string; balance: number | string; currency: string } | null;
  error?: { message: string } | null;
  missingClient?: boolean;
} = {}) {
  const context = opts.context === undefined
    ? { client_id: "client-1", balance: "125.50", currency: "USD" }
    : opts.context;
  const clientEq = vi.fn();
  const rpc = vi.fn(() => ({
    maybeSingle: async () => ({ data: context, error: opts.error ?? null }),
  }));
  const from = vi.fn((table: string) => {
    if (table === "clients") {
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          clientEq(key, value);
          return chain;
        },
        is: () => chain,
        maybeSingle: async () => ({
          data: opts.missingClient ? null : {
            id: "client-1", markbox: "DTD-0001", name: "Cliente",
            email: null, phone: null,
          },
          error: null,
        }),
      };
      return chain;
    }
    if (table === "shipments") {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [
            { id: "ship-1", code: "DTD-1", status: "in_transit" },
            { id: "ship-2", code: "DTD-2", status: "delivered" },
          ],
          error: null,
        }),
      };
      return chain;
    }
    throw new Error(`Lectura no permitida en el contexto: ${table}`);
  });
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, clientEq };
}

describe("getClientContext · fachada de saldo", () => {
  it("deriva el cliente desde el hilo y no consulta facturas individuales", async () => {
    const { client, rpc, from, clientEq } = stub();
    const result = await getClientContext(client, "conversation-1");
    expect(rpc).toHaveBeenCalledWith("conversation_client_outstanding", {
      p_conversation_id: "conversation-1",
    });
    expect(clientEq).toHaveBeenCalledWith("id", "client-1");
    expect(from.mock.calls.map(([table]) => table)).toEqual(["clients", "shipments"]);
    expect(result?.outstandingBalance).toBe(125.5);
    expect(result?.outstandingCurrency).toBe("USD");
    expect(result?.activeShipments).toEqual([
      { id: "ship-1", code: "DTD-1", status: "in_transit" },
    ]);
  });

  it("un error de la RPC oculta el contexto sin asumir saldo cero", async () => {
    const { client, from } = stub({ error: { message: "not authorized" } });
    expect(await getClientContext(client, "conversation-1")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("un hilo no autorizado no consulta clientes ni envíos", async () => {
    const { client, from } = stub({ context: null });
    expect(await getClientContext(client, "conversation-1")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rechaza un saldo no numérico en lugar de publicarlo como cero", async () => {
    const { client, from } = stub({
      context: { client_id: "client-1", balance: "NaN", currency: "USD" },
    });
    expect(await getClientContext(client, "conversation-1")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("si RLS ya no permite el cliente, no muestra el contexto", async () => {
    const { client, from } = stub({ missingClient: true });
    expect(await getClientContext(client, "conversation-1")).toBeNull();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["clients"]);
  });
});
