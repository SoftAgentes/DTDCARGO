/**
 * SDD-0558 · «Saldo pendiente» del panel de un hilo: una línea por moneda, sin
 * sumar, y el enlace a la ficha del cliente (antes iba a Cobranzas, que solo
 * abre finanzas).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationClientContext } from "@/lib/studio/conversaciones/conversations-types";
import { SaldoPendienteContexto } from "./SaldoPendienteContexto";

afterEach(cleanup);

function contexto(outstanding: ConversationClientContext["outstanding"]): ConversationClientContext {
  return {
    client_id: "c1",
    markbox: "DTD-0001",
    client_name: "Cliente",
    email: null,
    phone: null,
    activeShipments: [],
    outstanding,
  };
}

describe("SaldoPendienteContexto", () => {
  it("lista USD y VES por separado, en rojo, y enlaza a la ficha", () => {
    render(
      <SaldoPendienteContexto
        loading={false}
        context={contexto([
          { currency: "USD", amount: 125.5 },
          { currency: "VES", amount: 900 },
        ])}
      />,
    );
    const usd = screen.getByText("USD 125.50");
    expect(usd.style.color).toBe("var(--danger)");
    expect(screen.getByText("VES 900.00")).toBeTruthy();
    expect(screen.queryByText(/1,025/)).toBeNull();
    expect(screen.getByRole("link", { name: "Ver en la ficha →" }).getAttribute("href")).toBe(
      "/studio/clientes/DTD-0001",
    );
    expect(screen.queryByRole("link", { name: /Cobranzas/ })).toBeNull();
  });

  it("al día dice «Al día»; sin cálculo lo dice, nunca un 0", () => {
    const { rerender } = render(<SaldoPendienteContexto loading={false} context={contexto([])} />);
    expect(screen.getByText("Al día")).toBeTruthy();
    rerender(<SaldoPendienteContexto loading={false} context={contexto(null)} />);
    expect(screen.getByText("No se pudo calcular el saldo. Ábrelo en la ficha.")).toBeTruthy();
    expect(screen.queryByText(/0\.00/)).toBeNull();
  });

  it("cargando o sin contexto no hay monto ni enlace", () => {
    const { rerender } = render(<SaldoPendienteContexto loading context={contexto([])} />);
    expect(screen.queryByRole("link")).toBeNull();
    rerender(<SaldoPendienteContexto loading={false} context={null} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });
});
