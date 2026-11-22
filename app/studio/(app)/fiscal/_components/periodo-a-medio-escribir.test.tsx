/**
 * SDD-0660 (revisión de #668, N2): el selector de mes del Libro de Ventas no vive en
 * un <form>. A medio escribir el libro sigue mostrando el mes anterior, así que
 * «Asentar período» y exportar esperan a que lo escrito sea un mes válido.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FISCAL_SETTINGS, type FiscalSettings } from "@/lib/studio/fiscal/config-types";
import { ToastProvider } from "@/app/studio/_components/ui/ToastProvider";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=ventas&period=2026-07"),
}));
vi.mock("./FiscalConfig", () => ({ FiscalConfig: () => null }));
vi.mock("./WithholdingsView", () => ({ WithholdingsView: () => null }));
vi.mock("../actions", () => ({ postFiscalBookAction: vi.fn(), voidFiscalBookAction: vi.fn() }));

import { FiscalClient } from "./FiscalClient";

const SETTINGS: FiscalSettings = {
  ...DEFAULT_FISCAL_SETTINGS,
  fiscal_module_enabled: true,
  tenant_id: "tenant-test",
  updated_at: null,
  updated_by: null,
};

function montar() {
  render(
    <ToastProvider>
      <FiscalClient tab="ventas" period="2026-07" settings={SETTINGS} canEditConfig={false} canPost sales={[]} />
    </ToastProvider>,
  );
  return {
    mes: screen.getByLabelText("Período fiscal") as HTMLInputElement,
    asentar: screen.getByRole("button", { name: "Asentar período" }),
    user: userEvent.setup(),
  };
}

describe("Fiscal · mes a medio escribir", () => {
  it("con el mes completo se puede asentar", () => {
    const { asentar } = montar();
    expect(asentar).toBeEnabled();
  });

  it("a medio escribir no deja asentar ni navega", async () => {
    const { mes, asentar, user } = montar();
    await user.type(mes, "{Backspace}");
    expect(mes).toHaveValue("07/202");
    expect(asentar).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("corregido, navega al mes escrito", async () => {
    const { mes, user } = montar();
    await user.clear(mes);
    await user.type(mes, "082026");
    expect(push).toHaveBeenLastCalledWith(expect.stringContaining("period=2026-08"));
  });
});
