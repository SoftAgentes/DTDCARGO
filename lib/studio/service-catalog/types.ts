/**
 * Tipos + validación del módulo Configuración de servicios (SDD-0076 Fase 2).
 * Matchea el schema de supabase/migrations/0130_service_configs.sql.
 *
 * La ESTRUCTURA/claves de los servicios viven en código (lib/shared/service-catalog.ts).
 * Acá va el CONTENIDO editable: descripción, alcance, precio, cobro, métodos de pago,
 * FAQ (públicas+internas), adicionales, notas internas, mapeo contable y publicación.
 *
 * Sin Zod — validación manual con `validateServicioConfigInput()`, igual que el resto
 * del Studio. El GUARDRAIL del founder ("no publicar con solo lo contable") vive en
 * `servicioPublishReadiness()`.
 */

import {
  SERVICE_CATALOG_BY_ID,
  type ServicioId,
} from "@/lib/shared/service-catalog";
import {
  CHARGE_MODES,
  type ChargeMode,
} from "@/lib/shared/service-offer";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
} from "@/lib/studio/payment-types";

export { PAYMENT_METHOD_OPTIONS, type PaymentMethod };

// ── Momento de cobro ("en qué parte se cobra") ───────────────
export type ChargeMoment =
  | "prepago"
  | "contra_entrega"
  | "por_hito"
  | "a_cotizar";

export const CHARGE_MOMENT_OPTIONS: { value: ChargeMoment; label: string }[] = [
  { value: "contra_entrega", label: "Contra entrega (pagas al llegar)" },
  { value: "prepago", label: "Prepago (antes del embarque)" },
  { value: "por_hito", label: "Por hito / etapa" },
  { value: "a_cotizar", label: "A cotizar con el asesor" },
];

const CHARGE_MOMENTS: ChargeMoment[] = CHARGE_MOMENT_OPTIONS.map((o) => o.value);

export function chargeMomentLabel(v: string | null | undefined): string {
  if (!v) return "";
  return CHARGE_MOMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export type ServiceState = "activo" | "suspendido" | "a-pedido" | "proximamente";

export const SERVICE_STATE_OPTIONS: { value: ServiceState; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "proximamente", label: "Próximamente" },
  { value: "a-pedido", label: "A pedido" },
  { value: "suspendido", label: "Suspendido" },
];

// ── Tabla de precios opcional (jsonb) ────────────────────────
export type PriceTable = {
  columnas: string[];
  filas: string[][];
  nota?: string;
};

// ── Fila de service_configs (normalizada desde la DB) ────────
export type ServiceConfig = {
  service_key: ServicioId;
  shipment_service: string | null;
  title_public: string;
  description_public: string;
  includes_public: string[];
  excludes_public: string[];
  price_text: string;
  price_table: PriceTable | null;
  charge_moment: ChargeMoment | null;
  payment_methods: PaymentMethod[];
  how_to_request: string;
  timelines_public: string;
  note_public: string | null;
  condiciones_politicas: string | null;
  notes_internal: string | null;
  internal_price_ref: string | null;
  mapeo_contable: string | null;
  is_public: boolean;
  service_state: ServiceState;
  updated_at: string;
  updated_by: string | null;
};

// ── FAQ (públicas e internas) ────────────────────────────────
export type ServiceFaqAudience = "public" | "internal";

export type ServiceFaq = {
  id: string;
  service_key: string;
  question: string;
  answer: string;
  audience: ServiceFaqAudience;
  is_public: boolean;
  sort_order: number;
};

// ── Adicional (ADS) ──────────────────────────────────────────
export type ServiceAddon = {
  id: string;
  service_key: string;
  nombre: string;
  condicion: string | null;
  tarifa: string | null;
  politica_texto: string | null;
  aplica_a: string[];
  is_public: boolean;
  sort_order: number;
};

// ── Historial de precios ─────────────────────────────────────
export type ServicePriceEntry = {
  id: string;
  service_key: string;
  monto_texto: string;
  moneda: string;
  valid_from: string;
  nota: string | null;
};

// ── Input del asistente (form → action) ──────────────────────
export type ServicioConfigInput = {
  title_public: string;
  description_public: string;
  includes_public: string[];
  excludes_public: string[];
  price_text: string;
  charge_moment: ChargeMoment | null;
  payment_methods: PaymentMethod[];
  how_to_request: string;
  timelines_public: string;
  note_public: string | null;
  condiciones_politicas: string | null;
  notes_internal: string | null;
  internal_price_ref: string | null;
  mapeo_contable: string | null;
  service_state: ServiceState;
};

export type ServicioConfigActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ServicioConfigInput, string>>;
};

