/**
 * Tests del validador de direcciones de entrega (SDD-0138 Slice B).
 * Sólo lógica pura (FormData → input/errores); la RLS y el trigger se prueban en DB.
 */
import { describe, it, expect } from "vitest";
import {
  validateClientAddressInput,
  formatDeliveryAddress,
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
      state: null,
      reference: null,
      isDefault: true,
    };
    expect(formatDeliveryAddress(base)).toBe("Av. Bolívar 14, Valencia");
  });
});
