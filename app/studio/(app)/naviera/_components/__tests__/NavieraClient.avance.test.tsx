/**
 * SDD-0530 · En el detalle del contenedor: «Marcar zarpado» pasa por el
 * diálogo, llama la acción real con ("zarpado") y el resumen se queda a la
 * vista aunque, al revalidar, el contenedor ya esté zarpado y el botón haya
 * cambiado a «Marcar arribado».
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { containerStats, type Consolidation, type ConsolidationItem } from "@/lib/studio/naviera/types";
import type { ConsolidationDetail } from "@/lib/studio/naviera/queries";

const mocks = vi.hoisted(() => ({ change: vi.fn(), toastSuccess: vi.fn() }));

vi.mock("../../actions", () => ({
  changeConsolidationStatus: (...a: unknown[]) => mocks.change(...a),
  closeConsolidation: vi.fn(),
  setConsolidationContainerNo: vi.fn(),
  refreshTracking: vi.fn(),
  authorizeConsolidation: vi.fn(),
  rejectConsolidation: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: vi.fn(), info: vi.fn(), warning: vi.fn(), show: vi.fn() }),
}));
// Lo que no participa del avance y dibuja SVG o lee cosas propias.
vi.mock("../ContainerIsoView", () => ({ ContainerIsoView: () => null }));
vi.mock("../PlanCargaCard", () => ({ PlanCargaCard: () => null }));

import { NavieraClient } from "../NavieraClient";

const originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});
afterAll(() => {
  if (originalOffsetParent) Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
});
beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

function detalle(status: Consolidation["status"]): ConsolidationDetail {
  const consolidation: Consolidation = {
    id: "con-1",
    tenant_id: "t1",
    ref: "DTD-CONSOL-0101",
    booking_id: null,
    sailing_id: null,
    container_type: "40HC",
    container_no: null,
    status,
    notes: null,
    requested_by_operario_id: null,
    requested_at: null,
    authorized_by: null,
    authorized_at: null,
    rejected_reason: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    deleted_at: null,
  };
  const item = (id: string, shipment: string | null): ConsolidationItem => ({
    id,
    tenant_id: "t1",
    consolidation_id: "con-1",
    shipment_id: shipment,
    client_markbox: "DTD-101",
    client_name: null,
    supplier_name: null,
    cbm: 1,
    weight_kg: 100,
    pieces: 1,
    created_at: "2026-10-01T00:00:00Z",
  });
  // Dos piezas del mismo envío, otro envío y una pieza sin envío: 2 envíos.
  const items = [item("i1", "s1"), item("i2", "s1"), item("i3", "s2"), item("i4", null)];
  return { consolidation, items, stats: containerStats(items, "40HC") };
}

function vista(status: Consolidation["status"]) {
  return (
    <NavieraClient
      sailings={[]}
      bookings={[]}
      consolidations={[detalle(status)]}
      looseCargo={[]}
      carriers={[]}
      ports={[]}
      containerTypes={[]}
      kpis={{ consolidating: 0, looseCbm: 0, looseCount: 0, openSailings: 0 }}
    />
  );
}

describe("NavieraClient · zarpe con sus envíos", () => {
  it("confirma, llama la acción y deja el resumen aunque cambie el estado", async () => {
    const user = userEvent.setup();
    mocks.change.mockResolvedValue({
      ok: true,
      avance: {
        outcome: "transitioned",
        to: "zarpado",
        destino: "shipped",
        destinoTexto: "Embarcado",
        consolidationRef: "DTD-CONSOL-0101",
        avanzados: [{ code: "ENV-101", clientMarkbox: "DTD-101" }],
        saltados: [{ code: "ENV-102", clientMarkbox: "DTD-102", motivo: "entregado", motivoTexto: "Ya está entregado" }],
        piezasSinEnvio: 1,
        avisosProgramados: 1,
      },
    });
    const { rerender } = render(vista("cerrado"));

    await user.click(screen.getByRole("button", { name: "Marcar zarpado" }));
    const dialogo = screen.getByRole("dialog", { name: "Marcar zarpado · DTD-CONSOL-0101" });
    expect(dialogo).toHaveTextContent("Los 2 envíos de DTD-CONSOL-0101 pasan a «Embarcado».");
    expect(mocks.change).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole("button", { name: "Marcar zarpado" }));

    expect(mocks.change).toHaveBeenCalledTimes(1);
    expect(mocks.change).toHaveBeenCalledWith("con-1", "zarpado");
    expect(screen.getByRole("region", { name: "Resumen del zarpe" })).toHaveTextContent(
      "1 envío pasó a Embarcado.",
    );

    // La revalidación trae el contenedor zarpado: el botón cambia, el resumen queda.
    rerender(vista("zarpado"));
    expect(screen.queryByRole("button", { name: "Marcar zarpado" })).toBeNull();
    expect(screen.getByRole("button", { name: "Marcar arribado" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Resumen del zarpe" })).toHaveTextContent(
      "ENV-102 · DTD-102 — Ya está entregado",
    );
  });

  it("«Marcar arribado» llama la acción con arribado", async () => {
    const user = userEvent.setup();
    mocks.change.mockResolvedValue({ error: "No tienes permiso para cambiar el estado de este contenedor." });
    render(vista("zarpado"));
    await user.click(screen.getByRole("button", { name: "Marcar arribado" }));
    const dialogo = screen.getByRole("dialog", { name: "Marcar arribado · DTD-CONSOL-0101" });
    expect(dialogo).toHaveTextContent("Los 2 envíos de DTD-CONSOL-0101 pasan a «En aduana».");
    await user.click(within(dialogo).getByRole("button", { name: "Marcar arribado" }));
    expect(mocks.change).toHaveBeenCalledWith("con-1", "arribado");
    expect(screen.getByRole("dialog")).toHaveTextContent("No tienes permiso para cambiar el estado de este contenedor.");
    expect(screen.queryByRole("region", { name: /Resumen del/ })).toBeNull();
  });
});
