/**
 * SDD-0687 (revisión de la #790, B2): peso y CBM del panel «Datos del envío».
 *
 * El formulario tenía `noValidate`: un texto que NumericInput rechaza (por
 * ejemplo «1,234.5») dejaba el campo oculto vacío y la acción escribía
 * weight_kg / volume_m3 = null. Sin `noValidate`, el campo inválido bloquea el
 * envío y la acción no corre.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Shipment } from "@/lib/studio/shipment-types";

const h = vi.hoisted(() => ({ update: vi.fn(async () => ({ ok: true })) }));

vi.mock("../actions", () => ({
  updateShipment: h.update,
  changeDestination: vi.fn(),
  lookupRateForNewDestination: vi.fn(),
}));
vi.mock("../datos-reservados-actions", () => ({
  updateShipmentSinUbicacion: vi.fn(async () => ({ ok: true })),
}));
vi.mock("../_components/ChangeDestinationModal", () => ({ ChangeDestinationModal: () => null }));

import { ShipmentDataPanel } from "../_components/ShipmentDataPanel";

afterEach(() => {
  cleanup();
  h.update.mockClear();
});

const shipment = {
  id: "s1",
  status: "in_transit",
  shipment_service: "consolidado_lcl",
  client_name: null,
  client_markbox: null,
  origin: "Yiwu",
  destination: "Valencia",
  destination_gps: null,
  weight_kg: 10,
  volume_m3: 1,
  vehicle_category: null,
  vehicle_model: null,
  notes: null,
} as unknown as Shipment;

function abrir() {
  const { container } = render(<ShipmentDataPanel shipment={shipment} />);
  const form = container.querySelector("form") as HTMLFormElement;
  const peso = container.querySelector("#weight_kg") as HTMLInputElement;
  const cbm = container.querySelector("#volume_m3") as HTMLInputElement;
  const pesoOculto = container.querySelector('input[type="hidden"][name="weight_kg"]') as HTMLInputElement;
  return { form, peso, cbm, pesoOculto };
}

describe("ShipmentDataPanel · peso y CBM tecleados", () => {
  it("el formulario ya no es noValidate", () => {
    const { form } = abrir();
    expect(form.noValidate).toBe(false);
  });

  it.each(["1,234.5", "12,34567", "1.234.5"])(
    "«%s» en el peso deja el formulario inválido y no envía",
    (texto) => {
      const { form, peso } = abrir();
      fireEvent.change(peso, { target: { value: texto } });
      expect(peso.validity.valid).toBe(false);
      expect(form.checkValidity()).toBe(false);

      form.requestSubmit();
      expect(h.update).not.toHaveBeenCalled();
    },
  );

  it("un CBM inválido también bloquea el envío", () => {
    const { form, cbm } = abrir();
    fireEvent.change(cbm, { target: { value: "0,12345" } });
    expect(form.checkValidity()).toBe(false);
  });

  it("el peso humano rechaza miles y acepta el equivalente sin agrupación", () => {
    const { form, peso, pesoOculto } = abrir();
    fireEvent.change(peso, { target: { value: "2.500,5" } });
    expect(form.checkValidity()).toBe(false);
    expect(pesoOculto.value).toBe("");
    expect(peso.validationMessage).toBe("Escribe el número sin puntos de miles");
    form.requestSubmit();
    expect(h.update).not.toHaveBeenCalled();
    fireEvent.change(peso, { target: { value: "2500,5" } });
    expect(form.checkValidity()).toBe(true);
    expect(pesoOculto.value).toBe("2500.5");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("la trampa del peso venezolano: «2.500» es 2,5 kg, no 2.500 kg", () => {
    const { peso, pesoOculto } = abrir();
    fireEvent.change(peso, { target: { value: "2.500" } });
    expect(pesoOculto.value).toBe("2.5");
  });
});