// ── Validación de guardado (mínimos) ─────────────────────────
/**
 * Valida el input del asistente para GUARDAR. Mínimo viable: un título.
 * El resto puede quedar pendiente (vacío = no se renderiza, regla de oro).
 * El bloqueo de "solo lo contable" para PUBLICAR vive en `servicioPublishReadiness()`.
 */
export function validateServicioConfigInput(
  input: Partial<ServicioConfigInput>,
): {
  input?: ServicioConfigInput;
  fieldErrors?: ServicioConfigActionState["fieldErrors"];
} {
  const errors: ServicioConfigActionState["fieldErrors"] = {};

  if (!input.title_public || input.title_public.trim() === "") {
    errors.title_public = "El servicio necesita un nombre.";
  }

  if (input.charge_moment != null && !CHARGE_MOMENTS.includes(input.charge_moment)) {
    errors.charge_moment = "Momento de cobro no válido.";
  }

  const methods = input.payment_methods ?? [];
  if (methods.some((m) => !PAYMENT_METHODS.includes(m))) {
    errors.payment_methods = "Hay un método de pago no válido.";
  }

  const state = input.service_state ?? "activo";
  if (!SERVICE_STATE_OPTIONS.some((o) => o.value === state)) {
    errors.service_state = "Estado no válido.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      title_public: input.title_public!.trim(),
      description_public: (input.description_public ?? "").trim(),
      includes_public: (input.includes_public ?? []).filter((s) => s.trim() !== ""),
      excludes_public: (input.excludes_public ?? []).filter((s) => s.trim() !== ""),
      price_text: (input.price_text ?? "").trim(),
      charge_moment: input.charge_moment ?? null,
      payment_methods: methods,
      how_to_request: (input.how_to_request ?? "").trim(),
      timelines_public: (input.timelines_public ?? "").trim(),
      note_public: input.note_public?.trim() || null,
      condiciones_politicas: input.condiciones_politicas?.trim() || null,
      notes_internal: input.notes_internal?.trim() || null,
      internal_price_ref: input.internal_price_ref?.trim() || null,
      mapeo_contable: input.mapeo_contable?.trim() || null,
      service_state: state,
    },
  };
}

/**
 * GUARDRAIL del founder: un servicio NO se publica con solo la parte contable.
 * Para que `is_public` pueda pasar a true, lo descriptivo mínimo debe estar lleno:
 * descripción + al menos un "qué incluye" + cómo se solicita. Devuelve la lista
 * de lo que falta (vacía = listo para publicar).
 */
export function servicioPublishReadiness(
  cfg: Pick<
    ServiceConfig,
    "description_public" | "includes_public" | "how_to_request" | "title_public"
  >,
): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!cfg.title_public?.trim()) missing.push("nombre");
  if (!cfg.description_public?.trim()) missing.push("descripción");
  if (!cfg.includes_public || cfg.includes_public.length === 0)
    missing.push("qué incluye (alcance)");
  if (!cfg.how_to_request?.trim()) missing.push("cómo se solicita");
  return { ready: missing.length === 0, missing };
}

// ── Matriz de oferta (SDD-0090) — las 3 columnas configurables ───
export { type ChargeMode };

export type OfferMatrixInput = {
  suggests_keys: ServicioId[];
  includes_keys: ServicioId[];
  charge_mode: ChargeMode | null;
};

const isServicioId = (x: string): x is ServicioId =>
  Object.prototype.hasOwnProperty.call(SERVICE_CATALOG_BY_ID, x);

/**
 * Normaliza el input del editor de oferta (SDD-0090). PURO y defensivo:
 * - descarta claves que no son del catálogo y deduplica,
 * - solo los NÚCLEO llevan suggests/includes (la matriz se indexa por núcleo);
 *   en un add-on se fuerzan a [] aunque el form mande algo,
 * - "incluido" gana sobre "ofrecer": una clave en includes se saca de suggests
 *   (evita el estado contradictorio si el admin marca ambos),
 * - charge_mode debe ser un ChargeMode válido o null.
 */
export function parseOfferMatrixInput(
  raw: { suggests?: string[]; includes?: string[]; charge_mode?: string | null },
  isNucleo: boolean,
): OfferMatrixInput {
  const clean = (xs: string[] | undefined): ServicioId[] => [
    ...new Set((xs ?? []).filter(isServicioId)),
  ];
  const includes = isNucleo ? clean(raw.includes) : [];
  const includeSet = new Set(includes);
  const suggests = isNucleo
    ? clean(raw.suggests).filter((id) => !includeSet.has(id))
    : [];
  const cm = raw.charge_mode;
  return {
    suggests_keys: suggests,
    includes_keys: includes,
    charge_mode: cm && CHARGE_MODES.includes(cm as ChargeMode) ? (cm as ChargeMode) : null,
  };
}
