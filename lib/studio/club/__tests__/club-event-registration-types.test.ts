// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  validateEventRegistrationInput,
  eventRegistrationStatusLabel,
  eventRegistrationStatusTone,
  EVENT_REGISTRATION_STATUSES,
} from "@/lib/studio/club/club-event-registration-types";

describe("validateEventRegistrationInput (C.2 · inscribir miembro)", () => {
  it("acepta una inscripción válida con default 'inscrito'", () => {
    const { input, fieldErrors } = validateEventRegistrationInput({ memberId: "m-1" });
    expect(fieldErrors).toBeNull();
    expect(input?.memberId).toBe("m-1");
    expect(input?.status).toBe("inscrito");
    expect(input?.note).toBeNull();
  });

  it("rechaza sin miembro (falta el inscrito)", () => {
    const { input, fieldErrors } = validateEventRegistrationInput({ memberId: "  " });
    expect(input).toBeNull();
    expect(fieldErrors?.memberId).toBeTruthy();
  });

  it("rechaza un estado fuera del enum", () => {
    const { fieldErrors } = validateEventRegistrationInput({
      memberId: "m-1",
      // @ts-expect-error probamos entrada inválida a propósito
      status: "presente",
    });
    expect(fieldErrors?.status).toBeTruthy();
  });

  it("marca asistencia (asistio / no_asistio) como estados válidos", () => {
    for (const s of ["asistio", "no_asistio"] as const) {
      const { input, fieldErrors } = validateEventRegistrationInput({ memberId: "m-1", status: s });
      expect(fieldErrors).toBeNull();
      expect(input?.status).toBe(s);
    }
  });

  it("normaliza la nota vacía a null y recorta espacios", () => {
    const { input } = validateEventRegistrationInput({ memberId: "m-1", note: "  hola  " });
    expect(input?.note).toBe("hola");
    const { input: empty } = validateEventRegistrationInput({ memberId: "m-1", note: "   " });
    expect(empty?.note).toBeNull();
  });
});

describe("labels / tonos de inscripción", () => {
  it("cubre los 3 estados con label y tono", () => {
    expect(EVENT_REGISTRATION_STATUSES).toHaveLength(3);
    for (const s of EVENT_REGISTRATION_STATUSES) {
      expect(eventRegistrationStatusLabel(s)).toBeTruthy();
      expect(["info", "success", "danger"]).toContain(eventRegistrationStatusTone(s));
    }
  });
});
