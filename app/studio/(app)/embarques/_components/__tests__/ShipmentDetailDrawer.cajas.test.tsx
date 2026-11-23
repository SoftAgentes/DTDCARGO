/**
 * SDD-0711: el panel «Detalle del envío» muestra las cajas y, por proveedor,
 * sus cajas y su CBM en m³ con coma decimal.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type { EstadoCajas } from "@/lib/studio/cajas-por-proveedor";
import { ShipmentDetailDrawer } from "../ShipmentDetailDrawer";

const ENVIO: ShipmentListRow = {
  id: "s-1", code: "S-2026-0001", client_name: "Cliente de prueba",
  client_markbox: "DTD-0001", origin: "Yiwu", destination: "La Guaira",
  shipment_service: "puerta_a_puerta_DDP",
  status: "in_transit", weight_kg: null, volume_m3: 0.26,
  created_at: "2026-09-28T10:00:00Z",
};

function pintar(cajas: EstadoCajas) {
  return render(<ShipmentDetailDrawer shipment={ENVIO} cajas={cajas} onClose={() => {}} />);
}

afterEach(cleanup);

describe("ShipmentDetailDrawer · cajas por proveedor (SDD-0711)", () => {
  it("muestra el total y la tabla por proveedor con cajas y CBM", () => {
    pintar({
      estado: "listo",
      datos: {
        totalCajas: 14, totalCbm: 1.3,
        proveedores: [
          { proveedor: "Proveedor Uno", cajas: 13, cbm: 1.25 },
          { proveedor: null, cajas: 1, cbm: 0.05 },
        ],
      },
    });
    expect(screen.getByText("14 cajas")).toBeTruthy();
    const tabla = within(screen.getByRole("region", { name: "Por proveedor" })).getByRole("table");
    const filas = within(tabla).getAllByRole("row");
    expect(filas).toHaveLength(3);
    expect(within(filas[1]).getByText("Proveedor Uno")).toBeTruthy();
    expect(within(filas[1]).getByText("13")).toBeTruthy();
    expect(within(filas[1]).getByText("1,25 m³")).toBeTruthy();
    expect(within(filas[2]).getByText("Sin proveedor")).toBeTruthy();
    expect(within(filas[2]).getByText("0,05 m³")).toBeTruthy();
  });

  it("una sola caja va en singular", () => {
    pintar({ estado: "listo", datos: { totalCajas: 1, totalCbm: 0.1, proveedores: [{ proveedor: "A", cajas: 1, cbm: 0.1 }] } });
    expect(screen.getByText("1 caja")).toBeTruthy();
  });

  it("sin recepción dice «Sin recepción», nunca 0, y no hay sección", () => {
    pintar({ estado: "sin_recepcion" });
    expect(screen.getByText("Sin recepción")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Por proveedor" })).toBeNull();
    expect(screen.queryByText(/^0 cajas?$/)).toBeNull();
  });

  it("si la lectura falló lo dice y no afirma «Sin recepción»", () => {
    pintar({ estado: "no_disponible" });
    expect(screen.getByText("No se pudo leer")).toBeTruthy();
    expect(screen.queryByText("Sin recepción")).toBeNull();
  });
});
