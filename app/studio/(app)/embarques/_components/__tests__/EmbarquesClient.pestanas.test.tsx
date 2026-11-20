/**
 * SDD-0682 §2.5 · Embarques abre en «Activos» y lo que va en el mar está en «En
 * camino» (opción (a), elegida por Sam el 2026-11-19).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShipmentListRow } from "@/lib/studio/shipment-queries";

vi.mock("../../actions", () => ({
  deleteShipmentsAction: vi.fn(),
  leerPlanDeBorradoAction: vi.fn(),
  ejecutarPasoDeBorradoAction: vi.fn(),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

const { EmbarquesClient } = await import("../EmbarquesClient");

function envio(i: number, status: ShipmentListRow["status"]): ShipmentListRow {
  return {
    id: `s-${i}`,
    code: `S-2026-${String(i).padStart(4, "0")}`,
    client_name: "Cliente de prueba",
    client_markbox: `DTD-00${i}`,
    origin: "Yiwu",
    destination: "Valencia",
    shipment_service: "puerta_a_puerta_DDP",
    status,
    weight_kg: null,
    volume_m3: 1,
    created_at: `2026-10-0${i}T10:00:00Z`,
  };
}

const ENVIOS = [
  envio(1, "in_warehouse"),
  envio(2, "in_transit"),
  envio(3, "shipped"),
  envio(4, "in_customs"),
  envio(5, "delivered"),
];

afterEach(cleanup);

function pestana(nombre: RegExp) {
  return screen.getByRole("button", { name: nombre });
}

describe("EmbarquesClient · pestañas (SDD-0682)", () => {
  it("abre en «Activos», con «En camino» como pestaña aparte y los conteos de la regla", () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    const activos = pestana(/^Activos/);
    expect(activos.getAttribute("aria-pressed")).toBe("true");
    // Activos: bodega China + aduana. En camino: tránsito + embarcado.
    expect(activos.textContent).toContain("2");
    const camino = pestana(/^En camino/);
    expect(camino.getAttribute("aria-pressed")).toBe("false");
    expect(camino.textContent).toContain("2");
    expect(pestana(/^Entregados/).textContent).toContain("1");
    expect(pestana(/^Todos/).textContent).toContain("5");
  });

  it("«En camino» se puede elegir", async () => {
    render(<EmbarquesClient shipments={ENVIOS} adjuntos={undefined} />);
    await userEvent.click(pestana(/^En camino/));
    expect(pestana(/^En camino/).getAttribute("aria-pressed")).toBe("true");
    expect(pestana(/^Activos/).getAttribute("aria-pressed")).toBe("false");
  });
});
