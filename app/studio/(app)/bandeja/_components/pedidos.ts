/**
 * SDD-0680 (adenda 2026-11-23) · pedidos de la Bandeja por `fetch` a rutas propias, no por server
 * actions. Next corre las actions del cliente de una en una: la reconciliación
 * (decenas de segundos) dejaba al SSO en cola y vencía el plazo del cliente.
 * Con `fetch` cada pedido va por su lado y se puede cortar con `signal`.
 */
import type { EnlaceSsoResult, ReconciliarResult } from "../actions";

export const RUTA_SSO = "/studio/bandeja/sso";
export const RUTA_RECONCILIAR = "/studio/bandeja/reconciliar";

async function postJson<T>(ruta: string, cuerpo: unknown, signal?: AbortSignal): Promise<T> {
  const r = await fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return (await r.json()) as T;
}

export function pedirEnlaceSso(conversacion?: number, signal?: AbortSignal): Promise<EnlaceSsoResult> {
  return postJson<EnlaceSsoResult>(RUTA_SSO, conversacion === undefined ? {} : { conversacion }, signal);
}

export function reconciliarBandeja(): Promise<ReconciliarResult> {
  return postJson<ReconciliarResult>(RUTA_RECONCILIAR, {});
}
