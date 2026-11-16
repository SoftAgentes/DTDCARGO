/**
 * SDD-0635 §3.3 · bandeja «N cambios para <persona>»: un motivo para todo,
 * validado igual que la RPC, y el alcance escrito antes de guardar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CambiosPendientes, type CambioPendiente } from "./CambiosPendientes";

const CAMBIOS: CambioPendiente[] = [
  { moduleId: "kommo", label: "CRM", nivel: "edit", teniaExtra: false },
  { moduleId: "rates", label: "Tarifas", nivel: "none", teniaExtra: true },
];

function pintar(over: Partial<Parameters<typeof CambiosPendientes>[0]> = {}) {
  const props = {
    persona: "Persona de prueba",
    rol: "Contabilidad",
    cambios: CAMBIOS,
    pending: false,
    onDeshacer: vi.fn(),
    onDescartar: vi.fn(),
    onGuardar: vi.fn(),
    ...over,
  };
  render(<CambiosPendientes {...props} />);
  return props;
}

describe("CambiosPendientes", () => {
  it("sin cambios no se dibuja", () => {
    const { container } = render(
      <CambiosPendientes persona="P" rol="R" cambios={[]} pending={false} onDeshacer={vi.fn()} onDescartar={vi.fn()} onGuardar={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("lista los cambios con su alcance", () => {
    pintar();
    expect(screen.getByRole("region", { name: "2 cambios para Persona de prueba" })).toBeTruthy();
    expect(screen.getByText("No cambia el rol Contabilidad")).toBeTruthy();
    expect(screen.getByText("+ CRM · ver y editar")).toBeTruthy();
    expect(screen.getByText("Quitar extra · Tarifas")).toBeTruthy();
  });

  it("un motivo corto no guarda; uno válido sale recortado, con la fecha", async () => {
    const u = userEvent.setup();
    const p = pintar();
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "abc");
    await u.click(screen.getByRole("button", { name: "Guardar 2 cambios" }));
    expect(p.onGuardar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/mínimo 5/);
    await u.clear(screen.getByLabelText("Motivo (obligatorio)"));
    await u.type(screen.getByLabelText("Motivo (obligatorio)"), "  Cubre una ausencia  ");
    await u.type(screen.getByLabelText("Vence (opcional)"), "2026-12-31");
    await u.click(screen.getByRole("button", { name: "Guardar 2 cambios" }));
    expect(p.onGuardar).toHaveBeenCalledWith({ reason: "Cubre una ausencia", expiresOn: "2026-12-31" });
  });

  it("Deshacer quita solo ese cambio", async () => {
    const u = userEvent.setup();
    const p = pintar();
    await u.click(screen.getByRole("button", { name: "Deshacer Tarifas" }));
    expect(p.onDeshacer).toHaveBeenCalledWith("rates");
  });

  it("si un extra ya tenía vencimiento, avisa que lo conserva", () => {
    pintar({ cambios: [{ moduleId: "kommo", label: "CRM", nivel: "edit", teniaExtra: true }] });
    expect(screen.getByText(/los extras que ya tenían vencimiento lo conservan/)).toBeTruthy();
  });
});
