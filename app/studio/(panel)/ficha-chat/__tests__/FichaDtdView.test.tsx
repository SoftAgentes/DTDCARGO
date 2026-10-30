/**
 * SDD-0585 · paso 2.4 · FichaDtdView: cada estado de la Ficha DTD y, sobre
 * todo, que sin permiso de saldo no se pinte un solo dato de dinero (E2-D32).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FichaDtdView } from "../_components/FichaDtdView";
import type { FichaDtd } from "@/app/studio/(app)/bandeja/actions";

afterEach(cleanup);

const SALDOS = [
  { currency: "USD", abierto: 1250, vencido: 200, facturasAbiertas: 2, facturasVencidas: 1, vencimientoMasAntiguo: "2026-10-01", diasVencido: 29, tramo: "d1_30", ultimoPago: null },
  { currency: "VES", abierto: 0, vencido: 0, facturasAbiertas: 0, facturasVencidas: 0, vencimientoMasAntiguo: null, diasVencido: null, tramo: null, ultimoPago: null },
] as const;

function ficha(over: Partial<FichaDtd> = {}): FichaDtd {
  return {
    markbox: "DTD-0001",
    segmento: null,
    enlace: "/studio/clientes/DTD-0001",
    cuenta: {
      tipo: "ok",
      cuenta: {
        clientId: "30000000-0000-4000-8000-000000000001",
        markboxes: ["DTD-0001", "VIEJO-01"],
        asOf: "2026-10-30",
        saldos: SALDOS.map((s) => ({ ...s })),
        ultimoPago: null,
        embarquesEnCurso: 3,
      },
    },
    ...over,
  } as FichaDtd;
}

describe("FichaDtdView (SDD-0585, 2.4)", () => {
  it("con permiso: Shipping Mark, códigos anteriores, envíos, saldo y vencido por moneda", () => {
    render(<FichaDtdView estado={{ tipo: "ficha", ficha: ficha() }} />);
    expect(screen.getByText("Shipping Mark")).toBeTruthy();
    expect(screen.getByText("DTD-0001")).toBeTruthy();
    expect(screen.getByText("También: VIEJO-01")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("USD 1,250.00")).toBeTruthy();
    expect(screen.getByText("USD 200.00")).toBeTruthy();
    const abrir = screen.getByRole("link", { name: "Abrir en Studio" });
    expect(abrir.getAttribute("href")).toBe("/studio/clientes/DTD-0001");
    expect(abrir.getAttribute("target")).toBe("_blank");
    expect(abrir.getAttribute("rel")).toContain("noopener");
  });

  it("sin saldo abierto ni vencido: «Al día», sin montos", () => {
    const sinDeuda = ficha();
    if (sinDeuda.cuenta.tipo === "ok") sinDeuda.cuenta.cuenta.saldos = [];
    render(<FichaDtdView estado={{ tipo: "ficha", ficha: sinDeuda }} />);
    expect(screen.getAllByText("Al día")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/USD|VES/);
  });

  it("sin permiso de saldo: solo los envíos, ni un dato ni una etiqueta de dinero", () => {
    render(
      <FichaDtdView
        estado={{ tipo: "ficha", ficha: ficha({ cuenta: { tipo: "sin-permiso", markboxes: ["DTD-0001"], embarquesEnCurso: 1 } }) }}
      />,
    );
    expect(screen.getByText("Envíos en curso")).toBeTruthy();
    const texto = document.body.textContent ?? "";
    for (const prohibido of ["Saldo", "Vencido", "Al día", "USD", "VES"]) expect(texto).not.toContain(prohibido);
  });

  it("si el saldo falló: la referencia y los envíos, sin montos", () => {
    render(
      <FichaDtdView
        estado={{ tipo: "ficha", ficha: ficha({ cuenta: { tipo: "error", referencia: "ERR-ABC123", markboxes: ["DTD-0001"], embarquesEnCurso: null } }) }}
      />,
    );
    expect(screen.getByText("No se pudo calcular el saldo. Referencia: ERR-ABC123")).toBeTruthy();
    expect(screen.getByText("No se pudieron contar")).toBeTruthy();
  });

  it("cliente eliminado: lo dice con la fecha", () => {
    render(
      <FichaDtdView
        estado={{ tipo: "ficha", ficha: ficha({ cuenta: { tipo: "eliminado", eliminadoEl: "2026-10-02", markboxes: ["DTD-0001"], embarquesEnCurso: 0 } }) }}
      />,
    );
    expect(screen.getByText("Este cliente se eliminó el 2 oct 2026.")).toBeTruthy();
  });

  it("el segmento se pinta solo cuando viene (hueco de E10)", () => {
    const { rerender } = render(<FichaDtdView estado={{ tipo: "ficha", ficha: ficha() }} />);
    expect(screen.queryByText("Cliente")).toBeNull();
    rerender(<FichaDtdView estado={{ tipo: "ficha", ficha: ficha({ segmento: "lead_registrado" }) }} />);
    expect(screen.getByText("Lead registrado")).toBeTruthy();
  });

  it("el hueco del 2.8 pinta lo que le pasen y, sin nada, no deja rastro", () => {
    const { rerender } = render(<FichaDtdView estado={{ tipo: "ficha", ficha: ficha() }} />);
    expect(document.querySelector("[data-hueco='costo-chat']")).toBeNull();
    rerender(<FichaDtdView estado={{ tipo: "ficha", ficha: ficha() }} costoChat={<p>costo de prueba</p>} />);
    expect(document.querySelector("[data-hueco='costo-chat']")?.textContent).toBe("costo de prueba");
  });

  it("sin ficha: lo dice sin teléfono ni candidatos", () => {
    render(<FichaDtdView estado={{ tipo: "sin_ficha" }} />);
    expect(screen.getByText("Sin ficha")).toBeTruthy();
    expect(screen.getByText("El teléfono de este contacto no coincide con un único cliente de Studio.")).toBeTruthy();
  });

  it("sin sesión: enlace al login en otra pestaña", () => {
    render(<FichaDtdView estado={{ tipo: "sin_sesion", loginUrl: "/studio/login" }} />);
    const enlace = screen.getByRole("link", { name: "Abrir Studio" });
    expect(enlace.getAttribute("href")).toBe("/studio/login");
    expect(enlace.getAttribute("target")).toBe("_blank");
  });

  it("cargando y esperando: anuncian su estado", () => {
    const { rerender } = render(<FichaDtdView estado={{ tipo: "cargando" }} />);
    expect(screen.getByRole("status").textContent).toContain("Cargando la ficha…");
    rerender(<FichaDtdView estado={{ tipo: "esperando" }} />);
    expect(screen.getByText("Abre una conversación")).toBeTruthy();
  });

  it("error: mensaje del código y reintento; otro_agente pide entrar con el usuario propio", async () => {
    const reintentar = vi.fn();
    const { rerender } = render(<FichaDtdView estado={{ tipo: "error", error: "service" }} onRetry={reintentar} />);
    expect(screen.getByRole("alert").textContent).toContain("No pudimos cargar la ficha.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reintentar).toHaveBeenCalledTimes(1);
    rerender(<FichaDtdView estado={{ tipo: "error", error: "otro_agente" }} onRetry={reintentar} />);
    expect(screen.getByRole("alert").textContent).toContain("Esta sesión de Studio es de otra persona.");
  });
});
