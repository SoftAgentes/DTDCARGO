import { describe, it, expect } from "vitest";

import {
  validateOceanRouteInput,
  findOceanPoint,
  OCEAN_ORIGINS,
  OCEAN_DESTINATIONS,
} from "../ocean-rate";

describe("validateOceanRouteInput · candado de país", () => {
  it("CN→VE LCL válido normaliza a mayúsculas", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "p_27395",
      pointIdTo: "p_19774",
      shippingType: "lcl",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toEqual({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "LCL",
    });
  });

  it("CN→VE FCL sin contenedor → fieldError container", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
    });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.container).toBeTruthy();
  });

  it("FCL con contenedor válido normaliza", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "hc40",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toMatchObject({ container: "HC40" });
  });

  it("origen fuera de China (VE→VE) → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_19774",
      pointIdTo: "P_19792",
      shippingType: "LCL",
    });
    expect(r.fieldErrors?.pointIdFrom).toBeTruthy();
  });

  it("destino no permitido (fuera de VE/CO) → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_99999",
      shippingType: "LCL",
    });
    expect(r.fieldErrors?.pointIdTo).toBeTruthy();
  });

  it("modo inválido → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "AIR",
    });
    expect(r.fieldErrors?.shippingType).toBeTruthy();
  });

  it("contenedor no permitido → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "P_27395",
      pointIdTo: "P_19774",
      shippingType: "FCL",
      container: "ZZ99",
    });
    expect(r.fieldErrors?.container).toBeTruthy();
  });
});

describe("findOceanPoint + coherencia del catálogo", () => {
  it("encuentra por id (case-insensitive)", () => {
    expect(findOceanPoint("p_27395")?.name).toBe("Nansha");
    expect(findOceanPoint("P_19774")?.country).toBe("VE");
  });

  it("id desconocido → undefined", () => {
    expect(findOceanPoint("P_00000")).toBeUndefined();
  });

  it("orígenes son CN; destinos son VE/CO", () => {
    expect(OCEAN_ORIGINS.every((p) => p.country === "CN")).toBe(true);
    expect(OCEAN_DESTINATIONS.every((p) => p.country === "VE" || p.country === "CO")).toBe(true);
  });
});
