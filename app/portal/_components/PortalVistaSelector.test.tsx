/**
 * SDD-0654 fase 1 · selector «Vista simple / Vista Pro» (AC-6).
 *
 * Dos botones con aria-pressed dentro de un grupo con nombre. Cambia al
 * instante, guarda con la acción del servidor y refresca; si no pudo guardar,
 * vuelve a la vista de antes y lo dice en un aviso visible.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPortalVistaAction = vi.fn();
const refresh = vi.fn();

vi.mock("../actions", () => ({
  setPortalVistaAction: (v: string) => setPortalVistaAction(v),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }), usePathname: () => "/portal" }));

const { AVISO_ERROR_MS, PortalVistaSelector } = await import("./PortalVistaSelector");

beforeEach(() => {
  setPortalVistaAction.mockReset();
  refresh.mockReset();
});
afterEach(cleanup);

const grupo = () => screen.getByRole("group", { name: "Vista del portal" });
const boton = (nombre: "Vista simple" | "Vista Pro") => screen.getByRole("button", { name: nombre });

describe("PortalVistaSelector", () => {
  it("muestra las dos vistas y marca la actual", () => {
    render(<PortalVistaSelector vista="pro" />);
    expect(grupo()).toBeInTheDocument();
    expect(boton("Vista simple")).toHaveAttribute("aria-pressed", "false");
    expect(boton("Vista Pro")).toHaveAttribute("aria-pressed", "true");
  });

  it("cambia a simple, guarda y refresca", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: true, vista: "simple" });
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton("Vista simple"));
    expect(boton("Vista simple")).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setPortalVistaAction).toHaveBeenCalledWith("simple");
    expect(screen.getByRole("status")).toHaveTextContent("Ahora ves la Vista simple.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("funciona igual desde la Vista simple", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: true, vista: "pro" });
    render(<PortalVistaSelector vista="simple" />);
    fireEvent.click(boton("Vista Pro"));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setPortalVistaAction).toHaveBeenCalledWith("pro");
    expect(boton("Vista Pro")).toHaveAttribute("aria-pressed", "true");
  });

  it("si no pudo guardar, vuelve a la de antes y lo dice", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: false });
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton("Vista simple"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cambiar la vista");
    expect(boton("Vista Pro")).toHaveAttribute("aria-pressed", "true");
    expect(boton("Vista simple")).toHaveAttribute("aria-pressed", "false");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("si la acción lanza, también vuelve a la de antes", async () => {
    setPortalVistaAction.mockRejectedValue(new Error("red"));
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton("Vista simple"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(boton("Vista Pro")).toHaveAttribute("aria-pressed", "true");
  });

  it("el aviso de error se cierra con Escape", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: false });
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton("Vista simple"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("Escape ya se escucha en el instante en que el aviso aparece en el DOM", async () => {
    // El aviso llega tras el `await` de la acción, fuera de `act`. Un listener puesto
    // en un efecto pasivo llegaba en otra tarea, después del aviso: un Escape en ese
    // hueco se perdía (la prueba de arriba fallaba al azar en la CI). El observador
    // mira en el mismo microtask en que el aviso entra al DOM.
    setPortalVistaAction.mockResolvedValue({ ok: false });
    const { container } = render(<PortalVistaSelector vista="pro" />);
    const add = vi.spyOn(document, "addEventListener");
    let escuchaba: boolean | undefined;
    const observador = new MutationObserver(() => {
      if (escuchaba === undefined && container.querySelector('[role="alert"]')) {
        escuchaba = add.mock.calls.some(([tipo]) => tipo === "keydown");
      }
    });
    observador.observe(container, { childList: true, subtree: true });
    try {
      fireEvent.click(boton("Vista simple"));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
    } finally {
      observador.disconnect();
      add.mockRestore();
    }
    expect(escuchaba).toBe(true);
  });

  it("el aviso de error se cierra solo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setPortalVistaAction.mockResolvedValue({ ok: false });
      render(<PortalVistaSelector vista="pro" />);
      fireEvent.click(boton("Vista simple"));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      // El aviso se pinta fuera de `act` (llega tras el `await` de la acción), así
      // que su efecto, el que arranca la cuenta de 6 s, puede quedar pendiente.
      // Se vacía primero dentro de `act`; desde ahí la cuenta empieza en cero.
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(AVISO_ERROR_MS - 100);
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pulsar la vista actual no llama al servidor", () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton("Vista Pro"));
    expect(setPortalVistaAction).not.toHaveBeenCalled();
  });

  it("los botones tienen 44 px de alto y ancho como mínimo", () => {
    render(<PortalVistaSelector vista="pro" />);
    for (const b of [boton("Vista simple"), boton("Vista Pro")]) {
      expect(b.className).toContain("min-h-[44px]");
      expect(b.className).toContain("min-w-[44px]");
    }
  });

  it("«Comparar» abre la comparación de las dos vistas y Escape la cierra", async () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    const dialogo = screen.getByRole("dialog", { name: /Vista simple o Vista Pro/ });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveTextContent("Cambiar de vista no borra ni mueve nada");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("en teléfono, el panel trae las dos vistas, «Comparar» y, en la simple, «Guía»; foco y Escape", () => {
    render(<PortalVistaSelector vista="simple" />);
    const disparador = screen.getByRole("button", { name: /cambiar de vista/ });
    expect(disparador).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disparador);
    expect(disparador).toHaveAttribute("aria-expanded", "true");
    const grupos = screen.getAllByRole("group", { name: "Vista del portal" });
    expect(grupos).toHaveLength(2);
    const enPanel = within(grupos[1]);
    expect(enPanel.getByRole("button", { name: "Vista simple" })).toHaveAttribute("aria-pressed", "true");
    expect(enPanel.getByRole("button", { name: "Vista Pro" })).toHaveAttribute("aria-pressed", "false");
    // El foco entra a la vista elegida.
    expect(document.activeElement).toBe(enPanel.getByRole("button", { name: "Vista simple" }));
    expect(screen.getByRole("button", { name: "Comparar las dos vistas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Guía" })).toHaveAttribute("href", "/portal?guia=1");
    // Escape cierra y devuelve el foco al botón.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Comparar las dos vistas" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(disparador);
  });

  it("en teléfono, «Comparar» del panel cierra el panel y abre la comparación", () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar de vista/ }));
    fireEvent.click(screen.getByRole("button", { name: "Comparar las dos vistas" }));
    expect(screen.getByRole("dialog", { name: /Vista simple o Vista Pro/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Comparar las dos vistas" })).not.toBeInTheDocument();
  });

  it("en teléfono, elegir la otra vista desde el panel la guarda", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: true, vista: "pro" });
    render(<PortalVistaSelector vista="simple" />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar de vista/ }));
    const enPanel = within(screen.getAllByRole("group", { name: "Vista del portal" })[1]);
    fireEvent.click(enPanel.getByRole("button", { name: "Vista Pro" }));
    await waitFor(() => expect(setPortalVistaAction).toHaveBeenCalledWith("pro"));
  });

  it("en la Vista Pro el panel no trae «Guía»", () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar de vista/ }));
    expect(screen.queryByRole("link", { name: "Guía" })).not.toBeInTheDocument();
  });
});
