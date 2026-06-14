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
  buildMarkboxPatchPayload,
  buildPricePatchPayload,
  buildStagePatchPayload,
  enqueueKommoMarkboxWriteback,
  enqueueKommoStageWriteback,
  enqueueKommoWriteback,
  normalizeStageMap,
} from "../kommo-writeback";

type StubCfg = {
  clients?: { kommo_lead_id: number | null } | null;
  kommo_leads?: { kommo_updated_at: string | null } | null;
  kommo_connections?: { stage_map?: unknown; markbox_field_id?: number | null } | null;
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

describe("buildStagePatchPayload", () => {
  it("arma { status_id, pipeline_id }", () => {
    expect(buildStagePatchPayload({ pipeline_id: 10, status_id: 20 })).toEqual({
      status_id: 20,
      pipeline_id: 10,
    });
  });
  it("trunca a entero (jsonb podría traer floats)", () => {
    expect(
      buildStagePatchPayload({ pipeline_id: 10.9, status_id: 20.2 }),
    ).toEqual({ status_id: 20, pipeline_id: 10 });
  });
});

describe("normalizeStageMap", () => {
  it("conserva solo claves válidas con destino entero > 0", () => {
    const raw = {
      sent: { pipeline_id: 1, status_id: 2 },
      accepted: { pipeline_id: 0, status_id: 9 }, // pipeline inválido
      rejected: { pipeline_id: 3, status_id: 0 }, // status inválido
      bogus: { pipeline_id: 5, status_id: 6 }, // clave fuera del enum
    };
    expect(normalizeStageMap(raw)).toEqual({
      sent: { pipeline_id: 1, status_id: 2 },
    });
  });
  it("null / no-objeto → {}", () => {
    expect(normalizeStageMap(null)).toEqual({});
    expect(normalizeStageMap("x")).toEqual({});
    expect(normalizeStageMap(undefined)).toEqual({});
  });
});

describe("enqueueKommoStageWriteback", () => {
  it("estado sin mapear → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: {
        stage_map: { accepted: { pipeline_id: 1, status_id: 2 } },
      },
      clients: { kommo_lead_id: 99 },
    });
    const r = await enqueueKommoStageWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      estimateStatus: "sent", // no está en el mapa
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("sin markbox → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: {
        stage_map: { sent: { pipeline_id: 1, status_id: 2 } },
      },
    });
    const r = await enqueueKommoStageWriteback(stub, "t1", {
      clientMarkbox: null,
      estimateStatus: "sent",
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("mapeado pero cliente sin lead → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: {
        stage_map: { sent: { pipeline_id: 1, status_id: 2 } },
      },
      clients: { kommo_lead_id: null },
    });
    const r = await enqueueKommoStageWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      estimateStatus: "sent",
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("mapeado + lead → encola patch_stage con {status_id, pipeline_id}", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: {
        stage_map: { rejected: { pipeline_id: 7, status_id: 143 } },
      },
      clients: { kommo_lead_id: 12345 },
      kommo_leads: { kommo_updated_at: "2026-06-14T00:00:00Z" },
      rpcData: "outbox-7",
    });
    const r = await enqueueKommoStageWriteback(stub, "t1", {
      clientMarkbox: "DTD-0001",
      estimateStatus: "rejected",
    });
    expect(r).toBe("outbox-7");
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].name).toBe("enqueue_kommo_writeback");
    expect(calls.rpc[0].args).toMatchObject({
      p_tenant_id: "t1",
      p_kommo_lead_id: 12345,
      p_op: "patch_stage",
      p_payload: { status_id: 143, pipeline_id: 7 },
      p_kommo_updated_at: "2026-06-14T00:00:00Z",
    });
  });
});

describe("buildMarkboxPatchPayload", () => {
  it("arma custom_fields_values con field_id + value", () => {
    expect(buildMarkboxPatchPayload(555, "DTD-1234")).toEqual({
      custom_fields_values: [{ field_id: 555, values: [{ value: "DTD-1234" }] }],
    });
  });
});

describe("enqueueKommoMarkboxWriteback", () => {
  it("sin campo configurado → null y NO llama al RPC", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: { markbox_field_id: null },
    });
    const r = await enqueueKommoMarkboxWriteback(stub, "t1", {
      leadId: 12345,
      markbox: "DTD-0001",
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("sin markbox → null y NO llama al RPC (ni lee la conexión)", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: { markbox_field_id: 555 },
    });
    const r = await enqueueKommoMarkboxWriteback(stub, "t1", {
      leadId: 12345,
      markbox: "",
    });
    expect(r).toBeNull();
    expect(calls.rpc).toHaveLength(0);
  });

  it("campo + markbox → encola patch_lead con custom_fields_values", async () => {
    const { stub, calls } = makeStub({
      kommo_connections: { markbox_field_id: 555 },
      kommo_leads: { kommo_updated_at: "2026-06-14T00:00:00Z" },
      rpcData: "outbox-mb",
    });
    const r = await enqueueKommoMarkboxWriteback(stub, "t1", {
      leadId: 12345,
      markbox: "DTD-0007",
    });
    expect(r).toBe("outbox-mb");
    expect(calls.rpc).toHaveLength(1);
    expect(calls.rpc[0].name).toBe("enqueue_kommo_writeback");
    expect(calls.rpc[0].args).toMatchObject({
      p_tenant_id: "t1",
      p_kommo_lead_id: 12345,
      p_op: "patch_lead",
      p_payload: {
        custom_fields_values: [{ field_id: 555, values: [{ value: "DTD-0007" }] }],
      },
      p_kommo_updated_at: "2026-06-14T00:00:00Z",
    });
  });
});
