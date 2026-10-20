/**
 * SDD-0572 · Decisión 2 del Director por la delegación de Sam (2026-10-20):
 * una rendición con un cobro sin tasa no se emite. La previa lo dice, marca la
 * línea «sin tasa» y deja el botón apagado; sin cobros sin tasa, ni nota ni
 * bloqueo.
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ emitRenditionAction: vi.fn() }));

import { EmitDrawer } from "./EmitDrawer";
import type { QuincenaCard } from "../page";

const linea = {
  receiptId: "r1",
  receiptCode: "R-2026-0001",
  clientName: "Acme",
  clientMarkbox: "DTD-0001",
  reference: null,
  amount: 3600,
  currency: "VES",
  receivedAt: "2026-06-05",
};

function card(amountUsd: number | null, recibosSinTasa: number): QuincenaCard {
  return {
    label: "1ª quincena",
    half: 1,
    from: "2026-06-01",
    to: "2026-06-15",
    preview: {
      from: "2026-06-01",
      to: "2026-06-15",
      thirdPartyUsd: amountUsd ?? 0,
      localRevenueInvoicedUsd: 0,
      netToOperadoraUsd: amountUsd ?? 0,
      receiptCount: 1,
      recibosSinTasa,
      facturasLocalesSinTasa: 0,
      lines: [{ ...linea, amountUsd }],
    },
  };
}

afterEach(() => cleanup());

describe("EmitDrawer · cobros sin tasa", () => {
  it("con un cobro sin tasa: nota, línea «sin tasa» y botón apagado", () => {
    render(createElement(EmitDrawer, { card: card(null, 1), onClose: vi.fn(), onEmitted: vi.fn() }));
    expect(screen.getByTestId("rendicion-sin-tasa")).toHaveTextContent(
      "No se puede emitir: 1 cobro(s) y 0 factura(s) local(es) no tienen tasa.",
    );
    expect(screen.getByText("sin tasa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir rendición/ })).toBeDisabled();
  });

  it("con todo en USD: sin nota y el botón activo", () => {
    render(createElement(EmitDrawer, { card: card(100, 0), onClose: vi.fn(), onEmitted: vi.fn() }));
    expect(screen.queryByTestId("rendicion-sin-tasa")).toBeNull();
    expect(screen.getByRole("button", { name: /Emitir rendición/ })).toBeEnabled();
  });
});
