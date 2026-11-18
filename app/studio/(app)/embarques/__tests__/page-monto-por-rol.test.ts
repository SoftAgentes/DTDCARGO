/**
 * SDD-0661 · El monto a cobrar del contenedor se decide en el SERVIDOR.
 *
 * Sin vista de Facturación (`invoices`, módulo de dinero) la página no lee
 * `invoices` y no le pasa `montos` al componente cliente: el dato no viaja al
 * navegador. Con la vista, lo lee y lo pasa. La matriz de permisos es la real
 * (`canAccessModule`); sólo la sesión es un doble. Datos inventados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { canAccessModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

const estado = vi.hoisted(() => ({
  rol: "commercial" as string,
  tablas: [] as string[],
}));

// Un doble de Supabase que anota cada tabla que se consulta y devuelve una
// factura para cualquier `invoices`.
function supabaseDoble() {
  return {
    from(tabla: string) {
      estado.tablas.push(tabla);
      const filas =
        tabla === "invoices"
          ? [{ shipment_id: "s1", currency: "USD", total_amount: "100.00", status: "borrador" }]
          : [];
      const q = {
        select: () => q,
        in: () => q,
        is: () => q,
        neq: () => q,
        order: () => q,
        then: (res: (r: { data: unknown[]; error: null }) => unknown) =>
          Promise.resolve({ data: filas, error: null }).then(res),
      };
      return q;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => supabaseDoble() }));

vi.mock("@/lib/studio/rbac-guard", () => ({
  requireModuleView: async () => undefined,
  getStudioAccess: async () => ({ role: estado.rol }),
  moduleViewDenial: async (_s: unknown, mod: string) =>
    canAccessModule(estado.rol as StudioUserRole, mod) ? null : "No tienes permiso para ver esto.",
}));

vi.mock("@/lib/studio/shipment-queries", () => ({
  listShipments: async () => [{ id: "s1" }, { id: "s2" }],
}));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({
  contarAdjuntosDeEmbarques: async () => null,
}));
vi.mock("@/lib/studio/documents/adjuntos", () => ({ conteosPorId: () => null }));
vi.mock("@/lib/studio/borrado/servidor", () => ({ leerInfoEmbarques: async () => null }));

// Los contenedores, inventados; el monto pasa por la función real.
vi.mock("@/lib/studio/embarques-contenedores-queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/embarques-contenedores-queries")>()),
  leerContenedoresDeEmbarques: async () => ({
    contenedores: [
      {
        id: "c64", ref: "DTD-CONSOL-0002", containerNo: null, numeroDtd: 64,
        status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z",
      },
    ],
    porEmbarque: { s1: "c64", s2: "c64" },
    cajasPorEmbarque: { s1: 10, s2: 5 },
  }),
}));

vi.mock("../_components/EmbarquesClient", () => ({ EmbarquesClient: () => null }));

import EmbarquesPage from "../page";

async function propsDe(rol: string): Promise<Record<string, unknown>> {
  estado.rol = rol;
  const el = (await EmbarquesPage()) as ReactElement<Record<string, unknown>>;
  return el.props;
}

beforeEach(() => {
  estado.tablas = [];
});

describe("Embarques · monto a cobrar por rol (SDD-0661)", () => {
  it.each(["commercial", "operations", "support", "warehouse", "marketing"])(
    "%s: no se consulta invoices y la página no pasa montos",
    async (rol) => {
      const props = await propsDe(rol);
      expect(estado.tablas).not.toContain("invoices");
      expect("montos" in props).toBe(false);
      // Las cajas sí llegan, para todos.
      expect((props.contenedores as { cajasPorEmbarque: unknown }).cajasPorEmbarque).toEqual({
        s1: 10,
        s2: 5,
      });
    },
  );

  it.each(["accounting", "admin"])("%s: se lee invoices y llega el monto", async (rol) => {
    const props = await propsDe(rol);
    expect(estado.tablas).toContain("invoices");
    expect(props.montos).toEqual({
      estado: "lista",
      porContenedor: { c64: { facturas: 1, totalUsd: 100, otraMoneda: 0 } },
    });
  });
});
