/**
 * SDD-0558 · `getClientContext`: el saldo del panel del hilo sale de la
 * definición única (`client_outstanding`, 0492), por moneda y sin mezclar.
 *
 * Lo que se fija acá:
 *  - pide el saldo del cliente del hilo y NO lee facturas;
 *  - USD y VES salen por separado, sin sumar;
 *  - sin fila (ficha borrada o de otro tenant) no hay contexto;
 *  - con 42501 (el rol no ve el saldo) cae a la fachada de 0412 con el hilo:
 *    ve EXACTAMENTE lo de hoy, sin ampliar nada;
 *  - cualquier otro fallo deja el saldo en null, nunca en 0.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientContext } from "../conversations-queries";

type Rpc = { data: unknown; error: { message: string; code?: string } | null };

const FILA = {
  client_id: "client-1",
  markboxes: ["DTD-0001"],
  open_invoices: 1,
  overdue_amount: 0,
  overdue_invoices: 0,
  oldest_overdue_due_date: null,
  last_payment_on: null,
  as_of: "2026-10-19",
};

function stub(opts: {
  saldo?: Rpc;
  fachada?: Rpc;
  missingClient?: boolean;
} = {}) {
  const saldo: Rpc = opts.saldo ?? {
    data: [
      { ...FILA, currency: "USD", open_amount: "125.50" },
      { ...FILA, currency: "VES", open_amount: 900 },
      { ...FILA, currency: "USDT", open_amount: 0 },
    ],
    error: null,
  };
  const clientEq = vi.fn();
  const rpc = vi.fn((fn: string) => {
    if (fn === "client_outstanding") return Promise.resolve(saldo);
    if (fn === "conversation_client_outstanding") {
      const r = opts.fachada ?? { data: null, error: { message: "sin fachada" } };
      return { maybeSingle: async () => r };
    }
    throw new Error(`RPC no permitida: ${fn}`);
  });
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

describe("getClientContext · saldo único (SDD-0558)", () => {
  it("pide el saldo del cliente del hilo, por moneda, y no consulta facturas", async () => {
    const { client, rpc, from, clientEq } = stub();
    const result = await getClientContext(client, "client-1", "conversation-1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("client_outstanding", { p_client_ids: ["client-1"] });
    expect(clientEq).toHaveBeenCalledWith("id", "client-1");
    expect(from.mock.calls.map(([table]) => table)).toEqual(["clients", "shipments"]);
    expect(result?.outstanding).toEqual([
      { currency: "USD", amount: 125.5 },
      { currency: "VES", amount: 900 },
    ]);
    expect(result?.activeShipments).toEqual([
      { id: "ship-1", code: "DTD-1", status: "in_transit" },
    ]);
  });

  it("al día es una lista vacía, no un cero", async () => {
    const { client } = stub({ saldo: { data: [{ ...FILA, currency: null, open_amount: 0 }], error: null } });
    const result = await getClientContext(client, "client-1", "conversation-1");
    expect(result?.outstanding).toEqual([]);
  });

  it("sin fila (ficha borrada o de otro tenant) no hay contexto ni se consultan clientes", async () => {
    const { client, from } = stub({ saldo: { data: [], error: null } });
    expect(await getClientContext(client, "client-1", "conversation-1")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("⭐ con 42501 cae a la fachada de 0412 con el hilo: lo mismo que ve hoy", async () => {
    const { client, rpc } = stub({
      saldo: { data: null, error: { message: "CLIENT_OUTSTANDING_FORBIDDEN", code: "42501" } },
      fachada: { data: { client_id: "client-1", balance: "40.00", currency: "VES" }, error: null },
    });
    const result = await getClientContext(client, "client-1", "conversation-1");
    expect(rpc).toHaveBeenCalledWith("conversation_client_outstanding", {
      p_conversation_id: "conversation-1",
    });
    expect(result?.outstanding).toEqual([{ currency: "VES", amount: 40 }]);
    expect(result?.markbox).toBe("DTD-0001");
  });

  it("con 42501 y la fachada caída, el saldo queda en null (no en 0)", async () => {
    const { client } = stub({
      saldo: { data: null, error: { message: "no", code: "42501" } },
      fachada: { data: null, error: { message: "Acceso no autorizado", code: "42501" } },
    });
    const result = await getClientContext(client, "client-1", "conversation-1");
    expect(result?.outstanding).toBeNull();
  });

  it("la fachada que responde por otro cliente no se publica", async () => {
    const { client } = stub({
      saldo: { data: null, error: { message: "no", code: "42501" } },
      fachada: { data: { client_id: "otro", balance: "40", currency: "USD" }, error: null },
    });
    expect((await getClientContext(client, "client-1", "conversation-1"))?.outstanding).toBeNull();
  });

  it("otro fallo deja el contexto SIN saldo (null) y no cae a la fachada", async () => {
    const { client, rpc } = stub({ saldo: { data: null, error: { message: "timeout", code: "57014" } } });
    const result = await getClientContext(client, "client-1", "conversation-1");
    expect(result?.outstanding).toBeNull();
    expect(result?.client_name).toBe("Cliente");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rechaza un saldo no numérico en lugar de publicarlo como cero", async () => {
    const { client } = stub({
      saldo: { data: [{ ...FILA, currency: "USD", open_amount: "NaN" }], error: null },
    });
    expect((await getClientContext(client, "client-1", "conversation-1"))?.outstanding).toBeNull();
  });

  it("si RLS ya no permite el cliente, no muestra el contexto", async () => {
    const { client, from } = stub({ missingClient: true });
    expect(await getClientContext(client, "client-1", "conversation-1")).toBeNull();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["clients"]);
  });
});
