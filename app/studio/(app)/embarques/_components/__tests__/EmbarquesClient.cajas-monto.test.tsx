/**
 * SDD-0661 · Render: cajas en la cabecera del contenedor y en cada cliente;
 * el monto sólo si la página lo pasó, y «Sin facturar» en vez de $0.00.
 * Datos inventados.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type {
  ContenedoresDeEmbarques,
  MontosDeContenedores,
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
  envio("a1"),
  envio("a3"),
  envio("a2", { client_name: "Cliente Dos", client_markbox: "DTD-1002" }),
  envio("b1", { client_name: "Cliente Tres", client_markbox: "DTD-1003" }),
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
  porEmbarque: { a1: "c64", a3: "c64", a2: "c64", b1: "c65" },
  cajasPorEmbarque: { a1: 1000, a3: 234, a2: 1, b1: 8 },
};

afterEach(cleanup);

function cabecera(nombre: string): HTMLElement {
  return within(screen.getByRole("region", { name: nombre })).getAllByRole("button")[0];
}

describe("EmbarquesClient · cajas y monto (SDD-0661)", () => {
  it("la cabecera del contenedor dice el total de cajas, para cualquiera", () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    expect(cabecera("DDP 64").textContent).toContain("1.235 cajas");
    expect(cabecera("DDP 65").textContent).toContain("8 cajas");
    // Sin `montos` (comercial): nada de dinero en pantalla.
    expect(screen.queryByText(/A cobrar|Sin facturar|Monto no disponible/)).toBeNull();
  });

  it("al abrir el contenedor, cada cliente muestra sus cajas", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(cabecera("DDP 64"));
    const region = screen.getByRole("region", { name: "DDP 64" });
    const uno = within(region).getByText("Cliente Uno").closest("button")!;
    expect(uno.textContent).toContain("2 envíos");
    expect(uno.textContent).toContain("1.234 cajas");
    const dos = within(region).getByText("Cliente Dos").closest("button")!;
    expect(dos.textContent).toContain("1 caja");
    expect(dos.textContent).not.toContain("1 cajas");
  });

  it("con montos: el total en dólares, y «Sin facturar» si no hay facturas", () => {
    const montos: MontosDeContenedores = {
      estado: "lista",
      porContenedor: { c64: { facturas: 3, totalUsd: 12345.5, otraMoneda: 1 } },
    };
    render(
      <EmbarquesClient shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={montos} />,
    );
    const c64 = cabecera("DDP 64").textContent ?? "";
    expect(c64).toContain("A cobrar $12,345.50");
    expect(c64).toContain("+ 1 factura en otra moneda");
    const c65 = cabecera("DDP 65").textContent ?? "";
    expect(c65).toContain("Sin facturar");
    expect(c65).not.toContain("$0.00");
  });

  it("si la lectura del monto falló, lo dice", () => {
    render(
      <EmbarquesClient
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        montos={{ estado: "no_disponible" }}
      />,
    );
    expect(cabecera("DDP 64").textContent).toContain("Monto no disponible");
  });
});
