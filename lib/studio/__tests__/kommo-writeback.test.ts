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
  buildNotePayload,
  buildOwnerPatchPayload,
  buildTagsPatchPayload,
  buildTaskPayload,
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

describe("buildOwnerPatchPayload", () => {
  it("id válido → payload de reasignación", () => {
    expect(buildOwnerPatchPayload(9976747)).toEqual({ responsible_user_id: 9976747 });
  });

  it("null si el id no sirve — mejor no encolar que reasignar a nadie", () => {
    for (const malo of [null, undefined, 0, -3, 1.5, NaN, "abc" as unknown as number]) {
      expect(buildOwnerPatchPayload(malo)).toBeNull();
    }
  });
});

describe("buildTagsPatchPayload", () => {
  it("usa tags_to_add/delete (incrementales), no _embedded.tags", () => {
    // Reemplazar _embedded.tags borraría las etiquetas que puso el asesor.
    const p = buildTagsPatchPayload({ add: ["VIP"], remove: ["frío"] });
    expect(p).toEqual({
      tags_to_add: [{ name: "VIP" }],
      tags_to_delete: [{ name: "frío" }],
    });
    expect(JSON.stringify(p)).not.toContain("_embedded");
  });

  it("recorta, descarta vacíos y deduplica sin distinguir mayúsculas", () => {
    expect(buildTagsPatchPayload({ add: ["  vip ", "VIP", "", "   ", "vip"] })).toEqual({
      tags_to_add: [{ name: "vip" }],
    });
  });

  it("si una etiqueta está en las dos listas, gana QUITAR", () => {
    // La intención destructiva es la explícita: si el asesor la marcó para
    // sacar, no se la volvemos a poner en el mismo PATCH.
    expect(buildTagsPatchPayload({ add: ["vip"], remove: ["VIP"] })).toEqual({
      tags_to_delete: [{ name: "VIP" }],
    });
  });

  it("nada que hacer → null (no se encola una orden vacía)", () => {
    expect(buildTagsPatchPayload({})).toBeNull();
    expect(buildTagsPatchPayload({ add: [], remove: [] })).toBeNull();
    expect(buildTagsPatchPayload({ add: ["  ", ""] })).toBeNull();
  });

  it("omite la clave que no aplica en vez de mandarla vacía", () => {
    expect(buildTagsPatchPayload({ add: ["a"] })).toEqual({ tags_to_add: [{ name: "a" }] });
    expect(buildTagsPatchPayload({ remove: ["b"] })).toEqual({ tags_to_delete: [{ name: "b" }] });
  });
});

// ── Fase 5 · los payloads que CREAN algo en Kommo (POST) ────────────────────
//
// MUTACIÓN QUE LOS VALIDA:
//   1. `buildTaskPayload` con `Math.floor(ms)` en vez de `Math.floor(ms / 1000)`
//      — el error de unidad clásico. Se pone rojo el caso del epoch.
//   2. `buildNotePayload` devolviendo `{ text }` suelto en vez de envuelto en
//      `params`. Se pone rojo el primero.
// Las dos se corrieron y las dos salieron rojas.
describe("buildNotePayload", () => {
  it("el texto va envuelto en params — Kommo lo ignora si va suelto", () => {
    expect(buildNotePayload("  Llamé, no contestó  ")).toEqual({
      note_type: "common",
      params: { text: "Llamé, no contestó" },
    });
  });

  it("una nota vacía no se encola: mejor nada que una nota en blanco en el CRM", () => {
    expect(buildNotePayload("   ")).toBeNull();
    expect(buildNotePayload("")).toBeNull();
  });
});

describe("buildTaskPayload", () => {
  const BASE = {
    leadId: 4242,
    texto: "Volver a llamar",
    completeTillIso: "2026-08-20T15:00:00.000Z",
  };

  it("complete_till va en SEGUNDOS y el lead viaja en el cuerpo", () => {
    expect(buildTaskPayload(BASE)).toEqual({
      text: "Volver a llamar",
      complete_till: Date.UTC(2026, 7, 20, 15, 0, 0) / 1000,
      entity_id: 4242,
      entity_type: "leads",
    });
  });

  it("⭐ el epoch tiene 10 dígitos, no 13: en ms la tarjeta NUNCA se pone roja", () => {
    // El vencimiento en milisegundos cae en el año 57.000. Kommo lo acepta sin
    // chistar y la tarea deja de ser un semáforo — falla en la dirección que
    // nadie mira.
    const p = buildTaskPayload(BASE) as { complete_till: number };
    expect(String(p.complete_till)).toHaveLength(10);
    expect(new Date(p.complete_till * 1000).getUTCFullYear()).toBe(2026);
  });

  it("el responsable se omite si no es un id válido", () => {
    expect(buildTaskPayload({ ...BASE, responsibleUserId: 0 })).not.toHaveProperty(
      "responsible_user_id",
    );
    expect(buildTaskPayload({ ...BASE, responsibleUserId: null })).not.toHaveProperty(
      "responsible_user_id",
    );
    expect(buildTaskPayload({ ...BASE, responsibleUserId: 99 })).toHaveProperty(
      "responsible_user_id",
      99,
    );
  });

  it("sin texto, sin lead o sin fecha legible no se encola nada", () => {
    expect(buildTaskPayload({ ...BASE, texto: "  " })).toBeNull();
    expect(buildTaskPayload({ ...BASE, leadId: 0 })).toBeNull();
    expect(buildTaskPayload({ ...BASE, completeTillIso: "mañana" })).toBeNull();
  });
});

