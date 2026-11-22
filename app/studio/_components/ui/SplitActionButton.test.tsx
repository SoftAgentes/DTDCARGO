import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SplitActionButton,
  type SplitAction,
} from "./SplitActionButton";

const actions: SplitAction[] = [
  { key: "close", idleLabel: "Crear y cerrar", onAction: vi.fn() },
  { key: "open", idleLabel: "Crear y dejar abierta", onAction: vi.fn() },
  { key: "another", idleLabel: "Crear y empezar otra", onAction: vi.fn() },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("SplitActionButton menu", () => {
  it("ArrowDown abre y enfoca la primera opción; flechas y End recorren el menú", async () => {
    const user = userEvent.setup();
    render(<SplitActionButton memoryKey="test-menu" actions={actions} />);

    const trigger = screen.getByRole("button", {
      name: "Más opciones de la acción",
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(items[2]).toHaveFocus();
  });

  it("ArrowUp abre en la última opción y Escape restaura foco al trigger", async () => {
    const user = userEvent.setup();
    render(<SplitActionButton memoryKey="test-escape" actions={actions} />);

    const trigger = screen.getByRole("button", {
      name: "Más opciones de la acción",
    });
    trigger.focus();
    await user.keyboard("{ArrowUp}");

    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(items[2]).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("Tab cierra el menú y continúa hacia el control siguiente", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SplitActionButton memoryKey="test-tab" actions={actions} />
        <button type="button">Control siguiente</button>
      </>,
    );

    const trigger = screen.getByRole("button", {
      name: "Más opciones de la acción",
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getAllByRole("menuitem")[0]).toHaveFocus(),
    );

    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Control siguiente" }),
      ).toHaveFocus();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("abre hacia arriba cuando el espacio inferior no alcanza", async () => {
    const user = userEvent.setup();
    render(<SplitActionButton memoryKey="test-placement" actions={actions} />);

    const trigger = screen.getByRole("button", {
      name: "Más opciones de la acción",
    });
    vi.spyOn(trigger.parentElement!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 700,
      top: 700,
      right: 200,
      bottom: 740,
      left: 0,
      width: 200,
      height: 40,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });

    await user.click(trigger);
    expect(await screen.findByRole("menu")).toHaveStyle({
      bottom: "calc(100% + 6px)",
    });
  });
});

describe("SplitActionButton · temporizador del flash de éxito", () => {
  const conExito = (onAction: SplitAction["onAction"]): SplitAction[] => [
    { key: "close", idleLabel: "Crear y cerrar", successLabel: "Creado", onAction },
  ];
  const principal = () => screen.getByRole("button", { name: /Crear y cerrar|Creado/ });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("al desmontar durante el flash no deja ningún temporizador vivo", async () => {
    const { unmount } = render(
      <SplitActionButton memoryKey="test-flash" actions={conExito(async () => {})} />,
    );
    fireEvent.click(principal());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(principal()).toHaveTextContent("Creado");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("si la acción termina DESPUÉS del desmontaje, no se crea ningún temporizador", async () => {
    let terminar: () => void = () => {};
    const onAction = () => new Promise<void>((r) => (terminar = r));
    const { unmount } = render(
      <SplitActionButton memoryKey="test-flash-async" actions={conExito(onAction)} />,
    );
    fireEvent.click(principal());
    unmount();
    await act(async () => {
      terminar();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
