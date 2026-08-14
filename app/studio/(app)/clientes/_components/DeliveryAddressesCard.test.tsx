/**
 * SDD-0262 · Borrar una dirección de entrega exige confirmación.
 *
 * Ejecuta los criterios de aceptación 1, 2, 3, 4 y 5 de la spec. El que importa
 * es el primero: ANTES, el `onClick` del botón llamaba `deleteClientAddressAction`
 * directo, así que un clic borraba. La prueba falla si esa regresión vuelve.
 *
 * El Studio pide login con contraseña, así que la pantalla real no se puede
 * verificar en el navegador desde acá. Esto es la verificación que sí se puede
 * ejecutar: el contrato del componente.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";

const deleteClientAddressAction = vi.fn();
const toastSuccess = vi.fn();
const routerRefresh = vi.fn();

vi.mock("../actions", () => ({
  deleteClientAddressAction: (...args: unknown[]) =>
    deleteClientAddressAction(...args),
  addClientAddressAction: vi.fn(),
  setDefaultClientAddressAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ success: toastSuccess, error: vi.fn(), info: vi.fn() }),
}));

const { DeliveryAddressesCard } = await import("./DeliveryAddressesCard");

// ConfirmDialog mide `offsetParent` para el foco inicial.
const originalOffsetParent = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetParent",
);
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return document.body;
    },
  });
});
afterAll(() => {
  if (originalOffsetParent) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetParent",
      originalOffsetParent,
    );
  }
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

function direccion(
  over: Partial<ClientDeliveryAddress> = {},
): ClientDeliveryAddress {
  return { ...BASE, ...over };
}

function montar(addresses: ClientDeliveryAddress[]) {
  return render(
    <DeliveryAddressesCard
      clientId="cli-1"
      markbox="DTD-1234"
      addresses={addresses}
    />,
  );
}

describe("DeliveryAddressesCard · SDD-0262 · borrar exige confirmación", () => {
  it("pulsar Eliminar NO borra: abre el diálogo (criterio 1)", async () => {
    const user = userEvent.setup();
    montar([direccion()]);

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    // Lo que esta prueba existe para impedir:
    expect(deleteClientAddressAction).not.toHaveBeenCalled();
    expect(
      screen.getByText(/¿Eliminar esta dirección de entrega\?/i),
    ).toBeTruthy();
  });

  it("el diálogo nombra la dirección y avisa que el cliente la ve en su portal (criterio 2)", async () => {
    const user = userEvent.setup();
    montar([direccion({ label: "Oficina" })]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo.textContent).toContain("Oficina");
    expect(dialogo.textContent).toContain("DTD-1234");
    expect(dialogo.textContent).toMatch(/portal/i);
  });

  it("si es la predeterminada, el mensaje lo dice (criterio 3)", async () => {
    const user = userEvent.setup();
    montar([direccion({ isDefault: true })]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    expect(screen.getByRole("dialog").textContent).toMatch(/PREDETERMINADA/);
  });

  it("sin etiqueta, nombra la dirección por su línea", async () => {
    const user = userEvent.setup();
    montar([direccion({ label: null })]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));

    expect(screen.getByRole("dialog").textContent).toContain("Av. Bolívar");
  });

  it("Cancelar no borra y cierra el diálogo (criterio 4)", async () => {
    const user = userEvent.setup();
    montar([direccion()]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));
    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(deleteClientAddressAction).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull(),
    );
  });

  it("al confirmar sí borra, con el id correcto", async () => {
    deleteClientAddressAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    montar([direccion({ id: "addr-99" })]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));
    await user.click(
      screen.getByRole("button", { name: /eliminar dirección/i }),
    );

    await waitFor(() =>
      expect(deleteClientAddressAction).toHaveBeenCalledWith(
        "DTD-1234",
        "addr-99",
      ),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("un error de la action queda DENTRO del diálogo y no lo cierra (criterio 5)", async () => {
    deleteClientAddressAction.mockResolvedValue({
      error: "No se pudo eliminar la dirección: conflicto",
    });
    const user = userEvent.setup();
    montar([direccion()]);

    await user.click(screen.getByRole("button", { name: /^eliminar$/i }));
    await user.click(
      screen.getByRole("button", { name: /eliminar dirección/i }),
    );

    await waitFor(() =>
      expect(screen.getByRole("dialog").textContent).toContain("conflicto"),
    );
    // El contexto no se pierde: el asesor ve el motivo sin reintentar a ciegas.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
