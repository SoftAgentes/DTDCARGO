import { describe, it, expect } from "vitest";
import {
  validateGroupBuyInput,
  validateParticipantInput,
  groupBuyStatusLabel,
  groupBuyStatusTone,
  participantStatusLabel,
  participantStatusTone,
  countsTowardCommitted,
  GROUP_BUY_STATUSES,
  PARTICIPANT_STATUSES,
} from "@/lib/studio/club/group-buy-types";

describe("validateGroupBuyInput", () => {
  it("acepta una ronda válida y deriva el slug del título", () => {
    const { input, fieldErrors } = validateGroupBuyInput({ title: "Consolidación Yiwu Julio" });
    expect(fieldErrors).toBeNull();
    expect(input?.slug).toBe("consolidacion-yiwu-julio");
    expect(input?.status).toBe("abierta");
  });

  it("rechaza sin título", () => {
    const { fieldErrors } = validateGroupBuyInput({ title: "  " });
    expect(fieldErrors?.title).toBeTruthy();
  });

  it("rechaza fecha de cierre no-ISO", () => {
    const { fieldErrors } = validateGroupBuyInput({ title: "X", closesAt: "31/07/2026" });
    expect(fieldErrors?.closesAt).toBeTruthy();
  });

  it("acepta fecha ISO y target_cbm válido; rechaza target negativo", () => {
    expect(validateGroupBuyInput({ title: "X", closesAt: "2026-07-31", targetCbm: 40 }).fieldErrors).toBeNull();
    expect(validateGroupBuyInput({ title: "X", targetCbm: -1 }).fieldErrors?.targetCbm).toBeTruthy();
  });

  it("rechaza estado fuera del enum", () => {
    // @ts-expect-error estado inválido a propósito
    const { fieldErrors } = validateGroupBuyInput({ title: "X", status: "pendiente" });
    expect(fieldErrors?.status).toBeTruthy();
  });
});

describe("validateParticipantInput", () => {
  it("exige miembro", () => {
    const { fieldErrors } = validateParticipantInput({ memberId: "" });
    expect(fieldErrors?.memberId).toBeTruthy();
  });

  it("acepta intención válida (cbm + valor ≥ 0)", () => {
    const { input, fieldErrors } = validateParticipantInput({
      memberId: "m1",
      estimatedCbm: 3.4,
      estimatedValueUsd: 1200,
      status: "confirmado",
    });
    expect(fieldErrors).toBeNull();
    expect(input?.estimatedCbm).toBe(3.4);
    expect(input?.status).toBe("confirmado");
  });

  it("rechaza cbm o valor negativos", () => {
    expect(validateParticipantInput({ memberId: "m1", estimatedCbm: -2 }).fieldErrors?.estimatedCbm).toBeTruthy();
    expect(
      validateParticipantInput({ memberId: "m1", estimatedValueUsd: -5 }).fieldErrors?.estimatedValueUsd,
    ).toBeTruthy();
  });
});

describe("labels, tonos y committed", () => {
  it("cubre todos los estados sin huecos", () => {
    for (const s of GROUP_BUY_STATUSES) {
      expect(groupBuyStatusLabel(s)).toBeTruthy();
      expect(groupBuyStatusTone(s)).toBeTruthy();
    }
    for (const s of PARTICIPANT_STATUSES) {
      expect(participantStatusLabel(s)).toBeTruthy();
      expect(participantStatusTone(s)).toBeTruthy();
    }
  });

  it("retirado NO cuenta para el volumen comprometido", () => {
    expect(countsTowardCommitted("interesado")).toBe(true);
    expect(countsTowardCommitted("confirmado")).toBe(true);
    expect(countsTowardCommitted("retirado")).toBe(false);
  });
});
