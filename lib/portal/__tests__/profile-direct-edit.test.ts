import { describe, expect, it } from "vitest";
import {
  DIRECT_EDIT_MESSAGES,
  isDirectEditOutcome,
  validateDirectEdit,
} from "../profile-direct-edit";

describe("validateDirectEdit · SDD-0482", () => {
  it("normaliza documento y teléfono a su forma canónica", () => {
    expect(
      validateDirectEdit("persona", {
        name: "  Ana Pérez ",
        doc: "v12345678",
        phone: "0414-123.4567",
      }),
    ).toEqual({
      ok: true,
      values: { name: "Ana Pérez", doc: "V-12345678", phone: "584141234567" },
    });
  });

  it("un campo vacío significa no tocarlo", () => {
    expect(validateDirectEdit("persona", { name: "", doc: " ", phone: "" })).toEqual({
      ok: true,
      values: { name: null, doc: null, phone: null },
    });
  });

  it("valida el documento según el tipo de cliente", () => {
    expect(
      validateDirectEdit("persona", { name: "", doc: "J-12345678-9", phone: "" }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        doc: "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567.",
      },
    });
    expect(
      validateDirectEdit("empresa", { name: "", doc: "g200000001", phone: "" }),
    ).toEqual({
      ok: true,
      values: { name: null, doc: "G-20000000-1", phone: null },
    });
    expect(
      validateDirectEdit("empresa", { name: "", doc: "V-12345678", phone: "" }),
    ).toMatchObject({ ok: false, fieldErrors: { doc: expect.stringMatching(/RIF inválido/) } });
  });

  it("rechaza nombre corto y teléfono fuera de rango, juntos", () => {
    expect(validateDirectEdit("persona", { name: "A", doc: "", phone: "123" })).toEqual({
      ok: false,
      fieldErrors: {
        name: "Escribe tu nombre completo.",
        phone: "Teléfono inválido.",
      },
    });
  });

  it("deja un teléfono extranjero en dígitos", () => {
    expect(
      validateDirectEdit("persona", { name: "", doc: "", phone: "+86 138 0013 8000" }),
    ).toEqual({ ok: true, values: { name: null, doc: null, phone: "8613800138000" } });
  });

  it("reconoce sólo los resultados de la RPC", () => {
    expect(["applied", "no_changes", "blocked", "rate_limited"].every(isDirectEditOutcome)).toBe(true);
    expect(isDirectEditOutcome("ok")).toBe(false);
  });

  it("el mensaje de bloqueo no revela que el dato exista", () => {
    expect(DIRECT_EDIT_MESSAGES.blocked).not.toMatch(/existe|registrad|otro cliente|ya lo tiene/i);
  });
});
