// @vitest-environment node
/**
 * SDD-0061 Fase B1 — Tests de la lógica pura del estimado web.
 *
 * Cubre el acceptance §6 Fase B aplicable a B1:
 *  - mapeo payload→row de quotes (LCL y marítimo/aéreo), llenando los NOT NULL.
 *  - validación del input (campos faltantes, monto inválido, calc inválida).
 *  - armado del mensaje de WhatsApp con nota + EST-XXXX.
 *
 * La capa pura es boundary-safe (no toca Supabase); el insert real lo cubre el
 * E2E del founder. Acá testeamos las funciones que deciden el contenido del row
 * y del mensaje.
 */
import { describe, it, expect } from "vitest";
import {
  validateEstimadoInput,
  buildEstimadoRow,
  buildEstimadoWhatsAppMessage,
  serviceForCalc,
  type EstimadoWebPayload,
} from "../estimado-web";

const VALID_LCL: Partial<EstimadoWebPayload> = {
  calc: "lcl",
  prospectName: "  Carlos Pérez ",
  prospectWhatsapp: "+58 412 1668021",
  prospectEmail: "carlos@correo.com",
  nota: " Tengo la mercancía lista ",
  origin: "China",
  destination: "Valencia, VE",
  cbm: 12.5,
  weightKg: 4800,
  packaging: "madera",
  totalUsd: 10250,
};

const VALID_AEREO: Partial<EstimadoWebPayload> = {
  calc: "aereo",
  prospectName: "Ana",
  prospectWhatsapp: "04141234567",
  origin: "Guangzhou, CN",
  destination: "Caracas, VE",
  weightKg: 120,
  cbm: 0.3,
  totalUsd: 1830,
};

