/**
 * Solicitud de cotización desde el portal del cliente (Norte · cierra el botón
 * "Nueva cotización" + el chip "Cotizaciones · próximamente").
 *
 * Modelo de dominio (founder 2026-06-21): un ESTIMADO es la primera salida —
 * etapa lead, sale de la calculadora pública (`quotes.source='web'`). Una
 * COTIZACIÓN es más formal: el cliente YA está registrado y pide algo específico,
 * se brinca la etapa de estimado. En el schema NO hay tabla aparte — ambos viven
 * en `quotes`; la cotización del portal es un `quote` con `source='studio'`
 * (cliente conocido) que el asesor cotiza en `/studio/cotizador`. Ni estimado ni
 * cotización son contables; al aceptar + abonar se convierte en OV real (SDD-0072,
 * diferido) — eso lo maneja el asesor, fuera de este flujo.
 *
 * Este módulo es PURO (sin Supabase): valida el form del cliente y arma la fila de
 * `quotes` que el server action inserta con admin client. Testeable con stubs.
 * Las columnas de precio (subtotal/total) nacen en 0 — las llena el asesor al
 * cotizar; el cliente NO fija precios.
 */
import {
  SHIPMENT_SERVICES,
  isShipmentService,
  type ShipmentService,
} from "@/lib/shared/shipment-public";
import type { QuoteStatus } from "@/lib/studio/quote-types";

/** Los servicios núcleo que el cliente puede pedir cotizar (los 5 del enum). */
export const COTIZACION_SERVICES: readonly ShipmentService[] = SHIPMENT_SERVICES;

/** Input del cliente, validado y normalizado. */
export type CotizacionRequestInput = {
  service: ShipmentService;
  origin: string;
  destination: string;
  /** Qué quiere traer / detalle del pedido (va a `quotes.nota`). */
  description: string;
  cbm: number | null;
  weightKg: number | null;
  boxes: number | null;
};

export type CotizacionFieldErrors = Partial<
  Record<"service" | "description" | "origin" | "destination", string>
>;

export type CotizacionValidation =
  | { input: CotizacionRequestInput; fieldErrors?: undefined }
  | { input?: undefined; fieldErrors: CotizacionFieldErrors };

/** Payload crudo del FormData (todo opcional/string hasta validar). */
export type CotizacionRequestPayload = {
  service?: string | null;
  origin?: string | null;
  destination?: string | null;
  description?: string | null;
  cbm?: string | number | null;
  weightKg?: string | number | null;
  boxes?: string | number | null;
};

const DESCRIPTION_MAX = 2000;

function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v >= 0 ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return null;
}

/**
 * Valida + normaliza la solicitud de cotización (sin Zod, estilo `validate*Input`
 * del repo). Baja fricción (founder pivot a operar): sólo `service` y
 * `description` son obligatorios; origen/destino traen default sensato (igual que
 * el estimado web). Los números son opcionales — el asesor los confirma al cotizar.
 */
export function validateCotizacionRequest(
  payload: CotizacionRequestPayload,
): CotizacionValidation {
  const fieldErrors: CotizacionFieldErrors = {};

  const serviceRaw = trimOrNull(payload.service);
  const service =
    isShipmentService(serviceRaw)
      ? serviceRaw
      : null;
  if (!service) fieldErrors.service = "Elige el tipo de servicio.";

  const description = trimOrNull(payload.description);
  if (!description) {
    fieldErrors.description = "Cuéntanos qué quieres cotizar.";
  } else if (description.length > DESCRIPTION_MAX) {
    fieldErrors.description = `Máximo ${DESCRIPTION_MAX} caracteres.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      service: service!,
      origin: trimOrNull(payload.origin) ?? "China",
      destination: trimOrNull(payload.destination) ?? "Venezuela",
      description: description!,
      cbm: num(payload.cbm),
      weightKg: num(payload.weightKg),
      boxes: num(payload.boxes) == null ? null : Math.round(num(payload.boxes)!),
    },
  };
}

/**
 * Nota legible para el asesor: marca la PROVENIENCIA (portal) + el detalle del
 * cliente + el volumen aproximado si lo dio. Como no agregamos un valor de `source`
 * nuevo (evita migración), el prefijo "Solicitud del portal" es la señal de que el
 * cliente lo pidió él mismo (vs un estimado que armó el asesor).
 */
export function buildCotizacionNota(input: CotizacionRequestInput): string {
  const vol: string[] = [];
  if (input.cbm != null) vol.push(`${input.cbm} CBM`);
  if (input.weightKg != null) vol.push(`${input.weightKg} kg`);
  if (input.boxes != null) vol.push(`${input.boxes} cajas`);
  const tail = vol.length > 0 ? ` — Aprox: ${vol.join(" · ")}` : "";
  return `Solicitud del portal · ${input.description}${tail}`;
}

/** La fila lista para insertar en `quotes` (sin tenant_id/quote_code, que los pone
 *  el action con el correlativo). `client_markbox`/`client_name` salen de la sesión
 *  del portal (NO del form) → el caller los pasa resueltos. */
export type CotizacionQuoteRow = {
  client_markbox: string;
  client_name: string;
  source: "studio";
  status: "draft";
  service: ShipmentService;
  origin: string;
  destination: string;
  cbm: number | null;
  weight_kg: number | null;
  boxes: number | null;
  packaging: string;
  subtotal_usd: number;
  packaging_cost: number;
  total_usd: number;
  nota: string;
};

/**
 * ¿Se puede AVANZAR este estimado (lead) a cotización formal? El cliente lo pide
 * desde /portal/estimados; avanzar = flipear el quote a `source='studio'` (el mismo
 * registro pasa a la pista formal, arrastra su precio automático). No se avanza si
 * ya se convirtió en envío, ni si está rechazado/vencido (terminales de cara al
 * cliente). Compartido por el botón (visibilidad) y la action (guard).
 */
export function canAdvanceEstimate(e: {
  status: QuoteStatus;
  convertedToShipmentId: string | null;
}): boolean {
  return (
    !e.convertedToShipmentId && e.status !== "rejected" && e.status !== "expired"
  );
}

export function buildCotizacionRow(
  input: CotizacionRequestInput,
  ctx: { clientMarkbox: string; clientName: string },
): CotizacionQuoteRow {
  return {
    client_markbox: ctx.clientMarkbox,
    client_name: ctx.clientName,
    source: "studio",
    status: "draft",
    service: input.service,
    origin: input.origin,
    destination: input.destination,
    cbm: input.cbm,
    weight_kg: input.weightKg,
    boxes: input.boxes,
    packaging: "carton",
    // Precio en 0: lo cotiza el asesor (el cliente no fija tarifas).
    subtotal_usd: 0,
    packaging_cost: 0,
    total_usd: 0,
    nota: buildCotizacionNota(input),
  };
}
