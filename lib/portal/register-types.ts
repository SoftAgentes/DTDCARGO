/**
 * Tipos + validación del registro self-service del Portal (SDD-0042 Fase 6).
 *
 * Validación MANUAL (patrón del proyecto — sin Zod): `validateRegisterInput()`
 * devuelve `{ input, fieldErrors }` igual que `validateClientInput`. El documento
 * (cédula persona / RIF empresa) se normaliza a su forma canónica para el dedup y
 * la identidad básica. NO es la contraseña: la cuenta nace con clave aleatoria.
 *
 * REGISTRO EXPRESS (founder 2026-06-07): el alta pide SOLO lo mínimo para emitir el
 * MARKBOX y poder contactar al cliente — tipo · nombre · documento · email ·
 * WhatsApp. La FOTO de cédula y la DIRECCIÓN de entrega quedan DIFERIDAS a
 * "Completa tu perfil" dentro del portal (se requieren antes de la 1ª compra; el
 * asesor revisa la foto antes de operar). Por eso este archivo separa:
 *   - `RegisterInput` / `validateRegisterInput`  → el alta express.
 *   - `AddressInput`  / `validateAddressInput`    → la dirección VE (perfil).
 * La identidad básica + el dedup se conservan: el número de documento es
 * obligatorio al alta (clave del dedup e identidad básica).
 *
 * Reusa `RIF_REGEX` / `formatRif` de `lib/studio/client-types` para el RIF (el
 * portal está fuera de la frontera ESLint público↔ERP). La cédula tiene su propio
 * formato VE (V/E-dígitos).
 */
import { RIF_REGEX, formatRif } from "@/lib/studio/client-types";

export type ClientKind = "persona" | "empresa";

/**
 * Datos validados del alta self-service EXPRESS (lo que la server action persiste
 * al registrar). La dirección NO está acá — se difiere al perfil (`AddressInput`).
 */
export type RegisterInput = {
  kind: ClientKind;
  /** Nombre de la persona / nombre de contacto (empresa). */
  name: string;
  /** Razón social (solo empresa). Null para persona. */
  company: string | null;
  /**
   * Documento de identidad CANÓNICO: cédula "V-12345678" (persona) o RIF
   * "J-12345678-9" (empresa). Se usa para dedup + identidad, NO como contraseña.
   */
  document: string;
  email: string;
  /** WhatsApp (obligatorio) — es el canal por el que se contacta al cliente. */
  whatsapp: string;
  /** Teléfono de oficina/fijo (opcional, no WhatsApp). */
  officePhone: string | null;
  /**
   * Opt-in EXPLÍCITO a marketing por email (SDD-0082 · checkbox default OFF). NO
   * afecta el email transaccional (welcome/factura). true sólo si el visitante lo
   * marca → la action setea clients.email_marketing_optin_at + source.
   */
  emailOptin: boolean;
};

/**
 * Dirección de entrega en Venezuela (cascada del catálogo). DIFERIDA del alta: se
 * completa en "Completa tu perfil". Obligatoria recién al completar el perfil
 * (antes de la 1ª compra), no al registrarse.
 */
export type AddressInput = {
  state: string;
  municipio: string;
  city: string;
  postalCode: string;
  barrio: string;
  address: string;
  reference: string | null;
};

/**
 * Cédula venezolana (prefijo V venezolano / E extranjero + 6 a 9 dígitos) o
 * pasaporte (prefijo P + 5 a 12 alfanuméricos). Acepta con o sin guión
 * ("V-12345678" o "V12345678"). Case-insensitive.
 */
export const CEDULA_REGEX = /^(?:[VEve]-?\d{6,9}|[Pp]-?[A-Za-z0-9]{5,12})$/;

/**
 * Normaliza una cédula/pasaporte a canónico "V-12345678" / "P-A1234567"
 * (prefijo mayúscula + guión). Asume que ya pasó CEDULA_REGEX.
 */
export function formatCedula(raw: string): string {
  const clean = raw.replace(/[-\s]/g, "").toUpperCase();
  return `${clean[0]}-${clean.slice(1)}`;
}

/**
 * Normaliza el documento a su forma canónica (dedup + identidad).
 * Persona → `formatCedula`, empresa → `formatRif`. Devuelve null si no matchea
 * el formato esperado para el tipo.
 */
export function normalizeDocument(kind: ClientKind, raw: string): string | null {
  const trimmed = raw.trim();
  if (kind === "empresa") {
    return RIF_REGEX.test(trimmed) ? formatRif(trimmed) : null;
  }
  return CEDULA_REGEX.test(trimmed) ? formatCedula(trimmed) : null;
}

export type RegisterFieldKey =
  | "name"
  | "company"
  | "document"
  | "email"
  | "whatsapp"
  | "officePhone";

