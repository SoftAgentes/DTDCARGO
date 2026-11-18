// @vitest-environment node
/**
 * SDD-0673 · «Grupo de WeChat»: la acción falla si el UPDATE no tocó ninguna
 * fila (la RLS lo escondió o el embarque no existe), en vez de decir que guardó.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SHIPMENT = "44444444-4444-4444-8444-444444444444";
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  capabilityDenial: async () => null,
  moduleEditDenial: async () => null,
  moduleViewDenial: async () => null,
}));

let respuesta: { data: unknown; error: { code?: string } | null };
const updates: unknown[] = [];
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (v: unknown) => {
        updates.push(v);
        const q = { eq: () => q, select: async () => respuesta };
        return q;
      },
    }),
  }),
}));

const { updateShipmentGroupReference } = await import("../actions");

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
});

describe("SDD-0673 · updateShipmentGroupReference", () => {
  it("0 filas actualizadas: error, sin revalidar", async () => {
    respuesta = { data: [], error: null };
    const res = await updateShipmentGroupReference(SHIPMENT, "Grupo Yiwu");
    expect(res.ok).toBe(false);
    expect(updates).toEqual([{ group_reference: "Grupo Yiwu" }]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("una fila: guarda el texto recortado y revalida la ficha", async () => {
    respuesta = { data: [{ id: SHIPMENT }], error: null };
    const res = await updateShipmentGroupReference(SHIPMENT, "  Grupo Yiwu  ");
    expect(res.ok).toBe(true);
    expect(updates).toEqual([{ group_reference: "Grupo Yiwu" }]);
    expect(revalidatePath).toHaveBeenCalledWith(`/studio/tracking/${SHIPMENT}`);
  });

  it("vacío borra el grupo; sin la 0563 dice que no está disponible", async () => {
    respuesta = { data: null, error: { code: "PGRST204" } };
    const res = await updateShipmentGroupReference(SHIPMENT, "   ");
    expect(updates).toEqual([{ group_reference: null }]);
    expect(res).toEqual({ ok: false, error: "Esta acción todavía no está disponible." });
  });

  it("más de 120 caracteres no llega a la base", async () => {
    const res = await updateShipmentGroupReference(SHIPMENT, "x".repeat(121));
    expect(res.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
