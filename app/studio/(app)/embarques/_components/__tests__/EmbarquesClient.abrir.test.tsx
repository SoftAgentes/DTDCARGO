/**
 * SDD-0603 (tramo 5a) y SDD-0710: la fila se abre con un control real que dice
 * qué abre. Desde la 0710 ese control es el CÓDIGO (enlace de acción), ya no un
 * botón «Abrir ›» al final; el rastreo es una insignia «Rastrear» junto al progreso.
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

describe("EmbarquesClient · código e insignia en la fila (SDD-0710)", () => {
  it("CONTRATO: ninguna fila trae el botón grande «Abrir ›»", () => {
    const { container } = render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    for (const b of screen.queryAllByRole("button")) {
      expect(b.textContent?.trim()).not.toBe("Abrir");
      expect(b.className).not.toMatch(/studio-btn-ghost/);
    }
    // Ninguna fila acaba en una columna de 92 px reservada al botón.
    const fila = container.querySelector('[data-row-id="S-2026-0001"]') as HTMLElement;
    expect(fila.style.gridTemplateColumns).toBe("24px minmax(0, 1fr)");
  });

  it("el código es el control de teclado: botón de acción con nombre que dice qué abre", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    const codigos = screen.getAllByRole("button", { name: /^Abrir embarque / });
    expect(codigos).toHaveLength(ENVIOS.length);
    for (const [i, b] of codigos.entries()) {
      expect(b.textContent).toBe(ENVIOS[i].code);
      expect(b.className.split(" ")).toContain("studio-emb-codigo");
      expect(b.tabIndex).toBe(0);
    }
  });

  it("cada fila trae la insignia «Rastrear», un enlace al tracking de ese embarque", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    const enlaces = screen.getAllByRole("link", { name: /^Rastrear embarque / });
    expect(enlaces).toHaveLength(ENVIOS.length);
    for (const [i, a] of enlaces.entries()) {
      expect(a.getAttribute("aria-label")).toBe(`Rastrear embarque ${ENVIOS[i].code}`);
      expect(a.getAttribute("href")).toBe(`/studio/tracking/s-${i + 1}`);
      expect(a.textContent).toBe("Rastrear");
    }
  });

  it("la fila sigue abriendo con el ratón, sin ser parada de Tab ni anidar controles", () => {
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    const fila = screen.getByText("S-2026-0001").closest("[data-fila-datos]") as HTMLElement;
    expect(fila.tagName).toBe("DIV");
    expect(fila.querySelectorAll("button button, button a, a button")).toHaveLength(0);
  });

  it("el código abre el mismo detalle, también con teclado", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    const abrir = screen.getByRole("button", { name: "Abrir embarque S-2026-0002" });
    abrir.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Detalle S-2026-0002" })).toBeTruthy();
  });

  it("clic en la fila abre lo mismo que antes; clic en «Rastrear» no abre el detalle", async () => {
    const user = userEvent.setup();
    render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    await user.click(screen.getByRole("link", { name: "Rastrear embarque S-2026-0001" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByText("Yiwu → Valencia", { exact: false }));
    expect(screen.getAllByRole("dialog").length).toBe(1);
  });

  it("el encabezado y las filas tienen las mismas columnas", () => {
    const { container } = render(<EmbarquesClient pestanaInicial="all" shipments={ENVIOS} adjuntos={undefined} />);
    const fila = container.querySelector('[data-row-id="S-2026-0001"]') as HTMLElement;
    const datos = within(fila).getByText("S-2026-0001").closest("[data-fila-datos]") as HTMLElement;
    const cabecera = within(container).getByText("Código").parentElement as HTMLElement;
    const columnasCabecera = cabecera.style.gridTemplateColumns.match(/minmax\([^)]*\)|\S+/g)!.length;
    expect(cabecera.style.gridTemplateColumns).toBe(datos.style.gridTemplateColumns.replace(/^/, "24px "));
    expect(cabecera.children).toHaveLength(columnasCabecera);
  });
});
