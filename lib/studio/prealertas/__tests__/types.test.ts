/**
 * Tests del módulo Portal · Compras (prealertas) + Proveedores (SDD-0057,
 * Slice A). Cubre los criterios de aceptación §5 Slice A: validadores
 * (name/description vacíos, boxes 0/negativo, status inválido, est_value
 * negativo), `boxCode` (incl. boxes > 9), y los helpers label/tone por status.
 */

import { describe, it, expect } from "vitest";
import {
  validateSupplierInput,
  validatePrealertaInput,
  boxCode,
  prealertaStatusLabel,
  prealertaStatusTone,
  isPrealertaStatus,
  PREALERTA_STATUSES,
  PREALERTA_STATUS,
  type PrealertaStatus,
} from "../types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ validateSupplierInput                                      ║
// ╚═══════════════════════════════════════════════════════════╝

describe("validateSupplierInput", () => {
  it("acepta un proveedor válido y normaliza vacíos a null", () => {
    const { input, fieldErrors } = validateSupplierInput({
      name: "  Shenzhen Logistics  ",
      city: " Yiwu ",
      wechat: "",
      contact: "  ",
      notes: "Mayorista de textiles",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.name).toBe("Shenzhen Logistics");
    expect(input?.city).toBe("Yiwu");
    expect(input?.wechat).toBeNull();
    expect(input?.contact).toBeNull();
    expect(input?.notes).toBe("Mayorista de textiles");
  });

  it("rechaza name vacío", () => {
    const { input, fieldErrors } = validateSupplierInput({ name: "   " });
    expect(input).toBeUndefined();
    expect(fieldErrors?.name).toBeTruthy();
  });

  it("rechaza name ausente", () => {
    const { fieldErrors } = validateSupplierInput({});
    expect(fieldErrors?.name).toBeTruthy();
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ validatePrealertaInput                                     ║
// ╚═══════════════════════════════════════════════════════════╝

describe("validatePrealertaInput", () => {
  it("acepta una compra válida y normaliza campos", () => {
    const { input, fieldErrors } = validatePrealertaInput({
      supplierId: "  abc-123  ",
      description: "  3 cajas de zapatos  ",
      trackingCn: " SF123456789 ",
      boxes: 3,
      estValueUsd: 450.5,
      status: "en_camino",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.supplierId).toBe("abc-123");
    expect(input?.description).toBe("3 cajas de zapatos");
    expect(input?.trackingCn).toBe("SF123456789");
    expect(input?.boxes).toBe(3);
    expect(input?.estValueUsd).toBe(450.5);
    expect(input?.status).toBe("en_camino");
  });

  it("normaliza supplierId vacío a null (compra sin proveedor)", () => {
    const { input } = validatePrealertaInput({
      description: "muestra",
      boxes: 1,
      supplierId: "",
    });
    expect(input?.supplierId).toBeNull();
  });

  it("rechaza description vacía", () => {
    const { input, fieldErrors } = validatePrealertaInput({
      description: "   ",
      boxes: 2,
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.description).toBeTruthy();
  });

  it("rechaza boxes = 0", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 0,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza boxes negativo", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: -4,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza boxes no entero", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 2.5,
    });
    expect(fieldErrors?.boxes).toBeTruthy();
  });

  it("rechaza est_value negativo", () => {
    const { fieldErrors } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      estValueUsd: -10,
    });
    expect(fieldErrors?.estValueUsd).toBeTruthy();
  });

  it("acepta est_value ausente (null)", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
    });
    expect(input?.estValueUsd).toBeNull();
  });

  it("acepta est_value como string numérico", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      estValueUsd: "320.75" as unknown as number,
    });
    expect(input?.estValueUsd).toBe(320.75);
  });

  it("normaliza status inválido a 'anunciada'", () => {
    const { input } = validatePrealertaInput({
      description: "algo",
      boxes: 1,
      status: "qualquier" as unknown as PrealertaStatus,
    });
    expect(input?.status).toBe("anunciada");
  });

  it("default status = 'anunciada' cuando no viene", () => {
    const { input } = validatePrealertaInput({ description: "algo", boxes: 1 });
    expect(input?.status).toBe("anunciada");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ boxCode · shipping mark por caja                          ║
// ╚═══════════════════════════════════════════════════════════╝

describe("boxCode", () => {
  it("arma DTD-XXXX-N-M", () => {
    expect(boxCode("DTD-5532-3", 2)).toBe("DTD-5532-3-2");
  });

  it("soporta boxes > 9 (sin padding)", () => {
    expect(boxCode("DTD-5532-3", 12)).toBe("DTD-5532-3-12");
  });

  it("normaliza boxN < 1 a 1", () => {
    expect(boxCode("DTD-5532-3", 0)).toBe("DTD-5532-3-1");
    expect(boxCode("DTD-5532-3", -3)).toBe("DTD-5532-3-1");
  });

  it("trunca boxN fraccionario", () => {
    expect(boxCode("DTD-5532-3", 4.9)).toBe("DTD-5532-3-4");
  });

  it("maneja boxN no numérico cayendo a 1", () => {
    expect(boxCode("DTD-5532-3", Number("x"))).toBe("DTD-5532-3-1");
  });
});

// ╔═══════════════════════════════════════════════════════════╗
// ║ Helpers de label/tone por status                          ║
// ╚═══════════════════════════════════════════════════════════╝

describe("prealertaStatus helpers", () => {
  it("expone los 5 estados del enum", () => {
    expect(PREALERTA_STATUSES).toEqual([
      "anunciada",
      "en_camino",
      "recibida",
      "consolidada",
      "cancelada",
    ]);
  });

  it("label y tone para cada status del enum", () => {
    for (const status of PREALERTA_STATUSES) {
      expect(prealertaStatusLabel(status)).toBe(PREALERTA_STATUS[status].label);
      expect(prealertaStatusTone(status)).toBe(PREALERTA_STATUS[status].tone);
    }
  });

  it("label de un status desconocido devuelve el raw", () => {
    expect(prealertaStatusLabel("foo")).toBe("foo");
  });

  it("tone de un status desconocido cae a 'neutral'", () => {
    expect(prealertaStatusTone("foo")).toBe("neutral");
  });

  it("isPrealertaStatus discrimina", () => {
    expect(isPrealertaStatus("recibida")).toBe(true);
    expect(isPrealertaStatus("foo")).toBe(false);
    expect(isPrealertaStatus(123)).toBe(false);
    expect(isPrealertaStatus(null)).toBe(false);
  });
});
