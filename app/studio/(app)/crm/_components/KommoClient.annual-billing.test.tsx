import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => vi.fn() }));
vi.mock("./ConvertLeadDrawer", () => ({ ConvertLeadDrawer: () => null }));
vi.mock("./StageControl", () => ({ StageControl: () => null }));
vi.mock("./LeadActionsButton", () => ({ LeadActionsButton: () => null }));
import { KommoClient } from "./KommoClient";
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

describe("0572-b · worklist CRM real", () => {
 it("convertido sin entrada ERP no vuelve al nominal con lectura global disponible", () => {
  render(<KommoClient tab="asesor" direccion={null} tablero={null} recuperacion={null} overview={{leads:1,contacts:0,lastSyncAt:null,connStatus:"active",subdomain:null}} pipelines={pipelines} statuses={statuses} leads={[lead]} filters={{}} convertedLeads={{1:"A"}} valueByLead={{}} billingAvailable contactByLead={{}} pendingOpsByLead={{}} staleOpsByLead={{}} canEdit={false} responsibleUsers={[]} />);
  expect(screen.getByText("Facturación anual no disponible")).toBeInTheDocument();
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
 it("cruce ausente tampoco certifica nominal sin markbox", () => {
  render(<KommoClient tab="asesor" direccion={null} tablero={null} recuperacion={null} overview={{leads:1,contacts:0,lastSyncAt:null,connStatus:"active",subdomain:null}} pipelines={pipelines} statuses={statuses} leads={[lead]} filters={{}} convertedLeads={{}} valueByLead={{}} billingAvailable={false} contactByLead={{}} pendingOpsByLead={{}} staleOpsByLead={{}} canEdit={false} responsibleUsers={[]} />);
  expect(screen.getByText("Facturación anual no disponible")).toBeInTheDocument();
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
 it("no convertido conserva nominal cuando el cruce está disponible", () => {
  render(<KommoClient tab="asesor" direccion={null} tablero={null} recuperacion={null} overview={{leads:1,contacts:0,lastSyncAt:null,connStatus:"active",subdomain:null}} pipelines={pipelines} statuses={statuses} leads={[lead]} filters={{}} convertedLeads={{}} valueByLead={{}} billingAvailable contactByLead={{}} pendingOpsByLead={{}} staleOpsByLead={{}} canEdit={false} responsibleUsers={[]} />);
  expect(screen.getByText(/9,876/)).toBeInTheDocument();
  expect(screen.queryByText("Facturación anual no disponible")).not.toBeInTheDocument();
 });
 it.each(cases)("convertido conserva $state / $subtotalUsd", (billing) => {
  render(<KommoClient tab="asesor" direccion={null} tablero={null} recuperacion={null} overview={{leads:1,contacts:0,lastSyncAt:null,connStatus:"active",subdomain:null}} pipelines={pipelines} statuses={statuses} leads={[lead]} filters={{}} convertedLeads={{1:"A"}} valueByLead={{1:billing}} billingAvailable={billing.state !== "no_disponible"} contactByLead={{}} pendingOpsByLead={{}} staleOpsByLead={{}} canEdit={false} responsibleUsers={[]} />);
  expect(screen.getByText("Lead sintético")).toBeInTheDocument();
  expect(screen.getByText(billingStatus(billing))).toBeInTheDocument();
  expect(screen.getByText(billingStatus(billing)).parentElement).toHaveTextContent(formatAnnualUsd(billing.subtotalUsd));
  expect(screen.queryByText(/9,876/)).not.toBeInTheDocument();
 });
});
