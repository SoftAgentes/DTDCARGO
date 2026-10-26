import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingNumber, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams() }));
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

describe("0572 · disponibilidad de cartera sin perder estado local", () => {
 it("conserva búsqueda, foco en el tab y navegación al alternar disponibilidad", () => {
  const billing: AnnualBillingRead = { state: "completo", subtotalUsd: "100.00", sinTasaCount: 0 };
  const clients = [
   { id: "FICT_CLIENT_A", markbox: "FICT_A", name: "Cliente ficticio Alfa", billing, billedUsd: 100, tier: tierOf(100) },
   { id: "FICT_CLIENT_B", markbox: "FICT_B", name: "Cliente ficticio Beta", billing, billedUsd: 100, tier: tierOf(100) },
  ];
  const props = {
   clients, tierCounts: tierCountsFromClients(clients), referrals: [],
   stats: { total: 0, activos: 0, acreditados: 0, creditsIssued: 80, convRate: 0 },
   topReferrers: [], canApplyCredit: false, canAccreditManually: false,
   referralSettings: { referrerRewardUsd: 80, referredRewardUsd: 60 },
   canConfigure: false, strandedCredits: [], strandedComplete: true,
  };
  const view = render(<FidelizacionClient {...props} portfolioAvailable />);
  const tab = screen.getByRole("button", { name: "Clientes" });
  fireEvent.click(tab);
  const search = screen.getByRole("textbox", { name: "Buscar cliente o Shipping Mark" });
  search.focus();
  fireEvent.change(search, { target: { value: "Beta" } });
  expect(search).toHaveFocus();
  expect(screen.queryByText("Cliente ficticio Alfa")).not.toBeInTheDocument();
  expect(screen.getByText("Cliente ficticio Beta")).toBeInTheDocument();

  tab.focus();
  view.rerender(<FidelizacionClient {...props} portfolioAvailable={false} />);
  expect(tab).toHaveFocus();
  expect(screen.getByText("No se pudo cargar la cartera de clientes.")).toBeInTheDocument();
  expect(screen.queryByText("Todavía no hay clientes para clasificar.")).not.toBeInTheDocument();
  expect(screen.queryByText("Cliente ficticio Beta")).not.toBeInTheDocument();

  view.rerender(<FidelizacionClient {...props} portfolioAvailable />);
  expect(tab).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Buscar cliente o Shipping Mark" })).toHaveValue("Beta");
  expect(screen.queryByText("Cliente ficticio Alfa")).not.toBeInTheDocument();
  const row = screen.getByRole("button", { name: /Cliente ficticio Beta/ });
  fireEvent.keyDown(row, { key: "Enter" });
  expect(navigation.push).toHaveBeenLastCalledWith("/studio/clientes/FICT_B");
  fireEvent.keyDown(row, { key: " " });
  expect(navigation.push).toHaveBeenLastCalledWith("/studio/clientes/FICT_B");
 });
});
