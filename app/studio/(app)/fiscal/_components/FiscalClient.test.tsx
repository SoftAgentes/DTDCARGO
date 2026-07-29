import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FISCAL_SETTINGS,
  type FiscalSettings,
} from "@/lib/studio/fiscal/config-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=config&period=2026-07"),
}));
vi.mock("./FiscalConfig", () => ({
  FiscalConfig: () => <div>Configuración fiscal</div>,
}));
vi.mock("./WithholdingsView", () => ({
  WithholdingsView: () => <div>Retenciones fiscales</div>,
}));
vi.mock("../actions", () => ({
  postFiscalBookAction: vi.fn(),
  voidFiscalBookAction: vi.fn(),
}));

import { FiscalClient } from "./FiscalClient";

const SETTINGS: FiscalSettings = {
  ...DEFAULT_FISCAL_SETTINGS,
  tenant_id: "tenant-test",
  updated_at: null,
  updated_by: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("FiscalClient tabs", () => {
  it("expone un único tab stop y asocia el tab activo con su panel", () => {
    render(
      <FiscalClient
        tab="config"
        period="2026-07"
        settings={SETTINGS}
        canEditConfig
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.filter((item) => item.tabIndex === 0)).toEqual([tabs[0]]);
    expect(tabs.slice(1).every((item) => item.tabIndex === -1)).toBe(true);
    expect(tabs[0]).toHaveAttribute("aria-controls", "fiscal-panel-config");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "fiscal-panel-config");
    expect(panel).toHaveAttribute("aria-labelledby", "fiscal-tab-config");
  });

  it("ArrowRight mueve el foco y activa el tab siguiente", async () => {
    const user = userEvent.setup();
    render(
      <FiscalClient
        tab="config"
        period="2026-07"
        settings={SETTINGS}
        canEditConfig
      />,
    );

    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowRight}");

    expect(tabs[1]).toHaveFocus();
    expect(pushMock).toHaveBeenCalledWith(
      "/studio/fiscal?tab=ventas&period=2026-07",
    );
  });

  it("ArrowLeft hace wrap desde el primer tab hacia el último", async () => {
    const user = userEvent.setup();
    render(
      <FiscalClient
        tab="config"
        period="2026-07"
        settings={SETTINGS}
        canEditConfig
      />,
    );

    const tabs = screen.getAllByRole("tab");
    tabs[0].focus();
    await user.keyboard("{ArrowLeft}");

    expect(tabs[3]).toHaveFocus();
    expect(pushMock).toHaveBeenLastCalledWith(
      "/studio/fiscal?tab=retenciones&period=2026-07",
    );
  });

  it("Home y End recorren los extremos sin sacar el foco del tablist", async () => {
    const user = userEvent.setup();
    render(
      <FiscalClient
        tab="ventas"
        period="2026-07"
        settings={SETTINGS}
        canEditConfig
      />,
    );

    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();
    await user.keyboard("{End}");
    expect(tabs[3]).toHaveFocus();
    expect(pushMock).toHaveBeenLastCalledWith(
      "/studio/fiscal?tab=retenciones&period=2026-07",
    );

    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    expect(pushMock).toHaveBeenLastCalledWith(
      "/studio/fiscal?tab=config&period=2026-07",
    );
  });
});
