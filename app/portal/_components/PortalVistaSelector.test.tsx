/**
 * SDD-0654 fase 1 · selector «Vista simple / Vista Pro» (AC-6).
 *
 * Dos botones con aria-pressed dentro de un grupo con nombre. Cambia al
 * instante, guarda con la acción del servidor y refresca; si no pudo guardar,
 * vuelve a la vista de antes y lo dice en un aviso visible.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPortalVistaAction = vi.fn();
const refresh = vi.fn();

vi.mock("../actions", () => ({
  setPortalVistaAction: (v: string) => setPortalVistaAction(v),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { PortalVistaSelector } = await import("./PortalVistaSelector");

beforeEach(() => {
  setPortalVistaAction.mockReset();
  refresh.mockReset();
});
afterEach(cleanup);

const grupo = () => screen.getByRole("group", { name: "Vista del portal" });
const boton = (nombre: RegExp) => screen.getByRole("button", { name: nombre });

describe("PortalVistaSelector", () => {
  it("muestra las dos vistas y marca la actual", () => {
    render(<PortalVistaSelector vista="pro" />);
    expect(grupo()).toBeInTheDocument();
    expect(boton(/simple/i)).toHaveAttribute("aria-pressed", "false");
    expect(boton(/pro/i)).toHaveAttribute("aria-pressed", "true");
  });

  it("cambia a simple, guarda y refresca", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: true, vista: "simple" });
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton(/simple/i));
    expect(boton(/simple/i)).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setPortalVistaAction).toHaveBeenCalledWith("simple");
    expect(screen.getByRole("status")).toHaveTextContent("Ahora ves la Vista simple.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("funciona igual desde la Vista simple", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: true, vista: "pro" });
    render(<PortalVistaSelector vista="simple" />);
    fireEvent.click(boton(/pro/i));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setPortalVistaAction).toHaveBeenCalledWith("pro");
    expect(boton(/pro/i)).toHaveAttribute("aria-pressed", "true");
  });

  it("si no pudo guardar, vuelve a la de antes y lo dice", async () => {
    setPortalVistaAction.mockResolvedValue({ ok: false });
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton(/simple/i));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cambiar la vista");
    expect(boton(/pro/i)).toHaveAttribute("aria-pressed", "true");
    expect(boton(/simple/i)).toHaveAttribute("aria-pressed", "false");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("si la acción lanza, también vuelve a la de antes", async () => {
    setPortalVistaAction.mockRejectedValue(new Error("red"));
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton(/simple/i));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(boton(/pro/i)).toHaveAttribute("aria-pressed", "true");
  });

  it("pulsar la vista actual no llama al servidor", () => {
    render(<PortalVistaSelector vista="pro" />);
    fireEvent.click(boton(/pro/i));
    expect(setPortalVistaAction).not.toHaveBeenCalled();
  });

  it("los botones tienen 44 px de alto y ancho como mínimo", () => {
    render(<PortalVistaSelector vista="pro" />);
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("min-h-[44px]");
      expect(b.className).toContain("min-w-[44px]");
    }
  });
});
