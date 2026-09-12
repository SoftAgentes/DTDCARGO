/**
 * Throttle por IP para la verificación pública /verificar (migr 0169).
 *
 * /verificar usa service_role para confirmar existencia de un Shipping Mark
 * (DTD-NNNN) o leer un diploma (DTD-AC-YYYY-NNNN). Ambos códigos son
 * SECUENCIALES → enumerables; la rama de diploma expone `student_name` (PII).
 * Este throttle acota cuántas verificaciones hace una IP por ventana; pasado el
 * límite, el page responde en estado neutro sin revelar existencia/PII.
 *
 * SDD-0375 / migración 0426: la RPC cuenta y registra bajo un lock transaccional
 * por clave textual IP. Sólo una reserva confirmada permite el lookup.
 * Sin RPC o ante incertidumbre bloquea, sin fallback al contador separado.
 * 0426 está aplicada en producción desde el 2026-09-12 (ledger 20260912022928):
 * la RPC existe y este consumidor reserva contra ella, no contra el contador.
 *
 * El admin client (service_role) y la IP se reciben por parámetro: este archivo
 * vive del lado público de la frontera (`lib/public`) y NO puede importar
 * `@/lib/db` (regla ESLint). El page `app/verificar` —ruta privilegiada que sí
 * puede usar el admin client— inyecta ambos.
 *
 * Límite generoso a propósito: una persona escaneando un palet de cajas hace
 * decenas de verificaciones; un enumerador que quiere cosechar folios necesita
 * miles. La garantía de cuota depende de usar la RPC para cada reserva;
 * no certifica confianza del proxy, identidad ni equivalencia de textos IPv6.
 */
export const VERIFY_IP_LIMIT = 40;
export const VERIFY_WINDOW_MINUTES = 30;
const RESERVE_RPC = "reserve_public_verify_attempt";

/** Subconjunto estructural del admin client que usa el throttle (evita importar
 *  `@supabase/*`, restringido en `lib/public`). El client real lo satisface. */
export type ThrottleDb = {
  rpc(name: typeof RESERVE_RPC, args: { p_ip: string }): PromiseLike<unknown>;
};

/**
 * `true` si la IP YA superó el límite en la ventana (el caller NO debe revelar
 * existencia ni PII). Devuelve `false` sólo tras reserva atómica confirmada;
 * cualquier respuesta incierta, excepción o rechazo bloquea la verificación.
 */
export async function isVerifyThrottled(db: ThrottleDb, ip: string): Promise<boolean> {
  const unavailable = () => {
    console.warn("[public-verify] Control de intentos no disponible; verificación bloqueada.");
    return true;
  };
  try {
    const result = await db.rpc(RESERVE_RPC, { p_ip: ip });
    if (
      result === null || typeof result !== "object" || Array.isArray(result) ||
      !("error" in result) || result.error !== null ||
      !("data" in result) || typeof result.data !== "boolean"
    ) return unavailable();
    return !result.data;
  } catch {
    // No registrar IP, folio ni mensajes externos que puedan contenerlos.
    return unavailable();
  }
}
