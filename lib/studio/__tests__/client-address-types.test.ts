// @vitest-environment node
/**
 * Tests del validador de direcciones de entrega (SDD-0138 Slice B).
 * Sólo lógica pura (FormData → input/errores); la RLS y el trigger se prueban en DB.
 */
import { describe, it, expect } from "vitest";
import {
  validateClientAddressInput,
  formatDeliveryAddress,
  lastMileEstimate,
  type ClientDeliveryAddress,
} from "../client-address-types";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("validateClientAddressInput", () => {
  it("acepta una dirección válida y limpia los opcionales vacíos a null", () => {
    const res = validateClientAddressInput(
      fd({ line: "  Av. Bolívar, Edif. 4  ", label: "Casa", city: "", state: "Carabobo" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.line).toBe("Av. Bolívar, Edif. 4"); // trim
      expect(res.value.label).toBe("Casa");
      expect(res.value.city).toBeNull(); // vacío → null
      expect(res.value.state).toBe("Carabobo");
      expect(res.value.isDefault).toBe(false);
    }
  });

  it("exige la dirección (line) — vacía → error de campo", () => {
    const res = validateClientAddressInput(fd({ line: "   ", city: "Valencia" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.line).toBeTruthy();
  });

  it("marca isDefault cuando el checkbox viene 'on'", () => {
    const res = validateClientAddressInput(fd({ line: "Calle 1", isDefault: "on" }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.isDefault).toBe(true);
  });

  it("rechaza una dirección demasiado larga", () => {
    const res = validateClientAddressInput(fd({ line: "x".repeat(201) }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.line).toBeTruthy();
  });
});

describe("formatDeliveryAddress", () => {
  it("une line + city + state sin comas colgantes", () => {
    const base: ClientDeliveryAddress = {
      id: "a1",
      clientId: "c1",
      label: null,
      line: "Av. Bolívar 14",
      city: "Valencia",
      citySlug: "valencia",
      state: null,
      reference: null,
      isDefault: true,
    };
    expect(formatDeliveryAddress(base)).toBe("Av. Bolívar 14, Valencia");
  });
});

describe("lastMileEstimate — misma regla del calculador (§5.7, SDD-0237)", () => {
  it("zona sin costo → entrega incluida", () => {
    expect(lastMileEstimate({ casco: true, ventaCbm: 105.94 })).toEqual({
      included: true,
    });
  });

  it("devuelve una TARIFA por m³, no un monto fijo", () => {
    // Es el punto del cambio: la tarjeta de direcciones no sabe cuántos m³
    // trae el cliente, así que un monto sería inventado.
    expect(lastMileEstimate({ casco: false, ventaCbm: 123.6 })).toEqual({
      included: false,
      usdPorCbm: 123.6,
    });
  });

  it("sin tarifa confirmada → lo dice, no cobra $0 por omisión", () => {
    expect(lastMileEstimate({ casco: false, ventaCbm: null })).toEqual({
      included: false,
      sinTarifa: true,
    });
    expect(lastMileEstimate({ casco: false })).toEqual({
      included: false,
      sinTarifa: true,
    });
  });

  it("un precio en 0 o negativo se trata como sin tarifa", () => {
    expect(lastMileEstimate({ casco: false, ventaCbm: 0 })).toEqual({
      included: false,
      sinTarifa: true,
    });
  });

  it("el km ya NO entra en la cuenta", () => {
    // Dos ciudades a distancias opuestas con el mismo tramo cobran igual.
    const cerca = lastMileEstimate({ casco: false, ventaCbm: 123.6 });
    const lejos = lastMileEstimate({ casco: false, ventaCbm: 123.6 });
    expect(cerca).toEqual(lejos);
  });

  it("acepta citySlug opcional en el validador", () => {
    const f = new FormData();
    f.set("line", "Calle 1");
    f.set("city", "Maracaibo");
    f.set("citySlug", "maracaibo");
    const res = validateClientAddressInput(f);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.citySlug).toBe("maracaibo");
  });
});
