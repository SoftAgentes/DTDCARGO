/**
 * SDD-0558 · Cabecera de cuenta de la ficha: qué pinta en cada caso.
 *
 * Monedas por separado y sin sumar, el vencido por moneda con el tramo más
 * antiguo ENTRE monedas, fechas sin hora formateadas sin `Date`, la nota de
 * códigos anteriores o fusionados, y los dos estados de ERR-01: sin permiso
 * (nada de dinero) y error (mensaje recuperable con referencia).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ClientAccountSummary, SaldoPorMoneda } from "@/lib/studio/client-account";
import { ClientAccountHeader } from "./ClientAccountHeader";

afterEach(cleanup);

function saldo(over: Partial<SaldoPorMoneda>): SaldoPorMoneda {
  return {
    currency: "USD",
    abierto: 0,
    vencido: 0,
    facturasAbiertas: 0,
    facturasVencidas: 0,
    vencimientoMasAntiguo: null,
    diasVencido: null,
    tramo: null,
    ultimoPago: null,
    ...over,
  };
}

function cuenta(over: Partial<ClientAccountSummary> = {}): ClientAccountSummary {
  return {
    clientId: "c1",
    markboxes: ["DTD-0001"],
    asOf: "2026-10-19",
    saldos: [],
    ultimoPago: null,
    embarquesEnCurso: 0,
    ...over,
  };
}

/** La tarjeta cuyo rótulo es `label`. */
function tarjeta(label: string): HTMLElement {
  const rotulo = screen.getByText(label);
  return rotulo.parentElement as HTMLElement;
}

describe("ClientAccountHeader · con saldo", () => {
  it("muestra USD y VES por separado, sin un total mezclado", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{
          tipo: "ok",
          cuenta: cuenta({
            saldos: [
              saldo({ currency: "USD", abierto: 320, facturasAbiertas: 3 }),
              saldo({ currency: "VES", abierto: 900, facturasAbiertas: 1 }),
            ],
          }),
        }}
      />,
    );
    const t = tarjeta("Saldo abierto");
    expect(within(t).getByText("USD 320.00")).toBeTruthy();
    expect(within(t).getByText("Además VES 900.00")).toBeTruthy();
    expect(within(t).getByText("4 facturas por cobrar")).toBeTruthy();
    expect(screen.queryByText(/1,220/)).toBeNull();
  });

  it("el vencido va en rojo, con el tramo más antiguo y su moneda", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{
          tipo: "ok",
          cuenta: cuenta({
            saldos: [
              saldo({ currency: "USD", abierto: 320, vencido: 270, facturasVencidas: 2, diasVencido: 40, tramo: "b31_60" }),
            ],
          }),
        }}
      />,
    );
    const t = tarjeta("Vencido");
    const valor = within(t).getByText("USD 270.00");
    expect(valor.style.color).toBe("var(--danger)");
    expect(within(t).getByText("Más antiguo: 31–60 días, en USD · 2 facturas vencidas")).toBeTruthy();
  });

  it("⭐ solo VES vencido: el valor es VES y el tramo dice VES aunque USD tenga saldo al día", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{
          tipo: "ok",
          cuenta: cuenta({
            saldos: [
              saldo({ currency: "USD", abierto: 100, facturasAbiertas: 1 }),
              saldo({ currency: "VES", abierto: 900, vencido: 900, facturasAbiertas: 1, facturasVencidas: 1, diasVencido: 5, tramo: "b1_30" }),
            ],
          }),
        }}
      />,
    );
    const t = tarjeta("Vencido");
    expect(within(t).getByText("VES 900.00")).toBeTruthy();
    expect(within(t).getByText("Más antiguo: 1–30 días, en VES · 1 factura vencida")).toBeTruthy();
    expect(within(t).queryByText(/USD/)).toBeNull();
  });

  it("el tramo es el más antiguo ENTRE monedas", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{
          tipo: "ok",
          cuenta: cuenta({
            saldos: [
              saldo({ currency: "USD", abierto: 10, vencido: 10, facturasVencidas: 1, diasVencido: 3, tramo: "b1_30" }),
              saldo({ currency: "VES", abierto: 90, vencido: 90, facturasVencidas: 1, diasVencido: 75, tramo: "b60_plus" }),
            ],
          }),
        }}
      />,
    );
    const t = tarjeta("Vencido");
    expect(within(t).getByText("USD 10.00")).toBeTruthy();
    expect(within(t).getByText("Además VES 90.00")).toBeTruthy();
    expect(within(t).getByText("Más antiguo: 60+ días, en VES · 2 facturas vencidas")).toBeTruthy();
  });

  it("al día: «Al día» sin borde vino, y el último pago con fecha corta sin Date", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{ tipo: "ok", cuenta: cuenta({ ultimoPago: "2026-10-15", saldos: [saldo({ ultimoPago: "2026-10-15" })] }) }}
      />,
    );
    const s = tarjeta("Saldo abierto");
    expect(within(s).getByText("Al día")).toBeTruthy();
    expect(within(s).getByText("Sin facturas por cobrar")).toBeTruthy();
    expect((s as HTMLElement).style.borderTop).toBe("1px solid var(--border)");
    const v = tarjeta("Vencido");
    expect(within(v).getByText("Al día")).toBeTruthy();
    expect(within(v).getByText("Nada vencido al 19 oct 2026")).toBeTruthy();
    expect((v as HTMLElement).style.borderTop).toBe("1px solid var(--border)");
    expect(within(tarjeta("Último pago")).getByText("15 oct 2026")).toBeTruthy();
  });

  it("sin pagos dice «Sin pagos»; embarques sin contar muestran «—»", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{ tipo: "ok", cuenta: cuenta({ embarquesEnCurso: null }) }}
      />,
    );
    expect(within(tarjeta("Último pago")).getByText("Sin pagos")).toBeTruthy();
    const e = tarjeta("Embarques en curso");
    expect(within(e).getByText("—")).toBeTruthy();
    expect(within(e).getByText("No se pudieron contar")).toBeTruthy();
  });

  it("con varios códigos dice cuáles incluye y que los embarques son de todos", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{ tipo: "ok", cuenta: cuenta({ markboxes: ["DTD-0001", "DTD-0002", "DTD-0100"], embarquesEnCurso: 3 }) }}
      />,
    );
    expect(screen.getByText("Incluye los códigos anteriores o fusionados: DTD-0002, DTD-0100.")).toBeTruthy();
    expect(within(tarjeta("Embarques en curso")).getByText("En todos sus códigos")).toBeTruthy();
  });

  it("la nota de diferencia con el estado de cuenta sale solo a quien lo abre, y solo si difiere", () => {
    const varios = cuenta({ markboxes: ["DTD-0001", "DTD-0002"] });
    const { rerender } = render(<ClientAccountHeader canViewStatement estado={{ tipo: "ok", cuenta: varios }} />);
    expect(screen.getByText(/El estado de cuenta muestra solo el código vigente y una moneda/)).toBeTruthy();
    rerender(<ClientAccountHeader canViewStatement={false} estado={{ tipo: "ok", cuenta: varios }} />);
    expect(screen.queryByText(/El estado de cuenta muestra/)).toBeNull();
    rerender(<ClientAccountHeader canViewStatement estado={{ tipo: "ok", cuenta: cuenta() }} />);
    expect(screen.queryByText(/El estado de cuenta muestra/)).toBeNull();
  });
});

