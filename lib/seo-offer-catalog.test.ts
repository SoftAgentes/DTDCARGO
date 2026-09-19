// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildOfferCatalog, isOfferable } from "./seo-offer-catalog";
import { SERVICIOS_DETALLE } from "./servicios-detalle";

const ORG = { "@id": "https://dtdcargo.com/#organization" };

describe("isOfferable (anti-invención SDD-0064)", () => {
  it("excluye 'suspendido' y 'proximamente'", () => {
    expect(isOfferable({ estado: "suspendido" })).toBe(false);
    expect(isOfferable({ estado: "proximamente" })).toBe(false);
  });

  it("incluye 'activo', 'a-pedido' y undefined (default activo)", () => {
    expect(isOfferable({ estado: "activo" })).toBe(true);
    expect(isOfferable({ estado: "a-pedido" })).toBe(true);
    expect(isOfferable({ estado: undefined })).toBe(true);
  });

  it("transporte-terrestre (proximamente) NO es ofrecible hoy", () => {
    const terrestre = SERVICIOS_DETALLE.find(
      (s) => s.slug === "transporte-terrestre",
    );
    expect(terrestre).toBeDefined();
    expect(isOfferable(terrestre!)).toBe(false);
  });
});

describe("buildOfferCatalog", () => {
  const catalog = buildOfferCatalog({
    servicios: SERVICIOS_DETALLE.filter(isOfferable),
    siteUrl: "https://dtdcargo.com",
    provider: ORG,
  });

  it("es un OfferCatalog con el provider ligado por @id", () => {
    expect(catalog["@type"]).toBe("OfferCatalog");
    expect(catalog.provider).toEqual(ORG);
  });

  it("NO incluye @context (se anida en @graph o se envuelve aparte)", () => {
    expect("@context" in catalog).toBe(false);
  });

  it("cada Offer apunta a /servicios#slug y referencia al provider por @id", () => {
    const first = catalog.itemListElement[0];
    expect(first["@type"]).toBe("Offer");
    expect(first.position).toBe(1);
    expect(first.itemOffered.url).toMatch(
      /^https:\/\/dtdcargo\.com\/servicios#/,
    );
    expect(first.itemOffered.provider).toEqual(ORG);
  });

  it("NO lista servicios no ofrecibles (transporte-terrestre)", () => {
    const urls = catalog.itemListElement.map((o) => o.itemOffered.url);
    expect(urls.some((u) => u.includes("transporte-terrestre"))).toBe(false);
  });

  it("la descripción concatena resumen + 'Incluye: …' cuando hay incluye", () => {
    const ddp = catalog.itemListElement.find((o) =>
      o.itemOffered.url.includes("dtd-services-lcl"),
    );
    expect(ddp).toBeDefined();
    expect(ddp!.itemOffered.description).toContain("Incluye:");
  });
});
