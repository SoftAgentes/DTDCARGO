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
  /** Módulos que esta persona ve por un acceso extra (SDD-0622). */
  extras: [] as string[],
}));

// Un doble de Supabase que anota cada tabla que se consulta y devuelve una
// factura para cualquier `invoices`.
function supabaseDoble() {
  return {
    from(tabla: string) {
      estado.tablas.push(tabla);
      const filas =
        tabla === "invoices"
          ? [
              {
                id: "inv-1",
                invoice_code: "F-PO-1",
                shipment_id: "s1",
                currency: "USD",
                total_amount: "100.00",
                paid_amount: "25.00",
                status: "borrador",
              },
            ]
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
    canAccessModule(estado.rol as StudioUserRole, mod) || estado.extras.includes(mod)
      ? null
      : "No tienes permiso para ver esto.",
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
  estado.extras = [];
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
      porEmbarque: {
        s1: {
          facturas: 1,
          totalUsd: 100,
          pagadoUsd: 25,
          otraMoneda: 0,
          borradores: 1,
          sinFacturarUsd: 100,
          // SDD-0690: el id y el código viajan solo aquí, con `montos`.
          documentos: [{ invoiceId: "inv-1", invoiceCode: "F-PO-1", preorden: true, totalUsd: 100 }],
        },
      },
    });
  });

  // SDD-0689: el «Sin facturar» del encabezado sale de `montos`. Se decide aquí, en el servidor: a
  // operations y a los demás roles no les llega ningún monto, ni siquiera el de los borradores.
  it.each(["operations", "commercial", "support", "warehouse", "marketing"])(
    "%s: el «Sin facturar» del encabezado no viaja al navegador",
    async (rol) => {
      const props = await propsDe(rol);
      expect(JSON.stringify(props)).not.toMatch(/sinFacturarUsd|totalUsd|pagadoUsd|invoiceCode|invoiceId|invoice_code/);
    },
  );

  it("un acceso extra a Facturación sin el rol no lee invoices: la RLS (0414) le daría cero filas", async () => {
    estado.extras = ["invoices"];
    const props = await propsDe("commercial");
    expect(estado.tablas).not.toContain("invoices");
    expect("montos" in props).toBe(false);
  });
});
