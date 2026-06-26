/**
 * Tipos TypeScript del módulo Clientes (SDD-0010).
 * Matchea schema de supabase/migrations/0006_clients.sql.
 */

export type ClientTier = "regular" | "vip" | "premium";

/** Origen del alta del cliente (SDD-0046). */
export type RegistrationChannel = "admin" | "portal";
/** Tipo de documento del cliente (SDD-0046): cédula vs RIF. */
export type ClientDocKind = "persona" | "empresa";
/** Resultado advisory de la verificación de identidad (SDD-0046). */
export type DocVerifyStatus = "ok" | "mismatch" | "unavailable";
/** Fuente del resultado de verificación (SDD-0046). */
export type DocVerifySource = "cne" | "seniat" | "manual";

export type Client = {
  id: string;
  tenant_id: string;
  markbox: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  rif: string | null;
  tier: ClientTier;
  notes: string | null;
  /** Latitud GPS · habilita "Cerca tuyo" del Mobile ERP (migración 0048). */
  lat: number | null;
  /** Longitud GPS. */
  lng: number | null;
  /** SDD-0046: origen del alta · admin (asesor) | portal (self-registro). */
  registration_channel: RegistrationChannel;
  /** SDD-0046: tipo de documento · persona (cédula) | empresa (RIF). */
  doc_kind: ClientDocKind | null;
  /** SDD-0046: resultado advisory · null sin verificar | ok | mismatch | unavailable. */
  doc_verify_status: DocVerifyStatus | null;
  /** SDD-0046: fuente del resultado · cne | seniat | manual. */
  doc_verify_source: DocVerifySource | null;
  /** SDD-0046: nombre/razón social que devolvió el registro oficial. */
  doc_registry_name: string | null;
  /** SDD-0046: timestamp de la última verificación. */
  doc_verified_at: string | null;
  /** SDD-0042 Fase 6 / SDD-0046: path en client-docs de la foto de cédula/RIF. */
  cedula_photo_path: string | null;
  /**
   * ERP→Norte: usuario (auth.users) asesor asignado a este cliente. null = sin
   * asignar (el portal degrada al contacto público). Debe ser miembro activo del
   * mismo tenant (lo garantiza el trigger clients_advisor_same_tenant, migr 0151).
   */
  advisor_id: string | null;
  /**
   * SDD-0106: identidad (tabla `persons`, anclada por cédula) de este perfil de
   * carga. La cédula es el identificador estable de la persona a través de
   * servicios (carga, academia); el Shipping Mark es el rastreo de cajas.
   */
  person_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Subset que el operador edita (no incluye markbox, que se autogenera). */
export type ClientInput = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  rif: string | null;
  tier: ClientTier;
  notes: string | null;
  /** GPS opcional · habilita "Cerca tuyo" del Mobile ERP. */
  lat: number | null;
  lng: number | null;
};

export const CLIENT_TIER_OPTIONS: { value: ClientTier; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "vip", label: "VIP" },
  { value: "premium", label: "Premium" },
];

export function tierLabel(tier: ClientTier): string {
  switch (tier) {
    case "regular":
      return "Regular";
    case "vip":
      return "VIP";
    case "premium":
      return "Premium";
  }
}

/**
 * Tone de Badge para cada tier (matchea tonos del sistema).
 */
export function tierBadgeTone(tier: ClientTier): "neutral" | "info" | "wine" {
  switch (tier) {
    case "regular":
      return "neutral";
    case "vip":
      return "info";
    case "premium":
      return "wine";
  }
}

/**
 * Badge advisory del estado de verificación de identidad (SDD-0046).
 *
 * El badge es ADVISORY — nunca bloquea al cliente (§5.2). Tonos:
 *   - sin verificar (null) → neutral
 *   - corresponde (ok)     → success
 *   - no corresponde (mismatch) → danger
 *   - no disponible (unavailable) → warning
 */
export function docVerifyBadge(status: DocVerifyStatus | null): {
  tone: "neutral" | "success" | "danger" | "warning";
  label: string;
} {
  switch (status) {
    case "ok":
      return { tone: "success", label: "Corresponde" };
    case "mismatch":
      return { tone: "danger", label: "No corresponde" };
    case "unavailable":
      return { tone: "warning", label: "No disponible" };
    default:
      return { tone: "neutral", label: "Sin verificar" };
  }
}

/** Label corto de la fuente de verificación (SDD-0046) — para "Verificado por …". */
export function docVerifySourceLabel(source: DocVerifySource | null): string {
  switch (source) {
    case "cne":
      return "CNE";
    case "seniat":
      return "SENIAT";
    case "manual":
      return "marca manual";
    default:
      return "—";
  }
}

/**
 * Formato RIF venezolano.
 * - Letra inicial: V (cédula), E (extranjera), J (jurídica), G (gubernamental), P (pasaporte)
 * - 8 dígitos
 * - 1 dígito verificador
 *
 * Acepta variantes con/sin guión: "J-12345678-9" o "J123456789".
 */
export const RIF_REGEX = /^[VEJGPvejgp]-?\d{8}-?\d$/;

/**
 * Normaliza un RIF a formato canónico "X-XXXXXXXX-X".
 * Asume que ya pasó RIF_REGEX. Devuelve uppercase.
 */
export function formatRif(raw: string): string {
  const clean = raw.replace(/-/g, "").toUpperCase();
  return `${clean[0]}-${clean.slice(1, 9)}-${clean[9]}`;
}

const VALID_TIERS: ClientTier[] = ["regular", "vip", "premium"];

export type ClientActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ClientInput, string>>;
  /** En create, el server devuelve el markbox autogenerado. */
  createdMarkbox?: string;
  /**
   * Warning soft (no rompe la operación). Ej: cliente creado pero el email
   * de bienvenida no se pudo registrar. SDD-0032.
   */
  warning?: string;
};

/**
 * Validación manual (patrón del proyecto — sin zod).
 */
export function validateClientInput(input: Partial<ClientInput>): {
  input?: ClientInput;
  fieldErrors?: ClientActionState["fieldErrors"];
} {
  const errors: ClientActionState["fieldErrors"] = {};

  const name = input.name?.trim() ?? "";
  if (!name) errors.name = "Indica el nombre.";
  if (name.length > 200) errors.name = "El nombre es demasiado largo (máx 200).";

  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email inválido.";
  }

  const rif = input.rif?.trim() || null;
  if (rif && !RIF_REGEX.test(rif)) {
    errors.rif = "RIF inválido. Formato: J-12345678-9 o V-12345678.";
  }

  const tier = input.tier;
  if (!tier || !VALID_TIERS.includes(tier)) {
    errors.tier = "Tier inválido.";
  }

  const lat = input.lat ?? null;
  const lng = input.lng ?? null;
  if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
    errors.lat = "Latitud inválida (debe estar entre -90 y 90).";
  }
  if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
    errors.lng = "Longitud inválida (debe estar entre -180 y 180).";
  }
  if ((lat === null) !== (lng === null)) {
    errors.lat = errors.lat ?? "Carga lat y lng juntos.";
    errors.lng = errors.lng ?? "Carga lat y lng juntos.";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      name,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      rif: rif ? formatRif(rif) : null,
      tier: tier!,
      notes: input.notes?.trim() || null,
      lat,
      lng,
    },
  };
}
