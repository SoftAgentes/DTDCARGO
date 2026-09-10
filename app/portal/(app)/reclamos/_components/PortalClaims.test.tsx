import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortalClaimRow } from "@/lib/portal/portal-claims";
import { PortalClaims } from "./PortalClaims";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createPortalClaimAction: vi.fn(async () => ({})),
}));

const statuses: PortalClaimRow["status"][] = [
  "reportado",
  "evaluacion",
  "aprobado",
  "pagado",
  "resuelto",
  "rechazado",
];

const labels = [
  "Reportado",
  "En evaluación",
  "Aprobado",
  "Pagado",
  "Resuelto",
  "Rechazado",
];

afterEach(cleanup);

describe("PortalClaims · badges semánticos", () => {
  it("usa icono además del texto para todos los estados del reclamo", () => {
    const claims = statuses.map((status, index): PortalClaimRow => ({
      id: `claim-${index}`,
      code: `REC-2026-${String(index + 1).padStart(4, "0")}`,
      type: "dano",
      description: `Reclamo ${index + 1}`,
      status,
      amountUsd: 0,
      insured: false,
      shipmentCode: null,
      containerCode: null,
      resolutionNote: null,
      createdAt: "2026-09-10T00:00:00.000Z",
    }));

    render(
      <PortalClaims claims={claims} shipments={[]} evidence={{}} embedded />,
    );

    for (const label of labels) {
      const badge = screen.getByText(label).closest(".badge-status");
      expect(badge?.querySelector("svg")).not.toBeNull();
      expect(badge?.querySelector(".badge-status-dot")).toBeNull();
    }
  });
});
