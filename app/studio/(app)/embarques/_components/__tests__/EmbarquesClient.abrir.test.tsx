/**
 * SDD-0603 · tramo 5a: la fila que se abre se nota oprimible con un control
 * real, «Abrir», que es la única parada de teclado de la fila y dice qué abre.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";

vi.mock("../ShipmentDetailDrawer", () => ({
  ShipmentDetailDrawer: ({ shipment }: { shipment: ShipmentListRow }) => (
    <div role="dialog" aria-label={`Detalle ${shipment.code}`} />
  ),
}));

import { EmbarquesClient } from "../EmbarquesClient";

function envio(i: number): ShipmentListRow {
  return {
    id: `s-${i}`, code: `S-2026-000${i}`, client_name: "Cliente de prueba",
    client_markbox: "DTD-0001", origin: "Yiwu", destination: "Valencia",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit", weight_kg: null, volume_m3: 1.2,
    created_at: `2026-10-0${i}T10:00:00Z`,
  };
}

const ENVIOS = [envio(1), envio(2)];

afterEach(cleanup);

describe("EmbarquesClient · «Abrir» en la fila (SDD-0603, tramo 5a)", () => {
  it("cada fila trae «Abrir» como secundario de tabla, con nombre que dice qué abre", () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    const botones = screen.getAllByRole("button", { name: /^Abrir embarque / });
    expect(botones).toHaveLength(ENVIOS.length);
    for (const [i, b] of botones.entries()) {
      expect(b.getAttribute("aria-label")).toBe(`Abrir embarque ${ENVIOS[i].code}`);
      expect(b.textContent).toBe("Abrir");
      expect(b.className.split(" ")).toEqual(
        expect.arrayContaining(["studio-btn", "studio-btn-ghost", "studio-btn-sm"]),
      );
      expect(b.tabIndex).toBe(0);
    }
  });

  it("la fila sigue abriendo con el ratón, pero sale del Tab: una sola parada por fila", () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    const fila = screen.getByText("S-2026-0001").closest("button")!;
    expect(fila.tabIndex).toBe(-1);
  });

  it("«Abrir» abre el mismo detalle que la fila, también con teclado", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    const abrir = screen.getByRole("button", { name: "Abrir embarque S-2026-0002" });
    abrir.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Detalle S-2026-0002" })).toBeTruthy();
  });

  it("clic en la fila abre lo mismo que antes", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    await user.click(screen.getByText("S-2026-0001"));
    expect(screen.getByRole("dialog", { name: "Detalle S-2026-0001" })).toBeTruthy();
  });

  it("el encabezado y las filas tienen las mismas columnas", () => {
    const { container } = render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    const fila = container.querySelector('[data-row-id="S-2026-0001"]') as HTMLElement;
    const datos = within(fila).getByText("S-2026-0001").closest("button") as HTMLElement;
    const cabecera = within(container).getByText("Código").parentElement as HTMLElement;
    const columnasCabecera = cabecera.style.gridTemplateColumns.match(/minmax\([^)]*\)|\S+/g)!.length;
    // [casilla | datos | Abrir] en la fila; los datos llevan las del medio.
    expect(fila.style.gridTemplateColumns).toBe("24px minmax(0, 1fr) 92px");
    expect(cabecera.style.gridTemplateColumns.endsWith(" 92px")).toBe(true);
    expect(datos.style.gridTemplateColumns.endsWith(" 92px")).toBe(false);
    expect(cabecera.children).toHaveLength(columnasCabecera);
  });
});
