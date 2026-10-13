import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PortalMaintenanceNotice } from "../PortalMaintenanceNotice";
import { avisoDeMantenimiento } from "@/lib/runtime/maintenance-notice";

afterEach(cleanup);

const VENTANA = {
  MAINTENANCE_NOTICE_START: "2026-10-14T02:00:00Z",
  MAINTENANCE_NOTICE_END: "2026-10-14T03:00:00Z",
};

describe("PortalMaintenanceNotice", () => {
  it("sin aviso no pinta nada", () => {
    const { container } = render(<PortalMaintenanceNotice aviso={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("con la ventana configurada pinta título, horario y el rol status", () => {
    const aviso = avisoDeMantenimiento(VENTANA, new Date("2026-10-13T15:30:00Z"));
    render(<PortalMaintenanceNotice aviso={aviso} />);
    const caja = screen.getByRole("status");
    expect(caja.textContent).toContain("Mantenimiento programado");
    expect(caja.textContent).toContain("Hoy martes 13 de octubre, de 10:00 p. m. a 11:00 p. m. (hora de Venezuela)");
  });

  it("pasado el fin, el layout le pasa null y no queda rastro", () => {
    const aviso = avisoDeMantenimiento(VENTANA, new Date("2026-10-14T03:00:01Z"));
    const { container } = render(<PortalMaintenanceNotice aviso={aviso} />);
    expect(container.innerHTML).toBe("");
  });
});
