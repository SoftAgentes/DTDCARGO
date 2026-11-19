/**
 * SDD-0678 fase 2 · DrawerFooter (el submit de 66 drawers) cumple BTN-01 §5 al guardar: deshabilitado, `aria-busy`,
 * el verbo en progreso y el MISMO ancho (las dos etiquetas reservan su espacio en la misma celda).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DrawerFooter } from "./DrawerShell";

afterEach(cleanup);

const pie = (isPending: boolean, canSubmit = true) =>
  render(
    <DrawerFooter
      formId="f"
      onClose={vi.fn()}
      isPending={isPending}
      canSubmit={canSubmit}
      submitLabel="Crear ciudad"
      pendingLabel="Creando ciudad…"
    />,
  );

function celdas(boton: HTMLElement) {
  const reposo = boton.querySelector<HTMLElement>('[data-etiqueta="reposo"]');
  const pendiente = boton.querySelector<HTMLElement>('[data-etiqueta="pendiente"]');
  if (!reposo || !pendiente) throw new Error("falta una de las dos etiquetas: el ancho ya no se reserva");
  return { reposo, pendiente };
}

describe("DrawerFooter · estado de trabajo (BTN-01 §5)", () => {
  it("en reposo: nombre del submit, aria-busy=false y el espacio de «Creando…» ya reservado", () => {
    pie(false);
    const boton = screen.getByRole("button", { name: "Crear ciudad" });
    expect(boton).toBeEnabled();
    expect(boton).toHaveAttribute("aria-busy", "false");
    const { reposo, pendiente } = celdas(boton);
    expect(reposo.parentElement).toBe(pendiente.parentElement);
    expect(reposo.parentElement?.style.display).toBe("inline-grid");
    expect(reposo.style.gridArea).toBe(pendiente.style.gridArea);
    expect(pendiente).toHaveTextContent("Creando ciudad…");
    expect(pendiente.style.visibility).toBe("hidden");
  });

  it("mientras guarda: deshabilitado, aria-busy, «Creando ciudad…» visible y la etiqueta de reposo reservando su ancho", () => {
    pie(true);
    const boton = screen.getByRole("button", { name: "Creando ciudad…" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "true");
    const { reposo, pendiente } = celdas(boton);
    expect(pendiente.style.visibility).toBe("visible");
    expect(reposo.style.visibility).toBe("hidden");
    for (const c of [reposo, pendiente]) expect(c.style.display).not.toBe("none");
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  it("deshabilitado por validación no se anuncia como trabajando", () => {
    pie(false, false);
    const boton = screen.getByRole("button", { name: "Crear ciudad" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "false");
  });
});
