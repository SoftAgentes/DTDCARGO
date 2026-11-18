/**
 * SDD-0586 (10.5, PR 1b, §10.5.20) · la tarjeta «Portal → Chatwoot» de la Bandeja: los números,
 * «Reintentar los atascados» solo cuando hay atascados, y lo que ve el admin después.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ destrabar: vi.fn() }));
vi.mock("../actions", () => ({ destrabarPortal: m.destrabar }));

const { PortalChatwoot } = await import("../_components/PortalChatwoot");

afterEach(() => {
  cleanup();
  m.destrabar.mockReset();
});

describe("PortalChatwoot", () => {
  it("apagado: lo dice y no ofrece reintentar", () => {
    render(<PortalChatwoot resumen={{ encendido: false, sinLlegar: 0, atascados: 0 }} />);
    expect(screen.getByRole("heading", { name: "Portal → Chatwoot" })).toBeTruthy();
    expect(screen.getByText("Apagado: el chat del portal no va a Chatwoot.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("encendido: los dos números, y sin atascados el botón no se puede usar y explica por qué", () => {
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 3, atascados: 0 }} />);
    expect(screen.getByText("Sin llegar hace más de 15 min").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText("Atascados").nextElementSibling?.textContent).toBe("0");
    const boton = screen.getByRole("button", { name: "Reintentar los atascados" }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute("aria-describedby")).toBe("bandeja-portal-sin-atascados");
    expect(screen.getByText("No hay mensajes atascados.")).toBeTruthy();
  });

  it("con atascados: reintenta y dice cuántos volvieron a la cola", async () => {
    m.destrabar.mockResolvedValue({ ok: true, error: null, destrabados: 2 });
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 3, atascados: 2 }} />);
    const boton = screen.getByRole("button", { name: "Reintentar los atascados" }) as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    await waitFor(() => expect(screen.getByText(/Vuelven a la cola 2 mensaje\(s\)/)).toBeTruthy());
    expect(m.destrabar).toHaveBeenCalledTimes(1);
    // El botón se deshabilitó: el foco va al resultado, no al body (ui-check).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("bandeja-portal-resultado")));
  });

  it("si no se pudo, lo dice con texto", async () => {
    m.destrabar.mockResolvedValue({ ok: false, error: "base" });
    render(<PortalChatwoot resumen={{ encendido: true, sinLlegar: 1, atascados: 1 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar los atascados" }));
    await waitFor(() => expect(screen.getByText("No se pudo guardar. Vuelve a intentarlo.")).toBeTruthy());
  });
});
