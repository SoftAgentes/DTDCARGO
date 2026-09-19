import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ClientChangeRequest } from "@/lib/portal/change-request-types";
import { ChangeRequestHistory } from "./ChangeRequestHistory";

afterEach(cleanup);

function row(over: Partial<ClientChangeRequest>): ClientChangeRequest {
  return {
    id: over.id ?? "r1",
    tenantId: "t",
    clientId: "c",
    proposedName: null,
    proposedRif: null,
    proposedPhone: "584141234567",
    prevName: null,
    prevRif: null,
    prevPhone: "584120000001",
    status: "approved",
    source: "client",
    submittedAt: "2026-09-18T10:00:00Z",
    reviewedAt: "2026-09-18T10:00:00Z",
    reviewedBy: null,
    reviewNote: null,
    ...over,
  };
}

describe("ChangeRequestHistory · SDD-0482", () => {
  it("distingue el cambio directo del cliente de la aprobación del asesor y del equipo", () => {
    render(
      <ChangeRequestHistory
        isEmpresa={false}
        reviewerNames={{ asesor: "Asesora Ficticia" }}
        items={[
          row({ id: "directo" }),
          row({ id: "aprobada", reviewedBy: "asesor" }),
          row({ id: "equipo", source: "admin", reviewedBy: "asesor" }),
          row({ id: "rechazada", status: "rejected", reviewedBy: "asesor" }),
        ]}
      />,
    );

    expect(screen.getByText("Editado por el cliente")).toBeTruthy();
    expect(screen.getByText("Aprobada")).toBeTruthy();
    expect(screen.getByText("Editado por el equipo")).toBeTruthy();
    expect(screen.getByText("Rechazada")).toBeTruthy();
    // El antes y el después del teléfono quedan a la vista.
    expect(screen.getAllByText("584120000001").length).toBe(4);
    expect(screen.getAllByText("584141234567").length).toBe(4);
  });
});
