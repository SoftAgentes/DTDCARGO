/**
 * Tests de los helpers de verificación de identidad en `client-types` (SDD-0046 · B2).
 *
 * Cubre el mapeo ADVISORY del badge (acceptance §6 Slice B / Slice B2):
 *   sin verificar → neutral · corresponde → success · no corresponde → danger ·
 *   no disponible → warning. Y el label de la fuente para "Verificado por …".
 *
 * El badge es informativo — nunca bloquea al cliente; estos helpers solo deciden
 * el tono/label visible, así que un cambio accidental de mapeo lo caza este test.
 */

import { describe, it, expect } from "vitest";
import {
  clientCompleteness,
  docVerifyBadge,
  docVerifySourceLabel,
  validateClientInput,
  type ClientInput,
  type CompletenessSource,
} from "../client-types";

/** Base válida de ClientInput persona para variar campo por campo en los tests. */
function personaInput(overrides: Partial<ClientInput> = {}): Partial<ClientInput> {
  return {
    doc_kind: "persona",
    name: "Juan Pérez",
    tier: "regular",
    rif: "V-12345678",
    ...overrides,
  };
}

describe("docVerifyBadge (advisory)", () => {
  it("sin verificar (null) → neutral / 'Sin verificar'", () => {
    expect(docVerifyBadge(null)).toEqual({
      tone: "neutral",
      label: "Sin verificar",
    });
  });

  it("ok → success / 'Corresponde'", () => {
    expect(docVerifyBadge("ok")).toEqual({
      tone: "success",
      label: "Corresponde",
    });
  });

  it("mismatch → danger / 'No corresponde'", () => {
    expect(docVerifyBadge("mismatch")).toEqual({
      tone: "danger",
      label: "No corresponde",
    });
  });

  it("unavailable → warning / 'No disponible'", () => {
    expect(docVerifyBadge("unavailable")).toEqual({
      tone: "warning",
      label: "No disponible",
    });
  });
});

describe("docVerifySourceLabel", () => {
  it("mapea cada fuente a su label legible", () => {
    expect(docVerifySourceLabel("cne")).toBe("CNE");
    expect(docVerifySourceLabel("seniat")).toBe("SENIAT");
    expect(docVerifySourceLabel("manual")).toBe("marca manual");
  });

  it("null → guion", () => {
    expect(docVerifySourceLabel(null)).toBe("—");
  });
});

describe("validateClientInput · documento por tipo (SDD-0122)", () => {
  it("persona: cédula válida se normaliza a V-XXXXXXXX", () => {
    const { input, fieldErrors } = validateClientInput(
      personaInput({ rif: "v12345678" }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input?.doc_kind).toBe("persona");
    expect(input?.rif).toBe("V-12345678");
    // Persona nunca guarda contacto operativo.
    expect(input?.contact_name).toBeNull();
  });

  it("persona: un RIF de empresa (J-…) es cédula inválida", () => {
    const { input, fieldErrors } = validateClientInput(
      personaInput({ rif: "J-12345678-9" }),
    );
    expect(input).toBeUndefined();
    expect(fieldErrors?.rif).toMatch(/cédula inválida/i);
  });

  it("empresa: RIF válido se normaliza y guarda el contacto", () => {
    const { input, fieldErrors } = validateClientInput({
      doc_kind: "empresa",
      name: "Inversiones Demo, C.A.",
      contact_name: "  María López  ",
      tier: "vip",
      rif: "j123456789",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.doc_kind).toBe("empresa");
    expect(input?.rif).toBe("J-12345678-9");
    expect(input?.contact_name).toBe("María López");
  });

  it("empresa: una cédula (V-…) es RIF inválido", () => {
    const { fieldErrors } = validateClientInput({
      doc_kind: "empresa",
      name: "Demo C.A.",
      tier: "regular",
      rif: "V-12345678",
    });
    expect(fieldErrors?.rif).toMatch(/rif inválido/i);
  });

  it("empresa sin nombre pide la razón social", () => {
    const { fieldErrors } = validateClientInput({
      doc_kind: "empresa",
      name: "",
      tier: "regular",
    });
    expect(fieldErrors?.name).toMatch(/razón social/i);
  });

  it("documento vacío es válido (opcional)", () => {
    const { input, fieldErrors } = validateClientInput(
      personaInput({ rif: "" }),
    );
    expect(fieldErrors).toBeUndefined();
    expect(input?.rif).toBeNull();
  });
});

describe("clientCompleteness (SDD-0122)", () => {
  const empty: CompletenessSource = {
    doc_kind: "persona",
    rif: null,
    contact_name: null,
    email: null,
    phone: null,
    address: null,
    cedula_photo_path: null,
    doc_verify_status: null,
  };

  it("persona: 7 ítems (sin contacto)", () => {
    const r = clientCompleteness(empty);
    expect(r.total).toBe(7);
    expect(r.items.some((i) => i.key === "contact_name")).toBe(false);
  });

  it("empresa: suma el ítem de contacto (8 ítems)", () => {
    const r = clientCompleteness({ ...empty, doc_kind: "empresa" });
    expect(r.total).toBe(8);
    expect(r.items.some((i) => i.key === "contact_name")).toBe(true);
  });

  it("todo vacío: solo el tipo cuenta como hecho", () => {
    const r = clientCompleteness(empty);
    expect(r.doneCount).toBe(1); // doc_kind presente
    expect(r.isComplete).toBe(false);
    expect(r.missingLabels).toContain("Cédula");
    expect(r.missingLabels).toContain("Identidad verificada");
  });

  it("perfil completo (persona): isComplete + 100%", () => {
    const r = clientCompleteness({
      doc_kind: "persona",
      rif: "V-12345678",
      contact_name: null,
      email: "a@b.com",
      phone: "+58 412 1234567",
      address: "Av. Bolívar, Valencia",
      cedula_photo_path: "tenant/client/1/ci.jpg",
      doc_verify_status: "ok",
    });
    expect(r.isComplete).toBe(true);
    expect(r.pct).toBe(100);
    expect(r.missingLabels).toHaveLength(0);
  });

  it("verificación 'mismatch' NO cuenta como hecha", () => {
    const r = clientCompleteness({ ...empty, doc_verify_status: "mismatch" });
    expect(r.items.find((i) => i.key === "identity")?.done).toBe(false);
  });
});
