/**
 * Tests de los helpers puros del módulo Documentos del envío (SDD-0042 Fase 3b).
 * Cubre labels, tamaño legible, parseo de tipo y whitelist de MIME/extensión.
 */
import { describe, it, expect } from "vitest";
import {
  shipmentDocTypeShort,
  shipmentDocTypeLabel,
  formatDocSize,
  parseDocType,
  isAllowedDocMime,
  extFromDocMime,
  isPdf,
  SHIPMENT_DOC_TYPE_OPTIONS,
} from "../shipment-document-types";

describe("shipmentDocTypeShort / Label", () => {
  it("códigos cortos para badges", () => {
    expect(shipmentDocTypeShort("bl")).toBe("BL");
    expect(shipmentDocTypeShort("pod")).toBe("POD");
    expect(shipmentDocTypeShort("otro")).toBe("DOC");
  });
  it("labels completos coinciden con las opciones del selector", () => {
    for (const o of SHIPMENT_DOC_TYPE_OPTIONS) {
      expect(shipmentDocTypeLabel(o.value)).toBe(o.label);
    }
  });
});

describe("parseDocType", () => {
  it("acepta tipos válidos", () => {
    expect(parseDocType("bl")).toBe("bl");
    expect(parseDocType("pod")).toBe("pod");
    expect(parseDocType("otro")).toBe("otro");
  });
  it("cae a 'otro' con valores inválidos/null", () => {
    expect(parseDocType("factura")).toBe("otro");
    expect(parseDocType(null)).toBe("otro");
    expect(parseDocType(undefined)).toBe("otro");
    expect(parseDocType(123)).toBe("otro");
  });
});

describe("formatDocSize", () => {
  it("vacío para null/0/negativo", () => {
    expect(formatDocSize(null)).toBe("");
    expect(formatDocSize(0)).toBe("");
    expect(formatDocSize(-5)).toBe("");
  });
  it("B / KB / MB", () => {
    expect(formatDocSize(512)).toBe("512 B");
    expect(formatDocSize(2048)).toBe("2 KB");
    expect(formatDocSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatDocSize(12 * 1024 * 1024)).toBe("12 MB");
  });
});

describe("MIME whitelist + extensión", () => {
  it("acepta PDF e imágenes", () => {
    expect(isAllowedDocMime("application/pdf")).toBe(true);
    expect(isAllowedDocMime("image/jpeg")).toBe(true);
    expect(isAllowedDocMime("image/png")).toBe(true);
    expect(isAllowedDocMime("image/webp")).toBe(true);
  });
  it("rechaza tipos peligrosos / no soportados", () => {
    expect(isAllowedDocMime("application/x-msdownload")).toBe(false);
    expect(isAllowedDocMime("text/html")).toBe(false);
    expect(isAllowedDocMime("image/gif")).toBe(false);
  });
  it("extensión por MIME", () => {
    expect(extFromDocMime("application/pdf")).toBe("pdf");
    expect(extFromDocMime("image/jpeg")).toBe("jpg");
    expect(extFromDocMime("image/png")).toBe("png");
    expect(extFromDocMime("application/octet-stream")).toBe("bin");
  });
  it("isPdf", () => {
    expect(isPdf("application/pdf")).toBe(true);
    expect(isPdf("image/png")).toBe(false);
    expect(isPdf(null)).toBe(false);
  });
});
