/**
 * /api/public/ocean-rate · POST — tarifa de flete CACHEADA para el sitio público.
 * SDD-0095 Fase 2.
 *
 * Es el puente público↔ERP del cotizador de fletes: la UI pública NO importa
 * Supabase, le pega por HTTP a este handler. El handler valida el candado de país
 * (origen China · destino Venezuela/Barranquilla), lee la caché vía
 * `getPublicOceanRate` (RPC anon, 0 llamadas a SeaRates) y devuelve el estimado +
 * el disclaimer. Nunca consume cuota de SeaRates → a prueba de scraping por diseño.
 *
 * Body: { pointIdFrom, pointIdTo, shippingType, container? }.
 * Respuesta: { available, rate, disclaimer }.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  validateOceanRouteInput,
  OCEAN_RATE_DISCLAIMER,
} from "@/lib/shared/ocean-rate";
import { getPublicOceanRate } from "@/lib/public/ocean-rates-public";
import { readJsonBody } from "@/lib/http/read-json-body";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<Record<string, unknown>>(req);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error:
          parsed.status === 413
            ? "La solicitud es demasiado grande."
            : "Cuerpo de la solicitud inválido.",
      },
      { status: parsed.status },
    );
  }
  const body = parsed.body;

  // Candado de país + forma (lógica pura, boundary-safe).
  const { input, fieldErrors } = validateOceanRouteInput(body);
  if (fieldErrors) {
    return NextResponse.json({ error: "Datos incompletos.", fieldErrors }, { status: 400 });
  }

  // Lectura cacheada (nunca tira → null ante cualquier falla).
  const rate = await getPublicOceanRate(input);
  const available = rate != null && rate.status === "ok" && rate.rateUsd != null;

  return NextResponse.json({
    available,
    rate: available ? rate : null,
    disclaimer: OCEAN_RATE_DISCLAIMER,
  });
}
