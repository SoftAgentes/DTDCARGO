/**
 * SDD-0660 (revisión de #668, N2): el mes a depreciar no vive en un <form>. Con algo a
 * medio escribir el estado conserva el último mes válido, así que «Depreciar mes»
 * tiene que esperar: si no, registraría asientos de un mes distinto al que se ve.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FixedAsset } from "@/lib/studio/accounting/fixed-asset-types";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";
import { ActivosFijosTab } from "../_components/ActivosFijosTab";

const accion = vi.hoisted(() => vi.fn(async () => ({ result: { posted: 0, failed: 0, totalAmount: 0 } })));
vi.mock("../assets-actions", () => ({ disposeAsset: vi.fn(), postDepreciationAction: accion }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

const ACTIVO: FixedAsset = {
  id: "a1", tenant_id: "t1", name: "Montacargas sintético", asset_account_id: "c1",
  accum_dep_account_id: null, expense_account_id: null, cost: 1200, salvage_value: 0,
  acquired_on: "2026-01-01", useful_life_months: 24, method: "linea_recta", status: "activo",
  disposed_on: null, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function montar() {
  render(
    <ToastProvider>
      <ActivosFijosTab assets={[ACTIVO]} assetAccounts={[]} closingDate={null} showCreate={false} onCloseCreate={() => {}} />
    </ToastProvider>,
  );
  return {
    mes: screen.getByLabelText("Mes a depreciar") as HTMLInputElement,
    depreciar: screen.getByRole("button", { name: /Depreciar mes/ }),
    user: userEvent.setup(),
  };
}

describe("Activos fijos · mes a depreciar", () => {
  it("con el mes completo se puede depreciar", () => {
    const { depreciar } = montar();
    expect(depreciar).toBeEnabled();
  });

  it("a medio escribir (10/202) no deja depreciar el mes anterior", async () => {
    const { mes, depreciar, user } = montar();
    await user.clear(mes);
    await user.type(mes, "10202");
    expect(mes).toHaveValue("10/202");
    expect(depreciar).toBeDisabled();
  });

  it("con un mes imposible o vacío tampoco; corregido, deprecia ese mes", async () => {
    const { mes, depreciar, user } = montar();
    await user.clear(mes);
    expect(depreciar).toBeDisabled();
    await user.type(mes, "132026");
    expect(depreciar).toBeDisabled();
    await user.clear(mes);
    await user.type(mes, "102026");
    expect(depreciar).toBeEnabled();
    await user.click(depreciar);
    expect(accion).toHaveBeenCalledWith("2026-10");
  });
});
