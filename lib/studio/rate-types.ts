/**
 * Tipos TypeScript del módulo Tarifas (SDD-0008).
 * Matchea schema de supabase/migrations/0005_rates.sql.
 *
 * Reusa `ShipmentService` enum del módulo Tracking (mismo enum en BD).
 */

import type { ShipmentService } from "./shipment-types";

export type Rate = {
  id: string;
  tenant_id: string;
  service: ShipmentService;
  origin: string;
  destination: string;
  per_cbm: number | null;
  flat_rate: number | null;
  min_charge: number | null;
  transit_days: number | null;
  valid_from: string | null;   // ISO date YYYY-MM-DD · par con valid_until
  valid_until: string | null;  // ISO date YYYY-MM-DD
  is_public: boolean;          // marca la tarifa per_cbm pública del calculador
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Subset de Rate que un usuario puede editar (todo menos id/tenant_id/timestamps). */
export type RateInput = {
  service: ShipmentService;
  origin: string;
  destination: string;
  per_cbm: number | null;
  flat_rate: number | null;
  min_charge: number | null;
  transit_days: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_public: boolean;
  notes: string | null;
};

/**
 * Opciones del select de servicio en el form de Tarifas.
 * Reusa las labels del módulo Tracking para consistencia.
 */
export const RATE_SERVICE_OPTIONS: { value: ShipmentService; label: string }[] = [
  { value: "consolidacion", label: "Consolidación (LCL)" },
  { value: "puerta_a_puerta_DDP", label: "Puerta a Puerta DDP (prepago)" },
  { value: "reserva_FCL", label: "Reserva FCL (container completo)" },
  { value: "transporte_terrestre", label: "Transporte terrestre (VE interno)" },
];

/**
 * Indica si el servicio se cobra por CBM (LCL-style) o por flat rate (FCL-style).
 * Usado por la UI del drawer para mostrar el campo correcto y por el seed.
 */
export function priceMode(service: ShipmentService): "per_cbm" | "flat_rate" {
  switch (service) {
    case "consolidacion":
    case "puerta_a_puerta_DDP":
      return "per_cbm";
    case "reserva_FCL":
    case "transporte_terrestre":
      return "flat_rate";
  }
}

/** Format helper para mostrar la tarifa en la tabla. */
export function formatRate(rate: Pick<Rate, "per_cbm" | "flat_rate">): string {
  if (rate.per_cbm != null) {
    return `$${rate.per_cbm.toFixed(2)}/CBM`;
  }
  if (rate.flat_rate != null) {
    return `$${rate.flat_rate.toLocaleString("en-US")}/ctr`;
  }
  return "—";
}

/** Tipo del estado de las server actions (consistente con shipment actions). */
export type RateActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof RateInput, string>>;
  /** ID del rate recién creado · solo en createRate. Sirve para highlight de row. */
  createdId?: string;
};

/**
 * Validación manual del input (patrón del proyecto — sin zod).
 * Retorna {input} si pasa o {fieldErrors} si falla.
 */
export function validateRateInput(input: Partial<RateInput>): {
  input?: RateInput;
  fieldErrors?: RateActionState["fieldErrors"];
} {
  const errors: RateActionState["fieldErrors"] = {};

  if (!input.service) errors.service = "Elegí un servicio.";
  if (!input.origin || !input.origin.trim()) errors.origin = "Indicá el origen.";
  if (!input.destination || !input.destination.trim())
    errors.destination = "Indicá el destino.";

  const hasPerCbm = input.per_cbm != null && Number.isFinite(input.per_cbm) && input.per_cbm > 0;
  const hasFlat = input.flat_rate != null && Number.isFinite(input.flat_rate) && input.flat_rate > 0;
  if (!hasPerCbm && !hasFlat) {
    errors.per_cbm = "Tenés que indicar tarifa por CBM o flat.";
  }

  if (input.transit_days != null && (!Number.isFinite(input.transit_days) || input.transit_days < 0)) {
    errors.transit_days = "Días de tránsito debe ser un entero positivo.";
  }

  if (input.min_charge != null && (!Number.isFinite(input.min_charge) || input.min_charge < 0)) {
    errors.min_charge = "Mínimo cobrable debe ser un número positivo.";
  }

  if (input.per_cbm != null && (!Number.isFinite(input.per_cbm) || input.per_cbm < 0)) {
    errors.per_cbm = "Tarifa por CBM debe ser un número positivo.";
  }

  if (input.flat_rate != null && (!Number.isFinite(input.flat_rate) || input.flat_rate < 0)) {
    errors.flat_rate = "Tarifa flat debe ser un número positivo.";
  }

  const validFromOk = input.valid_from
    ? !Number.isNaN(new Date(input.valid_from).getTime())
    : true;
  const validUntilOk = input.valid_until
    ? !Number.isNaN(new Date(input.valid_until).getTime())
    : true;

  if (!validFromOk) errors.valid_from = "Fecha de vigencia (desde) inválida.";
  if (!validUntilOk) errors.valid_until = "Fecha de vigencia (hasta) inválida.";

  // Invariante: si ambas fechas son válidas, valid_from no puede ser posterior a valid_until.
  if (validFromOk && validUntilOk && input.valid_from && input.valid_until) {
    if (new Date(input.valid_from) > new Date(input.valid_until)) {
      errors.valid_from = "La vigencia 'desde' no puede ser posterior a 'hasta'.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      service: input.service!,
      origin: input.origin!.trim(),
      destination: input.destination!.trim(),
      per_cbm: hasPerCbm ? input.per_cbm! : null,
      flat_rate: hasFlat ? input.flat_rate! : null,
      min_charge: input.min_charge ?? null,
      transit_days: input.transit_days ?? null,
      valid_from: input.valid_from ?? null,
      valid_until: input.valid_until ?? null,
      is_public: input.is_public ?? false,
      notes: input.notes?.trim() || null,
    },
  };
}
