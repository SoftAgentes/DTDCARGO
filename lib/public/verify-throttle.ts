/**
 * Throttle por IP para la verificación pública /verificar (migr 0169).
 *
 * /verificar usa service_role para confirmar existencia de un Shipping Mark
 * (DTD-NNNN) o leer un diploma (DTD-AC-YYYY-NNNN). Ambos códigos son
 * SECUENCIALES → enumerables; la rama de diploma expone `student_name` (PII).
 * Este throttle acota cuántas verificaciones hace una IP por ventana; pasado el
 * límite, el page responde en estado neutro sin revelar existencia/PII.
 *
 * Mismo patrón que el anti-abuso de /registro (SDD-0042 §10): cuenta intentos
 * recientes de la IP y, si está bajo el límite, registra este intento.
 * **Fail-closed (SDD-0374)**: una lectura o escritura incierta bloquea la
 * verificación. No revelar existencia/PII sin registrar el intento.
 * Count + insert NO es atómico: la reserva concurrente requiere otro cambio.
 *
 * El admin client (service_role) y la IP se reciben por parámetro: este archivo
 * vive del lado público de la frontera (`lib/public`) y NO puede importar
 * `@/lib/db` (regla ESLint). El page `app/verificar` —ruta privilegiada que sí
 * puede usar el admin client— inyecta ambos.
 *
 * Límite generoso a propósito: una persona escaneando un palet de cajas hace
 * decenas de verificaciones; un enumerador que quiere cosechar folios necesita
 * miles → bloqueado en serie; no garantiza ese cupo bajo concurrencia.
 */
export const VERIFY_IP_LIMIT = 40;
export const VERIFY_WINDOW_MINUTES = 30;
const TABLE = "public_verify_throttle";

/** Subconjunto estructural del admin client que usa el throttle (evita importar
 *  `@supabase/*`, restringido en `lib/public`). El client real lo satisface. */
type CountQuery = PromiseLike<{ count: number | null; error: unknown }> & {
  eq(col: string, val: string): CountQuery;
  gte(col: string, val: string): CountQuery;
};
export type ThrottleDb = {
  from(table: string): {
    select(col: string, opts: { count: "exact"; head: true }): CountQuery;
    insert(row: { ip: string }): PromiseLike<unknown>;
  };
};

/**
 * `true` si la IP YA superó el límite en la ventana (el caller NO debe revelar
 * existencia ni PII). Si está bajo el límite, registra el intento y devuelve
 * `false` sólo después de lectura e INSERT confirmados. No es reserva atómica.
 */
export async function isVerifyThrottled(db: ThrottleDb, ip: string): Promise<boolean> {
  const unavailable = () => {
    console.warn("[public-verify] Control de intentos no disponible; verificación bloqueada.");
    return true;
  };
  try {
    const windowStart = new Date(
      Date.now() - VERIFY_WINDOW_MINUTES * 60 * 1000,
    ).toISOString();

    const { count, error } = await db
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", windowStart);

    if (error !== null || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      return unavailable();
    }
    if (count >= VERIFY_IP_LIMIT) return true;

    const result = await db.from(TABLE).insert({ ip });
    if (
      result === null || typeof result !== "object" || Array.isArray(result) ||
      !("error" in result) || result.error !== null
    ) return unavailable();
    return false;
  } catch {
    // No registrar IP, folio ni mensajes externos que puedan contenerlos.
    return unavailable();
  }
}
