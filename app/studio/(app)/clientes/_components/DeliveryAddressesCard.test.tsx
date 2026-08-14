/**
 * SDD-0262 · Borrar una dirección de entrega exige confirmación.
 *
 * Estos tests fallan si el arreglo se revierte: antes del SDD-0262 el `onClick`
 * del botón "Eliminar" llamaba a la acción directo, así que el primer caso
 * ("abrir el diálogo no borra") es rojo apenas alguien vuelva al patrón viejo.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryAddressesCard } from "./DeliveryAddressesCard";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  deleteClientAddressAction: vi.fn(),
  setDefaultClientAddressAction: vi.fn(),
  addClientAddressAction: vi.fn(),
  success: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("../actions", () => ({
  deleteClientAddressAction: mocks.deleteClientAddressAction,
  setDefaultClientAddressAction: mocks.setDefaultClientAddressAction,
  addClientAddressAction: mocks.addClientAddressAction,
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: mocks.success, error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const CLIENT_ID = "40000000-0000-4000-8000-000000000001";

function direccion(over: Partial<ClientDeliveryAddress> = {}): ClientDeliveryAddress {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    clientId: CLIENT_ID,
    label: "Casa",
    line: "Av. Bolívar, Res. Aurora, apto 4-B",
    city: "Valencia",
    citySlug: "valencia",
    state: "Carabobo",
    reference: null,
    isDefault: false,
    ...over,
  };
}

function renderCard(addresses: ClientDeliveryAddress[]) {
  return render(
    <DeliveryAddressesCard
      clientId={CLIENT_ID}
      markbox="DTD-1234"
      addresses={addresses}
    />,
  );
}

async function abrirDialogo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Eliminar" }));
  return screen.getByRole("dialog", { name: "Eliminar dirección" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteClientAddressAction.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("DeliveryAddressesCard · borrado con confirmación (SDD-0262)", () => {
  it("abrir el diálogo NO borra", async () => {
    const user = userEvent.setup();
    renderCard([direccion()]);

    const dialog = await abrirDialogo(user);

    expect(mocks.deleteClientAddressAction).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
  });

  it("nombra la dirección y dice la consecuencia", async () => {
    const user = userEvent.setup();
    renderCard([direccion()]);

    const dialog = await abrirDialogo(user);

    // El registro se nombra DENTRO del diálogo (MP-01 §3 R2). Se acota con
    // `within` porque la dirección también está en la fila de la card: sin
    // acotar, el aserto pasaría por el texto de la fila y no probaría nada.
    expect(
      within(dialog).getByText(/Av\. Bolívar, Res\. Aurora, apto 4-B/),
    ).toBeVisible();
    // … y la consecuencia se expresa (SGE-00.11), sin prometer recuperación
    // (BTN-01 §3 prohíbe prometer lo que hoy dependería de soporte).
    expect(
      within(dialog).getByText(/no se puede recuperar desde el Studio/),
    ).toBeVisible();
  });

  it("avisa que borrar la predeterminada deja al cliente sin dirección de entrega", async () => {
    const user = userEvent.setup();
    renderCard([direccion({ isDefault: true })]);

    await abrirDialogo(user);

    expect(
      screen.getByText(/queda sin dirección de entrega hasta que marques otra/),
    ).toBeVisible();
  });

  it("el foco inicial es Cancelar y Escape cierra sin borrar (BTN-01 §4)", async () => {
    const user = userEvent.setup();
    renderCard([direccion()]);

    await abrirDialogo(user);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.deleteClientAddressAction).not.toHaveBeenCalled();
  });

  it("confirmar borra UNA sola vez, con el markbox y el id de esa dirección", async () => {
    const user = userEvent.setup();
    const a = direccion();
    renderCard([a]);

    await abrirDialogo(user);
    await user.click(screen.getByRole("button", { name: "Eliminar dirección" }));

    await waitFor(() =>
      expect(mocks.deleteClientAddressAction).toHaveBeenCalledTimes(1),
    );
    expect(mocks.deleteClientAddressAction).toHaveBeenCalledWith("DTD-1234", a.id);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("si la acción falla, el diálogo NO se cierra y muestra el error (SGE-00.07)", async () => {
    mocks.deleteClientAddressAction.mockResolvedValue({
      error: "No se pudo eliminar la dirección: permiso denegado",
    });
    const user = userEvent.setup();
    renderCard([direccion()]);

    await abrirDialogo(user);
    await user.click(screen.getByRole("button", { name: "Eliminar dirección" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("permiso denegado");
    expect(screen.getByRole("dialog", { name: "Eliminar dirección" })).toBeVisible();
    // No se anuncia un éxito que no ocurrió.
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
