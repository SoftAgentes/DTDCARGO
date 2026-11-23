/**
 * POST /studio/bandeja/sso — enlace de un solo uso para el iframe (SDD-0680, adenda 2026-11-23).
 *
 * Misma lógica que la action `pedirEnlaceSso` (candados de rol, flag, vínculo y
 * la marca `dtd_cw_sso`), pero fuera de la cola de server actions de Next. El
 * 2026-11-23 el SSO de Chatwoot respondía en menos de 300 ms y la action tardaba
 * de 16 a 52 s: esperaba detrás de `reconciliarBandeja` en la misma cola y el
 * cliente mostraba «no respondió a tiempo». Con una ruta, el cliente puede
 * además cortar el pedido (`AbortController`) y reintentar sin que nada quede
 * trabado.
 *
 * Nunca se registra el enlace ni el token.
 */
import { pedirEnlaceSso } from "../actions";
import { esMismoOrigen } from "../mismo-origen";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  if (!esMismoOrigen(req)) {
    return Response.json({ ok: false, error: "denied" }, { status: 403, headers: SIN_CACHE });
  }
  let conversacion: number | undefined;
  try {
    const cuerpo: unknown = await req.json();
    const c = cuerpo && typeof cuerpo === "object" ? (cuerpo as { conversacion?: unknown }).conversacion : undefined;
    conversacion = typeof c === "number" ? c : undefined;
  } catch {
    conversacion = undefined;
  }
  const r = await pedirEnlaceSso(conversacion);
  return Response.json(r, { headers: SIN_CACHE });
}
