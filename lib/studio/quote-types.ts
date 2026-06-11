/**
 * Tipos TypeScript del módulo Estimados (ex-Cotizador · SDD-0011, renombrado en SDD-0061).
 * Matchea schema de supabase/migrations/0007_quotes.sql.
 */

import type { ShipmentService } from "./shipment-types";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

/** SDD-0061: origen del estimado. `web` = capturado de la calculadora pública. */
export type QuoteSource = "studio" | "web";

export type Quote = {
  id: string;
  tenant_id: string;
  quote_code: string;
  /**
   * MARKBOX del cliente. NULLABLE desde SDD-0061 (0113): un estimado web de un
   * PROSPECTO todavía no tiene cuenta → null hasta que se vincula (auto por
   * código/datos en el registro, o manual desde el módulo).
   */
  client_markbox: string | null;
  client_name: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  cbm: number | null;
  weight_kg: number | null;
  boxes: number | null;
  packaging: string;
  rate_per_cbm: number | null;
  flat_rate: number | null;
  rate_used_id: string | null;
  subtotal_usd: number;
  packaging_cost: number;
  total_usd: number;
  status: QuoteStatus;
  valid_until: string;            // YYYY-MM-DD
  sent_at: string | null;
  accepted_at: string | null;
  converted_to_shipment_id: string | null;
  notes: string | null;
  // SDD-0061 Fase B1 — datos del prospecto web (null en quotes del Studio).
  prospect_name: string | null;
  prospect_email: string | null;
  prospect_whatsapp: string | null;
  nota: string | null;
  source: QuoteSource;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** ¿Es un estimado web todavía sin vincular a un cliente (MARKBOX)? */
export function isUnlinkedWebEstimate(
  quote: Pick<Quote, "source" | "client_markbox">,
): boolean {
  return quote.source === "web" && !quote.client_markbox;
}

/** Lo que el operador edita (sin code, status, timestamps, conversion link). */
export type QuoteInput = {
  client_markbox: string;
  client_name: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  cbm: number | null;
  weight_kg: number | null;
  boxes: number | null;
  packaging: string;
  rate_per_cbm: number | null;
  flat_rate: number | null;
  rate_used_id: string | null;
  valid_until: string;
  notes: string | null;
};

export const QUOTE_STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviada" },
  { value: "accepted", label: "Aceptada" },
  { value: "rejected", label: "Rechazada" },
  { value: "expired", label: "Vencida" },
];

export function statusLabel(status: QuoteStatus): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "sent":
      return "Enviada";
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "expired":
      return "Vencida";
  }
}

export function statusBadgeTone(
  status: QuoteStatus,
): "neutral" | "info" | "success" | "danger" | "warning" {
  switch (status) {
    case "draft":
      return "neutral";
    case "sent":
      return "info";
    case "accepted":
      return "success";
    case "rejected":
      return "danger";
    case "expired":
      return "warning";
  }
}

/**
 * Packaging hardcoded del handoff. Si el negocio necesita más,
 * agregar tabla `packaging_options` en SDD futuro.
 */
export const PACKAGING_OPTIONS: {
  id: string;
  label: string;
  extra: number;
}[] = [
  { id: "carton", label: "Cartón (estándar)", extra: 0 },
  { id: "paleta", label: "Sobre paleta (palet)", extra: 60 },
  { id: "madera", label: "Caja de madera", extra: 60 },
];

export function packagingLabel(id: string): string {
  return PACKAGING_OPTIONS.find((p) => p.id === id)?.label ?? id;
}

export function packagingExtraCost(id: string): number {
  return PACKAGING_OPTIONS.find((p) => p.id === id)?.extra ?? 0;
}

/**
 * Indica si el servicio se cobra por CBM (LCL) o por flat (FCL).
 * Igual que rate-types pero copiado para evitar import circular.
 */
export function quotePriceMode(
  service: ShipmentService,
): "per_cbm" | "flat_rate" {
  switch (service) {
    case "consolidacion":
    case "puerta_a_puerta_DDP":
      return "per_cbm";
    case "reserva_FCL":
    case "transporte_terrestre":
      return "flat_rate";
  }
}

