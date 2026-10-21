import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { BILLING_UNAVAILABLE, billingStatus, formatAnnualUsd, type AnnualBillingRead } from "@/lib/shared/annual-billing";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
afterEach(cleanup);
import { agingBuckets, conversionStats, emailCoverage, funnelHealth, ownershipDistribution, valueContrast, type KommoDireccionData } from "@/lib/studio/kommo-analytics";
vi.mock("./StageMapConfig", () => ({ StageMapConfig: () => null }));
vi.mock("./MarkboxFieldConfig", () => ({ MarkboxFieldConfig: () => null }));
import { DireccionTab } from "./DireccionTab";
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

describe("0572-b · Dirección conserva CRM y contraste ERP", () => {
 it.each(cases)("contraste $state / $subtotalUsd", (billing) => {
  const map = billing.state === "no_disponible" ? null : new Map([["A",billing]]);
  const data: KommoDireccionData = { totals:{leads:1,contacts:0}, conversion:conversionStats([lead]), convertedCount:1, email:emailCoverage([]), funnel:funnelHealth([lead],pipelines,statuses), aging:agingBuckets([lead], Date.parse("2026-10-20T12:00:00Z")), ownership:ownershipDistribution([lead]), value:valueContrast([lead],{1:"A"},map), convertedMarkboxByLead:{1:"A"}, valueByLead:{1:billing}, billingAvailable:map!==null, complete:true };
  render(<DireccionTab data={data} writeback={null} pipelines={pipelines} statuses={statuses} stageMap={{}} canEditStageMap={false} markboxFields={[]} markboxFieldId={null} markboxContactFields={[]} markboxContactFieldId={null} />);
  expect(screen.getAllByText(billingStatus(billing)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(formatAnnualUsd(billing.subtotalUsd)).length).toBeGreaterThan(0);
  expect(screen.getByText("Conversión del CRM")).toBeInTheDocument();
 });
});
