/**
 * SDD-0661 · Render del diseño elegido por Sam («Franja + Excel»):
 *  - cabecera cerrada: clientes, envíos, cajas y m³;
 *  - al abrir: franja de totales y detalle por cliente con «Total del contenedor»;
 *  - «Por cobrar» y «Cobrado» sólo si la página pasó `montos`; sin facturas,
 *    «Sin facturar», nunca $0.00.
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
  recibidasPorContenedor: { c64: { "DTD-1001": 1200 } },
};

const MONTOS: MontosDeContenedores = {
  estado: "lista",
  porEmbarque: {
    a1: { facturas: 1, porCobrarUsd: 12000, cobradoUsd: 5000, otraMoneda: 0, borradores: 0, sinFacturarUsd: 0 },
    a2: { facturas: 2, porCobrarUsd: 345.5, cobradoUsd: 0, otraMoneda: 1, borradores: 1, sinFacturarUsd: 345.5 },
  },
};

afterEach(cleanup);

function region(nombre: string): HTMLElement {
  return screen.getByRole("region", { name: nombre });
}

function cabecera(nombre: string): HTMLElement {
  return within(region(nombre)).getAllByRole("button")[0];
}

/** Las celdas de la fila cuyo encabezado de fila es `rotulo`. */
function fila(tabla: HTMLElement, rotulo: RegExp): string[] {
  const th = within(tabla).getByRole("rowheader", { name: rotulo });
  const tr = th.closest("tr")!;
  return within(tr)
    .getAllByRole("cell")
    .map((c) => c.textContent ?? "");
}

describe("EmbarquesClient · franja y detalle por cliente (SDD-0661)", () => {
  it("cerrado: clientes, envíos, cajas y m³ en la cabecera; el dinero, solo el «Total sin facturar» (SDD-0689)", () => {
    render(
      <EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={MONTOS} />,
    );
    const c64 = cabecera("DDP 64").textContent ?? "";
    expect(c64).toContain("2 clientes");
    expect(c64).toContain("3 envíos");
    expect(c64).toContain("1.235 cajas");
    expect(c64).toContain("3 m³");
    expect(c64).not.toMatch(/cobr|[$]/i);
    // El «Total sin facturar» va al lado, oculto hasta oprimir el ojo.
    expect(within(region("DDP 64")).getByTestId("total-sin-facturar").textContent).toContain("••••••");
  });

  it("abierto, sin montos (comercial): franja y detalle sin columnas de dinero", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(cabecera("DDP 64"));
    const franja = within(region("DDP 64")).getByLabelText("Totales de DDP 64");
    expect(franja.textContent).toContain("Clientes2");
    expect(franja.textContent).toContain("Cajas1.235");
    expect(franja.textContent).toContain("Cajas recibidas1.200");
    expect(franja.textContent).toContain("CBM total3 m³");
    expect(screen.queryByText(/Por cobrar|Cobrado|Sin facturar/)).toBeNull();

    const tabla = within(region("DDP 64")).getByRole("table");
    expect(fila(tabla, /Cliente Uno/)).toEqual(["2", "1.234", "1.200", "2", "Sin peso"]);
    expect(fila(tabla, /Cliente Dos/)).toEqual(["1", "1", "0", "1", "Sin peso"]);
    expect(fila(tabla, /Total del contenedor/)).toEqual(["3", "1.235", "1.200", "3", "Sin peso"]);
  });

  it("un contenedor sin recepción dice «Sin recepción» en recibidas, no 0", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(cabecera("DDP 65"));
    const franja = within(region("DDP 65")).getByLabelText("Totales de DDP 65");
    expect(franja.textContent).toContain("Cajas recibidasSin recepción");
    const tabla = within(region("DDP 65")).getByRole("table");
    expect(fila(tabla, /Total del contenedor/)).toEqual(["1", "8", "Sin recepción", "1", "Sin peso"]);
  });

  it("con montos (contabilidad): por cobrar y cobrado en la franja y en columnas", async () => {
    render(
      <EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={MONTOS} />,
    );
    await userEvent.click(cabecera("DDP 64"));
    const franja = within(region("DDP 64")).getByLabelText("Totales de DDP 64");
    expect(franja.textContent).toContain("Por cobrar$12,345.50");
    expect(franja.textContent).toContain("Cobrado$5,000.00");
    expect(within(region("DDP 64")).getByText(/1 factura está en otra moneda/)).toBeTruthy();

    const tabla = within(region("DDP 64")).getByRole("table");
    expect(fila(tabla, /Cliente Uno/).slice(5)).toEqual(["$12,000.00", "$5,000.00"]);
    expect(fila(tabla, /Cliente Dos/).slice(5)).toEqual(["$345.50", "$0.00"]);
    expect(fila(tabla, /Total del contenedor/).slice(5)).toEqual(["$12,345.50", "$5,000.00"]);
  });

  it("sin facturas dice «Sin facturar», nunca $0.00", async () => {
    render(
      <EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} montos={MONTOS} />,
    );
    await userEvent.click(cabecera("DDP 65"));
    const franja = within(region("DDP 65")).getByLabelText("Totales de DDP 65");
    expect(franja.textContent).toContain("Por cobrarSin facturar");
    expect(franja.textContent).not.toContain("$0.00");
    const tabla = within(region("DDP 65")).getByRole("table");
    expect(fila(tabla, /Total del contenedor/).slice(5)).toEqual(["Sin facturar", "Sin facturar"]);
  });

  it("si la lectura del monto falló, lo dice", async () => {
    render(
      <EmbarquesClient pestanaInicial="all"
        shipments={ENVIOS}
        adjuntos={undefined}
        contenedores={DATOS}
        montos={{ estado: "no_disponible" }}
      />,
    );
    await userEvent.click(cabecera("DDP 64"));
    const franja = within(region("DDP 64")).getByLabelText("Totales de DDP 64");
    expect(franja.textContent).toContain("Por cobrarNo disponible");
  });

  it("al abrir el contenedor, el acordeón por cliente también dice sus cajas", async () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await userEvent.click(cabecera("DDP 64"));
    const botonUno = within(region("DDP 64"))
      .getAllByText("Cliente Uno")
      .map((el) => el.closest("button"))
      .find((b) => b?.classList.contains("emb-group-header"))!;
    expect(botonUno.textContent).toContain("2 envíos");
    expect(botonUno.textContent).toContain("1.234 cajas");
  });
});
