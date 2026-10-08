import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import { ZonasEntregaPanel } from "../ZonasEntregaPanel";
import { CalculatorSection } from "../CalculatorSection";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("../../../calculator-actions", () => ({ saveDeliveryZoneAction: mocks.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("../ParametrosPanel", () => ({ ParametrosPanel: () => <p>Parámetros sintéticos</p> }));
vi.mock("../TransportistasPanel", () => ({ TransportistasPanel: () => <p>Transportistas sintéticos</p> }));
vi.mock("../CiudadesPanel", () => ({ CiudadesPanel: (props: { cities: CalculatorCity[]; isAdmin: boolean }) => <ZonasEntregaPanel {...props} /> }));
const city: CalculatorCity = {
  id: "10000000-0000-4000-8000-000000000001", tenant_id: "tenant",
  slug: "acarigua", label: "Acarigua", km: 175, casco: true,
  sort_order: 1, created_at: "2026-10-08", updated_at: "2026-10-08",
};
const edit = () => fireEvent.click(screen.getByRole("button", { name: "Cambiar entrega de Acarigua" }));

describe("ZonasEntregaPanel", () => {
  beforeEach(() => { mocks.save.mockReset(); mocks.refresh.mockReset(); });
  it("cancela el borrador sin persistir", () => {
    render(<ZonasEntregaPanel cities={[city]} isAdmin />);
    edit();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText("Incluida")).toBeVisible();
    edit();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
  it("guarda exclusión, anuncia éxito después de persistir y refresca", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    render(<ZonasEntregaPanel cities={[city]} isAdmin />);
    edit();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    const [id, , data] = mocks.save.mock.calls[0];
    expect(id).toBe(city.id);
    expect(data.get("casco")).toBe("false");
    expect(data.get("previousCasco")).toBe("true");
    expect(screen.getByRole("status")).toHaveTextContent("Entrega de Acarigua actualizada.");
  });
  it("muestra espera, bloquea doble submit y conserva borrador ante error con foco", async () => {
    let resolve!: (value: { error: string }) => void;
    mocks.save.mockImplementation(() => new Promise((r) => { resolve = r; }));
    render(<ZonasEntregaPanel cities={[city]} isAdmin />);
    edit();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando…" });
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(mocks.save).toHaveBeenCalledOnce();
    await act(async () => resolve({ error: "No se pudo guardar. Intenta de nuevo." }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
  });
  it("no-admin ve estados sin controles de escritura", () => {
    render(<ZonasEntregaPanel cities={[city]} isAdmin={false} />);
    expect(screen.getByText("Incluida")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Solo un administrador/)).toBeVisible();
  });
  it("catálogo vacío muestra respaldo sin simular ciudades persistidas", () => {
    render(<ZonasEntregaPanel cities={[]} isAdmin />);
    expect(screen.getByText("No hay ciudades configuradas")).toBeVisible();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("conserva el borrador al consultar otra subpestaña y volver", () => {
    render(<CalculatorSection settings={null} cities={[city]} carriers={[]} tariffs={[]} isAdmin initialTab="ciudades" />);
    edit();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("tab", { name: "Parámetros" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Ciudades" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
