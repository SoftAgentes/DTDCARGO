import { describe, it, expect } from "vitest";

import {
  validateOceanRouteInput,
  findOceanPoint,
  resolveOriginCity,
  OCEAN_ORIGINS,
  OCEAN_ORIGIN_CITIES,
  OCEAN_DESTINATIONS,
} from "../ocean-rate";

describe("validateOceanRouteInput · candado de país", () => {
  it("CN→VE FCL válido normaliza el slug a minúsculas y el modo a mayúsculas", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "NANSHA",
      pointIdTo: "La-Guaira",
      shippingType: "fcl",
      container: "hc40",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input).toEqual({
      pointIdFrom: "nansha",
      pointIdTo: "la-guaira",
      shippingType: "FCL",
      container: "HC40",
    });
  });

  it("destino Maracaibo (VE) permitido", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "ningbo",
      pointIdTo: "maracaibo",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.pointIdTo).toBe("maracaibo");
  });

  it("LCL rechazado — este cotizador es solo FCL (el LCL vive en /calculadora)", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "nansha",
      pointIdTo: "la-guaira",
      shippingType: "LCL",
    });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.shippingType).toBeTruthy();
  });

  it("CN→VE FCL sin contenedor → fieldError container", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "nansha",
      pointIdTo: "la-guaira",
      shippingType: "FCL",
    });
    expect(r.input).toBeUndefined();
    expect(r.fieldErrors?.container).toBeTruthy();
  });

  it("origen fuera de China (un destino usado como origen) → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "la-guaira",
      pointIdTo: "puerto-cabello",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.fieldErrors?.pointIdFrom).toBeTruthy();
  });

  it("destino fuera del catálogo (solo VE) → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "nansha",
      pointIdTo: "tokyo",
      shippingType: "FCL",
      container: "HC40",
    });
    expect(r.fieldErrors?.pointIdTo).toBeTruthy();
  });

  it("modo inválido → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "nansha",
      pointIdTo: "la-guaira",
      shippingType: "AIR",
    });
    expect(r.fieldErrors?.shippingType).toBeTruthy();
  });

  it("contenedor no permitido → rechazado", () => {
    const r = validateOceanRouteInput({
      pointIdFrom: "nansha",
      pointIdTo: "la-guaira",
      shippingType: "FCL",
      container: "ZZ99",
    });
    expect(r.fieldErrors?.container).toBeTruthy();
  });
});

describe("findOceanPoint + coherencia del catálogo", () => {
  it("encuentra por id (case-insensitive)", () => {
    expect(findOceanPoint("NANSHA")?.name).toBe("Nansha");
    expect(findOceanPoint("la-guaira")?.country).toBe("VE");
  });

  it("id desconocido → undefined", () => {
    expect(findOceanPoint("xyz")).toBeUndefined();
  });

  it("orígenes son CN; destinos son VE; todos con coords finitas", () => {
    expect(OCEAN_ORIGINS.every((p) => p.country === "CN")).toBe(true);
    expect(OCEAN_DESTINATIONS.every((p) => p.country === "VE")).toBe(true);
    const all = [...OCEAN_ORIGINS, ...OCEAN_DESTINATIONS];
    expect(all.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))).toBe(true);
  });

  it("ciudades de origen resuelven a un puerto export existente (Yiwu → Ningbo)", () => {
    expect(resolveOriginCity("yiwu")?.portId).toBe("ningbo");
    expect(resolveOriginCity("GUANGZHOU")?.portId).toBe("nansha");
    expect(resolveOriginCity("qingdao")?.portId).toBe("qingdao");
    expect(resolveOriginCity("ciudad-inexistente")).toBeUndefined();
    const portIds = new Set(OCEAN_ORIGINS.map((p) => p.id));
    expect(OCEAN_ORIGIN_CITIES.every((c) => portIds.has(c.portId))).toBe(true);
  });
});
