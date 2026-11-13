/**
 * SDD-0627 · el stepper del detalle muestra la fecha ESTIMADA de las etapas que
 * faltan, rotulada «Est.», con una nota que dice que son estimadas. Antes del
 * zarpe (sin `estimado`) el stepper queda como antes.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PortalShipmentDetail } from "@/lib/portal/portal-types";
import { estimarSeguimiento } from "@/lib/portal/seguimiento-estimado";
import { PortalShipmentDetailNorte } from "../PortalShipmentDetailNorte";

afterEach(cleanup);

const envio: PortalShipmentDetail = {
  id: "s1",
  code: "ENV-0001",
  service: "consolidado_lcl",
  status: "shipped",
  origin: "Yiwu",
  destination: "Valencia",
  volumeM3: 1.2,
  weightKg: 300,
  arrivedDestinationAt: null,
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
};

const stepDates = {
  in_warehouse: "2026-10-05T12:00:00Z",
  consolidating: "2026-10-20T12:00:00Z",
  shipped: "2026-11-01T12:00:00Z",
};

function montar(conEstimado: boolean) {
  const estimado = conEstimado
    ? estimarSeguimiento({
        status: envio.status,
        service: envio.service,
        stepDates,
        itinerario: { transitDays: 30, pod: "PBL" },
      })
    : null;
  render(
    <PortalShipmentDetailNorte
      shipment={envio}
      documents={[]}
      signedUrls={{}}
      naviera={null}
      live={null}
      stepDates={stepDates}
      estimado={estimado}
    />,
  );
}

describe("SDD-0627 · stepper con fechas estimadas", () => {
  it("rotula «Est.» las etapas que faltan y no las cumplidas", () => {
    montar(true);
    for (const etapa of ["in_transit", "in_customs", "arrived_destination", "delivered"]) {
      const el = screen.getByTestId(`stepper-estimado-${etapa}`);
      expect(el.textContent).toMatch(/^Est\. /);
      expect(el.getAttribute("aria-label")).toMatch(/^Fecha estimada: /);
    }
    for (const etapa of ["in_warehouse", "consolidating", "shipped"]) {
      expect(screen.queryByTestId(`stepper-estimado-${etapa}`)).toBeNull();
    }
  });

  it("dice con palabras que son estimadas y desde el zarpe, sin prometer avisos", () => {
    montar(true);
    const nota = screen.getByTestId("seguimiento-estimado-nota");
    expect(nota.textContent).toMatch(/Fechas estimadas\./);
    expect(nota.textContent).toMatch(/desde el zarpe con los días de tránsito del zarpe/);
    expect(nota.textContent).not.toMatch(/te avisamos/i);
  });

  it("sin estimado (antes del zarpe) no hay «Est.» ni nota", () => {
    montar(false);
    expect(screen.queryAllByText(/^Est\. /)).toEqual([]);
    expect(screen.queryByTestId("seguimiento-estimado-nota")).toBeNull();
  });
});
