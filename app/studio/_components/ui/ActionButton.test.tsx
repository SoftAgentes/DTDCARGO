import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionButton } from "./ActionButton";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Dispara la acción y deja correr las promesas hasta que entra el flash. */
async function dispararAccion() {
  fireEvent.click(screen.getByRole("button"));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ActionButton · temporizador del flash de éxito", () => {
  it("muestra el flash y vuelve a idle pasados successMs", async () => {
    render(
      <ActionButton
        idleLabel="Enviar"
        successLabel="Enviado"
        successMs={1000}
        onAction={async () => {}}
      />,
    );
    await dispararAccion();
    expect(screen.getByRole("button")).toHaveTextContent("Enviado");
    expect(screen.getByRole("button")).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Enviar");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("al desmontar durante el flash no deja ningún temporizador vivo", async () => {
    const { unmount } = render(
      <ActionButton
        idleLabel="Enviar"
        successLabel="Enviado"
        successMs={2500}
        onAction={async () => {}}
      />,
    );
    await dispararAccion();
    expect(screen.getByRole("button")).toHaveTextContent("Enviado");
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    // Sin el cleanup el setTimeout sigue vivo y dispararía setSuccess(false)
    // sobre un componente desmontado (y sobre un jsdom cerrado en el CI).
    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });

  it("si onAction termina DESPUÉS del desmontaje, no se crea ningún temporizador", async () => {
    let terminar: () => void = () => {};
    const onAction = () => new Promise<void>((r) => (terminar = r));
    const { unmount } = render(
      <ActionButton idleLabel="Enviar" successLabel="Enviado" onAction={onAction} />,
    );
    fireEvent.click(screen.getByRole("button"));
    unmount();
    await act(async () => {
      terminar();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