describe("validateEstimadoInput", () => {
  it("acepta un payload LCL completo y normaliza (trim) nombre/nota", () => {
    const { input, fieldErrors } = validateEstimadoInput(VALID_LCL);
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
    expect(input!.prospectName).toBe("Carlos Pérez");
    expect(input!.nota).toBe("Tengo la mercancía lista");
    expect(input!.prospectEmail).toBe("carlos@correo.com");
    expect(input!.totalUsd).toBe(10250);
    // Sin subtotal explícito → cae al total.
    expect(input!.subtotalUsd).toBe(10250);
  });

  it("rechaza si falta el nombre", () => {
    const { input, fieldErrors } = validateEstimadoInput({
      ...VALID_LCL,
      prospectName: "   ",
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.prospectName).toBeTruthy();
  });

  it("rechaza si falta el teléfono", () => {
    const { fieldErrors } = validateEstimadoInput({
      ...VALID_LCL,
      prospectWhatsapp: undefined,
    });
    expect(fieldErrors?.prospectWhatsapp).toBeTruthy();
  });

  it("rechaza un total <= 0 o no numérico", () => {
    expect(validateEstimadoInput({ ...VALID_LCL, totalUsd: 0 }).fieldErrors?.totalUsd).toBeTruthy();
    expect(
      validateEstimadoInput({ ...VALID_LCL, totalUsd: "abc" as unknown as number }).fieldErrors
        ?.totalUsd,
    ).toBeTruthy();
  });

  it("rechaza una calculadora desconocida", () => {
    const { fieldErrors } = validateEstimadoInput({
      ...VALID_LCL,
      calc: "ferroviario" as unknown as EstimadoWebPayload["calc"],
    });
    expect(fieldErrors?.calc).toBeTruthy();
  });

  it("aplica defaults sensatos cuando origen/destino/packaging faltan", () => {
    const { input } = validateEstimadoInput({
      calc: "maritimo",
      prospectName: "X",
      prospectWhatsapp: "1",
      totalUsd: 100,
    });
    expect(input!.origin).toBe("China");
    expect(input!.destination).toBe("Venezuela");
    expect(input!.packaging).toBe("carton");
    expect(input!.prospectEmail).toBeNull();
    expect(input!.nota).toBeNull();
  });

  it("parsea números que llegan como string con coma decimal", () => {
    const { input } = validateEstimadoInput({
      ...VALID_LCL,
      cbm: "12,5" as unknown as number,
      totalUsd: "10250" as unknown as number,
    });
    expect(input!.cbm).toBe(12.5);
    expect(input!.totalUsd).toBe(10250);
  });
});

describe("buildEstimadoRow", () => {
  it("mapea un estimado LCL llenando TODOS los NOT NULL de quotes", () => {
    const { input } = validateEstimadoInput(VALID_LCL);
    const row = buildEstimadoRow(input!);
    expect(row.client_markbox).toBeNull();
    // client_name (NOT NULL) = snapshot del nombre del prospecto.
    expect(row.client_name).toBe("Carlos Pérez");
    expect(row.prospect_name).toBe("Carlos Pérez");
    expect(row.prospect_whatsapp).toBe("+58 412 1668021");
    expect(row.prospect_email).toBe("carlos@correo.com");
    expect(row.nota).toBe("Tengo la mercancía lista");
    expect(row.source).toBe("web");
    expect(row.status).toBe("draft");
    expect(row.service).toBe("puerta_a_puerta_DDP");
    expect(row.origin).toBe("China");
    expect(row.destination).toBe("Valencia, VE");
    expect(row.cbm).toBe(12.5);
    expect(row.weight_kg).toBe(4800);
    expect(row.packaging).toBe("madera");
    // subtotal_usd / total_usd (NOT NULL) = el estimado.
    expect(row.subtotal_usd).toBe(10250);
    expect(row.total_usd).toBe(10250);
    expect(row.packaging_cost).toBe(0);
  });

  it("mapea un estimado aéreo (sin email, defaults de packaging)", () => {
    const { input } = validateEstimadoInput(VALID_AEREO);
    const row = buildEstimadoRow(input!);
    expect(row.prospect_email).toBeNull();
    expect(row.nota).toBeNull();
    expect(row.service).toBe("puerta_a_puerta_DDP");
    expect(row.weight_kg).toBe(120);
    expect(row.total_usd).toBe(1830);
    expect(row.source).toBe("web");
  });

  it("serviceForCalc mapea las 3 calculadoras al producto DDP de la web", () => {
    expect(serviceForCalc("lcl")).toBe("puerta_a_puerta_DDP");
    expect(serviceForCalc("aereo")).toBe("puerta_a_puerta_DDP");
    expect(serviceForCalc("maritimo")).toBe("puerta_a_puerta_DDP");
  });
});

describe("buildEstimadoWhatsAppMessage", () => {
  it("agrega la nota y el código EST al mensaje base", () => {
    const msg = buildEstimadoWhatsAppMessage({
      baseMessage: "Hola, acabo de estimar mi envío:\n• Total: US$100",
      nota: "Tengo la mercancía lista",
      estimateCode: "EST-2026-0007",
    });
    expect(msg).toContain("Hola, acabo de estimar mi envío:");
    expect(msg).toContain("• Total: US$100");
    expect(msg).toContain("Nota: Tengo la mercancía lista");
    expect(msg).toContain("Mi código de estimado: EST-2026-0007");
    // La nota va antes del código.
    expect(msg.indexOf("Nota:")).toBeLessThan(msg.indexOf("Mi código de estimado:"));
  });

  it("omite la nota cuando está vacía y el código cuando es null", () => {
    const msg = buildEstimadoWhatsAppMessage({
      baseMessage: "Hola",
      nota: "   ",
      estimateCode: null,
    });
    expect(msg).toBe("Hola");
    expect(msg).not.toContain("Nota:");
    expect(msg).not.toContain("código");
  });

  it("incluye solo el código cuando hay EST sin nota", () => {
    const msg = buildEstimadoWhatsAppMessage({
      baseMessage: "Hola",
      estimateCode: "EST-2026-0001",
    });
    expect(msg).toContain("Mi código de estimado: EST-2026-0001");
    expect(msg).not.toContain("Nota:");
  });
});
