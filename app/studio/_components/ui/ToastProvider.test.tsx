import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { readFileSync } from "node:fs";
import {
  ToastProvider,
  useToast,
  type ToastApi,
} from "./ToastProvider";

interface MatchMediaController {
  setMobile: (mobile: boolean) => void;
}

function CaptureApi({ onReady }: { onReady: (api: ToastApi) => void }) {
  const toastApi = useToast();
  useEffect(() => onReady(toastApi), [onReady, toastApi]);
  return <button type="button">Control previo</button>;
}

function installMatchMedia(initialMobile = false): MatchMediaController {
  let matches = initialMobile;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: "(max-width: 767px)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  });

  return {
    setMobile(mobile) {
      matches = mobile;
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
      act(() => listeners.forEach((listener) => listener(event)));
    },
  };
}

function renderProvider() {
  const captured: { current: ToastApi | null } = { current: null };
  render(
    <ToastProvider>
      <CaptureApi onReady={(api) => { captured.current = api; }} />
    </ToastProvider>,
  );
  const result = captured.current;
  if (!result) throw new Error("Toast API no disponible");
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  installMatchMedia(false);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ToastProvider · AVS-01", () => {
  it("mantiene la API heredada y sus duraciones de 5 y 8 segundos", () => {
    const toast = renderProvider();

    act(() => toast.success("Guardado"));
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByText("Guardado")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Guardado")).not.toBeInTheDocument();

    act(() => toast.info("Consulta lista", { link: { href: "/studio", label: "Ver" } }));
    act(() => vi.advanceTimersByTime(7_999));
    expect(screen.getByText("Consulta lista")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Consulta lista")).not.toBeInTheDocument();
  });

  it("permite descartar de inmediato el ID devuelto por la API heredada", () => {
    const toast = renderProvider();
    act(() => {
      const id = toast.success("Efímero");
      toast.dismiss(id);
    });
    expect(screen.queryByText("Efímero")).not.toBeInTheDocument();
  });

  it("expone neutral y respeta default, action, undo y persistent", () => {
    const toast = renderProvider();

    act(() =>
      toast.show({
        eventKey: "test:neutral",
        tone: "neutral",
        message: "Neutral",
        priority: "normal",
        scope: "page",
        dedupeKey: "neutral",
      }),
    );
    expect(screen.getByText("Neutral").closest("[role=status]")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText("Neutral")).not.toBeInTheDocument();

    act(() =>
      toast.show({
        eventKey: "test:action",
        tone: "info",
        message: "Acción",
        priority: "normal",
        scope: "page",
        dedupeKey: "action",
        duration: "action",
      }),
    );
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.queryByText("Acción")).not.toBeInTheDocument();

    act(() =>
      toast.show({
        eventKey: "test:undo",
        tone: "warning",
        message: "Deshacer",
        priority: "normal",
        scope: "page",
        dedupeKey: "undo",
        duration: "undo",
      }),
    );
    act(() => vi.advanceTimersByTime(9_999));
    expect(screen.getByText("Deshacer")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Deshacer")).not.toBeInTheDocument();

    act(() =>
      toast.show({
        eventKey: "test:persistent",
        tone: "error",
        message: "Persistente",
        priority: "high",
        scope: "system",
        dedupeKey: "persistent",
        duration: "persistent",
        urgent: true,
      }),
    );
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Persistente").closest("[role=alert]")).toBeInTheDocument();
  });

  it("el deadline absoluto vence aunque el aviso esté pausado", () => {
    const toast = renderProvider();
    act(() =>
      toast.show({
        eventKey: "comment:undo",
        tone: "warning",
        message: "Comentario eliminado.",
        priority: "high",
        scope: "module",
        dedupeKey: "comment:undo:c1",
        duration: "persistent",
        actionExpiresAt: new Date(Date.now() + 1_000).toISOString(),
        actionExpiredMessage: "Terminó la ventana inmediata para deshacer.",
        action: { label: "Deshacer", onSelect: vi.fn() },
      }),
    );
    const card = screen.getByText("Comentario eliminado.").closest("[role=status]");
    fireEvent.mouseEnter(card!);
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();

    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    expect(
      screen.getByText("Terminó la ventana inmediata para deshacer."),
    ).toBeInTheDocument();
  });

  it("inicia el deadline relativo desde el reloj local del navegador", () => {
    const toast = renderProvider();
    act(() =>
      toast.show({
        eventKey: "comment:undo-relative",
        tone: "warning",
        message: "Comentario eliminado con tiempo relativo.",
        priority: "high",
        scope: "module",
        dedupeKey: "comment:undo-relative:c1",
        duration: "persistent",
        actionDurationMs: 1_000,
        actionExpiredMessage: "Terminó la ventana inmediata para deshacer.",
        action: { label: "Deshacer", onSelect: vi.fn() },
      }),
    );

    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeEnabled();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
  });

  it("no consume el tiempo de un aviso mientras está en cola", () => {
    const toast = renderProvider();
    act(() => {
      toast.success("Visible 1", { durationMs: 1_000 });
      toast.success("Visible 2", { durationMs: 1_000 });
      toast.success("Visible 3", { durationMs: 1_000 });
      toast.success("Pendiente", { durationMs: 1_000 });
    });

    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
  });

  it("combina motivos de pausa y conserva el tiempo restante", () => {
    const toast = renderProvider();
    act(() => toast.success("Pausable", { durationMs: 1_000 }));
    const card = screen.getByText("Pausable").closest("[role=status]");
    expect(card).not.toBeNull();

    act(() => vi.advanceTimersByTime(200));
    fireEvent.mouseEnter(card!);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    fireEvent.mouseLeave(card!);
    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByText("Pausable")).toBeInTheDocument();

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(799));
    expect(screen.getByText("Pausable")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Pausable")).not.toBeInTheDocument();
  });

  it("limita a tres avisos en escritorio y uno en móvil sin perder la cola", () => {
    const viewport = installMatchMedia(false);
    const toast = renderProvider();
    act(() => {
      for (let index = 1; index <= 4; index += 1) {
        toast.show({
          eventKey: `test:${index}`,
          tone: "info",
          message: `Aviso ${index}`,
          priority: "normal",
          scope: "page",
          dedupeKey: `viewport-${index}`,
          duration: "persistent",
        });
      }
    });
    expect(screen.getAllByRole("status")).toHaveLength(3);

    viewport.setMobile(true);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    viewport.setMobile(false);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.getByText("Aviso 2")).toBeInTheDocument();
  });

  it("aplica prioridad solo a pendientes y conserva FIFO dentro del nivel", () => {
    const toast = renderProvider();
    let firstVisible = "";
    act(() => {
      firstVisible = toast.show({
        eventKey: "visible:1", tone: "info", message: "Visible 1", priority: "low", scope: "page", dedupeKey: "v1", duration: "persistent",
      });
      toast.show({ eventKey: "visible:2", tone: "info", message: "Visible 2", priority: "low", scope: "page", dedupeKey: "v2", duration: "persistent" });
      toast.show({ eventKey: "visible:3", tone: "info", message: "Visible 3", priority: "low", scope: "page", dedupeKey: "v3", duration: "persistent" });
      toast.show({ eventKey: "pending:low", tone: "info", message: "Pendiente bajo", priority: "low", scope: "page", dedupeKey: "p-low", duration: "persistent" });
      toast.show({ eventKey: "pending:high:1", tone: "error", message: "Pendiente alto 1", priority: "high", scope: "system", dedupeKey: "p-high-1", duration: "persistent" });
      toast.show({ eventKey: "pending:high:2", tone: "error", message: "Pendiente alto 2", priority: "high", scope: "system", dedupeKey: "p-high-2", duration: "persistent" });
    });
    expect(screen.getByText("Visible 1")).toBeInTheDocument();
    expect(screen.queryByText("Pendiente alto 1")).not.toBeInTheDocument();

    act(() => toast.dismiss(firstVisible));
    expect(screen.getByText("Pendiente alto 1")).toBeInTheDocument();
    expect(screen.queryByText("Pendiente alto 2")).not.toBeInTheDocument();
  });

  it("reordena por prioridad los avisos devueltos a cola al pasar a móvil", () => {
    const viewport = installMatchMedia(false);
    const toast = renderProvider();
    let firstVisible = "";
    act(() => {
      firstVisible = toast.show({ eventKey: "visible:a", tone: "info", message: "Visible A", priority: "low", scope: "page", dedupeKey: "responsive-a", duration: "persistent" });
      toast.show({ eventKey: "visible:b", tone: "info", message: "Visible B", priority: "low", scope: "page", dedupeKey: "responsive-b", duration: "persistent" });
      toast.show({ eventKey: "visible:c", tone: "info", message: "Visible C", priority: "low", scope: "page", dedupeKey: "responsive-c", duration: "persistent" });
      toast.show({ eventKey: "pending:high", tone: "error", message: "Pendiente alta", priority: "high", scope: "system", dedupeKey: "responsive-high", duration: "persistent" });
    });

    viewport.setMobile(true);
    expect(screen.getByText("Visible A")).toBeInTheDocument();
    act(() => toast.dismiss(firstVisible));
    expect(screen.getByText("Pendiente alta")).toBeInTheDocument();
    expect(screen.queryByText("Visible B")).not.toBeInTheDocument();
  });

  it("deduplica sin extender el reloj de un aviso visible", () => {
    const toast = renderProvider();
    act(() =>
      toast.show({ eventKey: "save", tone: "success", message: "Primero", priority: "normal", scope: "module", dedupeKey: "save:1", duration: 1_000 }),
    );
    act(() => vi.advanceTimersByTime(750));
    act(() =>
      toast.show({ eventKey: "save", tone: "success", message: "Actualizado", priority: "high", scope: "module", dedupeKey: "save:1", duration: 5_000 }),
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Actualizado")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByText("Actualizado")).not.toBeInTheDocument();
  });

  it("bloquea doble ejecución y resuelve una acción asíncrona", async () => {
    const toast = renderProvider();
    let resolveAction: (() => void) | undefined;
    const action = vi.fn(() => new Promise<void>((resolve) => { resolveAction = resolve; }));
    act(() =>
      toast.show({
        eventKey: "undo",
        tone: "warning",
        message: "Registro archivado",
        priority: "high",
        scope: "module",
        dedupeKey: "undo:1",
        duration: "undo",
        action: { label: "Deshacer", onSelect: action },
      }),
    );
    const actionButton = screen.getByRole("button", { name: "Deshacer" });
    fireEvent.click(actionButton);
    fireEvent.click(actionButton);
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();

    await act(async () => {
      resolveAction?.();
      await Promise.resolve();
    });
    expect(screen.queryByText("Registro archivado")).not.toBeInTheDocument();
  });

  it("mantiene recuperación visible cuando falla una acción", async () => {
    const toast = renderProvider();
    const action = vi.fn().mockRejectedValue(new Error("falló"));
    act(() =>
      toast.show({
        eventKey: "retry",
        tone: "error",
        message: "No se guardó",
        priority: "high",
        scope: "module",
        dedupeKey: "retry:1",
        duration: 1_000,
        action: { label: "Reintentar", onSelect: action, failureMessage: "Revisa la conexión." },
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      await Promise.resolve();
    });
    expect(screen.getByText("No se guardó")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Revisa la conexión.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("No se guardó")).toBeInTheDocument();
  });

  it("reanuda el tiempo restante si deduplicación reemplaza un action_failed", async () => {
    const toast = renderProvider();
    act(() =>
      toast.show({
        eventKey: "retry",
        tone: "error",
        message: "Falló",
        priority: "high",
        scope: "module",
        dedupeKey: "retry:dedupe",
        duration: 1_000,
        action: {
          label: "Reintentar",
          onSelect: () => Promise.reject(new Error("falló")),
        },
      }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
      await Promise.resolve();
    });

    act(() =>
      toast.show({
        eventKey: "retry:resolved",
        tone: "info",
        message: "Estado actualizado",
        priority: "normal",
        scope: "module",
        dedupeKey: "retry:dedupe",
        duration: 5_000,
      }),
    );
    const card = screen.getByText("Estado actualizado").closest("[data-toast-id]");
    expect(card).toHaveAttribute("data-state", "visible");
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText("Estado actualizado")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Estado actualizado")).not.toBeInTheDocument();
  });

  it("Escape retira el toast enfocado y devuelve el foco", async () => {
    const toast = renderProvider();
    const previous = screen.getByRole("button", { name: "Control previo" });
    previous.focus();
    act(() => toast.info("Con foco", { durationMs: 0 }));
    const close = screen.getByRole("button", { name: /cerrar/i });
    act(() => close.focus());
    expect(close).toHaveFocus();
    await act(async () => {
      fireEvent.keyDown(close, { key: "Escape" });
      await Promise.resolve();
    });
    expect(screen.queryByText("Con foco")).not.toBeInTheDocument();
    expect(previous).toHaveFocus();
  });

  it("dismiss programático restaura el foco si el toast lo contenía", async () => {
    const toast = renderProvider();
    const previous = screen.getByRole("button", { name: "Control previo" });
    previous.focus();
    let id = "";
    act(() => {
      id = toast.info("Cierre externo", { durationMs: 0 });
    });
    const close = screen.getByRole("button", { name: /cerrar/i });
    act(() => close.focus());

    await act(async () => {
      toast.dismiss(id);
      await Promise.resolve();
    });
    expect(screen.queryByText("Cierre externo")).not.toBeInTheDocument();
    expect(previous).toHaveFocus();
  });

  it("mantiene el contrato visual móvil y de movimiento reducido", () => {
    const css = readFileSync("app/studio/studio.css", "utf8");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("--studio-toast-keyboard-offset");
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.studio-toast[\s\S]*width: 100%/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.studio-toast[\s\S]*animation: none !important/,
    );
  });
});
