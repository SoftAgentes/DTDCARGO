import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CityPicker } from "../_components/CityPicker";
import type { DispatchCity } from "@/lib/studio/dispatch-routes-types";

vi.mock("../actions", () => ({ createCityAction: vi.fn() }));
import { createCityAction } from "../actions";

const cities: DispatchCity[] = ["Ciudad Alfa", "Ciudad Beta"].map((city, i) => ({
  id: `ficticia-${i}`, tenant_id: "tenant-ficticio", city,
  state_code: "XX", state_name: "Estado ficticio", municipio: "Municipio ficticio",
  postal_code: null, default_radius_km: 20, is_hq: false, active: true,
  usage_count: 0, created_at: "2026-01-01", updated_at: "2026-01-01",
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Formulario({ onChange }: { onChange: (city: string) => void }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  return <>
    <CityPicker label="Ciudad origen" placeholder="Elegir origen" value={origin}
      onChange={(city) => { setOrigin(city); onChange(city); }}
      cities={cities.filter((c) => c.city !== destination)} veCatalog={[]} />
    <CityPicker label="Ciudad destino" placeholder="Elegir destino" value={destination}
      onChange={(city) => { setDestination(city); onChange(city); }}
      cities={cities.filter((c) => c.city !== origin)} veCatalog={[]} />
    <button type="button">Siguiente control</button>
  </>;
}

describe("Rutas: foco al escoger una ciudad existente", () => {
  it("devuelve el foco a cada disparador y Tab avanza sin duplicar cambios", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Formulario onChange={onChange} />);
    const origin = screen.getByRole("button", { name: "Elegir origen" });
    const destination = screen.getByRole("button", { name: "Elegir destino" });
    await user.click(origin);
    expect(screen.getByPlaceholderText("Buscar ciudad…")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Ciudad Alfa/ }));
    expect(origin).toHaveFocus();
    expect(onChange).toHaveBeenCalledExactlyOnceWith("Ciudad Alfa");
    await user.tab();
    expect(destination).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: /Ciudad Beta/ }));
    expect(destination).toHaveFocus();
    expect(onChange.mock.calls).toEqual([["Ciudad Alfa"], ["Ciudad Beta"]]);
    await user.tab();
    expect(screen.getByRole("button", { name: "Siguiente control" })).toHaveFocus();
    expect(createCityAction).not.toHaveBeenCalled();
  });

  it("cerrar al pulsar fuera conserva el destino del clic y no selecciona", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Formulario onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Elegir destino" }));
    await user.click(screen.getByRole("button", { name: "Siguiente control" }));
    expect(screen.queryByPlaceholderText("Buscar ciudad…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente control" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    expect(createCityAction).not.toHaveBeenCalled();
  });
});
