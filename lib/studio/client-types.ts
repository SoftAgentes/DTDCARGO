/**
 * Tipos TypeScript del módulo Clientes (SDD-0010).
 * Matchea schema de supabase/migrations/0006_clients.sql.
 */

export type ClientTier = "regular" | "vip" | "premium";

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
  if (!name) errors.name = "Indicá el nombre.";
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
    },
  };
}
