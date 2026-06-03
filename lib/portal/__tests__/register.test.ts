/**
 * Tests del registro self-service del Portal (SDD-0042 Fase 6 · slice 10.1).
 *
 * Cubre los criterios de aceptación de la spec §10.1:
 *  - validación + normalización del documento (cédula persona / RIF empresa),
 *    que ES la contraseña inicial → password = cédula/RIF canónico.
 *  - dedup: el documento canónico se compara en minúsculas (la server action
 *    bloquea si ya existe en clients del tenant).
 *  - composeAddress: arma la dirección de una línea que se guarda en clients.
 *
 * La server action `registerClientAction` orquesta admin client + Storage + RPC;
 * acá testeamos las funciones PURAS que deciden el alta (validación, normalización
 * del documento = contraseña, dirección), igual que el resto de la suite del portal
 * stubea/aísla la capa pura. El insert/createUser real lo cubre el E2E del founder.
 */
import { describe, it, expect } from "vitest";
import {
  validateRegisterInput,
  normalizeDocument,
  formatCedula,
  composeAddress,
  type RegisterInput,
} from "../register-types";

const VALID_PERSONA: Partial<RegisterInput> = {
  kind: "persona",
  name: "Carlos Pérez",
  document: "V-12345678",
  email: "Carlos@Empresa.com",
  whatsapp: "+58 412 1668021",
  state: "Carabobo",
  municipio: "Valencia",
  city: "Valencia",
  postalCode: "2001",
  barrio: "El Viñedo",
  address: "Av. Bolívar, edif. Tía Mary, piso 3",
};

describe("validateRegisterInput — persona", () => {
  it("normaliza email a minúsculas y devuelve input canónico", () => {
    const { input, fieldErrors } = validateRegisterInput(VALID_PERSONA);
    expect(fieldErrors).toBeUndefined();
    expect(input?.email).toBe("carlos@empresa.com");
    expect(input?.document).toBe("V-12345678");
    expect(input?.company).toBeNull();
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

  it("falla si falta algún campo de dirección VE", () => {
    const { fieldErrors } = validateRegisterInput({ ...VALID_PERSONA, city: "" });
    expect(fieldErrors?.city).toBeDefined();
  });
});

describe("validateRegisterInput — empresa", () => {
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

describe("composeAddress — dirección de una línea para clients.address", () => {
  it("concatena calle · barrio · ciudad,estado · CP", () => {
    const { input } = validateRegisterInput(VALID_PERSONA);
    const addr = composeAddress(input!);
    expect(addr).toContain("Av. Bolívar, edif. Tía Mary, piso 3");
    expect(addr).toContain("El Viñedo");
    expect(addr).toContain("Valencia, Carabobo");
    expect(addr).toContain("CP 2001");
  });

  it("incluye la referencia si se cargó", () => {
    const { input } = validateRegisterInput({
      ...VALID_PERSONA,
      reference: "Frente a la panadería",
    });
    expect(composeAddress(input!)).toContain("Ref: Frente a la panadería");
  });
});
