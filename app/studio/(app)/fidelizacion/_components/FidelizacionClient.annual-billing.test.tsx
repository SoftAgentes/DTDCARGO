import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingNumber, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
import { tierOf } from "@/lib/studio/fidelizacion/types";
import { tierCountsFromClients } from "@/lib/studio/fidelizacion/queries";
vi.mock("./RegisterReferralDrawer", () => ({ RegisterReferralDrawer: () => null }));
vi.mock("./ReferralDrawer", () => ({ ReferralDrawer: () => null }));
vi.mock("./ReferralSettingsDrawer", () => ({ ReferralSettingsDrawer: () => null }));
import { FidelizacionClient } from "./FidelizacionClient";
const cases: AnnualBillingRead[] = [
 { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "-50.01", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
 { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
 { state: "sin_tasa", subtotalUsd: "0.00", sinTasaCount: 1 },
 { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
 BILLING_UNAVAILABLE,
];

describe("0572-b · Fidelización conserva estado y nivel", () => {
 it.each(cases)("tabla real $state / $subtotalUsd", (billing) => {
  const number = billingNumber(billing);
  const clients = [{ id: "A", markbox: "A", name: "Cliente sintético", billing, billedUsd: number, tier: number === null ? null : tierOf(number) }];
  render(<FidelizacionClient clients={clients} tierCounts={tierCountsFromClients(clients)} referrals={[]} stats={{total:0,activos:0,acreditados:0,creditsIssued:80,convRate:0}} topReferrers={[]} canApplyCredit={false} canAccreditManually={false} referralSettings={{referrerRewardUsd:80,referredRewardUsd:60}} canConfigure={false} strandedCredits={[]} strandedComplete />);
  expect(screen.getByText("Créditos emitidos")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clientes" }));
  expect(screen.getByText("Cliente sintético")).toBeInTheDocument();
  expect(screen.getByText(billingStatus(billing))).toBeInTheDocument();
  expect(screen.getByText(billingStatus(billing)).parentElement).toHaveTextContent(formatAnnualUsd(billing.subtotalUsd));
  if (number === null) { expect(screen.getAllByText("Por revisar").length).toBeGreaterThan(0); expect(screen.queryByText("Bronze")).not.toBeInTheDocument(); expect(screen.queryByText("Nivel máximo")).not.toBeInTheDocument(); }
 });
});
