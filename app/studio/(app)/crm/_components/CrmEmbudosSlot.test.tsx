/**
 * SDD-0614 · S0b: el estado «sin la 0506» de Embudos no manda a las pestañas de Kommo.
 *
 * El texto decía «Mientras tanto, los leads siguen en las otras pestañas del
 * CRM». Desde S0 esas pestañas están ocultas, así que la frase ya no es cierta.
 * El estado dice qué falta (BRAND §Estados: «Falta aplicar la migración NNNN»)
 * y no promete nada que todavía no existe.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioAccess: vi.fn(async () => ({ role: "admin", tenantId: "tenant-prueba" })),
  moduleEditDenial: vi.fn(async () => null),
}));
vi.mock("@/lib/studio/user-queries", () => ({ listTenantAdvisors: vi.fn(async () => []) }));
vi.mock("@/lib/studio/crm-tablero-queries", () => ({
  cargarTableroCrm: vi.fn(async () => ({ ok: false, motivo: "sin_modelo" })),
}));
vi.mock("./CrmEmbudosClient", () => ({ CrmEmbudosClient: () => null }));

import { CrmEmbudosSlot } from "./CrmEmbudosSlot";

afterEach(() => cleanup());

describe("Embudos sin la migración 0506 (SDD-0614 S0b)", () => {
  it("dice qué falta y no manda a las pestañas de Kommo, ocultas desde S0", async () => {
    render(await CrmEmbudosSlot({ tableroInicial: "leads" }));
    expect(screen.getByText("Los embudos todavía no están activos.")).toBeInTheDocument();
    expect(screen.getByText("Falta aplicar la migración 0506 en esta base.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/otras pestañas/);
  });
});
