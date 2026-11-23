/**
 * SDD-0586 (10.5, PR 1b, §10.5.20) y SDD-0680 (adenda del 2026-11-23, variante A) · el estado del
 * chat del portal en la fila de la Bandeja: la pastilla dice el estado con icono y texto, el
 * detalle se abre al hacer clic, «Reintentar los atascados» solo existe con atascados y el admin
 * ve el resultado.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ destrabar: vi.fn() }));
vi.mock("../actions", () => ({ destrabarPortal: m.destrabar }));

const { PortalChatwoot, estadoPortal } = await import("../_components/PortalChatwoot");

afterEach(() => {
  cleanup();
  m.destrabar.mockReset();
});

const pastilla = (nombre: string | RegExp) => screen.getByRole("button", { name: nombre });

describe("estadoPortal", () => {
  it("apagado, atascados, sin llegar y al día, en ese orden de prioridad", () => {
    expect(estadoPortal({ encendido: false, sinLlegar: 5, atascados: 2 }).tono).toBe("neutral");
    expect(estadoPortal({ encendido: true, sinLlegar: 5, atascados: 2 })).toEqual({
      tono: "danger",
      clave: "bandeja.portal.pill.atascados",
      n: 2,
    });
    expect(estadoPortal({ encendido: true, sinLlegar: 3, atascados: 0 })).toEqual({
      tono: "warning",
      clave: "bandeja.portal.pill.sin_llegar",
      n: 3,
    });
    expect(estadoPortal({ encendido: true, sinLlegar: 0, atascados: 0 }).tono).toBe("success");
  });
});

describe("PortalChatwoot", () => {
  it("al día: una pastilla, sin reintentar y sin detalle hasta el clic", () => {
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 0, atascados: 0 }} />);
    const boton = pastilla("Chat del portal al día");
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(boton.getAttribute("data-tono")).toBe("success");
    expect(screen.queryByRole("button", { name: "Reintentar los atascados" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el detalle explica qué es, trae los dos números y se cierra con Escape devolviendo el foco", () => {
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 3, atascados: 0 }} />);
    const boton = pastilla("Chat del portal: 3 sin llegar");
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    const detalle = screen.getByRole("dialog", { name: "Chat del portal" });
    expect(detalle.textContent).toContain("Soporte del portal");
    // Ya no nombra la bandeja de Chatwoot por su nombre: cambiará con la SDD-0707.
    expect(detalle.textContent).not.toContain("Conversaciones del portal");
    expect(screen.getByText("Sin llegar hace más de 15 min").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText("Atascados").nextElementSibling?.textContent).toBe("0");
    expect(screen.getByText("No hay mensajes atascados.")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(boton);
  });

  it("un clic afuera cierra el detalle", () => {
    render(
      <div>
        <PortalChatwoot resumen={{ encendido: true, sinLlegar: 0, atascados: 0 }} />
        <p>afuera</p>
      </div>,
    );
    fireEvent.click(pastilla("Chat del portal al día"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.pointerDown(screen.getByText("afuera"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("apagado: lo dice en la pastilla y en el detalle, y no ofrece reintentar", () => {
    render(<PortalChatwoot resumen={{ encendido: false, sinLlegar: 0, atascados: 0 }} />);
    fireEvent.click(pastilla("Chat del portal apagado"));
    expect(screen.getByText("Apagado: lo que se escribe en el portal no llega a la Bandeja.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reintentar los atascados" })).toBeNull();
  });

  it("con atascados: reintentar queda en la fila, y al terminar el detalle se abre con el resultado", async () => {
    m.destrabar.mockResolvedValue({ ok: true, error: null, destrabados: 2 });
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 3, atascados: 2 }} />);
    expect(pastilla("Chat del portal: 2 atascado(s)").getAttribute("data-tono")).toBe("danger");
    const reintentar = screen.getByRole("button", { name: "Reintentar los atascados" }) as HTMLButtonElement;
    expect(reintentar.disabled).toBe(false);
    fireEvent.click(reintentar);
    await waitFor(() => expect(screen.getByText(/Vuelven a la cola 2 mensaje\(s\)/)).toBeTruthy());
    expect(m.destrabar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    // El foco va al resultado, no al body (ui-check).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("bandeja-portal-resultado")));
  });

  it("si no se pudo, lo dice con texto", async () => {
    m.destrabar.mockResolvedValue({ ok: false, error: "base" });
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 1, atascados: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar los atascados" }));
    await waitFor(() => expect(screen.getByText("No se pudo guardar. Vuelve a intentarlo.")).toBeTruthy());
  });
});
