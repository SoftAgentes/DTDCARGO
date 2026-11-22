/**
 * SDD-0665 · Peso del contenedor y por cliente: la suma de `shipments.weight_kg`,
 * el aviso de envíos sin peso y «Sin peso» (nunca 0 kg). Datos inventados.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import {
  agruparPorContenedor,
  type ContenedoresDeEmbarques,
} from "@/lib/studio/embarques-contenedores";

vi.mock("../ShipmentDetailDrawer", () => ({
  ShipmentDetailDrawer: () => null,
}));

import { EmbarquesClient } from "../EmbarquesClient";

function envio(id: string, over: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id,
    code: `S-${id}`,
    client_name: "Cliente Uno",
    client_markbox: "DTD-1001",
    origin: "Yiwu",
    destination: "La Guaira",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit",
    weight_kg: null,
    volume_m3: 1,
    created_at: "2026-10-02T10:00:00Z",
    ...over,
  };
}

const ENVIOS = [
  envio("a1", { weight_kg: 1000.5 }),
  envio("a2", { weight_kg: 234 }),
  envio("b1", { client_name: "Cliente Dos", client_markbox: "DTD-1002", weight_kg: 12.25 }),
  envio("b2", { client_name: "Cliente Dos", client_markbox: "DTD-1002", weight_kg: null }),
  envio("c1", { client_name: "Cliente Tres", client_markbox: "DTD-1003", weight_kg: null }),
  envio("z1", { client_name: "Cliente Cuatro", client_markbox: "DTD-1004", weight_kg: null }),
];

const DATOS: ContenedoresDeEmbarques = {
  contenedores: [
    {
      id: "c64", ref: "DTD-CONSOL-0002", containerNo: null, numeroDtd: 64,
      status: "zarpado", naviera: null, eta: null, createdAt: "2026-09-29T00:00:00Z",
    },
    {
      id: "c65", ref: "DTD-CONSOL-0003", containerNo: null, numeroDtd: 65,
      status: "consolidando", naviera: null, eta: null, createdAt: "2026-11-10T00:00:00Z",
    },
  ],
  porEmbarque: { a1: "c64", a2: "c64", b1: "c64", b2: "c64", c1: "c64", z1: "c65" },
};

afterEach(cleanup);

function region(nombre: string): HTMLElement {
  return screen.getByRole("region", { name: nombre });
}

function fila(tabla: HTMLElement, rotulo: RegExp): string[] {
  const tr = within(tabla).getByRole("rowheader", { name: rotulo }).closest("tr")!;
  return within(tr)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

describe("peso del contenedor (SDD-0665)", () => {
  it("suma por cliente y por contenedor; cuenta los envíos sin peso", () => {
    const g = agruparPorContenedor(ENVIOS, DATOS);
    const g64 = g.find((x) => x.key === "c64")!;
    expect(g64.pesoKg).toBe(1246.75);
    expect(g64.enviosSinPeso).toBe(2);
    // El orden de los clientes lo decide `groupShipmentsByClient`; aquí se mira
    // cada uno por su Shipping Mark.
    const porMark = Object.fromEntries(
      g64.clientes.map((c) => [c.clientMarkbox, [c.stats.totalWeight, c.enviosSinPeso]]),
    );
    expect(porMark).toEqual({
      "DTD-1001": [1234.5, 0],
      "DTD-1002": [12.25, 1],
      "DTD-1003": [0, 1],
    });
    const g65 = g.find((x) => x.key === "c65")!;
    expect(g65.pesoKg).toBe(0);
    expect(g65.enviosSinPeso).toBe(1);
  });

  it("con filtro, suma sólo lo que se ve", () => {
    const g = agruparPorContenedor([ENVIOS[0]], DATOS, ENVIOS);
    expect(g[0].pesoKg).toBe(1000.5);
  });

  it("la franja y la tabla dicen el peso; un cliente sin peso dice «Sin peso», no 0 kg", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(within(region("DDP 64")).getAllByRole("button")[0]);
    const franja = within(region("DDP 64")).getByLabelText("Totales de DDP 64");
    expect(franja.textContent).toContain("Peso total1.246,75 kg");
    expect(within(region("DDP 64")).getByText(/2 envíos sin peso cargado/)).toBeTruthy();

    const tabla = within(region("DDP 64")).getByRole("table");
    expect(fila(tabla, /Cliente Uno/)[4]).toBe("1.234,5 kg");
    expect(fila(tabla, /Cliente Dos/)[4]).toBe("12,25 kg");
    expect(fila(tabla, /Cliente Tres/)[4]).toBe("Sin peso");
    expect(fila(tabla, /Total del contenedor/)[4]).toBe("1.246,75 kg");
  });

  it("un contenedor sin ningún peso dice «Sin peso» y no avisa envíos sueltos", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(within(region("DDP 65")).getAllByRole("button")[0]);
    const franja = within(region("DDP 65")).getByLabelText("Totales de DDP 65");
    expect(franja.textContent).toContain("Peso totalSin peso");
    expect(franja.textContent).not.toContain("0 kg");
    expect(within(region("DDP 65")).queryByText(/sin peso cargado/)).toBeNull();
    const tabla = within(region("DDP 65")).getByRole("table");
    expect(fila(tabla, /Total del contenedor/)[4]).toBe("Sin peso");
  });
});
