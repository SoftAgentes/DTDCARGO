/**
 * ActionButton · el temporizador del flash de éxito no sobrevive al desmontaje.
 *
 * En CI salía un error sin capturar («ReferenceError: window is not defined», desde el setTimeout de la línea del
 * flash de éxito) cuando una prueba terminaba antes de los 2,5 s del flash y jsdom ya se había cerrado. El
 * temporizador seguía vivo y llamaba a setSuccess sobre un componente desmontado.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionButton } from "./ActionButton";

vi.mock("@/lib/i18n", () => ({ useT: () => (k: string) => k }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function clickYResolver() {
  fireEvent.click(screen.getByRole("button"));
  // Deja correr la transición y la promesa de onAction.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ActionButton · temporizador del flash de éxito", () => {
  it("muestra el éxito y vuelve a idle tras successMs", async () => {
    render(<ActionButton idleLabel="Enviar" successLabel="Enviado" successMs={1000} onAction={async () => {}} />);
    await clickYResolver();
    expect(screen.getByRole("button").textContent).toContain("Enviado");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button").textContent).toContain("Enviar");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("al desmontar durante el flash, el temporizador se cancela (no queda ninguno pendiente)", async () => {
    const { unmount } = render(
      <ActionButton idleLabel="Enviar" successLabel="Enviado" successMs={2500} onAction={async () => {}} />,
    );
    await clickYResolver();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("si onAction termina después del desmontaje, no se crea ningún temporizador", async () => {
    let terminar: () => void = () => {};
    const onAction = () => new Promise<void>((r) => (terminar = r));
    const { unmount } = render(<ActionButton idleLabel="Enviar" successLabel="Enviado" onAction={onAction} />);
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
