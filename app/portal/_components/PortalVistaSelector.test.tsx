/**
 * SDD-0654 fase 1 · selector «Vista simple / Vista Pro» (AC-6).
 *
 * Dos botones con aria-pressed dentro de un grupo con nombre. Cambia al
 * instante, guarda con la acción del servidor y refresca; si no pudo guardar,
 * vuelve a la vista de antes y lo dice en un aviso visible.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("el aviso de error se cierra solo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setPortalVistaAction.mockResolvedValue({ ok: false });
      render(<PortalVistaSelector vista="pro" />);
      fireEvent.click(boton("Vista simple"));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
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

  it("en teléfono, el panel trae las dos vistas, «Comparar» y, en la simple, «Guía»", () => {
    render(<PortalVistaSelector vista="simple" />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar de vista/ }));
    expect(screen.getAllByRole("group", { name: "Vista del portal" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Comparar las dos vistas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Guía" })).toHaveAttribute("href", "/portal?guia=1");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Comparar las dos vistas" })).not.toBeInTheDocument();
  });

  it("en la Vista Pro el panel no trae «Guía»", () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(screen.getByRole("button", { name: /cambiar de vista/ }));
    expect(screen.queryByRole("link", { name: "Guía" })).not.toBeInTheDocument();
  });
});
