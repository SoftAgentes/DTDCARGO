/**
 * Propaga un rebote de correo a la fila del aviso al cliente.
 *
 * ── El agujero que tapa ────────────────────────────────────────────────────
 * `drainClientNotifications` marca la fila `sent` como **claim atómico** antes
 * de despachar (así dos workers no mandan el mismo aviso dos veces). Eso está
 * bien. Lo que faltaba es el camino de vuelta: cuando Resend avisa que el correo
 * **rebotó**, se actualizaba `mail_logs` y nadie tocaba
 * `client_notification_schedule`. La fila quedaba en `sent` para siempre.
 *
 * Resultado: el equipo veía "Enviado" para un aviso que el cliente nunca
 * recibió. Peor que no avisar, porque cierra la pregunta.
 *
 * ── Por qué no hace falta migración ────────────────────────────────────────
 * El hilo ya existía: el drain guarda `schedule_id` en la `metadata` del
 * `mail_log` (`source: 'client-notification-drain'`). El webhook ya carga esa
 * metadata para correlacionar el newsletter. Sólo faltaba usarla acá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Statuses de Resend que significan "no llegó a la bandeja del cliente". */
const UNDELIVERED = new Set(["bounced", "complained", "failed"]);

/**
 * ¿Este evento de Resend debe degradar el aviso, y de cuál fila?
 *
 * Pura y testeable sin DB. `null` = no hacer nada.
 *
 * @param status    status ya traducido por `mailLogStatusFromEvent`
 * @param metadata  `mail_logs.metadata` del log que matcheó el webhook
 */
export function scheduleIdToDowngrade(
  status: string | undefined,
  metadata: Record<string, unknown> | null,
): string | null {
  if (!status || !UNDELIVERED.has(status)) return null;
  const id = metadata?.schedule_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Marca el aviso como NO entregado.
 *
 * Sólo pisa filas en `sent`: si el aviso ya se reprogramó o ya está en otro
 * estado terminal, no lo tocamos. `failed` es terminal para el drain —claima
 * únicamente `scheduled`—, así que esto NO genera un bucle de reenvío contra
 * una dirección muerta.
 *
 * Best-effort: nunca tira. El webhook debe responder 200 igual, o Resend lo
 * reintenta en loop.
 */
export async function markNotificationUndelivered(
  admin: SupabaseClient,
  scheduleId: string,
  status: string,
): Promise<void> {
  try {
    await admin
      .from("client_notification_schedule")
      .update({
        status: "failed",
        error: `el correo no llegó (${status})`,
      })
      .eq("id", scheduleId)
      .eq("status", "sent");
  } catch (err) {
    console.error("[mark-notification-undelivered] falló:", err);
  }
}
