/**
 * Tipos TypeScript del módulo Clientes (SDD-0010).
 * Matchea schema de supabase/migrations/0006_clients.sql.
 */

export type ClientTier = "regular" | "vip" | "premium";

/**
 * SDD-0265 · tamaño del bloque del listado: lo que trae la primera carga y lo
 * que suma cada "Ver más".
 *
 * Vive acá y no en `client-queries` a propósito: el componente client lo
 * necesita para armar el "Ver más", y no puede importar el módulo de queries
 * sin cruzar la frontera server→client (el gate tiene un paso que lo vigila).
 */
export const CLIENTS_PAGE = 200;

/**
 * Techo duro del listado. PostgREST corta en su `max-rows` (1000 en este
 * proyecto) **sin avisar**, así que pedir más sería mostrar otro número igual de
 * falso. Al llegar acá la pantalla manda a buscar en vez de prometer más filas.
 */
export const CLIENTS_MAX = 1000;

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
  /**
   * SDD-0131: persona de contacto operativo de un cliente EMPRESA (con quién se
   * habla). null para personas naturales (ahí `name` ES la persona).
   */
  contact_name: string | null;
  tier: ClientTier;
  notes: string | null;
  /** Latitud GPS · habilita "Cerca de ti" del Mobile ERP (migración 0048). */
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
   * SDD-0255 · aliado dueño del cliente (el más profundo de la cadena).
   * NULL = cliente directo de DTD.
   */
  aliado_id: string | null;
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
  /**
   * SDD-0131: tipo de documento del alta · persona (cédula) | empresa (RIF).
   * Rutea la validación del documento y la verificación de identidad.
   */
  doc_kind: ClientDocKind;
  name: string;
  /** SDD-0131: contacto operativo (solo empresa; null para persona). */
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  rif: string | null;
  tier: ClientTier;
  notes: string | null;
  /** GPS opcional · habilita "Cerca de ti" del Mobile ERP. */
  lat: number | null;
  lng: number | null;
};

export const DOC_KIND_OPTIONS: { value: ClientDocKind; label: string }[] = [
  { value: "persona", label: "Persona (cédula)" },
  { value: "empresa", label: "Empresa (RIF)" },
];

export function docKindLabel(kind: ClientDocKind | null): string {
  switch (kind) {
    case "persona":
      return "Persona";
    case "empresa":
      return "Empresa";
    default:
      return "Sin tipo";
  }
}

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

/**
 * Cédula venezolana (persona): prefijo V (venezolano) o E (extranjero) + 6 a 9
 * dígitos; o pasaporte, prefijo P + 5 a 12 alfanuméricos. Acepta con/sin guión
 * ("V-12345678" o "V12345678"). Case-insensitive. Mismo formato que el registro
 * público (`register-types.ts`), acá para el alta interna del Studio (SDD-0131).
 */
export const CEDULA_REGEX = /^(?:[VEve]-?\d{6,9}|[Pp]-?[A-Za-z0-9]{5,12})$/;

/**
 * Normaliza una cédula a canónico "V-12345678" (prefijo mayúscula + guión).
 * Asume que ya pasó CEDULA_REGEX.
 */
export function formatCedula(raw: string): string {
  const clean = raw.replace(/[-\s]/g, "").toUpperCase();
  return `${clean[0]}-${clean.slice(1)}`;
}

/**
 * Normaliza el documento a su forma canónica SEGÚN el tipo (SDD-0131):
 *   persona → cédula `formatCedula` · empresa → RIF `formatRif`.
 * Devuelve null si el documento no matchea el formato esperado para ese tipo.
 */
