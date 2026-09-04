/**
 * SDD-0268 · Borrar una dirección desde el PORTAL exige confirmación.
 *
 * Gemelo del SDD-0262 (Studio) sobre la misma tabla, pero en la superficie del
 * cliente. Antes era un `<form action={deleteAddressAction}>` con su submit:
 * **un clic y la dirección se iba**. La primera prueba falla si esa regresión
 * vuelve.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";

const mocks = vi.hoisted(() => ({
  deleteAddressAction: vi.fn(),
  setDefaultAddressAction: vi.fn(),
  addAddressAction: vi.fn(),
  updateAddressAction: vi.fn(),
}));

vi.mock("./address-actions", () => ({
  deleteAddressAction: mocks.deleteAddressAction,
  setDefaultAddressAction: mocks.setDefaultAddressAction,
  addAddressAction: mocks.addAddressAction,
  updateAddressAction: mocks.updateAddressAction,
}));

const { PortalAddresses } = await import("./PortalAddresses");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortalAddresses · SDD-0435 · edición siempre disponible", () => {
  it("abre un formulario prellenado para la dirección propia", async () => {
    const user = userEvent.setup();
    montar({ reference: "Portón azul" });

    await user.click(screen.getByRole("button", { name: /^editar$/i }));

    expect(screen.getByRole("textbox", { name: /^dirección/i })).toHaveValue(
      BASE.line,
    );
    expect(screen.getByRole("textbox", { name: /^ciudad/i })).toHaveValue(
      BASE.city,
    );
    expect(
      screen.getByRole("textbox", { name: /punto de referencia/i }),
    ).toHaveValue("Portón azul");
    expect(
      document.querySelector('input[name="addressId"]'),
    ).toHaveAttribute("value", BASE.id);
  });

  it("editar no depende del cupo del perfil", () => {
    montar();
    expect(screen.getByRole("button", { name: /^editar$/i })).toBeEnabled();
  });
});

const BASE: ClientDeliveryAddress = {
  id: "addr-1",
  clientId: "cli-1",
  label: "Casa",
  line: "Av. Bolívar, Res. Los Pinos, apto 4B",
  city: "Valencia",
  citySlug: null,
  state: "Carabobo",
  reference: null,
  isDefault: false,
};

function montar(over: Partial<ClientDeliveryAddress> = {}) {
  return render(
    <PortalAddresses addresses={[{ ...BASE, ...over }]} cities={[]} />,
  );
}

const botonEliminar = () => screen.getByRole("button", { name: /^eliminar$/i });

describe("PortalAddresses · SDD-0268 · borrar exige confirmación", () => {
  it("pulsar Eliminar NO borra: pide confirmación (criterio 1)", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(botonEliminar());

    // Lo que esta prueba existe para impedir:
    expect(mocks.deleteAddressAction).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Eliminar/i)).toBeTruthy();
  });

  it("la confirmación nombra la dirección y dice la consecuencia (criterio 2)", async () => {
    const user = userEvent.setup();
    montar({ label: "Oficina" });

    await user.click(botonEliminar());

    // Ojo: la etiqueta también sale en la fila, así que se afirma sobre la
    // FRASE de confirmación (con las comillas angulares), no sobre el nombre
    // suelto — si no, la prueba pasaría aunque el diálogo no nombrara nada.
    expect(screen.getByText(/¿Eliminar «Oficina»\?/)).toBeTruthy();
    expect(screen.getByText(/asesor deja de verla/i)).toBeTruthy();
  });

  it("sin etiqueta, nombra la dirección por su línea", async () => {
    const user = userEvent.setup();
    montar({ label: null });

    await user.click(botonEliminar());

    expect(
      screen.getByText(/¿Eliminar «Av\. Bolívar, Res\. Los Pinos, apto 4B»\?/),
    ).toBeTruthy();
  });

  it("Cancelar no borra y vuelve al estado inicial (criterio 3)", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(botonEliminar());
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(mocks.deleteAddressAction).not.toHaveBeenCalled();
    await waitFor(() => expect(botonEliminar()).toBeTruthy());
  });

  it("sólo tras confirmar aparece el submit que dispara el borrado", async () => {
    const user = userEvent.setup();
    montar();

    expect(screen.queryByRole("button", { name: /sí, eliminar/i })).toBeNull();
    await user.click(botonEliminar());
    expect(screen.getByRole("button", { name: /sí, eliminar/i })).toBeTruthy();
  });

  it("el botón destructivo se lee como destructivo (BTN-01 §2)", async () => {
    montar();
    // Antes iba en `text-grey-500`, más apagado que "Predeterminar" al lado.
    expect(botonEliminar().className).toContain("text-status-danger");
  });
});
