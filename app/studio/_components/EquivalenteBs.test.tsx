/** SDD-0629 · La vista del equivalente en Bs en el Studio y en el portal. Montos inventados. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  equivalenteEnBs,
  LEYENDA_BS_REFERENCIAL,
  type TasaReferencial,
} from "@/lib/shared/equivalente-bs";
import { EquivalenteBs } from "./EquivalenteBs";
import { EquivalenteBs as EquivalenteBsPortal } from "@/app/portal/_components/EquivalenteBs";

const HOY = "2026-11-13";
const eq = (tasa: TasaReferencial | null, currency = "USD") =>
  equivalenteEnBs({ amount: 250, currency, tasa, fechaPedida: HOY });

describe.each([
  ["Studio", EquivalenteBs],
  ["portal", EquivalenteBsPortal],
] as const)("EquivalenteBs · %s", (donde, Componente) => {
  it("con tasa del día: monto, tasa, fuente y fecha", () => {
    render(<Componente eq={eq({ rate: 40, source: "bcv", validOn: HOY })} leyenda />);
    const vista = screen.getByTestId("equivalente-bs");
    expect(vista).toHaveAttribute("data-estado", "ok");
    expect(vista).toHaveTextContent("≈ Bs 10,000.00");
    expect(vista).toHaveTextContent("Tasa BCV 40.0000 Bs/USD del 2026-11-13");
    expect(vista).toHaveTextContent(LEYENDA_BS_REFERENCIAL);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("con una tasa vieja: avisa la fecha", () => {
    render(<Componente eq={eq({ rate: 39, source: "manual", validOn: "2026-11-09" })} />);
    expect(screen.getByTestId("equivalente-bs")).toHaveTextContent("≈ Bs 9,750.00");
    expect(screen.getByRole("note")).toHaveTextContent("es la última cargada, del 2026-11-09");
  });

  it("sin tasa: «tasa no disponible» y ningún cero", () => {
    render(<Componente eq={eq(null)} />);
    const vista = screen.getByTestId("equivalente-bs");
    expect(vista).toHaveAttribute("data-estado", "sin-tasa");
    expect(vista).toHaveTextContent("tasa no disponible");
    expect(vista.textContent).not.toMatch(/Bs 0|0\.00/);
    if (donde === "portal") expect(vista.textContent).not.toMatch(/Admin/);
    else expect(vista).toHaveTextContent("Admin › Tasas");
  });

  it("en VES no muestra nada", () => {
    const { container } = render(<Componente eq={eq({ rate: 40, source: "bcv", validOn: HOY }, "VES")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