describe("ClientAccountHeader · ERR-01", () => {
  it("sin permiso no pinta nada de dinero: solo embarques en curso", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{ tipo: "sin-permiso", markboxes: ["DTD-0001"], embarquesEnCurso: 2 }}
      />,
    );
    expect(screen.getByText("Embarques en curso")).toBeTruthy();
    expect(screen.queryByText("Saldo abierto")).toBeNull();
    expect(screen.queryByText("Vencido")).toBeNull();
    expect(screen.queryByText("Último pago")).toBeNull();
    expect(screen.queryByText(/saldo/i)).toBeNull();
  });

  it("SDD-0568 · un cliente eliminado: «Cliente eliminado», sin saldo ni el error", () => {
    render(
      <ClientAccountHeader
        canViewStatement
        estado={{ tipo: "eliminado", eliminadoEl: "2026-10-19", markboxes: ["DTD-0001"], embarquesEnCurso: 0 }}
      />,
    );
    const aviso = screen.getByRole("status");
    expect(within(aviso).getByText("Cliente eliminado")).toBeTruthy();
    expect(aviso.textContent).toContain("Se eliminó el 19 oct 2026, así que la ficha no calcula su saldo.");
    expect(aviso.textContent).toContain("Sus documentos siguen en el estado de cuenta.");
    expect(screen.queryByText("No se pudo calcular el saldo.")).toBeNull();
    expect(screen.queryByText("Saldo abierto")).toBeNull();
    expect(screen.getByText("Embarques en curso")).toBeTruthy();
  });

  it("SDD-0568 · sin el estado de cuenta, no lo menciona", () => {
    render(
      <ClientAccountHeader
        canViewStatement={false}
        estado={{ tipo: "eliminado", eliminadoEl: "", markboxes: ["DTD-0001"], embarquesEnCurso: null }}
      />,
    );
    const aviso = screen.getByRole("status");
    expect(aviso.textContent).toContain("Como está eliminado, la ficha no calcula su saldo.");
    expect(aviso.textContent).not.toContain("estado de cuenta");
  });

  it("si el cálculo falla, un mensaje recuperable con la referencia, sin cifras", () => {
    render(
      <ClientAccountHeader
        canViewStatement
        estado={{ tipo: "error", referencia: "ab12cd34", markboxes: ["DTD-0001"], embarquesEnCurso: 1 }}
      />,
    );
    const aviso = screen.getByRole("status");
    expect(within(aviso).getByText("No se pudo calcular el saldo.")).toBeTruthy();
    expect(aviso.textContent).toContain("Recarga la página en unos minutos");
    expect(within(aviso).getByText("ab12cd34")).toBeTruthy();
    expect(screen.queryByText("Saldo abierto")).toBeNull();
    expect(screen.getByText("Embarques en curso")).toBeTruthy();
  });
});

describe("ClientAccountHeader · copy", () => {
  it("tutea sin voseo y en sentence case", () => {
    const { container } = render(
      <>
        <ClientAccountHeader canViewStatement estado={{ tipo: "error", referencia: "ab12cd34", markboxes: ["DTD-0001"], embarquesEnCurso: 0 }} />
        <ClientAccountHeader
          canViewStatement
          estado={{ tipo: "ok", cuenta: cuenta({ markboxes: ["DTD-0001", "DTD-0002"], saldos: [saldo({ abierto: 5, facturasAbiertas: 1 })] }) }}
        />
      </>,
    );
    const texto = container.textContent ?? "";
    // Voseo típico: imperativos agudos (recargá, avisá) y «vos».
    expect(texto).not.toMatch(/\b(recargá|avisá|escribí|abrí|mirá|vos)\b/i);
    expect(texto).toContain("Recarga la página");
    expect(texto).toContain("avísale a soporte");
  });
});
