import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingNumber, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
import type { SupabaseClient } from "@supabase/supabase-js";
import { commercialByClient } from "@/lib/studio/reports/queries";
import { ReportesClient } from "./ReportesClient";
const cases: AnnualBillingRead[] = [
 { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "-50.01", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
 { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
 { state: "sin_tasa", subtotalUsd: "0.00", sinTasaCount: 1 },
 { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
 BILLING_UNAVAILABLE,
];

describe("0572-b · Reportes anual visible", () => {
 it.each(cases)("cliente conserva $state / $subtotalUsd", async (billing) => {
  const client = { from: () => chain([{ id: "A", markbox: "A", name: "Cliente sintético" }]), rpc: () => chain(billing.state === "no_disponible" ? null : [{ client_markbox: "A", subtotal_usd: billing.subtotalUsd, sin_tasa_count: billing.sinTasaCount, conversion_state: billing.state }]) } as unknown as SupabaseClient;
  function chain(rows: unknown[] | null) { const q = { select: () => q, is: () => q, order: () => q, range: (from: number) => Promise.resolve({ data: rows?.slice(from,from+500) ?? null, error: rows === null ? {message:"SQL privado"} : null }) }; return q; }
  const data = await commercialByClient(client);
  render(<ReportesClient category="com" period="1A" rep="by-client" byClient={data} />);
  expect(screen.getByText("Cliente sintético")).toBeInTheDocument();
  expect(screen.getAllByText(billingStatus(billing)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(formatAnnualUsd(billing.subtotalUsd)).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /exportar csv/i })).toBeEnabled();
  if (billingNumber(billing) === null) expect(screen.getAllByText("Por revisar").length).toBeGreaterThan(0);
  expect(screen.queryByText("SQL privado")).not.toBeInTheDocument();
 });
});
