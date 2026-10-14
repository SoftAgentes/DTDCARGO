/**
 * SDD-0507 · Tracking: cada tarjeta dice si tiene adjuntos, y el filtro de la
 * barra lateral deja ver sólo los que tienen o sólo los que no.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveShipmentList, type ActiveShipmentRow } from "../ActiveShipmentList";
import { conteoEmbarque, type ConteoEmbarque, type ConteosPorId } from "@/lib/studio/documents/adjuntos";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function envio(i: number): ActiveShipmentRow {
  return {
    id: `s-${i}`, code: `S-2026-000${i}`, client_name: "Carmen Elena Sifontes",
    client_markbox: "DTD-0415", origin: "Yiwu", destination: "Maracaibo",
    shipment_service: "puerta_a_puerta_DDP", status: "in_transit",
    created_at: "2026-10-01T10:00:00Z", arrived_destination_at: null,
  };
}

const ENVIOS = [envio(1), envio(2)];
const CONTEOS: Record<string, ConteoEmbarque> = { "s-1": conteoEmbarque(1, 1) };

function pintar(adjuntos: ConteosPorId<ConteoEmbarque>) {
  return render(<ActiveShipmentList shipments={ENVIOS} selectedId="s-1" adjuntos={adjuntos} />);
}

const tarjeta = (code: string) => screen.getByText(code).closest("button")!;
const codigos = () => ["S-2026-0001", "S-2026-0002"].filter((c) => screen.queryByText(c) !== null);

afterEach(cleanup);

describe("ActiveShipmentList · adjuntos (SDD-0507)", () => {
  it("cada tarjeta lo dice con palabras", () => {
    pintar(CONTEOS);
    expect(within(tarjeta("S-2026-0001")).getByText("adjuntos").parentElement?.textContent).toBe(
      "2 adjuntos",
    );
    expect(within(tarjeta("S-2026-0002")).getByText("Sin adjuntos")).toBeTruthy();
  });

  it("el filtro deja sólo los que tienen, o sólo los que no", async () => {
    pintar(CONTEOS);
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "con");
    expect(codigos()).toEqual(["S-2026-0001"]);
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "sin");
    expect(codigos()).toEqual(["S-2026-0002"]);
  });

  it("si el filtro vacía la lista, lo dice", async () => {
    pintar({ "s-1": conteoEmbarque(0, 0), "s-2": conteoEmbarque(0, 0) });
    await userEvent.selectOptions(screen.getByLabelText("Adjuntos"), "con");
    expect(screen.getByText("Ningún envío activo tiene adjuntos.")).toBeTruthy();
  });

  it("si no se pudo contar: lo dice, sin filtro ni «Sin adjuntos»", () => {
    pintar(null);
    expect(screen.getByRole("status").textContent).toBe("No se pudieron contar los adjuntos.");
    expect(screen.queryByLabelText("Adjuntos")).toBeNull();
    expect(screen.queryByText("Sin adjuntos")).toBeNull();
    expect(codigos()).toHaveLength(2);
  });
});
