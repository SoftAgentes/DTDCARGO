/**
 * ¿Quién puede quedarse con un endpoint de Web Push que ya es de otro?
 * (SDD-0499)
 *
 * ## El problema
 *
 * `endpoint` es único global en las dos tablas de suscripciones, así que las
 * cinco rutas que registran una sub resuelven el choque re-asignando la fila al
 * que llama: `upsert(onConflict:"endpoint")` en `m/push/subscribe`,
 * `m/push/resubscribe` y `portal/push/subscribe`; delete-then-insert en
 * `studio/push/subscribe`. Los comentarios lo declaraban deliberado —"otro user
 * en el mismo browser", "móvil compartido entre operarios"—, y es un caso real:
 * la PushSubscription cuelga del REGISTRO del service worker, que es por origen
 * y no por sesión, así que en un equipo compartido dos personas distintas
 * presentan legítimamente el MISMO endpoint.
 *
 * Lo que no había era comprobación de que fuera el mismo navegador. El endpoint
 * llega en el cuerpo del request; con sólo conocerlo, cualquiera con sesión
 * válida se quedaba con la sub de otro. Eso apaga las notificaciones del dueño
 * —y en el portal cruza CLIENTES dentro del mismo tenant, sin necesitar un
 * segundo tenant para ser explotable.
 *
 * ## El criterio
 *
 * Es **integridad y disponibilidad**, no confidencialidad: el `user_id` sale
 * siempre de la sesión, así que nadie puede hacer que las notificaciones de
 * OTRO le lleguen a él. Lo que sí puede es dejar al otro sin recibirlas, y
 * mandar las suyas propias a un aparato que no controla.
 *
 * ## La comprobación
 *
 * El navegador no sólo trae el endpoint: trae `keys.auth`, el secreto de 16
 * bytes que el push service le emitió a ESA suscripción. El mismo registro de
 * service worker devuelve siempre el mismo par (endpoint, keys) —
 * `pushManager.subscribe()` con la misma applicationServerKey entrega la
 * suscripción que ya existe—, y si se des-suscribe y vuelve a suscribir cambia
 * el endpoint también, así que no hay choque. O sea: el equipo compartido de
 * verdad SIEMPRE supera esta prueba, y quien sólo se enteró del endpoint no.
 *
 * Por eso el rebind se conserva y se le exige posesión, en vez de prohibirlo: un
 * 409 seco rompería a la familia que comparte el teléfono sin darle salida.
 *
 * Fail-closed: si la lectura de la fila existente falla, se deniega. El costo de
 * equivocarse hacia el "no" es que el usuario reintente activar el push.
 */

import type { createAdminClient } from "@/lib/db/admin";
import { sameSecret } from "@/lib/http/secret-compare";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Mensaje único de denegación (es-VE, tuteo). No dice de quién es la sub: quien
 * llama no tiene por qué enterarse de que ese endpoint existe ni de a quién
 * pertenece.
 */
export const PUSH_REBIND_DENIAL =
  "Ese navegador ya tiene las notificaciones activas en otra cuenta. Actívalas desde el navegador que vas a usar.";

/** Forma mínima del jsonb `user_push_subscriptions.subscription`. */
type StoredSubscription = { keys?: { auth?: unknown } | null } | null;

function storedAuth(subscription: StoredSubscription): string | null {
  const auth = subscription?.keys?.auth;
  return typeof auth === "string" ? auth : null;
}

/**
 * `user_push_subscriptions` (staff del Studio y clientes del portal comparten
 * tabla). Devuelve el mensaje de denegación, o `null` si el endpoint está libre,
 * ya es del mismo user, o el que llama demuestra poseerlo.
 */
export async function userPushRebindDenial(
  admin: Admin,
  endpoint: string,
  userId: string,
  presentedAuth: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_push_subscriptions")
    .select("user_id, subscription")
    .eq("endpoint", endpoint)
    .maybeSingle<{ user_id: string; subscription: StoredSubscription }>();

  if (error) return PUSH_REBIND_DENIAL;
  if (!data) return null; // endpoint libre
  if (data.user_id === userId) return null; // es suya: renovación, no rebind
  return sameSecret(storedAuth(data.subscription), presentedAuth)
    ? null
    : PUSH_REBIND_DENIAL;
}

/**
 * `operario_push_subscriptions` (PIN, sin `auth.uid`). Guarda las claves en
 * columnas propias (`p256dh`, `auth`) en vez de un jsonb.
 */
export async function operarioPushRebindDenial(
  admin: Admin,
  endpoint: string,
  operarioId: string,
  presentedAuth: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("operario_push_subscriptions")
    .select("operario_id, auth")
    .eq("endpoint", endpoint)
    .maybeSingle<{ operario_id: string; auth: string | null }>();

  if (error) return PUSH_REBIND_DENIAL;
  if (!data) return null;
  if (data.operario_id === operarioId) return null;
  return sameSecret(data.auth, presentedAuth) ? null : PUSH_REBIND_DENIAL;
}