export function normalizeDocByKind(
  kind: ClientDocKind,
  raw: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (kind === "empresa") {
    return RIF_REGEX.test(trimmed) ? formatRif(trimmed) : null;
  }
  return CEDULA_REGEX.test(trimmed) ? formatCedula(trimmed) : null;
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

  // Tipo de documento (persona/empresa). Default 'persona' si viene inválido —
  // el form siempre lo manda, esto es un piso defensivo.
  const doc_kind: ClientDocKind =
    input.doc_kind === "empresa" ? "empresa" : "persona";
  const isCompany = doc_kind === "empresa";

  const name = input.name?.trim() ?? "";
  if (!name) errors.name = isCompany ? "Indica la razón social." : "Indica el nombre.";
  else if (name.length > 200)
    errors.name = "El nombre es demasiado largo (máx 200).";

  // Contacto operativo: solo aplica a empresa; para persona se fuerza null.
  let contact_name: string | null = null;
  if (isCompany) {
    contact_name = input.contact_name?.trim() || null;
    if (contact_name && contact_name.length > 200) {
      errors.contact_name = "El contacto es demasiado largo (máx 200).";
    }
  }

  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Email inválido.";
  }

  // Documento (clients.rif): opcional, pero si viene se valida SEGÚN el tipo.
  // persona → cédula V/E-dígitos · empresa → RIF J/G-…-verificador.
  const rifRaw = input.rif?.trim() || null;
  let rifCanonical: string | null = null;
  if (rifRaw) {
    rifCanonical = normalizeDocByKind(doc_kind, rifRaw);
    if (!rifCanonical) {
      errors.rif = isCompany
        ? "RIF inválido. Formato: J-12345678-9."
        : "Cédula o pasaporte inválido. Formato: V-12345678 o P-A1234567.";
    }
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
      doc_kind,
      name,
      contact_name,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      rif: rifCanonical,
      tier: tier!,
      notes: input.notes?.trim() || null,
      lat,
      lng,
    },
  };
}

// ── Completitud del perfil del cliente (SDD-0131) ───────────────────────────
// Checklist DERIVADO (sin estado nuevo en DB): qué falta para tener el cliente
// listo para operar/analizar. Puro y testeable — la UI (ficha + aviso al crear)
// solo pinta el resultado.

export type CompletenessItem = {
  key: string;
  label: string;
  done: boolean;
};

export type ClientCompleteness = {
  items: CompletenessItem[];
  doneCount: number;
  total: number;
  /** Porcentaje 0..100 redondeado. */
  pct: number;
  isComplete: boolean;
  /** Labels de los ítems que faltan (para el aviso "qué falta"). */
  missingLabels: string[];
};

/**
 * Subset de `Client` que necesita `clientCompleteness` — así el helper se puede
 * llamar con el `Client` completo o con un objeto mínimo (ej. desde el drawer,
 * antes de tener la fila persistida).
 */
export type CompletenessSource = Pick<
  Client,
  | "doc_kind"
  | "rif"
  | "contact_name"
  | "email"
  | "phone"
  | "address"
  | "cedula_photo_path"
  | "doc_verify_status"
>;

const hasText = (v: string | null | undefined): boolean =>
  typeof v === "string" && v.trim().length > 0;

/**
 * Evalúa qué le falta a un cliente para estar "completo". Los ítems dependen del
 * tipo: una EMPRESA suma "Nombre de contacto"; el resto es común. La verificación
 * de identidad cuenta como hecha solo cuando "corresponde" (ok) — advisory, no
 * bloquea nada, solo informa.
 */
export function clientCompleteness(c: CompletenessSource): ClientCompleteness {
  const isCompany = c.doc_kind === "empresa";

  const items: CompletenessItem[] = [
    { key: "doc_kind", label: "Tipo (persona / empresa)", done: c.doc_kind != null },
    {
      key: "rif",
      label: isCompany ? "RIF" : "Cédula",
      done: hasText(c.rif),
    },
    ...(isCompany
      ? [
          {
            key: "contact_name",
            label: "Nombre de contacto",
            done: hasText(c.contact_name),
          },
        ]
      : []),
    { key: "email", label: "Email", done: hasText(c.email) },
    { key: "phone", label: "Teléfono", done: hasText(c.phone) },
    { key: "address", label: "Dirección", done: hasText(c.address) },
    {
      key: "cedula_photo_path",
      label: isCompany ? "Foto del RIF" : "Foto de la cédula",
      done: hasText(c.cedula_photo_path),
    },
    {
      key: "identity",
      label: "Identidad verificada",
      done: c.doc_verify_status === "ok",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  return {
    items,
    doneCount,
    total,
    pct: total === 0 ? 100 : Math.round((doneCount / total) * 100),
    isComplete: doneCount === total,
    missingLabels: items.filter((i) => !i.done).map((i) => i.label),
  };
}
