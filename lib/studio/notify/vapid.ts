/**
 * Configuración VAPID compartida para Web Push (Sprint 4 v3).
 *
 * Extraído de send-bug-push.ts para que tanto el push de bugs (users
 * admin) como el push de operarios (PIN auth) compartan la misma config
 * de VAPID sin duplicar el side-effect de `webpush.setVapidDetails`.
 *
 * VAPID keys en env vars:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (client + server)
 *   - VAPID_PRIVATE_KEY (server only)
 *   - VAPID_SUBJECT (mailto: del contacto · default vzla@dtdcargo.com)
 *
 * Si las env vars no están seteadas (dev local sin push), `ensureVapid()`
 * devuelve false y los callers hacen no-op con un warning único.
 *
 * Setup de las keys: ver docs/runbooks/setup-web-push.md
 *   pnpm exec web-push generate-vapid-keys
 */

import webpush from "web-push";

let vapidConfigured = false;
let vapidWarned = false;

/**
 * Configura VAPID en el módulo `web-push` una sola vez por proceso.
 * Idempotente · seguro de llamar antes de cada envío.
 *
 * @returns `true` si VAPID está configurado y se puede enviar push,
 *          `false` si faltan env vars (caller debe hacer no-op).
 */
export function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:vzla@dtdcargo.com";

  if (!publicKey || !privateKey) {
    if (!vapidWarned) {
      console.warn(
        "[vapid] VAPID keys no configuradas en env. Web Push queda en no-op. " +
          "Generar con: pnpm exec web-push generate-vapid-keys",
      );
      vapidWarned = true;
    }
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export { webpush };
