/**
 * Borrado de direcciones: confirmación, espera y resultado por fila.
 * React/useActionState/useFormStatus son reales; sólo se sustituye la frontera
 * Server Action. Las promesas controladas evitan depender de tiempos o red.
 */
import { Component, type ReactNode } from "react";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientDeliveryAddress } from "@/lib/studio/client-address-types";
import type { AddressActionState } from "./address-actions";

const actions = vi.hoisted(() => ({
  deleteAddressAction: vi.fn(),
  setDefaultAddressAction: vi.fn(),
  addAddressAction: vi.fn(),
  updateAddressAction: vi.fn(),
}));

vi.mock("./address-actions", () => actions);

const { PortalAddresses } = await import("./PortalAddresses");

type DeleteResult = AddressActionState & { correlationId?: string };
const unsettled = new Set<(state: DeleteResult) => void>();

function deferredDelete() {
  let resolve!: (state: DeleteResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<DeleteResult>((resolvePromise, rejectPromise) => {
    resolve = (state) => {
      unsettled.delete(resolve);
      resolvePromise(state);
    };
    reject = (error) => {
      unsettled.delete(resolve);
      rejectPromise(error);
    };
  });
  unsettled.add(resolve);
  return { promise, resolve, reject };
}

const ADDRESSES: ClientDeliveryAddress[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    clientId: "33333333-3333-4333-8333-333333333333",
    label: "Casa de prueba",
    line: "Dirección ficticia A, local de prueba 1",
    city: "Valencia",
    citySlug: null,
    state: "Carabobo",
    reference: null,
    isDefault: false,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    clientId: "33333333-3333-4333-8333-333333333333",
    label: "Oficina de prueba",
    line: "Dirección ficticia B, local de prueba 2",
    city: "Valencia",
    citySlug: null,
    state: "Carabobo",
    reference: null,
    isDefault: false,
  },
];

function row(index: number) {
  const element = screen.getByText(ADDRESSES[index].line).closest("li");
  expect(element).not.toBeNull();
  return within(element!);
}

async function confirmDelete(user: ReturnType<typeof userEvent.setup>, index = 0) {
  await user.click(row(index).getByRole("button", { name: /^eliminar$/i }));
  await user.click(row(index).getByRole("button", { name: /^sí, eliminar$/i }));
  await waitFor(() => expect(actions.deleteAddressAction).toHaveBeenCalled());
}

function submittedAddressId(callIndex = 0) {
  // El legacy recibe FormData; useActionState recibe (prev, FormData).
  // Aceptar ambos aquí prueba la UI rota, no una diferencia de firma del fake.
  const args = actions.deleteAddressAction.mock.calls[callIndex];
  const formData = args.at(-1);
  expect(formData).toBeInstanceOf(FormData);
  return (formData as FormData).get("addressId");
}

async function expectFocusedError(message: string | RegExp) {
  const alert = await row(0).findByRole("alert");
  expect(alert).toHaveTextContent(message);
  await waitFor(() => {
    // El bloque enfocado puede ser el alert o su contenedor accesible.
    const active = document.activeElement;
    expect(active).not.toBe(document.body);
    expect(active === alert || active?.contains(alert)).toBe(true);
  });
  return alert;
}

/** Evita que un rechazo legacy sin manejo se convierta en error del runner. */
class UnhandledActionBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <p role="alert">La pantalla se perdió por un error sin recuperar.</p>
    ) : (
      this.props.children
    );
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.addAddressAction.mockResolvedValue({});
  actions.setDefaultAddressAction.mockResolvedValue(undefined);
});

afterEach(async () => {
  cleanup();
  // También libera solicitudes si una aserción RED interrumpió el escenario.
  await act(async () => {
    for (const resolve of unsettled) {
      resolve({ error: "Solicitud de prueba finalizada." });
    }
  });
});

