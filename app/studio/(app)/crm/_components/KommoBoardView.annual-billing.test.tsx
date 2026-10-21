import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
vi.mock("./StageControl", () => ({ StageControl: () => null }));
vi.mock("./LeadActionsButton", () => ({ LeadActionsButton: () => null }));
import { KommoBoardView } from "./KommoBoardView";
const cases: AnnualBillingRead[] = [
 { state: "completo", subtotalUsd: "0.00", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "-50.01", sinTasaCount: 0 },
 { state: "completo", subtotalUsd: "900719925474099312345.67", sinTasaCount: 0 },
 { state: "sin_tasa", subtotalUsd: "100.01", sinTasaCount: 2 },
 { state: "sin_tasa", subtotalUsd: "0.00", sinTasaCount: 1 },
 { state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 },
 BILLING_UNAVAILABLE,
];
const lead = { id: 1, name: "Lead sintético", status_id: 142, pipeline_id: 1, price: 9876, responsible_user_id: 10, kommo_created_at: null, kommo_updated_at: null, closed_at: null, last_inbound_at: null, last_outbound_at: null, last_message_origin: null };
const pipelines = [{ id: 1, name: "Ventas", sort: 0, is_main: true }];
const statuses = [{ id: 142, pipeline_id: 1, name: "Ganado", color: null, sort: 1, type: 0 }];

describe("0572-b · tablero CRM real", () => {
 it("convertido sin entrada ERP conserva indisponibilidad aunque la lectura global esté disponible", () => {
  render(<KommoBoardView pipelines={pipelines} statuses={statuses} leads={[lead]} realCountByStatus={{142:1}} pipelineId={1} subdomain={null} convertedMarkboxByLead={{1:"A"}} valueByLead={{}} convertedAvailable billingAvailable ownerName={{}} pendingOpsByLead={{}} staleOpsByLead={{}} asesores={[]} canEdit={false} boardCap={2000} />);
  expect(screen.getAllByText("Facturación anual no disponible").length).toBeGreaterThan(0);
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
 it("no convertido conserva valor nominal CRM cuando el cruce está disponible", () => {
  render(<KommoBoardView pipelines={pipelines} statuses={statuses} leads={[lead]} realCountByStatus={{142:1}} pipelineId={1} subdomain={null} convertedMarkboxByLead={{}} valueByLead={{}} convertedAvailable billingAvailable ownerName={{}} pendingOpsByLead={{}} staleOpsByLead={{}} asesores={[]} canEdit={false} boardCap={2000} />);
  expect(screen.getAllByText(/9,876/).length).toBeGreaterThan(0);
  expect(screen.queryByText("Facturación anual no disponible")).not.toBeInTheDocument();
 });
 it.each(cases)("convertido conserva $state / $subtotalUsd", (billing) => {
  render(<KommoBoardView pipelines={pipelines} statuses={statuses} leads={[lead]} realCountByStatus={{142:1}} pipelineId={1} subdomain={null} convertedMarkboxByLead={{1:"A"}} valueByLead={{1:billing}} convertedAvailable billingAvailable={billing.state !== "no_disponible"} ownerName={{}} pendingOpsByLead={{}} staleOpsByLead={{}} asesores={[]} canEdit={false} boardCap={2000} />);
  expect(screen.getByText("Lead sintético")).toBeInTheDocument();
  expect(screen.getAllByText(billingStatus(billing)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(formatAnnualUsd(billing.subtotalUsd)).length).toBeGreaterThan(0);
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
 it("cruce ausente no vuelve al nominal aunque no haya markbox", () => {
  render(<KommoBoardView pipelines={pipelines} statuses={statuses} leads={[lead]} realCountByStatus={{142:1}} pipelineId={1} subdomain={null} convertedMarkboxByLead={{}} valueByLead={{}} convertedAvailable={false} billingAvailable={false} ownerName={{}} pendingOpsByLead={{}} staleOpsByLead={{}} asesores={[]} canEdit={false} boardCap={2000} />);
  expect(screen.getAllByText("Facturación anual no disponible").length).toBeGreaterThan(0);
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
});
