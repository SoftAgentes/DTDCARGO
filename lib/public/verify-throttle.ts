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
 * **Fail-open**: ante un error de lectura del throttle NO bloqueamos (no rompemos
 * el escaneo legítimo de un QR por un fallo de infra del propio anti-abuso).
 *
 * El admin client (service_role) y la IP se reciben por parámetro: este archivo
 * vive del lado público de la frontera (`lib/public`) y NO puede importar
 * `@/lib/db` (regla ESLint). El page `app/verificar` —ruta privilegiada que sí
 * puede usar el admin client— inyecta ambos.
 *
 * Límite generoso a propósito: una persona escaneando un palet de cajas hace
 * decenas de verificaciones; un enumerador que quiere cosechar folios necesita
 * miles → bloqueado. Ajustá las constantes si el patrón real lo pide.
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
 * `false`. Fail-open ante error de lectura.
 */
export async function isVerifyThrottled(db: ThrottleDb, ip: string): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - VERIFY_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count, error } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", windowStart);

  if (!error && (count ?? 0) >= VERIFY_IP_LIMIT) return true;

  // Best-effort: si el insert falla, la verificación sigue (no rompemos el QR).
  await db.from(TABLE).insert({ ip });
  return false;
}
