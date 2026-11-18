import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeCollectionKpis, computeFundsSeparation } from "@/lib/studio/payment-queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
// Edición fuera de esta prueba. El agregado, la tarjeta y sus primitivas son reales.
vi.mock("./CobranzaDrawer", () => ({ CobranzaDrawer: () => null }));
vi.mock("./IdentifyPaymentDrawer", () => ({ IdentifyPaymentDrawer: () => null }));
vi.mock("./UnidentifiedPaymentDrawer", () => ({ UnidentifiedPaymentDrawer: () => null }));
vi.mock("./RecordatoriosDrawer", () => ({ RecordatoriosDrawer: () => null }));
import { CobranzasClient } from "./CobranzasClient";

const range = { from: "2026-06-01", to: "2026-06-30" };
type Receipt = Parameters<typeof computeFundsSeparation>[0][number];
const missing: Receipt = { amount: 700, currency: "CNY", fx_rate: null, fund_class: "third_party", application_status: "recibido_sin_ref" };
const known: Receipt = { amount: 20, currency: "USD", fx_rate: null, fund_class: "local_revenue", application_status: "aplicado" };

function view(receipts: Receipt[]) {
  const separation = computeFundsSeparation(receipts, range);
  render(<CobranzasClient receivables={[]} kpis={computeCollectionKpis([])} cashAccounts={[]} unidentified={[]} separation={separation} />);
  return within(screen.getByText("Separación de fondos · mandato").closest("section")!);
}

describe("0572 revisión · fondos con conversión incompleta", () => {
  it.each([true, false])("muestra subtotal y cobro sin identificar con mezcla=%s", (mixed) => {
    const card = view(mixed ? [missing, known] : [missing]);
    expect(card.getByText(/sin identificar · 1 pago/i)).toBeInTheDocument();
    expect(card.getByText(/1 cobro sin tasa/i)).toBeInTheDocument();
    expect(card.getByText(/subtotal/i)).toBeInTheDocument();
    if (mixed) expect(card.getByText("$20.00")).toBeInTheDocument();
    expect(card.queryByText(/sin identificar · 0 pago/i)).not.toBeInTheDocument();
  });

  it("cero conocido mantiene el cero sin aviso falso", () => {
    const card = view([{ ...known, amount: 0 }]);
    expect(card.getAllByText("$0.00")).toHaveLength(3);
    expect(card.queryByText(/sin tasa|subtotal|conversión incompleta/i)).not.toBeInTheDocument();
  });
});
