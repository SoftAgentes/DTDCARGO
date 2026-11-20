/**
 * SDD-0643 · La vista Embarques empieza por contenedores: nivel 1 contenedor,
 * nivel 2 cliente, nivel 3 embarques; filtros por contenedor y por cliente.
 * Datos inventados.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import type { ContenedoresDeEmbarques } from "@/lib/studio/embarques-contenedores";

vi.mock("../ShipmentDetailDrawer", () => ({
  ShipmentDetailDrawer: ({ shipment }: { shipment: ShipmentListRow }) => (
    <div role="dialog" aria-label={`Detalle ${shipment.code}`} />
  ),
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
  envio("a2", { client_name: "Cliente Dos", client_markbox: "DTD-1002" }),
  envio("f1", { client_name: "Dueño FCL", client_markbox: "DTD-9000", shipment_service: "fcl_directo" }),
  envio("x1", { client_name: "Cliente Tres", client_markbox: "DTD-1003" }),
];

const DATOS: ContenedoresDeEmbarques = {
  contenedores: [
    {
      id: "c64", ref: "DTD-CONSOL-0002", containerNo: "ABCU7792550", numeroDtd: 64,
      status: "zarpado", naviera: "Naviera Uno", eta: "2026-12-12", createdAt: "2026-09-29T00:00:00Z",
    },
    {
      id: "c63", ref: "DTD-CONSOL-0001", containerNo: "ABCU4042155", numeroDtd: 63,
      status: "zarpado", naviera: "Naviera Uno", eta: "2026-12-08", createdAt: "2026-09-20T00:00:00Z",
    },
  ],
  porEmbarque: { a1: "c64", a2: "c64", f1: "c63" },
};

afterEach(cleanup);

function cabecera(nombre: string): HTMLElement {
  const seccion = screen.getByRole("region", { name: nombre });
  return within(seccion).getAllByRole("button")[0];
}

describe("EmbarquesClient · por contenedor (SDD-0643)", () => {
  it("el primer nivel son los contenedores, con nombre, ISO, naviera, ETA, estado y conteos", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    const regiones = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regiones).toEqual(["DDP 64", "FCL 63", "Sin contenedor"]);

    const c64 = cabecera("DDP 64");
    expect(c64.textContent).toContain("ABCU7792550");
    expect(c64.textContent).toContain("Naviera Uno");
    expect(c64.textContent).toContain("Zarpado");
    expect(c64.textContent).toContain("2 clientes");
    expect(c64.textContent).toContain("2 envíos");
    // La ETA, con el texto exacto: «2026-12-12» no se corre al 11 por UTC.
    expect(c64.textContent).toContain("ETA 12 dic. 2026");
    // Varios contenedores: cerrados; los embarques no se ven todavía.
    expect(c64.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("S-a1")).toBeNull();
  });

  it("un FCL es de un solo cliente, que puede tener varios embarques adentro", async () => {
    const user = userEvent.setup();
    const otroDelDueno = envio("f2", { client_name: "Dueño FCL", client_markbox: "DTD-9000" });
    render(
      <EmbarquesClient pestanaInicial="all"
        shipments={[...ENVIOS, otroDelDueno]}
        adjuntos={undefined}
        contenedores={{ ...DATOS, porEmbarque: { ...DATOS.porEmbarque, f2: "c63" } }}
      />,
    );
    const c63 = cabecera("FCL 63");
    expect(c63.textContent).toContain("1 cliente");
    expect(c63.textContent).toContain("2 envíos");
    await user.click(c63);
    const seccion = screen.getByRole("region", { name: "FCL 63" });
    expect(within(seccion).getByText("S-f1")).toBeTruthy();
    expect(within(seccion).getByText("S-f2")).toBeTruthy();
  });

  it("un mixto sigue diciendo «DDP NN» con el filtro «Servicio = FCL» (revisión M1)", async () => {
    const user = userEvent.setup();
    // El 64 lleva DDP de dos clientes y el FCL del dueño: es un mixto.
    const delDueno = envio("m1", { client_name: "Dueño FCL", client_markbox: "DTD-9000", shipment_service: "fcl_directo" });
    render(
      <EmbarquesClient pestanaInicial="all"
        shipments={[...ENVIOS, delDueno]}
        adjuntos={undefined}
        contenedores={{ ...DATOS, porEmbarque: { ...DATOS.porEmbarque, m1: "c64" } }}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Servicio"), "fcl_directo");
    const regiones = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regiones).toEqual(["DDP 64", "FCL 63"]);
    // Con el filtro sólo queda el envío FCL del dueño dentro del 64.
    expect(cabecera("DDP 64").textContent).toContain("1 envío");
  });

  it("abrir el contenedor muestra sus clientes y, con pocos, sus embarques", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await user.click(cabecera("DDP 64"));
    const seccion = screen.getByRole("region", { name: "DDP 64" });
    // SDD-0661: el nombre también sale en el detalle por cliente; el nivel 2
    // (acordeón) es el botón del cliente. SDD-0689: en el detalle el nombre también es un botón
    // (lleva a sus embarques), así que se busca el del acordeón.
    const acordeon = (re: RegExp) =>
      within(seccion)
        .getAllByRole("button", { name: re })
        .filter((b) => b.classList.contains("emb-group-header"));
    expect(acordeon(/Cliente Uno/)).toHaveLength(1);
    expect(acordeon(/Cliente Dos/)).toHaveLength(1);
    expect(within(seccion).queryByText("Cliente Tres")).toBeNull();
    expect(within(seccion).getByText("S-a1")).toBeTruthy();
    // El drawer de detalle sigue igual.
    await user.click(within(seccion).getByRole("button", { name: "Abrir embarque S-a1" }));
    expect(screen.getByRole("dialog", { name: "Detalle S-a1" })).toBeTruthy();
  });

  it("filtro «Contenedor» por número DTD y por ISO", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await user.type(screen.getByLabelText("Contenedor"), "63");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["FCL 63"]);
    // Con un filtro de texto se abre lo que queda.
    expect(screen.getByText("S-f1")).toBeTruthy();

    await user.clear(screen.getByLabelText("Contenedor"));
    await user.type(screen.getByLabelText("Contenedor"), "abcu7792");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["DDP 64"]);
  });

  it("filtro «Cliente» por nombre o por Shipping Mark", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} />);
    await user.type(screen.getByLabelText("Cliente"), "dtd-1002");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["DDP 64"]);
    expect(screen.getByText("S-a2")).toBeTruthy();
    expect(screen.queryByText("S-a1")).toBeNull();

    await user.clear(screen.getByLabelText("Cliente"));
    await user.type(screen.getByLabelText("Cliente"), "tres");
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Sin contenedor"]);
  });

  it("los tabs siguen filtrando dentro de los contenedores", async () => {
    const user = userEvent.setup();
    const conAlerta = ENVIOS.map((r) => (r.id === "a2" ? { ...r, status: "exception" as const } : r));
    render(<EmbarquesClient pestanaInicial="all" shipments={conAlerta} adjuntos={undefined} contenedores={DATOS} />);
    await user.click(screen.getByRole("button", { name: /Con alertas/ }));
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["DDP 64"]);
    expect(cabecera("DDP 64").textContent).toContain("1 alerta");
  });

  it("si no se pudieron leer los contenedores, lo dice y agrupa sólo por cliente", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={null} />);
    expect(screen.getByText(/No se pudieron leer los contenedores/)).toBeTruthy();
    expect(screen.queryAllByRole("region")).toHaveLength(0);
    expect(screen.queryByLabelText("Contenedor")).toBeNull();
    expect(screen.getByText("Cliente Uno")).toBeTruthy();
  });

  it("avisa cuando la lista llegó al tope", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} contenedores={DATOS} tope={500} />);
    expect(screen.getByText(/Se muestran los 500 embarques más recientes/)).toBeTruthy();
  });
});