describe("PortalAddresses · resultado del borrado por fila", () => {
  it("sólo envía la dirección confirmada; armar y cancelar no envían", async () => {
    const user = userEvent.setup();
    const request = deferredDelete();
    actions.deleteAddressAction.mockReturnValue(request.promise);
    render(<PortalAddresses addresses={ADDRESSES} />);

    await user.click(row(0).getByRole("button", { name: /^eliminar$/i }));
    expect(actions.deleteAddressAction).not.toHaveBeenCalled();
    expect(row(0).getByText(/¿Eliminar «Casa de prueba»\?/)).toBeVisible();
    expect(row(0).getByRole("button", { name: /^cancelar$/i })).toHaveFocus();
    expect(row(1).queryByRole("button", { name: /^sí, eliminar$/i })).toBeNull();

    await user.click(row(0).getByRole("button", { name: /^cancelar$/i }));
    expect(actions.deleteAddressAction).not.toHaveBeenCalled();
    expect(row(0).getByRole("button", { name: /^eliminar$/i })).toHaveFocus();
    expect(row(0).getByRole("button", { name: /^editar$/i })).toBeEnabled();
    expect(row(0).getByRole("button", { name: /^predeterminar$/i })).toBeEnabled();

    await confirmDelete(user);
    expect(actions.deleteAddressAction).toHaveBeenCalledTimes(1);
    expect(submittedAddressId()).toBe(ADDRESSES[0].id);
  });

  it("en espera bloquea repetir y Cancelar sólo en esa fila, sin ocultar la dirección", async () => {
    const user = userEvent.setup();
    const request = deferredDelete();
    actions.deleteAddressAction.mockReturnValue(request.promise);
    render(<PortalAddresses addresses={ADDRESSES} />);

    await confirmDelete(user);

    const submitting = row(0).getByRole("button", { name: /eliminando/i });
    expect(submitting).toBeDisabled();
    expect(submitting).toHaveAttribute("aria-busy", "true");
    const cancel = row(0).getByRole("button", { name: /^cancelar$/i });
    expect(cancel).toBeDisabled();
    await user.click(submitting);
    await user.click(cancel);
    expect(actions.deleteAddressAction).toHaveBeenCalledTimes(1);
    expect(row(0).getByText(ADDRESSES[0].line)).toBeVisible();
    expect(row(0).getByText(/¿Eliminar «Casa de prueba»\?/)).toBeVisible();
    expect(row(0).queryByRole("button", { name: /editar|predeterminar/i })).toBeNull();

    // La espera de A no bloquea ni confirma el borrado de B.
    expect(row(1).getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
    await user.click(row(1).getByRole("button", { name: /^eliminar$/i }));
    expect(row(1).getByRole("button", { name: /^cancelar$/i })).toBeEnabled();
    await user.click(row(1).getByRole("button", { name: /^cancelar$/i }));
    expect(actions.deleteAddressAction).toHaveBeenCalledTimes(1);
    expect(row(0).getByRole("button", { name: /eliminando/i })).toBeDisabled();
  });

  it("muestra el error resuelto como alert persistente y enfocado, conservando ambas filas", async () => {
    const user = userEvent.setup();
    const request = deferredDelete();
    actions.deleteAddressAction.mockReturnValue(request.promise);
    const view = render(<PortalAddresses addresses={ADDRESSES} />);
    await confirmDelete(user);

    const message = "No se pudo eliminar la dirección. Intenta de nuevo.";
    await act(async () => {
      request.resolve({ error: message, correlationId: "test-delete-error" });
    });

    const alert = await expectFocusedError(message);
    expect(row(0).getByText(/Referencia para tu asesor: test-delete-error/)).toBeVisible();
    expect(row(0).getByText(ADDRESSES[0].line)).toBeVisible();
    expect(row(1).getByText(ADDRESSES[1].line)).toBeVisible();
    expect(row(1).queryByRole("alert")).toBeNull();

    // Un render del padre y una interacción en otra fila no borran el error.
    view.rerender(<PortalAddresses addresses={ADDRESSES.map((a) => ({ ...a }))} />);
    await user.click(row(1).getByRole("button", { name: /^eliminar$/i }));
    await user.click(row(1).getByRole("button", { name: /^cancelar$/i }));
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent(message);
    expect(actions.deleteAddressAction).toHaveBeenCalledTimes(1);
  });

  it("permite reintentar la misma dirección tras error y sólo confirma éxito al resolverse", async () => {
    const user = userEvent.setup();
    const first = deferredDelete();
    const retry = deferredDelete();
    actions.deleteAddressAction
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    render(<PortalAddresses addresses={ADDRESSES} />);
    await confirmDelete(user);
    await act(async () => {
      first.resolve({ error: "No se pudo eliminar la dirección. Intenta de nuevo." });
    });
    await expectFocusedError(/no se pudo eliminar/i);

    await user.click(
      row(0).getByRole("button", { name: /^(sí, eliminar|reintentar)$/i }),
    );
    await waitFor(() => expect(actions.deleteAddressAction).toHaveBeenCalledTimes(2));
    expect(submittedAddressId(1)).toBe(ADDRESSES[0].id);
    expect(row(0).getByText(ADDRESSES[0].line)).toBeVisible();
    expect(row(0).getByRole("button", { name: /eliminando/i })).toBeDisabled();
    expect(row(0).queryByRole("status")).toBeNull();

    await act(async () => {
      retry.resolve({ ok: true });
    });
    const status = await row(0).findByRole("status");
    expect(status).toHaveTextContent(/dirección eliminada/i);
    expect(status).toHaveFocus();
    expect(row(0).queryByRole("alert")).toBeNull();
    expect(row(0).queryByRole("button", { name: /eliminar|reintentar/i })).toBeNull();
    expect(row(1).getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
  });

  it("no elimina optimistamente y retira controles repetibles sólo después de ok:true", async () => {
    const user = userEvent.setup();
    const request = deferredDelete();
    actions.deleteAddressAction.mockReturnValue(request.promise);
    render(<PortalAddresses addresses={ADDRESSES} />);
    await confirmDelete(user);

    expect(row(0).getByText(ADDRESSES[0].line)).toBeVisible();
    expect(row(0).queryByRole("status")).toBeNull();
    expect(row(1).queryByRole("button", { name: /^sí, eliminar$/i })).toBeNull();

    await act(async () => {
      request.resolve({ ok: true });
    });

    expect(await row(0).findByRole("status")).toHaveTextContent(/dirección eliminada/i);
    expect(row(0).queryByRole("button", { name: /eliminar|reintentar|cancelar|editar|predeterminar/i })).toBeNull();
    expect(row(0).queryByText(/¿Eliminar/)).toBeNull();
    expect(actions.deleteAddressAction).toHaveBeenCalledTimes(1);
    expect(row(1).getByText(ADDRESSES[1].line)).toBeVisible();
    expect(row(1).getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
    expect(row(1).queryByRole("status")).toBeNull();
  });

  it("un rechazo inesperado conserva la fila y ofrece error recuperable sin filtrar el detalle", async () => {
    const user = userEvent.setup();
    const request = deferredDelete();
    actions.deleteAddressAction.mockReturnValue(request.promise);
    render(
      <UnhandledActionBoundary>
        <PortalAddresses addresses={ADDRESSES} />
      </UnhandledActionBoundary>,
      { onCaughtError: () => {} },
    );
    await confirmDelete(user);

    await act(async () => {
      request.reject(new Error("detalle-interno-de-transporte-no-publicable"));
    });

    await expectFocusedError(/no se pudo eliminar|no pudimos eliminar|no se pudo completar/i);
    expect(row(0).getByText(ADDRESSES[0].line)).toBeVisible();
    expect(screen.queryByText(/detalle-interno-de-transporte-no-publicable/)).toBeNull();
    expect(row(0).getByRole("button", { name: /^(sí, eliminar|reintentar)$/i })).toBeEnabled();
    expect(row(0).getByRole("button", { name: /^cancelar$/i })).toBeEnabled();
    expect(row(1).getByRole("button", { name: /^eliminar$/i })).toBeEnabled();
  });
});
