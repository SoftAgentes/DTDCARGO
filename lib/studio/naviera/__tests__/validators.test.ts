/**
 * Tests de los validadores manuales (SDD-0047, Slice A).
 *
 * Cubre el criterio de aceptación §5 Slice A (typecheck/lint + base testeable):
 * validate{Sailing,Booking,Consolidation,ConsolidationItem}Input con casos
 * válidos / inválidos, + los formateadores de código (espejo de los RPC).
 */

import { describe, it, expect } from "vitest";
import {
  validateSailingInput,
  validateBookingInput,
  validateConsolidationInput,
  validateConsolidationItemInput,
  formatBookingCode,
  formatConsolidationRef,
  BOOKING_CODE_RE,
  CONSOLIDATION_REF_RE,
  isContainerTypeCode,
} from "../types";

describe("validateSailingInput", () => {
  it("acepta un itinerario válido y normaliza pol/pod a mayúsculas", () => {
    const { input, fieldErrors } = validateSailingInput({
      vessel: "COSCO FORTUNE",
      voyage: "048W",
      pol: "ngb",
      pod: "pbl",
      etd: "2026-05-30",
      eta: "2026-07-02",
      cutoff: "2026-05-27",
      transitDays: 33,
      status: "cutoff",
      space: "media",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.pol).toBe("NGB");
    expect(input?.pod).toBe("PBL");
    expect(input?.transitDays).toBe(33);
    expect(input?.status).toBe("cutoff");
    expect(input?.space).toBe("media");
  });

  it("rechaza sin vessel / pol / pod", () => {
    const { input, fieldErrors } = validateSailingInput({
      vessel: "  ",
      pol: "",
      pod: "",
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.vessel).toBeDefined();
    expect(fieldErrors?.pol).toBeDefined();
    expect(fieldErrors?.pod).toBeDefined();
  });

  it("rechaza fechas mal formateadas", () => {
    const { fieldErrors } = validateSailingInput({
      vessel: "X",
      pol: "NGB",
      pod: "PBL",
      etd: "30-05-2026",
    });
    expect(fieldErrors?.etd).toBeDefined();
  });

  it("normaliza status/space desconocidos a abierto/alta", () => {
    const { input } = validateSailingInput({
      vessel: "X",
      pol: "NGB",
      pod: "PBL",
      status: "fantasia" as never,
      space: "infinita" as never,
    });
    expect(input?.status).toBe("abierto");
    expect(input?.space).toBe("alta");
  });

  it("rechaza transitDays negativo", () => {
    const { fieldErrors } = validateSailingInput({
      vessel: "X",
      pol: "NGB",
      pod: "PBL",
      transitDays: -3,
    });
    expect(fieldErrors?.transitDays).toBeDefined();
  });
});

describe("validateBookingInput", () => {
  it("acepta una reserva válida y mantiene container_type del catálogo", () => {
    const { input, fieldErrors } = validateBookingInput({
      mode: "LCL",
      containerType: "40HC",
      status: "confirmado",
      shipper: "DTD-Cargo Consol",
      commodity: "Carga consolidada",
      blNumber: "COSU6620041X",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.mode).toBe("LCL");
    expect(input?.containerType).toBe("40HC");
    expect(input?.status).toBe("confirmado");
    expect(input?.blNumber).toBe("COSU6620041X");
  });

  it("normaliza mode/status inválidos a LCL/abierto", () => {
    const { input } = validateBookingInput({
      mode: "AEREO" as never,
      status: "raro" as never,
    });
    expect(input?.mode).toBe("LCL");
    expect(input?.status).toBe("abierto");
  });

  it("rechaza container_type fuera del catálogo", () => {
    const { input, fieldErrors } = validateBookingInput({
      containerType: "45HC",
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.containerType).toBeDefined();
  });

  it("permite reserva sin BL (bl_number null)", () => {
    const { input } = validateBookingInput({ mode: "FCL" });
    expect(input?.blNumber).toBeNull();
    expect(input?.mode).toBe("FCL");
  });
});

describe("validateConsolidationInput", () => {
  it("acepta un contenedor con tipo válido", () => {
    const { input, fieldErrors } = validateConsolidationInput({
      containerType: "40HC",
      status: "consolidando",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.containerType).toBe("40HC");
    expect(input?.status).toBe("consolidando");
  });

  it("exige container_type", () => {
    const { input, fieldErrors } = validateConsolidationInput({
      containerType: "",
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.containerType).toBeDefined();
  });

  it("rechaza container_type fuera del catálogo", () => {
    const { fieldErrors } = validateConsolidationInput({
      containerType: "53HC",
    });
    expect(fieldErrors?.containerType).toBeDefined();
  });

  it("normaliza status desconocido a consolidando", () => {
    const { input } = validateConsolidationInput({
      containerType: "20GP",
      status: "explotado" as never,
    });
    expect(input?.status).toBe("consolidando");
  });
});

describe("validateConsolidationItemInput", () => {
  it("acepta una pieza con cbm > 0 y redondea pieces a entero", () => {
    const { input, fieldErrors } = validateConsolidationItemInput({
      cbm: 8.2,
      weightKg: 3400,
      pieces: 14.6,
      clientMarkbox: "DTD-5418",
      clientName: "Imp. Pereira",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.cbm).toBe(8.2);
    expect(input?.weightKg).toBe(3400);
    expect(input?.pieces).toBe(15);
    expect(input?.clientMarkbox).toBe("DTD-5418");
  });

  it("rechaza cbm <= 0", () => {
    const { input, fieldErrors } = validateConsolidationItemInput({
      cbm: 0,
      weightKg: 100,
      pieces: 1,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.cbm).toBeDefined();
  });

  it("rechaza peso/bultos negativos", () => {
    const { fieldErrors } = validateConsolidationItemInput({
      cbm: 1,
      weightKg: -5,
      pieces: -2,
    });
    expect(fieldErrors?.weightKg).toBeDefined();
    expect(fieldErrors?.pieces).toBeDefined();
  });

  it("shipment_id es opcional (null si vacío)", () => {
    const { input } = validateConsolidationItemInput({ cbm: 1 });
    expect(input?.shipmentId).toBeNull();
  });
});

describe("códigos correlativos (espejos de los RPC)", () => {
  it("formatBookingCode arma BKG-YYYY-NNNN con padding 4", () => {
    expect(formatBookingCode(2026, 1)).toBe("BKG-2026-0001");
    expect(formatBookingCode(2026, 418)).toBe("BKG-2026-0418");
    expect(BOOKING_CODE_RE.test(formatBookingCode(2026, 1))).toBe(true);
  });

  it("formatConsolidationRef arma DTD-CONSOL-NNNN con padding 4", () => {
    expect(formatConsolidationRef(502)).toBe("DTD-CONSOL-0502");
    expect(formatConsolidationRef(1)).toBe("DTD-CONSOL-0001");
    expect(CONSOLIDATION_REF_RE.test(formatConsolidationRef(502))).toBe(true);
  });

  it("isContainerTypeCode reconoce solo el catálogo", () => {
    expect(isContainerTypeCode("40HC")).toBe(true);
    expect(isContainerTypeCode("20GP")).toBe(true);
    expect(isContainerTypeCode("45HC")).toBe(false);
    expect(isContainerTypeCode(null)).toBe(false);
  });
});
