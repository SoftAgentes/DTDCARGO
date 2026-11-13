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

function montar(conEstimado: boolean, ahoraIso?: string, shipment = envio) {
  const estimado = conEstimado
    ? estimarSeguimiento({
        status: shipment.status,
        service: shipment.service,
        stepDates,
        itinerario: { transitDays: 30, pod: "PBL" },
        ahoraIso,
      })
    : null;
  render(
    <PortalShipmentDetailNorte
      shipment={shipment}
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
    expect(nota.textContent).toMatch(/desde el zarpe, con los días de tránsito del zarpe/);
    expect(nota.textContent).toMatch(/Llegada estimada a puerto: /);
    expect(nota.textContent).not.toMatch(/te avisamos/i);
  });

  it("sin estimado (antes del zarpe) no hay «Est.» ni nota", () => {
    montar(false);
    expect(screen.queryAllByText(/^Est\. /)).toEqual([]);
    expect(screen.queryByTestId("seguimiento-estimado-nota")).toBeNull();
  });
});

describe("SDD-0627 · revisión: fechas vencidas y terrestre", () => {
  it("M1 · con la ETA ya pasada no muestra fechas vencidas: «Por confirmar» y entrega pendiente", () => {
    // Zarpe 01-nov + 30 = puerto 01-dic; entrega 15-dic. «Hoy» = 2027-01-10.
    montar(true, "2027-01-10T12:00:00Z");
    expect(screen.queryAllByText(/^Est\. /)).toEqual([]);
    for (const etapa of ["in_transit", "in_customs", "arrived_destination", "delivered"]) {
      expect(screen.getByTestId(`stepper-por-confirmar-${etapa}`).textContent).toBe("Por confirmar");
    }
    expect(screen.getByText("Pendiente de confirmar")).toBeTruthy();
    const nota = screen.getByTestId("seguimiento-estimado-nota");
    expect(nota.textContent).toMatch(/La llegada a puerto está por confirmar\./);
    expect(nota.textContent).not.toMatch(/Llegada estimada a puerto: /);
  });

  it("M3 · terrestre: la nota habla del despacho, sin zarpe ni puerto", () => {
    montar(true, undefined, { ...envio, service: "transporte_terrestre" });
    const nota = screen.getByTestId("seguimiento-estimado-nota");
    expect(nota.textContent).toMatch(/desde el despacho/);
    expect(nota.textContent).not.toMatch(/zarpe|puerto|naviera/);
  });
});

describe("SDD-0627 · B2: fechas en hora de Caracas", () => {
  it("un hito registrado a las 02:00 UTC del 2-nov se muestra como 1-nov (22:00 en Caracas)", () => {
    render(
      <PortalShipmentDetailNorte
        shipment={envio}
        documents={[]}
        signedUrls={{}}
        naviera={null}
        live={null}
        stepDates={{ ...stepDates, shipped: "2026-11-02T02:00:00Z" }}
        estimado={null}
      />,
    );
    expect(screen.getAllByText(/^01.nov/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^02.nov/i)).toEqual([]);
  });
});
