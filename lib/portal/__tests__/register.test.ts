/**
 * Tests del registro self-service del Portal (SDD-0042 Fase 6 · slice 10.1) tras el
 * REGISTRO EXPRESS (founder 2026-06-07).
 *
 * El alta express valida SOLO lo mínimo (tipo/nombre/documento/email/WhatsApp); la
 * dirección VE se difiere a "Completá tu perfil" (`validateAddressInput`). Cubre:
 *  - validación + normalización del documento (cédula persona / RIF empresa),
 *    que ES la contraseña inicial → password = cédula/RIF canónico.
 *  - el alta express NO exige dirección (la difiere).
 *  - validateAddressInput: la dirección SÍ es obligatoria al completar el perfil.
 *  - composeAddress: arma la dirección de una línea que se guarda en clients.
 *
 * Las server actions (`registerClientAction` / `completeProfileAction`) orquestan
 * admin client + Storage + RPC; acá testeamos las funciones PURAS que deciden el
 * alta y el perfil, igual que el resto de la suite del portal aísla la capa pura.
 */
import { describe, it, expect } from "vitest";
import {
  validateRegisterInput,
  validateAddressInput,
  normalizeDocument,
  formatCedula,
  composeAddress,
  type RegisterInput,
  type AddressInput,
} from "../register-types";

const VALID_PERSONA: Partial<RegisterInput> = {
  kind: "persona",
  name: "Carlos Pérez",
  document: "V-12345678",
  email: "Carlos@Empresa.com",
  whatsapp: "+58 412 1668021",
};

describe("validateRegisterInput — alta express (persona)", () => {
  it("normaliza email a minúsculas y devuelve input canónico", () => {
    const { input, fieldErrors } = validateRegisterInput(VALID_PERSONA);
    expect(fieldErrors).toBeUndefined();
    expect(input?.email).toBe("carlos@empresa.com");
    expect(input?.document).toBe("V-12345678");
    expect(input?.company).toBeNull();
  });

  it("NO exige dirección (se difiere al perfil)", () => {
    // El express no pide estado/ciudad/etc: con los 5 campos mínimos pasa.
    const { input, fieldErrors } = validateRegisterInput(VALID_PERSONA);
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
  });

  it("la contraseña inicial = el documento canónico (cédula)", () => {
    const { input } = validateRegisterInput({ ...VALID_PERSONA, document: "v12345678" });
    // El cliente tipeó sin prefijo formateado; el documento (=password) se canoniza.
    expect(input?.document).toBe("V-12345678");
  });

  it("falla si falta la cédula", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_PERSONA, document: "" });
    expect(fieldErrors?.document).toBeDefined();
  });

  it("falla con cédula de formato inválido", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_PERSONA, document: "12345" });
    expect(fieldErrors?.document).toMatch(/inválida/i);
  });

  it("falla si falta WhatsApp", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_PERSONA, whatsapp: "" });
    expect(fieldErrors?.whatsapp).toBeDefined();
  });

  it("falla con email inválido", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_PERSONA, email: "no-es-email" });
    expect(fieldErrors?.email).toBeDefined();
  });
});

describe("validateRegisterInput — alta express (empresa)", () => {
  const VALID_EMPRESA: Partial<RegisterInput> = {
    ...VALID_PERSONA,
    kind: "empresa",
    company: "Importadora Pérez C.A.",
    document: "J-12345678-9",
  };

  it("requiere razón social", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_EMPRESA, company: "" });
    expect(fieldErrors?.company).toBeDefined();
  });

  it("normaliza el RIF (=password) a canónico", () => {
    const { input } = validateRegisterInput({ ...VALID_EMPRESA, document: "j123456789" });
    expect(input?.document).toBe("J-12345678-9");
    expect(input?.company).toBe("Importadora Pérez C.A.");
  });
});

describe("normalizeDocument — el documento es la contraseña", () => {
  it("persona: cédula con/sin guión → canónico V-XXXXXXXX", () => {
    expect(normalizeDocument("persona", "V12345678")).toBe("V-12345678");
    expect(normalizeDocument("persona", "v-12345678")).toBe("V-12345678");
  });

  it("persona: acepta extranjero E", () => {
    expect(normalizeDocument("persona", "E-87654321")).toBe("E-87654321");
  });

  it("persona: un RIF no es cédula válida → null", () => {
    expect(normalizeDocument("persona", "J-12345678-9")).toBeNull();
  });

  it("empresa: RIF con/sin guiones → canónico J-XXXXXXXX-X", () => {
    expect(normalizeDocument("empresa", "J123456789")).toBe("J-12345678-9");
  });

  it("empresa: documento basura → null", () => {
    expect(normalizeDocument("empresa", "hola")).toBeNull();
  });

  it("formatCedula recorta espacios y sube prefijo", () => {
    expect(formatCedula(" v 12345678 ")).toBe("V-12345678");
  });
});

describe("dedup — comparación case-insensitive del documento canónico", () => {
  it("el documento canónico en minúsculas es lo que se compara contra clients.rif", () => {
    // La server action hace: ilike("rif", input.document.toLowerCase()).
    // Verificamos que dos altas del MISMO documento (variando el tipeo) colapsan al
    // MISMO valor canónico → el dedup las trata como el mismo cliente.
    const a = normalizeDocument("persona", "V-12345678")!.toLowerCase();
    const b = normalizeDocument("persona", "v12345678")!.toLowerCase();
    expect(a).toBe(b);
    expect(a).toBe("v-12345678");
  });
});

const VALID_ADDRESS: Partial<AddressInput> = {
  state: "Carabobo",
  municipio: "Valencia",
  city: "Valencia",
  postalCode: "2001",
  barrio: "El Viñedo",
  address: "Av. Bolívar, edif. Tía Mary, piso 3",
};

describe("validateAddressInput — dirección del perfil (obligatoria al completar)", () => {
  it("devuelve input con la dirección completa", () => {
    const { input, fieldErrors } = validateAddressInput(VALID_ADDRESS);
    expect(fieldErrors).toBeUndefined();
    expect(input?.city).toBe("Valencia");
    expect(input?.reference).toBeNull();
  });

  it("falla si falta algún campo de dirección VE", () => {
    const { fieldErrors } = validateAddressInput({ ...VALID_ADDRESS, city: "" });
    expect(fieldErrors?.city).toBeDefined();
  });

  it("falla si falta la dirección detallada", () => {
    const { fieldErrors } = validateAddressInput({ ...VALID_ADDRESS, address: "" });
    expect(fieldErrors?.address).toBeDefined();
  });
});

describe("composeAddress — dirección de una línea para clients.address", () => {
  it("concatena calle · barrio · ciudad,estado · CP", () => {
    const { input } = validateAddressInput(VALID_ADDRESS);
    const addr = composeAddress(input!);
    expect(addr).toContain("Av. Bolívar, edif. Tía Mary, piso 3");
    expect(addr).toContain("El Viñedo");
    expect(addr).toContain("Valencia, Carabobo");
    expect(addr).toContain("CP 2001");
  });

  it("incluye la referencia si se cargó", () => {
    const { input } = validateAddressInput({
      ...VALID_ADDRESS,
      reference: "Frente a la panadería",
    });
    expect(composeAddress(input!)).toContain("Ref: Frente a la panadería");
  });
});
