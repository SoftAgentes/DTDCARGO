/**
 * Tests del write-back ERP→Kommo lado encola (SDD-0083 · SDD-0062 A+B).
 *
 * Stub mínimo del SupabaseClient: `from(table).…​.maybeSingle()` devuelve el valor
 * configurado por tabla; `rpc()` captura los args. Cubre: builder puro del payload,
 * resolución del lead por markbox, y el best-effort (no-markbox / sin-lead → null
 * sin tocar el RPC).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPricePatchPayload,
  enqueueKommoWriteback,
} from "../kommo-writeback";

type StubCfg = {
  clients?: { kommo_lead_id: number | null } | null;
  kommo_leads?: { kommo_updated_at: string | null } | null;
  rpcData?: string | null;
  rpcError?: { message: string } | null;
};

function makeStub(cfg: StubCfg) {
  const calls: { rpc: { name: string; args: Record<string, unknown> }[] } = {
    rpc: [],
  };
  const chain = (table: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {
      select: () => c,
      eq: () => c,
      is: () => c,
      maybeSingle: async () => ({
        data: (cfg as Record<string, unknown>)[table] ?? null,
        error: null,
      }),
    };
    return c;
  };
  const stub = {
    from: (table: string) => chain(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc.push({ name, args });
      return { data: cfg.rpcData ?? "outbox-1", error: cfg.rpcError ?? null };
    },
  };
  return { stub: stub as unknown as SupabaseClient, calls };
}

describe("buildPricePatchPayload", () => {
  it("redondea el total y arma { price }", () => {
    expect(buildPricePatchPayload(3500.4)).toEqual({ price: 3500 });
    expect(buildPricePatchPayload(3500.6)).toEqual({ price: 3501 });
  });
  it("no finito / null / ≤0 → 0", () => {
    expect(buildPricePatchPayload(null)).toEqual({ price: 0 });
    expect(buildPricePatchPayload(undefined)).toEqual({ price: 0 });
    expect(buildPricePatchPayload(-5)).toEqual({ price: 0 });
    expect(buildPricePatchPayload(0)).toEqual({ price: 0 });
  });
});

describe("enqueueKommoWriteback", () => {
  it("sin markbox → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({});
    const r = await enqueueKommoWriteback(stub, "t1", {
      clientMarkbox: null,
      totalUsd: 1000,
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("cliente sin kommo_lead_id → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({ clients: { kommo_lead_id: null } });
    const r = await enqueueKommoWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      totalUsd: 1000,
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("lead vinculado → encola patch_price con el total redondeado", async () => {
    const { stub, calls } = makeStub({
      clients: { kommo_lead_id: 12345 },
      kommo_leads: { kommo_updated_at: "2026-06-14T00:00:00Z" },
      rpcData: "outbox-99",
    });
    const r = await enqueueKommoWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      totalUsd: 3500.6,
    });
    expect(r).toBe("outbox-99");
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].name).toBe("enqueue_kommo_writeback");
    expect(calls.rpc[0].args).toMatchObject({
      p_tenant_id: "t1",
      p_kommo_lead_id: 12345,
      p_op: "patch_price",
      p_payload: { price: 3501 },
      p_kommo_updated_at: "2026-06-14T00:00:00Z",
    });
  });

  it("error del RPC → null (best-effort, no tira)", async () => {
    const { stub } = makeStub({
      clients: { kommo_lead_id: 1 },
      rpcError: { message: "boom" },
    });
    const r = await enqueueKommoWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      totalUsd: 100,
    });
    expect(r).toBeNull();
  });
});
