// @vitest-environment node
/**
 * SDD-0499 · `finalize` y `reauthorize` pasan por el mismo gate que sus
 * hermanos del recurso.
 *
 * Es UNIFORMIDAD, no un hueco que se cierre: la RPC `reauthorize_document_upload`
 * (`supabase/migrations/0309_document_reserve_finalize_rpcs.sql:114-115`) ya
 * filtra por `tenant_id` Y `user_id = auth.uid()`, así que nadie alcanzaba
 * reservas ajenas. Lo que faltaba era que las cinco rutas dijeran lo mismo:
 * `reserve`, `restore` y `download` ya llamaban a `moduleEditDenial`/
 * `moduleViewDenial` con "expenses".
 *
 * El gate corre de verdad (no se mockea): el doble devuelve el rol y
 * `moduleEditDenial` decide. Y se comprueba que el denegado no llega al
 * servicio de adjuntos.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let rol: string | null = "support";
const servicio: string[] = [];

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const paso = () => chain;
      chain.select = paso;
      chain.eq = paso;
      chain.is = paso;
      chain.limit = paso;
      chain.returns = async () => ({ data: [], error: null });
      chain.maybeSingle = async () =>
        table === "user_tenants"
          ? { data: rol ? { role: rol, tenant_id: "t-1" } : null, error: null }
          : { data: null, error: null };
      return chain;
    },
  }),
}));

vi.mock("@/lib/studio/attachments/pilot-gate", () => ({
  requireAttachmentsPilot: () => undefined,
}));

vi.mock("@/lib/studio/attachments/service", () => ({
  reauthorizeAttachment: async () => {
    servicio.push("reauthorize");
    return { objectKey: "k", bucketId: "b", expiresAt: "2026-01-01T00:00:00Z" };
  },
  finalizeAttachment: async () => {
    servicio.push("finalize");
    return "doc-1";
  },
  createTusAuthorization: async () => "firma",
  directTusEndpoint: () => "https://tus.invalid",
}));

const { POST: FINALIZE } = await import("../[id]/finalize/route");
const { POST: REAUTHORIZE } = await import("../[id]/reauthorize/route");

const ctx = { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) };

describe.each([
  ["finalize", FINALIZE],
  ["reauthorize", REAUTHORIZE],
] as const)("POST attachments/[id]/%s · gate de expenses", (_nombre, post) => {
  beforeEach(() => {
    servicio.length = 0;
    rol = "support";
  });

  it("support (read-only) → 403 y el servicio de adjuntos no corre", async () => {
    const res = await post({} as never, ctx);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "No tienes permiso para realizar esta acción.",
    });
    expect(servicio).toEqual([]);
  });

  it("sin membership activa → 403 y el servicio no corre", async () => {
    rol = null;
    const res = await post({} as never, ctx);
    expect(res.status).toBe(403);
    expect(servicio).toEqual([]);
  });

  it("accounting (sí edita expenses) → pasa y llega al servicio", async () => {
    rol = "accounting";
    const res = await post({} as never, ctx);
    expect(res.status).toBe(200);
    expect(servicio.length).toBeGreaterThan(0);
  });
});
