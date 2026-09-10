/**
 * Tests de los estados nuevos del flujo operario↔oficina (SDD-0157, Slice A).
 *
 * Cubre la acceptance: los status 'solicitada'/'rechazada' tienen label + tone
 * válidos y los helpers containerStatus{Label,Tone} los resuelven.
 */

import { describe, it, expect } from "vitest";
import {
  CONTAINER_STATUS,
  CONTAINER_STATUSES,
  containerStatusLabel,
  containerStatusTone,
  isContainerTypeCode,
} from "../types";

const VALID_TONES = new Set([
  "success",
  "warning",
  "danger",
  "info",
  "wine",
  "neutral",
]);

describe("estados nuevos SDD-0157", () => {
  it("'solicitada' y 'rechazada' están en el enum", () => {
    expect(CONTAINER_STATUSES).toContain("solicitada");
    expect(CONTAINER_STATUSES).toContain("rechazada");
  });

  it("'solicitada' → Solicitada / info", () => {
    expect(CONTAINER_STATUS.solicitada.label).toBe("Solicitada");
    expect(CONTAINER_STATUS.solicitada.tone).toBe("info");
    expect(containerStatusLabel("solicitada")).toBe("Solicitada");
    expect(containerStatusTone("solicitada")).toBe("info");
  });

  it("'rechazada' → Rechazada / neutral", () => {
    expect(CONTAINER_STATUS.rechazada.label).toBe("Rechazada");
    expect(CONTAINER_STATUS.rechazada.tone).toBe("neutral");
    expect(containerStatusLabel("rechazada")).toBe("Rechazada");
    expect(containerStatusTone("rechazada")).toBe("neutral");
  });

  it("todos los tones de CONTAINER_STATUS son del set del sistema", () => {
    for (const s of CONTAINER_STATUSES) {
      expect(VALID_TONES.has(CONTAINER_STATUS[s].tone)).toBe(true);
    }
  });

  it("las etiquetas previas se conservan y consolidar es información operativa", () => {
    expect(containerStatusLabel("consolidando")).toBe("Consolidando");
    expect(containerStatusTone("consolidando")).toBe("info");
    expect(containerStatusLabel("cerrado")).toBe("Cerrado");
  });

  it("isContainerTypeCode gatea el tipo del contenedor solicitado", () => {
    expect(isContainerTypeCode("20GP")).toBe(true);
    expect(isContainerTypeCode("40GP")).toBe(true);
    expect(isContainerTypeCode("40HC")).toBe(true);
    expect(isContainerTypeCode("45HC")).toBe(false);
    expect(isContainerTypeCode("")).toBe(false);
  });
});
