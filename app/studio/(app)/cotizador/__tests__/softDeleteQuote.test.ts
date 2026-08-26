/**
 * SDD-0300 — el gate del borrado, del lado del SERVIDOR.
 *
 * El menú del listado deshabilita "Eliminar" en un estimado convertido, pero
 * eso es cortesía para el usuario: `softDeleteQuote` es una server action y se
 * puede invocar sin haber pasado por esa pantalla. Un doble más generoso que
 * el servidor sería un permiso disfrazado de prueba, así que acá se ejercita
 * la acción REAL contra un cliente de Supabase falso y se mira si el `update`
 * llegó a salir.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { estadoDb, moduleEditDenial, revalidatePath } = vi.hoisted(() => ({
  estadoDb: {
    fila: null as Record<string, unknown> | null,
    errorLectura: null as { message: string } | null,
    updates: [] as Record<string, unknown>[],
  },
  moduleEditDenial: vi.fn<() => Promise<string | null>>(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: estadoDb.fila,
            error: estadoDb.errorLectura,
          }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          estadoDb.updates.push(patch);
          return { error: null };
        },
      }),
    }),
  }),
}));

import { softDeleteQuote } from "../actions";

const SIN_CONVERTIR = {
  id: "q-1",
  converted_to_shipment_id: null,
  sales_order_id: null,
};

beforeEach(() => {
  estadoDb.fila = { ...SIN_CONVERTIR };
  estadoDb.errorLectura = null;
  estadoDb.updates = [];
  moduleEditDenial.mockResolvedValue(null);
  revalidatePath.mockClear();
});

describe("softDeleteQuote", () => {
  it("marca deleted_at cuando el estimado no causó nada", async () => {
    const r = await softDeleteQuote("q-1");
    expect(r).toEqual({ ok: true });
    expect(estadoDb.updates).toHaveLength(1);
    expect(estadoDb.updates[0]).toHaveProperty("deleted_at");
    expect(revalidatePath).toHaveBeenCalledWith("/studio/cotizador");
  });

  it("NO borra un estimado ya convertido en embarque, aunque se invoque directo", async () => {
    estadoDb.fila = { ...SIN_CONVERTIR, converted_to_shipment_id: "shp-1" };
    const r = await softDeleteQuote("q-1");
    expect(r.error).toMatch(/ya se convirtió en un embarque/);
    expect(estadoDb.updates).toHaveLength(0);
  });

  it("NO borra un estimado ligado a una orden de venta", async () => {
    estadoDb.fila = { ...SIN_CONVERTIR, sales_order_id: "ov-1" };
    const r = await softDeleteQuote("q-1");
    expect(r.error).toMatch(/orden de venta/);
    expect(estadoDb.updates).toHaveLength(0);
  });

  it("sin permiso de edición no lee ni escribe nada", async () => {
    moduleEditDenial.mockResolvedValue("No tienes permiso para realizar esta acción.");
    const r = await softDeleteQuote("q-1");
    expect(r.error).toBe("No tienes permiso para realizar esta acción.");
    expect(estadoDb.updates).toHaveLength(0);
  });

  it("una fila que no aparece (inexistente o ya borrada por la RLS) no escribe", async () => {
    estadoDb.fila = null;
    const r = await softDeleteQuote("q-1");
    expect(r.error).toBe("No encontramos ese estimado.");
    expect(estadoDb.updates).toHaveLength(0);
  });
});
