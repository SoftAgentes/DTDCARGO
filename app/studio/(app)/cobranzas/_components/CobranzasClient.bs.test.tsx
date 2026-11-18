/** SDD-0629 · Cobranzas: el saldo abierto en Bs a la tasa de hoy, solo vista. Montos inventados. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { computeCollectionKpis, computeFundsSeparation } from "@/lib/studio/payment-queries";
import type { TasaReferencial } from "@/lib/shared/equivalente-bs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("./CobranzaDrawer", () => ({ CobranzaDrawer: () => null }));
vi.mock("./IdentifyPaymentDrawer", () => ({ IdentifyPaymentDrawer: () => null }));
vi.mock("./UnidentifiedPaymentDrawer", () => ({ UnidentifiedPaymentDrawer: () => null }));
vi.mock("./RecordatoriosDrawer", () => ({ RecordatoriosDrawer: () => null }));
import { CobranzasClient } from "./CobranzasClient";

const HOY = "2026-11-13";
const separation = computeFundsSeparation([], { from: "2026-11-01", to: HOY });
const kpis = { ...computeCollectionKpis([]), porCobrar: 1200, porCobrarUsd: 1000, casos: 3, casosSinTasa: 1 };

function vista(tasaHoy: TasaReferencial | null, k = kpis) {
  render(
    <CobranzasClient
      receivables={[]}
      kpis={k}
      cashAccounts={[]}
      unidentified={[]}
      separation={separation}
      hoy={HOY}
      tasaHoy={tasaHoy}
    />,
  );
  return screen.queryByRole("region", { name: "Saldo por cobrar en bolívares" });
}

describe("0629 · Cobranzas en Bs", () => {
  it("con la tasa de hoy: USD, equivalente, tasa y casos sin tasa", () => {
    const card = within(vista({ rate: 36.5, source: "bcv", validOn: HOY })!);
    expect(card.getByText("$1,000.00")).toBeInTheDocument();
    expect(card.getByText("≈ Bs 36,500.00")).toBeInTheDocument();
    expect(card.getByText("Tasa BCV 36.5000 Bs/USD del 2026-11-13")).toBeInTheDocument();
    expect(card.getByText(/1 caso sin tasa fuera de este total/)).toBeInTheDocument();
    expect(card.getByText(/Equivalente referencial/)).toBeInTheDocument();
  });

  it("con una tasa vieja: avisa la fecha", () => {
    const card = within(vista({ rate: 35, source: "manual", validOn: "2026-11-10" })!);
    expect(card.getByText("≈ Bs 35,000.00")).toBeInTheDocument();
    expect(card.getByRole("note")).toHaveTextContent("No hay tasa del 2026-11-13");
  });

  it("sin tasa: «tasa no disponible», sin cero", () => {
    const region = vista(null)!;
    expect(within(region).getByText("Bs: tasa no disponible")).toBeInTheDocument();
    expect(region.textContent).not.toMatch(/Bs 0/);
  });

  it("sin casos abiertos no se muestra", () => {
    expect(vista({ rate: 36.5, source: "bcv", validOn: HOY }, { ...kpis, casos: 0 })).toBeNull();
  });
});
