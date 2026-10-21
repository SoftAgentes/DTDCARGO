/**
 * SDD-0569 · Admin › Tasas (y Contabilidad › Tasas): el formulario tiene la nota
 * que promete la spec (revisión de seguridad, hallazgo 11), con su etiqueta.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../exchange-rates-actions", () => ({ recordExchangeRateAction: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

import { ExchangeRatesSection } from "./ExchangeRatesSection";

afterEach(() => cleanup());

describe("ExchangeRatesSection", () => {
  it("el formulario manda la nota, con su etiqueta y su tope", () => {
    render(
      <ExchangeRatesSection
        data={{ latest: [{ pair: "VES/USD", rate: 36.5, validOn: "2026-10-20", source: "manual" }] }}
      />,
    );
    const nota = screen.getByLabelText("Nota (opcional)");
    expect(nota.getAttribute("name")).toBe("note");
    expect(nota.getAttribute("maxlength")).toBe("500");
    expect(screen.getByText("del 20/10/2026 · manual")).toBeTruthy();
  });
});
