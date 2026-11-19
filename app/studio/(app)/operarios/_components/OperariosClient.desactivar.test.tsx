/**
 * SDD-0678 fase 2 · desactivar un operario muestra que está trabajando (BTN-01 §5): el interruptor queda deshabilitado
 * con `aria-busy` y dice «Desactivando…», y un doble clic manda una sola desactivación.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperarioRow } from "@/lib/studio/operario-queries";

let terminar: () => void = () => {};
const setOperarioActiveAction = vi.fn(
  (_fd: FormData) =>
    new Promise<void>((ok) => {
      terminar = ok;
    }),
);

vi.mock("../actions", () => ({
  createOperarioAction: vi.fn(),
  generateOperarioPinAction: vi.fn(),
  resetOperarioPinAction: vi.fn(),
  viewOperarioPinAction: vi.fn(),
  setOperarioActiveAction: (fd: FormData) => setOperarioActiveAction(fd),
  updateOperarioAction: vi.fn(),
}));

import { OperariosClient } from "./OperariosClient";

const ANA: OperarioRow = {
  id: "50000000-0000-4000-8000-000000000001",
  tenant_id: "10000000-0000-4000-8000-000000000001",
  display_name: "Ana China",
  display_name_cn: null,
  region: "cn",
  role: "operario",
  warehouse_id: "30000000-0000-4000-8000-000000000001",
  active: true,
  last_login_at: null,
  created_at: "2026-05-26T00:00:00Z",
  warehouse_code: "YIW-A1",
  warehouse_name_es: "Yiwu",
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
  setOperarioActiveAction.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Operarios · desactivar con estado de trabajo", () => {
  it("mientras corre: deshabilitado, aria-busy y «Desactivando a …»; un doble clic envía una vez", async () => {
    const user = userEvent.setup();
    render(<OperariosClient operarios={[ANA]} warehouses={[]} rolesPorRegion={null} />);

    const boton = screen.getByRole("button", { name: "Desactivar a Ana China" });
    expect(boton).toHaveAttribute("aria-busy", "false");
    await user.dblClick(boton);

    const corriendo = await screen.findByRole("button", { name: "Desactivando a Ana China…" });
    expect(corriendo).toBeDisabled();
    expect(corriendo).toHaveAttribute("aria-busy", "true");
    expect(setOperarioActiveAction).toHaveBeenCalledTimes(1);
    const fd = setOperarioActiveAction.mock.calls[0][0];
    expect(fd.get("operario_id")).toBe(ANA.id);
    expect(fd.get("active")).toBe("false");

    await act(async () => terminar());
    expect(await screen.findByRole("button", { name: "Desactivar a Ana China" })).toBeEnabled();
  });
});