/**
 * Resolución por código JUBILADO (SDD-0258).
 *
 * ⚠️ El fallo que esto cierra NO se veía: con un código retirado, el lookup
 * directo devolvía null y el write-back se descartaba en silencio — un mensaje
 * al CRM que nunca sale. Con 523 códigos jubilados en producción dejó de ser
 * hipotético.
 *
 * Stub propio, con dos cosas que el de arriba no distingue: de qué columna se
 * consultó `clients` (markbox vs id) y qué RPC se llamó. Sin eso no se puede
 * comprobar lo más importante — que el camino directo NO paga el desvío.
 */
function makeStubJubilado(cfg: {
  porMarkbox: { kommo_lead_id: number | null } | null;
  resolve: { client_id: string; canonical_markbox: string }[] | null;
  porId?: { kommo_lead_id: number | null } | null;
}) {
  const calls = {
    rpc: [] as string[],
    clientsPor: [] as string[],
  };
  const chain = (table: string): Record<string, unknown> => {
    let porId = false;
    const c: Record<string, unknown> = {
      select: () => c,
      eq: (col: string) => {
        if (col === "id") porId = true;
        return c;
      },
      is: () => c,
      maybeSingle: async () => {
        if (table !== "clients") return { data: null, error: null };
        calls.clientsPor.push(porId ? "id" : "markbox");
        return { data: porId ? (cfg.porId ?? null) : cfg.porMarkbox, error: null };
      },
    };
    return c;
  };
  const stub = {
    from: (table: string) => chain(table),
    rpc: async (name: string) => {
      calls.rpc.push(name);
      if (name === "resolve_markbox") return { data: cfg.resolve, error: null };
      return { data: "outbox-1", error: null };
    },
  };
  return { stub: stub as unknown as SupabaseClient, calls };
}

describe("write-back con un Shipping Mark JUBILADO", () => {
  it("⭐ ya no se descarta: encuentra el lead siguiendo el historial", async () => {
    const { stub, calls } = makeStubJubilado({
      porMarkbox: null, // el código viejo ya no está en `clients`
      resolve: [{ client_id: "c-1", canonical_markbox: "DTD-8333" }],
      porId: { kommo_lead_id: 991 },
    });

    const res = await enqueueKommoWriteback(stub, "t-1", {
      clientMarkbox: "DTD-Y018",
      totalUsd: 120,
    });

    expect(res).toBe("outbox-1");
    expect(calls.rpc).toContain("resolve_markbox");
    expect(calls.rpc).toContain("enqueue_kommo_writeback");
    // Se consultó primero por markbox y después por id: ése es el desvío.
    expect(calls.clientsPor).toEqual(["markbox", "id"]);
  });

  it("⭐ el camino directo NO paga el desvío: sin resolve_markbox", async () => {
    // Sin este caso, alguien podría "simplificar" llamando siempre al RPC y
    // el 99% del tráfico pagaría una consulta extra sin que nada gritara.
    const { stub, calls } = makeStubJubilado({
      porMarkbox: { kommo_lead_id: 77 },
      resolve: null,
    });

    const res = await enqueueKommoWriteback(stub, "t-1", {
      clientMarkbox: "DTD-8042",
      totalUsd: 50,
    });

    expect(res).toBe("outbox-1");
    expect(calls.rpc).not.toContain("resolve_markbox");
    expect(calls.clientsPor).toEqual(["markbox"]);
  });

  it("un código que no conoce nadie sigue devolviendo null sin encolar", async () => {
    const { stub, calls } = makeStubJubilado({ porMarkbox: null, resolve: [] });

    const res = await enqueueKommoWriteback(stub, "t-1", {
      clientMarkbox: "DTD-0000",
      totalUsd: 10,
    });

    expect(res).toBeNull();
    expect(calls.rpc).not.toContain("enqueue_kommo_writeback");
  });

  it("el cliente existe pero no tiene lead: null, sin encolar", async () => {
    const { stub, calls } = makeStubJubilado({
      porMarkbox: null,
      resolve: [{ client_id: "c-2", canonical_markbox: "DTD-8100" }],
      porId: { kommo_lead_id: null },
    });

    const res = await enqueueKommoWriteback(stub, "t-1", {
      clientMarkbox: "DTD-A005",
      totalUsd: 10,
    });

    expect(res).toBeNull();
    expect(calls.rpc).not.toContain("enqueue_kommo_writeback");
  });
});
