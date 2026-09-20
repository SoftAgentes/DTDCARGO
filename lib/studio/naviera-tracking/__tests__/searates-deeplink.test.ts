// @vitest-environment node
/**
 * Tests del deep-link de tracking de SeaRates (SDD-0101 · Slice A · lógica PURA).
 * Modo cero-cuota: armar la URL de la web de SeaRates sin gastar llamadas del API.
 */
import { describe, it, expect } from "vitest";
import {
  buildSeaRatesTrackingUrl,
  pickTrackingRef,
  trackingUrlFromSnapshot,
} from "../searates-deeplink";
import { hasNavieraData, type NavieraSnapshot } from "../types";

const BASE_SNAP: NavieraSnapshot = {
  consolidationRef: "DTD-CONSOL-0502",
  navieraStatus: "zarpado",
  containerNo: null,
  containerType: "40HC",
  blNumber: null,
  carrierName: "COSCO",
  carrierScac: "COSU",
  vessel: "COSCO FORTUNE",
  voyage: "048W",
  pol: "NGB",
  pod: "PBL",
  etd: "2026-06-10",
  eta: "2026-07-25",
};

describe("pickTrackingRef — con qué se trackea", () => {
  it("prefiere el nº de contenedor sobre el BL", () => {
    const ref = pickTrackingRef({ ...BASE_SNAP, containerNo: "COSU1234567", blNumber: "COSU6620041X" });
    expect(ref).toEqual({ kind: "container", value: "COSU1234567", scac: "COSU" });
  });

  it("cae al BL si no hay contenedor", () => {
    const ref = pickTrackingRef({ ...BASE_SNAP, containerNo: null, blNumber: "COSU6620041X" });
    expect(ref).toEqual({ kind: "bl", value: "COSU6620041X", scac: "COSU" });
  });

  it("sin contenedor ni BL → null (no se puede trackear)", () => {
    expect(pickTrackingRef({ ...BASE_SNAP, containerNo: null, blNumber: null })).toBeNull();
  });

  it("sin SCAC → scac null (SeaRates autodetecta)", () => {
    const ref = pickTrackingRef({ ...BASE_SNAP, containerNo: "COSU1234567", carrierScac: null });
    expect(ref?.scac).toBeNull();
  });

  it("snapshot null → null", () => {
    expect(pickTrackingRef(null)).toBeNull();
  });
});

describe("buildSeaRatesTrackingUrl — URL de la web de SeaRates", () => {
  it("contenedor + SCAC → type=CT y sealine fijado", () => {
    const url = buildSeaRatesTrackingUrl({ kind: "container", value: "COSU1234567", scac: "COSU" });
    expect(url).toContain("https://www.searates.com/container/tracking/");
    expect(url).toContain("number=COSU1234567");
    expect(url).toContain("type=CT");
    expect(url).toContain("sealine=COSU");
  });

  it("BL → type=BL", () => {
    const url = buildSeaRatesTrackingUrl({ kind: "bl", value: "COSU6620041X", scac: "COSU" });
    expect(url).toContain("type=BL");
  });

  it("sin SCAC → sealine=AUTO", () => {
    const url = buildSeaRatesTrackingUrl({ kind: "container", value: "COSU1234567", scac: null });
    expect(url).toContain("sealine=AUTO");
  });

  it("normaliza espacios y minúsculas del número", () => {
    const url = buildSeaRatesTrackingUrl({ kind: "container", value: " cosu 123 4567 ", scac: null });
    expect(url).toContain("number=COSU1234567");
  });

  it("referencia vacía / null → null", () => {
    expect(buildSeaRatesTrackingUrl({ kind: "container", value: "   ", scac: null })).toBeNull();
    expect(buildSeaRatesTrackingUrl(null)).toBeNull();
  });
});

describe("trackingUrlFromSnapshot — atajo end-to-end", () => {
  it("snapshot con contenedor → URL completa", () => {
    const url = trackingUrlFromSnapshot({ ...BASE_SNAP, containerNo: "MSKU7654321", carrierScac: "MAEU" });
    expect(url).toContain("number=MSKU7654321");
    expect(url).toContain("sealine=MAEU");
  });

  it("snapshot sin contenedor ni BL → null", () => {
    expect(trackingUrlFromSnapshot({ ...BASE_SNAP, containerNo: null, blNumber: null })).toBeNull();
  });
});

describe("hasNavieraData — ¿hay algo naviero que mostrar?", () => {
  it("true con buque/ETA/contenedor/BL", () => {
    expect(hasNavieraData(BASE_SNAP)).toBe(true);
  });

  it("false si solo hay ref/estado pero nada naviero", () => {
    expect(
      hasNavieraData({
        consolidationRef: "DTD-CONSOL-0502",
        navieraStatus: "consolidando",
        containerNo: null,
        containerType: "40HC",
        blNumber: null,
        carrierName: null,
        carrierScac: null,
        vessel: null,
        voyage: null,
        pol: null,
        pod: null,
        etd: null,
        eta: null,
      }),
    ).toBe(false);
  });

  it("false con null", () => {
    expect(hasNavieraData(null)).toBe(false);
  });
});
