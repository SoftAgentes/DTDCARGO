import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalculatorCity } from "@/lib/studio/calculator-cities-types";
import { CityDrawer } from "../CityDrawer";
import { CiudadesPanel } from "../CiudadesPanel";

const mocks = vi.hoisted(() => ({
  update: vi.fn(), create: vi.fn(), remove: vi.fn(), close: vi.fn(),
  router: { refresh: vi.fn(), push: vi.fn() },
  toast: { success: vi.fn() },
}));
vi.mock("../../../calculator-actions", () => ({ updateCityAction: mocks.update, createCityAction: mocks.create, deleteCityAction: mocks.remove }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/studio/admin", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/studio/_components/ui/ToastProvider", () => ({ useToast: () => mocks.toast }));
vi.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key === "chrome.action.close" ? "Cerrar" : key }));

const city: CalculatorCity = {
  id: "10000000-0000-4000-8000-000000000001", tenant_id: "tenant",
  slug: "acarigua", label: "Acarigua", km: 175, casco: true,
  sort_order: 4, created_at: "2026-10-08", updated_at: "2026-10-08",
};
const checkbox = () => screen.getByRole("checkbox", { name: "Entrega incluida, sin costo adicional" });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

describe("CityDrawer original · única opción de entrega", () => {
  beforeEach(() => {
    mocks.update.mockReset(); mocks.create.mockReset(); mocks.remove.mockReset(); mocks.close.mockReset();
    mocks.router.refresh.mockReset(); mocks.router.push.mockReset(); mocks.toast.success.mockReset();
  });

  it.each([true, false])("carga el estado persistido casco=%s en la única casilla", (included) => {
    render(<CityDrawer mode="edit" city={{ ...city, casco: included }} onClose={mocks.close} />);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(checkbox()).toHaveProperty("checked", included);
    expect(checkbox()).toHaveAccessibleDescription(/Si está marcada, el cliente no paga recargo/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([true, false])("envía el FormData original al cambiar casco desde %s y confirma después de guardar", async (included) => {
    mocks.update.mockResolvedValue({ ok: true });
    render(<CityDrawer mode="edit" city={{ ...city, casco: included }} onClose={mocks.close} />);
    fireEvent.click(checkbox());
    save();
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    const [id, , data] = mocks.update.mock.calls[0];
    expect(id).toBe(city.id);
    expect(data.get("casco")).toBe(included ? null : "on");
    expect(data.get("label")).toBe(city.label);
    expect(data.get("slug")).toBe(city.slug);
    expect(data.get("km")).toBe(String(city.km));
    expect(data.get("sort_order")).toBe(String(city.sort_order));
    expect(mocks.toast.success).toHaveBeenCalledWith("Ciudad actualizada");
    expect(mocks.router.refresh).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("el listado abre sólo Editar ciudad y cancelar descarta el borrador sin mutar", () => {
    render(<CiudadesPanel cities={[city]} isAdmin />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Zonas con entrega incluida")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar ciudad" }));
    expect(screen.getByRole("dialog", { name: "Editar ciudad" })).toBeVisible();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(checkbox());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Incluida")).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Editar ciudad" }));
    expect(checkbox()).toBeChecked();
  });

  it("conserva la casilla y otros campos ante error, permite reintentar y no anuncia éxito anticipado", async () => {
    let resolve!: (value: { error: string }) => void;
    mocks.update.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    render(<CityDrawer mode="edit" city={city} onClose={mocks.close} />);
    fireEvent.click(checkbox());
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "8" } });
    save();
    await screen.findByRole("button", { name: "Guardando…" });
    expect(checkbox()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    await act(async () => resolve({ error: "No se pudo guardar la ciudad. Tu selección se conserva; intenta de nuevo." }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(checkbox()).not.toBeChecked();
    expect(screen.getByLabelText("Orden")).toHaveValue(8);
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
    mocks.update.mockResolvedValueOnce({ ok: true });
    save();
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[1][2].get("casco")).toBeNull();
    expect(mocks.update.mock.calls[1][2].get("sort_order")).toBe("8");
    expect(mocks.toast.success).toHaveBeenCalledOnce();
  });

  it("no-admin conserva lectura de estados y no abre controles de edición", () => {
    render(<CiudadesPanel cities={[city]} isAdmin={false} />);
    expect(screen.getByText("Incluida")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Editar ciudad" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Nueva ciudad/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
