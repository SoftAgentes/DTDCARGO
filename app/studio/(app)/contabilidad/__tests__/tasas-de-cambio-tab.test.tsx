/**
 * SDD-0569 · La contadora carga las tasas desde Contabilidad › Tasas de cambio
 * (revisión de seguridad, NO VERIFICADO: la acción exigía el módulo «admin» y
 * accounting no entra a Admin). La pestaña monta la misma sección que Admin.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/studio/(app)/contabilidad/actions", () => ({}));
vi.mock("@/app/studio/(app)/admin/exchange-rates-actions", () => ({ recordExchangeRateAction: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/studio/contabilidad",
  useSearchParams: () => new URLSearchParams("tab=tasas"),
}));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({
  useToast: () => ({ show: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));

import { ContabilidadClient } from "../_components/ContabilidadClient";

afterEach(() => cleanup());

describe("Contabilidad › Tasas de cambio", () => {
  it("la pestaña existe y muestra el formulario de la tasa", () => {
    render(
      <ContabilidadClient
        tab="tasas"
        tasas={{ latest: [{ pair: "CNY/USD", rate: 7.2, validOn: "2026-10-20", source: "bcv" }] }}
        accounts={[]}
        balances={{}}
        entries={[]}
        conteoDiario={null}
        ledger={null}
        ledgerAccountId={null}
        reportes={null}
        filtroReportes={null}
        cuadre={null}
        closingDate={null}
        canEditClosing={false}
        statements={[]}
        activeStatement={null}
        candidates={[]}
        assets={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Tasas de cambio" })).toBeTruthy();
    expect(screen.getByText("Registrar tasa nueva")).toBeTruthy();
    expect(screen.getByText("del 20/10/2026 · BCV")).toBeTruthy();
  });
});