/** Campos de la dirección VE (perfil). */
export type AddressFieldKey =
  | "state"
  | "municipio"
  | "city"
  | "postalCode"
  | "barrio"
  | "address";

export type RegisterActionState = {
  ok?: boolean;
  /** Error general (no de campo). */
  error?: string;
  fieldErrors?: Partial<Record<RegisterFieldKey, string>>;
  /** En éxito, el server devuelve el markbox generado para la pantalla "Listo". */
  markbox?: string;
  /** Warning soft (ej: welcome email no se pudo encolar) — no rompe el alta. */
  warning?: string;
};

/** Estado de la server action "Completa tu perfil" (foto + dirección · perfil). */
export type ProfileActionState = {
  ok?: boolean;
  /** Error general (no de campo). */
  error?: string;
  fieldErrors?: Partial<Record<AddressFieldKey | "photo", string>>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validación manual del alta self-service EXPRESS. Devuelve `input` canónico o
 * `fieldErrors`. Pide SOLO tipo/nombre/documento/email/WhatsApp (la dirección y la
 * foto se difieren al perfil). NO chequea dedup (eso es una query, va en la server
 * action).
 */
export function validateRegisterInput(partial: Partial<RegisterInput>): {
  input?: RegisterInput;
  fieldErrors?: RegisterActionState["fieldErrors"];
} {
  const errors: RegisterActionState["fieldErrors"] = {};

  const kind: ClientKind = partial.kind === "empresa" ? "empresa" : "persona";
  const isCompany = kind === "empresa";

  const name = partial.name?.trim() ?? "";
  if (!name) errors.name = "Indica el nombre.";
  else if (name.length > 200) errors.name = "El nombre es demasiado largo (máx 200).";

  let company: string | null = null;
  if (isCompany) {
    company = partial.company?.trim() || null;
    if (!company) errors.company = "Indica la razón social.";
  }

  const documentRaw = partial.document?.trim() ?? "";
  const document = documentRaw ? normalizeDocument(kind, documentRaw) : null;
  if (!documentRaw) {
    errors.document = isCompany ? "Indica el RIF." : "Indica la cédula.";
  } else if (!document) {
    errors.document = isCompany
      ? "RIF inválido. Formato: J-12345678-9."
      : "Cédula o pasaporte inválido. Formato: V-12345678 o P-A1234567.";
  }

  const email = partial.email?.trim().toLowerCase() || "";
  if (!email) errors.email = "Indica el email.";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Email inválido.";

  const whatsapp = partial.whatsapp?.trim() || "";
  if (!whatsapp) errors.whatsapp = "Indica tu WhatsApp.";

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      kind,
      name,
      company,
      document: document!,
      email,
      whatsapp,
      officePhone: partial.officePhone?.trim() || null,
      emailOptin: partial.emailOptin === true,
    },
  };
}

/**
 * Validación manual de la dirección VE (perfil · "Completa tu perfil"). Devuelve
 * `input` o `fieldErrors`. Acá la dirección SÍ es obligatoria (completar el perfil
 * = cargar la dirección de entrega completa).
 */
export function validateAddressInput(partial: Partial<AddressInput>): {
  input?: AddressInput;
  fieldErrors?: ProfileActionState["fieldErrors"];
} {
  const errors: ProfileActionState["fieldErrors"] = {};

  const state = partial.state?.trim() || "";
  if (!state) errors.state = "Elige el estado.";
  const municipio = partial.municipio?.trim() || "";
  if (!municipio) errors.municipio = "Elige el municipio.";
  const city = partial.city?.trim() || "";
  if (!city) errors.city = "Elige la ciudad.";
  const postalCode = partial.postalCode?.trim() || "";
  if (!postalCode) errors.postalCode = "Indica el código postal.";
  const barrio = partial.barrio?.trim() || "";
  if (!barrio) errors.barrio = "Indica el barrio / urbanización.";
  const address = partial.address?.trim() || "";
  if (!address) errors.address = "Indica la dirección detallada.";

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      state,
      municipio,
      city,
      postalCode,
      barrio,
      address,
      reference: partial.reference?.trim() || null,
    },
  };
}

/**
 * Compone la dirección de una sola línea que se guarda en `clients.address`
 * (la columna es texto plano; el detalle estructurado VE se concatena legible).
 * Ej: "Av. principal, edif. X · Urb. La Esmeralda · Valencia, Carabobo · CP 2001".
 */
export function composeAddress(input: AddressInput): string {
  const parts = [
    input.address,
    input.barrio,
    `${input.city}, ${input.state}`,
    `CP ${input.postalCode}`,
  ];
  if (input.reference) parts.push(`Ref: ${input.reference}`);
  return parts.join(" · ");
}
