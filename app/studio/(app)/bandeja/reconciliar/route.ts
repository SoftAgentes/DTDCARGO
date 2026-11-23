/**
 * POST /studio/bandeja/reconciliar — corrige el contador con lo que el agente ve
 * en Chatwoot (SDD-0680, adenda 2026-11-23; la lógica es la action `reconciliarBandeja`).
 *
 * Va por ruta propia y no por server action: tarda decenas de segundos (varias
 * páginas de conversaciones y una escritura por cada una) y, en la cola única de
 * actions de Next, dejaba esperando al SSO de la Bandeja.
 */
import { reconciliarBandeja } from "../actions";
import { esMismoOrigen } from "../mismo-origen";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  if (!esMismoOrigen(req)) {
    return Response.json({ ok: false, error: "denied" }, { status: 403, headers: SIN_CACHE });
  }
  return Response.json(await reconciliarBandeja(), { headers: SIN_CACHE });
}
