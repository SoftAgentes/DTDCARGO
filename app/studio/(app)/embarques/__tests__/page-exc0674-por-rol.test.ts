/**
 * SDD-0674 · EXC-0674 — qué recibe el navegador para «Facturar», por rol, decidido en el SERVIDOR.
 *
 * Solo accounting y admin reciben `facturacion`: los contenedores de la lista transitoria y
 * lo ya facturado, con su total. operations, commercial, warehouse, support y marketing no consultan las
 * tablas de la 0564 y no reciben la prop. Ningún rol lee `invoices` para esto. Sin la 0564 (la
 * tabla no existe) la prop dice `no_disponible` y el botón no se pinta. Datos inventados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { canAccessModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

const estado = vi.hoisted(() => ({
  rol: "commercial" as string,
  tablas: [] as string[],
  sinMigracion: false,
  sinFacturacion: false,
}));

function supabaseDoble() {
  return {
    from(tabla: string) {
      estado.tablas.push(tabla);
      let filas: unknown[] = [];
      if (tabla === "exc0674_contenedores") filas = [{ consolidation_id: "c64" }];
      if (tabla === "exc0674_facturas") {
        filas = [
          { consolidation_id: "c64", client_markbox: "DTD-T001", invoice_code: "F-TEST-1", total_usd: "116.00", billed_markbox: "DTD-T001", anulada_at: null },
          // Anulada en Facturación: no cuenta y el cliente se puede volver a facturar.
          { consolidation_id: "c64", client_markbox: "DTD-T002", invoice_code: "F-TEST-0", total_usd: "50.00", billed_markbox: "DTD-T002", anulada_at: "2026-11-18T12:00:00Z" },
        ];
      }
      const error =
        estado.sinMigracion && tabla.startsWith("exc0674_")
          ? { code: "PGRST205", message: "Could not find the table" }
          : null;
      const q = {
        select: () => q,
        in: () => q,
        is: (col: string, val: unknown) => {
          filas = filas.filter((f) => ((f as Record<string, unknown>)[col] ?? null) === val);
          return q;
        },
        neq: () => q,
        not: () => q,
        order: () => q,
        range: () => q,
        then: (res: (r: { data: unknown[] | null; error: unknown }) => unknown) =>
          Promise.resolve({ data: error ? null : filas, error }).then(res),
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
    (mod === "invoices" && estado.sinFacturacion) || !canAccessModule(estado.rol as StudioUserRole, mod)
      ? "No tienes permiso para ver esto."
      : null,
}));
vi.mock("@/lib/studio/shipment-queries", () => ({
  listShipments: async () => [{ id: "s1" }],
}));
vi.mock("@/lib/studio/documents/adjuntos-queries", () => ({ contarAdjuntosDeEmbarques: async () => null }));
vi.mock("@/lib/studio/documents/adjuntos", () => ({ conteosPorId: () => null }));
vi.mock("@/lib/studio/borrado/servidor", () => ({ leerInfoEmbarques: async () => null }));
vi.mock("@/lib/studio/embarques-contenedores-queries", async (original) => ({
  ...(await original<typeof import("@/lib/studio/embarques-contenedores-queries")>()),
  leerContenedoresDeEmbarques: async () => ({
    contenedores: [
      { id: "c64", ref: "DTD-CONSOL-0002", containerNo: null, numeroDtd: 64, status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z" },
      { id: "c65", ref: "DTD-CONSOL-0003", containerNo: null, numeroDtd: 65, status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z" },
    ],
    porEmbarque: { s1: "c64" },
    cajasPorEmbarque: { s1: 10 },
  }),
  leerRecibidasDeContenedores: async () => null,
  leerMontosDeContenedores: async () => ({ estado: "lista", porEmbarque: {} }),
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
  estado.sinMigracion = false;
  estado.sinFacturacion = false;
});

describe("Embarques · «Facturar» de la EXC-0674 por rol (SDD-0674)", () => {
  it.each(["operations", "commercial", "warehouse", "support", "marketing"])(
    "%s: no consulta la lista ni el rastro y no recibe facturacion",
    async (rol) => {
      const props = await propsDe(rol);
      expect(estado.tablas.filter((t) => t.startsWith("exc0674_"))).toEqual([]);
      expect("facturacion" in props).toBe(false);
    },
  );

  it.each(["accounting", "admin"])("%s: recibe la lista y lo facturado con su total", async (rol) => {
    const props = await propsDe(rol);
    expect(props.facturacion).toEqual({
      estado: "lista",
      contenedores: ["c64"],
      facturados: { c64: { "DTD-T001": { invoiceCode: "F-TEST-1", totalUsd: 116, billedMarkbox: "DTD-T001" } } },
    });
    expect(estado.tablas).not.toContain("invoices");
  });

  it("operations no recibe ni la facturación ni los montos de la 0661 (Sam, 2026-11-18)", async () => {
    const props = await propsDe("operations");
    expect("facturacion" in props).toBe(false);
    expect("montos" in props).toBe(false);
  });

  it("accounting sin la puerta de Facturación (override) no consulta ni recibe facturacion", async () => {
    estado.sinFacturacion = true;
    const props = await propsDe("accounting");
    expect(estado.tablas.filter((t) => t.startsWith("exc0674_"))).toEqual([]);
    expect("facturacion" in props).toBe(false);
  });

  it("sin la 0564 la prop dice no_disponible y no rompe la página", async () => {
    estado.sinMigracion = true;
    const props = await propsDe("accounting");
    expect(props.facturacion).toEqual({ estado: "no_disponible" });
  });
});