/**
 * Calcula subtotal, packagingCost y total de una quote.
 * Función pura — se usa tanto client-side (live update) como server-side
 * (recálculo al persistir). Garantiza coherencia.
 */
export function calcQuoteTotal(input: {
  service: ShipmentService;
  cbm: number | null;
  ratePerCbm: number | null;
  flatRate: number | null;
  packaging: string;
}): { subtotal: number; packagingCost: number; total: number } {
  const mode = quotePriceMode(input.service);
  let subtotal = 0;

  if (mode === "per_cbm") {
    const cbm = Number(input.cbm) || 0;
    const rate = Number(input.ratePerCbm) || 0;
    subtotal = round2(cbm * rate);
  } else {
    subtotal = Number(input.flatRate) || 0;
  }

  const packagingCost = packagingExtraCost(input.packaging);
  const total = round2(subtotal + packagingCost);

  return { subtotal: round2(subtotal), packagingCost, total };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type QuoteActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof QuoteInput, string>>;
  /** En createQuote el server devuelve el code generado para redirect. */
  createdCode?: string;
};

/** Validación manual. */
export function validateQuoteInput(input: Partial<QuoteInput>): {
  input?: QuoteInput;
  fieldErrors?: QuoteActionState["fieldErrors"];
} {
  const errors: QuoteActionState["fieldErrors"] = {};

  if (!input.service) errors.service = "Elige un servicio.";
  if (!input.client_markbox?.trim())
    errors.client_markbox = "Indica el Shipping Mark del cliente.";
  if (!input.client_name?.trim())
    errors.client_name = "Indica el nombre del cliente.";
  if (!input.origin?.trim()) errors.origin = "Indica el origen.";
  if (!input.destination?.trim())
    errors.destination = "Indica el destino.";

  const mode = input.service ? quotePriceMode(input.service) : null;
  if (mode === "per_cbm") {
    const cbm = Number(input.cbm);
    if (!Number.isFinite(cbm) || cbm <= 0)
      errors.cbm = "Indica un CBM positivo.";
    const rate = Number(input.rate_per_cbm);
    if (!Number.isFinite(rate) || rate <= 0)
      errors.rate_per_cbm = "Indica una tarifa por CBM positiva.";
  } else if (mode === "flat_rate") {
    const flat = Number(input.flat_rate);
    if (!Number.isFinite(flat) || flat <= 0)
      errors.flat_rate = "Indica una tarifa flat positiva.";
  }

  if (!input.valid_until || !/^\d{4}-\d{2}-\d{2}$/.test(input.valid_until)) {
    errors.valid_until = "Indica la fecha de vigencia (YYYY-MM-DD).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      client_markbox: input.client_markbox!.trim(),
      client_name: input.client_name!.trim(),
      service: input.service!,
      origin: input.origin!.trim(),
      destination: input.destination!.trim(),
      cbm: input.cbm ?? null,
      weight_kg: input.weight_kg ?? null,
      boxes: input.boxes ?? null,
      packaging: input.packaging || "carton",
      rate_per_cbm: input.rate_per_cbm ?? null,
      flat_rate: input.flat_rate ?? null,
      rate_used_id: input.rate_used_id ?? null,
      valid_until: input.valid_until!,
      notes: input.notes?.trim() || null,
    },
  };
}

/** ¿El status permite "Editar"? */
export function isEditable(status: QuoteStatus): boolean {
  return status === "draft";
}

/** ¿El status permite "Convertir a embarque"? */
export function canConvertToShipment(quote: Quote): boolean {
  return quote.status === "accepted" && !quote.converted_to_shipment_id;
}

/** Calcula si una quote está vencida (UI helper, no se persiste). */
export function isExpired(quote: Pick<Quote, "valid_until" | "status">): boolean {
  if (quote.status === "accepted" || quote.status === "rejected") return false;
  const today = new Date().toISOString().slice(0, 10);
  return quote.valid_until < today;
}
