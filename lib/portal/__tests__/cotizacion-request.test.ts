// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateCotizacionRequest,
  buildCotizacionRow,
  buildCotizacionNota,
  canAdvanceEstimate,
  COTIZACION_SERVICES,
} from "../cotizacion-request";

describe("validateCotizacionRequest", () => {
  it("acepta una solicitud mínima válida (service + description)", () => {
    const r = validateCotizacionRequest({
      service: "consolidado_lcl",
      description: "Quiero traer 10 cajas de repuestos.",
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.service).toBe("consolidado_lcl");
    // Defaults sensatos cuando no se dan.
    expect(r.input?.origin).toBe("China");
    expect(r.input?.destination).toBe("Venezuela");
  });

  it("rechaza service inválido o ausente", () => {
    expect(
      validateCotizacionRequest({ service: "avion", description: "x" }).fieldErrors
        ?.service,
    ).toBeTruthy();
    expect(
      validateCotizacionRequest({ description: "x" }).fieldErrors?.service,
    ).toBeTruthy();
  });

  it("exige descripción no vacía", () => {
    const r = validateCotizacionRequest({
      service: "fcl_directo",
      description: "   ",
    });
    expect(r.fieldErrors?.description).toBeTruthy();
  });

  it("rechaza descripción demasiado larga", () => {
    const r = validateCotizacionRequest({
      service: "fcl_directo",
      description: "a".repeat(2001),
    });
    expect(r.fieldErrors?.description).toBeTruthy();
  });

  it("normaliza números (coma decimal, redondea cajas, descarta negativos)", () => {
    const r = validateCotizacionRequest({
      service: "puerta_a_puerta_DDP",
      description: "muebles",
      cbm: "12,5",
      weightKg: "300",
      boxes: "8.7",
    });
    expect(r.input?.cbm).toBe(12.5);
    expect(r.input?.weightKg).toBe(300);
    expect(r.input?.boxes).toBe(9); // redondeado
  });

  it("números inválidos/negativos → null", () => {
    const r = validateCotizacionRequest({
      service: "consolidado_lcl",
      description: "x",
      cbm: "-3",
      weightKg: "abc",
      boxes: "",
    });
    expect(r.input?.cbm).toBeNull();
    expect(r.input?.weightKg).toBeNull();
    expect(r.input?.boxes).toBeNull();
  });

  it("respeta origin/destination provistos", () => {
    const r = validateCotizacionRequest({
      service: "consolidado_lcl",
      description: "x",
      origin: "Yiwu",
      destination: "Maracay",
    });
    expect(r.input?.origin).toBe("Yiwu");
    expect(r.input?.destination).toBe("Maracay");
  });
});

describe("buildCotizacionNota", () => {
  it("marca la procedencia del portal y agrega volumen si existe", () => {
    const nota = buildCotizacionNota({
      service: "consolidado_lcl",
      origin: "Yiwu",
      destination: "Valencia",
      description: "repuestos",
      cbm: 5,
      weightKg: 200,
      boxes: 10,
    });
    expect(nota).toContain("Solicitud del portal");
    expect(nota).toContain("repuestos");
    expect(nota).toContain("5 CBM");
    expect(nota).toContain("200 kg");
    expect(nota).toContain("10 cajas");
  });

  it("sin volumen no agrega la cola 'Aprox'", () => {
    const nota = buildCotizacionNota({
      service: "consolidado_lcl",
      origin: "China",
      destination: "Venezuela",
      description: "consulta",
      cbm: null,
      weightKg: null,
      boxes: null,
    });
    expect(nota).toContain("consulta");
    expect(nota).not.toContain("Aprox");
  });
});

describe("buildCotizacionRow", () => {
  it("arma una quote source='studio' draft, precio en 0, con markbox/nombre de la sesión", () => {
    const { input } = validateCotizacionRequest({
      service: "fcl_directo",
      description: "un contenedor",
      cbm: "28",
    });
    const row = buildCotizacionRow(input!, {
      clientMarkbox: "DTD-1004",
      clientName: "Empresa Demo S.A.",
    });
    expect(row.source).toBe("studio");
    expect(row.status).toBe("draft");
    expect(row.client_markbox).toBe("DTD-1004");
    expect(row.client_name).toBe("Empresa Demo S.A.");
    expect(row.service).toBe("fcl_directo");
    expect(row.subtotal_usd).toBe(0);
    expect(row.total_usd).toBe(0);
    expect(row.packaging).toBe("carton");
    expect(row.weight_kg).toBeNull();
    expect(row.cbm).toBe(28);
    expect(row.nota).toContain("Solicitud del portal");
  });
});

describe("canAdvanceEstimate", () => {
  it("permite avanzar un estimado en revisión (draft) sin convertir", () => {
    expect(
      canAdvanceEstimate({ status: "draft", convertedToShipmentId: null }),
    ).toBe(true);
  });

  it("permite avanzar uno enviado o aceptado", () => {
    expect(
      canAdvanceEstimate({ status: "sent", convertedToShipmentId: null }),
    ).toBe(true);
    expect(
      canAdvanceEstimate({ status: "accepted", convertedToShipmentId: null }),
    ).toBe(true);
  });

  it("NO permite avanzar uno rechazado o vencido", () => {
    expect(
      canAdvanceEstimate({ status: "rejected", convertedToShipmentId: null }),
    ).toBe(false);
    expect(
      canAdvanceEstimate({ status: "expired", convertedToShipmentId: null }),
    ).toBe(false);
  });

  it("NO permite avanzar uno ya convertido en envío", () => {
    expect(
      canAdvanceEstimate({ status: "accepted", convertedToShipmentId: "ship-1" }),
    ).toBe(false);
  });
});

describe("COTIZACION_SERVICES", () => {
  it("son los 5 servicios núcleo del enum", () => {
    expect(COTIZACION_SERVICES).toEqual([
      "puerta_a_puerta_DDP",
      "consolidado_lcl",
      "fcl_directo",
      "fcl_bodega",
      "transporte_terrestre",
    ]);
  });
});
