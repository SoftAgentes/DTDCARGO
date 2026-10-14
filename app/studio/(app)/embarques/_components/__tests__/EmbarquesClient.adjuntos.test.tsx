/**
 * SDD-0507 · Embarques: columna «Adjuntos» y filtro «con / sin adjuntos».
 *
 * Tres estados de la prop, tres pantallas distintas: conteos (columna +
 * filtro), `null` (no se pudo contar: se dice, sin columna ni filtro) y
 * `undefined` (sin módulo tracking: nada, ni siquiera el aviso).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EmbarquesClient } from "../EmbarquesClient";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";
import { conteoEmbarque, type ConteoEmbarque, type ConteosPorId } from "@/lib/studio/documents/adjuntos";

function envio(i: number): ShipmentListRow {
  return {
    id: `s-${i}`, code: `S-2026-000${i}`, client_name: "María Fernanda Rojas",
    client_markbox: "DTD-0418", origin: "Yiwu", destination: "Valencia",
    shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit", weight_kg: null, volume_m3: 1.2,
    created_at: `2026-10-0${i}T10:00:00Z`,
  };
}

const ENVIOS = [envio(1), envio(2), envio(3)];
const CONTEOS: Record<string, ConteoEmbarque> = {
  "s-1": conteoEmbarque(1, 1),
  "s-2": conteoEmbarque(0, 0),
  // s-3 sin entrada: cuenta como cero.
};

function pintar(adjuntos: ConteosPorId<ConteoEmbarque> | undefined) {
  return render(<EmbarquesClient shipments={ENVIOS} adjuntos={adjuntos} />);
}

const codigos = () =>
  ["S-2026-0001", "S-2026-0002", "S-2026-0003"].filter((c) => screen.queryByText(c) !== null);

afterEach(cleanup);

describe("EmbarquesClient · adjuntos (SDD-0507)", () => {
  it("cada fila dice cuántos tiene, con el desglose en title", () => {
    pintar(CONTEOS);
    const fila1 = screen.getByText("S-2026-0001").closest("button")!;
    expect(within(fila1).getByTitle("2 adjuntos: 1 interno · 1 lo ve el cliente en el portal").textContent).toBe(
      "2 adjuntos",
    );
    const fila3 = screen.getByText("S-2026-0003").closest("button")!;
    expect(within(fila3).getByText("Ninguno")).toBeTruthy();
  });

  it("el filtro deja sólo los que tienen, o sólo los que no", async () => {
    pintar(CONTEOS);
    const select = screen.getByLabelText("Adjuntos");
    await userEvent.selectOptions(select, "con");
    expect(codigos()).toEqual(["S-2026-0001"]);
    await userEvent.selectOptions(select, "sin");
    expect(codigos()).toEqual(["S-2026-0002", "S-2026-0003"]);
    await userEvent.selectOptions(select, "todos");
    expect(codigos()).toEqual(["S-2026-0001", "S-2026-0002", "S-2026-0003"]);
  });

  it("se combina con la búsqueda", async () => {
    pintar(CONTEOS);
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "sin");
    await userEvent.type(screen.getByLabelText("Buscar"), "0003");
    expect(codigos()).toEqual(["S-2026-0003"]);
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "con");
    expect(codigos()).toEqual([]);
  });

  it("si el filtro deja la vista vacía, lo explica", async () => {
    pintar({ "s-1": conteoEmbarque(0, 0), "s-2": conteoEmbarque(0, 0), "s-3": conteoEmbarque(0, 0) });
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "con");
    expect(codigos()).toEqual([]);
    expect(screen.getByText("Ningún envío de esta vista tiene adjuntos.")).toBeTruthy();
    expect(screen.getByText("Cambia el filtro «Adjuntos» a «Todos» para ver el resto.")).toBeTruthy();
  });

  it("si no se pudo contar: lo dice, y no hay columna, filtro ni «Ninguno»", () => {
    pintar(null);
    expect(screen.getByRole("status").textContent).toBe("No se pudieron contar los adjuntos.");
    expect(screen.queryByLabelText("Adjuntos")).toBeNull();
    expect(screen.queryByText("Ninguno")).toBeNull();
    expect(codigos()).toHaveLength(3);
  });

  it("sin el módulo tracking: ni columna, ni filtro, ni aviso de error", () => {
    pintar(undefined);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByLabelText("Adjuntos")).toBeNull();
    expect(screen.queryByText("Ninguno")).toBeNull();
    expect(screen.queryByText("Adjuntos")).toBeNull();
  });
});
