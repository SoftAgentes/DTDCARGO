/** SDD-0678 · el resultado de la oficina se ve (foco y desplazamiento) y dice qué se guardó. */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvisoResultado } from "./AvisoResultado";
import { detalleDelCierre, tonoDelResultado } from "./resultado";

afterEach(cleanup);

describe("AvisoResultado", () => {
  it("toma el foco y se desplaza hasta el aviso al montarse", () => {
    const desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar;
    render(<AvisoResultado tono="exito">Cierre de la conversación 27 registrado: Cumple.</AvisoResultado>);
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Cierre de la conversación 27 registrado: Cumple.");
    expect(document.activeElement).toBe(aviso);
    expect(desplazar).toHaveBeenCalledTimes(1);
  });

  it("un error es role=alert", () => {
    render(<AvisoResultado tono="error">No se pudo guardar.</AvisoResultado>);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
  });

  it("con otra key se vuelve a montar: el mismo código repetido se anuncia otra vez", () => {
    const desplazar = vi.fn();
    Element.prototype.scrollIntoView = desplazar;
    const { rerender } = render(<AvisoResultado key="a" tono="exito">Hecho</AvisoResultado>);
    rerender(<AvisoResultado key="b" tono="exito">Hecho</AvisoResultado>);
    expect(desplazar).toHaveBeenCalledTimes(2);
  });
});

describe("tonoDelResultado y detalleDelCierre", () => {
  it("ok_* es éxito; lo demás, error", () => {
    expect(tonoDelResultado("ok_cierre")).toBe("exito");
    expect(tonoDelResultado("ok_rechazado")).toBe("exito");
    expect(tonoDelResultado("sin_motivo")).toBe("error");
    expect(tonoDelResultado("error")).toBe("error");
  });

  it("dice qué quedó guardado con las palabras de los botones", () => {
    expect(detalleDelCierre("27", "si")).toBe("Cierre de la conversación 27 registrado: Cumple.");
    expect(detalleDelCierre("30", "no")).toBe("Cierre de la conversación 30 registrado: Falló.");
    expect(detalleDelCierre(null, "si")).toBeNull();
    expect(detalleDelCierre("27", "talvez")).toBeNull();
  });
});
